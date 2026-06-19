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
from pathlib import Path
import tempfile
from typing import Any, Callable, Protocol, Sequence, TypeVar

from app.config import settings
from app.observability.metrics import (
    YFINANCE_CALLS,
    YFINANCE_FAILURES,
    classify_provider_failure,
)

logger = logging.getLogger(__name__)

T = TypeVar("T")

DEFAULT_YAHOO_TIMEOUT_SECONDS = 8.0
DEFAULT_YAHOO_BACKOFF_SECONDS = 60.0


def _configure_yfinance_tz_cache() -> None:
    """Point yfinance at a writable tz cache directory before first use."""
    cache_dir = Path(
        getattr(
            settings,
            "YFINANCE_TZ_CACHE_DIR",
            Path(tempfile.gettempdir()) / "portfolium" / "py-yfinance",
        )
    )

    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
    except Exception as exc:
        logger.warning("provider=yahoo tz_cache_dir_prepare_failed path=%s error=%s", cache_dir, exc)
        return

    try:
        import yfinance as yf

        yf.set_tz_cache_location(str(cache_dir))
    except Exception as exc:
        logger.warning("provider=yahoo tz_cache_location_set_failed path=%s error=%s", cache_dir, exc)


_configure_yfinance_tz_cache()


class YahooUnavailableError(RuntimeError):
    """Raised when Yahoo should not be called or does not respond cleanly."""


class MarketDataProvider(Protocol):
    """Minimal market data provider contract used by request-path code."""

    name: str

    def get_info(
        self,
        symbol: str,
        *,
        action: str = "ticker_info",
        timeout_seconds: float | None = None,
    ) -> dict[str, Any]:
        ...

    def get_history(
        self,
        symbol: str,
        *,
        action: str = "history",
        timeout_seconds: float | None = None,
        **kwargs: Any,
    ) -> Any:
        ...

    def download(
        self,
        symbols: str | Sequence[str],
        *,
        action: str = "download",
        timeout_seconds: float | None = None,
        **kwargs: Any,
    ) -> Any:
        ...

    def get_calendar(
        self,
        symbol: str,
        *,
        action: str = "calendar",
        timeout_seconds: float | None = None,
    ) -> Any:
        ...

    def get_recommendations(
        self,
        symbol: str,
        *,
        action: str = "recommendations",
        timeout_seconds: float | None = None,
    ) -> Any:
        ...

    def get_institutional_holders(
        self,
        symbol: str,
        *,
        action: str = "institutional_holders",
        timeout_seconds: float | None = None,
    ) -> Any:
        ...

    def get_major_holders(
        self,
        symbol: str,
        *,
        action: str = "major_holders",
        timeout_seconds: float | None = None,
    ) -> Any:
        ...

    def get_dividends(
        self,
        symbol: str,
        *,
        action: str = "dividends",
        timeout_seconds: float | None = None,
    ) -> Any:
        ...

    def get_splits(
        self,
        symbol: str,
        *,
        action: str = "splits",
        timeout_seconds: float | None = None,
    ) -> Any:
        ...

    def get_actions(
        self,
        symbol: str,
        *,
        action: str = "actions",
        timeout_seconds: float | None = None,
    ) -> Any:
        ...


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
        from app.services.market_data.pricing import is_rate_limited

        return is_rate_limited()
    except Exception:
        return False


def yahoo_circuit_remaining() -> float:
    """Return seconds remaining in the existing Yahoo circuit breaker."""
    try:
        from app.services.market_data.pricing import get_rate_limit_remaining

        return get_rate_limit_remaining()
    except Exception:
        return 0.0


def trip_yahoo_circuit(duration_seconds: float | None = None) -> None:
    """Trip the existing Yahoo circuit breaker with a small jitter."""
    try:
        from app.services.market_data.pricing import set_rate_limited

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
    YFINANCE_CALLS.labels(provider="yahoo").inc()
    if is_yahoo_circuit_open():
        remaining = yahoo_circuit_remaining()
        YFINANCE_FAILURES.labels(provider="yahoo", reason_category="circuit_open").inc()
        logger.warning(
            "Yahoo provider call skipped because circuit is open",
                extra={
                    "provider": "yahoo",
                    "operation": action,
                    "event": "provider_call_skipped",
                    "reason_category": "circuit_open",
            },
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
                "Yahoo provider call completed",
                extra={
                    "provider": "yahoo",
                    "operation": action,
                    "event": "provider_call_completed",
                    "duration_ms": round(duration_ms, 2),
                },
            )
            return result
        except Exception as exc:
            duration_ms = (time.monotonic() - started_at) * 1000
            last_error = exc
            rate_limited = is_yahoo_rate_limit_error(exc)
            if rate_limited:
                trip_yahoo_circuit()
            reason_category = "rate_limited" if rate_limited else classify_provider_failure(exc)
            YFINANCE_FAILURES.labels(
                provider="yahoo",
                reason_category=reason_category,
            ).inc()
            logger.warning(
                "Yahoo provider call failed",
                extra={
                    "provider": "yahoo",
                    "operation": action,
                    "event": "provider_call_failed",
                    "duration_ms": round(duration_ms, 2),
                    "reason_category": reason_category,
                },
            )

            if rate_limited or attempt >= attempts:
                break

            time.sleep(retry_backoff_seconds * attempt)

    raise YahooUnavailableError(str(last_error) if last_error else "Yahoo unavailable")


def _format_symbols(symbols: str | Sequence[str]) -> str:
    if isinstance(symbols, str):
        return symbols

    symbols_list = list(symbols)
    return ",".join(symbols_list[:5]) + ("..." if len(symbols_list) > 5 else "")


class YahooMarketDataProvider:
    """Yahoo/yfinance implementation of the minimal market data provider."""

    name = "yahoo"

    def get_info(
        self,
        symbol: str,
        *,
        action: str = "ticker_info",
        timeout_seconds: float | None = None,
    ) -> dict[str, Any]:
        import yfinance as yf

        ticker = yf.Ticker(symbol)
        return call_yahoo(
            lambda: ticker.info,
            symbol=symbol,
            action=action,
            timeout_seconds=timeout_seconds,
        )

    def get_history(
        self,
        symbol: str,
        *,
        action: str = "history",
        timeout_seconds: float | None = None,
        **kwargs: Any,
    ) -> Any:
        import yfinance as yf

        ticker = yf.Ticker(symbol)
        return call_yahoo(
            lambda: ticker.history(**kwargs),
            symbol=symbol,
            action=action,
            timeout_seconds=timeout_seconds,
        )

    def download(
        self,
        symbols: str | Sequence[str],
        *,
        action: str = "download",
        timeout_seconds: float | None = None,
        **kwargs: Any,
    ) -> Any:
        import yfinance as yf

        return call_yahoo(
            lambda: yf.download(symbols, **kwargs),
            symbol=_format_symbols(symbols),
            action=action,
            timeout_seconds=timeout_seconds,
        )

    def get_calendar(
        self,
        symbol: str,
        *,
        action: str = "calendar",
        timeout_seconds: float | None = None,
    ) -> Any:
        return self._get_ticker_property(symbol, "calendar", action, timeout_seconds)

    def get_recommendations(
        self,
        symbol: str,
        *,
        action: str = "recommendations",
        timeout_seconds: float | None = None,
    ) -> Any:
        return self._get_ticker_property(symbol, "recommendations", action, timeout_seconds)

    def get_institutional_holders(
        self,
        symbol: str,
        *,
        action: str = "institutional_holders",
        timeout_seconds: float | None = None,
    ) -> Any:
        return self._get_ticker_property(symbol, "institutional_holders", action, timeout_seconds)

    def get_major_holders(
        self,
        symbol: str,
        *,
        action: str = "major_holders",
        timeout_seconds: float | None = None,
    ) -> Any:
        return self._get_ticker_property(symbol, "major_holders", action, timeout_seconds)

    def get_dividends(
        self,
        symbol: str,
        *,
        action: str = "dividends",
        timeout_seconds: float | None = None,
    ) -> Any:
        return self._get_ticker_property(symbol, "dividends", action, timeout_seconds)

    def get_splits(
        self,
        symbol: str,
        *,
        action: str = "splits",
        timeout_seconds: float | None = None,
    ) -> Any:
        return self._get_ticker_property(symbol, "splits", action, timeout_seconds)

    def get_actions(
        self,
        symbol: str,
        *,
        action: str = "actions",
        timeout_seconds: float | None = None,
    ) -> Any:
        return self._get_ticker_property(symbol, "actions", action, timeout_seconds)

    def _get_ticker_property(
        self,
        symbol: str,
        property_name: str,
        action: str,
        timeout_seconds: float | None,
    ) -> Any:
        import yfinance as yf

        ticker = yf.Ticker(symbol)
        return call_yahoo(
            lambda: getattr(ticker, property_name),
            symbol=symbol,
            action=action,
            timeout_seconds=timeout_seconds,
        )


_market_data_provider: MarketDataProvider = YahooMarketDataProvider()


def get_market_data_provider() -> MarketDataProvider:
    """Return the configured market data provider."""
    return _market_data_provider
