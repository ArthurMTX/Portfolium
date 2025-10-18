"""
Transactions router
"""
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import Transaction, TransactionCreate, CsvImportResult
from app.crud import transactions as crud, portfolios as portfolio_crud
from app.models import TransactionType
from app.services.import_csv import get_csv_import_service, CsvImportService

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
    db: Session = Depends(get_db)
):
    """
    Add a position transaction to a portfolio with price fetched from yfinance for the given date.
    - **ticker**: Yahoo Finance ticker symbol
    - **tx_date**: Date of transaction
    - **tx_type**: BUY or SELL
    - **quantity**: Number of shares/units
    """
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
            from app.crud.transactions import get_current_position_quantity
            current_qty = get_current_position_quantity(db, portfolio_id, asset.id)
            if quantity > current_qty:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot sell {quantity} shares of {ticker}. "
                           f"Current position: {current_qty} shares. "
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
    return transaction


@router.get("/{portfolio_id}/transactions", response_model=List[Transaction])
async def get_transactions(
    portfolio_id: int,
    asset_id: Optional[int] = None,
    tx_type: Optional[TransactionType] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get transactions for a portfolio with filters
    
    - **asset_id**: Filter by specific asset
    - **tx_type**: Filter by transaction type (BUY, SELL, etc.)
    - **date_from**: Start date (inclusive)
    - **date_to**: End date (inclusive)
    """
    # Verify portfolio exists
    portfolio = portfolio_crud.get_portfolio(db, portfolio_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
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
    db: Session = Depends(get_db)
):
    """Get transaction by ID"""
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
    db: Session = Depends(get_db)
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
    
    # Validate sell quantity if enabled
    from app.config import settings
    if settings.VALIDATE_SELL_QUANTITY:
        if transaction.type in [TransactionType.SELL, TransactionType.TRANSFER_OUT]:
            current_qty = crud.get_current_position_quantity(
                db, portfolio_id, transaction.asset_id
            )
            if float(transaction.quantity) > current_qty:
                # Get asset symbol for better error message
                from app.crud.assets import get_asset
                asset = get_asset(db, transaction.asset_id)
                symbol = asset.symbol if asset else f"Asset ID {transaction.asset_id}"
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot sell {transaction.quantity} shares of {symbol}. "
                           f"Current position: {current_qty} shares. "
                           f"(This check can be disabled in settings: VALIDATE_SELL_QUANTITY=false)"
                )
    
    return crud.create_transaction(db, portfolio_id, transaction)


@router.put("/{portfolio_id}/transactions/{transaction_id}", response_model=Transaction)
async def update_transaction(
    portfolio_id: int,
    transaction_id: int,
    transaction: TransactionCreate,
    db: Session = Depends(get_db)
):
    """Update existing transaction"""
    existing = crud.get_transaction(db, transaction_id)
    if not existing or existing.portfolio_id != portfolio_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction {transaction_id} not found in portfolio {portfolio_id}"
        )
    
    # Validate sell quantity if enabled
    from app.config import settings
    if settings.VALIDATE_SELL_QUANTITY:
        if transaction.type in [TransactionType.SELL, TransactionType.TRANSFER_OUT]:
            # Calculate position as if the existing transaction doesn't exist
            current_qty = crud.get_current_position_quantity(
                db, portfolio_id, transaction.asset_id
            )
            # Add back the existing transaction if it was a sell
            if existing.type in [TransactionType.SELL, TransactionType.TRANSFER_OUT]:
                current_qty += float(existing.quantity)
            # Subtract if existing was a buy (in case asset changed)
            elif existing.type in [TransactionType.BUY, TransactionType.TRANSFER_IN]:
                if existing.asset_id != transaction.asset_id:
                    # Asset changed, recalculate for new asset
                    current_qty = crud.get_current_position_quantity(
                        db, portfolio_id, transaction.asset_id
                    )
            
            if float(transaction.quantity) > current_qty:
                from app.crud.assets import get_asset
                asset = get_asset(db, transaction.asset_id)
                symbol = asset.symbol if asset else f"Asset ID {transaction.asset_id}"
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot sell {transaction.quantity} shares of {symbol}. "
                           f"Current position: {current_qty} shares. "
                           f"(This check can be disabled in settings: VALIDATE_SELL_QUANTITY=false)"
                )
    
    updated = crud.update_transaction(db, transaction_id, transaction)
    return updated


@router.delete(
    "/{portfolio_id}/transactions/{transaction_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
async def delete_transaction(
    portfolio_id: int,
    transaction_id: int,
    db: Session = Depends(get_db)
):
    """Delete transaction"""
    existing = crud.get_transaction(db, transaction_id)
    if not existing or existing.portfolio_id != portfolio_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction {transaction_id} not found in portfolio {portfolio_id}"
        )
    
    crud.delete_transaction(db, transaction_id)


@router.post("/import/csv", response_model=CsvImportResult)
async def import_csv(
    portfolio_id: int,
    file: UploadFile = File(...),
    csv_service = Depends(get_csv_import_service)
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
