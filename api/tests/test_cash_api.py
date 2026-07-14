"""
Cash router API tests: gating, manual movement CRUD, derived-movement
immutability, FX conversion endpoints, balances/summary payloads.
"""
from datetime import date
from decimal import Decimal

import pytest

from app.models import CashMode, CashMovementType
from app.services.market_data.currency import CurrencyService
from tests.factories import CashMovementFactory, PortfolioFactory

D = Decimal


@pytest.fixture
def portfolio(test_db, test_user):
    return PortfolioFactory(
        user_id=test_user.id, base_currency="USD", cash_mode=CashMode.TRACKED_WARN
    )


@pytest.fixture
def strict_portfolio(test_db, test_user):
    return PortfolioFactory(
        user_id=test_user.id, base_currency="USD", cash_mode=CashMode.TRACKED_STRICT
    )


def _deposit_payload(**overrides):
    payload = {
        "type": "deposit",
        "currency": "usd",
        "amount": "1000",
        "occurred_on": "2026-05-01",
    }
    payload.update(overrides)
    return payload


class TestGating:
    def test_untracked_portfolio_gets_409_everywhere(
        self, client, test_db, test_user, auth_headers
    ):
        untracked = PortfolioFactory(user_id=test_user.id, base_currency="USD")
        for method, path, body in (
            ("get", "cash/balances", None),
            ("get", "cash/movements", None),
            ("get", "cash/summary", None),
            ("post", "cash/movements", _deposit_payload()),
        ):
            resp = getattr(client, method)(
                f"/portfolios/{untracked.id}/{path}",
                headers=auth_headers,
                **({"json": body} if body else {}),
            )
            assert resp.status_code == 409, (method, path, resp.text)
            assert resp.json()["detail"]["code"] == "cash_tracking_not_enabled"

    def test_foreign_portfolio_is_forbidden(self, client, test_db, auth_headers):
        from tests.factories import UserFactory

        stranger = UserFactory()
        other = PortfolioFactory(
            user_id=stranger.id, cash_mode=CashMode.TRACKED_WARN, base_currency="USD"
        )
        resp = client.get(f"/portfolios/{other.id}/cash/balances", headers=auth_headers)
        assert resp.status_code == 403


class TestManualMovements:
    def test_deposit_roundtrip(self, client, test_db, auth_headers, portfolio):
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/movements",
            json=_deposit_payload(),
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["warnings"] == []
        movement = body["movement"]
        assert movement["currency"] == "USD"  # normalized
        assert D(movement["amount"]) == D("1000")
        assert movement["type"] == "deposit"
        assert movement["transaction_id"] is None

    def test_withdrawal_signed_and_warned(self, client, auth_headers, portfolio):
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/movements",
            json=_deposit_payload(type="withdrawal", amount="250", occurred_on="2026-05-02"),
            headers=auth_headers,
        )
        assert resp.status_code == 201
        body = resp.json()
        assert D(body["movement"]["amount"]) == D("-250")
        assert body["warnings"][0]["code"] == "negative_cash_balance"

    def test_strict_withdrawal_rejected(self, client, auth_headers, strict_portfolio):
        resp = client.post(
            f"/portfolios/{strict_portfolio.id}/cash/movements",
            json=_deposit_payload(type="withdrawal", amount="250"),
            headers=auth_headers,
        )
        assert resp.status_code == 409
        assert resp.json()["detail"]["code"] == "insufficient_cash"

    def test_opening_balance_rejected_by_schema(self, client, auth_headers, portfolio):
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/movements",
            json=_deposit_payload(type="opening_balance"),
            headers=auth_headers,
        )
        assert resp.status_code == 422

    def test_negative_amount_rejected_at_boundary(self, client, auth_headers, portfolio):
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/movements",
            json=_deposit_payload(amount="-100"),
            headers=auth_headers,
        )
        assert resp.status_code == 422

    def test_invalid_currency_rejected(self, client, auth_headers, portfolio):
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/movements",
            json=_deposit_payload(currency="GBX"),
            headers=auth_headers,
        )
        assert resp.status_code == 422
        assert resp.json()["detail"]["code"] == "invalid_currency_code"

    def test_adjustment_requires_reason_and_direction(self, client, auth_headers, portfolio):
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/movements",
            json=_deposit_payload(type="adjustment", direction="debit"),
            headers=auth_headers,
        )
        assert resp.status_code == 422
        assert resp.json()["detail"]["code"] == "adjustment_reason_required"

        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/movements",
            json=_deposit_payload(
                type="adjustment", direction="debit", reason="Broker sync correction"
            ),
            headers=auth_headers,
        )
        assert resp.status_code == 201
        assert D(resp.json()["movement"]["amount"]) == D("-1000")

    def test_update_and_delete_manual_movement(self, client, test_db, auth_headers, portfolio):
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/movements",
            json=_deposit_payload(),
            headers=auth_headers,
        )
        movement_id = resp.json()["movement"]["id"]

        resp = client.put(
            f"/portfolios/{portfolio.id}/cash/movements/{movement_id}",
            json={"amount": "1500", "notes": "corrected"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert D(resp.json()["movement"]["amount"]) == D("1500")
        assert resp.json()["movement"]["notes"] == "corrected"

        resp = client.delete(
            f"/portfolios/{portfolio.id}/cash/movements/{movement_id}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["deleted"] == movement_id

        resp = client.get(
            f"/portfolios/{portfolio.id}/cash/movements", headers=auth_headers
        )
        assert resp.json()["total"] == 0

    def test_derived_movements_are_immutable(
        self, client, test_db, test_user, auth_headers, portfolio
    ):
        from tests.factories import AssetFactory

        asset = AssetFactory()
        resp = client.post(
            f"/portfolios/{portfolio.id}/transactions",
            json={
                "asset_id": asset.id, "tx_date": "2026-05-05", "type": "BUY",
                "quantity": "1", "price": "100", "fees": "0", "currency": "USD",
            },
            headers=auth_headers,
        )
        tx_id = resp.json()["id"]
        resp = client.get(
            f"/portfolios/{portfolio.id}/cash/movements", headers=auth_headers
        )
        derived = [m for m in resp.json()["items"] if m["transaction_id"] == tx_id][0]

        resp = client.put(
            f"/portfolios/{portfolio.id}/cash/movements/{derived['id']}",
            json={"amount": "1"},
            headers=auth_headers,
        )
        assert resp.status_code == 409
        assert resp.json()["detail"]["code"] == "derived_movement_immutable"

        resp = client.delete(
            f"/portfolios/{portfolio.id}/cash/movements/{derived['id']}",
            headers=auth_headers,
        )
        assert resp.status_code == 409

    def test_movement_filters_and_pagination(self, client, test_db, auth_headers, portfolio):
        for i, (ccy, mv_type, amount) in enumerate([
            ("USD", CashMovementType.DEPOSIT, "100"),
            ("EUR", CashMovementType.DEPOSIT, "200"),
            ("USD", CashMovementType.WITHDRAWAL, "-50"),
        ]):
            CashMovementFactory(
                portfolio_id=portfolio.id, currency=ccy, type=mv_type,
                amount=D(amount), occurred_on=date(2026, 5, 1 + i),
            )
        resp = client.get(
            f"/portfolios/{portfolio.id}/cash/movements?currency=usd",
            headers=auth_headers,
        )
        assert resp.json()["total"] == 2
        resp = client.get(
            f"/portfolios/{portfolio.id}/cash/movements?type=withdrawal",
            headers=auth_headers,
        )
        assert resp.json()["total"] == 1
        resp = client.get(
            f"/portfolios/{portfolio.id}/cash/movements?skip=1&limit=1",
            headers=auth_headers,
        )
        body = resp.json()
        assert body["total"] == 3 and len(body["items"]) == 1


class TestFxConversions:
    def _fund(self, portfolio, amount, currency):
        CashMovementFactory(
            portfolio_id=portfolio.id, currency=currency,
            type=CashMovementType.DEPOSIT, amount=D(amount),
            occurred_on=date(2026, 4, 1),
        )

    def test_conversion_roundtrip(self, client, test_db, auth_headers, portfolio):
        self._fund(portfolio, "2000", "EUR")
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/fx-conversions",
            json={
                "source_currency": "EUR", "target_currency": "USD",
                "source_amount": "950", "target_amount": "1002",
                "occurred_on": "2026-05-01", "fee_amount": "2",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        conversion_id = body["conversion_id"]
        assert len(body["movements"]) == 3
        types = {m["type"]: m for m in body["movements"]}
        assert D(types["fx_debit"]["amount"]) == D("-950")
        assert D(types["fx_credit"]["amount"]) == D("1002")
        assert D(types["fee"]["amount"]) == D("-2")
        assert types["fee"]["currency"] == "EUR"

        # Update rewrites all legs
        resp = client.put(
            f"/portfolios/{portfolio.id}/cash/fx-conversions/{conversion_id}",
            json={
                "source_currency": "EUR", "target_currency": "USD",
                "source_amount": "500", "target_amount": "525",
                "occurred_on": "2026-05-01",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert len(resp.json()["movements"]) == 2

        # Delete removes all legs
        resp = client.delete(
            f"/portfolios/{portfolio.id}/cash/fx-conversions/{conversion_id}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        resp = client.get(
            f"/portfolios/{portfolio.id}/cash/movements", headers=auth_headers
        )
        assert resp.json()["total"] == 1  # only the funding deposit remains

    def test_missing_conversion_404(self, client, auth_headers, portfolio):
        resp = client.delete(
            f"/portfolios/{portfolio.id}/cash/fx-conversions/nope",
            headers=auth_headers,
        )
        assert resp.status_code == 404
        assert resp.json()["detail"]["code"] == "fx_conversion_not_found"


class TestBalancesAndSummary:
    def test_balances_with_mocked_fx(self, client, test_db, auth_headers, portfolio, monkeypatch):
        CashMovementFactory(
            portfolio_id=portfolio.id, currency="USD",
            type=CashMovementType.DEPOSIT, amount=D("1000"), occurred_on=date(2026, 5, 1),
        )
        CashMovementFactory(
            portfolio_id=portfolio.id, currency="EUR",
            type=CashMovementType.DEPOSIT, amount=D("500"), occurred_on=date(2026, 5, 1),
        )
        CashMovementFactory(
            portfolio_id=portfolio.id, currency="GBP",
            type=CashMovementType.WITHDRAWAL, amount=D("-80"), occurred_on=date(2026, 5, 1),
        )

        rates = {("EUR", "USD"): D("1.10"), ("GBP", "USD"): None}

        def fake_rate(from_ccy, to_ccy):
            if from_ccy == to_ccy:
                return D("1")
            return rates.get((from_ccy, to_ccy))

        monkeypatch.setattr(CurrencyService, "get_exchange_rate", staticmethod(fake_rate))
        monkeypatch.setattr(
            CurrencyService, "is_exchange_rate_stale", staticmethod(lambda f, t: f == "EUR")
        )

        resp = client.get(f"/portfolios/{portfolio.id}/cash/balances", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["base_currency"] == "USD"
        assert body["fx_status"] == "partial"  # GBP has no rate
        by_ccy = {b["currency"]: b for b in body["balances"]}
        assert D(str(by_ccy["USD"]["balance_base"])) == D("1000")
        assert D(str(by_ccy["EUR"]["balance_base"])) == D("550")
        assert by_ccy["EUR"]["rate_stale"] is True
        assert by_ccy["GBP"]["rate_unavailable"] is True
        assert by_ccy["GBP"]["balance_base"] is None
        # GBP excluded from the converted total; never assumed 1:1
        assert D(str(body["total_base"])) == D("1550")

    def test_summary_pnl_breakdown_excludes_transaction_fees(
        self, client, test_db, test_user, auth_headers, portfolio
    ):
        from tests.factories import AssetFactory

        CashMovementFactory(
            portfolio_id=portfolio.id, currency="USD",
            type=CashMovementType.DEPOSIT, amount=D("10000"), occurred_on=date(2026, 4, 1),
        )
        # Manual interest, fee, tax
        for mv_type, amount in (("interest", "12.5"), ("fee", "3"), ("tax", "7")):
            client.post(
                f"/portfolios/{portfolio.id}/cash/movements",
                json=_deposit_payload(type=mv_type, amount=amount, occurred_on="2026-05-01"),
                headers=auth_headers,
            )
        # An asset buy with fees: its fee movement must NOT appear in the
        # standalone breakdown (it is already inside the cost basis)
        asset = AssetFactory()
        client.post(
            f"/portfolios/{portfolio.id}/transactions",
            json={
                "asset_id": asset.id, "tx_date": "2026-05-05", "type": "BUY",
                "quantity": "10", "price": "100", "fees": "9", "currency": "USD",
            },
            headers=auth_headers,
        )

        resp = client.get(f"/portfolios/{portfolio.id}/cash/summary", headers=auth_headers)
        assert resp.status_code == 200
        pnl = resp.json()["pnl"]
        assert D(str(pnl["interest_income"])) == D("12.5")
        assert D(str(pnl["standalone_fees"])) == D("-3")
        assert D(str(pnl["standalone_taxes"])) == D("-7")
        assert pnl["fx_pnl"] is None
        assert pnl["fx_pnl_status"] == "unavailable"
