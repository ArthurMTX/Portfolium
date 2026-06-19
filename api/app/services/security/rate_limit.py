"""Fixed-window rate limiting for sensitive authentication operations."""
from __future__ import annotations

import hashlib
import logging
import threading
import time
from collections import defaultdict
from typing import DefaultDict

from fastapi import HTTPException, Request, status
from redis.exceptions import RedisError

from app.config import settings
from app.redis_client import get_redis
from app.utils.client_ip import get_client_ip


logger = logging.getLogger(__name__)
_memory_counts: DefaultDict[tuple[str, str, int], int] = defaultdict(int)
_memory_lock = threading.Lock()
_MAX_MEMORY_KEYS = 10_000


def _identity_digest(identity: str) -> str:
    return hashlib.sha256(identity.encode("utf-8")).hexdigest()[:24]


def _memory_increment(scope: str, identity: str, bucket: int) -> int:
    key = (scope, identity, bucket)
    with _memory_lock:
        if len(_memory_counts) >= _MAX_MEMORY_KEYS:
            stale_keys = [entry for entry in _memory_counts if entry[2] < bucket]
            for stale_key in stale_keys:
                _memory_counts.pop(stale_key, None)
        _memory_counts[key] += 1
        return _memory_counts[key]


def _increment(scope: str, identity: str, limit: int, window_seconds: int) -> tuple[int, int]:
    now = int(time.time())
    bucket = now // window_seconds
    retry_after = window_seconds - (now % window_seconds)
    digest = _identity_digest(identity)
    key = f"rate_limit:{scope}:{digest}:{bucket}"
    redis_client = get_redis()

    if redis_client is not None:
        try:
            pipe = redis_client.pipeline(transaction=True)
            pipe.incr(key)
            pipe.expire(key, window_seconds + 1)
            count, _ = pipe.execute()
            return int(count), retry_after
        except RedisError:
            logger.warning(
                "Redis rate limiter unavailable; using process-local fallback",
                extra={"event": "auth_rate_limit_fallback", "scope": scope},
            )

    return _memory_increment(scope, digest, bucket), retry_after


def enforce_auth_rate_limit(
    request: Request,
    *,
    scope: str,
    limit: int,
    window_seconds: int,
    identity: str | None = None,
) -> None:
    """Reject a sensitive request when its fixed-window allowance is exhausted."""
    if not settings.AUTH_RATE_LIMIT_ENABLED:
        return

    client_ip = get_client_ip(request, trusted_proxy_values=settings.TRUSTED_PROXY_IPS)
    resolved_identity = identity or client_ip or "unknown"
    count, retry_after = _increment(scope, resolved_identity, limit, window_seconds)
    if count <= limit:
        return

    logger.warning(
        "Sensitive endpoint rate limit exceeded",
        extra={"event": "auth_rate_limit_exceeded", "scope": scope},
    )
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Too many requests. Please try again later.",
        headers={"Retry-After": str(retry_after)},
    )


def reset_local_rate_limits() -> None:
    """Clear process-local counters. Intended for isolated tests."""
    with _memory_lock:
        _memory_counts.clear()
