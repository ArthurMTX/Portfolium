"""Provider-latency bounds: shared research info cache and priced fetch budget."""
import asyncio
import time

import pytest

from app.services.asset_intelligence import asset_research as asset_research_module
from app.services.asset_intelligence.asset_research import AssetResearchService
from app.services.market_data import pricing as pricing_module
from app.services.market_data.fundamentals import FundamentalsService
from app.services.market_data.pricing import PricingService


def _make_fake_cache():
    store = {}

    class FakeCache:
        @staticmethod
        def get(key, default=None):
            return store.get(key, default)

        @staticmethod
        def set(key, value, ttl=None, nx=False):
            if nx and key in store:
                return False
            store[key] = value
            return True

        @staticmethod
        def delete(key):
            store.pop(key, None)
            return True

        @staticmethod
        def exists(key):
            return key in store

    FakeCache.store = store
    return FakeCache


@pytest.fixture
def fake_research_cache(monkeypatch):
    fake = _make_fake_cache()
    monkeypatch.setattr(asset_research_module, "CacheService", fake)
    return fake


def test_company_info_fetched_once_across_research_tabs(test_db, fake_research_cache, monkeypatch):
    calls = []

    def fake_fetch(symbol, action="fundamentals_info"):
        calls.append(symbol)
        return {"marketCap": 1000, "longBusinessSummary": "Test Co"}

    monkeypatch.setattr(FundamentalsService, "fetch_info", staticmethod(fake_fetch))
    service = AssetResearchService(test_db)

    first = service._get_company_info("AAPL")
    second = service._get_company_info("AAPL")
    third = service._get_company_info("AAPL")

    assert first == second == third
    assert calls == ["AAPL"], "the shared provider info payload must be fetched once, then cached"
    assert not fake_research_cache.exists("lock:asset_research_info:AAPL"), "single-flight lock must be released"


def test_company_info_empty_result_negative_cached_but_error_not(test_db, fake_research_cache, monkeypatch):
    calls = []

    def flaky_fetch(symbol, action="fundamentals_info"):
        calls.append(symbol)
        if len(calls) == 1:
            raise RuntimeError("provider unreachable")
        return {}

    monkeypatch.setattr(FundamentalsService, "fetch_info", staticmethod(flaky_fetch))
    service = AssetResearchService(test_db)

    assert service._get_company_info("ZZZQ") == {}  # error -> not cached
    assert service._get_company_info("ZZZQ") == {}  # retried -> empty, negative-cached
    assert service._get_company_info("ZZZQ") == {}  # served from negative cache
    assert calls == ["ZZZQ", "ZZZQ"], "errors must be retried; empty results must be negative-cached"


@pytest.mark.asyncio
async def test_price_fallbacks_skipped_when_interactive_budget_exhausted(test_db, monkeypatch):
    # Batch consumes the entire (shrunk) budget and misses every symbol;
    # the individual fallback loop must then be skipped, not add 10s each.
    monkeypatch.setattr(pricing_module, "_INTERACTIVE_PROVIDER_BUDGET_SECONDS", 0.2)

    fallback_calls = []

    def slow_empty_batch(self, symbols):
        time.sleep(0.25)
        return {}

    def fallback(self, symbol):
        fallback_calls.append(symbol)
        return None

    monkeypatch.setattr(PricingService, "_batch_fetch_from_yfinance", slow_empty_batch)
    monkeypatch.setattr(PricingService, "_fetch_from_yfinance", fallback)

    service = PricingService(test_db)
    started = time.monotonic()
    results = await service.get_multiple_prices(["ZZZA", "ZZZB", "ZZZC"])
    elapsed = time.monotonic() - started

    assert fallback_calls == [], "individual fallbacks must not run once the budget is exhausted"
    assert elapsed < 2.0, f"request-path provider wait must stay near the budget, took {elapsed:.2f}s"
    assert results == {}
