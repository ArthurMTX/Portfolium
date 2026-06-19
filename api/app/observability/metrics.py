"""Prometheus metrics with deliberately bounded labels."""
from __future__ import annotations

import os
from contextlib import contextmanager
from time import monotonic
from typing import Iterator

from prometheus_client import CollectorRegistry, Counter, Histogram, REGISTRY, generate_latest
from prometheus_client.multiprocess import MultiProcessCollector


HTTP_REQUESTS = Counter(
    "portfolium_http_requests_total",
    "HTTP requests completed.",
    ("method", "route", "status_code"),
)
HTTP_DURATION = Histogram(
    "portfolium_http_request_duration_seconds",
    "HTTP request duration.",
    ("method", "route"),
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30),
)
HTTP_ERRORS = Counter(
    "portfolium_http_errors_total",
    "HTTP responses with 4xx or 5xx status.",
    ("method", "route", "status_class"),
)
PRICE_REFRESH_DURATION = Histogram(
    "portfolium_price_refresh_duration_seconds",
    "Price refresh duration at the provider boundary.",
    ("provider",),
    buckets=(0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20, 60),
)
YFINANCE_CALLS = Counter(
    "portfolium_yfinance_calls_total",
    "Yahoo Finance provider calls.",
    ("provider",),
)
YFINANCE_FAILURES = Counter(
    "portfolium_yfinance_failures_total",
    "Yahoo Finance provider failures.",
    ("provider", "reason_category"),
)
CACHE_HITS = Counter(
    "portfolium_cache_hits_total",
    "Central cache hits.",
    ("cache_name",),
)
CACHE_MISSES = Counter(
    "portfolium_cache_misses_total",
    "Central cache misses.",
    ("cache_name",),
)
CELERY_TASK_DURATION = Histogram(
    "portfolium_celery_task_duration_seconds",
    "Celery task duration.",
    ("task_name",),
    buckets=(0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300, 600),
)
CELERY_TASK_FAILURES = Counter(
    "portfolium_celery_task_failures_total",
    "Celery task failures.",
    ("task_name",),
)
DAILY_GAIN_RELIABLE = Counter(
    "portfolium_daily_gain_reliable_total",
    "Reliable daily gain calculations.",
)
DAILY_GAIN_UNAVAILABLE = Counter(
    "portfolium_daily_gain_unavailable_total",
    "Daily gain unavailable results by bounded reason category.",
    ("reason_category",),
)


def metrics_payload() -> bytes:
    """Render the current process or configured multiprocess registry."""
    if os.getenv("PROMETHEUS_MULTIPROC_DIR"):
        registry = CollectorRegistry()
        MultiProcessCollector(registry)
        return generate_latest(registry)
    return generate_latest(REGISTRY)


def classify_provider_failure(exc: BaseException) -> str:
    name = type(exc).__name__.lower()
    message = str(exc).lower()
    if "timeout" in name or "timeout" in message:
        return "timeout"
    if any(marker in message for marker in ("429", "rate limit", "too many")):
        return "rate_limited"
    if any(marker in message for marker in ("connection", "dns", "network")):
        return "network"
    if "circuit" in message:
        return "circuit_open"
    return "provider_error"


def cache_name_from_key(key: str) -> str:
    """Map arbitrary Redis keys to a fixed, non-identifying cache family."""
    prefix = key.split(":", 1)[0].lower()
    return {
        "price": "price",
        "positions": "positions",
        "metrics": "portfolio_metrics",
        "analytics": "analytics",
        "asset": "asset",
        "insights": "insights",
        "portfolio": "portfolio",
        "market": "market",
        "indices": "indices",
        "dashboard_batch": "dashboard",
        "public_portfolio": "public_portfolio",
        "risk_metrics": "risk_metrics",
    }.get(prefix, "other")


def daily_gain_reason_category(reasons: list[str]) -> str:
    combined = " ".join(reasons).lower()
    if "no transactions" in combined:
        return "no_transactions"
    if "historical close" in combined or "previous close" in combined:
        return "previous_close_unavailable"
    if "fx" in combined or "exchange rate" in combined:
        return "fx_unavailable"
    if "current price" in combined or "market value" in combined:
        return "current_price_unavailable"
    if "asset" in combined:
        return "asset_data_unavailable"
    return "incomplete_data"


def record_price_refresh(duration_seconds: float, *, provider: str = "yahoo") -> None:
    PRICE_REFRESH_DURATION.labels(provider=provider).observe(duration_seconds)


@contextmanager
def observe_price_refresh(provider: str = "yahoo") -> Iterator[None]:
    started = monotonic()
    try:
        yield
    finally:
        PRICE_REFRESH_DURATION.labels(provider=provider).observe(monotonic() - started)
