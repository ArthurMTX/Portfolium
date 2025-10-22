I"""
Test configuration
"""
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.db import Base


# Use in-memory SQLite for testing
TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="function")
def test_db():
    """Create test database"""
    engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    
    # For SQLite, ignore schema names (portfolio.table becomes just table)
    @event.listens_for(Base.metadata, "before_create")
    def _receive_before_create(target, connection, **kw):
        """Remove schema names for SQLite"""
        for table in target.tables.values():
            table.schema = None
    
    Base.metadata.create_all(bind=engine)
    
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestSessionLocal()
    
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
