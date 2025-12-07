"""
Portfolio goal models
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric, Date, Text, Boolean
from sqlalchemy.orm import relationship

from app.db import Base


class PortfolioGoal(Base):
    """Financial goal for a portfolio"""
    __tablename__ = "portfolio_goals"
    __table_args__ = {"schema": "portfolio"}
    
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolio.portfolios.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=False)
    target_amount = Column(Numeric(20, 2), nullable=False)
    target_date = Column(Date, nullable=True)
    monthly_contribution = Column(Numeric(20, 2), default=0, nullable=False)
    category = Column(String, nullable=False, default="other")
    description = Column(Text, nullable=True)
    color = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    portfolio = relationship("Portfolio", back_populates="goals")
