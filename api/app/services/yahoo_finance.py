"""
Small Yahoo/yfinance resilience helpers.

yfinance does not expose a timeout parameter consistently, so these helpers
bound socket operations, reuse the existing Redis circuit breaker, and keep
provider logs consistent without introducing a provider abstraction yet.
"""
import logging
import random
import socket
import time
from contextlib import contextmanager
from typing import Callable, TypeVar

from app.config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T")

DEFAULT_YAHOO_TIMEOUT_SECONDS = 8.0
DEFAULT_YAHOO_BACKOFF_SECONDS = 60.0


class YahooUnavailableError(RuntimeError):
    """Raised when Yahoo should not be called or does not respond cleanly."""


def yahoo_timeout_seconds(default: float = DEFAULT_YAHOO_TIMEOUT_SECONDS) -> float:
    """Return the configured per-call Yahoo socket timeout."""
    return float(getattr(settings, "YAHOO_REQUEST_TIMEOUT_SECONDS", default))


def is_yahoo_rate_limit_error(exc: BaseException) -> bool:
    """Best-effort detection for Yahoo/yfinance rate limit failures."""
    message = str(exc).lower()
    return any(
        marker in message
        for marker in ("rate", "limit", "429", "too many", "unauthorized", "crumb")
    )


def is_yahoo_circuit_open() -> bool:
    """Use the existing pricing circuit breaker without creating a hard import cycle."""
    try:
        from app.services.pricing import is_rate_limited

        return is_rate_limited()
    except Exception:
        return False


def yahoo_circuit_remaining() -> float:
    """Return seconds remaining in the existing Yahoo circuit breaker."""
    try:
        from app.services.pricing import get_rate_limit_remaining

        return get_rate_limit_remaining()
    except Exception:
        return 0.0


def trip_yahoo_circuit(duration_seconds: float | None = None) -> None:
    """Trip the existing Yahoo circuit breaker with a small jitter."""
    try:
        from app.services.pricing import set_rate_limited

        duration = duration_seconds or (
            DEFAULT_YAHOO_BACKOFF_SECONDS + random.uniform(0, 30)
        )
        set_rate_limited(duration)
    except Exception as exc:
        logger.warning("provider=yahoo circuit_breaker_set_failed error=%s", exc)


@contextmanager
def yahoo_socket_timeout(timeout_seconds: float | None = None):
    """Temporarily set the process default socket timeout around yfinance calls."""
    timeout = timeout_seconds or yahoo_timeout_seconds()
    old_timeout = socket.getdefaulttimeout()
    socket.setdefaulttimeout(timeout)
    try:
        yield
    finally:
        socket.setdefaulttimeout(old_timeout)


def call_yahoo(
    operation: Callable[[], T],
    *,
    symbol: str,
    action: str,
    timeout_seconds: float | None = None,
    retries: int = 0,
    retry_backoff_seconds: float = 0.5,
) -> T:
    """
    Execute a blocking Yahoo/yfinance operation with bounded sockets and logging.

    The retry is intentionally conservative and disabled by default. Rate-limit
    failures immediately trip the shared circuit breaker and are not retried.
    """
    if is_yahoo_circuit_open():
        remaining = yahoo_circuit_remaining()
        logger.warning(
            "provider=yahoo symbol=%s action=%s skipped=circuit_open remaining=%.1fs",
            symbol,
            action,
            remaining,
        )
        raise YahooUnavailableError(f"Yahoo circuit breaker open ({remaining:.1f}s)")

    attempts = retries + 1
    last_error: BaseException | None = None

    for attempt in range(1, attempts + 1):
        started_at = time.monotonic()
        try:
            with yahoo_socket_timeout(timeout_seconds):
                result = operation()
            duration_ms = (time.monotonic() - started_at) * 1000
            logger.info(
                "provider=yahoo symbol=%s action=%s duration_ms=%.0f status=success",
                symbol,
                action,
                duration_ms,
            )
            return result
        except Exception as exc:
            duration_ms = (time.monotonic() - started_at) * 1000
            last_error = exc
            rate_limited = is_yahoo_rate_limit_error(exc)
            if rate_limited:
                trip_yahoo_circuit()
            logger.warning(
                "provider=yahoo symbol=%s action=%s duration_ms=%.0f status=failed "
                "attempt=%s/%s rate_limited=%s error=%s",
                symbol,
                action,
                duration_ms,
                attempt,
                attempts,
                rate_limited,
                exc,
            )

            if rate_limited or attempt >= attempts:
                break

            time.sleep(retry_backoff_seconds * attempt)

    raise YahooUnavailableError(str(last_error) if last_error else "Yahoo unavailable")
