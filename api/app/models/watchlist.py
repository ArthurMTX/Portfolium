"""
Watchlist model for tracking assets
"""
from datetime import datetime
from sqlalchemy import Column, Integer, ForeignKey, Text, Numeric, Boolean, DateTime, String, Table
from sqlalchemy.orm import relationship

from app.db import Base


# Association table for many-to-many relationship between Watchlist and WatchlistTag
watchlist_item_tags = Table(
    'watchlist_item_tags',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('watchlist_item_id', Integer, ForeignKey('portfolio.watchlist.id', ondelete='CASCADE'), nullable=False),
    Column('tag_id', Integer, ForeignKey('portfolio.watchlist_tags.id', ondelete='CASCADE'), nullable=False),
    Column('created_at', DateTime, default=datetime.utcnow),
    schema='portfolio'
)


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
    tags = relationship("WatchlistTag", secondary=watchlist_item_tags, back_populates="watchlist_items")


class WatchlistTag(Base):
    """Tags for organizing watchlist items"""
    __tablename__ = "watchlist_tags"
    __table_args__ = {"schema": "portfolio"}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("portfolio.users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    icon = Column(String(50), nullable=False, default='tag')
    color = Column(String(20), nullable=False, default='#6366f1')
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    watchlist_items = relationship("Watchlist", secondary=watchlist_item_tags, back_populates="tags")
