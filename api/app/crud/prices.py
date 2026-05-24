"""
CRUD operations for prices
"""
from collections import defaultdict
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_
from sqlalchemy.dialects.postgresql import insert as postgresql_insert

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
    if db.bind and db.bind.dialect.name == "postgresql":
        statement = postgresql_insert(Price).values(
            asset_id=price.asset_id,
            asof=price.asof,
            price=price.price,
            volume=price.volume,
            source=price.source,
        )
        statement = statement.on_conflict_do_update(
            index_elements=["asset_id", "asof"],
            set_={
                "price": statement.excluded.price,
                "volume": statement.excluded.volume,
                "source": statement.excluded.source,
            },
        ).returning(Price.id)

        try:
            price_id = db.execute(statement).scalar_one()
            db.commit()
            return db.query(Price).filter(Price.id == price_id).first()
        except Exception:
            db.rollback()
            raise

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
    """Backward-compatible bulk create/update wrapper."""
    return bulk_upsert_prices(db, prices)


def bulk_upsert_prices(db: Session, prices: List[PriceCreate]) -> int:
    """
    Create or update price records in one transaction.

    PostgreSQL uses ON CONFLICT on the unique (asset_id, asof) index. SQLite and
    other dialects use a transaction-scoped application fallback for tests/local
    compatibility.
    """
    if not prices:
        return 0

    deduped: dict[tuple[int, datetime], PriceCreate] = {}
    for price in prices:
        deduped[(price.asset_id, price.asof)] = price

    if db.bind and db.bind.dialect.name == "postgresql":
        rows = [
            {
                "asset_id": price.asset_id,
                "asof": price.asof,
                "price": price.price,
                "volume": price.volume,
                "source": price.source,
            }
            for price in deduped.values()
        ]
        statement = postgresql_insert(Price).values(rows)
        statement = statement.on_conflict_do_update(
            index_elements=["asset_id", "asof"],
            set_={
                "price": statement.excluded.price,
                "volume": statement.excluded.volume,
                "source": statement.excluded.source,
            },
        )

        try:
            db.execute(statement)
            db.commit()
        except Exception:
            db.rollback()
            raise

        return len(deduped)

    asset_ids = {asset_id for asset_id, _ in deduped}
    asofs = {asof for _, asof in deduped}

    existing_prices = (
        db.query(Price)
        .filter(
            Price.asset_id.in_(asset_ids),
            Price.asof.in_(asofs),
        )
        .all()
    )

    existing_by_key: dict[tuple[int, datetime], list[Price]] = defaultdict(list)
    for existing in existing_prices:
        existing_by_key[(existing.asset_id, existing.asof)].append(existing)

    new_prices: list[Price] = []
    for key, price in deduped.items():
        existing_rows = existing_by_key.get(key)
        if existing_rows:
            for existing in existing_rows:
                existing.price = price.price
                existing.volume = price.volume
                existing.source = price.source
            continue

        new_prices.append(
            Price(
                asset_id=price.asset_id,
                asof=price.asof,
                price=price.price,
                volume=price.volume,
                source=price.source,
            )
        )

    if new_prices:
        db.add_all(new_prices)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return len(deduped)
