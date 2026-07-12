"""
Exchange calendar utilities for determining trading days based on asset symbols.

Uses the exchange_calendars library to get accurate trading sessions
for different exchanges, properly handling holidays.
"""
import logging
from datetime import date, datetime
from typing import Optional, Set, List
from functools import lru_cache

import exchange_calendars as xcals
import pandas as pd

logger = logging.getLogger(__name__)

# Mapping of Yahoo Finance ticker suffixes to exchange_calendars exchange codes
# See: https://help.yahoo.com/kb/SLN2310.html for Yahoo suffixes
# See: https://github.com/gerrymanoim/exchange_calendars for exchange codes
SUFFIX_TO_EXCHANGE = {
    # European exchanges
    ".PA": "XPAR",      # Euronext Paris
    ".AS": "XAMS",      # Euronext Amsterdam
    ".BR": "XBRU",      # Euronext Brussels
    ".LS": "XLIS",      # Euronext Lisbon
    ".MI": "XMIL",      # Borsa Italiana (Milan)
    ".DE": "XETR",      # Deutsche Börse (Xetra)
    ".F": "XFRA",       # Frankfurt Stock Exchange
    ".SW": "XSWX",      # SIX Swiss Exchange
    ".L": "XLON",       # London Stock Exchange
    ".MC": "XMAD",      # Bolsa de Madrid
    ".VI": "XWBO",      # Wiener Börse (Vienna)
    ".CO": "XCSE",      # Nasdaq Copenhagen
    ".ST": "XSTO",      # Nasdaq Stockholm
    ".HE": "XHEL",      # Nasdaq Helsinki
    ".OL": "XOSL",      # Oslo Stock Exchange
    ".IR": "XDUB",      # Irish Stock Exchange
    ".WA": "XWAR",      # Warsaw Stock Exchange
    ".PR": "XPRA",      # Prague Stock Exchange
    ".BD": "XBUD",      # Budapest Stock Exchange
    
    # North American exchanges
    ".TO": "XTSE",      # Toronto Stock Exchange
    ".V": "XTSX",       # TSX Venture Exchange
    ".MX": "XMEX",      # Mexican Stock Exchange
    
    # Asian exchanges
    ".T": "XTKS",       # Tokyo Stock Exchange
    ".HK": "XHKG",      # Hong Kong Stock Exchange
    ".SS": "XSHG",      # Shanghai Stock Exchange
    ".SZ": "XSHG",      # Shenzhen Stock Exchange (using Shanghai calendar)
    ".KS": "XKRX",      # Korea Stock Exchange
    ".KQ": "XKRX",      # KOSDAQ (using Korea calendar)
    ".TW": "XTAI",      # Taiwan Stock Exchange
    ".SI": "XSES",      # Singapore Exchange
    ".BK": "XBKK",      # Stock Exchange of Thailand
    ".KL": "XKLS",      # Bursa Malaysia
    ".JK": "XIDX",      # Indonesia Stock Exchange
    ".BO": "XBOM",      # Bombay Stock Exchange
    ".NS": "XBOM",      # National Stock Exchange India
    
    # Oceania
    ".AX": "XASX",      # Australian Securities Exchange
    ".NZ": "XNZE",      # New Zealand Exchange
    
    # South America
    ".SA": "BVMF",      # B3 (Brazil)
    ".SN": "XSGO",      # Santiago Stock Exchange
    ".BA": "XBUE",      # Buenos Aires Stock Exchange
    
    # Middle East / Africa
    ".TA": "XTAE",      # Tel Aviv Stock Exchange
    ".JO": "XJSE",      # Johannesburg Stock Exchange
    ".SR": "XSAU",      # Saudi Stock Exchange (Tadawul)
    
    # Interactive Brokers / Other
    ".XC": "XTSE",      # Canadian (via IBKR) - use Toronto
}

# Crypto suffixes - these trade 24/7
CRYPTO_SUFFIXES = {"-USD", "-EUR", "-GBP", "-BTC", "-USDT"}

# Default exchange for US stocks (no suffix)
DEFAULT_EXCHANGE = "XNYS"  # NYSE


@lru_cache(maxsize=32)
def _get_calendar(exchange_code: str) -> Optional[xcals.ExchangeCalendar]:
    """Get cached exchange calendar by code."""
    try:
        return xcals.get_calendar(exchange_code)
    except Exception as e:
        logger.warning(f"Failed to get calendar for {exchange_code}: {e}")
        return None


def get_exchange_code(symbol: str) -> Optional[str]:
    """
    Get the exchange_calendars exchange code for a given symbol.
    
    Args:
        symbol: Asset symbol (e.g., "CL2.PA", "AAPL", "BTC-USD")
        
    Returns:
        Exchange code (e.g., "XPAR", "XNYS") or None for crypto
    """
    # Check for crypto
    for suffix in CRYPTO_SUFFIXES:
        if symbol.endswith(suffix):
            return None  # Crypto trades 24/7
    
    # Check for known suffixes
    for suffix, exchange in SUFFIX_TO_EXCHANGE.items():
        if symbol.endswith(suffix):
            return exchange
    
    # No suffix = US stock
    if "." not in symbol and "-" not in symbol:
        return DEFAULT_EXCHANGE
    
    # Unknown suffix
    logger.debug(f"Unknown suffix for symbol {symbol}, using NYSE calendar")
    return DEFAULT_EXCHANGE


def get_trading_sessions(
    symbol: str,
    start_date: date,
    end_date: date
) -> Set[date]:
    """
    Get all valid trading sessions for an asset between two dates.
    
    For stocks, uses the exchange calendar to get actual trading days.
    For crypto, returns all days (24/7 trading).
    
    Args:
        symbol: Asset symbol
        start_date: Start date (inclusive)
        end_date: End date (inclusive)
        
    Returns:
        Set of dates that are valid trading days
    """
    exchange_code = get_exchange_code(symbol)
    
    # Crypto trades 24/7
    if exchange_code is None:
        sessions = set()
        current = start_date
        while current <= end_date:
            sessions.add(current)
            current = current + pd.Timedelta(days=1)
        return sessions
    
    # Get exchange calendar
    calendar = _get_calendar(exchange_code)
    if calendar is None:
        # Fall back to weekdays only
        logger.warning(f"No calendar for {exchange_code}, using weekdays only")
        sessions = set()
        current = start_date
        while current <= end_date:
            if current.weekday() < 5:
                sessions.add(current)
            current = current + pd.Timedelta(days=1)
        return sessions
    
    # Get trading sessions from calendar
    try:
        # Convert to string format for exchange_calendars
        start_str = start_date.isoformat()
        end_str = end_date.isoformat()
        
        sessions_idx = calendar.sessions_in_range(start_str, end_str)
        return set(s.date() for s in sessions_idx)
    except Exception as e:
        logger.error(f"Error getting sessions for {symbol}: {e}")
        # Fall back to weekdays
        sessions = set()
        current = start_date
        while current <= end_date:
            if current.weekday() < 5:
                sessions.add(current)
            current = current + pd.Timedelta(days=1)
        return sessions


def is_trading_day(symbol: str, check_date: date) -> bool:
    """
    Check if a specific date is a trading day for the given symbol.
    
    Args:
        symbol: Asset symbol
        check_date: Date to check
        
    Returns:
        True if the date is a trading day
    """
    exchange_code = get_exchange_code(symbol)
    
    # Crypto trades 24/7
    if exchange_code is None:
        return True
    
    calendar = _get_calendar(exchange_code)
    if calendar is None:
        # Fall back to weekday check
        return check_date.weekday() < 5
    
    try:
        return calendar.is_session(check_date.isoformat())
    except Exception as e:
        logger.error(f"Error checking trading day for {symbol} on {check_date}: {e}")
        return check_date.weekday() < 5


def get_missing_trading_days(
    symbol: str,
    start_date: date,
    end_date: date,
    existing_dates: Set[date]
) -> List[date]:
    """
    Get list of trading days that are missing price data.
    
    Args:
        symbol: Asset symbol
        start_date: Start date (inclusive)
        end_date: End date (inclusive)
        existing_dates: Set of dates that have price data
        
    Returns:
        Sorted list of missing trading days
    """
    expected_sessions = get_trading_sessions(symbol, start_date, end_date)
    missing = expected_sessions - existing_dates
    return sorted(missing)


def calculate_coverage(
    symbol: str,
    start_date: date,
    end_date: date,
    price_dates: Set[date]
) -> dict:
    """
    Calculate price data coverage for an asset.
    
    Args:
        symbol: Asset symbol
        start_date: Start date (inclusive)
        end_date: End date (inclusive)
        price_dates: Set of dates that have price data
        
    Returns:
        Dict with coverage statistics:
        - expected_trading_days: Number of expected trading sessions
        - actual_data_points: Number of days with price data
        - coverage_pct: Coverage percentage
        - missing_days: List of missing trading days
    """
    expected_sessions = get_trading_sessions(symbol, start_date, end_date)
    
    # Only count prices that fall on expected trading days
    actual_on_trading_days = price_dates.intersection(expected_sessions)
    missing = expected_sessions - price_dates
    
    expected_count = len(expected_sessions)
    actual_count = len(actual_on_trading_days)
    
    coverage_pct = (actual_count / expected_count * 100) if expected_count > 0 else 100.0
    
    return {
        "expected_trading_days": expected_count,
        "actual_data_points": actual_count,
        "coverage_pct": round(coverage_pct, 2),
        "missing_days": sorted(missing),
        "exchange": get_exchange_code(symbol) or "24/7"
    }
