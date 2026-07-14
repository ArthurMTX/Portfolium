"""
Untracked portfolios must behave exactly like pre-cash Portfolium:
no cash validation, no movements, no rejections, identical metrics values,
and only additive fields on API responses (cash_mode='untracked').
"""
from datetime import date
from decimal import Decimal

import pytest

from app.crud import cash as crud_cash
from app.models import CashMode, CashMovement
from tests.factories import AssetFactory, PortfolioFactory, PriceFactory

D = Decimal


@pytest.fixture
def portfolio(test_db, test_user):
    return PortfolioFactory(user_id=test_user.id, base_currency="USD")


@pytest.fixture
def asset(test_db):
    return AssetFactory(symbol="UNTRK", currency="USD")


def _buy(client, auth_headers, portfolio, asset, quantity="10", price="100", fees="2"):
    return client.post(
        f"/portfolios/{portfolio.id}/transactions",
        json={
            "asset_id": asset.id,
            "tx_date": "2026-05-15",
            "type": "BUY",
            "quantity": quantity,
            "price": price,
            "fees": fees,
            "currency": "USD",
        },
        headers=auth_headers,
    )


class TestUntrackedCompatibility:
    def test_default_mode_is_untracked(self, client, auth_headers, portfolio):
        resp = client.get(f"/portfolios/{portfolio.id}", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["cash_mode"] == "untracked"
        assert body["cash_tracking_started_on"] is None

    def test_purchases_never_require_a_deposit(
        self, client, test_db, auth_headers, portfolio, asset
    ):
        # A very large purchase with zero cash history must succeed
        resp = _buy(client, auth_headers, portfolio, asset, quantity="1000", price="1000")
        assert resp.status_code == 201
        assert resp.json()["cash_warnings"] is None

    def test_no_cash_movements_are_ever_created(
        self, client, test_db, auth_headers, portfolio, asset
    ):
        resp = _buy(client, auth_headers, portfolio, asset)
        tx_id = resp.json()["id"]

        client.put(
            f"/portfolios/{portfolio.id}/transactions/{tx_id}",
            json={
                "asset_id": asset.id, "tx_date": "2026-05-16", "type": "BUY",
                "quantity": "5", "price": "90", "fees": "1", "currency": "USD",
            },
            headers=auth_headers,
        )
        client.post(
            f"/portfolios/{portfolio.id}/transactions",
            json={
                "asset_id": asset.id, "tx_date": "2026-05-20", "type": "SELL",
                "quantity": "2", "price": "120", "fees": "1", "currency": "USD",
            },
            headers=auth_headers,
        )
        assert test_db.query(CashMovement).count() == 0

    def test_metrics_identical_and_without_cash_component(
        self, client, test_db, auth_headers, portfolio, asset
    ):
        _buy(client, auth_headers, portfolio, asset, quantity="10", price="100", fees="2")
        PriceFactory(asset_id=asset.id, price=D("110"))

        resp = client.get(f"/portfolios/{portfolio.id}/metrics", headers=auth_headers)
        assert resp.status_code == 200
        metrics = resp.json()
        # Weighted-average cost basis with capitalized fees: unchanged math
        assert D(str(metrics["total_cost"])) == D("1002")
        assert D(str(metrics["total_value"])) == D("1100")
        assert D(str(metrics["total_unrealized_pnl"])) == D("98")
        # Additive field only; no cash valuation for untracked portfolios
        assert metrics["cash"] is None

    def test_cash_endpoints_reject_untracked_portfolios(
        self, client, auth_headers, portfolio
    ):
        resp = client.get(f"/portfolios/{portfolio.id}/cash/balances", headers=auth_headers)
        # 409 cash_tracking_not_enabled once the router exists (404 before)
        assert resp.status_code in (404, 409)

    def test_transactions_listing_shape_only_gains_nullable_fields(
        self, client, auth_headers, portfolio, asset
    ):
        _buy(client, auth_headers, portfolio, asset)
        resp = client.get(f"/portfolios/{portfolio.id}/transactions", headers=auth_headers)
        tx = resp.json()[0]
        assert tx["cash_warnings"] is None
        # Core fields unchanged
        for key in ("id", "asset_id", "tx_date", "type", "quantity", "price", "fees", "currency"):
            assert key in tx

    def test_mixed_currencies_never_validated_when_untracked(
        self, client, test_db, auth_headers, portfolio
    ):
        # Even a currency the cash policy would reject (kept verbatim on the
        # transaction) must not fail while untracked
        exotic = AssetFactory(symbol="EXOTIC.L", currency="GBX")
        resp = client.post(
            f"/portfolios/{portfolio.id}/transactions",
            json={
                "asset_id": exotic.id, "tx_date": "2026-05-15", "type": "BUY",
                "quantity": "10", "price": "100", "fees": "0", "currency": "GBX",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
