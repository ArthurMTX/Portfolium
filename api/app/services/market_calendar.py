"""
Market Calendar Service

Uses exchange-calendars library to provide accurate market holidays and trading days
for various stock exchanges worldwide.

Supported exchanges include:
- XNYS (NYSE - New York Stock Exchange)
- XNAS (NASDAQ)
- XETR (XETRA - Frankfurt)
- XLON (London Stock Exchange)
- XPAR (Euronext Paris)
- XAMS (Euronext Amsterdam)
- XTKS (Tokyo Stock Exchange)
- And 50+ more...
"""

import logging
from datetime import date, datetime, timedelta
from typing import List, Dict, Optional, Set
from functools import lru_cache

import exchange_calendars as xcals
import pandas as pd

logger = logging.getLogger(__name__)

# Map common currency/region to primary exchange
CURRENCY_TO_EXCHANGE = {
    "USD": "XNYS",   # NYSE for US
    "EUR": "XETR",   # XETRA for Eurozone
    "GBP": "XLON",   # London for UK
    "JPY": "XTKS",   # Tokyo for Japan
    "CHF": "XSWX",   # SIX Swiss Exchange
    "CAD": "XTSE",   # Toronto Stock Exchange
    "AUD": "XASX",   # Australian Securities Exchange
    "HKD": "XHKG",   # Hong Kong Stock Exchange
    "CNY": "XSHG",   # Shanghai Stock Exchange
    "KRW": "XKRX",   # Korea Exchange
    "INR": "XBOM",   # Bombay Stock Exchange
    "BRL": "BVMF",   # B3 - Brasil Bolsa Balcão
    "SEK": "XSTO",   # Stockholm Stock Exchange
    "NOK": "XOSL",   # Oslo Stock Exchange
    "DKK": "XCSE",   # Copenhagen Stock Exchange
}

# Human-readable exchange names for UI display
EXCHANGE_DISPLAY_NAMES = {
    "XNYS": "NYSE",
    "XNAS": "NASDAQ",
    "XETR": "Frankfurt",
    "XLON": "London",
    "XPAR": "Paris",
    "XAMS": "Amsterdam",
    "XTKS": "Tokyo",
    "XSWX": "Zurich",
    "XTSE": "Toronto",
    "XASX": "Sydney",
    "XHKG": "Hong Kong",
    "XSHG": "Shanghai",
    "XKRX": "Seoul",
    "XBOM": "Mumbai",
    "BVMF": "São Paulo",
    "XSTO": "Stockholm",
    "XOSL": "Oslo",
    "XCSE": "Copenhagen",
    "XMIL": "Milan",
    "XBRU": "Brussels",
    "XMAD": "Madrid",
    "XSIN": "Singapore",
    "XTAI": "Taipei",
    "XJSE": "Johannesburg",
    "XMEX": "Mexico City",
    "XWAR": "Warsaw",
    "XIST": "Istanbul",
    "XNZE": "Wellington",
    "XDUB": "Dublin",
    "XHEL": "Helsinki",
    "XLIS": "Lisbon",
    "XWIE": "Vienna",
    "XPRA": "Prague",
    "XBUD": "Budapest",
}

# Default to NYSE if currency not found
DEFAULT_EXCHANGE = "XNYS"


class MarketCalendarService:
    """Service for market calendar operations using exchange-calendars library."""
    
    @staticmethod
    def get_exchange_display_name(exchange_code: str) -> str:
        """Get human-readable name for an exchange code."""
        return EXCHANGE_DISPLAY_NAMES.get(exchange_code, exchange_code)
    
    @staticmethod
    def get_exchange_display_names(exchange_codes: List[str]) -> Dict[str, str]:
        """Get a mapping of exchange codes to their display names."""
        return {code: EXCHANGE_DISPLAY_NAMES.get(code, code) for code in exchange_codes}
    
    @staticmethod
    @lru_cache(maxsize=32)
    def get_calendar(exchange_code: str):
        """
        Get a calendar instance for the specified exchange.
        Results are cached for performance.
        """
        try:
            return xcals.get_calendar(exchange_code)
        except Exception as e:
            logger.warning(f"Failed to get calendar for {exchange_code}: {e}, falling back to NYSE")
            return xcals.get_calendar(DEFAULT_EXCHANGE)
    
    @classmethod
    def get_exchange_for_currency(cls, currency: str) -> str:
        """Get the primary exchange code for a currency."""
        return CURRENCY_TO_EXCHANGE.get(currency.upper(), DEFAULT_EXCHANGE)
    
    @classmethod
    def _build_holiday_name_map(cls, calendar, start_date: date, end_date: date) -> Dict[date, str]:
        """
        Build a mapping of holiday dates to their names.
        """
        holiday_names: Dict[date, str] = {}
        
        try:
            # Get regular holidays
            if calendar.regular_holidays:
                for rule in calendar.regular_holidays.rules:
                    try:
                        # Get dates for this rule in the range
                        dates = rule.dates(
                            start_date.strftime('%Y-%m-%d'), 
                            end_date.strftime('%Y-%m-%d')
                        )
                        for d in dates:
                            hd = d.date() if hasattr(d, 'date') else d
                            # Ensure hd is a date object before comparison
                            if isinstance(hd, date) and start_date <= hd <= end_date:
                                holiday_names[hd] = rule.name
                    except Exception:
                        continue
            
            # Also check adhoc_holidays (one-off holidays)
            if hasattr(calendar, 'adhoc_holidays') and calendar.adhoc_holidays:
                for adhoc_date in calendar.adhoc_holidays:
                    hd = adhoc_date.date() if hasattr(adhoc_date, 'date') else adhoc_date
                    # Ensure hd is a date object before comparison
                    if isinstance(hd, date) and start_date <= hd <= end_date and hd not in holiday_names:
                        holiday_names[hd] = "Special Holiday"
                        
        except Exception as e:
            logger.warning(f"Error building holiday name map: {e}")
        
        return holiday_names
    
    @classmethod
    def get_holidays(
        cls,
        start_date: date,
        end_date: date,
        exchange_code: Optional[str] = None,
        currency: Optional[str] = None
    ) -> List[Dict]:
        """
        Get market holidays for a date range.
        Holidays are weekdays when the market is closed.
        
        Args:
            start_date: Start of date range
            end_date: End of date range
            exchange_code: Exchange code (e.g., 'XNYS', 'XETR')
            currency: Currency code to determine exchange (used if exchange_code not provided)
        
        Returns:
            List of holiday dicts with date and name
        """
        if not exchange_code:
            exchange_code = cls.get_exchange_for_currency(currency or "USD")
        
        try:
            calendar = cls.get_calendar(exchange_code)
            
            # Get all trading sessions in the range
            sessions = calendar.sessions_in_range(
                start_date.strftime('%Y-%m-%d'),
                end_date.strftime('%Y-%m-%d')
            )
            sessions_set = set(s.date() for s in sessions)
            
            # Get all business days (weekdays) in the range
            all_business_days = pd.date_range(start_date, end_date, freq='B')
            
            # Holidays are weekdays that aren't trading sessions
            holiday_dates = [d.date() for d in all_business_days if d.date() not in sessions_set]
            
            # Get holiday names
            holiday_names = cls._build_holiday_name_map(calendar, start_date, end_date)
            
            # Build result
            result = []
            for hd in holiday_dates:
                result.append({
                    "date": hd.isoformat(),
                    "name": holiday_names.get(hd, "Market Holiday"),
                    "exchange": exchange_code
                })
            
            return sorted(result, key=lambda x: x["date"])
            
        except Exception as e:
            logger.error(f"Failed to get holidays for {exchange_code}: {e}")
            return []
    
    @classmethod
    def is_trading_day(
        cls,
        check_date: date,
        exchange_code: Optional[str] = None,
        currency: Optional[str] = None
    ) -> bool:
        """
        Check if a specific date is a trading day.
        
        Args:
            check_date: Date to check
            exchange_code: Exchange code
            currency: Currency code (used if exchange_code not provided)
        
        Returns:
            True if it's a trading day, False otherwise
        """
        if not exchange_code:
            exchange_code = cls.get_exchange_for_currency(currency or "USD")
        
        try:
            calendar = cls.get_calendar(exchange_code)
            # Convert to timestamp for exchange-calendars
            ts = datetime.combine(check_date, datetime.min.time())
            return calendar.is_session(ts)
        except Exception as e:
            logger.warning(f"Failed to check trading day for {exchange_code}: {e}")
            # Default to weekday check
            return check_date.weekday() < 5
    
    @classmethod
    def get_closed_dates(
        cls,
        start_date: date,
        end_date: date,
        exchange_code: Optional[str] = None,
        currency: Optional[str] = None
    ) -> Set[str]:
        """
        Get all closed dates (weekends + holidays) as a set of ISO date strings.
        This is optimized for frontend use.
        
        Args:
            start_date: Start of date range
            end_date: End of date range
            exchange_code: Exchange code
            currency: Currency code (used if exchange_code not provided)
        
        Returns:
            Set of closed date strings in ISO format (YYYY-MM-DD)
        """
        if not exchange_code:
            exchange_code = cls.get_exchange_for_currency(currency or "USD")
        
        try:
            calendar = cls.get_calendar(exchange_code)
            
            closed_dates = set()
            current = start_date
            
            while current <= end_date:
                ts = datetime.combine(current, datetime.min.time())
                if not calendar.is_session(ts):
                    closed_dates.add(current.isoformat())
                current += timedelta(days=1)
            
            return closed_dates
            
        except Exception as e:
            logger.error(f"Failed to get closed dates for {exchange_code}: {e}")
            # Fallback: just return weekends
            closed_dates = set()
            current = start_date
            while current <= end_date:
                if current.weekday() >= 5:  # Saturday = 5, Sunday = 6
                    closed_dates.add(current.isoformat())
                current += timedelta(days=1)
            return closed_dates
    
    @classmethod
    def get_trading_days(
        cls,
        start_date: date,
        end_date: date,
        exchange_code: Optional[str] = None,
        currency: Optional[str] = None
    ) -> List[str]:
        """
        Get all trading days in a date range.
        
        Args:
            start_date: Start of date range
            end_date: End of date range
            exchange_code: Exchange code
            currency: Currency code (used if exchange_code not provided)
        
        Returns:
            List of trading date strings in ISO format (YYYY-MM-DD)
        """
        if not exchange_code:
            exchange_code = cls.get_exchange_for_currency(currency or "USD")
        
        try:
            calendar = cls.get_calendar(exchange_code)
            
            # Get sessions in range
            sessions = calendar.sessions_in_range(
                start_date.strftime('%Y-%m-%d'),
                end_date.strftime('%Y-%m-%d')
            )
            return [s.strftime("%Y-%m-%d") for s in sessions]
            
        except Exception as e:
            logger.error(f"Failed to get trading days for {exchange_code}: {e}")
            return []
    
    @classmethod
    def list_available_exchanges(cls) -> List[Dict]:
        """
        List all available exchanges.
        
        Returns:
            List of exchange info dicts
        """
        exchanges = []
        for code in xcals.get_calendar_names():
            try:
                cal = xcals.get_calendar(code)
                exchanges.append({
                    "code": code,
                    "name": getattr(cal, 'name', code),
                    "timezone": str(cal.tz)
                })
            except Exception:
                continue
        return exchanges
    
    @classmethod
    def get_combined_holidays(
        cls,
        start_date: date,
        end_date: date,
        exchange_codes: List[str]
    ) -> List[Dict]:
        """
        Get combined holidays from multiple exchanges.
        If the same date is a holiday on multiple exchanges, combine the names.
        
        Args:
            start_date: Start of date range
            end_date: End of date range
            exchange_codes: List of exchange codes to check
        
        Returns:
            List of holiday dicts with date, name, and exchanges
        """
        if not exchange_codes:
            exchange_codes = [DEFAULT_EXCHANGE]
        
        # Remove duplicates while preserving order
        exchange_codes = list(dict.fromkeys(exchange_codes))
        
        # Collect all holidays from all exchanges
        holidays_by_date: Dict[str, Dict] = {}
        
        for exchange_code in exchange_codes:
            try:
                holidays = cls.get_holidays(start_date, end_date, exchange_code=exchange_code)
                for h in holidays:
                    date_str = h["date"]
                    if date_str not in holidays_by_date:
                        holidays_by_date[date_str] = {
                            "date": date_str,
                            "names": [h["name"]],
                            "exchanges": [exchange_code]
                        }
                    else:
                        # Add this exchange's name if different
                        if h["name"] not in holidays_by_date[date_str]["names"]:
                            holidays_by_date[date_str]["names"].append(h["name"])
                        if exchange_code not in holidays_by_date[date_str]["exchanges"]:
                            holidays_by_date[date_str]["exchanges"].append(exchange_code)
            except Exception as e:
                logger.warning(f"Failed to get holidays for {exchange_code}: {e}")
                continue
        
        # Convert to list and format names
        result = []
        for date_str, data in holidays_by_date.items():
            # If all names are the same, use just one
            unique_names = list(dict.fromkeys(data["names"]))
            if len(unique_names) == 1:
                name = unique_names[0]
            else:
                name = " / ".join(unique_names)
            
            # Get display names for exchanges
            exchange_display_names = [cls.get_exchange_display_name(ex) for ex in data["exchanges"]]
            
            result.append({
                "date": date_str,
                "name": name,
                "exchanges": data["exchanges"],
                "exchange_names": exchange_display_names
            })
        
        return sorted(result, key=lambda x: x["date"])
    
    @classmethod
    def get_combined_closed_dates(
        cls,
        start_date: date,
        end_date: date,
        exchange_codes: List[str]
    ) -> Set[str]:
        """
        Get all dates that are closed on ANY of the specified exchanges.
        A date is marked as closed if it's closed on at least one exchange.
        
        Args:
            start_date: Start of date range
            end_date: End of date range
            exchange_codes: List of exchange codes to check
        
        Returns:
            Set of closed date strings in ISO format (YYYY-MM-DD)
        """
        if not exchange_codes:
            exchange_codes = [DEFAULT_EXCHANGE]
        
        # Union of all closed dates from all exchanges
        all_closed = set()
        for exchange_code in exchange_codes:
            try:
                closed = cls.get_closed_dates(start_date, end_date, exchange_code=exchange_code)
                all_closed.update(closed)
            except Exception as e:
                logger.warning(f"Failed to get closed dates for {exchange_code}: {e}")
                continue
        
        return all_closed
    @classmethod
    def is_market_open(
        cls,
        exchange_code: Optional[str] = None,
        currency: Optional[str] = None,
        at_time: Optional[datetime] = None
    ) -> bool:
        """
        Check if a market is currently open (or open at a specific time).
        
        Args:
            exchange_code: Exchange code (e.g., 'XNYS', 'XLON')
            currency: Currency code (used if exchange_code not provided)
            at_time: Time to check (defaults to now UTC)
        
        Returns:
            True if the market is currently open for trading
        """
        if not exchange_code:
            exchange_code = cls.get_exchange_for_currency(currency or "USD")
        
        if at_time is None:
            at_time = datetime.utcnow()
        
        try:
            calendar = cls.get_calendar(exchange_code)
            # exchange-calendars uses pandas Timestamp
            ts = pd.Timestamp(at_time, tz='UTC')
            return calendar.is_open_at_time(ts)
        except Exception as e:
            logger.warning(f"Failed to check if {exchange_code} is open: {e}")
            # Fallback: assume closed on weekends, open weekdays 9-17 UTC
            if at_time.weekday() >= 5:
                return False
            return 9 <= at_time.hour < 17

    @classmethod
    def is_any_major_market_open(cls, at_time: Optional[datetime] = None) -> bool:
        """
        Check if any major stock market is currently open.
        Covers US, Europe, and Asia for global trading coverage.
        
        Args:
            at_time: Time to check (defaults to now UTC)
        
        Returns:
            True if at least one major market is open
        """
        major_exchanges = ["XNYS", "XLON", "XETR", "XTKS", "XHKG"]
        
        for exchange in major_exchanges:
            if cls.is_market_open(exchange_code=exchange, at_time=at_time):
                return True
        return False

    @classmethod
    def get_next_market_open(
        cls,
        exchange_code: Optional[str] = None,
        currency: Optional[str] = None,
        from_time: Optional[datetime] = None
    ) -> Optional[datetime]:
        """
        Get the next market opening time.
        
        Args:
            exchange_code: Exchange code
            currency: Currency code (used if exchange_code not provided)
            from_time: Starting time (defaults to now UTC)
        
        Returns:
            datetime of next market open, or None if unable to determine
        """
        if not exchange_code:
            exchange_code = cls.get_exchange_for_currency(currency or "USD")
        
        if from_time is None:
            from_time = datetime.utcnow()
        
        try:
            calendar = cls.get_calendar(exchange_code)
            ts = pd.Timestamp(from_time, tz='UTC')
            
            # Get next trading session
            next_open = calendar.next_open(ts)
            return next_open.to_pydatetime().replace(tzinfo=None)
        except Exception as e:
            logger.warning(f"Failed to get next open for {exchange_code}: {e}")
            return None

    @classmethod  
    def get_market_close_time(
        cls,
        exchange_code: Optional[str] = None,
        currency: Optional[str] = None,
        for_date: Optional[date] = None
    ) -> Optional[datetime]:
        """
        Get the market closing time for a specific date.
        
        Args:
            exchange_code: Exchange code
            currency: Currency code (used if exchange_code not provided)
            for_date: Date to check (defaults to today)
        
        Returns:
            datetime of market close, or None if market is closed that day
        """
        if not exchange_code:
            exchange_code = cls.get_exchange_for_currency(currency or "USD")
        
        if for_date is None:
            for_date = datetime.utcnow().date()
        
        try:
            calendar = cls.get_calendar(exchange_code)
            ts = pd.Timestamp(datetime.combine(for_date, datetime.min.time()), tz='UTC')
            
            # Check if it's a trading day
            if not calendar.is_session(ts):
                return None
            
            # Get the close time
            close_time = calendar.session_close(ts)
            return close_time.to_pydatetime().replace(tzinfo=None)
        except Exception as e:
            logger.warning(f"Failed to get close time for {exchange_code}: {e}")
            return None


# Cache TTL constants for market-aware caching
class MarketAwareCacheTTL:
    """
    Dynamic cache TTL based on market hours.
    
    During market hours: Prices change frequently, use short TTL
    After market close: Prices are stale until next open, use longer TTL
    Weekends/holidays: No trading, use very long TTL
    Crypto: 24/7 trading, always use short TTL
    """
    
    # TTL values in seconds
    MARKET_OPEN = 300          # 5 minutes during trading
    AFTER_HOURS = 1800         # 30 minutes after market close
    WEEKEND_HOLIDAY = 14400    # 4 hours on weekends/holidays
    CRYPTO = 300               # 5 minutes for 24/7 crypto
    
    # Crypto symbol patterns
    CRYPTO_SUFFIXES = ('-USD', '-EUR', '-GBP', '-USDT', '-BTC', '-ETH')
    CRYPTO_PREFIXES = ('BTC', 'ETH', 'XRP', 'SOL', 'ADA', 'DOGE', 'DOT', 'MATIC', 'SHIB', 'AVAX', 'LINK', 'LTC')
    
    @classmethod
    def is_crypto_symbol(cls, symbol: str) -> bool:
        """Check if a symbol is a cryptocurrency."""
        symbol_upper = symbol.upper()
        
        # Check for crypto trading pairs
        if any(symbol_upper.endswith(suffix) for suffix in cls.CRYPTO_SUFFIXES):
            return True
        
        # Check for known crypto prefixes
        base = symbol_upper.split('-')[0]
        return base in cls.CRYPTO_PREFIXES
    
    @classmethod
    def get_ttl_for_symbol(cls, symbol: str, exchange_code: Optional[str] = None) -> int:
        """
        Get appropriate cache TTL for a symbol based on market hours.
        
        Args:
            symbol: The ticker symbol
            exchange_code: Exchange code for the symbol
        
        Returns:
            TTL in seconds
        """
        # Crypto trades 24/7, use standard short TTL
        if cls.is_crypto_symbol(symbol):
            return cls.CRYPTO
        
        now = datetime.utcnow()
        
        # Check if it's a weekend
        if now.weekday() >= 5:  # Saturday = 5, Sunday = 6
            return cls.WEEKEND_HOLIDAY
        
        # Check if any major market is open
        if MarketCalendarService.is_any_major_market_open(at_time=now):
            return cls.MARKET_OPEN
        
        # Check if we're close to market open (pre-market activity)
        # If next open is within 1 hour, use shorter TTL
        next_open = MarketCalendarService.get_next_market_open(
            exchange_code=exchange_code, 
            from_time=now
        )
        if next_open and (next_open - now).total_seconds() < 3600:
            return cls.AFTER_HOURS  # Pre-market, moderate refresh
        
        # Check if market just closed (after-hours trading can still happen)
        # Use after-hours TTL for first 4 hours after close
        market_close = MarketCalendarService.get_market_close_time(
            exchange_code=exchange_code,
            for_date=now.date()
        )
        if market_close:
            hours_since_close = (now - market_close).total_seconds() / 3600
            if 0 < hours_since_close < 4:
                return cls.AFTER_HOURS
        
        # Off hours (night), use longer TTL
        return cls.WEEKEND_HOLIDAY

    @classmethod
    def get_ttl_for_symbols(cls, symbols: list, exchange_code: Optional[str] = None) -> int:
        """
        Get appropriate cache TTL for a batch of symbols.
        Uses the minimum TTL among all symbols (most conservative).
        
        Args:
            symbols: List of ticker symbols
            exchange_code: Exchange code for the symbols
        
        Returns:
            TTL in seconds (minimum across all symbols)
        """
        if not symbols:
            return cls.MARKET_OPEN
        
        ttls = [cls.get_ttl_for_symbol(s, exchange_code) for s in symbols]
        return min(ttls)