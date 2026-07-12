"""
Tests for notification threshold utilities
"""
import pytest
from decimal import Decimal

from app.models import Asset, AssetClass
from app.utils.notification_thresholds import get_daily_change_threshold, get_threshold_description


def test_crypto_threshold():
    """Test that crypto assets get 8% threshold"""
    asset = Asset(
        symbol="BTC",
        name="Bitcoin",
        class_=AssetClass.CRYPTO
    )
    threshold = get_daily_change_threshold(asset)
    assert threshold == Decimal("8.0")


def test_etf_threshold():
    """Test that ETFs get 4% threshold"""
    asset = Asset(
        symbol="SPY",
        name="SPDR S&P 500",
        class_=AssetClass.ETF
    )
    threshold = get_daily_change_threshold(asset)
    assert threshold == Decimal("4.0")


def test_mega_cap_threshold():
    """Test that mega-cap stocks (>$200B) get 3% threshold"""
    asset = Asset(
        symbol="AAPL",
        name="Apple Inc",
        class_=AssetClass.STOCK
    )
    # Mega cap: >$200B
    threshold = get_daily_change_threshold(asset, market_cap=300e9)
    assert threshold == Decimal("3.0")


def test_large_cap_threshold():
    """Test that large-cap stocks ($10B-$200B) get 4% threshold"""
    asset = Asset(
        symbol="NVDA",
        name="NVIDIA",
        class_=AssetClass.STOCK
    )
    # Large cap: $50B
    threshold = get_daily_change_threshold(asset, market_cap=50e9)
    assert threshold == Decimal("4.0")


def test_mid_cap_threshold():
    """Test that mid-cap stocks ($2B-$10B) get 5% threshold"""
    asset = Asset(
        symbol="MID",
        name="Mid Cap Stock",
        class_=AssetClass.STOCK
    )
    # Mid cap: $5B
    threshold = get_daily_change_threshold(asset, market_cap=5e9)
    assert threshold == Decimal("5.0")


def test_small_cap_threshold():
    """Test that small-cap stocks ($300M-$2B) get 7% threshold"""
    asset = Asset(
        symbol="SMALL",
        name="Small Cap Stock",
        class_=AssetClass.STOCK
    )
    # Small cap: $1B
    threshold = get_daily_change_threshold(asset, market_cap=1e9)
    assert threshold == Decimal("7.0")


def test_micro_cap_threshold():
    """Test that micro-cap stocks (<$300M) get 10% threshold"""
    asset = Asset(
        symbol="MICRO",
        name="Micro Cap Stock",
        class_=AssetClass.STOCK
    )
    # Micro cap: $100M
    threshold = get_daily_change_threshold(asset, market_cap=100e6)
    assert threshold == Decimal("10.0")


def test_no_market_cap_defaults_to_5():
    """Test that stocks without market cap data get 5% default threshold"""
    asset = Asset(
        symbol="UNKNOWN",
        name="Unknown Stock",
        class_=AssetClass.STOCK
    )
    threshold = get_daily_change_threshold(asset, market_cap=None)
    assert threshold == Decimal("5.0")


def test_threshold_descriptions():
    """Test that threshold descriptions are accurate"""
    assert "Micro-cap" in get_threshold_description(Decimal("10.0"))
    assert "Small-cap" in get_threshold_description(Decimal("7.0"))
    assert "Mid-cap" in get_threshold_description(Decimal("5.0"))
    assert "Large-cap" in get_threshold_description(Decimal("4.0"))
    assert "Mega-cap" in get_threshold_description(Decimal("3.0"))
