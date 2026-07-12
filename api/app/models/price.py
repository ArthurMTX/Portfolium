"""
Price model for asset price caching
"""
from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, ForeignKey, Numeric, BigInteger, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db import Base


class Price(Base):
    """Asset price cache"""
    __tablename__ = "prices"
    __table_args__ = (
        UniqueConstraint("asset_id", "asof", name="uq_prices_asset_asof"),
        {"schema": "portfolio"},
    )
    
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("portfolio.assets.id", ondelete="CASCADE"), nullable=False)
    asof = Column(DateTime, nullable=False, index=True)
    price = Column(Numeric(20, 8), nullable=False)
    open_price = Column(Numeric(20, 8))
    high_price = Column(Numeric(20, 8))
    low_price = Column(Numeric(20, 8))
    close_price = Column(Numeric(20, 8))
    volume = Column(BigInteger)
    source = Column(String, default="yfinance")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    asset = relationship("Asset", back_populates="prices")
