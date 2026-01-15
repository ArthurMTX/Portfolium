"""
Pending Dividend model for auto-fetched dividends awaiting user confirmation
"""
import enum
from datetime import datetime
from sqlalchemy import Column, Integer, ForeignKey, String, Date, DateTime, Numeric, Enum, JSON
from sqlalchemy.orm import relationship

from app.db import Base


class PendingDividendStatus(str, enum.Enum):
    """Status of a pending dividend"""
    PENDING = "PENDING"       # Awaiting user review
    ACCEPTED = "ACCEPTED"     # User accepted, transaction created
    REJECTED = "REJECTED"     # User rejected (e.g., already recorded manually)
    EXPIRED = "EXPIRED"       # Too old, automatically expired


class PendingDividend(Base):
    """
    Auto-fetched dividend from yfinance awaiting user confirmation.
    
    These dividends are fetched automatically based on user's holdings at the 
    ex-dividend date. Users must accept them to create actual DIVIDEND transactions,
    which prevents incorrect data from affecting P&L calculations.
    """
    __tablename__ = "pending_dividends"
    __table_args__ = {"schema": "portfolio"}
    
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolio.portfolios.id", ondelete="CASCADE"), nullable=False)
    asset_id = Column(Integer, ForeignKey("portfolio.assets.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("portfolio.users.id", ondelete="CASCADE"), nullable=False)
    
    # Dividend details from yfinance
    ex_dividend_date = Column(Date, nullable=False)  # When you needed to own shares
    payment_date = Column(Date, nullable=True)        # When dividend is paid (if available)
    dividend_per_share = Column(Numeric(20, 8), nullable=False)  # Amount per share from yfinance
    
    # Calculated based on user's holdings at ex-dividend date
    shares_held = Column(Numeric(20, 8), nullable=False)  # Shares held on ex-dividend date
    gross_amount = Column(Numeric(20, 8), nullable=False)  # dividend_per_share * shares_held
    currency = Column(String, nullable=True)  # Currency of the dividend
    
    # Status tracking
    status = Column(Enum(PendingDividendStatus), nullable=False, default=PendingDividendStatus.PENDING)
    fetched_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)  # When accepted/rejected
    
    # Link to created transaction (if accepted)
    transaction_id = Column(Integer, ForeignKey("portfolio.transactions.id", ondelete="SET NULL"), nullable=True)
    
    # Store raw yfinance data for debugging/auditing
    yfinance_raw_data = Column(JSON, nullable=True)
    
    # Relationships
    portfolio = relationship("Portfolio")
    asset = relationship("Asset")
    user = relationship("User")
    transaction = relationship("Transaction", foreign_keys=[transaction_id])
    
    def __repr__(self):
        return (
            f"<PendingDividend(id={self.id}, asset_id={self.asset_id}, "
            f"ex_date={self.ex_dividend_date}, amount={self.gross_amount}, status={self.status})>"
        )
