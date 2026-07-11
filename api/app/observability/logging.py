"""Centralized, redacting logging configuration."""
from __future__ import annotations

import json
import logging
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any

from app.observability.context import request_id_var, task_name_var


_STANDARD_RECORD_FIELDS = set(logging.makeLogRecord({}).__dict__) | {
    "message",
    "asctime",
}
_CONTEXT_FIELDS = (
    "request_id",
    "route",
    "method",
    "status_code",
    "duration_ms",
    "response_bytes",
    "task_name",
    "provider",
    "operation",
    "event",
    "reason_category",
)
_REDACTION_PATTERNS = (
    (
        re.compile(
            r"(?i)\b(authorization|proxy-authorization)\s*[:=]\s*(?:bearer\s+)?[^\s,;]+"
        ),
        r"\1=[REDACTED]",
    ),
    (
        re.compile(
            r"(?i)\b(password|passwd|secret|token|api[_-]?key|cookie|set-cookie)"
            r"\s*[:=]\s*['\"]?[^'\"\s,;]+"
        ),
        r"\1=[REDACTED]",
    ),
    (
        re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+"),
        "Bearer [REDACTED]",
    ),
    (
        re.compile(r"\b[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
        "[REDACTED_EMAIL]",
    ),
    (
        re.compile(r"(?i)(redis|postgres(?:ql)?|smtp)://[^@\s/]+@"),
        r"\1://[REDACTED]@",
    ),
)
_YFINANCE_FX_NO_DATA_PATTERN = re.compile(
    r"\$(?P<symbol>[A-Z]{6}=X): possibly delisted; no price data found"
)
_YFINANCE_FX_NO_DATA_LOG_INTERVAL = timedelta(minutes=10)


def redact_text(value: Any) -> str:
    """Remove common credential and personal-data forms from rendered log text."""
    text = str(value)
    for pattern, replacement in _REDACTION_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


class ContextFilter(logging.Filter):
    """Attach current request/task context without changing call sites."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not getattr(record, "request_id", None):
            record.request_id = request_id_var.get()
        if not getattr(record, "task_name", None):
            record.task_name = task_name_var.get()
        return True


class YFinanceNoiseFilter(logging.Filter):
    """Throttle expected yfinance FX fallback noise while keeping visibility."""

    def __init__(self, interval: timedelta = _YFINANCE_FX_NO_DATA_LOG_INTERVAL) -> None:
        super().__init__()
        self.interval = interval
        self._last_seen: dict[str, datetime] = {}

    def filter(self, record: logging.LogRecord) -> bool:
        if record.name != "yfinance":
            return True
        match = _YFINANCE_FX_NO_DATA_PATTERN.search(record.getMessage())
        if not match:
            return True

        now = datetime.now(timezone.utc)
        symbol = match.group("symbol")
        last_seen = self._last_seen.get(symbol)
        if last_seen and now - last_seen < self.interval:
            return False

        self._last_seen[symbol] = now
        return True


def _safe_extra(record: logging.LogRecord) -> dict[str, Any]:
    extra: dict[str, Any] = {}
    for key, value in record.__dict__.items():
        if key in _STANDARD_RECORD_FIELDS or key.startswith("_") or value is None:
            continue
        if key in _CONTEXT_FIELDS:
            extra[key] = value
    return extra


class JsonFormatter(logging.Formatter):
    """Compact JSON formatter suitable for container log ingestion."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": redact_text(record.getMessage()),
        }
        payload.update(_safe_extra(record))
        if record.exc_info:
            payload["exception"] = redact_text(self.formatException(record.exc_info))
        return json.dumps(payload, ensure_ascii=False, default=str, separators=(",", ":"))


class ReadableFormatter(logging.Formatter):
    """Readable development formatter with optional request/task context."""

    def format(self, record: logging.LogRecord) -> str:
        timestamp = datetime.fromtimestamp(record.created).astimezone().isoformat(timespec="milliseconds")
        context = _safe_extra(record)
        rendered_context = " ".join(f"{key}={value}" for key, value in context.items())
        message = redact_text(record.getMessage())
        rendered = f"{timestamp} | {record.levelname:<8} | {record.name} | {message}"
        if rendered_context:
            rendered = f"{rendered} | {rendered_context}"
        if record.exc_info:
            rendered = f"{rendered}\n{redact_text(self.formatException(record.exc_info))}"
        return rendered


def configure_logging(settings: Any) -> None:
    """Configure root logging once for API, CLI, and Celery processes."""
    environment = str(getattr(settings, "ENVIRONMENT", "development")).lower()
    log_format = str(getattr(settings, "LOG_FORMAT", "auto")).lower()
    if log_format == "auto":
        log_format = "json" if environment in {"production", "staging"} else "readable"

    formatter: logging.Formatter = JsonFormatter() if log_format == "json" else ReadableFormatter()
    context_filter = ContextFilter()
    yfinance_noise_filter = YFinanceNoiseFilter()
    log_level = getattr(logging, str(getattr(settings, "LOG_LEVEL", "INFO")).upper(), logging.INFO)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)
    console_handler.addFilter(context_filter)
    console_handler.addFilter(yfinance_noise_filter)

    handlers: list[logging.Handler] = [console_handler]
    if bool(getattr(settings, "LOG_FILE_ENABLED", environment == "development")):
        log_path = Path(
            getattr(
                settings,
                "LOG_FILE_PATH",
                os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "logs", "app.log"),
            )
        )
        try:
            log_path.parent.mkdir(parents=True, exist_ok=True)
            file_handler = RotatingFileHandler(
                log_path,
                maxBytes=int(getattr(settings, "LOG_FILE_MAX_BYTES", 5 * 1024 * 1024)),
                backupCount=int(getattr(settings, "LOG_FILE_BACKUP_COUNT", 5)),
                encoding="utf-8",
                delay=True,
            )
            file_handler.setLevel(log_level)
            file_handler.setFormatter(formatter)
            file_handler.addFilter(context_filter)
            file_handler.addFilter(yfinance_noise_filter)
            handlers.append(file_handler)
        except OSError as exc:
            print(f"Logging file handler unavailable: {redact_text(exc)}", file=sys.stderr)

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.handlers = handlers

    # Keep third-party HTTP/provider internals from overwhelming application events.
    for logger_name in ("urllib3", "httpx", "httpcore", "yfinance", "peewee"):
        logging.getLogger(logger_name).setLevel(logging.WARNING)
