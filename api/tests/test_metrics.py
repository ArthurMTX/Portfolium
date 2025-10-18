"""
Tests for metrics calculation service
"""
import pytest
from decimal import Decimal
from datetime import date
from unittest.mock import Mock, MagicMock

from app.services.metrics import MetricsService
from app.models import Asset, Transaction, TransactionType, Portfolio


@pytest.fixture
def mock_db():
    """Mock database session"""
    return Mock()


@pytest.fixture
def metrics_service(mock_db):
    """Create metrics service with mocked DB"""
    return MetricsService(mock_db)


def test_calculate_position_simple_buy(metrics_service, mock_db):
    """Test position calculation for simple BUY transaction"""
    asset = Asset(id=1, symbol="AAPL", name="Apple Inc.", currency="USD")
    
    transactions = [
        Transaction(
            id=1,
            portfolio_id=1,
            asset_id=1,
            tx_date=date(2024, 1, 15),
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("150.00"),
            fees=Decimal("10.00"),
            currency="USD"
        )
    ]
    
    mock_db.query().filter().first.return_value = asset
    
    with patch('app.services.metrics.crud_prices') as mock_crud:
        from app.models import Price
        mock_crud.get_latest_price.return_value = Price(
            id=1,
            asset_id=1,
            price=Decimal("160.00"),
            asof=datetime.utcnow()
        )
        
        position = metrics_service._calculate_position(1, transactions)
        
        assert position is not None
        assert position.quantity == Decimal("10")
        assert position.cost_basis == Decimal("1510.00")  # (10 * 150) + 10 fees
        assert position.avg_cost == Decimal("151.00")  # 1510 / 10
        assert position.current_price == Decimal("160.00")
        assert position.market_value == Decimal("1600.00")  # 10 * 160
        assert position.unrealized_pnl == Decimal("90.00")  # 1600 - 1510


def test_calculate_position_buy_and_sell(metrics_service, mock_db):
    """Test position calculation with BUY and SELL"""
    asset = Asset(id=1, symbol="AAPL", name="Apple Inc.", currency="USD")
    
    transactions = [
        # Buy 10 shares @ 150
        Transaction(
            id=1, portfolio_id=1, asset_id=1,
            tx_date=date(2024, 1, 15),
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("150.00"),
            fees=Decimal("10.00"),
            currency="USD"
        ),
        # Sell 5 shares @ 170
        Transaction(
            id=2, portfolio_id=1, asset_id=1,
            tx_date=date(2024, 3, 20),
            type=TransactionType.SELL,
            quantity=Decimal("5"),
            price=Decimal("170.00"),
            fees=Decimal("10.00"),
            currency="USD"
        )
    ]
    
    mock_db.query().filter().first.return_value = asset
    
    with patch('app.services.metrics.crud_prices') as mock_crud:
        from app.models import Price
        mock_crud.get_latest_price.return_value = Price(
            id=1,
            asset_id=1,
            price=Decimal("160.00"),
            asof=datetime.utcnow()
        )
        
        position = metrics_service._calculate_position(1, transactions)
        
        assert position is not None
        assert position.quantity == Decimal("5")  # 10 - 5
        # Cost basis: (10*150 + 10) - (5*151) = 1510 - 755 = 755
        assert position.cost_basis == Decimal("755.00")
        assert position.avg_cost == Decimal("151.00")


def test_calculate_position_with_split(metrics_service, mock_db):
    """Test position calculation with stock split"""
    asset = Asset(id=1, symbol="AAPL", name="Apple Inc.", currency="USD")
    
    transactions = [
        # Buy 10 shares @ 150
        Transaction(
            id=1, portfolio_id=1, asset_id=1,
            tx_date=date(2024, 1, 15),
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("150.00"),
            fees=Decimal("10.00"),
            currency="USD",
            meta_data={}
        ),
        # 2:1 split
        Transaction(
            id=2, portfolio_id=1, asset_id=1,
            tx_date=date(2024, 6, 1),
            type=TransactionType.SPLIT,
            quantity=Decimal("0"),
            price=Decimal("0"),
            fees=Decimal("0"),
            currency="USD",
            meta_data={"split": "2:1"}
        )
    ]
    
    mock_db.query().filter().first.return_value = asset
    
    with patch('app.services.metrics.crud_prices') as mock_crud:
        from app.models import Price
        mock_crud.get_latest_price.return_value = Price(
            id=1,
            asset_id=1,
            price=Decimal("80.00"),  # After split, price halves
            asof=datetime.utcnow()
        )
        
        position = metrics_service._calculate_position(1, transactions)
        
        assert position is not None
        assert position.quantity == Decimal("20")  # 10 * 2 (2:1 split)
        assert position.cost_basis == Decimal("1510.00")  # Cost basis unchanged
        assert position.avg_cost == Decimal("75.50")  # 1510 / 20


def test_parse_split_ratio(metrics_service):
    """Test parsing of split ratio strings"""
    assert metrics_service._parse_split_ratio("2:1") == Decimal("2")
    assert metrics_service._parse_split_ratio("1:2") == Decimal("0.5")
    assert metrics_service._parse_split_ratio("3:1") == Decimal("3")
    assert metrics_service._parse_split_ratio("invalid") == Decimal("1")


# Import datetime at module level for patches
from datetime import datetime
from unittest.mock import patch
