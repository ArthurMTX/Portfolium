"""
CRUD operations for push subscriptions
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models.push_subscription import PushSubscription


def get_subscription_by_endpoint(db: Session, endpoint: str) -> Optional[PushSubscription]:
    """Get a push subscription by its endpoint URL"""
    return db.query(PushSubscription).filter(PushSubscription.endpoint == endpoint).first()


def get_subscriptions_by_user(db: Session, user_id: int, active_only: bool = True) -> List[PushSubscription]:
    """Get all push subscriptions for a user"""
    query = db.query(PushSubscription).filter(PushSubscription.user_id == user_id)
    if active_only:
        query = query.filter(PushSubscription.is_active == True)
    return query.all()


def get_all_active_subscriptions(db: Session) -> List[PushSubscription]:
    """Get all active push subscriptions"""
    return db.query(PushSubscription).filter(PushSubscription.is_active == True).all()


def create_subscription(
    db: Session,
    user_id: int,
    endpoint: str,
    p256dh_key: str,
    auth_key: str,
    user_agent: Optional[str] = None,
    device_name: Optional[str] = None
) -> PushSubscription:
    """Create a new push subscription or update existing one"""
    # Check if subscription already exists for this endpoint
    existing = get_subscription_by_endpoint(db, endpoint)
    if existing:
        # Update the existing subscription (might be a refresh)
        existing.user_id = user_id
        existing.p256dh_key = p256dh_key
        existing.auth_key = auth_key
        existing.user_agent = user_agent
        existing.device_name = device_name
        existing.is_active = True
        existing.failed_count = 0
        db.commit()
        db.refresh(existing)
        return existing
    
    # Create new subscription
    subscription = PushSubscription(
        user_id=user_id,
        endpoint=endpoint,
        p256dh_key=p256dh_key,
        auth_key=auth_key,
        user_agent=user_agent,
        device_name=device_name
    )
    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    return subscription


def deactivate_subscription(db: Session, endpoint: str) -> bool:
    """Deactivate a push subscription by endpoint"""
    subscription = get_subscription_by_endpoint(db, endpoint)
    if subscription:
        subscription.is_active = False
        db.commit()
        return True
    return False


def delete_subscription(db: Session, endpoint: str) -> bool:
    """Delete a push subscription by endpoint"""
    subscription = get_subscription_by_endpoint(db, endpoint)
    if subscription:
        db.delete(subscription)
        db.commit()
        return True
    return False


def delete_user_subscriptions(db: Session, user_id: int) -> int:
    """Delete all push subscriptions for a user"""
    deleted = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).delete()
    db.commit()
    return deleted


def mark_subscription_used(db: Session, subscription: PushSubscription) -> None:
    """Mark a subscription as successfully used"""
    subscription.last_used_at = datetime.utcnow()
    subscription.failed_count = 0
    db.commit()


def mark_subscription_failed(db: Session, subscription: PushSubscription, max_failures: int = 5) -> None:
    """
    Mark a subscription as failed.
    If failed too many times, deactivate it.
    """
    subscription.failed_count += 1
    if subscription.failed_count >= max_failures:
        subscription.is_active = False
    db.commit()


def get_subscription_count(db: Session, user_id: int) -> int:
    """Get the number of active subscriptions for a user"""
    return db.query(PushSubscription).filter(
        PushSubscription.user_id == user_id,
        PushSubscription.is_active == True
    ).count()
