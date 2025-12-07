"""
Notification model for user alerts
"""
from datetime import datetime
from sqlalchemy import Column, Integer, ForeignKey, String, Text, JSON, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship

from app.db import Base
from app.models.enums import NotificationType


class Notification(Base):
    """User notification for transactions, logins, price alerts"""
    __tablename__ = "notifications"
    __table_args__ = {"schema": "portfolio"}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("portfolio.users.id", ondelete="CASCADE"), nullable=False)
    type = Column(Enum(NotificationType), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    meta_data = Column("metadata", JSON, default={})
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    user = relationship("User")
