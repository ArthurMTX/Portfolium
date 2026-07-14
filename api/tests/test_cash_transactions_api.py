"""
API-level tests for cash-aware transaction create/update/delete on tracked
portfolios: strict 409 contract, warn-mode warnings, atomicity, revision
counter, derived-movement lifecycle.
"""
from datetime import date
from decimal import Decimal

import pytest

from app.crud import cash as crud_cash
from app.models import CashMode, CashMovementType, Portfolio, TransactionType
from tests.factories import AssetFactory, CashMovementFactory, PortfolioFactory

D = Decimal
TX_DATE = "2026-05-15"


@pytest.fixture
def asset(test_db):
    return AssetFactory(symbol="CASHTST", currency="USD")


def _make_portfolio(test_db, test_user, mode):
    portfolio = PortfolioFactory(
        user_id=test_user.id, base_currency="USD", cash_mode=mode
    )
    return portfolio


def _fund(portfolio, amount, currency="USD", occurred_on=date(2026, 1, 1)):
    return CashMovementFactory(
        portfolio_id=portfolio.id,
        currency=currency,
        type=CashMovementType.DEPOSIT,
        amount=D(amount),
        occurred_on=occurred_on,
    )


def _buy_payload(asset, quantity="10", price="100", fees="2"):
    return {
        "asset_id": asset.id,
        "tx_date": TX_DATE,
        "type": "BUY",
        "quantity": quantity,
        "price": price,
        "fees": fees,
        "currency": "USD",
    }


class TestStrictMode:
    def test_insufficient_cash_returns_structured_409(
        self, client, test_db, test_user, auth_headers, asset
    ):
        portfolio = _make_portfolio(test_db, test_user, CashMode.TRACKED_STRICT)
        _fund(portfolio, "500")

        resp = client.post(
            f"/portfolios/{portfolio.id}/transactions",
            json=_buy_payload(asset),
            headers=auth_headers,
        )
        assert resp.status_code == 409
        detail = resp.json()["detail"]
        assert detail["code"] == "insufficient_cash"
        ctx = detail["context"]
        assert ctx["currency"] == "USD"
        assert ctx["available"] == "500.00000000"
        assert ctx["required"] == "1002.00000000"
        assert ctx["missing"] == "502.00000000"
        assert ctx["portfolio_id"] == portfolio.id
        assert ctx["date"] == TX_DATE

        # Nothing persisted: no transaction, no movements
        resp = client.get(
            f"/portfolios/{portfolio.id}/transactions", headers=auth_headers
        )
        assert resp.json() == []
        assert crud_cash.get_balances(test_db, portfolio.id, as_of=date(2026, 12, 31)) == {
            "USD": D("500")
        }

    def test_sufficient_cash_creates_transaction_and_movements(
        self, client, test_db, test_user, auth_headers, asset
    ):
        portfolio = _make_portfolio(test_db, test_user, CashMode.TRACKED_STRICT)
        _fund(portfolio, "2000")

        resp = client.post(
            f"/portfolios/{portfolio.id}/transactions",
            json=_buy_payload(asset),
            headers=auth_headers,
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["cash_warnings"] is None
        tx_id = body["id"]

        movements = crud_cash.get_movements_for_transaction(test_db, tx_id)
        assert [(m.type, m.amount) for m in movements] == [
            (CashMovementType.BUY, D("-1000")),
            (CashMovementType.FEE, D("-2")),
        ]
        assert crud_cash.get_balance(test_db, portfolio.id, "USD", as_of=date(2026, 12, 31)) == D("998")

    def test_sell_credits_cash(self, client, test_db, test_user, auth_headers, asset):
        portfolio = _make_portfolio(test_db, test_user, CashMode.TRACKED_STRICT)
        _fund(portfolio, "2000")
        resp = client.post(
            f"/portfolios/{portfolio.id}/transactions",
            json=_buy_payload(asset, quantity="10", price="100", fees="0"),
            headers=auth_headers,
        )
        assert resp.status_code == 201

        resp = client.post(
            f"/portfolios/{portfolio.id}/transactions",
            json={
                "asset_id": asset.id,
                "tx_date": "2026-05-20",
                "type": "SELL",
                "quantity": "10",
                "price": "120",
                "fees": "2",
                "currency": "USD",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        # 2000 - 1000 + 1200 - 2
        assert crud_cash.get_balance(test_db, portfolio.id, "USD", as_of=date(2026, 12, 31)) == D("2198")

    def test_update_excludes_own_movements_from_validation(
        self, client, test_db, test_user, auth_headers, asset
    ):
        portfolio = _make_portfolio(test_db, test_user, CashMode.TRACKED_STRICT)
        _fund(portfolio, "1100")
        resp = client.post(
            f"/portfolios/{portfolio.id}/transactions",
            json=_buy_payload(asset, quantity="10", price="100", fees="0"),
            headers=auth_headers,
        )
        tx_id = resp.json()["id"]

        # Re-pricing the same buy to 1050 fits only if the original 1000
        # debit is excluded from validation
        resp = client.put(
            f"/portfolios/{portfolio.id}/transactions/{tx_id}",
            json=_buy_payload(asset, quantity="10", price="105", fees="0"),
            headers=auth_headers,
        )
        assert resp.status_code == 200
        movements = crud_cash.get_movements_for_transaction(test_db, tx_id)
        assert [(m.type, m.amount) for m in movements] == [
            (CashMovementType.BUY, D("-1050")),
        ]

        # But 1200 must be rejected
        resp = client.put(
            f"/portfolios/{portfolio.id}/transactions/{tx_id}",
            json=_buy_payload(asset, quantity="10", price="120", fees="0"),
            headers=auth_headers,
        )
        assert resp.status_code == 409
        assert resp.json()["detail"]["code"] == "insufficient_cash"
        # Unchanged after the rejected update
        test_db.expire_all()
        movements = crud_cash.get_movements_for_transaction(test_db, tx_id)
        assert [(m.type, m.amount) for m in movements] == [
            (CashMovementType.BUY, D("-1050")),
        ]

    def test_delete_sell_that_funds_later_buy_is_rejected(
        self, client, test_db, test_user, auth_headers, asset
    ):
        portfolio = _make_portfolio(test_db, test_user, CashMode.TRACKED_STRICT)
        _fund(portfolio, "1000")
        # Buy 10 @ 100 (cash 0), sell 10 @ 150 on May 20 (cash 1500),
        # buy again 12 @ 100 on May 25 (cash 300)
        client.post(
            f"/portfolios/{portfolio.id}/transactions",
            json=_buy_payload(asset, quantity="10", price="100", fees="0"),
            headers=auth_headers,
        )
        resp = client.post(
            f"/portfolios/{portfolio.id}/transactions",
            json={
                "asset_id": asset.id, "tx_date": "2026-05-20", "type": "SELL",
                "quantity": "10", "price": "150", "fees": "0", "currency": "USD",
            },
            headers=auth_headers,
        )
        sell_id = resp.json()["id"]
        resp = client.post(
            f"/portfolios/{portfolio.id}/transactions",
            json={
                "asset_id": asset.id, "tx_date": "2026-05-25", "type": "BUY",
                "quantity": "12", "price": "100", "fees": "0", "currency": "USD",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201

        # Deleting the sell would strand the later buy
        resp = client.delete(
            f"/portfolios/{portfolio.id}/transactions/{sell_id}",
            headers=auth_headers,
        )
        assert resp.status_code == 409
        assert resp.json()["detail"]["code"] == "insufficient_cash"
        # Sell still present
        resp = client.get(
            f"/portfolios/{portfolio.id}/transactions", headers=auth_headers
        )
        assert any(t["id"] == sell_id for t in resp.json())

    def test_delete_removes_derived_movements(
        self, client, test_db, test_user, auth_headers, asset
    ):
        portfolio = _make_portfolio(test_db, test_user, CashMode.TRACKED_STRICT)
        _fund(portfolio, "2000")
        resp = client.post(
            f"/portfolios/{portfolio.id}/transactions",
            json=_buy_payload(asset),
            headers=auth_headers,
        )
        tx_id = resp.json()["id"]
        resp = client.delete(
            f"/portfolios/{portfolio.id}/transactions/{tx_id}",
            headers=auth_headers,
        )
        assert resp.status_code == 204
        assert crud_cash.get_movements_for_transaction(test_db, tx_id) == []
        assert crud_cash.get_balance(test_db, portfolio.id, "USD", as_of=date(2026, 12, 31)) == D("2000")


class TestWarnMode:
    def test_insufficient_cash_warns_but_succeeds(
        self, client, test_db, test_user, auth_headers, asset
    ):
        portfolio = _make_portfolio(test_db, test_user, CashMode.TRACKED_WARN)
        _fund(portfolio, "500")

        resp = client.post(
            f"/portfolios/{portfolio.id}/transactions",
            json=_buy_payload(asset),
            headers=auth_headers,
        )
        assert resp.status_code == 201
        warnings = resp.json()["cash_warnings"]
        assert len(warnings) == 1
        assert warnings[0]["code"] == "negative_cash_balance"
        assert warnings[0]["currency"] == "USD"
        assert warnings[0]["date"] == TX_DATE
        assert warnings[0]["projected_balance"] == "-502.00000000"
        assert crud_cash.get_balance(test_db, portfolio.id, "USD", as_of=date(2026, 12, 31)) == D("-502")

    def test_covered_transaction_has_no_warnings(
        self, client, test_db, test_user, auth_headers, asset
    ):
        portfolio = _make_portfolio(test_db, test_user, CashMode.TRACKED_WARN)
        _fund(portfolio, "5000")
        resp = client.post(
            f"/portfolios/{portfolio.id}/transactions",
            json=_buy_payload(asset),
            headers=auth_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["cash_warnings"] is None


class TestRevisionCounter:
    def test_seq_bumps_on_every_mutation_and_stays_synced_when_tracked(
        self, client, test_db, test_user, auth_headers, asset
    ):
        portfolio = _make_portfolio(test_db, test_user, CashMode.TRACKED_WARN)
        _fund(portfolio, "10000")

        def fresh():
            test_db.expire_all()
            return test_db.get(Portfolio, portfolio.id)

        resp = client.post(
            f"/portfolios/{portfolio.id}/transactions",
            json=_buy_payload(asset),
            headers=auth_headers,
        )
        tx_id = resp.json()["id"]
        p = fresh()
        assert p.tx_change_seq == 1
        assert p.cash_ledger_synced_seq == 1

        client.put(
            f"/portfolios/{portfolio.id}/transactions/{tx_id}",
            json=_buy_payload(asset, price="90"),
            headers=auth_headers,
        )
        p = fresh()
        assert p.tx_change_seq == 2
        assert p.cash_ledger_synced_seq == 2

        client.delete(
            f"/portfolios/{portfolio.id}/transactions/{tx_id}",
            headers=auth_headers,
        )
        p = fresh()
        assert p.tx_change_seq == 3
        assert p.cash_ledger_synced_seq == 3

    def test_untracked_mutations_bump_seq_without_syncing_ledger(
        self, client, test_db, test_user, auth_headers, asset
    ):
        portfolio = _make_portfolio(test_db, test_user, CashMode.UNTRACKED)
        resp = client.post(
            f"/portfolios/{portfolio.id}/transactions",
            json=_buy_payload(asset),
            headers=auth_headers,
        )
        assert resp.status_code == 201
        test_db.expire_all()
        p = test_db.get(Portfolio, portfolio.id)
        assert p.tx_change_seq == 1
        assert p.cash_ledger_synced_seq is None
        # No movements are ever created while untracked
        movements, total = crud_cash.get_movements(test_db, portfolio.id)
        assert total == 0


class TestOwnership:
    def test_other_users_portfolio_is_forbidden(
        self, client, test_db, auth_headers, asset
    ):
        from tests.factories import UserFactory

        stranger = UserFactory()
        portfolio = PortfolioFactory(
            user_id=stranger.id, base_currency="USD", cash_mode=CashMode.TRACKED_STRICT
        )
        resp = client.post(
            f"/portfolios/{portfolio.id}/transactions",
            json=_buy_payload(asset),
            headers=auth_headers,
        )
        assert resp.status_code == 403


class TestAtomicity:
    def test_failed_ledger_write_rolls_back_transaction(
        self, client, test_db, test_user, auth_headers, asset, monkeypatch
    ):
        portfolio = _make_portfolio(test_db, test_user, CashMode.TRACKED_WARN)
        _fund(portfolio, "5000")

        from app.services.cash import ledger as cash_ledger

        def boom(*args, **kwargs):
            raise RuntimeError("simulated ledger failure")

        monkeypatch.setattr(cash_ledger, "insert_movements", boom)
        # The test client propagates unhandled server exceptions
        with pytest.raises(RuntimeError, match="simulated ledger failure"):
            client.post(
                f"/portfolios/{portfolio.id}/transactions",
                json=_buy_payload(asset),
                headers=auth_headers,
            )

        # The transaction row must not exist: the ledger failure rolled it back
        monkeypatch.undo()
        test_db.rollback()
        resp = client.get(
            f"/portfolios/{portfolio.id}/transactions", headers=auth_headers
        )
        assert resp.json() == []


class TestDividendsAndConversions:
    def test_dividend_credits_gross_and_debits_tax(
        self, client, test_db, test_user, auth_headers, asset
    ):
        portfolio = _make_portfolio(test_db, test_user, CashMode.TRACKED_WARN)
        _fund(portfolio, "2000")
        client.post(
            f"/portfolios/{portfolio.id}/transactions",
            json=_buy_payload(asset, quantity="5", price="100", fees="0"),
            headers=auth_headers,
        )
        resp = client.post(
            f"/portfolios/{portfolio.id}/transactions",
            json={
                "asset_id": asset.id, "tx_date": "2026-05-20", "type": "DIVIDEND",
                "quantity": "5", "price": "5", "fees": "5", "currency": "USD",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        tx_id = resp.json()["id"]
        movements = crud_cash.get_movements_for_transaction(test_db, tx_id)
        assert [(m.type, m.amount) for m in movements] == [
            (CashMovementType.DIVIDEND, D("25")),
            (CashMovementType.TAX, D("-5")),
        ]

    def test_crypto_conversion_only_debits_fee(
        self, client, test_db, test_user, auth_headers
    ):
        from app.models import AssetClass

        portfolio = _make_portfolio(test_db, test_user, CashMode.TRACKED_WARN)
        _fund(portfolio, "1000")
        btc = AssetFactory(symbol="BTC-USD", currency="USD", class_=AssetClass.CRYPTO)
        eth = AssetFactory(symbol="ETH-USD", currency="USD", class_=AssetClass.CRYPTO)
        # Hold some BTC first
        client.post(
            f"/portfolios/{portfolio.id}/transactions",
            json={
                "asset_id": btc.id, "tx_date": "2026-05-01", "type": "BUY",
                "quantity": "0.5", "price": "1000", "fees": "0", "currency": "USD",
            },
            headers=auth_headers,
        )
        resp = client.post(
            f"/portfolios/{portfolio.id}/conversions",
            json={
                "tx_date": "2026-05-10",
                "from_asset_id": btc.id,
                "from_quantity": "0.5",
                "from_price": "1000",
                "to_asset_id": eth.id,
                "to_quantity": "8",
                "to_price": "62.5",
                "fees": "3",
                "currency": "USD",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        out_tx_id = body["from_transaction"]["id"]
        in_tx_id = body["to_transaction"]["id"]
        movements = crud_cash.get_movements_for_transaction(test_db, out_tx_id)
        assert [(m.type, m.amount) for m in movements] == [
            (CashMovementType.FEE, D("-3")),
        ]
        assert crud_cash.get_movements_for_transaction(test_db, in_tx_id) == []
        # 1000 (deposit) - 500 (buy) - 3 (conversion fee)
        assert crud_cash.get_balance(test_db, portfolio.id, "USD", as_of=date(2026, 12, 31)) == D("497")
