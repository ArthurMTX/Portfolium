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
            # Check if user has transaction notifications enabled
            user = db.query(User).filter(User.id == user_id).first()
            if not user or not user.transaction_notifications_enabled:
                logger.debug(f"Transaction notifications disabled for user {user_id}, skipping")
                return
            
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
                    f"{name} ({symbol}) at {transaction.currency} {float(transaction.price):.2f}"
                )
            elif transaction.type.value == "DIVIDEND":
                gross = Decimal(transaction.price) * Decimal(transaction.quantity)
                tax = Decimal(transaction.fees)
                net = gross - tax
                if tax > 0:
                    message = (
                        f"Dividend received from {name} ({symbol}): {transaction.currency} {float(net):.2f} "
                        f"(gross {transaction.currency} {float(gross):.2f}, tax {transaction.currency} {float(tax):.2f})"
                    )
                else:
                    message = f"Dividend received from {name} ({symbol}): {transaction.currency} {float(gross):.2f}"
            elif transaction.type.value == "FEE":
                message = f"Fee of {transaction.currency} {float(transaction.fees):.2f} for {name} ({symbol})"
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
    
    @staticmethod
    def create_daily_change_notification(
        db: Session,
        user_id: int,
        symbol: str,
        asset_name: str,
        asset_id: int,
        portfolio_id: int,
        current_price: Decimal,
        daily_change_pct: Decimal,
        quantity: Decimal,
        session_id: str = None
    ) -> None:
        """
        Create notification for significant daily price changes in holdings
        
        Args:
            db: Database session
            user_id: User ID to notify
            symbol: Asset symbol
            asset_name: Asset name
            asset_id: Asset ID
            portfolio_id: Portfolio ID
            current_price: Current asset price
            daily_change_pct: Daily change percentage
            quantity: Quantity held by user
            session_id: Market session identifier to prevent duplicate notifications
        """
        try:
            # Determine if upside or downside
            is_upside = daily_change_pct > 0
            notification_type = (
                NotificationType.DAILY_CHANGE_UP if is_upside 
                else NotificationType.DAILY_CHANGE_DOWN
            )
            
            # Format the change with appropriate sign and emoji
            direction = "up" if is_upside else "down"
            emoji = "📈" if is_upside else "📉"
            sign = "+" if is_upside else ""
            
            title = f"{emoji} {symbol} {direction.capitalize()} {sign}{float(daily_change_pct):.2f}%"
            
            # Calculate the value change for user's position
            position_value = current_price * quantity
            change_amount = position_value * (daily_change_pct / 100)
            
            message = (
                f"{asset_name or symbol} is {direction} {sign}{float(daily_change_pct):.2f}% today. "
                f"Your {float(quantity):.4f} shares at ${float(current_price):.2f} "
                f"({sign}${float(change_amount):.2f})"
            )
            
            metadata = {
                "asset_id": asset_id,
                "portfolio_id": portfolio_id,
                "symbol": symbol,
                "current_price": float(current_price),
                "daily_change_pct": float(daily_change_pct),
                "quantity": float(quantity),
                "position_value": float(position_value),
                "change_amount": float(change_amount),
                "direction": direction
            }
            
            # Add session_id to prevent duplicate notifications
            if session_id:
                metadata["session_id"] = session_id
            
            crud_notifications.create_notification(
                db=db,
                user_id=user_id,
                notification_type=notification_type,
                title=title,
                message=message,
                metadata=metadata
            )
            
            logger.info(
                f"Created daily change notification for user {user_id}, "
                f"{symbol} {sign}{daily_change_pct:.2f}% (session: {session_id})"
            )
        
        except Exception as e:
            logger.exception(f"Failed to create daily change notification: {e}")

    @staticmethod
    def create_pending_dividend_notification(
        db: Session,
        user_id: int,
        pending_dividends: list
    ) -> None:
        """
        Create notification for new pending dividends that need user review.
        
        Args:
            db: Database session
            user_id: User ID to notify
            pending_dividends: List of PendingDividend objects that were just created
        """
        try:
            if not pending_dividends:
                return
            
            # Group by asset for cleaner notification
            from app.models import Asset
            
            asset_ids = set(p.asset_id for p in pending_dividends)
            assets = db.query(Asset).filter(Asset.id.in_(asset_ids)).all()
            asset_map = {a.id: a for a in assets}
            
            total_amount = sum(float(p.gross_amount) for p in pending_dividends)
            
            if len(pending_dividends) == 1:
                # Single dividend notification
                p = pending_dividends[0]
                asset = asset_map.get(p.asset_id)
                symbol = asset.symbol if asset else f"Asset #{p.asset_id}"
                name = asset.name if asset and asset.name else symbol
                
                title = f"💰 Dividend Detected: {symbol}"
                message = (
                    f"A dividend of {p.currency or 'USD'} {float(p.gross_amount):.2f} "
                    f"from {name} ({symbol}) was detected for {float(p.shares_held):.4f} shares "
                    f"(ex-date: {p.ex_dividend_date}). Review and accept to add to your portfolio."
                )
            else:
                # Multiple dividends notification
                symbols = [asset_map.get(p.asset_id).symbol if asset_map.get(p.asset_id) else "?" 
                          for p in pending_dividends[:3]]
                symbols_str = ", ".join(symbols)
                if len(pending_dividends) > 3:
                    symbols_str += f" +{len(pending_dividends) - 3} more"
                
                title = f"💰 {len(pending_dividends)} Dividends Detected"
                message = (
                    f"Found {len(pending_dividends)} dividends totaling ~{pending_dividends[0].currency or 'USD'} "
                    f"{total_amount:.2f} from {symbols_str}. Review and accept to add them to your portfolio."
                )
            
            metadata = {
                "pending_dividend_count": len(pending_dividends),
                "pending_dividend_ids": [p.id for p in pending_dividends],
                "total_amount": total_amount,
                "symbols": [asset_map.get(p.asset_id).symbol if asset_map.get(p.asset_id) else None 
                           for p in pending_dividends]
            }
            
            crud_notifications.create_notification(
                db=db,
                user_id=user_id,
                notification_type=NotificationType.PENDING_DIVIDEND,
                title=title,
                message=message,
                metadata=metadata
            )
            
            logger.info(
                f"Created pending dividend notification for user {user_id}: "
                f"{len(pending_dividends)} dividends, total {total_amount:.2f}"
            )
        
        except Exception as e:
            logger.exception(f"Failed to create pending dividend notification: {e}")

    @staticmethod
    def create_ath_notification(
        db: Session,
        user_id: int,
        symbol: str,
        asset_name: str,
        asset_id: int,
        current_price: Decimal,
        previous_ath: Optional[Decimal] = None
    ) -> None:
        """
        Create notification when an asset reaches a new All-Time High
        
        Args:
            db: Database session
            user_id: User ID to notify
            symbol: Asset symbol
            asset_name: Asset name
            asset_id: Asset ID
            current_price: Current price (the new ATH)
            previous_ath: Previous ATH price (if any)
        """
        try:
            title = f"🚀 {symbol} Hit New All-Time High!"
            
            if previous_ath:
                increase_pct = ((current_price - previous_ath) / previous_ath) * 100
                message = (
                    f"{asset_name or symbol} just reached a new all-time high of "
                    f"${float(current_price):.2f}, up {float(increase_pct):.2f}% from the "
                    f"previous ATH of ${float(previous_ath):.2f}."
                )
            else:
                message = (
                    f"{asset_name or symbol} just reached a new all-time high of "
                    f"${float(current_price):.2f}!"
                )
            
            metadata = {
                "asset_id": asset_id,
                "symbol": symbol,
                "current_price": float(current_price),
                "previous_ath": float(previous_ath) if previous_ath else None,
                "increase_pct": float(((current_price - previous_ath) / previous_ath) * 100) if previous_ath else None
            }
            
            crud_notifications.create_notification(
                db=db,
                user_id=user_id,
                notification_type=NotificationType.ATH,
                title=title,
                message=message,
                metadata=metadata
            )
            
            logger.info(
                f"Created ATH notification for user {user_id}: {symbol} at ${current_price}"
            )
        
        except Exception as e:
            logger.exception(f"Failed to create ATH notification: {e}")

    @staticmethod
    def create_atl_notification(
        db: Session,
        user_id: int,
        symbol: str,
        asset_name: str,
        asset_id: int,
        current_price: Decimal,
        previous_atl: Optional[Decimal] = None
    ) -> None:
        """
        Create notification when an asset reaches a new All-Time Low
        
        Args:
            db: Database session
            user_id: User ID to notify
            symbol: Asset symbol
            asset_name: Asset name
            asset_id: Asset ID
            current_price: Current price (the new ATL)
            previous_atl: Previous ATL price (if any)
        """
        try:
            title = f"📉 {symbol} Hit New All-Time Low"
            
            if previous_atl:
                decrease_pct = ((previous_atl - current_price) / previous_atl) * 100
                message = (
                    f"{asset_name or symbol} just reached a new all-time low of "
                    f"${float(current_price):.2f}, down {float(decrease_pct):.2f}% from the "
                    f"previous ATL of ${float(previous_atl):.2f}."
                )
            else:
                message = (
                    f"{asset_name or symbol} just reached a new all-time low of "
                    f"${float(current_price):.2f}."
                )
            
            metadata = {
                "asset_id": asset_id,
                "symbol": symbol,
                "current_price": float(current_price),
                "previous_atl": float(previous_atl) if previous_atl else None,
                "decrease_pct": float(((previous_atl - current_price) / previous_atl) * 100) if previous_atl else None
            }
            
            crud_notifications.create_notification(
                db=db,
                user_id=user_id,
                notification_type=NotificationType.ATL,
                title=title,
                message=message,
                metadata=metadata
            )
            
            logger.info(
                f"Created ATL notification for user {user_id}: {symbol} at ${current_price}"
            )
        
        except Exception as e:
            logger.exception(f"Failed to create ATL notification: {e}")


# Singleton instance
notification_service = NotificationService()
