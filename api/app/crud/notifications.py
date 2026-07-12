"""
CRUD operations for notifications
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models import Notification, NotificationType


def create_notification(
    db: Session,
    user_id: int,
    notification_type: NotificationType,
    title: str,
    message: str,
    metadata: Optional[Dict[str, Any]] = None
) -> Notification:
    """Create a new notification"""
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        meta_data=metadata or {}
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    from app.observability.metrics import NOTIFICATIONS_CREATED

    NOTIFICATIONS_CREATED.inc()
    return notification


def get_user_notifications(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 50,
    unread_only: bool = False
) -> List[Notification]:
    """Get notifications for a user"""
    query = db.query(Notification).filter(Notification.user_id == user_id)
    
    if unread_only:
        query = query.filter(Notification.is_read.is_(False))
    
    query = query.order_by(desc(Notification.created_at))
    query = query.offset(skip).limit(limit)
    
    return query.all()


def daily_change_notification_exists(
    db: Session,
    user_id: int,
    asset_id: int,
    session_id: str,
) -> bool:
    """Check daily-change deduplication keys without database-specific JSON SQL."""
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .filter(
            Notification.type.in_(
                [
                    NotificationType.DAILY_CHANGE_UP,
                    NotificationType.DAILY_CHANGE_DOWN,
                ]
            )
        )
        .all()
    )
    return any(
        notification.meta_data.get("asset_id") == asset_id
        and notification.meta_data.get("session_id") == session_id
        for notification in notifications
    )


def get_notification(db: Session, notification_id: int) -> Optional[Notification]:
    """Get a specific notification by ID"""
    return db.query(Notification).filter(Notification.id == notification_id).first()


def get_unread_count(db: Session, user_id: int) -> int:
    """Get count of unread notifications for a user"""
    return db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read.is_(False)
    ).count()


def mark_as_read(db: Session, notification_id: int) -> Optional[Notification]:
    """Mark a notification as read"""
    notification = get_notification(db, notification_id)
    if notification:
        notification.is_read = True
        db.commit()
        db.refresh(notification)
    return notification


def mark_all_as_read(db: Session, user_id: int) -> int:
    """Mark all notifications as read for a user"""
    count = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read.is_(False)
    ).update({"is_read": True})
    db.commit()
    return count


def delete_notification(db: Session, notification_id: int) -> bool:
    """Delete a notification"""
    notification = get_notification(db, notification_id)
    if notification:
        db.delete(notification)
        db.commit()
        return True
    return False


def delete_old_notifications(db: Session, days: int = 30) -> int:
    """Delete notifications older than specified days"""
    from datetime import datetime, timedelta
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    count = db.query(Notification).filter(
        Notification.created_at < cutoff_date
    ).delete()
    db.commit()
    return count


def get_recent_notifications(db: Session, limit: int = 10) -> List[Notification]:
    """Get recent notifications across all users (for debugging/testing)"""
    return db.query(Notification).order_by(desc(Notification.created_at)).limit(limit).all()
