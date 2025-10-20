"""
Notification service for creating notifications from events
"""
import logging
from typing import Optional, Dict, Any
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models import NotificationType, Transaction, Asset, User, Watchlist
from app.crud import notifications as crud_notifications

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for creating and managing notifications"""
    
    @staticmethod
    def create_transaction_notification(
        db: Session,
        user_id: int,
        transaction: Transaction,
        action: str = "created"
    ) -> None:
        """
        Create notification for transaction events
        
        Args:
            db: Database session
            user_id: User ID to notify
            transaction: Transaction object
            action: Action performed (created, updated, deleted)
        """
        try:
            # Get asset information
            asset = db.query(Asset).filter(Asset.id == transaction.asset_id).first()
            symbol = asset.symbol if asset else f"Asset #{transaction.asset_id}"
            name = asset.name if asset and asset.name else symbol
            
            # Determine notification type
            if action == "created":
                notification_type = NotificationType.TRANSACTION_CREATED
                title = f"New {transaction.type.value} Transaction"
            elif action == "updated":
                notification_type = NotificationType.TRANSACTION_UPDATED
                title = f"Transaction Updated"
            elif action == "deleted":
                notification_type = NotificationType.TRANSACTION_DELETED
                title = f"Transaction Deleted"
            else:
                notification_type = NotificationType.TRANSACTION_CREATED
                title = f"Transaction {action.capitalize()}"
            
            # Create message
            if transaction.type.value in ["BUY", "SELL"]:
                message = (
                    f"{transaction.type.value} {float(transaction.quantity):.4f} shares of "
                    f"{name} ({symbol}) at ${float(transaction.price):.2f}"
                )
            elif transaction.type.value == "DIVIDEND":
                message = f"Dividend of ${float(transaction.price):.2f} from {name} ({symbol})"
            elif transaction.type.value == "FEE":
                message = f"Fee of ${float(transaction.fees):.2f} for {name} ({symbol})"
            else:
                message = f"{transaction.type.value} transaction for {name} ({symbol})"
            
            # Metadata
            metadata = {
                "transaction_id": transaction.id,
                "portfolio_id": transaction.portfolio_id,
                "asset_id": transaction.asset_id,
                "symbol": symbol,
                "type": transaction.type.value,
                "quantity": float(transaction.quantity),
                "price": float(transaction.price),
                "tx_date": transaction.tx_date.isoformat(),
                "action": action
            }
            
            crud_notifications.create_notification(
                db=db,
                user_id=user_id,
                notification_type=notification_type,
                title=title,
                message=message,
                metadata=metadata
            )
            
            logger.info(f"Created {action} notification for transaction {transaction.id} for user {user_id}")
        
        except Exception as e:
            logger.exception(f"Failed to create transaction notification: {e}")
    
    @staticmethod
    def create_login_notification(
        db: Session,
        user_id: int,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> None:
        """
        Create notification for login events
        
        Args:
            db: Database session
            user_id: User ID that logged in
            ip_address: IP address of login
            user_agent: User agent string
        """
        try:
            user = db.query(User).filter(User.id == user_id).first()
            username = user.username if user else f"User #{user_id}"
            
            title = "New Login Detected"
            message = f"Login to your account from {ip_address or 'unknown IP'}"
            
            metadata = {
                "user_id": user_id,
                "ip_address": ip_address,
                "user_agent": user_agent,
            }
            
            crud_notifications.create_notification(
                db=db,
                user_id=user_id,
                notification_type=NotificationType.LOGIN,
                title=title,
                message=message,
                metadata=metadata
            )
            
            logger.info(f"Created login notification for user {user_id} from IP {ip_address}")
        
        except Exception as e:
            logger.exception(f"Failed to create login notification: {e}")
    
    @staticmethod
    def create_price_alert_notification(
        db: Session,
        user_id: int,
        watchlist_item: Watchlist,
        current_price: Decimal,
        target_price: Decimal
    ) -> None:
        """
        Create notification for price alerts
        
        Args:
            db: Database session
            user_id: User ID to notify
            watchlist_item: Watchlist item that triggered alert
            current_price: Current asset price
            target_price: Target price that was hit
        """
        try:
            # Get asset information
            asset = db.query(Asset).filter(Asset.id == watchlist_item.asset_id).first()
            symbol = asset.symbol if asset else f"Asset #{watchlist_item.asset_id}"
            name = asset.name if asset and asset.name else symbol
            
            # Determine if price went above or below target
            direction = "above" if current_price >= target_price else "below"
            
            title = f"Price Alert: {symbol}"
            message = (
                f"{name} ({symbol}) is now ${float(current_price):.2f}, "
                f"{direction} your target of ${float(target_price):.2f}"
            )
            
            metadata = {
                "watchlist_id": watchlist_item.id,
                "asset_id": watchlist_item.asset_id,
                "symbol": symbol,
                "current_price": float(current_price),
                "target_price": float(target_price),
                "direction": direction
            }
            
            crud_notifications.create_notification(
                db=db,
                user_id=user_id,
                notification_type=NotificationType.PRICE_ALERT,
                title=title,
                message=message,
                metadata=metadata
            )
            
            logger.info(
                f"Created price alert notification for user {user_id}, "
                f"{symbol} at ${current_price} (target: ${target_price})"
            )
        
        except Exception as e:
            logger.exception(f"Failed to create price alert notification: {e}")
    
    @staticmethod
    def create_system_notification(
        db: Session,
        user_id: int,
        title: str,
        message: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Create a system notification
        
        Args:
            db: Database session
            user_id: User ID to notify
            title: Notification title
            message: Notification message
            metadata: Optional metadata
        """
        try:
            crud_notifications.create_notification(
                db=db,
                user_id=user_id,
                notification_type=NotificationType.SYSTEM,
                title=title,
                message=message,
                metadata=metadata or {}
            )
            
            logger.info(f"Created system notification for user {user_id}: {title}")
        
        except Exception as e:
            logger.exception(f"Failed to create system notification: {e}")


# Singleton instance
notification_service = NotificationService()
