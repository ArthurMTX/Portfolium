"""
Push Subscription model for Web Push notifications
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.db import Base


class PushSubscription(Base):
    """Web Push notification subscription for a user's device"""
    __tablename__ = "push_subscriptions"
    __table_args__ = {"schema": "portfolio"}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("portfolio.users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Web Push subscription data
    endpoint = Column(Text, nullable=False, unique=True)  # Push service endpoint URL
    p256dh_key = Column(Text, nullable=False)  # Client public key for encryption
    auth_key = Column(Text, nullable=False)  # Auth secret for AEAD encryption
    
    # Device information
    user_agent = Column(String(500), nullable=True)  # Browser/device user agent
    device_name = Column(String(100), nullable=True)  # User-friendly device name
    
    # Subscription status
    is_active = Column(Boolean, default=True, nullable=False)
    failed_count = Column(Integer, default=0, nullable=False)  # Track failed push attempts
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_used_at = Column(DateTime, nullable=True)  # Last successful push sent
    
    # Relationships
    user = relationship("User", backref="push_subscriptions")
    
    def __repr__(self):
        return f"<PushSubscription(id={self.id}, user_id={self.user_id}, device={self.device_name})>"
    
    def to_subscription_info(self) -> dict:
        """Convert to the format required by pywebpush"""
        return {
            "endpoint": self.endpoint,
            "keys": {
                "p256dh": self.p256dh_key,
                "auth": self.auth_key
            }
        }
