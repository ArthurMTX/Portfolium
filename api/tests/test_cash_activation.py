"""
Activation workflow tests: preview (both strategies), atomic + idempotent
apply, mode transition matrix, ledger staleness detection, explicit wipe.
"""
import uuid
from datetime import date
from decimal import Decimal

import pytest

from app.models import CashMode, CashMovement, Portfolio
from tests.factories import AssetFactory, PortfolioFactory, TransactionFactory

D = Decimal


@pytest.fixture
def portfolio(test_db, test_user):
    return PortfolioFactory(user_id=test_user.id, base_currency="USD")


@pytest.fixture
def asset(test_db):
    return AssetFactory(symbol="ACTVT", currency="USD")


def _seed_history(portfolio, asset):
    """Buys/sells/dividend around the activation window"""
    from app.models import TransactionType

    # Before the window: must never affect cash
    TransactionFactory(
        portfolio_id=portfolio.id, asset_id=asset.id, tx_date=date(2025, 6, 1),
        type=TransactionType.BUY, quantity=D("5"), price=D("50"), fees=D("1"),
        currency="USD",
    )
    # Inside the window
    TransactionFactory(
        portfolio_id=portfolio.id, asset_id=asset.id, tx_date=date(2026, 2, 1),
        type=TransactionType.BUY, quantity=D("10"), price=D("100"), fees=D("2"),
        currency="USD",
    )
    TransactionFactory(
        portfolio_id=portfolio.id, asset_id=asset.id, tx_date=date(2026, 3, 1),
        type=TransactionType.SELL, quantity=D("4"), price=D("120"), fees=D("1"),
        currency="USD",
    )
    TransactionFactory(
        portfolio_id=portfolio.id, asset_id=asset.id, tx_date=date(2026, 4, 1),
        type=TransactionType.DIVIDEND, quantity=D("6"), price=D("2"), fees=D("1"),
        currency="USD",
    )


START = "2026-01-01"


def _request(strategy="replay", target="tracked_warn", openings=None, activation_id=None):
    return {
        "strategy": strategy,
        "start_date": START,
        "target_mode": target,
        "opening_balances": openings or [],
        **({"activation_id": activation_id} if activation_id else {}),
    }


class TestPreview:
    def test_replay_proposes_inferred_deposit_on_the_day_it_is_needed(
        self, client, test_db, auth_headers, portfolio, asset
    ):
        _seed_history(portfolio, asset)
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/activation/preview",
            json=_request(),
            headers=auth_headers,
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        # buy -1000 -2 fee on 2026-02-01 is the only day cash runs short:
        # one deposit for the exact shortfall (fees included), dated that day
        assert body["proposed_inferred_deposits"] == [
            {"currency": "USD", "date": "2026-02-01", "amount": "1002.00000000"}
        ]
        # With the inferred deposits applied there are no dips left
        assert body["negative_dips"] == []
        # 1002 - 1002 + 479 + 11
        assert body["projected_balances"] == [
            {"currency": "USD", "balance": "490.00000000"}
        ]
        # 2 (buy+fee) + 2 (sell+fee) + 2 (dividend+tax); pre-window buy excluded
        assert body["derived_movement_count"] == 6
        assert body["blocking_issues"] == []
        # Preview writes nothing
        assert test_db.query(CashMovement).count() == 0

    def test_omitted_start_date_scans_from_earliest_transaction(
        self, client, test_db, auth_headers, portfolio, asset
    ):
        _seed_history(portfolio, asset)
        payload = _request()
        del payload["start_date"]
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/activation/preview",
            json=payload,
            headers=auth_headers,
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        # Resolved to the earliest transaction date: the 2025-06-01 buy
        # (excluded by the explicit START window) is now included, and each
        # underfunded day gets its own deposit (total 1253, the old
        # deepest-point total, but distributed when the money was needed)
        assert body["start_date"] == "2025-06-01"
        assert body["derived_movement_count"] == 8
        assert body["proposed_inferred_deposits"] == [
            {"currency": "USD", "date": "2025-06-01", "amount": "251.00000000"},
            {"currency": "USD", "date": "2026-02-01", "amount": "1002.00000000"},
        ]

        # Apply recomputes the same deterministic result server-side; the
        # proposals are never passed back through the request
        apply_payload = {**payload, "activation_id": str(uuid.uuid4())}
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/activation",
            json=apply_payload,
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text
        result = resp.json()
        assert result["cash_tracking_started_on"] == "2025-06-01"
        assert result["inferred_deposit_count"] == 2
        assert result["inferred_deposit_totals"] == [
            {"currency": "USD", "amount": "1253.00000000", "count": 2}
        ]

    def test_omitted_start_date_defaults_to_today_without_transactions(
        self, client, auth_headers, portfolio
    ):
        payload = _request()
        del payload["start_date"]
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/activation/preview",
            json=payload,
            headers=auth_headers,
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["start_date"] == date.today().isoformat()

    def test_opening_balances_strategy_reports_dips(
        self, client, auth_headers, portfolio, asset
    ):
        _seed_history(portfolio, asset)
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/activation/preview",
            json=_request(
                strategy="opening_balances",
                openings=[{"currency": "USD", "amount": "500"}],
            ),
            headers=auth_headers,
        )
        body = resp.json()
        # Deposits are only ever inferred by the replay strategy
        assert body["proposed_inferred_deposits"] == []
        assert body["negative_dips"] == [
            {"currency": "USD", "date": "2026-02-01", "projected_balance": "-502.00000000"}
        ]

    def test_unsupported_transaction_currency_is_blocking(
        self, client, test_db, auth_headers, portfolio
    ):
        from app.models import TransactionType

        exotic = AssetFactory(symbol="EXOTC.L", currency="GBX")
        TransactionFactory(
            portfolio_id=portfolio.id, asset_id=exotic.id, tx_date=date(2026, 2, 1),
            type=TransactionType.BUY, quantity=D("10"), price=D("100"), fees=D("0"),
            currency="GBX",
        )
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/activation/preview",
            json=_request(),
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert "GBX" in resp.json()["blocking_issues"][0]


class TestApply:
    def test_apply_is_atomic_and_idempotent(
        self, client, test_db, auth_headers, portfolio, asset
    ):
        _seed_history(portfolio, asset)
        activation_id = str(uuid.uuid4())
        request = _request(
            openings=[{"currency": "USD", "amount": "1002"}],
            activation_id=activation_id,
        )
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/activation",
            json=request,
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["cash_mode"] == "tracked_warn"
        assert body["cash_tracking_started_on"] == START
        assert body["already_applied"] is False
        assert body["derived_movement_count"] == 7  # 6 derived + 1 opening
        # The user-supplied opening covers everything: nothing is inferred
        assert body["inferred_deposit_count"] == 0
        assert body["inferred_deposit_totals"] == []

        # Ledger: opening + 6 derived movements; pre-window buy has none
        assert test_db.query(CashMovement).count() == 7
        test_db.expire_all()
        p = test_db.get(Portfolio, portfolio.id)
        assert p.cash_mode == CashMode.TRACKED_WARN
        assert p.cash_activation_id == activation_id
        assert p.cash_ledger_synced_seq == p.tx_change_seq
        assert p.cash_activation_meta["strategy"] == "replay"

        # Idempotent retry: same activation_id, no duplicates
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/activation",
            json=request,
            headers=auth_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["already_applied"] is True
        assert test_db.query(CashMovement).count() == 7

        # Different activation while tracked -> conflict
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/activation",
            json=_request(activation_id=str(uuid.uuid4())),
            headers=auth_headers,
        )
        assert resp.status_code == 409
        assert resp.json()["detail"]["code"] == "cash_activation_conflict"

    def test_apply_requires_activation_id(self, client, auth_headers, portfolio):
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/activation",
            json=_request(),
            headers=auth_headers,
        )
        assert resp.status_code == 422
        assert resp.json()["detail"]["code"] == "activation_id_required"

    def test_strict_target_rejects_unresolved_dips_for_opening_balances(
        self, client, test_db, auth_headers, portfolio, asset
    ):
        _seed_history(portfolio, asset)
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/activation",
            json=_request(
                strategy="opening_balances",
                target="tracked_strict",
                openings=[{"currency": "USD", "amount": "100"}],
                activation_id=str(uuid.uuid4()),
            ),
            headers=auth_headers,
        )
        assert resp.status_code == 409
        assert resp.json()["detail"]["code"] == "insufficient_cash"
        # Atomic: nothing persisted
        assert test_db.query(CashMovement).count() == 0
        test_db.expire_all()
        assert test_db.get(Portfolio, portfolio.id).cash_mode == CashMode.UNTRACKED

    def test_strict_replay_succeeds_via_inferred_deposits(
        self, client, test_db, auth_headers, portfolio, asset
    ):
        """A replay reconstruction is dip-free by construction, so it
        always satisfies strict mode"""
        _seed_history(portfolio, asset)
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/activation",
            json=_request(target="tracked_strict", activation_id=str(uuid.uuid4())),
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["inferred_deposit_count"] == 1

    def test_user_openings_are_used_before_inferring_deposits(
        self, client, test_db, auth_headers, portfolio, asset
    ):
        """A sufficient user-supplied opening balance is preserved and no
        deposit is inferred on top of it"""
        from app.models import CashMovementType, TransactionType

        for month in (2, 3, 4):
            TransactionFactory(
                portfolio_id=portfolio.id, asset_id=asset.id,
                tx_date=date(2026, month, 1), type=TransactionType.BUY,
                quantity=D("1"), price=D("100"), fees=D("0"), currency="USD",
            )
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/activation",
            json=_request(
                openings=[{"currency": "USD", "amount": "300"}],
                activation_id=str(uuid.uuid4()),
            ),
            headers=auth_headers,
        )
        assert resp.status_code == 201
        openings = (
            test_db.query(CashMovement)
            .filter(CashMovement.type == CashMovementType.OPENING_BALANCE)
            .all()
        )
        assert len(openings) == 1
        assert openings[0].amount == D("300")
        deposits = (
            test_db.query(CashMovement)
            .filter(CashMovement.type == CashMovementType.DEPOSIT)
            .count()
        )
        assert deposits == 0


class TestModeTransitions:
    def _activate(self, client, auth_headers, portfolio, target="tracked_warn", openings=None):
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/activation",
            json=_request(
                target=target,
                openings=openings or [{"currency": "USD", "amount": "1000"}],
                activation_id=str(uuid.uuid4()),
            ),
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text

    def _set_mode(self, client, auth_headers, portfolio, mode):
        return client.put(
            f"/portfolios/{portfolio.id}/cash/mode",
            json={"mode": mode},
            headers=auth_headers,
        )

    def test_untracked_to_tracked_requires_activation(self, client, auth_headers, portfolio):
        resp = self._set_mode(client, auth_headers, portfolio, "tracked_warn")
        assert resp.status_code == 409
        assert resp.json()["detail"]["code"] == "cash_mode_transition_invalid"

    def test_warn_strict_roundtrip(self, client, auth_headers, portfolio):
        self._activate(client, auth_headers, portfolio)
        resp = self._set_mode(client, auth_headers, portfolio, "tracked_strict")
        assert resp.status_code == 200
        assert resp.json()["cash_mode"] == "tracked_strict"
        resp = self._set_mode(client, auth_headers, portfolio, "tracked_warn")
        assert resp.status_code == 200
        assert resp.json()["cash_mode"] == "tracked_warn"

    def test_warn_to_strict_blocked_by_historical_dip(
        self, client, test_db, auth_headers, portfolio
    ):
        self._activate(client, auth_headers, portfolio)
        # Create a dip: withdraw more than available in warn mode
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/movements",
            json={
                "type": "withdrawal", "currency": "USD",
                "amount": "1500", "occurred_on": "2026-05-01",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        resp = self._set_mode(client, auth_headers, portfolio, "tracked_strict")
        assert resp.status_code == 409
        assert resp.json()["detail"]["code"] == "insufficient_cash"

    def test_disable_keeps_ledger_and_reenable_works_when_unchanged(
        self, client, test_db, auth_headers, portfolio
    ):
        self._activate(client, auth_headers, portfolio)
        resp = self._set_mode(client, auth_headers, portfolio, "untracked")
        assert resp.status_code == 200
        assert test_db.query(CashMovement).count() == 1  # ledger retained

        # Cash endpoints are gated again
        resp = client.get(f"/portfolios/{portfolio.id}/cash/balances", headers=auth_headers)
        assert resp.status_code == 409

        # Re-enable: no transactions changed meanwhile -> allowed
        resp = self._set_mode(client, auth_headers, portfolio, "tracked_warn")
        assert resp.status_code == 200

    def test_stale_ledger_blocks_reenable(
        self, client, test_db, auth_headers, portfolio, asset
    ):
        self._activate(client, auth_headers, portfolio)
        self._set_mode(client, auth_headers, portfolio, "untracked")

        # Mutate transactions while untracked (create+delete: net zero rows,
        # but the revision counter still detects it)
        resp = client.post(
            f"/portfolios/{portfolio.id}/transactions",
            json={
                "asset_id": asset.id, "tx_date": "2026-05-01", "type": "BUY",
                "quantity": "1", "price": "10", "fees": "0", "currency": "USD",
            },
            headers=auth_headers,
        )
        tx_id = resp.json()["id"]
        client.delete(
            f"/portfolios/{portfolio.id}/transactions/{tx_id}", headers=auth_headers
        )

        resp = self._set_mode(client, auth_headers, portfolio, "tracked_warn")
        assert resp.status_code == 409
        assert resp.json()["detail"]["code"] == "cash_ledger_stale"


class TestWipe:
    def test_wipe_requires_untracked_and_confirmation(
        self, client, test_db, auth_headers, portfolio
    ):
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/activation",
            json=_request(
                openings=[{"currency": "USD", "amount": "1000"}],
                activation_id=str(uuid.uuid4()),
            ),
            headers=auth_headers,
        )
        assert resp.status_code == 201

        # Tracked -> wipe refused
        resp = client.request(
            "DELETE",
            f"/portfolios/{portfolio.id}/cash/ledger",
            json={"confirm": "DELETE"},
            headers=auth_headers,
        )
        assert resp.status_code == 409

        client.put(
            f"/portfolios/{portfolio.id}/cash/mode",
            json={"mode": "untracked"},
            headers=auth_headers,
        )
        # Wrong confirmation string -> 422
        resp = client.request(
            "DELETE",
            f"/portfolios/{portfolio.id}/cash/ledger",
            json={"confirm": "yes"},
            headers=auth_headers,
        )
        assert resp.status_code == 422

        resp = client.request(
            "DELETE",
            f"/portfolios/{portfolio.id}/cash/ledger",
            json={"confirm": "DELETE"},
            headers=auth_headers,
        )
        assert resp.status_code == 204
        assert test_db.query(CashMovement).count() == 0
        test_db.expire_all()
        p = test_db.get(Portfolio, portfolio.id)
        assert p.cash_activation_id is None
        assert p.cash_tracking_started_on is None
        assert p.cash_ledger_synced_seq is None

        # After a wipe, a fresh activation is possible again
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/activation",
            json=_request(activation_id=str(uuid.uuid4())),
            headers=auth_headers,
        )
        assert resp.status_code == 201


class TestInferredFunding:
    """Minimum-funding reconstruction scenarios (replay strategy)"""

    def _buy(self, portfolio, asset, day, qty, price, fees="0"):
        from app.models import TransactionType

        TransactionFactory(
            portfolio_id=portfolio.id, asset_id=asset.id, tx_date=day,
            type=TransactionType.BUY, quantity=D(qty), price=D(price),
            fees=D(fees), currency="USD",
        )

    def _sell(self, portfolio, asset, day, qty, price, fees="0"):
        from app.models import TransactionType

        TransactionFactory(
            portfolio_id=portfolio.id, asset_id=asset.id, tx_date=day,
            type=TransactionType.SELL, quantity=D(qty), price=D(price),
            fees=D(fees), currency="USD",
        )

    def _preview(self, client, auth_headers, portfolio, **kwargs):
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/activation/preview",
            json=_request(**kwargs),
            headers=auth_headers,
        )
        assert resp.status_code == 200, resp.text
        return resp.json()

    def test_first_purchase_with_no_cash(self, client, auth_headers, portfolio, asset):
        """Buy 50 with no cash: one inferred deposit of exactly 50, ending cash 0"""
        self._buy(portfolio, asset, date(2026, 2, 1), "5", "10")
        body = self._preview(client, auth_headers, portfolio)
        assert body["proposed_inferred_deposits"] == [
            {"currency": "USD", "date": "2026-02-01", "amount": "50.00000000"}
        ]
        [projected] = body["projected_balances"]
        assert projected["currency"] == "USD"
        assert D(projected["balance"]) == D("0")

    def test_purchase_fees_are_funded_too(self, client, auth_headers, portfolio, asset):
        """Buy 50 with a 1 fee needs 51 of available cash"""
        self._buy(portfolio, asset, date(2026, 2, 1), "5", "10", fees="1")
        body = self._preview(client, auth_headers, portfolio)
        assert body["proposed_inferred_deposits"] == [
            {"currency": "USD", "date": "2026-02-01", "amount": "51.00000000"}
        ]
        [projected] = body["projected_balances"]
        assert projected["currency"] == "USD"
        assert D(projected["balance"]) == D("0")

    def test_sale_proceeds_remain_available_for_later_purchases(
        self, client, auth_headers, portfolio, asset
    ):
        """Buy 50, sell 30, buy 80: the second deposit is 50, not 80,
        because the 30 of sale proceeds stays available"""
        self._buy(portfolio, asset, date(2026, 2, 1), "5", "10")
        self._sell(portfolio, asset, date(2026, 3, 1), "3", "10")
        self._buy(portfolio, asset, date(2026, 4, 1), "8", "10")
        body = self._preview(client, auth_headers, portfolio)
        assert body["proposed_inferred_deposits"] == [
            {"currency": "USD", "date": "2026-02-01", "amount": "50.00000000"},
            {"currency": "USD", "date": "2026-04-01", "amount": "50.00000000"},
        ]
        [projected] = body["projected_balances"]
        assert projected["currency"] == "USD"
        assert D(projected["balance"]) == D("0")

    def test_partial_user_opening_reduces_the_inferred_amount(
        self, client, auth_headers, portfolio, asset
    ):
        """Opening 20 + buy 50: only the missing 30 is inferred"""
        self._buy(portfolio, asset, date(2026, 2, 1), "5", "10")
        body = self._preview(
            client, auth_headers, portfolio,
            openings=[{"currency": "USD", "amount": "20"}],
        )
        assert body["proposed_inferred_deposits"] == [
            {"currency": "USD", "date": "2026-02-01", "amount": "30.00000000"}
        ]

    def test_same_day_transactions_net_deterministically(
        self, client, auth_headers, portfolio, asset
    ):
        """Same-day movements form one accounting boundary (a same-day sell
        funds a same-day buy) and the preview is deterministic"""
        self._buy(portfolio, asset, date(2026, 2, 1), "5", "10")
        self._sell(portfolio, asset, date(2026, 2, 1), "3", "10")
        first = self._preview(client, auth_headers, portfolio)
        assert first["proposed_inferred_deposits"] == [
            {"currency": "USD", "date": "2026-02-01", "amount": "20.00000000"}
        ]
        # Recalculation is idempotent: same input, same proposal
        assert self._preview(client, auth_headers, portfolio) == first

    def test_apply_persists_inferred_deposits_with_provenance(
        self, client, test_db, auth_headers, portfolio, asset
    ):
        from app.models import CashMovementType

        self._buy(portfolio, asset, date(2026, 2, 1), "5", "10", fees="1")
        activation_id = str(uuid.uuid4())
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/activation",
            json=_request(activation_id=activation_id),
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["inferred_deposit_count"] == 1
        assert body["inferred_deposit_totals"] == [
            {"currency": "USD", "amount": "51.00000000", "count": 1}
        ]

        deposit = (
            test_db.query(CashMovement)
            .filter(CashMovement.type == CashMovementType.DEPOSIT)
            .one()
        )
        assert deposit.amount == D("51")
        assert deposit.occurred_on == date(2026, 2, 1)
        assert deposit.activation_id == activation_id
        assert deposit.meta_data.get("inferred") is True
        # Ending cash: deposit 51 - buy 50 - fee 1 = 0
        total = (
            test_db.query(CashMovement)
            .filter(CashMovement.portfolio_id == portfolio.id)
            .all()
        )
        assert sum((D(str(m.amount)) for m in total), D(0)) == D("0")

        # The movement is exposed with an "inferred" marker for labeling
        listed = client.get(
            f"/portfolios/{portfolio.id}/cash/movements?type=deposit",
            headers=auth_headers,
        ).json()["items"]
        assert listed[0]["metadata"]["inferred"] is True

    def test_editing_an_inferred_deposit_marks_it_user_confirmed(
        self, client, test_db, auth_headers, portfolio, asset
    ):
        from app.models import CashMovementType

        self._buy(portfolio, asset, date(2026, 2, 1), "5", "10")
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/activation",
            json=_request(activation_id=str(uuid.uuid4())),
            headers=auth_headers,
        )
        assert resp.status_code == 201
        deposit = (
            test_db.query(CashMovement)
            .filter(CashMovement.type == CashMovementType.DEPOSIT)
            .one()
        )
        resp = client.put(
            f"/portfolios/{portfolio.id}/cash/movements/{deposit.id}",
            json={"amount": "60"},
            headers=auth_headers,
        )
        assert resp.status_code == 200, resp.text
        meta = resp.json()["movement"]["metadata"]
        assert meta["inferred"] is False
        assert meta["user_confirmed"] is True


class TestDeepestPointMigration:
    """Migration of ledgers built by the old deepest-point model"""

    OLD_ACTIVATION = "11111111-1111-1111-1111-111111111111"

    def _seed_old_replay_portfolio(self, test_db, test_user):
        """A ledger as the old model wrote it: one big opening balance at
        the start plus derived and manual movements, deepest deficit 120"""
        from app.models import CashMovementType
        from tests.factories import CashMovementFactory

        p = PortfolioFactory(
            user_id=test_user.id, base_currency="USD", cash_mode=CashMode.TRACKED_WARN
        )
        p.cash_activation_id = self.OLD_ACTIVATION
        p.cash_tracking_started_on = date(2026, 1, 1)
        p.cash_activation_meta = {
            "strategy": "replay",
            "opening_balances": [{"currency": "USD", "amount": "120"}],
            "derived_movement_count": 5,
        }
        test_db.commit()

        def movement(mv_type, amount, day, **kwargs):
            CashMovementFactory(
                portfolio_id=p.id, currency="USD", type=mv_type,
                amount=D(amount), occurred_on=day, **kwargs,
            )

        movement(
            CashMovementType.OPENING_BALANCE, "120", date(2026, 1, 1),
            activation_id=self.OLD_ACTIVATION,
            reason="Opening balance (replay activation)",
        )
        movement(CashMovementType.BUY, "-50", date(2026, 2, 1))
        # Genuine user-entered movements must survive and participate
        movement(CashMovementType.DEPOSIT, "20", date(2026, 2, 15))
        movement(CashMovementType.BUY, "-80", date(2026, 3, 1))
        movement(CashMovementType.WITHDRAWAL, "-10", date(2026, 4, 1))
        return p

    def test_stale_opening_replaced_by_progressive_deposits(self, test_db, test_user):
        from app.models import CashMovementType
        from app.services.cash import activation

        p = self._seed_old_replay_portfolio(test_db, test_user)
        migrated = activation.migrate_replay_openings_to_inferred(test_db)
        test_db.commit()
        assert migrated == [p.id]

        movements = (
            test_db.query(CashMovement)
            .filter(CashMovement.portfolio_id == p.id)
            .order_by(CashMovement.occurred_on, CashMovement.id)
            .all()
        )
        # The stale deepest-point opening no longer affects anything
        assert not any(m.type == CashMovementType.OPENING_BALANCE for m in movements)

        inferred = [
            (m.occurred_on, D(str(m.amount)))
            for m in movements
            if (m.meta_data or {}).get("inferred")
        ]
        # 50 for the first buy; 20 user deposit leaves 60 missing for the
        # second buy; 10 covers the user's withdrawal. Total 120 — exactly
        # the removed opening, so final balances are preserved.
        assert inferred == [
            (date(2026, 2, 1), D("50")),
            (date(2026, 3, 1), D("60")),
            (date(2026, 4, 1), D("10")),
        ]
        for m in movements:
            if (m.meta_data or {}).get("inferred"):
                assert m.type == CashMovementType.DEPOSIT
                assert m.activation_id == self.OLD_ACTIVATION
        assert sum((D(str(m.amount)) for m in movements), D(0)) == D("0")

        # Genuine manual movements are untouched
        assert any(
            m.type == CashMovementType.DEPOSIT
            and D(str(m.amount)) == D("20")
            and not (m.meta_data or {}).get("inferred")
            for m in movements
        )
        assert any(m.type == CashMovementType.WITHDRAWAL for m in movements)

        test_db.expire_all()
        meta = test_db.get(Portfolio, p.id).cash_activation_meta
        assert meta["opening_balances"] == []
        assert meta["inferred_deposits"]["count"] == 3
        assert meta["inferred_deposits"]["totals"] == [
            {"currency": "USD", "amount": "120.00000000", "count": 3}
        ]
        assert meta["migrated_from_deepest_point"] is True

    def test_migration_is_idempotent(self, test_db, test_user):
        from app.services.cash import activation

        p = self._seed_old_replay_portfolio(test_db, test_user)
        assert activation.migrate_replay_openings_to_inferred(test_db) == [p.id]
        test_db.commit()
        before = test_db.query(CashMovement).count()
        # Second run: the openings are gone, nothing is duplicated
        assert activation.migrate_replay_openings_to_inferred(test_db) == []
        test_db.commit()
        assert test_db.query(CashMovement).count() == before

    def test_genuine_user_openings_are_never_touched(self, test_db, test_user):
        from app.models import CashMovementType
        from app.services.cash import activation
        from tests.factories import CashMovementFactory

        p = PortfolioFactory(
            user_id=test_user.id, base_currency="USD", cash_mode=CashMode.TRACKED_WARN
        )
        p.cash_activation_id = str(uuid.uuid4())
        p.cash_tracking_started_on = date(2026, 1, 1)
        p.cash_activation_meta = {
            "strategy": "opening_balances",
            "opening_balances": [{"currency": "USD", "amount": "500"}],
        }
        test_db.commit()
        CashMovementFactory(
            portfolio_id=p.id, currency="USD",
            type=CashMovementType.OPENING_BALANCE, amount=D("500"),
            occurred_on=date(2026, 1, 1), activation_id=p.cash_activation_id,
        )

        assert activation.migrate_replay_openings_to_inferred(test_db) == []
        test_db.commit()
        opening = (
            test_db.query(CashMovement)
            .filter(
                CashMovement.portfolio_id == p.id,
                CashMovement.type == CashMovementType.OPENING_BALANCE,
            )
            .one()
        )
        assert D(str(opening.amount)) == D("500")
        test_db.expire_all()
        meta = test_db.get(Portfolio, p.id).cash_activation_meta
        assert meta["opening_balances"] == [{"currency": "USD", "amount": "500"}]
        assert "migrated_from_deepest_point" not in meta
