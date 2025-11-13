"""
Watchlist model for tracking assets
"""
from datetime import datetime
from sqlalchemy import Column, Integer, ForeignKey, Text, Numeric, Boolean, DateTime
from sqlalchemy.orm import relationship

from app.db import Base


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
