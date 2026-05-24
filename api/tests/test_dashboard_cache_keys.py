"""
Tests for stable dashboard cache key generation.
"""
from pathlib import Path
import subprocess
import sys

import pytest

from app.services.dashboard_cache_keys import build_dashboard_batch_cache_key


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
            "from app.services.dashboard_cache_keys import build_dashboard_batch_cache_key; "
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
