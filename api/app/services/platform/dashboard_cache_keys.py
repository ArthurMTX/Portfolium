"""
Stable cache key helpers for dashboard batch responses.

Python's built-in ``hash()`` is randomized between processes, which breaks
shared Redis cache keys across API and Celery workers. These helpers use a
deterministic digest instead.
"""
from hashlib import sha256
from typing import Iterable, Tuple


_DASHBOARD_BATCH_PREFIX = "dashboard_batch"
_DASHBOARD_WIDGET_DIGEST_LENGTH = 32


def normalize_dashboard_widget_ids(widget_ids: Iterable[str]) -> Tuple[str, ...]:
    """Return widget IDs in a deterministic order for cache key generation."""
    return tuple(sorted(widget_ids))


def build_dashboard_batch_cache_key(
    portfolio_id: int, widget_ids: Iterable[str], include_sold: bool = False
) -> str:
    """Build a stable Redis cache key for dashboard batch payloads."""
    normalized_widget_ids = normalize_dashboard_widget_ids(widget_ids)
    widget_key = ",".join(normalized_widget_ids)
    digest = sha256(widget_key.encode("utf-8")).hexdigest()[:_DASHBOARD_WIDGET_DIGEST_LENGTH]
    sold_suffix = ":sold" if include_sold else ""
    return f"{_DASHBOARD_BATCH_PREFIX}:{portfolio_id}:{digest}{sold_suffix}"
