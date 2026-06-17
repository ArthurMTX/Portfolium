"""
Tests for pricing service
"""
import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

from app.services.market_data.pricing import PricingService
from app.models import Asset, Price


@pytest.fixture
def mock_db():
    """Mock database session"""
    return Mock()


@pytest.fixture
def pricing_service(mock_db):
    """Create pricing service with mocked DB"""
    return PricingService(mock_db)


async def run_inline(func, *args, **kwargs):
    return func(*args, **kwargs)


@pytest.mark.asyncio
async def test_get_price_from_cache_when_fresh(pricing_service, mock_db):
    """Test that cached price is returned when fresh"""
    # Setup mock asset
    asset = Asset(id=1, symbol="AAPL", currency="USD")
    mock_db.query().filter().first.return_value = asset
    
    # Setup mock fresh price (within TTL)
    fresh_price = Price(
        id=1,
        asset_id=1,
        price=Decimal("150.25"),
        asof=datetime.utcnow() - timedelta(seconds=60)  # 1 minute ago
    )
    
    with patch('app.services.market_data.pricing.crud_prices') as mock_crud:
        mock_crud.get_latest_price.return_value = fresh_price
        
        result = await pricing_service.get_price("AAPL")
        
        assert result is not None
        assert result.symbol == "AAPL"
        assert result.price == Decimal("150.25")
        assert result.currency == "USD"


@pytest.mark.asyncio
async def test_get_price_fetches_when_stale(pricing_service, mock_db):
    """Test that fresh price is fetched when cache is stale"""
    asset = Asset(id=1, symbol="AAPL", currency="USD")
    mock_db.query().filter().first.return_value = asset
    
    # Setup mock stale price (beyond TTL)
    stale_price = Price(
        id=1,
        asset_id=1,
        price=Decimal("145.00"),
        asof=datetime.utcnow() - timedelta(days=10)
    )
    
    with patch('app.services.market_data.pricing.crud_prices') as mock_crud, \
         patch.object(pricing_service, '_fetch_from_yfinance') as mock_fetch, \
         patch.object(pricing_service, '_refresh_recent_historical_ohlc', return_value=0), \
         patch("app.services.market_data.pricing.asyncio.to_thread", side_effect=run_inline):
        
        mock_crud.get_latest_price.return_value = stale_price
        mock_fetch.return_value = {
            "price": Decimal("152.30"),
            "asof": datetime.utcnow(),
            "volume": 1000000
        }
        
        result = await pricing_service.get_price("AAPL")
        
        assert result is not None
        assert result.price == Decimal("152.30")
        mock_fetch.assert_called_once_with("AAPL")


@pytest.mark.asyncio
async def test_get_price_fallback_on_fetch_failure(pricing_service, mock_db):
    """Test fallback to cached price when fetch fails"""
    asset = Asset(id=1, symbol="AAPL", currency="USD")
    mock_db.query().filter().first.return_value = asset
    
    stale_price = Price(
        id=1,
        asset_id=1,
        price=Decimal("145.00"),
        asof=datetime.utcnow() - timedelta(hours=1)
    )
    
    with patch('app.services.market_data.pricing.crud_prices') as mock_crud, \
         patch.object(pricing_service, '_fetch_from_yfinance') as mock_fetch, \
         patch("app.services.market_data.pricing.asyncio.to_thread", side_effect=run_inline):
        
        mock_crud.get_latest_price.return_value = stale_price
        mock_fetch.return_value = None  # Simulate fetch failure
        
        result = await pricing_service.get_price("AAPL")
        
        assert result is not None
        assert result.price == Decimal("145.00")  # Uses cached price


@pytest.mark.asyncio
async def test_get_price_returns_none_for_unknown_symbol(pricing_service, mock_db):
    """Test that None is returned for unknown symbol"""
    mock_db.query().filter().first.return_value = None
    
    result = await pricing_service.get_price("UNKNOWN")
    
    assert result is None


@pytest.mark.asyncio
async def test_get_multiple_prices(test_db):
    """Test getting multiple prices at once"""
    test_db.add_all(
        [
            Asset(id=1, symbol="AAPL", currency="USD"),
            Asset(id=2, symbol="MSFT", currency="USD"),
        ]
    )
    test_db.commit()

    service = PricingService(test_db)
    asof = datetime.utcnow()
    batch_results = {
        "AAPL": {"price": Decimal("150.25"), "previous_close": Decimal("149.00"), "asof": asof},
        "MSFT": {"price": Decimal("380.50"), "previous_close": Decimal("379.00"), "asof": asof},
    }

    with (
        patch.object(service, "_batch_fetch_from_yfinance", return_value=batch_results),
        patch.object(service, "_refresh_recent_historical_ohlc", return_value=0),
        patch("app.services.market_data.pricing.asyncio.to_thread", side_effect=run_inline),
    ):
        result = await service.get_multiple_prices(["AAPL", "MSFT", "INVALID"], force_refresh=True)

    assert len(result) == 2
    assert "AAPL" in result
    assert "MSFT" in result
    assert "INVALID" not in result
    assert result["AAPL"].price == Decimal("150.25")
