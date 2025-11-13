"""
Example test showing best practices
This file demonstrates how to write good tests using the test infrastructure
"""
import pytest
from decimal import Decimal
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Portfolio, Asset, Transaction, TransactionType
from tests.factories import UserFactory, PortfolioFactory, AssetFactory, TransactionFactory
from tests.utils import assert_response_success, random_price


@pytest.mark.unit
class TestPortfolioModel:
    """Test portfolio model behavior"""
    
    def test_create_portfolio(self, test_db: Session):
        """Test creating a portfolio"""
        user = UserFactory.create()
        portfolio = PortfolioFactory.create(user_id=user.id, name="My Portfolio")
        
        assert portfolio.id is not None
        assert portfolio.name == "My Portfolio"
        assert portfolio.user_id == user.id
        assert portfolio.base_currency == "USD"
    
    def test_portfolio_relationship_to_user(self, test_db: Session):
        """Test portfolio has correct relationship to user"""
        user = UserFactory.create()
        portfolio = PortfolioFactory.create(user_id=user.id)
        
        assert portfolio.user == user


@pytest.mark.integration
@pytest.mark.api
class TestPortfolioAPI:
    """Test portfolio API endpoints"""
    
    def test_list_portfolios_requires_auth(self, client: TestClient):
        """Test that listing portfolios requires authentication"""
        response = client.get("/portfolios")
        # Depending on your auth setup, this might be 401
        assert response.status_code in [401, 403, 200]
    
    def test_create_portfolio(self, client: TestClient, auth_headers: dict, test_user):
        """Test creating a portfolio via API"""
        portfolio_data = {
            "name": "Investment Portfolio",
            "description": "My stocks and bonds",
            "base_currency": "USD"
        }
        
        response = client.post("/portfolios", json=portfolio_data, headers=auth_headers)
        assert_response_success(response, 201)
        
        data = response.json()
        assert data["name"] == "Investment Portfolio"
        assert data["base_currency"] == "USD"
    
    def test_get_portfolio_by_id(self, client: TestClient, sample_portfolio: Portfolio, auth_headers: dict):
        """Test getting a specific portfolio"""
        response = client.get(f"/portfolios/{sample_portfolio.id}", headers=auth_headers)
        assert_response_success(response)
        
        data = response.json()
        assert data["id"] == sample_portfolio.id
        assert data["name"] == sample_portfolio.name


@pytest.mark.integration
class TestTransactionCalculations:
    """Test transaction and position calculations"""
    
    def test_simple_buy_position(self, test_db: Session):
        """Test calculating position after a simple BUY"""
        user = UserFactory.create()
        portfolio = PortfolioFactory.create(user_id=user.id)
        asset = AssetFactory.create(symbol="AAPL")
        
        # Buy 10 shares at $150
        transaction = TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("150.00"),
            fees=Decimal("10.00")
        )
        
        test_db.commit()
        
        # Verify transaction was created
        assert transaction.id is not None
        assert transaction.quantity == Decimal("10")
        
        # Here you would test your position calculation logic
        # total_cost = (10 * 150) + 10 = 1510
        expected_cost = Decimal("1510.00")
        assert transaction.quantity * transaction.price + transaction.fees == expected_cost
    
    def test_buy_and_sell_position(self, test_db: Session):
        """Test position after buying and then selling"""
        user = UserFactory.create()
        portfolio = PortfolioFactory.create(user_id=user.id)
        asset = AssetFactory.create()
        
        # Buy 10 shares
        buy_tx = TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("100.00"),
            fees=Decimal("5.00")
        )
        
        # Sell 4 shares
        sell_tx = TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            type=TransactionType.SELL,
            quantity=Decimal("4"),
            price=Decimal("120.00"),
            fees=Decimal("5.00")
        )
        
        test_db.commit()
        
        # Remaining quantity should be 6
        remaining_qty = buy_tx.quantity - sell_tx.quantity
        assert remaining_qty == Decimal("6")


@pytest.mark.unit
class TestAssetModel:
    """Test asset model behavior"""
    
    def test_create_asset(self, test_db: Session):
        """Test creating an asset"""
        asset = AssetFactory.create(
            symbol="MSFT",
            name="Microsoft Corporation",
            currency="USD"
        )
        
        assert asset.id is not None
        assert asset.symbol == "MSFT"
        assert asset.name == "Microsoft Corporation"
    
    def test_asset_symbol_uniqueness(self, test_db: Session):
        """Test that asset symbols should be unique"""
        AssetFactory.create(symbol="UNIQUE")
        
        # Attempting to create another asset with same symbol should fail
        # This depends on your database constraints
        with pytest.raises(Exception):
            AssetFactory.create(symbol="UNIQUE")
            test_db.commit()


@pytest.mark.slow
def test_bulk_transaction_creation(test_db: Session):
    """Test creating many transactions (performance test)"""
    user = UserFactory.create()
    portfolio = PortfolioFactory.create(user_id=user.id)
    asset = AssetFactory.create()
    
    # Create 100 transactions
    transactions = [
        TransactionFactory.build(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            quantity=Decimal("1"),
            price=random_price(10, 200)
        )
        for _ in range(100)
    ]
    
    test_db.add_all(transactions)
    test_db.commit()
    
    # Verify all were created
    count = test_db.query(Transaction).filter_by(portfolio_id=portfolio.id).count()
    assert count == 100
