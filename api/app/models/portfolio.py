"""
Portfolio and transaction models
"""
from datetime import datetime
import uuid
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Numeric, Date, Text, JSON, Boolean
from sqlalchemy.orm import relationship

from app.db import Base
from app.models.enums import CashMode, TransactionType


def generate_share_token():
    """Generate a unique share token for public portfolio access"""
    return str(uuid.uuid4())


class Portfolio(Base):
    """Investment portfolio"""
    __tablename__ = "portfolios"
    __table_args__ = {"schema": "portfolio"}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("portfolio.users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False, index=True)
    base_currency = Column(String, default="EUR")
    description = Column(Text)
    is_public = Column(Boolean, default=False, nullable=False)
    share_token = Column(String(36), unique=True, index=True, default=generate_share_token)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_accessed_at = Column(DateTime, default=datetime.utcnow, index=True)
    # Cash tracking (see docs/technical/cash-ledger.md)
    cash_mode = Column(
        Enum(
            CashMode,
            name="cash_mode",
            schema="portfolio",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=CashMode.UNTRACKED,
        server_default=CashMode.UNTRACKED.value,
    )
    cash_tracking_started_on = Column(Date, nullable=True)
    cash_activation_id = Column(String(36), unique=True, nullable=True)
    cash_activation_meta = Column(JSON, nullable=True)
    # Monotonic transaction-revision counter, bumped by every transaction
    # create/update/delete regardless of cash mode. Compared against
    # cash_ledger_synced_seq to detect a ledger left stale while untracked.
    tx_change_seq = Column(Integer, nullable=False, default=0, server_default="0")
    cash_ledger_synced_seq = Column(Integer, nullable=True)

    # Relationships
    user = relationship("User", back_populates="portfolios")
    transactions = relationship("Transaction", back_populates="portfolio", cascade="all, delete-orphan")
    goals = relationship("PortfolioGoal", back_populates="portfolio", cascade="all, delete-orphan")
    cash_accounts = relationship("CashAccount", back_populates="portfolio", cascade="all, delete-orphan")
    cash_movements = relationship("CashMovement", back_populates="portfolio", cascade="all, delete-orphan")


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
    cash_movements = relationship("CashMovement", back_populates="transaction", cascade="all, delete-orphan")
