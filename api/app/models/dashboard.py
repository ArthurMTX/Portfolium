"""
Dashboard layout model for user customization
"""
from datetime import datetime
from sqlalchemy import Column, Integer, ForeignKey, String, Text, Boolean, DateTime, JSON
from sqlalchemy.orm import relationship

from app.db import Base


class DashboardLayout(Base):
    """User's custom dashboard layout configurations"""
    __tablename__ = "dashboard_layouts"
    __table_args__ = {"schema": "portfolio"}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("portfolio.users.id", ondelete="CASCADE"), nullable=False, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolio.portfolios.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    is_default = Column(Boolean, default=False, nullable=False)
    is_shared = Column(Boolean, default=False, nullable=False)
    layout_config = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User")
    portfolio = relationship("Portfolio")
