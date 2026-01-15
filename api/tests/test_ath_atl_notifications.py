"""
Tests for ATH/ATL (All-Time High/Low) notifications
"""
import pytest
from decimal import Decimal
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import User, Portfolio, Asset, Transaction, TransactionType, AssetClass, NotificationType
from app.services.notifications import notification_service
from app.crud import notifications as crud_notifications
from app.tasks.ath_tasks import update_asset_ath, _notify_users_for_ath_atl


def test_create_ath_notification(test_db: Session):
    """Test creating an ATH notification"""
    # Create test user
    user = User(
        email="test_ath@example.com",
        username="testuser_ath",
        hashed_password="hashed",
        is_active=True,
        ath_atl_notifications_enabled=True
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    
    # Create test asset
    asset = Asset(
        symbol="AAPL",
        name="Apple Inc",
        currency="USD",
        class_=AssetClass.STOCK,
        ath_price=Decimal("150.00")
    )
    test_db.add(asset)
    test_db.commit()
    test_db.refresh(asset)
    
    # Create ATH notification
    notification_service.create_ath_notification(
        db=test_db,
        user_id=user.id,
        symbol="AAPL",
        asset_name="Apple Inc",
        asset_id=asset.id,
        current_price=Decimal("180.00"),
        previous_ath=Decimal("150.00")
    )
    
    # Verify notification was created
    notifications = crud_notifications.get_user_notifications(test_db, user.id)
    assert len(notifications) == 1
    
    notification = notifications[0]
    assert notification.type == NotificationType.ATH
    assert "AAPL" in notification.title
    assert "All-Time High" in notification.title
    assert "🚀" in notification.title
    assert notification.meta_data["symbol"] == "AAPL"
    assert notification.meta_data["current_price"] == 180.00
    assert notification.meta_data["previous_ath"] == 150.00
    assert notification.meta_data["increase_pct"] == pytest.approx(20.0, rel=0.01)


def test_create_atl_notification(test_db: Session):
    """Test creating an ATL notification"""
    # Create test user
    user = User(
        email="test_atl@example.com",
        username="testuser_atl",
        hashed_password="hashed",
        is_active=True,
        ath_atl_notifications_enabled=True
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    
    # Create test asset
    asset = Asset(
        symbol="TSLA",
        name="Tesla Inc",
        currency="USD",
        class_=AssetClass.STOCK,
        atl_price=Decimal("50.00")
    )
    test_db.add(asset)
    test_db.commit()
    test_db.refresh(asset)
    
    # Create ATL notification
    notification_service.create_atl_notification(
        db=test_db,
        user_id=user.id,
        symbol="TSLA",
        asset_name="Tesla Inc",
        asset_id=asset.id,
        current_price=Decimal("40.00"),
        previous_atl=Decimal("50.00")
    )
    
    # Verify notification was created
    notifications = crud_notifications.get_user_notifications(test_db, user.id)
    assert len(notifications) == 1
    
    notification = notifications[0]
    assert notification.type == NotificationType.ATL
    assert "TSLA" in notification.title
    assert "All-Time Low" in notification.title
    assert "📉" in notification.title
    assert notification.meta_data["symbol"] == "TSLA"
    assert notification.meta_data["current_price"] == 40.00
    assert notification.meta_data["previous_atl"] == 50.00
    assert notification.meta_data["decrease_pct"] == pytest.approx(20.0, rel=0.01)


def test_update_asset_ath_triggers_notification(test_db: Session):
    """Test that update_asset_ath function updates ATH and notifies users"""
    # Create test user
    user = User(
        email="test_ath_update@example.com",
        username="testuser_ath_update",
        hashed_password="hashed",
        is_active=True,
        ath_atl_notifications_enabled=True
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    
    # Create portfolio
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
        symbol="MSFT",
        name="Microsoft Corp",
        currency="USD",
        class_=AssetClass.STOCK,
        ath_price=Decimal("300.00")
    )
    test_db.add(asset)
    test_db.commit()
    test_db.refresh(asset)
    
    # Create transaction so user holds this asset
    transaction = Transaction(
        portfolio_id=portfolio.id,
        asset_id=asset.id,
        transaction_type=TransactionType.BUY,
        quantity=Decimal("10.0"),
        price=Decimal("290.00"),
        date=datetime.utcnow()
    )
    test_db.add(transaction)
    test_db.commit()
    
    # Update ATH (should trigger notification)
    result = update_asset_ath(asset.id, 350.00)
    
    assert result["ath_updated"] is True
    assert result["symbol"] == "MSFT"
    assert result["new_ath"] == 350.00
    assert result["users_notified"] == 1
    
    # Verify notification was created
    notifications = crud_notifications.get_user_notifications(test_db, user.id)
    ath_notifications = [n for n in notifications if n.type == NotificationType.ATH]
    assert len(ath_notifications) == 1


def test_update_asset_atl_triggers_notification(test_db: Session):
    """Test that update_asset_ath function updates ATL and notifies users"""
    # Create test user
    user = User(
        email="test_atl_update@example.com",
        username="testuser_atl_update",
        hashed_password="hashed",
        is_active=True,
        ath_atl_notifications_enabled=True
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    
    # Create portfolio
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
        symbol="NFLX",
        name="Netflix Inc",
        currency="USD",
        class_=AssetClass.STOCK,
        atl_price=Decimal("100.00")
    )
    test_db.add(asset)
    test_db.commit()
    test_db.refresh(asset)
    
    # Create transaction so user holds this asset
    transaction = Transaction(
        portfolio_id=portfolio.id,
        asset_id=asset.id,
        transaction_type=TransactionType.BUY,
        quantity=Decimal("5.0"),
        price=Decimal("110.00"),
        date=datetime.utcnow()
    )
    test_db.add(transaction)
    test_db.commit()
    
    # Update ATL (should trigger notification)
    result = update_asset_ath(asset.id, 80.00)
    
    assert result["atl_updated"] is True
    assert result["symbol"] == "NFLX"
    assert result["new_atl"] == 80.00
    assert result["users_notified"] == 1
    
    # Verify notification was created
    notifications = crud_notifications.get_user_notifications(test_db, user.id)
    atl_notifications = [n for n in notifications if n.type == NotificationType.ATL]
    assert len(atl_notifications) == 1


def test_user_can_disable_ath_atl_notifications(test_db: Session):
    """Test that users can disable ATH/ATL notifications"""
    # Create test user with notifications disabled
    user = User(
        email="test_disabled@example.com",
        username="testuser_disabled",
        hashed_password="hashed",
        is_active=True,
        ath_atl_notifications_enabled=False
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    
    # Create portfolio
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
        symbol="GOOGL",
        name="Alphabet Inc",
        currency="USD",
        class_=AssetClass.STOCK,
        ath_price=Decimal("150.00")
    )
    test_db.add(asset)
    test_db.commit()
    test_db.refresh(asset)
    
    # Create transaction
    transaction = Transaction(
        portfolio_id=portfolio.id,
        asset_id=asset.id,
        transaction_type=TransactionType.BUY,
        quantity=Decimal("10.0"),
        price=Decimal("140.00"),
        date=datetime.utcnow()
    )
    test_db.add(transaction)
    test_db.commit()
    
    # Update ATH (should NOT trigger notification since disabled)
    result = update_asset_ath(asset.id, 180.00)
    
    assert result["ath_updated"] is True
    assert result["users_notified"] == 0
    
    # Verify no notification was created
    notifications = crud_notifications.get_user_notifications(test_db, user.id)
    assert len(notifications) == 0


def test_notify_only_users_holding_asset(test_db: Session):
    """Test that only users holding the asset get notified"""
    # Create two users
    user1 = User(
        email="holder@example.com",
        username="holder",
        hashed_password="hashed",
        is_active=True,
        ath_atl_notifications_enabled=True
    )
    user2 = User(
        email="non_holder@example.com",
        username="non_holder",
        hashed_password="hashed",
        is_active=True,
        ath_atl_notifications_enabled=True
    )
    test_db.add_all([user1, user2])
    test_db.commit()
    test_db.refresh(user1)
    test_db.refresh(user2)
    
    # Create portfolios
    portfolio1 = Portfolio(user_id=user1.id, name="P1", base_currency="USD")
    portfolio2 = Portfolio(user_id=user2.id, name="P2", base_currency="USD")
    test_db.add_all([portfolio1, portfolio2])
    test_db.commit()
    test_db.refresh(portfolio1)
    test_db.refresh(portfolio2)
    
    # Create asset
    asset = Asset(
        symbol="AMZN",
        name="Amazon",
        currency="USD",
        class_=AssetClass.STOCK,
        ath_price=Decimal("150.00")
    )
    test_db.add(asset)
    test_db.commit()
    test_db.refresh(asset)
    
    # Only user1 holds the asset
    transaction = Transaction(
        portfolio_id=portfolio1.id,
        asset_id=asset.id,
        transaction_type=TransactionType.BUY,
        quantity=Decimal("5.0"),
        price=Decimal("140.00"),
        date=datetime.utcnow()
    )
    test_db.add(transaction)
    test_db.commit()
    
    # Update ATH
    result = update_asset_ath(asset.id, 180.00)
    
    assert result["ath_updated"] is True
    assert result["users_notified"] == 1
    
    # Verify only user1 got notification
    user1_notifications = crud_notifications.get_user_notifications(test_db, user1.id)
    user2_notifications = crud_notifications.get_user_notifications(test_db, user2.id)
    
    assert len(user1_notifications) == 1
    assert len(user2_notifications) == 0
    assert user1_notifications[0].type == NotificationType.ATH


def test_user_notification_settings_defaults(test_db: Session):
    """Test that user notification settings have correct defaults for ATH/ATL"""
    user = User(
        email="test_defaults@example.com",
        username="testuser_defaults",
        hashed_password="hashed",
        is_active=True
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    
    # Check that ATH/ATL notifications are enabled by default
    assert user.ath_atl_notifications_enabled == True


def test_both_ath_and_atl_can_update_simultaneously(test_db: Session):
    """Test that both ATH and ATL can be updated in the same call if needed"""
    # Create asset with no ATH/ATL set
    asset = Asset(
        symbol="NEW",
        name="New Asset",
        currency="USD",
        class_=AssetClass.STOCK
    )
    test_db.add(asset)
    test_db.commit()
    test_db.refresh(asset)
    
    # First update should set both ATH and ATL to the same value
    result = update_asset_ath(asset.id, 100.00)
    
    assert result["ath_updated"] is True
    assert result["atl_updated"] is True
    assert result["new_ath"] == 100.00
    assert result["new_atl"] == 100.00
    
    # Verify asset was updated
    test_db.refresh(asset)
    assert asset.ath_price == Decimal("100.00")
    assert asset.atl_price == Decimal("100.00")
