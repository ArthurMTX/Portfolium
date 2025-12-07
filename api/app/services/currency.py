"""
Currency conversion service
"""
import logging
from decimal import Decimal
from typing import Optional, Dict
from datetime import datetime, timedelta
import yfinance as yf

logger = logging.getLogger(__name__)

# Cache for exchange rates (currency_pair -> (rate, timestamp))
_exchange_rate_cache: Dict[str, tuple[Decimal, datetime]] = {}
_CACHE_DURATION = timedelta(hours=1)  # Cache rates for 1 hour


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
        
        # Check cache
        cache_key = f"{from_currency}{to_currency}"
        if cache_key in _exchange_rate_cache:
            rate, timestamp = _exchange_rate_cache[cache_key]
            if datetime.utcnow() - timestamp < _CACHE_DURATION:
                return rate
        
        # Fetch from Yahoo Finance using forex pair format
        # Yahoo Finance forex pairs: EURUSD=X, GBPUSD=X, etc.
        forex_symbol = f"{from_currency}{to_currency}=X"
        
        try:
            ticker = yf.Ticker(forex_symbol)
            info = ticker.history(period="1d")
            
            if info.empty:
                logger.warning(f"No exchange rate data for {forex_symbol}, trying inverse pair")
                
                # Try the inverse pair (e.g., if JPYEUR=X doesn't exist, try EURJPY=X)
                inverse_symbol = f"{to_currency}{from_currency}=X"
                try:
                    inverse_ticker = yf.Ticker(inverse_symbol)
                    inverse_info = inverse_ticker.history(period="1d")
                    
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
                    logger.warning(f"Failed to fetch inverse pair {inverse_symbol}: {inv_e}")
                
                logger.error(f"No exchange rate data available for {from_currency} to {to_currency}")
                return None
            
            # Get the most recent close price
            rate = Decimal(str(info['Close'].iloc[-1]))
            
            # Cache the rate
            _exchange_rate_cache[cache_key] = (rate, datetime.utcnow())
            
            logger.info(f"Fetched exchange rate {forex_symbol}: {rate}")
            return rate
            
        except Exception as e:
            logger.error(f"Failed to fetch exchange rate for {forex_symbol}: {e}")
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
        
        # Fetch from Yahoo Finance using forex pair format
        forex_symbol = f"{from_currency}{to_currency}=X"
        
        try:
            ticker = yf.Ticker(forex_symbol)
            # Fetch a few days of data around the target date to ensure we get data
            # (markets might be closed on the exact date)
            start_date = (date - timedelta(days=5)).strftime('%Y-%m-%d')
            end_date = (date + timedelta(days=2)).strftime('%Y-%m-%d')
            
            hist = ticker.history(start=start_date, end=end_date)
            
            if hist.empty:
                logger.warning(f"No historical data for {forex_symbol} on {date_str}, trying inverse pair")
                
                # Try the inverse pair
                inverse_symbol = f"{to_currency}{from_currency}=X"
                try:
                    inverse_ticker = yf.Ticker(inverse_symbol)
                    inverse_hist = inverse_ticker.history(start=start_date, end=end_date)
                    
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
                            return rate
                except Exception as inv_e:
                    logger.warning(f"Failed to fetch inverse historical pair {inverse_symbol}: {inv_e}")
                
                logger.error(f"No historical exchange rate data for {from_currency} to {to_currency} on {date_str}")
                return None
            
            # Convert index to timezone-naive for comparison
            hist.index = hist.index.tz_localize(None)
            # Get the closest available date to our target using pandas method
            target_date = date.replace(tzinfo=None) if date.tzinfo else date
            time_diffs = abs(hist.index - target_date)
            closest_idx = time_diffs.argmin()
            rate = Decimal(str(hist['Close'].iloc[closest_idx]))
            actual_date = hist.index[closest_idx].date()
            
            logger.info(
                f"Fetched historical exchange rate {forex_symbol} on {actual_date}: {rate} "
                f"(requested {date_str})"
            )
            return rate
            
        except Exception as e:
            logger.error(f"Failed to fetch historical exchange rate for {forex_symbol} on {date_str}: {e}")
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
