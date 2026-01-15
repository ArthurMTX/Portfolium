"""
Utility functions for determining notification thresholds based on asset characteristics
"""
from decimal import Decimal
from typing import Optional
import logging

from app.models import Asset, AssetClass

logger = logging.getLogger(__name__)


def get_daily_change_threshold(
    asset: Asset,
    market_cap: Optional[float] = None
) -> Decimal:
    """
    Determine the appropriate daily change threshold for an asset based on its
    characteristics (market cap, asset class, etc.)
    
    Different assets have different volatility profiles:
    - Large cap stocks: Lower threshold (3-4%)
    - Small cap stocks: Higher threshold (7-10%)
    - Crypto: Higher threshold (8%)
    - ETFs: Lower threshold (4%)
    
    Args:
        asset: The asset to determine threshold for
        market_cap: Optional market capitalization (can be fetched dynamically)
        
    Returns:
        Decimal representing the threshold percentage
    """
    try:
        # Crypto assets are more volatile
        if asset.class_ == AssetClass.CRYPTO:
            return Decimal("8.0")
        
        # ETFs are generally less volatile
        if asset.class_ == AssetClass.ETF:
            return Decimal("4.0")
        
        # For stocks, use market cap to determine threshold
        if asset.class_ == AssetClass.STOCK:
            # If no market cap provided, try to fetch it
            if market_cap is None:
                market_cap = _fetch_market_cap(asset.symbol)
            
            # If still no market cap, use a moderate default
            if market_cap is None:
                return Decimal("5.0")
            
            # Mega cap (>$200B): 3% - These move markets, so even small moves are significant
            if market_cap >= 200e9:
                return Decimal("3.0")
            
            # Large cap ($10B-$200B): 4%
            elif market_cap >= 10e9:
                return Decimal("4.0")
            
            # Mid cap ($2B-$10B): 5%
            elif market_cap >= 2e9:
                return Decimal("5.0")
            
            # Small cap ($300M-$2B): 7% - More volatile
            elif market_cap >= 300e6:
                return Decimal("7.0")
            
            # Micro cap (<$300M): 10% - Very volatile
            else:
                return Decimal("10.0")
        
        # Default for any other asset class
        return Decimal("5.0")
        
    except Exception as e:
        logger.warning(f"Error determining threshold for {asset.symbol}: {e}")
        return Decimal("5.0")


def _fetch_market_cap(symbol: str) -> Optional[float]:
    """
    Fetch market cap for a symbol from yfinance
    
    Args:
        symbol: The stock symbol
        
    Returns:
        Market cap as float or None if unavailable
    """
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        info = ticker.info
        return info.get('marketCap')
    except Exception as e:
        logger.debug(f"Could not fetch market cap for {symbol}: {e}")
        return None


def get_threshold_description(threshold: Decimal) -> str:
    """
    Get a human-readable description of why a threshold was chosen
    
    Args:
        threshold: The threshold percentage
        
    Returns:
        Description string
    """
    threshold_float = float(threshold)
    
    if threshold_float >= 10:
        return "Micro-cap stock (high volatility expected)"
    elif threshold_float >= 7:
        return "Small-cap stock (moderate-high volatility)"
    elif threshold_float >= 5:
        return "Mid-cap stock or standard threshold"
    elif threshold_float >= 4:
        return "Large-cap stock or ETF (lower volatility)"
    elif threshold_float >= 3:
        return "Mega-cap stock (market-moving significance)"
    else:
        return "Custom threshold"
