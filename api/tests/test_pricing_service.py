"""
Tests for pricing service - price fetching, caching, and daily change calculations
"""
import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from unittest.mock import patch
import pandas as pd

from app.services.pricing import PricingService
from app.models import Asset, Price
from tests.factories import AssetFactory, PriceFactory


class FakeMarketDataProvider:
    """Small provider test double matching the MarketDataProvider contract."""

    name = "fake"

    def __init__(self, *, info=None, history=None, download=None):
        self.info = info or {}
        self.history = history or {}
        self.download_data = download
        self.info_calls = []
        self.history_calls = []
        self.download_calls = []

    def get_info(self, symbol, **kwargs):
        self.info_calls.append((symbol, kwargs))
        value = self.info.get(symbol, self.info.get("*", {}))
        if isinstance(value, Exception):
            raise value
        return value

    def get_history(self, symbol, **kwargs):
        self.history_calls.append((symbol, kwargs))
        value = self.history.get(symbol, self.history.get("*", pd.DataFrame()))
        if isinstance(value, Exception):
            raise value
        return value

    def download(self, symbols, **kwargs):
        self.download_calls.append((symbols, kwargs))
        if isinstance(self.download_data, Exception):
            raise self.download_data
        return self.download_data


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
    """Test provider-backed price fetching"""
    
    def test_fetch_from_yfinance_success(self, test_db):
        """Test successful price fetch from yfinance"""
        service = PricingService(test_db)
        
        provider = FakeMarketDataProvider(
            info={
                "AAPL": {
                    'regularMarketPrice': 152.30,
                    'currentPrice': 152.30,
                    'previousClose': 150.00,
                    'regularMarketVolume': 50000000,
                }
            }
        )
        
        with patch('app.services.pricing.get_market_data_provider', return_value=provider):
            result = service._fetch_from_yfinance("AAPL")
            
            assert result is not None
            assert result["price"] == Decimal("152.30")
            assert result["previous_close"] == Decimal("150.00")
            assert result["volume"] == 50000000
            assert provider.info_calls[0][0] == "AAPL"
    
    def test_fetch_from_yfinance_fallback_to_history(self, test_db):
        """Test fallback to history when info fails"""
        service = PricingService(test_db)
        
        # Create mock history data
        hist_data = pd.DataFrame({
            'Close': [149.00, 151.50],
            'Volume': [45000000, 48000000]
        })
        provider = FakeMarketDataProvider(
            info={"AAPL": Exception("Info failed")},
            history={"AAPL": hist_data},
        )
        
        with patch('app.services.pricing.get_market_data_provider', return_value=provider):
            result = service._fetch_from_yfinance("AAPL")
            
            assert result is not None
            assert result["price"] == Decimal("151.50")  # Last close
            assert result["previous_close"] == Decimal("149.00")  # Previous close
            assert provider.history_calls[0][0] == "AAPL"
    
    def test_fetch_from_yfinance_no_data(self, test_db):
        """Test handling when no data is available"""
        service = PricingService(test_db)
        
        provider = FakeMarketDataProvider(
            info={"INVALID": Exception("No data")},
            history={"INVALID": pd.DataFrame()},
        )
        
        with patch('app.services.pricing.get_market_data_provider', return_value=provider):
            result = service._fetch_from_yfinance("INVALID")
            
            assert result is None


@pytest.mark.unit
@pytest.mark.service
class TestBatchPriceParsing:
    """Test yfinance batch DataFrame parsing."""

    def test_extract_batch_price_data_single_symbol_multiindex(self, test_db):
        """Single-symbol downloads may still be returned as (symbol, field) columns."""
        service = PricingService(test_db)
        asof = datetime.utcnow()
        columns = pd.MultiIndex.from_product(
            [["SIVE.ST"], ["Open", "High", "Low", "Close", "Volume"]]
        )
        df = pd.DataFrame(
            [
                [101.0, 103.0, 100.0, 102.5, 1200],
                [102.0, 104.0, 101.0, 103.75, 1500],
            ],
            columns=columns,
        )

        result = service._extract_batch_price_data(df, "SIVE.ST", asof)

        assert result is not None
        assert result["price"] == Decimal("103.75")
        assert result["previous_close"] == Decimal("102.5")
        assert result["asof"] == asof
        assert result["volume"] == 1500

    def test_extract_batch_price_data_flat_columns(self, test_db):
        """Flat DataFrames remain supported for provider versions that return them."""
        service = PricingService(test_db)
        asof = datetime.utcnow()
        df = pd.DataFrame(
            {
                "Close": [Decimal("210.10"), Decimal("211.20")],
                "Volume": [500, 650],
            }
        )

        result = service._extract_batch_price_data(df, "AAPL", asof)

        assert result is not None
        assert result["price"] == Decimal("211.2")
        assert result["previous_close"] == Decimal("210.1")
        assert result["volume"] == 650


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
        
        provider = FakeMarketDataProvider(
            info={
                "MSFT": {
                    'regularMarketPrice': 380.50,
                    'previousClose': 378.00,
                }
            }
        )
        
        with patch('app.services.pricing.get_market_data_provider', return_value=provider):
            result = await service.get_price("MSFT")
            
            assert result is not None
            assert result.price == Decimal("380.50")
            
            # Check that price was saved to DB
            saved_price = (
                test_db.query(Price)
                .filter_by(asset_id=asset.id, source="yfinance")
                .first()
            )
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
        
        columns = pd.MultiIndex.from_product(
            [["AAPL", "GOOGL", "MSFT"], ["Close", "Volume"]]
        )
        download_data = pd.DataFrame(
            [
                [145.0, 1000, 135.0, 2000, 375.0, 3000],
                [150.0, 1100, 140.0, 2100, 380.0, 3100],
            ],
            columns=columns,
        )
        provider = FakeMarketDataProvider(download=download_data)
        
        with patch('app.services.pricing.get_market_data_provider', return_value=provider):
            results = await service.get_multiple_prices(["AAPL", "GOOGL", "MSFT"])
            
            assert len(results) == 3
            assert "AAPL" in results
            assert "GOOGL" in results
            assert "MSFT" in results
            assert results["AAPL"].price == Decimal("150.00")
            assert provider.download_calls

    @pytest.mark.asyncio
    async def test_get_multiple_prices_uses_individual_fallback_after_batch_miss(self, test_db):
        """A symbol missed by batch download can still return immediately via bounded fallback."""
        AssetFactory.create(symbol="ALKAL.PA")
        test_db.commit()

        service = PricingService(test_db)
        asof = datetime.utcnow()
        fallback_price = {
            "price": Decimal("1.23"),
            "previous_close": Decimal("1.20"),
            "asof": asof,
            "volume": 1000,
        }

        with (
            patch.object(service, "_batch_fetch_from_yfinance", return_value={}) as mock_batch,
            patch.object(service, "_fetch_from_yfinance", return_value=fallback_price) as mock_fallback,
        ):
            results = await service.get_multiple_prices(["ALKAL.PA"], force_refresh=True)

        mock_batch.assert_called_once_with(["ALKAL.PA"])
        mock_fallback.assert_called_once_with("ALKAL.PA")
        assert results["ALKAL.PA"].price == Decimal("1.23")
        assert results["ALKAL.PA"].daily_change_pct == Decimal("2.5")


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
        
        start_date = datetime.utcnow() - timedelta(days=30)
        end_date = datetime.utcnow()
        
        # Create mock history data
        dates = pd.date_range(start=start_date, end=end_date, freq='D')
        hist_data = pd.DataFrame({
            'Close': [150 + i for i in range(len(dates))],
            'Volume': [50000000] * len(dates)
        }, index=dates)
        
        provider = FakeMarketDataProvider(history={"AAPL": hist_data})
        
        with patch('app.services.pricing.get_market_data_provider', return_value=provider):
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
        
        provider = FakeMarketDataProvider(
            info={"AAPL": {'regularMarketPrice': 150.00, 'previousClose': 148.00}}
        )
        
        with patch('app.services.pricing.get_market_data_provider', return_value=provider):
            # First fetch
            await service.get_price("AAPL")
            
            # Second fetch immediately after (should use memory cache)
            await service.get_price("AAPL")
            
            # Provider should only be called once (memory cache hit)
            assert len(provider.info_calls) == 1
    
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
        
        provider = FakeMarketDataProvider(
            info={"AAPL": {'regularMarketPrice': 155.00, 'previousClose': 150.00}}
        )
        
        with patch('app.services.pricing.get_market_data_provider', return_value=provider):
            result = await service.get_price("AAPL", force_refresh=True)
            
            # Should get fresh price, not cached
            assert result.price == Decimal("155.00")
