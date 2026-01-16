"""
Push Notifications Router

Endpoints for managing Web Push notification subscriptions.
"""
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.auth import get_current_user
from app.crud import push_subscriptions
from app.services import push_service

logger = logging.getLogger(__name__)
router = APIRouter()


# === Schemas ===

class PushSubscriptionKeys(BaseModel):
    """Web Push subscription keys"""
    p256dh: str = Field(..., description="Client public key for encryption")
    auth: str = Field(..., description="Auth secret for encryption")


class PushSubscriptionCreate(BaseModel):
    """Request body for creating a push subscription"""
    endpoint: str = Field(..., description="Push service endpoint URL")
    keys: PushSubscriptionKeys
    device_name: Optional[str] = Field(None, max_length=100, description="User-friendly device name")


class PushSubscriptionResponse(BaseModel):
    """Response for a push subscription"""
    id: int
    endpoint: str
    device_name: Optional[str]
    is_active: bool
    created_at: str
    last_used_at: Optional[str]
    
    class Config:
        from_attributes = True


class VapidPublicKeyResponse(BaseModel):
    """Response containing the VAPID public key"""
    public_key: str
    is_configured: bool


class PushTestResponse(BaseModel):
    """Response from testing push notifications"""
    success: bool
    message: str
    sent: int
    failed: int


# === Endpoints ===

@router.get("/push/vapid-public-key", response_model=VapidPublicKeyResponse)
def get_vapid_public_key():
    """
    Get the VAPID public key for subscribing to push notifications.
    
    This key is needed by the browser to create a push subscription.
    If the key is not configured, push notifications are not available.
    """
    public_key = push_service.get_vapid_public_key()
    
    return VapidPublicKeyResponse(
        public_key=public_key or "",
        is_configured=push_service.is_push_configured()
    )


@router.post("/push/subscribe", status_code=status.HTTP_201_CREATED)
def subscribe_to_push(
    subscription: PushSubscriptionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Subscribe to push notifications.
    
    Creates or updates a push subscription for the current user's device.
    """
    if not push_service.is_push_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Push notifications are not configured on this server"
        )
    
    # Get user agent for device identification
    user_agent = request.headers.get("User-Agent", "")
    
    # Auto-generate device name from user agent if not provided
    device_name = subscription.device_name
    if not device_name:
        device_name = _parse_device_name(user_agent)
    
    try:
        sub = push_subscriptions.create_subscription(
            db=db,
            user_id=current_user.id,
            endpoint=subscription.endpoint,
            p256dh_key=subscription.keys.p256dh,
            auth_key=subscription.keys.auth,
            user_agent=user_agent[:500] if user_agent else None,
            device_name=device_name
        )
        
        logger.info(f"User {current_user.id} subscribed to push notifications (device: {device_name})")
        
        return {
            "message": "Successfully subscribed to push notifications",
            "subscription_id": sub.id,
            "device_name": sub.device_name
        }
        
    except Exception as ex:
        logger.exception(f"Error creating push subscription: {ex}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create push subscription"
        )


@router.delete("/push/unsubscribe")
def unsubscribe_from_push(
    endpoint: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Unsubscribe from push notifications.
    
    Removes the push subscription for the specified endpoint.
    """
    subscription = push_subscriptions.get_subscription_by_endpoint(db, endpoint)
    
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found"
        )
    
    # Verify the subscription belongs to the current user
    if subscription.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this subscription"
        )
    
    push_subscriptions.delete_subscription(db, endpoint)
    logger.info(f"User {current_user.id} unsubscribed from push notifications")
    
    return {"message": "Successfully unsubscribed from push notifications"}


@router.get("/push/subscriptions", response_model=List[PushSubscriptionResponse])
def get_my_subscriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all push subscriptions for the current user.
    
    Returns a list of all devices subscribed to push notifications.
    """
    subscriptions = push_subscriptions.get_subscriptions_by_user(
        db, current_user.id, active_only=False
    )
    
    return [
        PushSubscriptionResponse(
            id=sub.id,
            endpoint=sub.endpoint[:50] + "..." if len(sub.endpoint) > 50 else sub.endpoint,
            device_name=sub.device_name,
            is_active=sub.is_active,
            created_at=sub.created_at.isoformat() if sub.created_at else "",
            last_used_at=sub.last_used_at.isoformat() if sub.last_used_at else None
        )
        for sub in subscriptions
    ]


@router.post("/push/test", response_model=PushTestResponse)
def test_push_notification(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send a test push notification to all subscribed devices.
    
    Useful for verifying that push notifications are working correctly.
    """
    if not push_service.is_push_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Push notifications are not configured on this server"
        )
    
    import time
    payload = push_service.PushPayload(
        title="Test Notification 🔔",
        body="Push notifications are working! You'll receive alerts here.",
        icon="/web-app-manifest-192x192.png",
        tag=f"test-{int(time.time())}",  # Unique tag so each test shows a new notification
        url="/notifications"
    )
    
    result = push_service.send_push_to_user(db, current_user.id, payload)
    
    if result.get("reason") == "no_subscriptions":
        return PushTestResponse(
            success=False,
            message="No devices are subscribed to push notifications",
            sent=0,
            failed=0
        )
    
    return PushTestResponse(
        success=result["sent"] > 0,
        message=f"Sent to {result['sent']} device(s)" if result["sent"] > 0 else "Failed to send",
        sent=result["sent"],
        failed=result["failed"]
    )


def _parse_device_name(user_agent: str) -> str:
    """Parse a user-friendly device name from the user agent string"""
    ua = user_agent.lower()
    
    # Mobile devices
    if "iphone" in ua:
        return "iPhone"
    if "ipad" in ua:
        return "iPad"
    if "android" in ua:
        if "mobile" in ua:
            return "Android Phone"
        return "Android Tablet"
    
    # Desktop browsers
    if "windows" in ua:
        browser = _get_browser(ua)
        return f"Windows ({browser})"
    if "macintosh" in ua or "mac os" in ua:
        browser = _get_browser(ua)
        return f"Mac ({browser})"
    if "linux" in ua:
        browser = _get_browser(ua)
        return f"Linux ({browser})"
    
    return "Unknown Device"


def _get_browser(user_agent: str) -> str:
    """Extract browser name from user agent"""
    ua = user_agent.lower()
    
    if "edg/" in ua:
        return "Edge"
    if "chrome" in ua:
        return "Chrome"
    if "safari" in ua:
        return "Safari"
    if "firefox" in ua:
        return "Firefox"
    if "opera" in ua or "opr/" in ua:
        return "Opera"
    
    return "Browser"
