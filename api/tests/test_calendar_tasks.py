"""Tests for calendar background tasks."""
from contextlib import contextmanager
from datetime import date
from decimal import Decimal

import pandas as pd

from app.models import Asset, EarningsCache, Transaction, TransactionType
from app.tasks import calendar_tasks
from app.tasks import decorators as task_decorators


class FakeEarningsProvider:
    def __init__(self, calendar=None, earnings_dates=None):
        self.calendar = calendar
        self.earnings_dates = earnings_dates

    def get_calendar(self, *args, **kwargs):
        return self.calendar

    def get_earnings_dates(self, *args, **kwargs):
        return self.earnings_dates


def test_fetch_earnings_events_merges_calendar_with_reported_rows(monkeypatch):
    earnings_dates = pd.DataFrame(
        [
            {
                "EPS Estimate": 3.10,
                "Reported EPS": 3.20,
                "Surprise(%)": 3.23,
            },
            {
                "EPS Estimate": 3.35,
                "Reported EPS": pd.NA,
                "Surprise(%)": pd.NA,
            },
        ],
        index=pd.to_datetime(["2026-04-23", "2026-07-21"]),
    )
    provider = FakeEarningsProvider(
        calendar={
            "Earnings Date": [pd.Timestamp("2026-07-21")],
            "Earnings Average": [3.35],
            "Revenue Average": [65000000000],
        },
        earnings_dates=earnings_dates,
    )

    monkeypatch.setattr(calendar_tasks, "get_market_data_provider", lambda: provider)

    events = calendar_tasks.fetch_earnings_events_for_symbol("MSFT")

    assert [event["earnings_date"] for event in events] == [
        date(2026, 4, 23),
        date(2026, 7, 21),
    ]
    assert events[0]["eps_actual"] == 3.2
    assert events[0]["surprise_pct"] == 3.23
    assert events[1]["eps_estimate"] == 3.35
    assert events[1]["revenue_estimate"] == 65000000000


def test_refresh_earnings_cache_handles_active_stock_rows(
    monkeypatch,
    test_db,
    sample_portfolio,
):
    asset = Asset(
        symbol="MSFT",
        name="Microsoft Corporation",
        currency="USD",
        asset_type="EQUITY",
    )
    test_db.add(asset)
    test_db.commit()
    test_db.refresh(asset)

    test_db.add(
        Transaction(
            portfolio_id=sample_portfolio.id,
            asset_id=asset.id,
            tx_date=date.today(),
            type=TransactionType.BUY,
            quantity=Decimal("1"),
            price=Decimal("100"),
            fees=Decimal("0"),
            currency="USD",
        )
    )
    test_db.commit()

    @contextmanager
    def test_db_context():
        yield test_db

    monkeypatch.setattr(calendar_tasks, "get_db_context", test_db_context)
    monkeypatch.setattr(task_decorators.CacheService, "set", lambda *args, **kwargs: True)
    monkeypatch.setattr(task_decorators.CacheService, "delete", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        calendar_tasks,
        "fetch_earnings_events_for_symbol",
        lambda symbol: [
            {
                "earnings_date": date(2026, 7, 21),
                "eps_estimate": Decimal("3.10"),
                "eps_actual": Decimal("3.20"),
                "revenue_estimate": Decimal("65000000000"),
                "revenue_actual": Decimal("66000000000"),
                "surprise_pct": Decimal("3.23"),
                "raw_data": {"symbol": symbol},
            }
        ],
    )

    result = calendar_tasks.refresh_earnings_cache.apply().get()

    assert result["status"] == "success"
    assert result["symbols_processed"] == 1
    assert result["cached"] == 1

    cached = test_db.query(EarningsCache).filter(EarningsCache.symbol == "MSFT").one()
    assert cached.earnings_date == date(2026, 7, 21)
    assert cached.eps_actual == Decimal("3.20")
    assert cached.revenue_actual == Decimal("66000000000")
    assert cached.surprise_pct == Decimal("3.23")
    assert cached.raw_data == {"symbol": "MSFT"}
