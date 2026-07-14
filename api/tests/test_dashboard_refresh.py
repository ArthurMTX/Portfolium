"""Regression coverage for dashboard history and refresh orchestration."""
import asyncio
import json
import time
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest

from app.routers import batch
from app.errors import UnauthorizedPortfolioAccessError


class FakeRedis:
    """Minimal Redis lock behavior shared by concurrent request simulations."""

    def __init__(self):
        self.values = {}
        self.expires_at = {}

    def _expire(self, key):
        if key in self.expires_at and time.monotonic() >= self.expires_at[key]:
            self.values.pop(key, None)
            self.expires_at.pop(key, None)

    def set(self, key, value, nx=False, ex=None):
        self._expire(key)
        if nx and key in self.values:
            return False
        self.values[key] = value
        if ex is not None:
            self.expires_at[key] = time.monotonic() + ex
        return True

    def get(self, key):
        self._expire(key)
        return self.values.get(key)

    def eval(self, script, number_of_keys, key, token, ttl=None):
        del script, number_of_keys
        self._expire(key)
        if self.values.get(key) == token:
            if ttl is not None:
                self.expires_at[key] = time.monotonic() + float(ttl)
                return 1
            del self.values[key]
            self.expires_at.pop(key, None)
            return 1
        return 0


def _request():
    return batch.DashboardBatchRequest(
        portfolio_id=7,
        visible_widgets=["performance-metrics"],
        include_sold=False,
    )


def _install_request_fakes(monkeypatch, cache_data):
    redis = FakeRedis()
    monkeypatch.setattr(batch, "get_redis", lambda: redis)
    monkeypatch.setattr(
        batch.crud_portfolios,
        "get_portfolio",
        lambda db, portfolio_id: SimpleNamespace(id=portfolio_id, user_id=3),
    )
    monkeypatch.setattr(batch.CacheService, "get", staticmethod(cache_data.get))

    def cache_set(key, value, ttl=None, nx=False):
        del ttl, nx
        cache_data[key] = value
        return True

    monkeypatch.setattr(batch.CacheService, "set", staticmethod(cache_set))
    return redis


async def _call_dashboard():
    return await batch.get_dashboard_batch(
        request=_request(),
        metrics_service=object(),
        insights_service=object(),
        current_user=SimpleNamespace(id=3),
        db=object(),
    )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_performance_history_is_calculated_once_and_sliced(monkeypatch):
    calls = []
    today = datetime.utcnow().date()
    canonical = [
        SimpleNamespace(date=(today - timedelta(days=400)).isoformat()),
        SimpleNamespace(date=(today - timedelta(days=20)).isoformat()),
        SimpleNamespace(date=(today - timedelta(days=2)).isoformat()),
    ]

    def get_history(self, portfolio_id, period):
        del self
        calls.append((portfolio_id, period))
        return canonical

    monkeypatch.setattr(
        "app.services.portfolio_analytics.metrics.MetricsService.get_portfolio_history",
        get_history,
    )

    result = await batch._fetch_performance_history(7, object())

    assert calls == [(7, "ALL")]
    assert result["ALL"] == canonical
    assert result["1W"] == canonical[-1:]
    assert result["1M"] == canonical[-2:]
    assert result["1Y"] == canonical[-2:]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_recent_all_zero_origin_is_not_in_short_periods(monkeypatch):
    today = datetime.utcnow().date()
    zero_origin = SimpleNamespace(date=(today - timedelta(days=3)).isoformat())
    first_valuation = SimpleNamespace(date=(today - timedelta(days=2)).isoformat())

    monkeypatch.setattr(
        "app.services.portfolio_analytics.metrics.MetricsService.get_portfolio_history",
        lambda self, portfolio_id, period: [zero_origin, first_valuation],
    )

    result = await batch._fetch_performance_history(7, object())

    assert result["ALL"] == [zero_origin, first_valuation]
    assert result["1W"] == [first_valuation]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_two_concurrent_cold_requests_trigger_one_computation(monkeypatch):
    cache_data = {}
    _install_request_fakes(monkeypatch, cache_data)
    calls = 0

    async def refresh(cache_key, token, *args):
        nonlocal calls
        del args
        calls += 1
        await asyncio.sleep(0.05)
        result = {
            "data": {"metrics": {"total_value": 1}},
            "errors": None,
            "timestamp": datetime.now().isoformat(),
        }
        cache_data[cache_key] = result
        batch._release_dashboard_lock(cache_key, token)
        return result

    monkeypatch.setattr(batch, "_refresh_dashboard_cache", refresh)

    first, second = await asyncio.gather(_call_dashboard(), _call_dashboard())

    assert calls == 1
    assert first["data"] == second["data"]
    assert first["data"]["metrics"]["total_value"] == 1


@pytest.mark.unit
@pytest.mark.asyncio
async def test_stale_data_returns_while_refresh_is_running(monkeypatch):
    cache_key = batch.build_dashboard_batch_cache_key(7, ["performance-metrics"])
    cache_data = {
        cache_key: {
            "data": {"metrics": {"total_value": 41}},
            "errors": None,
            "timestamp": (datetime.now() - timedelta(minutes=10)).isoformat(),
        }
    }
    _install_request_fakes(monkeypatch, cache_data)
    started = asyncio.Event()
    finish = asyncio.Event()

    async def refresh(cache_key, token, *args):
        del args
        started.set()
        await finish.wait()
        batch._release_dashboard_lock(cache_key, token)

    monkeypatch.setattr(batch, "_refresh_dashboard_cache", refresh)

    before = time.monotonic()
    response = await _call_dashboard()
    elapsed = time.monotonic() - before

    await started.wait()
    assert elapsed < 0.5
    assert response["stale"] is True
    assert response["data"]["metrics"]["total_value"] == 41
    finish.set()
    await asyncio.gather(*list(batch._dashboard_refresh_tasks))


@pytest.mark.unit
@pytest.mark.asyncio
async def test_cancelled_client_does_not_start_duplicate_refresh(monkeypatch):
    cache_data = {}
    _install_request_fakes(monkeypatch, cache_data)
    started = asyncio.Event()
    finish = asyncio.Event()
    calls = 0

    async def refresh(cache_key, token, *args):
        nonlocal calls
        del args
        calls += 1
        started.set()
        await finish.wait()
        result = {
            "data": {"metrics": {"total_value": 99}},
            "errors": None,
            "timestamp": datetime.now().isoformat(),
        }
        cache_data[cache_key] = result
        batch._release_dashboard_lock(cache_key, token)
        return result

    monkeypatch.setattr(batch, "_refresh_dashboard_cache", refresh)
    first = asyncio.create_task(_call_dashboard())
    await started.wait()
    first.cancel()
    with pytest.raises(asyncio.CancelledError):
        await first

    second = asyncio.create_task(_call_dashboard())
    await asyncio.sleep(0.05)
    assert calls == 1
    finish.set()
    response = await second
    assert response["data"]["metrics"]["total_value"] == 99
    assert calls == 1


@pytest.mark.unit
@pytest.mark.asyncio
async def test_lightweight_coroutine_remains_responsive_during_history(monkeypatch):
    def slow_history(self, portfolio_id, period):
        del self, portfolio_id, period
        time.sleep(0.2)
        return []

    monkeypatch.setattr(
        "app.services.portfolio_analytics.metrics.MetricsService.get_portfolio_history",
        slow_history,
    )

    history_task = asyncio.create_task(batch._fetch_performance_history(7, object()))
    started = time.monotonic()
    await asyncio.sleep(0.01)
    lightweight_elapsed = time.monotonic() - started
    await history_task

    assert lightweight_elapsed < 0.1


@pytest.mark.unit
@pytest.mark.asyncio
async def test_partial_refresh_response_is_not_cached(monkeypatch):
    cache_writes = []
    fake_db = SimpleNamespace(
        query=lambda model: SimpleNamespace(
            filter=lambda *args: SimpleNamespace(first=lambda: SimpleNamespace(id=3))
        ),
        close=lambda: None,
    )
    monkeypatch.setattr(batch, "SessionLocal", lambda: fake_db)
    monkeypatch.setattr(
        batch.crud_portfolios,
        "get_portfolio",
        lambda db, portfolio_id: SimpleNamespace(id=portfolio_id, user_id=3),
    )
    monkeypatch.setattr(
        batch,
        "_compute_dashboard_response",
        lambda *args: asyncio.sleep(0, result={"data": {}, "errors": {"metrics": "failed"}}),
    )
    monkeypatch.setattr(
        batch.CacheService,
        "set",
        staticmethod(lambda *args, **kwargs: cache_writes.append((args, kwargs))),
    )
    monkeypatch.setattr(batch, "_release_dashboard_lock", lambda *args: None)

    result = await batch._refresh_dashboard_cache("key", "token", 7, [], False, 3)

    assert result["errors"]
    assert cache_writes == []


@pytest.mark.unit
@pytest.mark.asyncio
async def test_authorization_failure_never_reads_or_writes_dashboard_cache(monkeypatch):
    cache_touched = False

    def cache_access(*args, **kwargs):
        nonlocal cache_touched
        del args, kwargs
        cache_touched = True

    monkeypatch.setattr(
        batch.crud_portfolios,
        "get_portfolio",
        lambda db, portfolio_id: SimpleNamespace(id=portfolio_id, user_id=999),
    )
    monkeypatch.setattr(batch.CacheService, "get", staticmethod(cache_access))
    monkeypatch.setattr(batch.CacheService, "set", staticmethod(cache_access))

    with pytest.raises(UnauthorizedPortfolioAccessError):
        await _call_dashboard()

    assert cache_touched is False


@pytest.mark.unit
@pytest.mark.asyncio
async def test_refresh_pending_http_contract(monkeypatch):
    _install_request_fakes(monkeypatch, {})
    monkeypatch.setattr(batch, "_acquire_dashboard_lock", lambda key: None)
    monkeypatch.setattr(
        batch, "_wait_for_dashboard_cache", lambda *args: asyncio.sleep(0, result=None)
    )

    response = await _call_dashboard()
    payload = json.loads(response.body)

    assert response.status_code == 202
    assert response.headers["retry-after"] == "5"
    assert payload == {
        "data": {},
        "errors": None,
        "cached": False,
        "refreshing": True,
        "lock_ttl_seconds": 600,
        "timestamp": payload["timestamp"],
        "widgets_requested": 1,
        "data_fetched": 0,
    }


@pytest.mark.unit
@pytest.mark.asyncio
async def test_lock_lease_renews_past_original_ttl(monkeypatch):
    redis = FakeRedis()
    monkeypatch.setattr(batch, "get_redis", lambda: redis)
    monkeypatch.setattr(batch, "_DASHBOARD_LOCK_TTL", 1)
    monkeypatch.setattr(batch, "_DASHBOARD_LOCK_RENEW_INTERVAL", 0.1)
    token = batch._acquire_dashboard_lock("key")
    assert token

    lease = asyncio.create_task(batch._maintain_dashboard_lock("key", token))
    await asyncio.sleep(1.15)
    assert batch._acquire_dashboard_lock("key") is None

    lease.cancel()
    with pytest.raises(asyncio.CancelledError):
        await lease
    batch._release_dashboard_lock("key", token)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_abandoned_lock_cannot_outlive_ttl(monkeypatch):
    redis = FakeRedis()
    monkeypatch.setattr(batch, "get_redis", lambda: redis)
    monkeypatch.setattr(batch, "_DASHBOARD_LOCK_TTL", 0.1)

    abandoned_token = batch._acquire_dashboard_lock("key")
    await asyncio.sleep(0.12)
    replacement_token = batch._acquire_dashboard_lock("key")

    assert abandoned_token
    assert replacement_token
    assert replacement_token != abandoned_token


@pytest.mark.unit
@pytest.mark.asyncio
async def test_refresh_cancellation_runs_finally_cleanup(monkeypatch):
    redis = FakeRedis()
    monkeypatch.setattr(batch, "get_redis", lambda: redis)
    closed = False
    started = asyncio.Event()

    class FakeDB:
        def query(self, model):
            del model
            return SimpleNamespace(
                filter=lambda *args: SimpleNamespace(first=lambda: SimpleNamespace(id=3))
            )

        def close(self):
            nonlocal closed
            closed = True

    monkeypatch.setattr(batch, "SessionLocal", FakeDB)
    monkeypatch.setattr(
        batch.crud_portfolios,
        "get_portfolio",
        lambda db, portfolio_id: SimpleNamespace(id=portfolio_id, user_id=3),
    )

    async def never_finishes(*args):
        del args
        started.set()
        await asyncio.Event().wait()

    monkeypatch.setattr(batch, "_compute_dashboard_response", never_finishes)
    token = batch._acquire_dashboard_lock("key")
    refresh = asyncio.create_task(
        batch._refresh_dashboard_cache("key", token, 7, [], False, 3)
    )
    await started.wait()
    refresh.cancel()
    with pytest.raises(asyncio.CancelledError):
        await refresh

    assert closed is True
    assert batch._dashboard_lock_key("key") not in redis.values


@pytest.mark.unit
@pytest.mark.asyncio
async def test_invalidation_prevents_inflight_refresh_from_repopulating_cache(monkeypatch):
    redis = FakeRedis()
    monkeypatch.setattr(batch, "get_redis", lambda: redis)
    fake_db = SimpleNamespace(
        query=lambda model: SimpleNamespace(
            filter=lambda *args: SimpleNamespace(first=lambda: SimpleNamespace(id=3))
        ),
        close=lambda: None,
    )
    monkeypatch.setattr(batch, "SessionLocal", lambda: fake_db)
    monkeypatch.setattr(
        batch.crud_portfolios,
        "get_portfolio",
        lambda db, portfolio_id: SimpleNamespace(id=portfolio_id, user_id=3),
    )
    started = asyncio.Event()
    finish = asyncio.Event()
    cache_writes = []

    async def compute(*args):
        del args
        started.set()
        await finish.wait()
        return {"data": {"metrics": {}}, "errors": None}

    monkeypatch.setattr(batch, "_compute_dashboard_response", compute)
    monkeypatch.setattr(
        batch.CacheService,
        "set",
        staticmethod(lambda *args, **kwargs: cache_writes.append((args, kwargs))),
    )
    token = batch._acquire_dashboard_lock("key")
    refresh = asyncio.create_task(
        batch._refresh_dashboard_cache("key", token, 7, [], False, 3)
    )
    await started.wait()

    # Portfolio invalidation deletes this lock pattern along with every data key.
    redis.values.pop(batch._dashboard_lock_key("key"))
    redis.expires_at.pop(batch._dashboard_lock_key("key"), None)
    finish.set()
    await refresh

    assert cache_writes == []
