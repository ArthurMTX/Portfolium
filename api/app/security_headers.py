"""Security response headers for browser-facing API traffic."""
from __future__ import annotations

from typing import Any

from starlette.requests import Request

from app.config import settings
from app.utils.client_ip import get_request_scheme


class SecurityHeadersMiddleware:
    """Add a conservative browser security baseline without changing responses."""

    def __init__(self, app: Any):
        self.app = app

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope["type"] != "http" or not settings.SECURITY_HEADERS_ENABLED:
            await self.app(scope, receive, send)
            return

        request = Request(scope)

        async def send_with_security_headers(message: dict[str, Any]) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.extend(
                    [
                        (b"content-security-policy", settings.CONTENT_SECURITY_POLICY.encode("latin-1")),
                        (b"x-frame-options", b"DENY"),
                        (b"x-content-type-options", b"nosniff"),
                        (b"referrer-policy", b"strict-origin-when-cross-origin"),
                        (
                            b"permissions-policy",
                            b"camera=(), microphone=(), geolocation=(), payment=(), usb=()",
                        ),
                    ]
                )
                if get_request_scheme(
                    request,
                    trusted_proxy_values=settings.TRUSTED_PROXY_IPS,
                ) == "https":
                    headers.append(
                        (
                            b"strict-transport-security",
                            f"max-age={settings.HSTS_MAX_AGE_SECONDS}".encode("ascii"),
                        )
                    )
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_security_headers)
