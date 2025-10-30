"""
Transactions router
"""
import logging
from typing import List, Optional
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import Transaction, TransactionCreate, CsvImportResult
from app.crud import transactions as crud, portfolios as portfolio_crud
from app.models import TransactionType, User
from app.services.import_csv import get_csv_import_service, CsvImportService
from app.services.notifications import notification_service
from app.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()
import yfinance as yf

# Add position transaction with live price from yfinance
@router.post("/{portfolio_id}/add_position_transaction", response_model=Transaction, status_code=status.HTTP_201_CREATED)
async def add_position_transaction(
    portfolio_id: int,
    ticker: str,
    tx_date: date,
    tx_type: TransactionType,
    quantity: float,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add a position transaction to a portfolio with price fetched from yfinance for the given date.
    - **ticker**: Yahoo Finance ticker symbol
    - **tx_date**: Date of transaction
    - **tx_type**: BUY or SELL
    - **quantity**: Number of shares/units
    """
    # Verify portfolio exists and belongs to the current user
    portfolio = portfolio_crud.get_portfolio(db, portfolio_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    if portfolio.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this portfolio"
        )
    
    # Find asset by ticker
    from app.crud.assets import get_asset_by_symbol, create_asset
    from app.schemas import AssetCreate
    from app.models import AssetClass
    asset = get_asset_by_symbol(db, ticker)
    if not asset:
        # Auto-create the asset - name will be fetched from yfinance
        asset_data = AssetCreate(
            symbol=ticker,
            name=None,  # Let create_asset fetch the proper name from yfinance
            currency="USD",
            class_=AssetClass.STOCK
        )
        asset = create_asset(db, asset_data)

    # Fetch price from yfinance for the given date
    from datetime import timedelta
    from decimal import Decimal
    yf_ticker = yf.Ticker(ticker)
    # Add a day buffer to ensure we get data
    start_date = tx_date - timedelta(days=1)
    end_date = tx_date + timedelta(days=1)
    hist = yf_ticker.history(start=start_date, end=end_date)
    if hist.empty:
        raise HTTPException(status_code=404, detail=f"No price found for {ticker} on {tx_date}")
    # Get the closest date's price and round to 8 decimal places
    price = Decimal(str(float(hist["Close"].iloc[-1]))).quantize(Decimal('0.00000001'))

    # Validate sell quantity if enabled
    from app.config import settings
    if settings.VALIDATE_SELL_QUANTITY:
        if tx_type in [TransactionType.SELL, TransactionType.TRANSFER_OUT]:
            from app.crud.transactions import get_position_quantity_at_date
            position_before_sell = get_position_quantity_at_date(db, portfolio_id, asset.id, tx_date)
            if quantity > position_before_sell:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot sell {quantity} shares of {ticker} on {tx_date}. "
                           f"Position at that date: {position_before_sell} shares. "
                           f"(This check can be disabled in settings: VALIDATE_SELL_QUANTITY=false)"
                )
    
    # Create transaction
    from app.schemas import TransactionCreate
    tx_data = TransactionCreate(
        asset_id=asset.id,
        tx_date=tx_date,
        type=tx_type,
        quantity=quantity,
        price=price,
        currency=asset.currency,
        fees=0,
        meta_data={},
        notes=f"Auto price from yfinance for {tx_date}"
    )
    from app.crud.transactions import create_transaction
    transaction = create_transaction(db, portfolio_id, tx_data)
    
    # Update first_transaction_date if this is earlier than the current value
    if asset.first_transaction_date is None or tx_date < asset.first_transaction_date:
        asset.first_transaction_date = tx_date
        db.commit()
        db.refresh(asset)
        logger.info(f"Updated first_transaction_date for {asset.symbol} to {tx_date}")
    
    # Auto-backfill historical prices from first transaction date to today
    from app.services.pricing import PricingService
    pricing_service = PricingService(db)
    start_date = datetime.combine(asset.first_transaction_date, datetime.min.time())
    end_date = datetime.utcnow()
    
    try:
        count = pricing_service.ensure_historical_prices(asset, start_date, end_date)
        logger.info(f"Auto-backfilled {count} historical prices for {asset.symbol} from {asset.first_transaction_date} to today")
    except Exception as e:
        logger.warning(f"Failed to auto-backfill prices for {asset.symbol}: {e}")
    
    # Create notification for transaction
    notification_service.create_transaction_notification(
        db=db,
        user_id=current_user.id,
        transaction=transaction,
        action="created"
    )
    
    return transaction


@router.get("/{portfolio_id}/transactions", response_model=List[Transaction])
async def get_transactions(
    portfolio_id: int,
    asset_id: Optional[int] = None,
    tx_type: Optional[TransactionType] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    skip: int = 0,
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get transactions for a portfolio with filters
    
    - **asset_id**: Filter by specific asset
    - **tx_type**: Filter by transaction type (BUY, SELL, etc.)
    - **date_from**: Start date (inclusive)
    - **date_to**: End date (inclusive)
    - **limit**: Maximum number of records to return (None for all)
    """
    # Verify portfolio exists
    portfolio = portfolio_crud.get_portfolio(db, portfolio_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    if portfolio.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this portfolio"
        )
    
    transactions = crud.get_transactions(
        db=db,
        portfolio_id=portfolio_id,
        asset_id=asset_id,
        tx_type=tx_type,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit
    )
    
    return transactions


@router.get("/{portfolio_id}/transactions/{transaction_id}", response_model=Transaction)
async def get_transaction(
    portfolio_id: int,
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get transaction by ID"""
    # Verify portfolio access
    portfolio = portfolio_crud.get_portfolio(db, portfolio_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    if portfolio.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this portfolio"
        )
    
    transaction = crud.get_transaction(db, transaction_id)
    if not transaction or transaction.portfolio_id != portfolio_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction {transaction_id} not found in portfolio {portfolio_id}"
        )
    return transaction


@router.post(
    "/{portfolio_id}/transactions",
    response_model=Transaction,
    status_code=status.HTTP_201_CREATED
)
async def create_transaction(
    portfolio_id: int,
    transaction: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create new transaction
    
    Supports all transaction types:
    - **BUY**: Purchase of shares/units
    - **SELL**: Sale of shares/units
    - **DIVIDEND**: Dividend payment
    - **FEE**: Transaction fee
    - **SPLIT**: Stock split (use metadata.split for ratio, e.g., "2:1")
    - **TRANSFER_IN/OUT**: Transfer between portfolios
    """
    # Verify portfolio exists
    portfolio = portfolio_crud.get_portfolio(db, portfolio_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    if portfolio.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this portfolio"
        )
    
    # Validate SPLIT transactions - must have existing position transactions
    if transaction.type == TransactionType.SPLIT:
        # Check if there are any BUY/SELL transactions for this asset in this portfolio
        existing_txs = crud.get_transactions(
            db,
            portfolio_id=portfolio_id,
            asset_id=transaction.asset_id
        )
        has_position_txs = any(
            tx.type in [TransactionType.BUY, TransactionType.SELL, TransactionType.TRANSFER_IN, TransactionType.TRANSFER_OUT]
            for tx in existing_txs
        )
        if not has_position_txs:
            from app.crud.assets import get_asset
            asset = get_asset(db, transaction.asset_id)
            symbol = asset.symbol if asset else f"Asset ID {transaction.asset_id}"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot record a split for {symbol} without any existing position transactions. "
                       f"Please add at least one BUY transaction before recording a split."
            )
    
    # Validate sell quantity if enabled
    from app.config import settings
    if settings.VALIDATE_SELL_QUANTITY:
        if transaction.type in [TransactionType.SELL, TransactionType.TRANSFER_OUT]:
            position_before_sell = crud.get_position_quantity_at_date(
                db, portfolio_id, transaction.asset_id, transaction.tx_date
            )
            if float(transaction.quantity) > position_before_sell:
                # Get asset symbol for better error message
                from app.crud.assets import get_asset
                asset = get_asset(db, transaction.asset_id)
                symbol = asset.symbol if asset else f"Asset ID {transaction.asset_id}"
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot sell {transaction.quantity} shares of {symbol} on {transaction.tx_date}. "
                           f"Position at that date: {position_before_sell} shares. "
                           f"(This check can be disabled in settings: VALIDATE_SELL_QUANTITY=false)"
                )
    
    created = crud.create_transaction(db, portfolio_id, transaction)
    
    # Auto-backfill historical prices from transaction date to today
    if transaction.type in [TransactionType.BUY, TransactionType.TRANSFER_IN]:
        from app.services.pricing import PricingService
        from app.crud.assets import get_asset
        from datetime import datetime
        
        asset = get_asset(db, transaction.asset_id)
        if asset:
            # Update first_transaction_date if this is earlier than the current value
            if asset.first_transaction_date is None or transaction.tx_date < asset.first_transaction_date:
                asset.first_transaction_date = transaction.tx_date
                db.commit()
                db.refresh(asset)
                logger.info(f"Updated first_transaction_date for {asset.symbol} to {transaction.tx_date}")
            
            # Backfill historical prices from first transaction date to today
            pricing_service = PricingService(db)
            start_date = datetime.combine(asset.first_transaction_date, datetime.min.time())
            end_date = datetime.utcnow()
            
            try:
                count = pricing_service.ensure_historical_prices(asset, start_date, end_date)
                logger.info(f"Auto-backfilled {count} historical prices for {asset.symbol} from {asset.first_transaction_date} to today")
            except Exception as e:
                logger.warning(f"Failed to auto-backfill prices for {asset.symbol}: {e}")
    
    # Create notification for transaction
    notification_service.create_transaction_notification(
        db=db,
        user_id=current_user.id,
        transaction=created,
        action="created"
    )
    
    return created


@router.put("/{portfolio_id}/transactions/{transaction_id}", response_model=Transaction)
async def update_transaction(
    portfolio_id: int,
    transaction_id: int,
    transaction: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update existing transaction"""
    # Verify portfolio access
    portfolio = portfolio_crud.get_portfolio(db, portfolio_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    if portfolio.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this portfolio"
        )
    
    existing = crud.get_transaction(db, transaction_id)
    if not existing or existing.portfolio_id != portfolio_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction {transaction_id} not found in portfolio {portfolio_id}"
        )
    
    # Validate SPLIT transactions - must have existing position transactions (excluding the current one being updated)
    if transaction.type == TransactionType.SPLIT:
        existing_txs = crud.get_transactions(
            db,
            portfolio_id=portfolio_id,
            asset_id=transaction.asset_id
        )
        has_position_txs = any(
            tx.id != transaction_id and tx.type in [TransactionType.BUY, TransactionType.SELL, TransactionType.TRANSFER_IN, TransactionType.TRANSFER_OUT]
            for tx in existing_txs
        )
        if not has_position_txs:
            from app.crud.assets import get_asset
            asset = get_asset(db, transaction.asset_id)
            symbol = asset.symbol if asset else f"Asset ID {transaction.asset_id}"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot record a split for {symbol} without any existing position transactions. "
                       f"Please add at least one BUY transaction before recording a split."
            )
    
    # Validate sell quantity if enabled
    from app.config import settings
    if settings.VALIDATE_SELL_QUANTITY:
        if transaction.type in [TransactionType.SELL, TransactionType.TRANSFER_OUT]:
            # Calculate position at the transaction date, excluding the transaction being updated
            position_before_sell = crud.get_position_quantity_at_date(
                db, portfolio_id, transaction.asset_id, transaction.tx_date,
                exclude_transaction_id=transaction_id
            )
            
            if float(transaction.quantity) > position_before_sell:
                from app.crud.assets import get_asset
                asset = get_asset(db, transaction.asset_id)
                symbol = asset.symbol if asset else f"Asset ID {transaction.asset_id}"
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot sell {transaction.quantity} shares of {symbol} on {transaction.tx_date}. "
                           f"Position at that date: {position_before_sell} shares. "
                           f"(This check can be disabled in settings: VALIDATE_SELL_QUANTITY=false)"
                )
    
    updated = crud.update_transaction(db, transaction_id, transaction)
    
    # Create notification for transaction update
    notification_service.create_transaction_notification(
        db=db,
        user_id=current_user.id,
        transaction=updated,
        action="updated"
    )
    
    return updated


@router.delete(
    "/{portfolio_id}/transactions/{transaction_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
async def delete_transaction(
    portfolio_id: int,
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete transaction"""
    # Verify portfolio access
    portfolio = portfolio_crud.get_portfolio(db, portfolio_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    if portfolio.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this portfolio"
        )
    
    existing = crud.get_transaction(db, transaction_id)
    if not existing or existing.portfolio_id != portfolio_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction {transaction_id} not found in portfolio {portfolio_id}"
        )
    
    # Create notification for transaction deletion (before deleting)
    notification_service.create_transaction_notification(
        db=db,
        user_id=current_user.id,
        transaction=existing,
        action="deleted"
    )
    
    crud.delete_transaction(db, transaction_id)


@router.post("/import/csv", response_model=CsvImportResult)
async def import_csv(
    portfolio_id: int,
    file: UploadFile = File(...),
    csv_service = Depends(get_csv_import_service),
    current_user: User = Depends(get_current_user)
):
    """
    Import transactions from CSV file
    
    Expected CSV format:
    ```
    date,symbol,type,quantity,price,fees,currency,notes
    2024-01-15,AAPL,BUY,10,150.25,9.99,USD,Initial purchase
    2024-02-20,AAPL,SELL,5,165.50,9.99,USD,Taking profits
    ```
    
    For splits, add split_ratio column:
    ```
    date,symbol,type,split_ratio,notes
    2024-06-01,AAPL,SPLIT,2:1,2-for-1 stock split
    ```
    """
    # Verify portfolio exists
    portfolio = portfolio_crud.get_portfolio(csv_service.db, portfolio_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    if portfolio.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this portfolio"
        )
    
    # Read file content
    content = await file.read()
    csv_content = content.decode("utf-8")
    
    # Import
    result = csv_service.import_csv(portfolio_id, csv_content)
    
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"errors": result.errors, "imported": result.imported_count}
        )
    
    return result
