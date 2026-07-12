"""Prometheus metrics with deliberately bounded labels."""
from __future__ import annotations

import os
import threading
from functools import wraps
from contextlib import contextmanager
from time import monotonic
from typing import Any, Callable, Iterator, TypeVar

from prometheus_client import CollectorRegistry, Counter, Histogram, REGISTRY, generate_latest
from prometheus_client.core import GaugeMetricFamily
from prometheus_client.multiprocess import MultiProcessCollector


F = TypeVar("F", bound=Callable[..., Any])

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
LOGO_RESOLUTION = Counter(
    "portfolium_logo_resolution_total",
    "Asset logo resolution outcomes by provider.",
    ("provider",),  # trade_republic | brandfetch | logo_dev | generated | unchanged
)
TRADE_REPUBLIC_LOGO_VALIDATION = Counter(
    "portfolium_trade_republic_logo_validation_total",
    "Trade Republic logo fetch validation results.",
    ("variant", "result"),  # variant: light|dark; result: valid|invalid|request_failed
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
PRICE_ASSETS_REFRESHED = Counter(
    "portfolium_price_assets_refreshed_total",
    "Assets successfully refreshed from the market-data provider.",
    ("provider",),
)
MISSING_PRICES = Counter(
    "portfolium_missing_prices_total",
    "Requested asset prices unavailable after provider and fallback processing.",
)
FX_REFRESH_DURATION = Histogram(
    "portfolium_fx_refresh_duration_seconds",
    "FX rate lookup duration, including provider fallback processing.",
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20),
)
FX_FAILURES = Counter(
    "portfolium_fx_failures_total",
    "FX rate lookups that could not return a current or stale rate.",
    ("reason_category",),
)
BUSINESS_OPERATION_DURATION = Histogram(
    "portfolium_business_operation_duration_seconds",
    "Duration of bounded portfolio business operations.",
    ("operation",),
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120),
)
TRANSACTIONS_CREATED = Counter(
    "portfolium_transactions_created_total",
    "Transactions created through Portfolium.",
)
IMPORTED_TRANSACTIONS = Counter(
    "portfolium_imported_transactions_total",
    "Transactions created through CSV imports.",
)
NOTIFICATIONS_CREATED = Counter(
    "portfolium_notifications_created_total",
    "In-app notifications created.",
)
DB_QUERY_DURATION = Histogram(
    "portfolium_db_query_duration_seconds",
    "SQLAlchemy query duration without SQL text or identifier labels.",
    ("operation",),
    buckets=(0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5),
)
DB_SLOW_QUERIES = Counter(
    "portfolium_db_slow_queries_total",
    "SQLAlchemy queries exceeding one second.",
    ("operation",),
)


class BusinessInventoryCollector:
    """Collect low-cardinality inventory gauges directly from the primary database."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._cached_at = 0.0
        self._cached_values: tuple[tuple[str, str, int], ...] = ()

    def describe(self):
        """Avoid database access during registry registration."""
        return []

    def _load_values(self) -> tuple[tuple[str, str, int], ...]:
        now = monotonic()
        with self._lock:
            if self._cached_values and now - self._cached_at < 60:
                return self._cached_values

            from app.db import SessionLocal
            from sqlalchemy import text

            db = SessionLocal()
            try:
                values = (
                    (
                        "portfolium_portfolios",
                        "Current portfolio count.",
                        db.execute(text("SELECT COUNT(*) FROM portfolio.portfolios")).scalar() or 0,
                    ),
                    (
                        "portfolium_assets",
                        "Current asset count.",
                        db.execute(text("SELECT COUNT(*) FROM portfolio.assets")).scalar() or 0,
                    ),
                    (
                        "portfolium_active_users",
                        "Current enabled user count.",
                        db.execute(
                            text("SELECT COUNT(*) FROM portfolio.users WHERE is_active IS TRUE")
                        ).scalar()
                        or 0,
                    ),
                    (
                        "portfolium_transactions_last_24h",
                        "Transactions created in the last 24 hours.",
                        db.execute(
                            text(
                                "SELECT COUNT(*) FROM portfolio.transactions "
                                "WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'"
                            )
                        ).scalar()
                        or 0,
                    ),
                    (
                        "portfolium_notifications_last_24h",
                        "Notifications created in the last 24 hours.",
                        db.execute(
                            text(
                                "SELECT COUNT(*) FROM portfolio.notifications "
                                "WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'"
                            )
                        ).scalar()
                        or 0,
                    ),
                )
                self._cached_values = values
                self._cached_at = now
                return values
            except Exception:
                if self._cached_values:
                    return self._cached_values
                raise
            finally:
                db.close()

    def collect(self):
        try:
            for name, documentation, value in self._load_values():
                metric = GaugeMetricFamily(name, documentation)
                metric.add_metric([], value)
                yield metric
        except Exception:
            return


BUSINESS_INVENTORY_COLLECTOR = BusinessInventoryCollector()
REGISTRY.register(BUSINESS_INVENTORY_COLLECTOR)


def build_metrics_registry(*, include_business_inventory: bool = True):
    """Build a registry suitable for API or Celery multiprocess collection."""
    if os.getenv("PROMETHEUS_MULTIPROC_DIR"):
        registry = CollectorRegistry()
        if include_business_inventory:
            registry.register(BUSINESS_INVENTORY_COLLECTOR)
        MultiProcessCollector(registry)
        return registry
    return REGISTRY


def metrics_payload() -> bytes:
    """Render the current process or configured multiprocess registry."""
    return generate_latest(build_metrics_registry())


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


def observe_operation(operation: str) -> Callable[[F], F]:
    """Time a synchronous function under a fixed, code-defined operation label."""

    def decorator(func: F) -> F:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any):
            started = monotonic()
            try:
                return func(*args, **kwargs)
            finally:
                BUSINESS_OPERATION_DURATION.labels(operation=operation).observe(
                    monotonic() - started
                )

        return wrapper  # type: ignore[return-value]

    return decorator


def observe_async_operation(operation: str) -> Callable[[F], F]:
    """Time an asynchronous function under a fixed, code-defined operation label."""

    def decorator(func: F) -> F:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any):
            started = monotonic()
            try:
                return await func(*args, **kwargs)
            finally:
                BUSINESS_OPERATION_DURATION.labels(operation=operation).observe(
                    monotonic() - started
                )

        return wrapper  # type: ignore[return-value]

    return decorator


def observe_fx_lookup(func: F) -> F:
    """Time an FX lookup and count unavailable results without currency labels."""

    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any):
        started = monotonic()
        try:
            result = func(*args, **kwargs)
            if result is None:
                FX_FAILURES.labels(reason_category="unavailable").inc()
            return result
        except BaseException:
            FX_FAILURES.labels(reason_category="exception").inc()
            raise
        finally:
            FX_REFRESH_DURATION.observe(monotonic() - started)

    return wrapper  # type: ignore[return-value]
