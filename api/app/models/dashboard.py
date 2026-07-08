"""
Dashboard layout model for user customization
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, ForeignKey, String, Text, Boolean, DateTime, JSON
from sqlalchemy.orm import relationship

from app.db import Base


def generate_layout_uuid():
    """Generate a unique public identifier for a dashboard layout (board)"""
    return str(uuid.uuid4())


class DashboardLayout(Base):
    """User's custom dashboard layout configurations"""
    __tablename__ = "dashboard_layouts"
    __table_args__ = {"schema": "portfolio"}

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, index=True, nullable=False, default=generate_layout_uuid)
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
