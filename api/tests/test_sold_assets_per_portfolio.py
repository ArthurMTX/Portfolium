"""
Test sold assets filtering per portfolio

This test validates the fix for the issue where sold assets in one portfolio
would appear as held if they were still held in another portfolio.
"""
import pytest
from decimal import Decimal
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import User, Portfolio, Asset, Transaction, TransactionType, AssetClass


@pytest.fixture
def setup_multi_portfolio_scenario(test_db: Session):
    """
    Create a scenario where:
    - User has 2 portfolios
    - Asset CSSPX.MI is bought in both portfolios
    - Asset CSSPX.MI is sold completely in portfolio 1
    - Asset CSSPX.MI is still held in portfolio 2
    """
    # Create user
    user = User(
        id=1,
        email="test@example.com",
        hashed_password="hashed",
        is_active=True,
        role="user"
    )
    test_db.add(user)
    
    # Create portfolios
    portfolio1 = Portfolio(
        id=1,
        name="Portfolio 1",
        user_id=user.id,
        base_currency="EUR"
    )
    portfolio2 = Portfolio(
        id=2,
        name="Portfolio 2",
        user_id=user.id,
        base_currency="EUR"
    )
    test_db.add_all([portfolio1, portfolio2])
    
    # Create asset
    asset = Asset(
        id=1,
        symbol="CSSPX.MI",
        name="iShares Core S&P 500 UCITS ETF",
        currency="EUR",
        class_=AssetClass.EQUITY,
        asset_type="etf",
        sector="Technology",
        industry="Financial Services"
    )
    test_db.add(asset)
    test_db.commit()
    
    # Portfolio 1 transactions: BUY 10 shares, then SELL 10 shares (fully sold)
    tx1_buy = Transaction(
        portfolio_id=portfolio1.id,
        asset_id=asset.id,
        type=TransactionType.BUY,
        quantity=Decimal("10"),
        price=Decimal("500"),
        fees=Decimal("5"),
        currency="EUR",
        tx_date=datetime(2024, 1, 1)
    )
    tx1_sell = Transaction(
        portfolio_id=portfolio1.id,
        asset_id=asset.id,
        type=TransactionType.SELL,
        quantity=Decimal("10"),
        price=Decimal("550"),
        fees=Decimal("5"),
        currency="EUR",
        tx_date=datetime(2024, 6, 1)
    )
    
    # Portfolio 2 transactions: BUY 5 shares (still held)
    tx2_buy = Transaction(
        portfolio_id=portfolio2.id,
        asset_id=asset.id,
        type=TransactionType.BUY,
        quantity=Decimal("5"),
        price=Decimal("510"),
        fees=Decimal("3"),
        currency="EUR",
        tx_date=datetime(2024, 2, 1)
    )
    
    test_db.add_all([tx1_buy, tx1_sell, tx2_buy])
    test_db.commit()
    
    return {
        "user": user,
        "portfolio1": portfolio1,
        "portfolio2": portfolio2,
        "asset": asset
    }


def test_sold_asset_in_one_portfolio_appears_as_sold(setup_multi_portfolio_scenario, test_db):
    """
    Test that an asset sold in one portfolio appears in the sold list for that portfolio,
    even if it's still held in another portfolio.
    """
    from app.routers.assets import get_sold_assets, get_held_assets
    
    data = setup_multi_portfolio_scenario
    user = data["user"]
    portfolio1 = data["portfolio1"]
    asset = data["asset"]
    
    # Get sold assets for portfolio 1
    sold_assets = get_sold_assets(
        portfolio_id=portfolio1.id,
        current_user=user,
        db=test_db
    )
    
    # Asset should appear in sold list for portfolio 1
    assert len(sold_assets) == 1
    assert sold_assets[0]["symbol"] == "CSSPX.MI"
    assert sold_assets[0]["total_quantity"] == 0  # Fully sold in this portfolio
    
    # Get held assets for portfolio 1
    held_assets = get_held_assets(
        portfolio_id=portfolio1.id,
        current_user=user,
        db=test_db
    )
    
    # Asset should NOT appear in held list for portfolio 1
    assert len(held_assets) == 0


def test_held_asset_in_another_portfolio_appears_as_held(setup_multi_portfolio_scenario, test_db):
    """
    Test that an asset still held in one portfolio appears in the held list for that portfolio.
    """
    from app.routers.assets import get_sold_assets, get_held_assets
    
    data = setup_multi_portfolio_scenario
    user = data["user"]
    portfolio2 = data["portfolio2"]
    asset = data["asset"]
    
    # Get held assets for portfolio 2
    held_assets = get_held_assets(
        portfolio_id=portfolio2.id,
        current_user=user,
        db=test_db
    )
    
    # Asset should appear in held list for portfolio 2
    assert len(held_assets) == 1
    assert held_assets[0]["symbol"] == "CSSPX.MI"
    assert held_assets[0]["total_quantity"] == 5  # Still held in this portfolio
    
    # Get sold assets for portfolio 2
    sold_assets = get_sold_assets(
        portfolio_id=portfolio2.id,
        current_user=user,
        db=test_db
    )
    
    # Asset should NOT appear in sold list for portfolio 2
    assert len(sold_assets) == 0


def test_global_view_shows_held_asset(setup_multi_portfolio_scenario, test_db):
    """
    Test that the global view (no portfolio_id) shows the asset as held
    because it's still held in at least one portfolio.
    """
    from app.routers.assets import get_sold_assets, get_held_assets
    
    data = setup_multi_portfolio_scenario
    user = data["user"]
    
    # Get held assets globally (no portfolio_id)
    held_assets = get_held_assets(
        portfolio_id=None,
        current_user=user,
        db=test_db
    )
    
    # Asset should appear in global held list (quantity = 5 from portfolio 2)
    assert len(held_assets) == 1
    assert held_assets[0]["symbol"] == "CSSPX.MI"
    assert held_assets[0]["total_quantity"] == 5  # Net: -10 (p1) + 5 (p2) = -5, but we calculate independently
    # Actually, in global view, we calculate across ALL transactions
    # So it should be: 10 (p1 buy) - 10 (p1 sell) + 5 (p2 buy) = 5
    
    # Get sold assets globally
    sold_assets = get_sold_assets(
        portfolio_id=None,
        current_user=user,
        db=test_db
    )
    
    # Asset should NOT appear in global sold list (still held overall)
    assert len(sold_assets) == 0
