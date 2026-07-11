"""Slow insights calculators must not stall the asyncio event loop.

These tests patch the synchronous calculators with a blocking sleep and
assert that a concurrent coroutine keeps ticking while the service call is
awaited: with the calculator on the loop the ticker would freeze for the
whole sleep, with asyncio.to_thread it keeps running.
"""
import asyncio
import time

import pytest

from app.services.portfolio_analytics.insights import InsightsService


CALCULATOR_SLEEP_SECONDS = 0.3
TICK_INTERVAL_SECONDS = 0.02
# A blocked loop yields ~1 tick; a free loop yields ~15. Use a margin.
MIN_EXPECTED_TICKS = 5


async def _ticks_during(coro) -> int:
    """Run `coro` and count how often the event loop scheduled a ticker."""
    ticks = 0
    running = True

    async def ticker():
        nonlocal ticks
        while running:
            ticks += 1
            await asyncio.sleep(TICK_INTERVAL_SECONDS)

    ticker_task = asyncio.create_task(ticker())
    try:
        await coro
    finally:
        running = False
        await ticker_task
    return ticks


@pytest.mark.asyncio
async def test_risk_metrics_calculation_does_not_block_event_loop(test_db, monkeypatch):
    service = InsightsService(test_db)

    def slow_calculation(portfolio_id, period):
        time.sleep(CALCULATOR_SLEEP_SECONDS)
        return service._empty_risk_metrics(period)

    monkeypatch.setattr(service, "_calculate_risk_metrics", slow_calculation)

    ticks = await _ticks_during(service.get_risk_metrics(1, "1y", positions=[]))

    assert ticks >= MIN_EXPECTED_TICKS, (
        f"event loop only ticked {ticks}x during a {CALCULATOR_SLEEP_SECONDS}s risk calculation; "
        "the calculator is blocking the loop"
    )


@pytest.mark.asyncio
async def test_benchmark_comparison_does_not_block_event_loop(test_db, monkeypatch):
    service = InsightsService(test_db)
    sentinel = object()

    def slow_calculation(portfolio_id, benchmark_symbol, period):
        time.sleep(CALCULATOR_SLEEP_SECONDS)
        return sentinel

    monkeypatch.setattr(service, "_calculate_benchmark_comparison", slow_calculation)

    ticks = await _ticks_during(service.compare_to_benchmark(1, "SPY", "1y", positions=[]))

    assert ticks >= MIN_EXPECTED_TICKS, (
        f"event loop only ticked {ticks}x during a {CALCULATOR_SLEEP_SECONDS}s benchmark calculation; "
        "the calculator is blocking the loop"
    )


@pytest.mark.asyncio
async def test_performance_metrics_do_not_block_event_loop(test_db, monkeypatch):
    service = InsightsService(test_db)

    async def fake_snapshot(portfolio_id, user_id=None):
        from decimal import Decimal
        from types import SimpleNamespace

        from app.services.portfolio_analytics.insights import PortfolioInsightsSnapshot

        return PortfolioInsightsSnapshot(
            portfolio_id=portfolio_id,
            user_id=user_id,
            portfolio=SimpleNamespace(id=portfolio_id, name="Test", base_currency="USD"),
            positions=[],
            total_value=Decimal(0),
            total_cost=Decimal(0),
            asset_map={},
            effective_metadata={},
        )

    def slow_performance(portfolio_id, period):
        time.sleep(CALCULATOR_SLEEP_SECONDS)
        return service._empty_performance_metrics(period)

    monkeypatch.setattr(service, "build_portfolio_insights_snapshot", fake_snapshot)
    monkeypatch.setattr(service, "get_performance_metrics", slow_performance)
    monkeypatch.setattr(
        service, "_calculate_risk_metrics", lambda portfolio_id, period: service._empty_risk_metrics(period)
    )

    ticks = await _ticks_during(service.get_performance_domain(1, "1y"))

    assert ticks >= MIN_EXPECTED_TICKS
