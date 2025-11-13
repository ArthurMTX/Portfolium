"""
User model and authentication
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric
from sqlalchemy.orm import relationship

from app.db import Base


class User(Base):
    """Application user with authentication"""
    __tablename__ = "users"
    __table_args__ = {"schema": "portfolio"}
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_superuser = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    verification_token = Column(String, index=True)
    verification_token_expires = Column(DateTime)
    reset_password_token = Column(String, index=True)
    reset_password_token_expires = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime)
    
    # Notification settings
    daily_change_notifications_enabled = Column(Boolean, default=True)
    daily_change_threshold_pct = Column(Numeric(5, 2), default=5.0)  # Default 5% threshold
    transaction_notifications_enabled = Column(Boolean, default=True)  # Enable/disable transaction notifications
    daily_report_enabled = Column(Boolean, default=False)  # Enable/disable daily PDF report emails
    
    # Language preference
    preferred_language = Column(String(5), default='en')  # User's preferred language (en, fr, etc.)
    
    # Relationships
    portfolios = relationship("Portfolio", back_populates="user", cascade="all, delete-orphan")
