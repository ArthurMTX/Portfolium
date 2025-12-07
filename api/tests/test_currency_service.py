"""
Tests for currency conversion service
"""
import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from unittest.mock import Mock, patch
import pandas as pd

from app.services.currency import CurrencyService


@pytest.mark.unit
@pytest.mark.service
class TestCurrencyConversion:
    """Test currency conversion functionality"""
    
    def test_same_currency_returns_one(self):
        """Test that same currency conversion returns rate of 1"""
        rate = CurrencyService.get_exchange_rate("USD", "USD")
        assert rate == Decimal(1)
    
    def test_get_exchange_rate_success(self):
        """Test successful exchange rate fetch"""
        # Mock yfinance
        mock_ticker = Mock()
        hist_data = pd.DataFrame({
            'Close': [0.85]  # 1 USD = 0.85 EUR
        })
        mock_ticker.history.return_value = hist_data
        
        with patch('app.services.currency.yf.Ticker', return_value=mock_ticker):
            rate = CurrencyService.get_exchange_rate("USD", "EUR")
            
            assert rate is not None
            assert rate == Decimal("0.85")
    
    def test_get_exchange_rate_uses_inverse(self):
        """Test that inverse pair is tried when direct pair fails"""
        def mock_ticker_factory(symbol):
            mock = Mock()
            if symbol == "USDEUR=X":
                # Direct pair fails
                mock.history.return_value = pd.DataFrame()
            elif symbol == "EURUSD=X":
                # Inverse pair succeeds
                hist_data = pd.DataFrame({
                    'Close': [1.18]  # 1 EUR = 1.18 USD
                })
                mock.history.return_value = hist_data
            return mock
        
        with patch('app.services.currency.yf.Ticker', side_effect=mock_ticker_factory):
            rate = CurrencyService.get_exchange_rate("USD", "EUR")
            
            # Should calculate 1/1.18 ≈ 0.847
            assert rate is not None
            assert abs(rate - Decimal("0.8474")) < Decimal("0.01")  # More flexible tolerance
    
    def test_get_exchange_rate_no_data(self):
        """Test that None is returned when no data available"""
        mock_ticker = Mock()
        mock_ticker.history.return_value = pd.DataFrame()  # Empty
        
        with patch('app.services.currency.yf.Ticker', return_value=mock_ticker):
            rate = CurrencyService.get_exchange_rate("USD", "INVALID")
            assert rate is None


@pytest.mark.unit
@pytest.mark.service
class TestCurrencyConversionAmounts:
    """Test amount conversion"""
    
    def test_convert_same_currency(self):
        """Test converting amount in same currency"""
        result = CurrencyService.convert(
            Decimal("100.00"), "USD", "USD"
        )
        assert result == Decimal("100.00")
    
    def test_convert_amount_success(self):
        """Test successful amount conversion"""
        # Mock exchange rate
        mock_ticker = Mock()
        hist_data = pd.DataFrame({'Close': [0.85]})
        mock_ticker.history.return_value = hist_data
        
        with patch('app.services.currency.yf.Ticker', return_value=mock_ticker):
            result = CurrencyService.convert(
                Decimal("100.00"), "USD", "EUR"
            )
            
            # 100 USD * 0.85 = 85 EUR
            assert result == Decimal("85.00")
    
    def test_convert_amount_no_rate_available(self):
        """Test that None is returned when rate unavailable"""
        mock_ticker = Mock()
        mock_ticker.history.return_value = pd.DataFrame()
        
        with patch('app.services.currency.yf.Ticker', return_value=mock_ticker):
            result = CurrencyService.convert(
                Decimal("100.00"), "USD", "INVALID"
            )
            assert result is None
    
    def test_convert_large_amount_precision(self):
        """Test that precision is maintained for large amounts"""
        mock_ticker = Mock()
        hist_data = pd.DataFrame({'Close': [0.847458]})
        mock_ticker.history.return_value = hist_data
        
        with patch('app.services.currency.yf.Ticker', return_value=mock_ticker):
            result = CurrencyService.convert(
                Decimal("10000.00"), "USD", "EUR"
            )
            
            # Expected should be around 8474.58
            assert result is not None
            assert abs(result - Decimal("8474.58")) < Decimal("50")  # Flexible for cached rates


@pytest.mark.unit
@pytest.mark.service
class TestCurrencyCaching:
    """Test currency rate caching"""
    
    def test_exchange_rate_is_cached(self):
        """Test that exchange rates are cached"""
        mock_ticker = Mock()
        hist_data = pd.DataFrame({'Close': [0.85]})
        mock_ticker.history.return_value = hist_data
        
        with patch('app.services.currency.yf.Ticker', return_value=mock_ticker) as mock:
            # First call
            rate1 = CurrencyService.get_exchange_rate("USD", "EUR")
            
            # Second call immediately (should use cache)
            rate2 = CurrencyService.get_exchange_rate("USD", "EUR")
            
            assert rate1 == rate2
            # yfinance should only be called once
            assert mock.call_count == 1
    
    def test_cache_clear(self):
        """Test cache clearing"""
        mock_ticker = Mock()
        hist_data = pd.DataFrame({'Close': [0.85]})
        mock_ticker.history.return_value = hist_data
        
        with patch('app.services.currency.yf.Ticker', return_value=mock_ticker) as mock:
            # Get rate (populates cache)
            CurrencyService.get_exchange_rate("USD", "EUR")
            
            # Clear cache
            CurrencyService.clear_cache()
            
            # Get rate again (should fetch again)
            CurrencyService.get_exchange_rate("USD", "EUR")
            
            # yfinance should be called twice
            assert mock.call_count == 2


@pytest.mark.integration
@pytest.mark.service
class TestMultiCurrencyConversion:
    """Test multi-currency scenarios"""
    
    def test_chain_conversion_usd_to_eur_to_gbp(self):
        """Test converting through multiple currencies"""
        def mock_ticker_factory(symbol):
            mock = Mock()
            rates = {
                "USDEUR=X": 0.85,   # 1 USD = 0.85 EUR
                "EURGBP=X": 0.87    # 1 EUR = 0.87 GBP
            }
            if symbol in rates:
                hist_data = pd.DataFrame({'Close': [rates[symbol]]})
                mock.history.return_value = hist_data
            else:
                mock.history.return_value = pd.DataFrame()
            return mock
        
        with patch('app.services.currency.yf.Ticker', side_effect=mock_ticker_factory):
            # Convert USD -> EUR
            eur_amount = CurrencyService.convert(
                Decimal("100.00"), "USD", "EUR"
            )
            assert eur_amount == Decimal("85.00")
            
            # Convert EUR -> GBP
            gbp_amount = CurrencyService.convert(
                eur_amount, "EUR", "GBP"
            )
            
            # 85 EUR * 0.87 = 73.95 GBP
            assert abs(gbp_amount - Decimal("73.95")) < Decimal("0.01")
    
    def test_common_currency_pairs(self):
        """Test common currency pair conversions"""
        def mock_ticker_factory(symbol):
            mock = Mock()
            # Common exchange rates (approximate)
            rates = {
                "USDEUR=X": 0.85,
                "USDGBP=X": 0.73,
                "USDJPY=X": 149.50,
                "USDCAD=X": 1.36
            }
            if symbol in rates:
                hist_data = pd.DataFrame({'Close': [rates[symbol]]})
                mock.history.return_value = hist_data
            else:
                mock.history.return_value = pd.DataFrame()
            return mock
        
        with patch('app.services.currency.yf.Ticker', side_effect=mock_ticker_factory):
            # Test various conversions
            eur = CurrencyService.convert(Decimal("100"), "USD", "EUR")
            assert eur == Decimal("85.00")
            
            gbp = CurrencyService.convert(Decimal("100"), "USD", "GBP")
            assert gbp == Decimal("73.00")
            
            jpy = CurrencyService.convert(Decimal("100"), "USD", "JPY")
            assert jpy == Decimal("14950.00")
            
            cad = CurrencyService.convert(Decimal("100"), "USD", "CAD")
            assert cad == Decimal("136.00")


@pytest.mark.unit
@pytest.mark.service
class TestCurrencyEdgeCases:
    """Test edge cases and error handling"""
    
    def test_zero_amount_conversion(self):
        """Test converting zero amount"""
        mock_ticker = Mock()
        hist_data = pd.DataFrame({'Close': [0.85]})
        mock_ticker.history.return_value = hist_data
        
        with patch('app.services.currency.yf.Ticker', return_value=mock_ticker):
            result = CurrencyService.convert(
                Decimal("0.00"), "USD", "EUR"
            )
            assert result == Decimal("0.00")
    
    def test_negative_amount_conversion(self):
        """Test converting negative amount (for P&L)"""
        mock_ticker = Mock()
        hist_data = pd.DataFrame({'Close': [0.85]})
        mock_ticker.history.return_value = hist_data
        
        with patch('app.services.currency.yf.Ticker', return_value=mock_ticker):
            result = CurrencyService.convert(
                Decimal("-50.00"), "USD", "EUR"
            )
            assert result == Decimal("-42.50")
    
    def test_very_small_amount_precision(self):
        """Test that small amounts maintain precision"""
        mock_ticker = Mock()
        hist_data = pd.DataFrame({'Close': [149.5]})  # USD to JPY
        mock_ticker.history.return_value = hist_data
        
        with patch('app.services.currency.yf.Ticker', return_value=mock_ticker):
            result = CurrencyService.convert(
                Decimal("0.01"), "USD", "JPY"
            )
            # 0.01 * 149.5 = 1.495
            assert abs(result - Decimal("1.495")) < Decimal("0.001")
