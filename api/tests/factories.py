"""
Factory classes for creating test data
Using factory_boy for creating model instances
"""
from datetime import date, datetime
from decimal import Decimal
import factory
from factory.alchemy import SQLAlchemyModelFactory
from faker import Faker

from app.models import User, Portfolio, Asset, Transaction, TransactionType, Price, AssetClass

fake = Faker()


class UserFactory(SQLAlchemyModelFactory):
    """Factory for creating User instances"""
    
    class Meta:
        model = User
        sqlalchemy_session = None
        sqlalchemy_session_persistence = "commit"
    
    username = factory.Sequence(lambda n: f"user_{n}")
    email = factory.LazyAttribute(lambda obj: f"{obj.username}@test.example.com")
    hashed_password = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqYo3cKZwy"  # "password"
    is_active = True


class PortfolioFactory(SQLAlchemyModelFactory):
    """Factory for creating Portfolio instances"""
    
    class Meta:
        model = Portfolio
        sqlalchemy_session = None
        sqlalchemy_session_persistence = "commit"
    
    name = factory.Faker("company")
    description = factory.Faker("catch_phrase")
    base_currency = "USD"
    user_id = None  # Must be set when using


class AssetFactory(SQLAlchemyModelFactory):
    """Factory for creating Asset instances"""
    
    class Meta:
        model = Asset
        sqlalchemy_session = None
        sqlalchemy_session_persistence = "commit"
    
    symbol = factory.Sequence(lambda n: f"TST{n:03d}")
    name = factory.Faker("company")
    currency = "USD"
    class_ = AssetClass.STOCK  # Note: mapped to 'class' column


class TransactionFactory(SQLAlchemyModelFactory):
    """Factory for creating Transaction instances"""
    
    class Meta:
        model = Transaction
        sqlalchemy_session = None
        sqlalchemy_session_persistence = "commit"
    
    portfolio_id = None  # Must be set when using
    asset_id = None  # Must be set when using
    tx_date = factory.LazyFunction(date.today)
    type = TransactionType.BUY
    quantity = factory.LazyFunction(lambda: Decimal("10"))
    price = factory.LazyFunction(lambda: Decimal("100.00"))
    fees = factory.LazyFunction(lambda: Decimal("0.00"))
    currency = "USD"
    notes = factory.Faker("sentence")


class PriceFactory(SQLAlchemyModelFactory):
    """Factory for creating Price instances"""
    
    class Meta:
        model = Price
        sqlalchemy_session = None
        sqlalchemy_session_persistence = "commit"
    
    asset_id = None  # Must be set when using
    price = factory.LazyFunction(lambda: Decimal("100.00"))
    asof = factory.LazyFunction(datetime.utcnow)
    volume = factory.LazyFunction(lambda: fake.random_int(min=1000000, max=100000000))


def setup_factories(session):
    """Configure all factories to use the given database session"""
    UserFactory._meta.sqlalchemy_session = session
    PortfolioFactory._meta.sqlalchemy_session = session
    AssetFactory._meta.sqlalchemy_session = session
    TransactionFactory._meta.sqlalchemy_session = session
    PriceFactory._meta.sqlalchemy_session = session
