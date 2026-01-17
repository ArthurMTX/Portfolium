"""
Calendar models - Earnings cache
"""
from datetime import datetime, date
from sqlalchemy import Column, Integer, String, DateTime, Date, Boolean, Numeric, Text
from sqlalchemy.dialects.postgresql import JSONB

from app.db import Base


class EarningsCache(Base):
    """Cached earnings data from yfinance"""
    __tablename__ = "earnings_cache"
    __table_args__ = {"schema": "portfolio"}
    
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    earnings_date = Column(Date, index=True)
    is_confirmed = Column(Boolean, default=False)
    eps_estimate = Column(Numeric(20, 8))
    eps_actual = Column(Numeric(20, 8))
    revenue_estimate = Column(Numeric(20, 2))
    revenue_actual = Column(Numeric(20, 2))
    surprise_pct = Column(Numeric(10, 4))
    fiscal_quarter = Column(String(10))
    fiscal_year = Column(Integer)
    raw_data = Column(JSONB)
    fetched_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
