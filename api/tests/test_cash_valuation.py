"""
Valuation integration tests: cash in portfolio metrics and history,
stale/missing FX behavior, historical FX series, fingerprint cash_state,
public sharing exclusion, pending dividends.
"""
from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest

from app.models import CashMode, CashMovementType
from app.services.market_data.currency import CurrencyService
from tests.factories import (
    AssetFactory,
    CashMovementFactory,
    PortfolioFactory,
    PriceFactory,
    TransactionFactory,
)

D = Decimal


@pytest.fixture
def portfolio(test_db, test_user):
    return PortfolioFactory(
        user_id=test_user.id, base_currency="USD", cash_mode=CashMode.TRACKED_WARN
    )


@pytest.fixture
def asset(test_db):
    return AssetFactory(symbol="VALTST", currency="USD")


def _position(portfolio, asset, price="110"):
    from app.models import TransactionType

    TransactionFactory(
        portfolio_id=portfolio.id, asset_id=asset.id, tx_date=date(2026, 5, 1),
        type=TransactionType.BUY, quantity=D("10"), price=D("100"), fees=D("0"),
        currency="USD",
    )
    PriceFactory(asset_id=asset.id, price=D(price))


class TestMetricsIntegration:
    def test_tracked_metrics_include_cash(self, client, test_db, auth_headers, portfolio, asset):
        _position(portfolio, asset)
        CashMovementFactory(
            portfolio_id=portfolio.id, currency="USD",
            type=CashMovementType.DEPOSIT, amount=D("500"), occurred_on=date(2026, 5, 1),
        )
        resp = client.get(f"/portfolios/{portfolio.id}/metrics", headers=auth_headers)
        assert resp.status_code == 200
        metrics = resp.json()
        # 10 * 110 assets + 500 cash
        assert D(str(metrics["total_value"])) == D("1600")
        cash = metrics["cash"]
        assert cash["base_currency"] == "USD"
        assert D(str(cash["total_base"])) == D("500")
        assert cash["fx_status"] == "ok"
        # Asset-only figures unchanged
        assert D(str(metrics["total_cost"])) == D("1000")
        assert D(str(metrics["total_unrealized_pnl"])) == D("100")

    def test_negative_cash_reduces_total_value(
        self, client, test_db, auth_headers, portfolio, asset
    ):
        _position(portfolio, asset)
        CashMovementFactory(
            portfolio_id=portfolio.id, currency="USD",
            type=CashMovementType.WITHDRAWAL, amount=D("-200"), occurred_on=date(2026, 5, 1),
        )
        resp = client.get(f"/portfolios/{portfolio.id}/metrics", headers=auth_headers)
        assert D(str(resp.json()["total_value"])) == D("900")

    def test_unavailable_fx_excluded_from_total_and_flagged(
        self, client, test_db, auth_headers, portfolio, asset, monkeypatch
    ):
        _position(portfolio, asset)
        CashMovementFactory(
            portfolio_id=portfolio.id, currency="JPY",
            type=CashMovementType.DEPOSIT, amount=D("100000"), occurred_on=date(2026, 5, 1),
        )

        def fake_rate(from_ccy, to_ccy):
            return D("1") if from_ccy == to_ccy else None

        monkeypatch.setattr(CurrencyService, "get_exchange_rate", staticmethod(fake_rate))
        resp = client.get(f"/portfolios/{portfolio.id}/metrics", headers=auth_headers)
        metrics = resp.json()
        # JPY never converted at rate 1; total stays asset-only
        assert D(str(metrics["total_value"])) == D("1100")
        cash = metrics["cash"]
        assert cash["fx_status"] == "unavailable"
        jpy = [b for b in cash["balances"] if b["currency"] == "JPY"][0]
        assert jpy["rate_unavailable"] is True
        assert jpy["balance_base"] is None
        assert D(str(jpy["balance"])) == D("100000")

    def test_future_dated_movements_not_in_current_valuation(
        self, client, test_db, auth_headers, portfolio, asset
    ):
        _position(portfolio, asset)
        CashMovementFactory(
            portfolio_id=portfolio.id, currency="USD",
            type=CashMovementType.DEPOSIT, amount=D("500"),
            occurred_on=date.today() + timedelta(days=30),
        )
        resp = client.get(f"/portfolios/{portfolio.id}/metrics", headers=auth_headers)
        assert D(str(resp.json()["total_value"])) == D("1100")


class TestHistoryIntegration:
    def test_history_includes_cash_and_keeps_gain_pct_asset_only(
        self, client, test_db, auth_headers, portfolio, asset
    ):
        from app.models import Price

        _position(portfolio, asset)
        # Backdated price history so several points exist
        for day_offset in range(0, 5):
            asof = datetime(2026, 5, 1) + timedelta(days=day_offset)
            test_db.add(Price(
                asset_id=asset.id, price=D("110"), asof=asof, source="yfinance_history",
            ))
        test_db.commit()
        CashMovementFactory(
            portfolio_id=portfolio.id, currency="USD",
            type=CashMovementType.DEPOSIT, amount=D("500"), occurred_on=date(2026, 5, 3),
        )

        resp = client.get(
            f"/portfolios/{portfolio.id}/history?period=ALL", headers=auth_headers
        )
        assert resp.status_code == 200
        points = {p["date"]: p for p in resp.json()}
        # Before the deposit: no cash in value
        assert points["2026-05-01"]["cash_value"] == 0.0
        assert points["2026-05-01"]["value"] == pytest.approx(1100.0)
        # From the deposit date: cash included in value, not in gain_pct
        assert points["2026-05-03"]["cash_value"] == pytest.approx(500.0)
        assert points["2026-05-03"]["value"] == pytest.approx(1600.0)
        assert points["2026-05-03"]["gain_pct"] == points["2026-05-01"]["gain_pct"]

    def test_untracked_history_has_no_cash_values(
        self, client, test_db, test_user, auth_headers, asset
    ):
        untracked = PortfolioFactory(user_id=test_user.id, base_currency="USD")
        _position(untracked, asset)
        resp = client.get(
            f"/portfolios/{untracked.id}/history?period=ALL", headers=auth_headers
        )
        for point in resp.json():
            assert point["cash_value"] is None


class TestHistoricalFxSeries:
    def test_series_uses_historical_rates_per_day(self, test_db, test_user, monkeypatch):
        from app.services.cash import valuation

        portfolio = PortfolioFactory(
            user_id=test_user.id, base_currency="USD", cash_mode=CashMode.TRACKED_WARN
        )
        CashMovementFactory(
            portfolio_id=portfolio.id, currency="EUR",
            type=CashMovementType.DEPOSIT, amount=D("1000"), occurred_on=date(2026, 5, 1),
        )
        rates = {date(2026, 5, 1): D("1.10"), date(2026, 5, 2): D("1.20")}

        def fake_hist(from_ccy, to_ccy, when):
            return rates.get(when.date())

        monkeypatch.setattr(
            CurrencyService, "get_historical_exchange_rate", staticmethod(fake_hist)
        )
        series = valuation.get_cash_balance_series(
            test_db, portfolio, date(2026, 5, 1), date(2026, 5, 3)
        )
        assert series[date(2026, 5, 1)] == D("1100")
        assert series[date(2026, 5, 2)] == D("1200")
        # May 3 has no rate: carries the last convertible value, never 1:1
        assert series[date(2026, 5, 3)] == D("1200")


class TestFingerprint:
    def test_cash_state_changes_fingerprint(self):
        from app.services.platform.analytics_cache import _calculate_fingerprint

        base = _calculate_fingerprint(1, [], None)
        same = _calculate_fingerprint(1, [], None, cash_state=None)
        tracked = _calculate_fingerprint(1, [], None, cash_state="tracked_warn:5")
        tracked2 = _calculate_fingerprint(1, [], None, cash_state="tracked_warn:6")
        assert base == same
        assert tracked != base
        assert tracked != tracked2


class TestPublicSharing:
    def test_public_payload_never_exposes_cash(
        self, client, test_db, test_user, auth_headers, asset
    ):
        portfolio = PortfolioFactory(
            user_id=test_user.id, base_currency="USD",
            cash_mode=CashMode.TRACKED_WARN, is_public=True,
        )
        _position(portfolio, asset)
        CashMovementFactory(
            portfolio_id=portfolio.id, currency="USD",
            type=CashMovementType.DEPOSIT, amount=D("5000"), occurred_on=date(2026, 5, 1),
        )
        resp = client.get(f"/public/portfolio/{portfolio.share_token}")
        assert resp.status_code == 200
        body = resp.json()
        text = str(body).lower()
        assert "cash" not in text
        assert "5000" not in text


class TestPendingDividends:
    def test_pending_dividend_does_not_credit_cash(self, client, test_db, test_user, auth_headers, asset):
        from app.models import PendingDividend, PendingDividendStatus, CashMovement

        portfolio = PortfolioFactory(
            user_id=test_user.id, base_currency="USD", cash_mode=CashMode.TRACKED_WARN
        )
        _position(portfolio, asset)
        pending = PendingDividend(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            user_id=test_user.id,
            ex_dividend_date=date(2026, 5, 10),
            dividend_per_share=D("2"),
            shares_held=D("10"),
            gross_amount=D("20"),
            currency="USD",
            status=PendingDividendStatus.PENDING,
        )
        test_db.add(pending)
        test_db.commit()

        # A pending (unaccepted) dividend must never touch the ledger
        assert (
            test_db.query(CashMovement)
            .filter(CashMovement.type == CashMovementType.DIVIDEND)
            .count()
            == 0
        )
        resp = client.get(f"/portfolios/{portfolio.id}/cash/balances", headers=auth_headers)
        by_ccy = {b["currency"]: b for b in resp.json()["balances"]}
        assert "USD" not in by_ccy or D(str(by_ccy["USD"]["balance"])) == D("0")
