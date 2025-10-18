"""
CRUD operations for prices
"""
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models import Price, Asset
from app.schemas import PriceCreate


def get_latest_price(db: Session, asset_id: int) -> Optional[Price]:
    """Get most recent price for an asset"""
    return (
        db.query(Price)
        .filter(Price.asset_id == asset_id)
        .order_by(Price.asof.desc())
        .first()
    )


def get_prices(
    db: Session,
    asset_id: int,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    limit: int = 100
) -> List[Price]:
    """Get price history for an asset"""
    q = db.query(Price).filter(Price.asset_id == asset_id)
    
    if date_from:
        q = q.filter(Price.asof >= date_from)
    if date_to:
        q = q.filter(Price.asof <= date_to)
    
    return q.order_by(Price.asof.desc()).limit(limit).all()


def create_price(db: Session, price: PriceCreate) -> Price:
    """Create or update price record"""
    # Check if price already exists for this asset and timestamp
    existing = (
        db.query(Price)
        .filter(
            and_(
                Price.asset_id == price.asset_id,
                Price.asof == price.asof
            )
        )
        .first()
    )
    
    if existing:
        # Update existing price
        existing.price = price.price
        existing.volume = price.volume
        existing.source = price.source
        db.commit()
        db.refresh(existing)
        return existing
    
    # Create new price
    db_price = Price(
        asset_id=price.asset_id,
        asof=price.asof,
        price=price.price,
        volume=price.volume,
        source=price.source
    )
    db.add(db_price)
    db.commit()
    db.refresh(db_price)
    return db_price


def bulk_create_prices(db: Session, prices: List[PriceCreate]) -> int:
    """Bulk insert prices"""
    count = 0
    for price in prices:
        create_price(db, price)
        count += 1
    return count
