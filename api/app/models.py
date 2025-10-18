"""
SQLAlchemy ORM models
"""
from datetime import datetime, date
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Column, Integer, String, Numeric, Date, DateTime, 
    ForeignKey, Enum, BigInteger, Text, JSON
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
    
    # Relationships
    transactions = relationship("Transaction", back_populates="asset")
    prices = relationship("Price", back_populates="asset", cascade="all, delete-orphan")


class Portfolio(Base):
    """Investment portfolio"""
    __tablename__ = "portfolios"
    __table_args__ = {"schema": "portfolio"}
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    base_currency = Column(String, default="EUR")
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
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
