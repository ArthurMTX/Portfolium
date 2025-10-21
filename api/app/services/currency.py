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
                logger.warning(f"No exchange rate data for {forex_symbol}")
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
    def clear_cache():
        """Clear the exchange rate cache"""
        _exchange_rate_cache.clear()
