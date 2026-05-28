"""Tests for the Today Brief endpoint."""
from datetime import datetime, timedelta, date
from decimal import Decimal
from unittest.mock import AsyncMock, patch

from app.models import Asset, PendingDividend, PendingDividendStatus, TransactionType
from app.models.calendar import EarningsCache
from app.models.enums import AssetClass
from app.schemas import PortfolioMetrics, Position


def _make_asset(test_db, symbol: str, name: str) -> Asset:
    asset = Asset(
        symbol=symbol,
        name=name,
        currency="USD",
        class_=AssetClass.STOCK,
    )
    test_db.add(asset)
    test_db.commit()
    test_db.refresh(asset)
    return asset


def _make_position(asset_id: int, symbol: str, name: str, daily_change_pct: str, last_updated: datetime) -> Position:
    return Position(
        asset_id=asset_id,
        symbol=symbol,
        name=name,
        quantity=Decimal("10"),
        avg_cost=Decimal("100"),
        current_price=Decimal("110"),
        market_value=Decimal("1100"),
        cost_basis=Decimal("1000"),
        unrealized_pnl=Decimal("100"),
        unrealized_pnl_pct=Decimal("10"),
        daily_change_pct=Decimal(daily_change_pct),
        currency="USD",
        last_updated=last_updated,
        asset_type="EQUITY",
    )


def _make_metrics(portfolio_id: int, daily_change_pct: str, daily_change_value: str) -> PortfolioMetrics:
    return PortfolioMetrics(
        portfolio_id=portfolio_id,
        portfolio_name="Test Portfolio",
        total_value=Decimal("10000"),
        total_cost=Decimal("8000"),
        total_unrealized_pnl=Decimal("2000"),
        total_unrealized_pnl_pct=Decimal("25"),
        total_realized_pnl=Decimal("0"),
        total_dividends=Decimal("0"),
        total_fees=Decimal("0"),
        positions_count=2,
        daily_change_value=Decimal(daily_change_value),
        daily_change_pct=Decimal(daily_change_pct),
        last_updated=datetime.utcnow(),
    )


def test_today_brief_composes_multiple_signals(client, auth_headers, sample_portfolio, test_db):
    asset_one = _make_asset(test_db, "NVDA", "NVIDIA Corporation")
    asset_two = _make_asset(test_db, "QBTS", "D-Wave Quantum")

    test_db.add(
        EarningsCache(
            symbol="NVDA",
            earnings_date=date.today() + timedelta(days=1),
            fetched_at=datetime.utcnow(),
        )
    )
    test_db.add(
        PendingDividend(
            portfolio_id=sample_portfolio.id,
            asset_id=asset_one.id,
            user_id=sample_portfolio.user_id,
            ex_dividend_date=date.today() + timedelta(days=3),
            dividend_per_share=Decimal("0.50"),
            shares_held=Decimal("10"),
            gross_amount=Decimal("5.00"),
            currency="USD",
            status=PendingDividendStatus.PENDING,
            fetched_at=datetime.utcnow(),
        )
    )
    test_db.commit()

    positions = [
        _make_position(asset_one.id, "NVDA", "NVIDIA Corporation", "6.25", datetime.utcnow() - timedelta(minutes=20)),
        _make_position(asset_two.id, "QBTS", "D-Wave Quantum", "-7.10", datetime.utcnow() - timedelta(minutes=20)),
    ]

    metrics = _make_metrics(sample_portfolio.id, "1.80", "312.40")

    with patch("app.services.metrics.MetricsService.get_metrics", new=AsyncMock(return_value=metrics)), \
         patch("app.services.metrics.MetricsService.get_positions", new=AsyncMock(return_value=positions)):
        response = client.get(f"/portfolios/{sample_portfolio.id}/today-brief", headers=auth_headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["portfolio_id"] == sample_portfolio.id
    assert payload["cached"] is False
    assert len(payload["items"]) <= 7

    item_types = [item["type"] for item in payload["items"]]
    assert "portfolio_performance" in item_types
    assert "holding_best_mover" in item_types
    assert "holding_worst_mover" in item_types
    assert "earnings_soon" in item_types
    assert "delayed_data" in item_types
    assert "pending_dividends" in item_types

    first_item = payload["items"][0]
    assert first_item["type"] == "portfolio_performance"
    assert first_item["severity"] == "positive"


def test_today_brief_stays_calm_when_no_signals(client, auth_headers, sample_portfolio):
    metrics = _make_metrics(sample_portfolio.id, "0.00", "0.00")

    with patch("app.services.metrics.MetricsService.get_metrics", new=AsyncMock(return_value=metrics)), \
         patch("app.services.metrics.MetricsService.get_positions", new=AsyncMock(return_value=[])):
        response = client.get(f"/portfolios/{sample_portfolio.id}/today-brief", headers=auth_headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"] == []