"""
CRUD operations for transactions
"""
from typing import List, Optional
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models import Transaction, TransactionType
from app.schemas import TransactionCreate


def get_transaction(db: Session, transaction_id: int) -> Optional[Transaction]:
    """Get transaction by ID"""
    return db.query(Transaction).filter(Transaction.id == transaction_id).first()


def get_transactions(
    db: Session,
    portfolio_id: Optional[int] = None,
    asset_id: Optional[int] = None,
    tx_type: Optional[TransactionType] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    skip: int = 0,
    limit: Optional[int] = None
) -> List[Transaction]:
    """
    Get transactions with filters
    
    Args:
        db: Database session
        portfolio_id: Filter by portfolio
        asset_id: Filter by asset
        tx_type: Filter by transaction type
        date_from: Start date (inclusive)
        date_to: End date (inclusive)
        skip: Number of records to skip
        limit: Maximum number of records to return (None for all)
    """
    q = db.query(Transaction)
    
    if portfolio_id:
        q = q.filter(Transaction.portfolio_id == portfolio_id)
    if asset_id:
        q = q.filter(Transaction.asset_id == asset_id)
    if tx_type:
        q = q.filter(Transaction.type == tx_type)
    if date_from:
        q = q.filter(Transaction.tx_date >= date_from)
    if date_to:
        q = q.filter(Transaction.tx_date <= date_to)
    
    # Sort by date descending, then by created_at descending for transactions on the same date
    q = q.order_by(Transaction.tx_date.desc(), Transaction.created_at.desc()).offset(skip)
    
    if limit is not None:
        q = q.limit(limit)
    
    return q.all()


def create_transaction(
    db: Session, 
    portfolio_id: int,
    transaction: TransactionCreate
) -> Transaction:
    """Create new transaction"""
    db_transaction = Transaction(
        portfolio_id=portfolio_id,
        asset_id=transaction.asset_id,
        tx_date=transaction.tx_date,
        type=transaction.type,
        quantity=transaction.quantity,
        price=transaction.price,
        fees=transaction.fees,
        currency=transaction.currency,
        meta_data=transaction.meta_data,
        notes=transaction.notes
    )
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction


def update_transaction(
    db: Session,
    transaction_id: int,
    transaction: TransactionCreate
) -> Optional[Transaction]:
    """Update existing transaction"""
    db_transaction = get_transaction(db, transaction_id)
    if not db_transaction:
        return None
    
    db_transaction.asset_id = transaction.asset_id
    db_transaction.tx_date = transaction.tx_date
    db_transaction.type = transaction.type
    db_transaction.quantity = transaction.quantity
    db_transaction.price = transaction.price
    db_transaction.fees = transaction.fees
    db_transaction.currency = transaction.currency
    db_transaction.meta_data = transaction.meta_data
    db_transaction.notes = transaction.notes
    
    db.commit()
    db.refresh(db_transaction)
    return db_transaction


def delete_transaction(db: Session, transaction_id: int) -> bool:
    """Delete transaction"""
    db_transaction = get_transaction(db, transaction_id)
    if not db_transaction:
        return False
    
    db.delete(db_transaction)
    db.commit()
    return True


def get_current_position_quantity(
    db: Session,
    portfolio_id: int,
    asset_id: int
) -> float:
    """
    Calculate the current quantity held for an asset in a portfolio.
    Takes into account BUY, SELL, TRANSFER_IN, TRANSFER_OUT, and SPLIT transactions.
    
    Returns:
        Current quantity (can be 0 or negative in edge cases)
    """
    from decimal import Decimal
    
    transactions = (
        db.query(Transaction)
        .filter(
            and_(
                Transaction.portfolio_id == portfolio_id,
                Transaction.asset_id == asset_id
            )
        )
        .order_by(Transaction.tx_date, Transaction.created_at)
        .all()
    )
    
    quantity = Decimal(0)
    
    for tx in transactions:
        if tx.type == TransactionType.BUY or tx.type == TransactionType.TRANSFER_IN:
            quantity += tx.quantity
        elif tx.type == TransactionType.SELL or tx.type == TransactionType.TRANSFER_OUT:
            quantity -= tx.quantity
        elif tx.type == TransactionType.SPLIT:
            # Handle stock split (e.g., 2:1 means double shares)
            split_ratio = _parse_split_ratio(tx.meta_data.get("split", "1:1"))
            quantity *= Decimal(str(split_ratio))
    
    return float(quantity)


def get_position_quantity_at_date(
    db: Session,
    portfolio_id: int,
    asset_id: int,
    as_of_date: date,
    exclude_transaction_id: int | None = None
) -> float:
    """
    Calculate the quantity held for an asset in a portfolio at a specific date.
    Only considers transactions up to (but NOT including) the as_of_date.
    This is used for validation - to check if you have enough shares to sell on a given date.
    
    Args:
        db: Database session
        portfolio_id: Portfolio ID
        asset_id: Asset ID
        as_of_date: Calculate position up to this date (exclusive)
        exclude_transaction_id: Optional transaction ID to exclude (for update validation)
    
    Returns:
        Quantity held just before the as_of_date
    """
    from decimal import Decimal
    
    query = (
        db.query(Transaction)
        .filter(
            and_(
                Transaction.portfolio_id == portfolio_id,
                Transaction.asset_id == asset_id,
                Transaction.tx_date < as_of_date
            )
        )
    )
    
    if exclude_transaction_id is not None:
        query = query.filter(Transaction.id != exclude_transaction_id)
    
    transactions = query.order_by(Transaction.tx_date, Transaction.created_at).all()
    
    quantity = Decimal(0)
    
    for tx in transactions:
        if tx.type == TransactionType.BUY or tx.type == TransactionType.TRANSFER_IN:
            quantity += tx.quantity
        elif tx.type == TransactionType.SELL or tx.type == TransactionType.TRANSFER_OUT:
            quantity -= tx.quantity
        elif tx.type == TransactionType.SPLIT:
            # Handle stock split (e.g., 2:1 means double shares)
            split_ratio = _parse_split_ratio(tx.meta_data.get("split", "1:1"))
            quantity *= Decimal(str(split_ratio))
    
    return float(quantity)



def _parse_split_ratio(split_str: str) -> float:
    """Parse split ratio string like '2:1' into multiplier (2.0)"""
    try:
        parts = split_str.split(":")
        if len(parts) == 2:
            return float(parts[0]) / float(parts[1])
        return 1.0
    except (ValueError, ZeroDivisionError):
        return 1.0
