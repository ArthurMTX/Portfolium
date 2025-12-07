"""
Test configuration and fixtures
"""
import os
import sys
from typing import Generator
from decimal import Decimal
from datetime import datetime, date

# Load test environment variables before any imports
from dotenv import load_dotenv
load_dotenv(".env.test")

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db import Base, get_db
from app.main import app
from app.models import User, Portfolio, Asset, Transaction, TransactionType
from app.auth import get_password_hash

# Import test utilities
from tests.factories import setup_factories


# Use in-memory SQLite for testing
TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="function", autouse=True)
def clear_caches():
    """Clear all service caches before each test"""
    # Clear metrics service caches
    from app.services import metrics
    if hasattr(metrics, '_task_cache'):
        metrics._task_cache.clear()
    if hasattr(metrics, '_result_cache'):
        metrics._result_cache.clear()
    
    # Clear pricing service caches
    from app.services import pricing
    if hasattr(pricing, '_price_memory_cache'):
        pricing._price_memory_cache.clear()
    if hasattr(pricing, '_ongoing_fetches'):
        pricing._ongoing_fetches.clear()
    # Reset locks to avoid event loop issues
    if hasattr(pricing, '_fetch_lock'):
        pricing._fetch_lock = None
        pricing._fetch_lock_loop = None
    if hasattr(pricing, '_memory_cache_lock'):
        pricing._memory_cache_lock = None
        pricing._memory_cache_loop = None
    
    # Clear currency service cache
    from app.services import currency
    if hasattr(currency, '_exchange_rate_cache'):
        currency._exchange_rate_cache.clear()
    
    # Clear insights service cache
    from app.services import insights
    if hasattr(insights, '_insights_cache'):
        insights._insights_cache.clear()
    
    yield
    
    # Clear again after test
    if hasattr(metrics, '_task_cache'):
        metrics._task_cache.clear()
    if hasattr(metrics, '_result_cache'):
        metrics._result_cache.clear()
    if hasattr(pricing, '_price_memory_cache'):
        pricing._price_memory_cache.clear()
    if hasattr(pricing, '_ongoing_fetches'):
        pricing._ongoing_fetches.clear()
    if hasattr(currency, '_exchange_rate_cache'):
        currency._exchange_rate_cache.clear()
    if hasattr(insights, '_insights_cache'):
        insights._insights_cache.clear()


@pytest.fixture(scope="function")
def test_db() -> Generator[Session, None, None]:
    """Create test database with proper schema handling"""
    # Use StaticPool for SQLite :memory: to ensure single connection
    # This prevents issues where different connections get different in-memory databases
    from sqlalchemy.pool import StaticPool
    
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,  # Critical for :memory: databases
        echo=False  # Set to True for SQL debugging
    )
    
    # Store original schemas to restore later
    original_schemas = {}
    for table_name, table in Base.metadata.tables.items():
        original_schemas[table_name] = table.schema
        table.schema = None
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    # Create session with expire_on_commit=False to prevent lazy-loading issues
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)
    db = TestSessionLocal()
    
    # Configure factories to use this session
    setup_factories(db)
    
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
        
        # Restore original schemas for other tests
        for table_name, schema in original_schemas.items():
            if table_name in Base.metadata.tables:
                Base.metadata.tables[table_name].schema = schema


@pytest.fixture(scope="function")
def client(test_db: Session) -> Generator[TestClient, None, None]:
    """Create test client with database override"""
    def override_get_db():
        try:
            yield test_db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(test_db: Session) -> User:
    """Create a test user for authentication tests"""
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=get_password_hash("testpassword123"),
        is_active=True
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def auth_headers(client: TestClient, test_user: User) -> dict:
    """Get authentication headers for test user"""
    response = client.post(
        "/auth/login",
        data={"username": "test@example.com", "password": "testpassword123"}
    )
    if response.status_code == 200:
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    return {}


@pytest.fixture
def sample_portfolio(test_db: Session, test_user: User) -> Portfolio:
    """Create a sample portfolio for testing"""
    portfolio = Portfolio(
        user_id=test_user.id,
        name="Test Portfolio",
        description="A test portfolio",
        base_currency="USD"
    )
    test_db.add(portfolio)
    test_db.commit()
    test_db.refresh(portfolio)
    return portfolio


@pytest.fixture
def sample_asset(test_db: Session) -> Asset:
    """Create a sample asset for testing"""
    from app.models.enums import AssetClass
    asset = Asset(
        symbol="AAPL",
        name="Apple Inc.",
        currency="USD",
        class_=AssetClass.STOCK
    )
    test_db.add(asset)
    test_db.commit()
    test_db.refresh(asset)
    return asset


@pytest.fixture
def sample_transaction(test_db: Session, sample_portfolio: Portfolio, sample_asset: Asset) -> Transaction:
    """Create a sample transaction for testing"""
    transaction = Transaction(
        portfolio_id=sample_portfolio.id,
        asset_id=sample_asset.id,
        tx_date=date.today(),
        type=TransactionType.BUY,
        quantity=Decimal("10"),
        price=Decimal("150.00"),
        fees=Decimal("10.00"),
        currency="USD"
    )
    test_db.add(transaction)
    test_db.commit()
    test_db.refresh(transaction)
    return transaction
