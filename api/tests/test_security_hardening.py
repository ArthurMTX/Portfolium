from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.security_headers import SecurityHeadersMiddleware
from app.services.platform.analytics_cache import _calculate_fingerprint
from app.services.platform.cache import CacheService
from app.services.security import rate_limit
from app.utils.client_ip import get_request_scheme


def _request(
    *,
    client: tuple[str, int] = ("203.0.113.10", 1234),
    scheme: str = "http",
    headers: list[tuple[bytes, bytes]] | None = None,
) -> Request:
    return Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "POST",
            "scheme": scheme,
            "path": "/auth/login",
            "raw_path": b"/auth/login",
            "query_string": b"",
            "headers": headers or [],
            "client": client,
            "server": ("testserver", 80),
        }
    )


def test_auth_rate_limit_uses_local_fallback(monkeypatch):
    rate_limit.reset_local_rate_limits()
    monkeypatch.setattr(rate_limit, "get_redis", lambda: None)
    monkeypatch.setattr(rate_limit.time, "time", lambda: 1_000)

    request = _request()
    for _ in range(2):
        rate_limit.enforce_auth_rate_limit(
            request,
            scope="test_login",
            limit=2,
            window_seconds=60,
        )

    with pytest.raises(HTTPException) as exc_info:
        rate_limit.enforce_auth_rate_limit(
            request,
            scope="test_login",
            limit=2,
            window_seconds=60,
        )

    assert exc_info.value.status_code == 429
    assert exc_info.value.headers["Retry-After"] == "20"


def test_forwarded_https_is_trusted_only_for_configured_proxy():
    forwarded_headers = [(b"x-forwarded-proto", b"https")]

    trusted_request = _request(
        client=("172.18.0.4", 1234),
        headers=forwarded_headers,
    )
    assert get_request_scheme(trusted_request, ["172.16.0.0/12"]) == "https"

    untrusted_request = _request(headers=forwarded_headers)
    assert get_request_scheme(untrusted_request, ["172.16.0.0/12"]) == "http"


@pytest.mark.asyncio
async def test_security_headers_include_hsts_only_for_verified_https(monkeypatch):
    async def downstream(scope, receive, send):
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    monkeypatch.setattr(
        "app.security_headers.settings.TRUSTED_PROXY_IPS",
        ["172.16.0.0/12"],
    )
    middleware = SecurityHeadersMiddleware(downstream)
    sent = []

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        sent.append(message)

    request = _request(
        client=("172.18.0.4", 1234),
        headers=[(b"x-forwarded-proto", b"https")],
    )
    await middleware(request.scope, receive, send)

    headers = dict(sent[0]["headers"])
    assert headers[b"content-security-policy"]
    assert headers[b"x-frame-options"] == b"DENY"
    assert headers[b"x-content-type-options"] == b"nosniff"
    assert headers[b"strict-transport-security"].startswith(b"max-age=")


def test_cache_pattern_deletion_uses_scan(monkeypatch):
    class FakeRedis:
        def __init__(self):
            self.deleted = []

        def scan_iter(self, *, match, count):
            assert match == "analytics:*"
            assert count == 500
            yield from ["analytics:1", "analytics:2"]

        def delete(self, *keys):
            self.deleted.extend(keys)
            return len(keys)

        def keys(self, pattern):
            raise AssertionError(f"KEYS must not be used for {pattern}")

    redis = FakeRedis()
    monkeypatch.setattr("app.services.platform.cache.get_redis", lambda: redis)

    assert CacheService.delete_pattern("analytics:*") == 2
    assert redis.deleted == ["analytics:1", "analytics:2"]


def test_analytics_fingerprint_includes_positions_after_first_fifty():
    positions = [
        SimpleNamespace(asset_id=index, quantity=1, current_price=100)
        for index in range(51)
    ]
    original = _calculate_fingerprint(1, positions, "2026-06-20")

    positions[50].current_price = 101
    changed = _calculate_fingerprint(1, positions, "2026-06-20")

    assert changed != original
    assert _calculate_fingerprint(1, list(reversed(positions)), "2026-06-20") == changed
