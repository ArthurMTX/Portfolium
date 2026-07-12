"""Stale-while-revalidate behaviour of GET /assets/market-movers."""
import pytest

from app.routers import assets as assets_router


MOVERS = {
    "trending": [{"symbol": "AAA"}],
    "gainers": [{"symbol": "BBB"}],
    "losers": [{"symbol": "CCC"}],
}


class _FakeCache:
    """In-memory stand-in for CacheService (tests run with REDIS_ENABLED=false)."""

    def __init__(self):
        self.store = {}

    def get(self, key, default=None):
        return self.store.get(key, default)

    def set(self, key, value, ttl=None, nx=False):
        if nx and key in self.store:
            return False
        self.store[key] = value
        return True

    def delete(self, key):
        self.store.pop(key, None)
        return True

    def exists(self, key):
        return key in self.store


@pytest.fixture
def fake_cache(monkeypatch):
    fake = _FakeCache()
    monkeypatch.setattr(assets_router, "CacheService", fake)
    return fake


@pytest.fixture
def screener_calls(monkeypatch):
    calls = []

    def fake_fetch(screener, count=10):
        calls.append(screener)
        return MOVERS["trending" if screener == "most_actives" else "gainers" if screener == "day_gainers" else "losers"]

    monkeypatch.setattr(assets_router, "_fetch_screener_tickers", fake_fetch)
    return calls


@pytest.fixture
def enqueued_refreshes(monkeypatch):
    from app.tasks import cache_tasks

    calls = []
    monkeypatch.setattr(cache_tasks.refresh_market_movers, "delay", lambda: calls.append(1))
    return calls


def test_fresh_cache_returns_without_provider_or_enqueue(client, fake_cache, screener_calls, enqueued_refreshes):
    fake_cache.store[assets_router._MARKET_MOVERS_CACHE_KEY] = MOVERS

    response = client.get("/assets/market-movers")

    assert response.status_code == 200
    assert response.json() == MOVERS
    assert screener_calls == []
    assert enqueued_refreshes == []


def test_stale_cache_served_immediately_with_single_refresh(client, fake_cache, screener_calls, enqueued_refreshes):
    fake_cache.store[assets_router._MARKET_MOVERS_STALE_KEY] = MOVERS

    first = client.get("/assets/market-movers")
    second = client.get("/assets/market-movers")

    assert first.json() == MOVERS
    assert second.json() == MOVERS
    assert screener_calls == [], "stale requests must not hit the provider in-request"
    assert enqueued_refreshes == [1], "concurrent stale requests must enqueue exactly one refresh"
    assert fake_cache.exists(assets_router._MARKET_MOVERS_LOCK_KEY)


def test_cold_cache_fetches_once_and_populates_both_generations(client, fake_cache, screener_calls, enqueued_refreshes):
    response = client.get("/assets/market-movers")

    assert response.status_code == 200
    assert response.json() == MOVERS
    assert sorted(screener_calls) == ["day_gainers", "day_losers", "most_actives"]
    assert fake_cache.get(assets_router._MARKET_MOVERS_CACHE_KEY) == MOVERS
    assert fake_cache.get(assets_router._MARKET_MOVERS_STALE_KEY) == MOVERS
    assert not fake_cache.exists(assets_router._MARKET_MOVERS_LOCK_KEY), "cold-path lock must be released"


def test_cold_concurrent_request_polls_instead_of_stampeding(client, fake_cache, screener_calls, monkeypatch):
    # Another process holds the refresh lock and completes mid-poll.
    fake_cache.store[assets_router._MARKET_MOVERS_LOCK_KEY] = True
    monkeypatch.setattr(assets_router, "_MARKET_MOVERS_COLD_POLL_INTERVAL_SECONDS", 0.001)

    polls = {"n": 0}
    original_get = fake_cache.get

    def get_with_late_fill(key, default=None):
        if key == assets_router._MARKET_MOVERS_CACHE_KEY:
            polls["n"] += 1
            if polls["n"] >= 3:
                fake_cache.store[assets_router._MARKET_MOVERS_CACHE_KEY] = MOVERS
        return original_get(key, default)

    monkeypatch.setattr(fake_cache, "get", get_with_late_fill)

    response = client.get("/assets/market-movers")

    assert response.status_code == 200
    assert response.json() == MOVERS
    assert screener_calls == [], "a lock-holder elsewhere means this request must not call the provider"


def test_cold_concurrent_request_degrades_cleanly_when_no_result_appears(client, fake_cache, screener_calls, monkeypatch):
    fake_cache.store[assets_router._MARKET_MOVERS_LOCK_KEY] = True
    monkeypatch.setattr(assets_router, "_MARKET_MOVERS_COLD_POLL_INTERVAL_SECONDS", 0.001)

    response = client.get("/assets/market-movers")

    assert response.status_code == 200
    assert response.json() == {"trending": [], "gainers": [], "losers": []}
    assert screener_calls == []


def test_empty_provider_result_is_not_cached(client, fake_cache, monkeypatch):
    monkeypatch.setattr(assets_router, "_fetch_screener_tickers", lambda screener, count=10: [])

    response = client.get("/assets/market-movers")

    assert response.status_code == 200
    assert response.json() == {"trending": [], "gainers": [], "losers": []}
    assert not fake_cache.exists(assets_router._MARKET_MOVERS_CACHE_KEY)
    assert not fake_cache.exists(assets_router._MARKET_MOVERS_STALE_KEY)
