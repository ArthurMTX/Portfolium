"""
CRUD operations for watchlist
"""
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_

from app.models import Watchlist, WatchlistTag
from app.schemas import WatchlistItemCreate, WatchlistItemUpdate, WatchlistTagCreate, WatchlistTagUpdate


def get_watchlist_item(db: Session, item_id: int) -> Optional[Watchlist]:
    """Get watchlist item by ID"""
    return db.query(Watchlist).options(
        joinedload(Watchlist.asset),
        joinedload(Watchlist.tags)
    ).filter(
        Watchlist.id == item_id
    ).first()


def get_watchlist_items_by_user(
    db: Session, 
    user_id: int, 
    skip: int = 0, 
    limit: int = 100,
    tag_ids: Optional[List[int]] = None,
    tag_mode: str = "any"
) -> List[Watchlist]:
    """Get all watchlist items for a user, optionally filtered by tags.
    
    Args:
        tag_mode: "any" returns items matching ANY tag (OR), 
                  "all" returns items matching ALL tags (AND)
    """
    query = db.query(Watchlist).options(
        joinedload(Watchlist.asset),
        joinedload(Watchlist.tags)
    ).filter(
        Watchlist.user_id == user_id
    )
    
    # Filter by tags if provided
    if tag_ids:
        if tag_mode == "all":
            # AND logic: item must have ALL specified tags
            for tag_id in tag_ids:
                query = query.filter(Watchlist.tags.any(WatchlistTag.id == tag_id))
        else:
            # OR logic: item must have ANY of the specified tags
            query = query.filter(Watchlist.tags.any(WatchlistTag.id.in_(tag_ids)))
    
    return query.offset(skip).limit(limit).all()


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


# ============================================================================
# Watchlist Tag CRUD Operations
# ============================================================================

def get_tag(db: Session, tag_id: int) -> Optional[WatchlistTag]:
    """Get a watchlist tag by ID"""
    return db.query(WatchlistTag).filter(WatchlistTag.id == tag_id).first()


def get_tags_by_user(db: Session, user_id: int) -> List[WatchlistTag]:
    """Get all watchlist tags for a user"""
    return db.query(WatchlistTag).filter(
        WatchlistTag.user_id == user_id
    ).order_by(WatchlistTag.name).all()


def get_tag_by_name(db: Session, user_id: int, name: str) -> Optional[WatchlistTag]:
    """Get a tag by name for a specific user"""
    return db.query(WatchlistTag).filter(
        WatchlistTag.user_id == user_id,
        WatchlistTag.name == name
    ).first()


def create_tag(db: Session, tag: WatchlistTagCreate, user_id: int) -> WatchlistTag:
    """Create a new watchlist tag"""
    db_tag = WatchlistTag(
        user_id=user_id,
        name=tag.name,
        icon=tag.icon,
        color=tag.color
    )
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag


def update_tag(db: Session, tag_id: int, tag: WatchlistTagUpdate) -> Optional[WatchlistTag]:
    """Update an existing watchlist tag"""
    db_tag = get_tag(db, tag_id)
    if not db_tag:
        return None
    
    update_data = tag.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_tag, field, value)
    
    db.commit()
    db.refresh(db_tag)
    return db_tag


def delete_tag(db: Session, tag_id: int) -> bool:
    """Delete a watchlist tag"""
    db_tag = get_tag(db, tag_id)
    if not db_tag:
        return False
    
    db.delete(db_tag)
    db.commit()
    return True


def update_watchlist_item_tags(
    db: Session, 
    item_id: int, 
    tag_ids: List[int],
    user_id: int
) -> Optional[Watchlist]:
    """Update the tags for a watchlist item"""
    db_item = get_watchlist_item(db, item_id)
    if not db_item:
        return None
    
    # Get the tags that belong to this user
    tags = db.query(WatchlistTag).filter(
        WatchlistTag.id.in_(tag_ids),
        WatchlistTag.user_id == user_id
    ).all()
    
    # Update the tags
    db_item.tags = tags
    db.commit()
    db.refresh(db_item)
    return db_item
