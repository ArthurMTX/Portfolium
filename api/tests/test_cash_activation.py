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
    def test_replay_proposes_dip_covering_openings(
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
        # buy -1000 -2 => min -1002; sell +480 -1 fee; dividend +12 -1 tax
        assert body["proposed_opening_balances"] == [
            {"currency": "USD", "amount": "1002.00000000"}
        ]
        # With the proposal applied there are no dips left
        assert body["negative_dips"] == []
        # -1002 + 1002 + 479 + 11
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
        # (excluded by the explicit START window) is now included
        assert body["start_date"] == "2025-06-01"
        assert body["derived_movement_count"] == 8
        assert body["proposed_opening_balances"] == [
            {"currency": "USD", "amount": "1253.00000000"}
        ]

        apply_payload = {
            **payload,
            "activation_id": str(uuid.uuid4()),
            "opening_balances": body["proposed_opening_balances"],
        }
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/activation",
            json=apply_payload,
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["cash_tracking_started_on"] == "2025-06-01"

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
        assert body["proposed_opening_balances"] == []
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

    def test_strict_target_rejects_unresolved_dips(
        self, client, test_db, auth_headers, portfolio, asset
    ):
        _seed_history(portfolio, asset)
        resp = client.post(
            f"/portfolios/{portfolio.id}/cash/activation",
            json=_request(
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

    def test_never_one_deposit_per_purchase(
        self, client, test_db, auth_headers, portfolio, asset
    ):
        """Replay proposes ONE opening balance, not a deposit per buy"""
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
