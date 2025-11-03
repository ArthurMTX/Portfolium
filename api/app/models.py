"""
SQLAlchemy ORM models
"""
from datetime import datetime, date
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Column, Integer, String, Numeric, Date, DateTime, 
    ForeignKey, Enum, BigInteger, Text, JSON, Boolean, LargeBinary
)
from sqlalchemy.orm import relationship
import enum

from app.db import Base


class AssetClass(str, enum.Enum):
    """Asset class enumeration"""
    STOCK = "stock"
    ETF = "etf"
    CRYPTO = "crypto"
    CASH = "cash"


class TransactionType(str, enum.Enum):
    """Transaction type enumeration"""
    BUY = "BUY"
    SELL = "SELL"
    DIVIDEND = "DIVIDEND"
    FEE = "FEE"
    SPLIT = "SPLIT"
    TRANSFER_IN = "TRANSFER_IN"
    TRANSFER_OUT = "TRANSFER_OUT"


class NotificationType(str, enum.Enum):
    """Notification type enumeration"""
    TRANSACTION_CREATED = "TRANSACTION_CREATED"
    TRANSACTION_UPDATED = "TRANSACTION_UPDATED"
    TRANSACTION_DELETED = "TRANSACTION_DELETED"
    LOGIN = "LOGIN"
    PRICE_ALERT = "PRICE_ALERT"
    DAILY_CHANGE_UP = "DAILY_CHANGE_UP"
    DAILY_CHANGE_DOWN = "DAILY_CHANGE_DOWN"
    SYSTEM = "SYSTEM"


class User(Base):
    """Application user with authentication"""
    __tablename__ = "users"
    __table_args__ = {"schema": "portfolio"}
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_superuser = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    verification_token = Column(String, index=True)
    verification_token_expires = Column(DateTime)
    reset_password_token = Column(String, index=True)
    reset_password_token_expires = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime)
    
    # Notification settings
    daily_change_notifications_enabled = Column(Boolean, default=True)
    daily_change_threshold_pct = Column(Numeric(5, 2), default=5.0)  # Default 5% threshold
    transaction_notifications_enabled = Column(Boolean, default=True)  # Enable/disable transaction notifications
    daily_report_enabled = Column(Boolean, default=False)  # Enable/disable daily PDF report emails
    
    # Relationships
    portfolios = relationship("Portfolio", back_populates="user", cascade="all, delete-orphan")


class Asset(Base):
    """Financial asset (stock, ETF, crypto)"""
    __tablename__ = "assets"
    __table_args__ = {"schema": "portfolio"}
    
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, unique=True, nullable=False, index=True)
    name = Column(String)
    currency = Column(String, default="USD")
    class_ = Column("class", Enum(AssetClass, values_callable=lambda x: [e.value for e in x]), default=AssetClass.STOCK)
    sector = Column(String)
    industry = Column(String)
    asset_type = Column(String)  # 'EQUITY', 'ETF', 'CRYPTO', etc.
    country = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Logo caching
    logo_data = Column(LargeBinary)  # Binary logo data (WebP or SVG)
    logo_content_type = Column(String)  # MIME type (image/webp, image/svg+xml)
    logo_fetched_at = Column(DateTime)  # When logo was last fetched
    
    # Price history tracking
    first_transaction_date = Column(Date)  # Date of first transaction, used for historical price backfill
    
    # Relationships
    transactions = relationship("Transaction", back_populates="asset")
    prices = relationship("Price", back_populates="asset", cascade="all, delete-orphan")
    metadata_overrides = relationship("AssetMetadataOverride", back_populates="asset", cascade="all, delete-orphan")


class AssetMetadataOverride(Base):
    """User-specific metadata overrides for assets"""
    __tablename__ = "asset_metadata_overrides"
    __table_args__ = (
        {"schema": "portfolio"},
    )
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("portfolio.users.id", ondelete="CASCADE"), nullable=False)
    asset_id = Column(Integer, ForeignKey("portfolio.assets.id", ondelete="CASCADE"), nullable=False)
    sector_override = Column(String)
    industry_override = Column(String)
    country_override = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    asset = relationship("Asset", back_populates="metadata_overrides")


class Portfolio(Base):
    """Investment portfolio"""
    __tablename__ = "portfolios"
    __table_args__ = {"schema": "portfolio"}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("portfolio.users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False, index=True)
    base_currency = Column(String, default="EUR")
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="portfolios")
    transactions = relationship("Transaction", back_populates="portfolio", cascade="all, delete-orphan")


class Transaction(Base):
    """Portfolio transaction"""
    __tablename__ = "transactions"
    __table_args__ = {"schema": "portfolio"}
    
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolio.portfolios.id", ondelete="CASCADE"), nullable=False)
    asset_id = Column(Integer, ForeignKey("portfolio.assets.id", ondelete="RESTRICT"), nullable=False)
    tx_date = Column(Date, nullable=False, index=True)
    type = Column(Enum(TransactionType), nullable=False)
    quantity = Column(Numeric(20, 8), nullable=False, default=0)
    price = Column(Numeric(20, 8), nullable=False, default=0)
    fees = Column(Numeric(20, 8), nullable=False, default=0)
    currency = Column(String, default="USD")
    meta_data = Column("metadata", JSON, default={})
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    portfolio = relationship("Portfolio", back_populates="transactions")
    asset = relationship("Asset", back_populates="transactions")


class Price(Base):
    """Asset price cache"""
    __tablename__ = "prices"
    __table_args__ = {"schema": "portfolio"}
    
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("portfolio.assets.id", ondelete="CASCADE"), nullable=False)
    asof = Column(DateTime, nullable=False, index=True)
    price = Column(Numeric(20, 8), nullable=False)
    volume = Column(BigInteger)
    source = Column(String, default="yfinance")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    asset = relationship("Asset", back_populates="prices")


class Watchlist(Base):
    """User watchlist for tracking assets without owning them"""
    __tablename__ = "watchlist"
    __table_args__ = {"schema": "portfolio"}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("portfolio.users.id", ondelete="CASCADE"), nullable=False)
    asset_id = Column(Integer, ForeignKey("portfolio.assets.id", ondelete="CASCADE"), nullable=False)
    notes = Column(Text)
    alert_target_price = Column(Numeric(20, 8))
    alert_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    asset = relationship("Asset")


class Notification(Base):
    """User notification for transactions, logins, price alerts"""
    __tablename__ = "notifications"
    __table_args__ = {"schema": "portfolio"}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("portfolio.users.id", ondelete="CASCADE"), nullable=False)
    type = Column(Enum(NotificationType), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    meta_data = Column("metadata", JSON, default={})
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    user = relationship("User")
