"""
Tests for stable dashboard cache key generation.
"""
from pathlib import Path
from fnmatch import fnmatch
import subprocess
import sys

import pytest

from app.services.platform.dashboard_cache_keys import build_dashboard_batch_cache_key
from app.services.platform.cache import CacheService


@pytest.mark.unit
class TestDashboardCacheKeys:
    """Verify dashboard cache keys remain stable across call sites and processes."""

    def test_dashboard_batch_cache_key_is_order_independent(self):
        """The same widget set should always produce the same cache key."""
        key_a = build_dashboard_batch_cache_key(
            42,
            ["watchlist", "positions-table", "market-indices"],
        )
        key_b = build_dashboard_batch_cache_key(
            42,
            ["market-indices", "watchlist", "positions-table"],
        )

        assert key_a == key_b
        assert key_a == "dashboard_batch:42:432f881863c90fff8a44b3bea8936101"

    def test_dashboard_batch_cache_key_matches_subprocess(self):
        """A separate Python process should compute the exact same cache key."""
        api_dir = Path(__file__).resolve().parents[1]
        code = (
            "from app.services.platform.dashboard_cache_keys import build_dashboard_batch_cache_key; "
            "print(build_dashboard_batch_cache_key(42, ['watchlist', 'positions-table', 'market-indices']))"
        )

        result = subprocess.run(
            [sys.executable, "-c", code],
            cwd=api_dir,
            capture_output=True,
            text=True,
            check=True,
        )

        assert result.stdout.strip() == build_dashboard_batch_cache_key(
            42,
            ["watchlist", "positions-table", "market-indices"],
        )

    def test_include_sold_uses_a_distinct_cache_entry(self):
        widgets = ["positions-table"]
        assert build_dashboard_batch_cache_key(42, widgets, True) == (
            f"{build_dashboard_batch_cache_key(42, widgets)}:sold"
        )

    def test_portfolio_invalidation_removes_every_dashboard_variant(self, monkeypatch):
        class FakeRedis:
            def __init__(self, keys):
                self.keys = set(keys)

            def scan_iter(self, match, count):
                del count
                return iter([key for key in self.keys if fnmatch(key, match)])

            def delete(self, *keys):
                before = len(self.keys)
                self.keys.difference_update(keys)
                return before - len(self.keys)

        portfolio_keys = {
            build_dashboard_batch_cache_key(42, ["metrics"]),
            build_dashboard_batch_cache_key(42, ["metrics"], True),
            build_dashboard_batch_cache_key(42, ["metrics", "positions"]),
            build_dashboard_batch_cache_key(42, ["metrics", "positions"], True),
        }
        lock_keys = {f"dashboard_refresh_lock:{key}" for key in portfolio_keys}
        other_portfolio = build_dashboard_batch_cache_key(99, ["metrics"])
        redis = FakeRedis(portfolio_keys | lock_keys | {other_portfolio})
        monkeypatch.setattr("app.services.platform.cache.get_redis", lambda: redis)

        CacheService.invalidate_portfolio(42)

        assert not (portfolio_keys | lock_keys) & redis.keys
        assert other_portfolio in redis.keys
