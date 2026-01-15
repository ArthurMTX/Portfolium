"""
Test for daily change notifications
"""
import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models import User, Portfolio, Asset, Transaction, TransactionType, AssetClass, NotificationType
from app.services.notifications import notification_service
from app.crud import notifications as crud_notifications


def test_create_daily_change_notification_upside(test_db: Session):
    """Test creating upside daily change notification"""
    # Create test user
    user = User(
        email="test@example.com",
        username="testuser",
        hashed_password="hashed",
        is_active=True,
        daily_change_notifications_enabled=True
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    
    # Create test portfolio
    portfolio = Portfolio(
        user_id=user.id,
        name="Test Portfolio",
        base_currency="USD"
    )
    test_db.add(portfolio)
    test_db.commit()
    test_db.refresh(portfolio)
    
    # Create test asset
    asset = Asset(
        symbol="AAPL",
        name="Apple Inc",
        currency="USD",
        class_=AssetClass.STOCK
    )
    test_db.add(asset)
    test_db.commit()
    test_db.refresh(asset)
    
    # Create notification
    notification_service.create_daily_change_notification(
        db=test_db,
        user_id=user.id,
        symbol="AAPL",
        asset_name="Apple Inc",
        asset_id=asset.id,
        portfolio_id=portfolio.id,
        current_price=Decimal("150.00"),
        daily_change_pct=Decimal("6.25"),
        quantity=Decimal("10.0")
    )
    
    # Verify notification was created
    notifications = crud_notifications.get_user_notifications(test_db, user.id)
    assert len(notifications) == 1
    
    notification = notifications[0]
    assert notification.type == NotificationType.DAILY_CHANGE_UP
    assert "AAPL" in notification.title
    assert "6.25%" in notification.title
    assert "📈" in notification.title
    assert notification.meta_data["symbol"] == "AAPL"
    assert notification.meta_data["daily_change_pct"] == 6.25
    assert notification.meta_data["direction"] == "up"


def test_create_daily_change_notification_downside(test_db: Session):
    """Test creating downside daily change notification"""
    # Create test user
    user = User(
        email="test2@example.com",
        username="testuser2",
        hashed_password="hashed",
        is_active=True,
        daily_change_notifications_enabled=True
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    
    # Create test portfolio
    portfolio = Portfolio(
        user_id=user.id,
        name="Test Portfolio",
        base_currency="USD"
    )
    test_db.add(portfolio)
    test_db.commit()
    test_db.refresh(portfolio)
    
    # Create test asset
    asset = Asset(
        symbol="TSLA",
        name="Tesla Inc",
        currency="USD",
        class_=AssetClass.STOCK
    )
    test_db.add(asset)
    test_db.commit()
    test_db.refresh(asset)
    
    # Create notification for downside
    notification_service.create_daily_change_notification(
        db=test_db,
        user_id=user.id,
        symbol="TSLA",
        asset_name="Tesla Inc",
        asset_id=asset.id,
        portfolio_id=portfolio.id,
        current_price=Decimal("200.00"),
        daily_change_pct=Decimal("-7.50"),
        quantity=Decimal("5.0")
    )
    
    # Verify notification was created
    notifications = crud_notifications.get_user_notifications(test_db, user.id)
    assert len(notifications) == 1
    
    notification = notifications[0]
    assert notification.type == NotificationType.DAILY_CHANGE_DOWN
    assert "TSLA" in notification.title
    assert "-7.50%" in notification.title
    assert "📉" in notification.title
    assert notification.meta_data["symbol"] == "TSLA"
    assert notification.meta_data["daily_change_pct"] == -7.50
    assert notification.meta_data["direction"] == "down"


def test_user_notification_settings_defaults(test_db: Session):
    """Test that user notification settings have correct defaults"""
    user = User(
        email="test3@example.com",
        username="testuser3",
        hashed_password="hashed",
        is_active=True
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    
    # Check defaults - threshold is now asset-based, not user-configurable
    assert user.daily_change_notifications_enabled == True


def test_user_can_disable_notifications(test_db: Session):
    """Test that users can disable daily change notifications"""
    user = User(
        email="test4@example.com",
        username="testuser4",
        hashed_password="hashed",
        is_active=True,
        daily_change_notifications_enabled=False
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    
    assert user.daily_change_notifications_enabled == False


def test_no_duplicate_notifications_across_portfolios(test_db: Session):
    """
    Test that a user with the same asset in multiple portfolios only receives 
    ONE notification for that asset, not multiple notifications.
    
    This tests the fix for the issue where users with 3 portfolios containing 
    the same asset would receive 3 separate notifications.
    """
    # Create test user
    user = User(
        email="test6@example.com",
        username="testuser6",
        hashed_password="hashed",
        is_active=True,
        daily_change_notifications_enabled=True
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    
    # Create test asset
    asset = Asset(
        symbol="MSFT",
        name="Microsoft Corp",
        currency="USD",
        class_=AssetClass.STOCK
    )
    test_db.add(asset)
    test_db.commit()
    test_db.refresh(asset)
    
    # Create THREE portfolios with the SAME asset
    portfolio1 = Portfolio(
        user_id=user.id,
        name="Portfolio 1",
        base_currency="USD"
    )
    portfolio2 = Portfolio(
        user_id=user.id,
        name="Portfolio 2",
        base_currency="USD"
    )
    portfolio3 = Portfolio(
        user_id=user.id,
        name="Portfolio 3",
        base_currency="USD"
    )
    test_db.add_all([portfolio1, portfolio2, portfolio3])
    test_db.commit()
    test_db.refresh(portfolio1)
    test_db.refresh(portfolio2)
    test_db.refresh(portfolio3)
    
    # Create the notification 3 times (simulating what would happen in the old code)
    # Only the first one should actually be created if the fix is working
    notification_service.create_daily_change_notification(
        db=test_db,
        user_id=user.id,
        symbol="MSFT",
        asset_name="Microsoft Corp",
        asset_id=asset.id,
        portfolio_id=portfolio1.id,
        current_price=Decimal("350.00"),
        daily_change_pct=Decimal("6.25"),
        quantity=Decimal("10.0"),
        session_id="2026-01-15-regular"
    )
    
    # Try to create again for portfolio 2 (should be prevented by session_id check)
    notification_service.create_daily_change_notification(
        db=test_db,
        user_id=user.id,
        symbol="MSFT",
        asset_name="Microsoft Corp",
        asset_id=asset.id,
        portfolio_id=portfolio2.id,
        current_price=Decimal("350.00"),
        daily_change_pct=Decimal("6.25"),
        quantity=Decimal("5.0"),
        session_id="2026-01-15-regular"
    )
    
    # Try to create again for portfolio 3 (should be prevented by session_id check)
    notification_service.create_daily_change_notification(
        db=test_db,
        user_id=user.id,
        symbol="MSFT",
        asset_name="Microsoft Corp",
        asset_id=asset.id,
        portfolio_id=portfolio3.id,
        current_price=Decimal("350.00"),
        daily_change_pct=Decimal("6.25"),
        quantity=Decimal("8.0"),
        session_id="2026-01-15-regular"
    )
    
    # Verify only ONE notification was created
    notifications = crud_notifications.get_user_notifications(test_db, user.id)
    assert len(notifications) == 1, f"Expected 1 notification but got {len(notifications)}"
    
    notification = notifications[0]
    assert notification.type == NotificationType.DAILY_CHANGE_UP
    assert "MSFT" in notification.title
    assert notification.meta_data["symbol"] == "MSFT"
    assert notification.meta_data["asset_id"] == asset.id

