"""
Web Push Notification Service

Handles sending push notifications to subscribed devices using the Web Push protocol.
Requires VAPID keys to be configured in environment variables.
"""
import json
import logging
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass

from pywebpush import webpush, WebPushException
from py_vapid import Vapid

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class PushPayload:
    """Web Push notification payload"""
    title: str
    body: str
    icon: Optional[str] = None
    badge: Optional[str] = None
    tag: Optional[str] = None  # For notification grouping/replacement
    url: Optional[str] = None  # URL to open when clicked
    data: Optional[Dict[str, Any]] = None  # Additional custom data
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        result = {
            "title": self.title,
            "body": self.body,
        }
        if self.icon:
            result["icon"] = self.icon
        if self.badge:
            result["badge"] = self.badge
        if self.tag:
            result["tag"] = self.tag
        if self.url:
            result["url"] = self.url
        if self.data:
            result["data"] = self.data
        return result
    
    def to_json(self) -> str:
        """Convert to JSON string"""
        return json.dumps(self.to_dict())


def is_push_configured() -> bool:
    """Check if VAPID keys are configured"""
    return bool(settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY)


def get_vapid_public_key() -> Optional[str]:
    """Get the VAPID public key for client subscription"""
    if not settings.VAPID_PUBLIC_KEY:
        return None
    return settings.VAPID_PUBLIC_KEY


def generate_vapid_keys() -> Tuple[str, str]:
    """
    Generate a new VAPID key pair.
    Returns (public_key, private_key) as base64 strings.
    
    NOTE: This should only be used for initial setup.
    The keys should be stored in environment variables.
    """
    vapid = Vapid()
    vapid.generate_keys()
    
    # Get the keys as ApplicationServerKey format (base64)
    public_key = vapid.public_key.public_bytes_raw()
    private_key = vapid.private_key.private_bytes_raw()
    
    import base64
    public_b64 = base64.urlsafe_b64encode(public_key).decode('utf-8').rstrip('=')
    private_b64 = base64.urlsafe_b64encode(private_key).decode('utf-8').rstrip('=')
    
    return public_b64, private_b64


def send_push_notification(
    subscription_info: Dict[str, Any],
    payload: PushPayload,
    ttl: int = 86400  # 24 hours
) -> Tuple[bool, Optional[str]]:
    """
    Send a push notification to a single subscription.
    
    Args:
        subscription_info: The subscription object with endpoint and keys
        payload: The notification payload
        ttl: Time to live in seconds (default 24 hours)
    
    Returns:
        Tuple of (success, error_message)
    """
    if not is_push_configured():
        logger.warning("Push notifications not configured - VAPID keys missing")
        return False, "Push notifications not configured"
    
    try:
        response = webpush(
            subscription_info=subscription_info,
            data=payload.to_json(),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_CLAIMS_EMAIL},
            ttl=ttl
        )
        
        logger.info(
            f"Push notification sent successfully to {subscription_info.get('endpoint', 'unknown')[:50]}..."
        )
        return True, None
        
    except WebPushException as ex:
        error_msg = str(ex)
        
        # Check for specific error cases
        if ex.response is not None:
            status_code = ex.response.status_code
            
            if status_code == 410:
                # Subscription has been unsubscribed or expired
                logger.info(f"Push subscription expired (410 Gone): {subscription_info.get('endpoint', '')[:50]}...")
                return False, "subscription_expired"
            
            elif status_code == 404:
                # Subscription not found
                logger.info(f"Push subscription not found (404): {subscription_info.get('endpoint', '')[:50]}...")
                return False, "subscription_not_found"
            
            elif status_code == 429:
                # Rate limited
                logger.warning(f"Push rate limited (429): {subscription_info.get('endpoint', '')[:50]}...")
                return False, "rate_limited"
            
            elif status_code >= 500:
                # Server error on push service
                logger.error(f"Push service error ({status_code}): {error_msg}")
                return False, f"push_service_error_{status_code}"
        
        logger.error(f"WebPushException: {error_msg}")
        return False, error_msg
        
    except Exception as ex:
        error_msg = f"Unexpected error sending push: {str(ex)}"
        logger.exception(error_msg)
        return False, error_msg


def send_push_to_user(
    db,  # Session
    user_id: int,
    payload: PushPayload
) -> Dict[str, Any]:
    """
    Send a push notification to all of a user's subscribed devices.
    
    Returns a summary of the results.
    """
    from app.crud import push_subscriptions
    from app.models import User
    
    # Check if user has push notifications enabled
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.push_notifications_enabled:
        return {
            "success": False,
            "reason": "push_disabled",
            "sent": 0,
            "failed": 0
        }
    
    subscriptions = push_subscriptions.get_subscriptions_by_user(db, user_id, active_only=True)
    
    if not subscriptions:
        return {
            "success": True,
            "reason": "no_subscriptions",
            "sent": 0,
            "failed": 0
        }
    
    sent = 0
    failed = 0
    
    for subscription in subscriptions:
        success, error = send_push_notification(
            subscription_info=subscription.to_subscription_info(),
            payload=payload
        )
        
        if success:
            sent += 1
            push_subscriptions.mark_subscription_used(db, subscription)
        else:
            failed += 1
            
            # Handle expired/invalid subscriptions
            if error in ("subscription_expired", "subscription_not_found"):
                push_subscriptions.deactivate_subscription(db, subscription.endpoint)
            else:
                push_subscriptions.mark_subscription_failed(db, subscription)
    
    return {
        "success": True,
        "sent": sent,
        "failed": failed,
        "total": len(subscriptions)
    }


def create_notification_payload(
    notification_type: str,
    title: str,
    message: str,
    asset_symbol: Optional[str] = None,
    url: Optional[str] = None
) -> PushPayload:
    """
    Create a standardized push notification payload from an in-app notification.
    
    Args:
        notification_type: The type of notification (daily_change, ath, atl, etc.)
        title: The notification title
        message: The notification body text
        asset_symbol: Optional asset symbol for the icon
        url: Optional URL to open when clicked
    """
    # Use a tag based on notification type and asset to allow grouping/replacement
    tag = f"{notification_type}"
    if asset_symbol:
        tag = f"{notification_type}_{asset_symbol}"
    
    return PushPayload(
        title=title,
        body=message,
        icon="/icons/icon-192x192.png",  # Default app icon
        badge="/icons/badge-72x72.png",
        tag=tag,
        url=url or "/notifications",
        data={
            "type": notification_type,
            "asset": asset_symbol
        }
    )
