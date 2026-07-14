"""Golden equivalence between legacy per-period and canonical history output."""
from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest

from app.models import CashMode, CashMovementType, Price, TransactionType
from app.routers.batch import _derive_performance_history_periods
from app.services.portfolio_analytics.metrics import MetricsService
from tests.factories import (
    AssetFactory,
    CashMovementFactory,
    PortfolioFactory,
    TransactionFactory,
)


D = Decimal
PERIODS = ("1W", "1M", "3M", "YTD", "1Y")


def _dump(points):
    return [point.model_dump() for point in points]


def _period_return(points):
    if not points or points[0].value <= 0:
        return None
    first, last = points[0], points[-1]
    capital_change = (last.invested or last.value) - (first.invested or first.value)
    return ((last.value - first.value - capital_change) / first.value) * 100


@pytest.mark.integration
def test_canonical_slices_match_legacy_period_calculations_with_full_ledger(
    test_db, test_user
):
    """Compare every field using transactions, split, flows, and tracked cash."""
    today = date.today()
    portfolio = PortfolioFactory(
        user_id=test_user.id,
        base_currency="USD",
        cash_mode=CashMode.TRACKED_WARN,
    )
    asset = AssetFactory(symbol="HISTGOLD", currency="USD")

    # A baseline position well before every selected period.
    TransactionFactory(
        portfolio_id=portfolio.id,
        asset_id=asset.id,
        tx_date=today - timedelta(days=500),
        type=TransactionType.BUY,
        quantity=D("10"),
        price=D("100"),
        fees=D("2"),
        currency="USD",
    )
    # The split predates YTD/short periods but must still affect their holdings.
    TransactionFactory(
        portfolio_id=portfolio.id,
        asset_id=asset.id,
        tx_date=today - timedelta(days=200),
        type=TransactionType.SPLIT,
        quantity=D("0"),
        price=D("0"),
        fees=D("0"),
        currency="USD",
        meta_data={"split": "2:1"},
    )
    # Capital changes inside 3M and 1M exercise period baselines and returns.
    TransactionFactory(
        portfolio_id=portfolio.id,
        asset_id=asset.id,
        tx_date=today - timedelta(days=45),
        type=TransactionType.BUY,
        quantity=D("2"),
        price=D("135"),
        fees=D("1"),
        currency="USD",
    )
    TransactionFactory(
        portfolio_id=portfolio.id,
        asset_id=asset.id,
        tx_date=today - timedelta(days=10),
        type=TransactionType.SELL,
        quantity=D("1"),
        price=D("148"),
        fees=D("1"),
        currency="USD",
    )

    CashMovementFactory(
        portfolio_id=portfolio.id,
        currency="USD",
        type=CashMovementType.DEPOSIT,
        amount=D("500"),
        occurred_on=today - timedelta(days=300),
    )
    CashMovementFactory(
        portfolio_id=portfolio.id,
        currency="USD",
        type=CashMovementType.WITHDRAWAL,
        amount=D("-125"),
        occurred_on=today - timedelta(days=20),
    )

    # Daily closes make every period boundary deterministic, including weekends.
    test_db.add_all([
        Price(
            asset_id=asset.id,
            price=D("100") + D(day_offset) / D("10"),
            asof=datetime.combine(
                today - timedelta(days=500 - day_offset), datetime.min.time()
            ),
            source="yfinance_history",
        )
        for day_offset in range(501)
    ])
    test_db.commit()

    service = MetricsService(test_db)
    legacy = {
        period: service.get_portfolio_history(portfolio.id, period)
        for period in PERIODS
    }
    canonical = service.get_portfolio_history(portfolio.id, "ALL")
    derived = _derive_performance_history_periods(canonical, today=today)

    for period in PERIODS:
        assert _dump(derived[period]) == _dump(legacy[period]), period
        assert [point.date for point in derived[period]] == [
            point.date for point in legacy[period]
        ]
        assert [point.value for point in derived[period]] == [
            point.value for point in legacy[period]
        ]
        assert [point.invested for point in derived[period]] == [
            point.invested for point in legacy[period]
        ]
        assert [point.gain_pct for point in derived[period]] == [
            point.gain_pct for point in legacy[period]
        ]
        assert _period_return(derived[period]) == pytest.approx(
            _period_return(legacy[period])
        )
