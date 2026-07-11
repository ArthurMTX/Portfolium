"""
Test configuration and fixtures
"""
import asyncio
import os
import sys
from functools import partial
from typing import Generator
from decimal import Decimal
from datetime import date

import anyio
import httpx
import pytest
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.schema import DefaultClause
from sqlalchemy.sql import text
from sqlalchemy.orm import sessionmaker, Session

# Load test environment variables before importing application modules.
load_dotenv(".env.test")

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User, Portfolio, Asset, Transaction, TransactionType  # noqa: E402
from app.auth import get_password_hash  # noqa: E402

# Import test utilities
from tests.factories import setup_factories  # noqa: E402


async def _run_sync_inline(func, *args, **kwargs):
    """Execute Starlette sync dependencies inline in the isolated test loop.

    The managed sandbox does not reliably terminate or wake executor worker
    threads. Production continues to use AnyIO's normal threadpool behavior;
    only the pytest process receives this deterministic test adapter.
    """
    del kwargs
    return func(*args)


anyio.to_thread.run_sync = _run_sync_inline


class ASGITestClient:
    """Synchronous facade over HTTPX's async ASGI transport.

    Starlette's TestClient relies on an AnyIO cross-thread portal. That portal
    cannot schedule work in restricted sandbox environments and hangs before
    the first request. Keeping one event loop in the pytest thread avoids the
    thread handoff while preserving a persistent HTTP client and app lifespan.
    """

    def __init__(self, application):
        self.application = application
        self._loop = asyncio.new_event_loop()
        self._client: httpx.AsyncClient | None = None
        self._lifespan = None

    def __enter__(self):
        async def start():
            self._lifespan = self.application.router.lifespan_context(self.application)
            await self._lifespan.__aenter__()
            self._client = httpx.AsyncClient(
                transport=httpx.ASGITransport(
                    app=self.application,
                    raise_app_exceptions=True,
                ),
                base_url="http://testserver",
                follow_redirects=True,
            )

        self._loop.run_until_complete(start())
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        async def stop():
            if self._client is not None:
                await self._client.aclose()
            if self._lifespan is not None:
                await self._lifespan.__aexit__(exc_type, exc_value, traceback)

        try:
            self._loop.run_until_complete(stop())
        finally:
            self._loop.close()

    def request(self, method: str, url: str, **kwargs) -> httpx.Response:
        if self._client is None:
            raise RuntimeError("ASGITestClient must be used as a context manager")
        return self._loop.run_until_complete(
            partial(self._client.request, method, url, **kwargs)()
        )

    def get(self, url: str, **kwargs) -> httpx.Response:
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs) -> httpx.Response:
        return self.request("POST", url, **kwargs)

    def put(self, url: str, **kwargs) -> httpx.Response:
        return self.request("PUT", url, **kwargs)

    def patch(self, url: str, **kwargs) -> httpx.Response:
        return self.request("PATCH", url, **kwargs)

    def delete(self, url: str, **kwargs) -> httpx.Response:
        return self.request("DELETE", url, **kwargs)


@compiles(JSONB, "sqlite")
def compile_jsonb_for_sqlite(type_, compiler, **kw):
    """Allow PostgreSQL JSONB columns to be created in SQLite test databases."""
    return "JSON"


# Use in-memory SQLite for testing
TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="function", autouse=True)
def clear_caches():
    """Reset process-local caches without requiring external services."""
    from app.services.portfolio_analytics import metrics
    metrics._ongoing_calculations.clear()
    metrics._db_lock = None
    metrics._cache_lock = None
    
    # Clear pricing service caches
    from app.services.market_data import pricing
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
    from app.services.market_data import currency
    if hasattr(currency, '_exchange_rate_cache'):
        currency._exchange_rate_cache.clear()
    
    # Clear insights service cache
    from app.services.portfolio_analytics import insights
    if hasattr(insights, '_insights_cache'):
        insights._insights_cache.clear()

    from app.services.security.rate_limit import reset_local_rate_limits
    from app.redis_client import close_redis_connection

    reset_local_rate_limits()
    close_redis_connection()
    
    yield
    
    # Clear again after test
    metrics._ongoing_calculations.clear()
    metrics._db_lock = None
    metrics._cache_lock = None
    if hasattr(pricing, '_price_memory_cache'):
        pricing._price_memory_cache.clear()
    if hasattr(pricing, '_ongoing_fetches'):
        pricing._ongoing_fetches.clear()
    if hasattr(currency, '_exchange_rate_cache'):
        currency._exchange_rate_cache.clear()
    if hasattr(insights, '_insights_cache'):
        insights._insights_cache.clear()
    reset_local_rate_limits()
    close_redis_connection()


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
    original_server_defaults = {}
    for table_name, table in Base.metadata.tables.items():
        original_schemas[table_name] = table.schema
        table.schema = None
        for column in table.columns:
            server_default = column.server_default
            if server_default is not None and "::jsonb" in str(server_default.arg):
                original_server_defaults[(table_name, column.name)] = server_default
                column.server_default = DefaultClause(
                    text(str(server_default.arg).replace("::jsonb", ""))
                )
    
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
        for (table_name, column_name), server_default in original_server_defaults.items():
            if (
                table_name in Base.metadata.tables
                and column_name in Base.metadata.tables[table_name].columns
            ):
                Base.metadata.tables[table_name].columns[column_name].server_default = server_default


@pytest.fixture(scope="function")
def client(test_db: Session) -> Generator[ASGITestClient, None, None]:
    """Create test client with database override"""
    def override_get_db():
        try:
            yield test_db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    with ASGITestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(test_db: Session) -> User:
    """Create a test user for authentication tests"""
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=get_password_hash("testpassword123"),
        is_active=True,
        # A fully onboarded user: login must keep working even in
        # configurations where ENABLE_EMAIL requires verified accounts.
        is_verified=True
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def auth_headers(client: ASGITestClient, test_user: User) -> dict:
    """Get authentication headers for test user"""
    response = client.post(
        "/auth/login",
        data={"username": "test@example.com", "password": "testpassword123"}
    )
    # Fail loudly here: silently returning {} used to convert any login
    # breakage into dozens of confusing 401s in downstream tests.
    assert response.status_code == 200, (
        f"auth_headers fixture could not log in the test user: "
        f"{response.status_code} {response.text}"
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


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
