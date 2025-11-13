"""
Tests for pricing service
"""
import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

from app.services.pricing import PricingService
from app.models import Asset, Price
from app.schemas import PriceCreate


@pytest.fixture
def mock_db():
    """Mock database session"""
    return Mock()


@pytest.fixture
def pricing_service(mock_db):
    """Create pricing service with mocked DB"""
    return PricingService(mock_db)


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
    
    with patch('app.services.pricing.crud_prices') as mock_crud:
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
        asof=datetime.utcnow() - timedelta(hours=1)  # 1 hour ago
    )
    
    with patch('app.services.pricing.crud_prices') as mock_crud, \
         patch.object(pricing_service, '_fetch_from_yfinance') as mock_fetch:
        
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
    
    with patch('app.services.pricing.crud_prices') as mock_crud, \
         patch.object(pricing_service, '_fetch_from_yfinance') as mock_fetch:
        
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
async def test_get_multiple_prices(pricing_service):
    """Test getting multiple prices at once"""
    with patch.object(pricing_service, 'get_price') as mock_get_price:
        from app.schemas import PriceQuote
        
        mock_get_price.side_effect = [
            PriceQuote(symbol="AAPL", price=Decimal("150.25"), asof=datetime.utcnow(), currency="USD"),
            PriceQuote(symbol="MSFT", price=Decimal("380.50"), asof=datetime.utcnow(), currency="USD"),
            None  # Failed to get price
        ]
        
        result = await pricing_service.get_multiple_prices(["AAPL", "MSFT", "INVALID"])
        
        assert len(result) == 2
        assert "AAPL" in result
        assert "MSFT" in result
        assert "INVALID" not in result
        assert result["AAPL"].price == Decimal("150.25")
