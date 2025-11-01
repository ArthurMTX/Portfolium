"""
CRUD operations for watchlist
"""
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload

from app.models import Watchlist, Asset
from app.schemas import WatchlistItemCreate, WatchlistItemUpdate


def get_watchlist_item(db: Session, item_id: int) -> Optional[Watchlist]:
    """Get watchlist item by ID"""
    return db.query(Watchlist).options(joinedload(Watchlist.asset)).filter(
        Watchlist.id == item_id
    ).first()


def get_watchlist_items_by_user(
    db: Session, 
    user_id: int, 
    skip: int = 0, 
    limit: int = 100
) -> List[Watchlist]:
    """Get all watchlist items for a user"""
    return db.query(Watchlist).options(joinedload(Watchlist.asset)).filter(
        Watchlist.user_id == user_id
    ).offset(skip).limit(limit).all()


def get_watchlist_item_by_user_and_asset(
    db: Session, 
    user_id: int, 
    asset_id: int
) -> Optional[Watchlist]:
    """Get watchlist item by user and asset"""
    return db.query(Watchlist).filter(
        Watchlist.user_id == user_id,
        Watchlist.asset_id == asset_id
    ).first()


def create_watchlist_item(
    db: Session, 
    item: WatchlistItemCreate, 
    user_id: int
) -> Watchlist:
    """Create new watchlist item"""
    db_item = Watchlist(
        user_id=user_id,
        asset_id=item.asset_id,
        notes=item.notes,
        alert_target_price=item.alert_target_price,
        alert_enabled=item.alert_enabled
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    # Load the asset relationship
    db.refresh(db_item, attribute_names=['asset'])
    return db_item


def update_watchlist_item(
    db: Session,
    item_id: int,
    item: WatchlistItemUpdate
) -> Optional[Watchlist]:
    """Update existing watchlist item"""
    db_item = get_watchlist_item(db, item_id)
    if not db_item:
        return None
    
    # Use model_fields_set to check which fields were explicitly provided
    # This allows us to distinguish between "not provided" and "set to None"
    update_data = item.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(db_item, field, value)
    
    db.commit()
    db.refresh(db_item)
    db.refresh(db_item, attribute_names=['asset'])
    return db_item


def delete_watchlist_item(db: Session, item_id: int) -> bool:
    """Delete watchlist item"""
    db_item = get_watchlist_item(db, item_id)
    if not db_item:
        return False
    
    db.delete(db_item)
    db.commit()
    return True


def delete_all_watchlist_items_by_user(db: Session, user_id: int) -> int:
    """Delete all watchlist items for a user. Returns count deleted."""
    count = db.query(Watchlist).filter(Watchlist.user_id == user_id).delete()
    db.commit()
    return count
