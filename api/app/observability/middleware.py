"""ASGI request correlation, access logging, and HTTP metrics."""
from __future__ import annotations

import logging
import re
import time
import uuid
from typing import Any

from app.observability.context import reset_request_id, set_request_id
from app.observability.metrics import HTTP_DURATION, HTTP_ERRORS, HTTP_REQUESTS


logger = logging.getLogger("portfolium.http")
_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,128}$")


def _request_id(headers: list[tuple[bytes, bytes]]) -> str:
    for name, value in headers:
        if name.lower() == b"x-request-id":
            candidate = value.decode("latin-1").strip()
            if _REQUEST_ID_PATTERN.fullmatch(candidate):
                return candidate
    return uuid.uuid4().hex


def _route_template(scope: dict[str, Any]) -> str:
    route = scope.get("route")
    path = getattr(route, "path", None)
    if path:
        return str(path)
    return "unmatched"


class ObservabilityMiddleware:
    """Pure ASGI middleware so streaming responses keep correct status handling."""

    def __init__(self, app: Any):
        self.app = app

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = _request_id(scope.get("headers", []))
        token = set_request_id(request_id)
        method = scope.get("method", "UNKNOWN")
        started = time.monotonic()
        status_code = 500
        response_bytes = 0

        async def send_with_context(message: dict[str, Any]) -> None:
            nonlocal status_code, response_bytes
            if message["type"] == "http.response.start":
                status_code = int(message["status"])
                headers = list(message.get("headers", []))
                headers.append((b"x-request-id", request_id.encode("ascii")))
                process_time_ms = round((time.monotonic() - started) * 1000, 2)
                headers.append(
                    (b"x-process-time-ms", str(process_time_ms).encode("ascii"))
                )
                message["headers"] = headers
            elif message["type"] == "http.response.body":
                response_bytes += len(message.get("body", b""))
            await send(message)

        try:
            await self.app(scope, receive, send_with_context)
        except Exception:
            duration_ms = round((time.monotonic() - started) * 1000, 2)
            route = _route_template(scope)
            if route != "/metrics":
                HTTP_REQUESTS.labels(method=method, route=route, status_code="500").inc()
                HTTP_DURATION.labels(method=method, route=route).observe(duration_ms / 1000)
                HTTP_ERRORS.labels(method=method, route=route, status_class="5xx").inc()
                logger.exception(
                    "Unhandled request exception",
                    extra={
                        "event": "http_request_failed",
                        "request_id": request_id,
                        "route": route,
                        "method": method,
                        "status_code": 500,
                        "duration_ms": duration_ms,
                    },
                )
            raise
        else:
            duration_ms = round((time.monotonic() - started) * 1000, 2)
            route = _route_template(scope)
            if route != "/metrics":
                status = str(status_code)
                HTTP_REQUESTS.labels(method=method, route=route, status_code=status).inc()
                HTTP_DURATION.labels(method=method, route=route).observe(duration_ms / 1000)
                if status_code >= 400:
                    HTTP_ERRORS.labels(
                        method=method,
                        route=route,
                        status_class=f"{status_code // 100}xx",
                    ).inc()
                log_method = logger.warning if status_code >= 500 else logger.info
                log_method(
                    "HTTP request completed",
                    extra={
                        "event": "http_request_completed",
                        "request_id": request_id,
                        "route": route,
                        "method": method,
                        "status_code": status_code,
                        "duration_ms": duration_ms,
                        "response_bytes": response_bytes,
                    },
                )
        finally:
            reset_request_id(token)
