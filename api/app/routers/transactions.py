"""
Transactions router
"""
import logging
import json
from typing import List, Optional
from datetime import date, datetime
from fastapi import APIRouter, Depends, status, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.errors import (
    CannotSellMoreThanOwnedError,
    CannotSplitWithoutBuyError,
    ImportTransactionsError, 
    PriceNotFoundError, 
    TransactionNotFoundError
)
from app.db import get_db
from app.schemas import Transaction, TransactionCreate, CsvImportResult, ConversionCreate, ConversionResponse
from app.crud import transactions as crud, portfolios as portfolio_crud
from app.models import TransactionType, User, Portfolio as PortfolioModel, Transaction as TransactionModel
from app.services.import_csv import get_csv_import_service, CsvImportService
from app.services.notifications import notification_service
from app.auth import get_current_user, verify_portfolio_access
from app.dependencies import PricingServiceDep

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
    pricing_service: PricingServiceDep,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
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
        raise PriceNotFoundError(ticker, tx_date)
    # Get the closest date's price and round to 8 decimal places
    price = Decimal(str(float(hist["Close"].iloc[-1]))).quantize(Decimal('0.00000001'))

    # Validate sell quantity if enabled
    from app.config import settings
    if settings.VALIDATE_SELL_QUANTITY:
        if tx_type in [TransactionType.SELL, TransactionType.TRANSFER_OUT, TransactionType.CONVERSION_OUT]:
            from app.crud.transactions import get_position_quantity_at_date
            position_before_sell = get_position_quantity_at_date(db, portfolio_id, asset.id, tx_date)
            if quantity > position_before_sell:
                raise CannotSellMoreThanOwnedError(
                    symbol=ticker,
                    owned=position_before_sell,
                    attempted_sell=quantity,
                    tx_date=tx_date
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
    start_date = datetime.combine(asset.first_transaction_date, datetime.min.time())
    end_date = datetime.utcnow()
    
    try:
        count = pricing_service.ensure_historical_prices(asset, start_date, end_date)
        logger.info(f"Auto-backfilled {count} historical prices for {asset.symbol} from {asset.first_transaction_date} to today")
    except Exception as e:
        logger.warning(f"Failed to auto-backfill prices for {asset.symbol}: {e}")
    
    # Invalidate all caches since portfolio data changed
    from app.services.analytics_cache import invalidate_portfolio_analytics
    from app.services.cache import invalidate_positions, CacheService
    invalidate_portfolio_analytics(portfolio_id)
    invalidate_positions(portfolio_id)
    
    # Invalidate assets cache (held/sold)
    cache_service = CacheService()
    cache_service.delete_pattern(f"assets_held:{current_user.id}:*")
    cache_service.delete_pattern(f"assets_sold:{current_user.id}:*")
    
    logger.info(f"Invalidated caches for portfolio {portfolio_id} after transaction")
    
    # Trigger background recalculation of metrics and insights
    try:
        from app.config import settings
        if settings.ENABLE_BACKGROUND_TASKS:
            from app.tasks.metrics_tasks import calculate_portfolio_metrics
            from app.tasks.insights_tasks import calculate_insights_all_periods
            
            # Queue async tasks to recalculate metrics and insights
            calculate_portfolio_metrics.delay(portfolio_id, current_user.id)
            calculate_insights_all_periods.delay(portfolio_id, current_user.id)
            logger.info(f"Queued background recalculation for portfolio {portfolio_id}")
    except Exception as e:
        # Don't fail the request if background task queueing fails
        logger.warning(f"Failed to queue background tasks for portfolio {portfolio_id}: {e}")
    
    # Create notification for transaction
    notification_service.create_transaction_notification(
        db=db,
        user_id=current_user.id,
        transaction=transaction,
        action="created"
    )
    
    return transaction


@router.post("/{portfolio_id}/conversions", response_model=ConversionResponse, status_code=status.HTTP_201_CREATED)
async def create_conversion(
    portfolio_id: int,
    conversion: ConversionCreate,
    pricing_service: PricingServiceDep,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
):
    """
    Create a crypto conversion/swap transaction (e.g., BTC → ETH)
    
    This creates two linked transactions:
    - **CONVERSION_OUT**: Removes the source asset from your portfolio
    - **CONVERSION_IN**: Adds the target asset to your portfolio
    
    Both transactions are linked via a unique conversion_id in their metadata,
    allowing you to track and manage conversions as a single operation.
    
    Example: Swapping 0.5 BTC for 8 ETH
    - from_asset_id: BTC asset ID
    - from_quantity: 0.5
    - from_price: 40000 (BTC price at conversion time)
    - to_asset_id: ETH asset ID  
    - to_quantity: 8
    - to_price: 2500 (ETH price at conversion time)
    """
    import uuid
    from decimal import Decimal
    from fastapi import HTTPException
    
    # Validate that source and target assets are different
    if conversion.from_asset_id == conversion.to_asset_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot convert an asset to itself. Source and target assets must be different."
        )
    
    # Get asset symbols for better notes
    from app.crud.assets import get_asset
    from_asset = get_asset(db, conversion.from_asset_id)
    to_asset = get_asset(db, conversion.to_asset_id)
    from_symbol = from_asset.symbol if from_asset else f"Asset #{conversion.from_asset_id}"
    to_symbol = to_asset.symbol if to_asset else f"Asset #{conversion.to_asset_id}"
    
    # Generate unique conversion ID to link both transactions
    conversion_id = str(uuid.uuid4())
    
    # Calculate conversion rate (how many target units per source unit)
    conversion_rate = float(conversion.to_quantity) / float(conversion.from_quantity) if float(conversion.from_quantity) > 0 else 0
    conversion_rate_str = f"{conversion.from_quantity}:{conversion.to_quantity}"
    
    # Validate that user has enough of the source asset
    from app.config import settings
    if settings.VALIDATE_SELL_QUANTITY:
        position_before_conversion = crud.get_position_quantity_at_date(
            db, portfolio_id, conversion.from_asset_id, conversion.tx_date
        )
        if float(conversion.from_quantity) > position_before_conversion:
            from app.crud.assets import get_asset
            asset = get_asset(db, conversion.from_asset_id)
            symbol = asset.symbol if asset else f"Asset ID {conversion.from_asset_id}"
            raise CannotSellMoreThanOwnedError(
                symbol=symbol,
                owned=position_before_conversion,
                attempted_sell=float(conversion.from_quantity),
                tx_date=conversion.tx_date
            )
    
    # Create both transactions atomically using a savepoint
    # If either fails, both will be rolled back
    try:
        # Start a savepoint for atomic operation
        savepoint = db.begin_nested()
        
        # Create CONVERSION_OUT transaction (source asset leaving)
        from_tx_data = TransactionCreate(
            asset_id=conversion.from_asset_id,
            tx_date=conversion.tx_date,
            type=TransactionType.CONVERSION_OUT,
            quantity=conversion.from_quantity,
            price=conversion.from_price,
            fees=conversion.fees,  # Fees typically applied to the outgoing side
            currency=conversion.currency,
            meta_data={
                "conversion_id": conversion_id,
                "conversion_to_asset_id": conversion.to_asset_id,
                "conversion_to_symbol": to_symbol,
                "conversion_to_quantity": str(conversion.to_quantity),
                "conversion_rate": conversion_rate,
                "conversion_rate_str": conversion_rate_str,
            },
            notes=conversion.notes or f"Swapped {conversion.from_quantity} {from_symbol} → {conversion.to_quantity} {to_symbol}"
        )
        
        # Create the transaction without committing
        from_db_transaction = TransactionModel(
            portfolio_id=portfolio_id,
            asset_id=from_tx_data.asset_id,
            tx_date=from_tx_data.tx_date,
            type=from_tx_data.type,
            quantity=from_tx_data.quantity,
            price=from_tx_data.price,
            fees=from_tx_data.fees,
            currency=from_tx_data.currency,
            meta_data=from_tx_data.meta_data,
            notes=from_tx_data.notes
        )
        db.add(from_db_transaction)
        db.flush()  # Flush to get the ID without committing
        
        # Create CONVERSION_IN transaction (target asset arriving)
        to_tx_data = TransactionCreate(
            asset_id=conversion.to_asset_id,
            tx_date=conversion.tx_date,
            type=TransactionType.CONVERSION_IN,
            quantity=conversion.to_quantity,
            price=conversion.to_price,
            fees=Decimal(0),  # Fees already captured in CONVERSION_OUT
            currency=conversion.currency,
            meta_data={
                "conversion_id": conversion_id,
                "conversion_from_asset_id": conversion.from_asset_id,
                "conversion_from_symbol": from_symbol,
                "conversion_from_quantity": str(conversion.from_quantity),
                "conversion_rate": conversion_rate,
                "conversion_rate_str": conversion_rate_str,
            },
            notes=conversion.notes or f"Swapped {conversion.from_quantity} {from_symbol} → {conversion.to_quantity} {to_symbol}"
        )
        
        # Create the transaction without committing
        to_db_transaction = TransactionModel(
            portfolio_id=portfolio_id,
            asset_id=to_tx_data.asset_id,
            tx_date=to_tx_data.tx_date,
            type=to_tx_data.type,
            quantity=to_tx_data.quantity,
            price=to_tx_data.price,
            fees=to_tx_data.fees,
            currency=to_tx_data.currency,
            meta_data=to_tx_data.meta_data,
            notes=to_tx_data.notes
        )
        db.add(to_db_transaction)
        db.flush()  # Flush to get the ID without committing
        
        # Both transactions created successfully, commit the savepoint
        savepoint.commit()
        db.commit()
        db.refresh(from_db_transaction)
        db.refresh(to_db_transaction)
        
        from_transaction = from_db_transaction
        to_transaction = to_db_transaction
        
    except Exception as e:
        # If anything fails, rollback both transactions
        db.rollback()
        logger.error(f"Failed to create conversion transactions: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create conversion: {str(e)}"
        )
    
    # Update first_transaction_date for the target asset if needed
    from datetime import datetime
    
    # Refresh to_asset from DB (we already fetched it earlier for the symbol)
    to_asset = get_asset(db, conversion.to_asset_id)
    if to_asset:
        if to_asset.first_transaction_date is None or conversion.tx_date < to_asset.first_transaction_date:
            to_asset.first_transaction_date = conversion.tx_date
            db.commit()
            db.refresh(to_asset)
            logger.info(f"Updated first_transaction_date for {to_asset.symbol} to {conversion.tx_date}")
        
        # Backfill historical prices for the target asset
        start_date = datetime.combine(to_asset.first_transaction_date, datetime.min.time())
        end_date = datetime.utcnow()
        
        try:
            count = pricing_service.ensure_historical_prices(to_asset, start_date, end_date)
            logger.info(f"Auto-backfilled {count} historical prices for {to_asset.symbol}")
        except Exception as e:
            logger.warning(f"Failed to auto-backfill prices for {to_asset.symbol}: {e}")
    
    # Invalidate caches
    from app.services.analytics_cache import invalidate_portfolio_analytics
    from app.services.cache import invalidate_positions, CacheService
    invalidate_portfolio_analytics(portfolio_id)
    invalidate_positions(portfolio_id)
    
    cache_service = CacheService()
    cache_service.delete_pattern(f"assets_held:{current_user.id}:*")
    cache_service.delete_pattern(f"assets_sold:{current_user.id}:*")
    
    logger.info(f"Created conversion {conversion_id} in portfolio {portfolio_id}")
    
    # Trigger background recalculation
    try:
        from app.config import settings
        if settings.ENABLE_BACKGROUND_TASKS:
            from app.tasks.metrics_tasks import calculate_portfolio_metrics
            from app.tasks.insights_tasks import calculate_insights_all_periods
            calculate_portfolio_metrics.delay(portfolio_id, current_user.id)
            calculate_insights_all_periods.delay(portfolio_id, current_user.id)
    except Exception as e:
        logger.warning(f"Failed to queue background tasks for portfolio {portfolio_id}: {e}")
    
    # Create notifications for both transactions
    notification_service.create_transaction_notification(
        db=db,
        user_id=current_user.id,
        transaction=from_transaction,
        action="created"
    )
    notification_service.create_transaction_notification(
        db=db,
        user_id=current_user.id,
        transaction=to_transaction,
        action="created"
    )
    
    # Refresh to get asset details
    db.refresh(from_transaction)
    db.refresh(to_transaction)
    
    return ConversionResponse(
        conversion_id=conversion_id,
        conversion_rate=conversion_rate_str,
        from_transaction=from_transaction,
        to_transaction=to_transaction
    )


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
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
):
    """
    Get transactions for a portfolio with filters
    
    - **asset_id**: Filter by specific asset
    - **tx_type**: Filter by transaction type (BUY, SELL, etc.)
    - **date_from**: Start date (inclusive)
    - **date_to**: End date (inclusive)
    - **limit**: Maximum number of records to return (None for all)
    """
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


@router.get("/{portfolio_id}/transactions/metrics")
async def get_transaction_metrics(
    portfolio_id: int,
    grouping: str = "monthly",  # "monthly" or "yearly"
    db: Session = Depends(get_db),
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
):
    """
    Get aggregated transaction metrics grouped by month or year
    
    - **grouping**: "monthly" or "yearly"
    
    Returns metrics for BUY and SELL transactions:
    - Total price sum
    - Transaction count
    - Max/Min/Avg total price per transaction
    - Difference between buy and sell totals
    """
    from sqlalchemy import func, extract, case
    from app.models import Transaction as TransactionModel
    from decimal import Decimal
    
    # Define the grouping fields
    if grouping == "yearly":
        year_field = extract('year', TransactionModel.tx_date)
        group_fields = [year_field]
        period_label = 'year'
    else:  # monthly
        year_field = extract('year', TransactionModel.tx_date)
        month_field = extract('month', TransactionModel.tx_date)
        group_fields = [year_field, month_field]
        period_label = 'month'
    
    # Calculate total price for each transaction (quantity * price + fees)
    total_price = (TransactionModel.quantity * TransactionModel.price + TransactionModel.fees)
    
    # Build query for BUY transactions
    buy_query = db.query(
        *group_fields,
        func.sum(total_price).label('buy_sum_total_price'),
        func.count(TransactionModel.id).label('buy_count'),
        func.max(total_price).label('buy_max_total_price'),
        func.min(total_price).label('buy_min_total_price'),
        func.avg(total_price).label('buy_avg_total_price'),
        func.sum(TransactionModel.fees).label('buy_sum_fees')
    ).filter(
        TransactionModel.portfolio_id == portfolio_id,
        TransactionModel.type == TransactionType.BUY
    ).group_by(*group_fields)
    
    # Build query for SELL transactions
    sell_query = db.query(
        *group_fields,
        func.sum(total_price).label('sell_sum_total_price'),
        func.count(TransactionModel.id).label('sell_count'),
        func.max(total_price).label('sell_max_total_price'),
        func.min(total_price).label('sell_min_total_price'),
        func.avg(total_price).label('sell_avg_total_price'),
        func.sum(TransactionModel.fees).label('sell_sum_fees')
    ).filter(
        TransactionModel.portfolio_id == portfolio_id,
        TransactionModel.type == TransactionType.SELL
    ).group_by(*group_fields)
    
    # Execute queries
    buy_results = buy_query.all()
    sell_results = sell_query.all()
    
    # Convert to dictionaries for easier lookup
    buy_data = {}
    for row in buy_results:
        if grouping == "yearly":
            key = (int(row[0]),)  # year
        else:  # monthly
            key = (int(row[0]), int(row[1]))  # year, month
        buy_data[key] = {
            'sum': float(row[-6]) if row[-6] else 0,
            'count': int(row[-5]) if row[-5] else 0,
            'max': float(row[-4]) if row[-4] else 0,
            'min': float(row[-3]) if row[-3] else 0,
            'avg': float(row[-2]) if row[-2] else 0,
            'fees': float(row[-1]) if row[-1] else 0
        }
    
    sell_data = {}
    for row in sell_results:
        if grouping == "yearly":
            key = (int(row[0]),)  # year
        else:  # monthly
            key = (int(row[0]), int(row[1]))  # year, month
        sell_data[key] = {
            'sum': float(row[-6]) if row[-6] else 0,
            'count': int(row[-5]) if row[-5] else 0,
            'max': float(row[-4]) if row[-4] else 0,
            'min': float(row[-3]) if row[-3] else 0,
            'avg': float(row[-2]) if row[-2] else 0,
            'fees': float(row[-1]) if row[-1] else 0
        }
    
    # Combine results
    all_keys = set(buy_data.keys()) | set(sell_data.keys())
    metrics = []
    
    for key in sorted(all_keys):
        buy = buy_data.get(key, {'sum': 0, 'count': 0, 'max': 0, 'min': 0, 'avg': 0, 'fees': 0})
        sell = sell_data.get(key, {'sum': 0, 'count': 0, 'max': 0, 'min': 0, 'avg': 0, 'fees': 0})
        
        if grouping == "yearly":
            period = {
                'year': key[0]
            }
        else:  # monthly
            period = {
                'month': key[1],
                'year': key[0]
            }
        
        metrics.append({
            **period,
            'buy_sum_total_price': buy['sum'],
            'buy_count': buy['count'],
            'buy_max_total_price': buy['max'],
            'buy_min_total_price': buy['min'],
            'buy_avg_total_price': buy['avg'],
            'buy_sum_fees': buy['fees'],
            'sell_sum_total_price': sell['sum'],
            'sell_count': sell['count'],
            'sell_max_total_price': sell['max'],
            'sell_min_total_price': sell['min'],
            'sell_avg_total_price': sell['avg'],
            'sell_sum_fees': sell['fees'],
            'diff_buy_sell': buy['sum'] - sell['sum']
        })
    
    return {
        'grouping': grouping,
        'currency': portfolio.base_currency,
        'metrics': metrics
    }


@router.get("/{portfolio_id}/transactions/{transaction_id}", response_model=Transaction)
async def get_transaction(
    portfolio_id: int,
    transaction_id: int,
    db: Session = Depends(get_db),
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
):
    """Get transaction by ID"""
    transaction = crud.get_transaction(db, transaction_id)
    if not transaction or transaction.portfolio_id != portfolio_id:
        raise TransactionNotFoundError(transaction_id, portfolio_id)
    return transaction


@router.post(
    "/{portfolio_id}/transactions",
    response_model=Transaction,
    status_code=status.HTTP_201_CREATED
)
async def create_transaction(
    portfolio_id: int,
    transaction: TransactionCreate,
    pricing_service: PricingServiceDep,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
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
    
    # Validate SPLIT transactions - must have existing position transactions
    if transaction.type == TransactionType.SPLIT:
        # Check if there are any BUY/SELL transactions for this asset in this portfolio
        existing_txs = crud.get_transactions(
            db,
            portfolio_id=portfolio_id,
            asset_id=transaction.asset_id
        )
        has_position_txs = any(
            tx.type in [TransactionType.BUY, TransactionType.SELL, TransactionType.TRANSFER_IN, TransactionType.TRANSFER_OUT, TransactionType.CONVERSION_IN, TransactionType.CONVERSION_OUT]
            for tx in existing_txs
        )
        if not has_position_txs:
            from app.crud.assets import get_asset
            asset = get_asset(db, transaction.asset_id)
            symbol = asset.symbol if asset else f"Asset ID {transaction.asset_id}"
            raise CannotSplitWithoutBuyError(symbol=symbol)
    
    # Validate sell quantity if enabled
    from app.config import settings
    if settings.VALIDATE_SELL_QUANTITY:
        if transaction.type in [TransactionType.SELL, TransactionType.TRANSFER_OUT, TransactionType.CONVERSION_OUT]:
            position_before_sell = crud.get_position_quantity_at_date(
                db, portfolio_id, transaction.asset_id, transaction.tx_date
            )
            if float(transaction.quantity) > position_before_sell:
                # Get asset symbol for better error message
                from app.crud.assets import get_asset
                asset = get_asset(db, transaction.asset_id)
                symbol = asset.symbol if asset else f"Asset ID {transaction.asset_id}"
                raise CannotSellMoreThanOwnedError(
                    symbol=symbol,
                    owned=position_before_sell,
                    attempted_sell=float(transaction.quantity),
                    tx_date=transaction.tx_date
                )
    
    created = crud.create_transaction(db, portfolio_id, transaction)
    
    # Auto-backfill historical prices from transaction date to today
    if transaction.type in [TransactionType.BUY, TransactionType.TRANSFER_IN, TransactionType.CONVERSION_IN]:
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
            start_date = datetime.combine(asset.first_transaction_date, datetime.min.time())
            end_date = datetime.utcnow()
            
            try:
                count = pricing_service.ensure_historical_prices(asset, start_date, end_date)
                logger.info(f"Auto-backfilled {count} historical prices for {asset.symbol} from {asset.first_transaction_date} to today")
            except Exception as e:
                logger.warning(f"Failed to auto-backfill prices for {asset.symbol}: {e}")
    
    # Invalidate all caches since portfolio data changed
    from app.services.analytics_cache import invalidate_portfolio_analytics
    from app.services.cache import invalidate_positions, CacheService
    invalidate_portfolio_analytics(portfolio_id)
    invalidate_positions(portfolio_id)
    
    # Invalidate assets cache (held/sold)
    cache_service = CacheService()
    cache_service.delete_pattern(f"assets_held:{current_user.id}:*")
    cache_service.delete_pattern(f"assets_sold:{current_user.id}:*")
    
    logger.info(f"Invalidated caches for portfolio {portfolio_id} after transaction")
    
    # Trigger background recalculation of metrics and insights
    try:
        from app.config import settings
        if settings.ENABLE_BACKGROUND_TASKS:
            from app.tasks.metrics_tasks import calculate_portfolio_metrics
            from app.tasks.insights_tasks import calculate_insights_all_periods
            
            # Queue async tasks to recalculate metrics and insights
            calculate_portfolio_metrics.delay(portfolio_id, current_user.id)
            calculate_insights_all_periods.delay(portfolio_id, current_user.id)
            logger.info(f"Queued background recalculation for portfolio {portfolio_id}")
    except Exception as e:
        # Don't fail the request if background task queueing fails
        logger.warning(f"Failed to queue background tasks for portfolio {portfolio_id}: {e}")
    
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
    current_user: User = Depends(get_current_user),
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
):
    """Update existing transaction"""
    existing = crud.get_transaction(db, transaction_id)
    if not existing or existing.portfolio_id != portfolio_id:
        raise TransactionNotFoundError(transaction_id, portfolio_id)
    
    # Validate SPLIT transactions - must have existing position transactions (excluding the current one being updated)
    if transaction.type == TransactionType.SPLIT:
        existing_txs = crud.get_transactions(
            db,
            portfolio_id=portfolio_id,
            asset_id=transaction.asset_id
        )
        has_position_txs = any(
            tx.id != transaction_id and tx.type in [TransactionType.BUY, TransactionType.SELL, TransactionType.TRANSFER_IN, TransactionType.TRANSFER_OUT, TransactionType.CONVERSION_IN, TransactionType.CONVERSION_OUT]
            for tx in existing_txs
        )
        if not has_position_txs:
            from app.crud.assets import get_asset
            asset = get_asset(db, transaction.asset_id)
            symbol = asset.symbol if asset else f"Asset ID {transaction.asset_id}"
            raise CannotSplitWithoutBuyError(symbol=symbol)
    
    # Validate sell quantity if enabled
    from app.config import settings
    if settings.VALIDATE_SELL_QUANTITY:
        if transaction.type in [TransactionType.SELL, TransactionType.TRANSFER_OUT, TransactionType.CONVERSION_OUT]:
            # Calculate position at the transaction date, excluding the transaction being updated
            position_before_sell = crud.get_position_quantity_at_date(
                db, portfolio_id, transaction.asset_id, transaction.tx_date,
                exclude_transaction_id=transaction_id
            )
            
            if float(transaction.quantity) > position_before_sell:
                from app.crud.assets import get_asset
                asset = get_asset(db, transaction.asset_id)
                symbol = asset.symbol if asset else f"Asset ID {transaction.asset_id}"
                raise CannotSellMoreThanOwnedError(
                    symbol=symbol,
                    owned=position_before_sell,
                    attempted_sell=float(transaction.quantity),
                    tx_date=transaction.tx_date
                )
    
    updated = crud.update_transaction(db, transaction_id, transaction)
    
    # Invalidate all caches since portfolio data changed
    from app.services.analytics_cache import invalidate_portfolio_analytics
    from app.services.cache import CacheService
    cache_service = CacheService()
    
    invalidate_portfolio_analytics(portfolio_id)
    cache_service.invalidate_portfolio(portfolio_id)  # Invalidates positions, metrics, insights, and batch cache
    
    # Invalidate assets cache (held/sold)
    cache_service.delete_pattern(f"assets_held:{current_user.id}:*")
    cache_service.delete_pattern(f"assets_sold:{current_user.id}:*")
    
    logger.info(f"Invalidated caches for portfolio {portfolio_id} after transaction update")
    
    # Trigger background recalculation
    try:
        from app.config import settings
        if settings.ENABLE_BACKGROUND_TASKS:
            from app.tasks.metrics_tasks import calculate_portfolio_metrics
            from app.tasks.insights_tasks import calculate_insights_all_periods
            calculate_portfolio_metrics.delay(portfolio_id, current_user.id)
            calculate_insights_all_periods.delay(portfolio_id, current_user.id)
            logger.info(f"Queued background recalculation for portfolio {portfolio_id}")
    except Exception as e:
        logger.warning(f"Failed to queue background tasks for portfolio {portfolio_id}: {e}")
    
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
    current_user: User = Depends(get_current_user),
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
):
    """Delete transaction. If it's a conversion, also deletes the linked transaction."""
    existing = crud.get_transaction(db, transaction_id)
    if not existing or existing.portfolio_id != portfolio_id:
        raise TransactionNotFoundError(transaction_id, portfolio_id)
    
    # Check if this is a conversion transaction and find the linked one
    linked_transaction = None
    if existing.type in [TransactionType.CONVERSION_IN, TransactionType.CONVERSION_OUT]:
        meta_data = existing.meta_data or {}
        conversion_id = meta_data.get("conversion_id")
        if conversion_id:
            # Find the linked transaction with the same conversion_id
            all_transactions = crud.get_transactions(db, portfolio_id)
            for tx in all_transactions:
                if tx.id != existing.id and tx.meta_data:
                    tx_meta_data = tx.meta_data if isinstance(tx.meta_data, dict) else {}
                    if tx_meta_data.get("conversion_id") == conversion_id:
                        linked_transaction = tx
                        break
    
    # Create notification for transaction deletion (before deleting)
    notification_service.create_transaction_notification(
        db=db,
        user_id=current_user.id,
        transaction=existing,
        action="deleted"
    )
    
    # Delete the main transaction
    crud.delete_transaction(db, transaction_id)
    
    # Delete the linked conversion transaction if it exists
    if linked_transaction:
        logger.info(f"Deleting linked conversion transaction {linked_transaction.id}")
        notification_service.create_transaction_notification(
            db=db,
            user_id=current_user.id,
            transaction=linked_transaction,
            action="deleted"
        )
        crud.delete_transaction(db, linked_transaction.id)
    
    # Invalidate all caches since portfolio data changed
    from app.services.analytics_cache import invalidate_portfolio_analytics
    from app.services.cache import CacheService
    cache_service = CacheService()
    
    invalidate_portfolio_analytics(portfolio_id)
    cache_service.invalidate_portfolio(portfolio_id)  # Invalidates positions, metrics, insights, and batch cache
    
    # Invalidate assets cache (held/sold)
    cache_service.delete_pattern(f"assets_held:{current_user.id}:*")
    cache_service.delete_pattern(f"assets_sold:{current_user.id}:*")
    
    logger.info(f"Invalidated caches for portfolio {portfolio_id} after transaction deletion")
    
    # Trigger background recalculation
    try:
        from app.config import settings
        if settings.ENABLE_BACKGROUND_TASKS:
            from app.tasks.metrics_tasks import calculate_portfolio_metrics
            from app.tasks.insights_tasks import calculate_insights_all_periods
            calculate_portfolio_metrics.delay(portfolio_id, current_user.id)
            calculate_insights_all_periods.delay(portfolio_id, current_user.id)
            logger.info(f"Queued background recalculation for portfolio {portfolio_id}")
    except Exception as e:
        logger.warning(f"Failed to queue background tasks for portfolio {portfolio_id}: {e}")


@router.post("/import/csv/stream")
async def import_csv_stream(
    portfolio_id: int,
    file: UploadFile = File(...),
    csv_service = Depends(get_csv_import_service),
    current_user: User = Depends(get_current_user),
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
):
    """
    Import transactions from CSV file with streaming progress updates
    
    Returns a stream of JSON objects with progress updates:
    - type: 'progress' | 'log' | 'complete' | 'error'
    - message: str (description of current operation)
    - current: int (current row number)
    - total: int (total number of rows)
    - result: CsvImportResult (on completion)
    """
    # Read file content
    content = await file.read()
    csv_content = content.decode("utf-8")
    
    # Store user_id for use in generator
    user_id = current_user.id
    
    # Generator function to yield progress updates as JSON
    def generate_progress():
        for update in csv_service.import_csv_with_progress(portfolio_id, csv_content):
            yield json.dumps(update) + "\n"
            
            # On completion, invalidate caches
            if update.get("type") == "complete":
                from app.services.analytics_cache import invalidate_portfolio_analytics
                from app.services.cache import invalidate_positions, CacheService
                invalidate_portfolio_analytics(portfolio_id)
                invalidate_positions(portfolio_id)
                
                # Invalidate assets cache (held/sold)
                cache_service = CacheService()
                cache_service.delete_pattern(f"assets_held:{user_id}:*")
                cache_service.delete_pattern(f"assets_sold:{user_id}:*")
                
                logger.info(f"Invalidated caches for portfolio {portfolio_id}")
                
                # Trigger background recalculation
                try:
                    from app.config import settings
                    if settings.ENABLE_BACKGROUND_TASKS:
                        from app.tasks.metrics_tasks import calculate_portfolio_metrics
                        from app.tasks.insights_tasks import calculate_insights_all_periods
                        calculate_portfolio_metrics.delay(portfolio_id)
                        calculate_insights_all_periods.delay(portfolio_id, user_id)
                except Exception as e:
                    logger.warning(f"Failed to queue background tasks: {e}")
    
    return StreamingResponse(
        generate_progress(),
        media_type="application/x-ndjson",  # Newline-delimited JSON
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )


@router.post("/import/csv", response_model=CsvImportResult)
async def import_csv(
    portfolio_id: int,
    file: UploadFile = File(...),
    csv_service = Depends(get_csv_import_service),
    current_user: User = Depends(get_current_user),
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
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
    # Read file content
    content = await file.read()
    csv_content = content.decode("utf-8")
    
    # Import
    result = csv_service.import_csv(portfolio_id, csv_content)
    
    if not result.success:
        raise ImportTransactionsError(result.errors, result.imported_count)
    
    # Invalidate all caches since portfolio data changed
    from app.services.analytics_cache import invalidate_portfolio_analytics
    from app.services.cache import invalidate_positions, CacheService
    invalidate_portfolio_analytics(portfolio_id)
    invalidate_positions(portfolio_id)
    
    # Invalidate assets cache (held/sold)
    cache_service = CacheService()
    cache_service.delete_pattern(f"assets_held:{current_user.id}:*")
    cache_service.delete_pattern(f"assets_sold:{current_user.id}:*")
    
    logger.info(f"Invalidated caches for portfolio {portfolio_id} after CSV import")
    
    # Trigger background recalculation of metrics and insights
    try:
        from app.config import settings
        if settings.ENABLE_BACKGROUND_TASKS:
            from app.tasks.metrics_tasks import calculate_portfolio_metrics
            from app.tasks.insights_tasks import calculate_insights_all_periods
            calculate_portfolio_metrics.delay(portfolio_id)
            calculate_insights_all_periods.delay(portfolio_id, current_user.id)
            logger.info(f"Queued background recalculation for portfolio {portfolio_id} after CSV import")
    except Exception as e:
        logger.warning(f"Failed to queue background tasks for portfolio {portfolio_id}: {e}")
    
    return result
