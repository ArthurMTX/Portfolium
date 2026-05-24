"""
Currency conversion service
"""
import logging
from decimal import Decimal
from typing import Optional, Dict
from datetime import datetime, timedelta
import yfinance as yf

from app.services.yahoo_finance import call_yahoo, yahoo_timeout_seconds

logger = logging.getLogger(__name__)

# Cache for exchange rates (currency_pair -> (rate, timestamp))
_exchange_rate_cache: Dict[str, tuple[Decimal, datetime]] = {}
_historical_exchange_rate_cache: Dict[str, tuple[Decimal, datetime]] = {}
_CACHE_DURATION = timedelta(hours=4)  # Cache rates for 4 hours (reduce API calls)
_HISTORICAL_CACHE_DURATION = timedelta(days=7)


def _is_yf_rate_limited() -> bool:
    """Check if yfinance is currently rate limited"""
    try:
        from app.services.pricing import is_rate_limited
        return is_rate_limited()
    except ImportError:
        return False


class CurrencyService:
    """Service for currency conversion"""
    
    @staticmethod
    def get_exchange_rate(from_currency: str, to_currency: str) -> Optional[Decimal]:
        """
        Get exchange rate from one currency to another
        
        Args:
            from_currency: Source currency code (e.g., 'USD')
            to_currency: Target currency code (e.g., 'EUR')
            
        Returns:
            Exchange rate as Decimal, or None if unavailable
            
        Example:
            get_exchange_rate('USD', 'EUR') -> 0.85 (1 USD = 0.85 EUR)
        """
        # Same currency = rate of 1
        if from_currency == to_currency:
            return Decimal(1)
        
        # Check cache first (even if stale, better than rate limiting)
        cache_key = f"{from_currency}{to_currency}"
        cached_rate = None
        if cache_key in _exchange_rate_cache:
            rate, timestamp = _exchange_rate_cache[cache_key]
            cached_rate = rate
            cache_age = datetime.utcnow() - timestamp
            
            # Return cached rate if fresh
            if cache_age < _CACHE_DURATION:
                return rate
            
            # If rate limited, return stale cache (better than nothing)
            if _is_yf_rate_limited():
                logger.debug(f"Rate limited, using stale cache for {cache_key}")
                return rate
        
        # If rate limited and no cache, return None
        if _is_yf_rate_limited():
            logger.warning(f"Rate limited, no cached rate for {cache_key}")
            return None
        
        # Fetch from Yahoo Finance using forex pair format
        # Yahoo Finance forex pairs: EURUSD=X, GBPUSD=X, etc.
        forex_symbol = f"{from_currency}{to_currency}=X"
        
        try:
            ticker = yf.Ticker(forex_symbol)
            info = call_yahoo(
                lambda: ticker.history(period="1d"),
                symbol=forex_symbol,
                action="fx_rate",
                timeout_seconds=yahoo_timeout_seconds(),
            )
            
            if info.empty:
                logger.warning(f"No exchange rate data for {forex_symbol}, trying inverse pair")
                
                # Try the inverse pair (e.g., if JPYEUR=X doesn't exist, try EURJPY=X)
                inverse_symbol = f"{to_currency}{from_currency}=X"
                try:
                    inverse_ticker = yf.Ticker(inverse_symbol)
                    inverse_info = call_yahoo(
                        lambda: inverse_ticker.history(period="1d"),
                        symbol=inverse_symbol,
                        action="fx_rate_inverse",
                        timeout_seconds=yahoo_timeout_seconds(),
                    )
                    
                    if not inverse_info.empty:
                        # Invert the rate (if EUR/JPY = 165, then JPY/EUR = 1/165)
                        inverse_rate = Decimal(str(inverse_info['Close'].iloc[-1]))
                        if inverse_rate > 0:
                            rate = Decimal(1) / inverse_rate
                            
                            # Cache the rate
                            _exchange_rate_cache[cache_key] = (rate, datetime.utcnow())
                            
                            logger.info(f"Fetched inverse exchange rate {inverse_symbol}: {inverse_rate}, calculated {forex_symbol}: {rate}")
                            return rate
                except Exception as inv_e:
                    error_msg = str(inv_e).lower()
                    if "rate" in error_msg or "limit" in error_msg or "429" in error_msg:
                        # Trigger circuit breaker
                        try:
                            from app.services.pricing import set_rate_limited
                            set_rate_limited(60)
                        except ImportError:
                            pass
                    logger.warning(f"Failed to fetch inverse pair {inverse_symbol}: {inv_e}")
                
                logger.error(f"No exchange rate data available for {from_currency} to {to_currency}")
                if cached_rate is not None:
                    logger.warning(
                        "provider=yahoo symbol=%s fallback=stale_fx_cache reason=no_data",
                        forex_symbol,
                    )
                    return cached_rate
                return None
            
            # Get the most recent close price
            rate = Decimal(str(info['Close'].iloc[-1]))
            
            # Cache the rate
            _exchange_rate_cache[cache_key] = (rate, datetime.utcnow())
            
            logger.info(f"Fetched exchange rate {forex_symbol}: {rate}")
            return rate
            
        except Exception as e:
            error_msg = str(e).lower()
            if "rate" in error_msg or "limit" in error_msg or "429" in error_msg:
                # Trigger circuit breaker
                try:
                    from app.services.pricing import set_rate_limited
                    set_rate_limited(60)
                except ImportError:
                    pass
            logger.error(f"Failed to fetch exchange rate for {forex_symbol}: {e}")
            if cached_rate is not None:
                logger.warning(
                    "provider=yahoo symbol=%s fallback=stale_fx_cache reason=fetch_failed",
                    forex_symbol,
                )
                return cached_rate
            return None
    
    @staticmethod
    def convert(
        amount: Decimal, 
        from_currency: str, 
        to_currency: str
    ) -> Optional[Decimal]:
        """
        Convert an amount from one currency to another
        
        Args:
            amount: Amount to convert
            from_currency: Source currency code
            to_currency: Target currency code
            
        Returns:
            Converted amount as Decimal, or None if conversion failed
        """
        if from_currency == to_currency:
            return amount
        
        rate = CurrencyService.get_exchange_rate(from_currency, to_currency)
        if rate is None:
            return None
        
        return amount * rate
    
    @staticmethod
    def get_historical_exchange_rate(
        from_currency: str, 
        to_currency: str, 
        date: datetime
    ) -> Optional[Decimal]:
        """
        Get historical exchange rate for a specific date
        
        Args:
            from_currency: Source currency code (e.g., 'USD')
            to_currency: Target currency code (e.g., 'EUR')
            date: The date to get the exchange rate for
            
        Returns:
            Exchange rate as Decimal, or None if unavailable
        """
        # Same currency = rate of 1
        if from_currency == to_currency:
            return Decimal(1)
        
        # Format date for yfinance
        date_str = date.strftime('%Y-%m-%d')
        cache_key = f"{from_currency}{to_currency}:{date_str}"
        if cache_key in _historical_exchange_rate_cache:
            rate, timestamp = _historical_exchange_rate_cache[cache_key]
            if datetime.utcnow() - timestamp < _HISTORICAL_CACHE_DURATION:
                return rate
            if _is_yf_rate_limited():
                logger.debug(f"Rate limited, using stale historical FX cache for {cache_key}")
                return rate
        
        # Fetch from Yahoo Finance using forex pair format
        forex_symbol = f"{from_currency}{to_currency}=X"
        
        try:
            ticker = yf.Ticker(forex_symbol)
            # Fetch a few days of data around the target date to ensure we get data
            # (markets might be closed on the exact date)
            start_date = (date - timedelta(days=5)).strftime('%Y-%m-%d')
            end_date = (date + timedelta(days=2)).strftime('%Y-%m-%d')
            
            hist = call_yahoo(
                lambda: ticker.history(start=start_date, end=end_date),
                symbol=forex_symbol,
                action="historical_fx_rate",
                timeout_seconds=yahoo_timeout_seconds(),
            )
            
            if hist.empty:
                logger.warning(f"No historical data for {forex_symbol} on {date_str}, trying inverse pair")
                
                # Try the inverse pair
                inverse_symbol = f"{to_currency}{from_currency}=X"
                try:
                    inverse_ticker = yf.Ticker(inverse_symbol)
                    inverse_hist = call_yahoo(
                        lambda: inverse_ticker.history(start=start_date, end=end_date),
                        symbol=inverse_symbol,
                        action="historical_fx_rate_inverse",
                        timeout_seconds=yahoo_timeout_seconds(),
                    )
                    
                    if not inverse_hist.empty:
                        # Convert index to timezone-naive for comparison
                        inverse_hist.index = inverse_hist.index.tz_localize(None)
                        # Get the closest date using pandas method
                        target_date = date.replace(tzinfo=None) if date.tzinfo else date
                        time_diffs = abs(inverse_hist.index - target_date)
                        closest_idx = time_diffs.argmin()
                        inverse_rate = Decimal(str(inverse_hist['Close'].iloc[closest_idx]))
                        
                        if inverse_rate > 0:
                            rate = Decimal(1) / inverse_rate
                            logger.info(
                                f"Fetched historical inverse rate {inverse_symbol} on "
                                f"{inverse_hist.index[closest_idx].date()}: {inverse_rate}, "
                                f"calculated {forex_symbol}: {rate}"
                            )
                            _historical_exchange_rate_cache[cache_key] = (rate, datetime.utcnow())
                            return rate
                except Exception as inv_e:
                    logger.warning(f"Failed to fetch inverse historical pair {inverse_symbol}: {inv_e}")
                
                logger.error(f"No historical exchange rate data for {from_currency} to {to_currency} on {date_str}")
                if cache_key in _historical_exchange_rate_cache:
                    rate, _ = _historical_exchange_rate_cache[cache_key]
                    logger.warning(
                        "provider=yahoo symbol=%s fallback=stale_historical_fx_cache date=%s reason=no_data",
                        forex_symbol,
                        date_str,
                    )
                    return rate
                return None
            
            # Convert index to timezone-naive for comparison
            hist.index = hist.index.tz_localize(None)
            # Get the closest available date to our target using pandas method
            target_date = date.replace(tzinfo=None) if date.tzinfo else date
            time_diffs = abs(hist.index - target_date)
            closest_idx = time_diffs.argmin()
            rate = Decimal(str(hist['Close'].iloc[closest_idx]))
            actual_date = hist.index[closest_idx].date()
            _historical_exchange_rate_cache[cache_key] = (rate, datetime.utcnow())
            
            logger.info(
                f"Fetched historical exchange rate {forex_symbol} on {actual_date}: {rate} "
                f"(requested {date_str})"
            )
            return rate
            
        except Exception as e:
            logger.error(f"Failed to fetch historical exchange rate for {forex_symbol} on {date_str}: {e}")
            if cache_key in _historical_exchange_rate_cache:
                rate, _ = _historical_exchange_rate_cache[cache_key]
                logger.warning(
                    "provider=yahoo symbol=%s fallback=stale_historical_fx_cache date=%s",
                    forex_symbol,
                    date_str,
                )
                return rate
            return None
    
    @staticmethod
    def convert_historical(
        amount: Decimal,
        from_currency: str,
        to_currency: str,
        date: datetime
    ) -> Optional[Decimal]:
        """
        Convert an amount using historical exchange rate from a specific date
        
        Args:
            amount: Amount to convert
            from_currency: Source currency code
            to_currency: Target currency code
            date: The date to use for the exchange rate
            
        Returns:
            Converted amount as Decimal, or None if conversion failed
        """
        if from_currency == to_currency:
            return amount
        
        rate = CurrencyService.get_historical_exchange_rate(from_currency, to_currency, date)
        if rate is None:
            return None
        
        return amount * rate
    
    @staticmethod
    def clear_cache():
        """Clear the exchange rate cache"""
        _exchange_rate_cache.clear()
