"""
Tests for pricing service - price fetching, caching, and daily change calculations
"""
import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
import pandas as pd

from app.services.pricing import PricingService
from app.models import Asset, Price
from app.schemas import PriceCreate, PriceQuote
from tests.factories import AssetFactory, PriceFactory


@pytest.mark.unit
@pytest.mark.service
class TestPricingCache:
    """Test price caching mechanisms"""
    
    def test_is_price_fresh_within_ttl(self, test_db):
        """Test that recent prices are considered fresh"""
        service = PricingService(test_db)
        
        # Price from 1 minute ago should be fresh
        recent_time = datetime.utcnow() - timedelta(minutes=1)
        assert service._is_price_fresh(recent_time) is True
    
    def test_is_price_stale_beyond_ttl(self, test_db):
        """Test that old prices are considered stale"""
        service = PricingService(test_db)
        
        # Price from 2 hours ago should be stale (default TTL is 5 minutes)
        old_time = datetime.utcnow() - timedelta(hours=2)
        assert service._is_price_fresh(old_time) is False
    
    @pytest.mark.asyncio
    async def test_db_cached_price_used_when_fresh(self, test_db):
        """Test that fresh DB cached prices are returned without fetching"""
        asset = AssetFactory.create(symbol="AAPL")
        
        # Create a fresh price in DB
        fresh_price = PriceFactory.create(
            asset_id=asset.id,
            price=Decimal("150.25"),
            asof=datetime.utcnow() - timedelta(seconds=30)
        )
        test_db.commit()
        
        service = PricingService(test_db)
        
        with patch.object(service, '_fetch_from_yfinance') as mock_fetch:
            result = await service.get_price("AAPL")
            
            # Should use cached price, not fetch
            mock_fetch.assert_not_called()
            assert result is not None
            assert result.symbol == "AAPL"
            assert result.price == Decimal("150.25")


@pytest.mark.unit
@pytest.mark.service
class TestYFinanceFetching:
    """Test yfinance data fetching"""
    
    def test_fetch_from_yfinance_success(self, test_db):
        """Test successful price fetch from yfinance"""
        service = PricingService(test_db)
        
        # Mock yfinance Ticker
        mock_ticker = Mock()
        mock_ticker.info = {
            'regularMarketPrice': 152.30,
            'currentPrice': 152.30,
            'previousClose': 150.00,
            'regularMarketVolume': 50000000
        }
        
        with patch('app.services.pricing.yf.Ticker', return_value=mock_ticker):
            result = service._fetch_from_yfinance("AAPL")
            
            assert result is not None
            assert result["price"] == Decimal("152.30")
            assert result["previous_close"] == Decimal("150.00")
            assert result["volume"] == 50000000
    
    def test_fetch_from_yfinance_fallback_to_history(self, test_db):
        """Test fallback to history when info fails"""
        service = PricingService(test_db)
        
        # Mock yfinance Ticker with failing info but working history
        mock_ticker = Mock()
        mock_ticker.info.side_effect = Exception("Info failed")
        
        # Create mock history data
        hist_data = pd.DataFrame({
            'Close': [149.00, 151.50],
            'Volume': [45000000, 48000000]
        })
        mock_ticker.history.return_value = hist_data
        
        with patch('app.services.pricing.yf.Ticker', return_value=mock_ticker):
            result = service._fetch_from_yfinance("AAPL")
            
            assert result is not None
            assert result["price"] == Decimal("151.50")  # Last close
            assert result["previous_close"] == Decimal("149.00")  # Previous close
    
    def test_fetch_from_yfinance_no_data(self, test_db):
        """Test handling when no data is available"""
        service = PricingService(test_db)
        
        mock_ticker = Mock()
        mock_ticker.info.side_effect = Exception("No data")
        mock_ticker.history.return_value = pd.DataFrame()  # Empty history
        
        with patch('app.services.pricing.yf.Ticker', return_value=mock_ticker):
            result = service._fetch_from_yfinance("INVALID")
            
            assert result is None


@pytest.mark.integration
@pytest.mark.service
class TestPriceService:
    """Integration tests for pricing service"""
    
    @pytest.mark.asyncio
    async def test_get_price_creates_asset_price_record(self, test_db):
        """Test that fetching a price saves it to database"""
        asset = AssetFactory.create(symbol="MSFT")
        test_db.commit()
        
        service = PricingService(test_db)
        
        # Mock yfinance
        mock_ticker = Mock()
        mock_ticker.info = {
            'regularMarketPrice': 380.50,
            'previousClose': 378.00
        }
        
        with patch('app.services.pricing.yf.Ticker', return_value=mock_ticker):
            result = await service.get_price("MSFT")
            
            assert result is not None
            assert result.price == Decimal("380.50")
            
            # Check that price was saved to DB
            saved_price = test_db.query(Price).filter_by(asset_id=asset.id).first()
            assert saved_price is not None
            assert saved_price.price == Decimal("380.50")
    
    @pytest.mark.asyncio
    async def test_get_price_unknown_symbol_returns_none(self, test_db):
        """Test that unknown symbols return None"""
        service = PricingService(test_db)
        
        result = await service.get_price("DOESNOTEXIST")
        assert result is None
    
    @pytest.mark.asyncio
    async def test_get_multiple_prices(self, test_db):
        """Test fetching multiple prices at once"""
        AssetFactory.create(symbol="AAPL")
        AssetFactory.create(symbol="GOOGL")
        AssetFactory.create(symbol="MSFT")
        test_db.commit()
        
        service = PricingService(test_db)
        
        # Mock yfinance for all symbols
        def mock_ticker_factory(symbol):
            mock = Mock()
            prices = {"AAPL": 150.00, "GOOGL": 140.00, "MSFT": 380.00}
            mock.info = {
                'regularMarketPrice': prices.get(symbol, 100.00),
                'previousClose': prices.get(symbol, 100.00) - 5
            }
            return mock
        
        with patch('app.services.pricing.yf.Ticker', side_effect=mock_ticker_factory):
            results = await service.get_multiple_prices(["AAPL", "GOOGL", "MSFT"])
            
            assert len(results) == 3
            assert "AAPL" in results
            assert "GOOGL" in results
            assert "MSFT" in results
            assert results["AAPL"].price == Decimal("150.00")


@pytest.mark.unit
@pytest.mark.service
class TestDailyChangeCalculation:
    """Test daily change percentage calculations"""
    
    def test_calculate_daily_change_with_previous_close(self, test_db):
        """Test daily change calculation using previous close"""
        asset = AssetFactory.create(symbol="AAPL")
        
        # Create previous close price
        yesterday = datetime.utcnow() - timedelta(days=1)
        PriceFactory.create(
            asset_id=asset.id,
            price=Decimal("150.00"),
            asof=yesterday,
            source="yfinance_prev_close"
        )
        test_db.commit()
        
        service = PricingService(test_db)
        
        current_price = Decimal("153.00")
        daily_change = service._calculate_daily_change_with_official_close(
            asset.id, current_price
        )
        
        # (153 - 150) / 150 * 100 = 2%
        assert daily_change is not None
        assert abs(daily_change - Decimal("2.0")) < Decimal("0.01")
    
    def test_calculate_daily_change_no_previous_price(self, test_db):
        """Test that None is returned when no previous price exists"""
        asset = AssetFactory.create(symbol="NEWSTOCK")
        test_db.commit()
        
        service = PricingService(test_db)
        
        daily_change = service._calculate_daily_change_with_official_close(
            asset.id, Decimal("100.00")
        )
        
        assert daily_change is None
    
    def test_calculate_daily_change_with_approximate_price(self, test_db):
        """Test daily change using approximate 24h old price"""
        asset = AssetFactory.create(symbol="AAPL")
        
        # Create price from 24 hours ago (no official close available)
        day_ago = datetime.utcnow() - timedelta(hours=24)
        PriceFactory.create(
            asset_id=asset.id,
            price=Decimal("148.00"),
            asof=day_ago,
            source="yfinance"
        )
        test_db.commit()
        
        service = PricingService(test_db)
        
        current_price = Decimal("150.00")
        daily_change = service._calculate_daily_change_with_official_close(
            asset.id, current_price
        )
        
        # Should use approximate price
        assert daily_change is not None
        # (150 - 148) / 148 * 100 ≈ 1.35%
        assert abs(daily_change - Decimal("1.35")) < Decimal("0.1")


@pytest.mark.integration
@pytest.mark.service
class TestHistoricalPrices:
    """Test historical price fetching"""
    
    def test_ensure_historical_prices_creates_records(self, test_db):
        """Test that historical prices are saved to database"""
        asset = AssetFactory.create(symbol="AAPL")
        test_db.commit()
        
        service = PricingService(test_db)
        
        # Mock yfinance history
        start_date = datetime.utcnow() - timedelta(days=30)
        end_date = datetime.utcnow()
        
        # Create mock history data
        dates = pd.date_range(start=start_date, end=end_date, freq='D')
        hist_data = pd.DataFrame({
            'Close': [150 + i for i in range(len(dates))],
            'Volume': [50000000] * len(dates)
        }, index=dates)
        
        mock_ticker = Mock()
        mock_ticker.history.return_value = hist_data
        
        with patch('app.services.pricing.yf.Ticker', return_value=mock_ticker):
            count = service.ensure_historical_prices(
                asset, start_date, end_date, interval='1d'
            )
            
            assert count > 0
            
            # Check that prices were saved
            saved_prices = test_db.query(Price).filter_by(
                asset_id=asset.id,
                source='yfinance_history'
            ).all()
            
            assert len(saved_prices) == count
            assert saved_prices[0].price > 0


@pytest.mark.asyncio
@pytest.mark.unit
class TestPriceCaching:
    """Test multi-level caching behavior"""
    
    async def test_memory_cache_prevents_duplicate_fetches(self, test_db):
        """Test that memory cache prevents fetching same price twice"""
        asset = AssetFactory.create(symbol="AAPL")
        test_db.commit()
        
        service = PricingService(test_db)
        
        mock_ticker = Mock()
        mock_ticker.info = {'regularMarketPrice': 150.00, 'previousClose': 148.00}
        
        with patch('app.services.pricing.yf.Ticker', return_value=mock_ticker) as mock:
            # First fetch
            await service.get_price("AAPL")
            
            # Second fetch immediately after (should use memory cache)
            await service.get_price("AAPL")
            
            # yfinance should only be called once (memory cache hit)
            assert mock.call_count == 1
    
    async def test_force_refresh_bypasses_cache(self, test_db):
        """Test that force_refresh ignores caches"""
        asset = AssetFactory.create(symbol="AAPL")
        
        # Create cached price
        PriceFactory.create(
            asset_id=asset.id,
            price=Decimal("150.00"),
            asof=datetime.utcnow() - timedelta(seconds=10)
        )
        test_db.commit()
        
        service = PricingService(test_db)
        
        mock_ticker = Mock()
        mock_ticker.info = {'regularMarketPrice': 155.00, 'previousClose': 150.00}
        
        with patch('app.services.pricing.yf.Ticker', return_value=mock_ticker):
            result = await service.get_price("AAPL", force_refresh=True)
            
            # Should get fresh price, not cached
            assert result.price == Decimal("155.00")
