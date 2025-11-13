"""
Notifications router
"""
import logging
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.errors import NotAuthorizedNotificationAccessError, NotificationNotFoundError
from app.db import get_db
from app.schemas import Notification, NotificationUpdate
from app.crud import notifications as crud
from app.models import User
from app.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/notifications", response_model=List[Notification])
def get_notifications(
    skip: int = 0,
    limit: int = 50,
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get notifications for the current user
    
    - **skip**: Number of notifications to skip (pagination)
    - **limit**: Maximum number of notifications to return (max 100)
    - **unread_only**: If true, only return unread notifications
    """
    # Limit max results to prevent abuse
    limit = min(limit, 100)
    
    notifications = crud.get_user_notifications(
        db=db,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        unread_only=unread_only
    )
    
    # Convert to Pydantic models manually to avoid SQLAlchemy metadata conflict
    return [
        Notification(
            id=n.id,
            user_id=n.user_id,
            type=n.type,
            title=n.title,
            message=n.message,
            meta_data=n.meta_data if n.meta_data else {},
            is_read=n.is_read,
            created_at=n.created_at
        )
        for n in notifications
    ]


@router.get("/notifications/unread-count", response_model=dict)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get count of unread notifications for the current user
    """
    count = crud.get_unread_count(db=db, user_id=current_user.id)
    return {"unread_count": count}


@router.put("/notifications/{notification_id}/read", response_model=Notification)
def mark_notification_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark a notification as read
    """
    notification = crud.get_notification(db, notification_id)
    
    if not notification:
        raise NotificationNotFoundError(notification_id)
    
    # Verify the notification belongs to the current user
    if notification.user_id != current_user.id:
        raise NotAuthorizedNotificationAccessError(notification_id)
    
    updated_notification = crud.mark_as_read(db, notification_id)
    
    # Convert to Pydantic model manually
    return Notification(
        id=updated_notification.id,
        user_id=updated_notification.user_id,
        type=updated_notification.type,
        title=updated_notification.title,
        message=updated_notification.message,
        meta_data=updated_notification.meta_data if updated_notification.meta_data else {},
        is_read=updated_notification.is_read,
        created_at=updated_notification.created_at
    )


@router.put("/notifications/mark-all-read", response_model=dict)
def mark_all_notifications_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark all notifications as read for the current user
    """
    count = crud.mark_all_as_read(db=db, user_id=current_user.id)
    return {"marked_read": count}


@router.delete(
    "/notifications/{notification_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a notification
    """
    notification = crud.get_notification(db, notification_id)
    
    if not notification:
        raise NotificationNotFoundError(notification_id)
    
    # Verify the notification belongs to the current user
    if notification.user_id != current_user.id:
        raise NotAuthorizedNotificationAccessError(notification_id)
    
    crud.delete_notification(db, notification_id)
