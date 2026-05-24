"""
Small Redis-backed health signals for the market-data core.

These helpers are intentionally best-effort: observability must never change
pricing, currency, or task behavior when Redis is unavailable.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from redis.exceptions import RedisError

from app.redis_client import get_redis
from app.services.cache import CacheService


CRITICAL_TASKS = [
    "app.tasks.cache_tasks.warmup_price_cache",
    "dashboard.warmup_active_dashboards",
    "app.tasks.maintenance_tasks.fetch_daily_closing_prices",
    "app.tasks.maintenance_tasks.detect_and_fill_price_gaps",
    "tasks.fetch_all_dividends",
    "app.tasks.calendar_tasks.refresh_earnings_cache",
]

_JOB_SUCCESS_PREFIX = "core:job_success:"
_STALE_FALLBACK_TOTAL_KEY = "core:stale_fallback:total"
_STALE_FALLBACK_LAST_KEY = "core:stale_fallback:last"
_STALE_FALLBACK_HOUR_PREFIX = "core:stale_fallback:hour:"
_STALE_FALLBACK_TTL_SECONDS = 48 * 60 * 60


def _utc_now_iso() -> str:
    return datetime.utcnow().isoformat()


def record_task_success(task_name: str | None, task_id: str | None = None) -> None:
    """Record the last successful execution for a Celery task."""
    if not task_name:
        return

    CacheService.set(
        f"{_JOB_SUCCESS_PREFIX}{task_name}",
        {
            "task_name": task_name,
            "task_id": task_id,
            "last_success_at": _utc_now_iso(),
        },
    )


def record_stale_fallback(kind: str, *, reason: str, symbol: str | None = None) -> None:
    """Count stale fallback usage by hour and keep the last fallback detail."""
    redis_client = get_redis()
    if not redis_client:
        return

    now = datetime.utcnow()
    hour_key = f"{_STALE_FALLBACK_HOUR_PREFIX}{kind}:{now.strftime('%Y%m%d%H')}"
    last_payload = {
        "kind": kind,
        "reason": reason,
        "symbol": symbol,
        "at": now.isoformat(),
    }

    try:
        pipe = redis_client.pipeline()
        pipe.incr(_STALE_FALLBACK_TOTAL_KEY)
        pipe.incr(hour_key)
        pipe.expire(hour_key, _STALE_FALLBACK_TTL_SECONDS)
        pipe.set(_STALE_FALLBACK_LAST_KEY, CacheService._serialize(last_payload))
        pipe.execute()
    except (RedisError, TypeError):
        return


def _get_stale_fallback_stats() -> dict[str, Any]:
    redis_client = get_redis()
    if not redis_client:
        return {"status": "unavailable"}

    try:
        hour_keys = redis_client.keys(f"{_STALE_FALLBACK_HOUR_PREFIX}*")
        last_hour_count = 0
        by_kind_last_48h: dict[str, int] = {}

        for raw_key in hour_keys:
            key = raw_key.decode() if isinstance(raw_key, bytes) else str(raw_key)
            raw_count = redis_client.get(raw_key)
            count = int(raw_count or 0)
            parts = key.split(":")
            kind = parts[3] if len(parts) >= 5 else "unknown"
            by_kind_last_48h[kind] = by_kind_last_48h.get(kind, 0) + count
            if key.endswith(datetime.utcnow().strftime("%Y%m%d%H")):
                last_hour_count += count

        last_raw = redis_client.get(_STALE_FALLBACK_LAST_KEY)
        last = CacheService._deserialize(last_raw) if last_raw else None

        return {
            "status": "available",
            "total": int(redis_client.get(_STALE_FALLBACK_TOTAL_KEY) or 0),
            "last_hour": last_hour_count,
            "by_kind_last_48h": by_kind_last_48h,
            "last": last,
        }
    except (RedisError, ValueError, TypeError):
        return {"status": "error"}


def get_core_observability() -> dict[str, Any]:
    """Return compact signals for Yahoo, cache fallbacks, and critical jobs."""
    task_success = {
        task_name: CacheService.get(f"{_JOB_SUCCESS_PREFIX}{task_name}")
        for task_name in CRITICAL_TASKS
    }

    try:
        from app.services.pricing import get_rate_limit_remaining, is_rate_limited

        yahoo_circuit = {
            "open": is_rate_limited(),
            "remaining_seconds": round(get_rate_limit_remaining(), 1),
        }
    except Exception:
        yahoo_circuit = {"open": False, "remaining_seconds": 0.0, "status": "unknown"}

    return {
        "yahoo_circuit": yahoo_circuit,
        "stale_fallbacks": _get_stale_fallback_stats(),
        "critical_jobs": task_success,
    }
