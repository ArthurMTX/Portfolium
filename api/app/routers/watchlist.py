"""
Watchlist router - Track assets without owning them
"""
import logging
from typing import List, Dict, Any, Generator
from decimal import Decimal
from datetime import datetime, timedelta
import json
import csv
from io import StringIO
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import (
    WatchlistItem, WatchlistItemCreate, WatchlistItemCreateBySymbol, WatchlistItemUpdate,
    WatchlistItemWithPrice, WatchlistImportItem, WatchlistImportResult,
    WatchlistConvertToBuy
)
from app.crud import watchlist as crud
from app.crud import assets as assets_crud

logger = logging.getLogger(__name__)
from app.auth import get_current_user
from app.models import User, Asset
from app.services.pricing import PricingService

router = APIRouter()


@router.get("", response_model=List[WatchlistItemWithPrice])
async def get_watchlist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all watchlist items for the current user with current prices"""
    items = crud.get_watchlist_items_by_user(db, current_user.id)
    
    if not items:
        return []
    
    # Get pricing service
    pricing_service = PricingService(db)
    
    # Get all symbols to fetch prices in batch
    symbols = [item.asset.symbol for item in items]
    
    # Fetch all prices concurrently
    try:
        prices_map = await pricing_service.get_multiple_prices(symbols)
    except Exception as e:
        logger.warning(f"Failed to fetch prices: {e}")
        prices_map = {}
    
    # Build response with current prices
    result = []
    for item in items:
        asset = item.asset
        
        # Get current price and daily change from batch results
        current_price = None
        daily_change_pct = None
        last_updated = None
        
        quote = prices_map.get(asset.symbol)
        if quote:
            current_price = quote.price
            daily_change_pct = quote.daily_change_pct
            last_updated = quote.asof
        
        result.append(WatchlistItemWithPrice(
            id=item.id,
            user_id=item.user_id,
            asset_id=item.asset_id,
            symbol=asset.symbol,
            name=asset.name,
            notes=item.notes,
            alert_target_price=item.alert_target_price,
            alert_enabled=item.alert_enabled,
            current_price=current_price,
            daily_change_pct=daily_change_pct,
            currency=asset.currency,
            asset_type=asset.asset_type,
            last_updated=last_updated,
            created_at=item.created_at
        ))
    
    return result


@router.post("", response_model=WatchlistItem, status_code=status.HTTP_201_CREATED)
async def create_watchlist_item(
    item: WatchlistItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add an asset to watchlist"""
    # Check if asset exists
    asset = db.query(Asset).filter(Asset.id == item.asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset with ID {item.asset_id} not found"
        )
    
    # Check if already in watchlist
    existing = crud.get_watchlist_item_by_user_and_asset(
        db, current_user.id, item.asset_id
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Asset {asset.symbol} is already in your watchlist"
        )
    
    return crud.create_watchlist_item(db, item, current_user.id)


@router.post("/by-symbol", response_model=WatchlistItem, status_code=status.HTTP_201_CREATED)
async def create_watchlist_item_by_symbol(
    symbol: str,
    item_data: WatchlistItemCreateBySymbol,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add an asset to watchlist by symbol (creates asset if it doesn't exist)"""
    # Find or create asset
    asset = assets_crud.get_asset_by_symbol(db, symbol)
    
    if not asset:
        # Create the asset
        from app.schemas import AssetCreate
        asset_data = AssetCreate(symbol=symbol.upper())
        asset = assets_crud.create_asset(db, asset_data)
        
        # Try to enrich it with real data
        try:
            from app.services.pricing import PricingService
            pricing_service = PricingService(db)
            pricing_service.enrich_asset_info(asset)
        except Exception:
            pass  # Continue without enrichment
    
    # Check if already in watchlist
    existing = crud.get_watchlist_item_by_user_and_asset(
        db, current_user.id, asset.id
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Asset {asset.symbol} is already in your watchlist"
        )
    
    # Create watchlist item with data from request body
    item = WatchlistItemCreate(
        asset_id=asset.id,
        notes=item_data.notes,
        alert_target_price=item_data.alert_target_price,
        alert_enabled=item_data.alert_enabled
    )
    
    return crud.create_watchlist_item(db, item, current_user.id)


@router.get("/{item_id}", response_model=WatchlistItem)
async def get_watchlist_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific watchlist item"""
    item = crud.get_watchlist_item(db, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Watchlist item {item_id} not found"
        )
    
    # Verify ownership
    if item.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this watchlist item"
        )
    
    return item


@router.put("/{item_id}", response_model=WatchlistItem)
async def update_watchlist_item(
    item_id: int,
    item: WatchlistItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a watchlist item"""
    # Verify ownership
    existing = crud.get_watchlist_item(db, item_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Watchlist item {item_id} not found"
        )
    if existing.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this watchlist item"
        )
    
    updated = crud.update_watchlist_item(db, item_id, item)
    return updated


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_watchlist_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove an asset from watchlist"""
    # Verify ownership
    existing = crud.get_watchlist_item(db, item_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Watchlist item {item_id} not found"
        )
    if existing.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this watchlist item"
        )
    
    success = crud.delete_watchlist_item(db, item_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Watchlist item {item_id} not found"
        )


@router.post("/{item_id}/convert-to-buy")
async def convert_to_buy(
    item_id: int,
    payload: WatchlistConvertToBuy,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Convert a watchlist item to a BUY transaction in a portfolio"""
    from app.models import Portfolio, Transaction, TransactionType
    from datetime import date
    
    # Verify watchlist item ownership
    item = crud.get_watchlist_item(db, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Watchlist item {item_id} not found"
        )
    if item.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this watchlist item"
        )
    
    # Verify portfolio ownership
    portfolio = db.query(Portfolio).filter(Portfolio.id == payload.portfolio_id).first()
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {payload.portfolio_id} not found"
        )
    if portfolio.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this portfolio"
        )
    
    # Parse transaction date
    if payload.tx_date:
        transaction_date = date.fromisoformat(payload.tx_date)
    else:
        transaction_date = date.today()
    
    # Create BUY transaction
    transaction = Transaction(
        portfolio_id=payload.portfolio_id,
        asset_id=item.asset_id,
        tx_date=transaction_date,
        type=TransactionType.BUY,
        quantity=payload.quantity,
        price=payload.price,
        fees=payload.fees,
        currency=item.asset.currency,
        notes=f"Converted from watchlist: {item.notes}" if item.notes else "Converted from watchlist"
    )
    
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    
    return {
        "success": True,
        "transaction_id": transaction.id,
        "message": f"Created BUY transaction for {item.asset.symbol}"
    }


@router.post("/import/csv/stream")
async def import_watchlist_csv_stream(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import watchlist from CSV file with streaming progress updates
    
    Returns a stream of JSON objects with progress updates
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV"
        )
    
    # Read file content
    content = await file.read()
    csv_content = content.decode('utf-8')
    
    def generate_progress() -> Generator[str, None, None]:
        """Generate progress updates as JSON lines"""
        imported_count = 0
        errors = []
        warnings = []
        
        try:
            # Parse CSV and count rows
            csv_reader = csv.DictReader(StringIO(csv_content))
            rows = list(csv_reader)
            total_rows = len(rows)
            
            yield json.dumps({
                "type": "log",
                "message": f"Starting import of {total_rows} rows",
                "current": 0,
                "total": total_rows
            }) + "\n"
            
            for row_num, row in enumerate(rows, start=2):  # Start at 2 (header is row 1)
                try:
                    yield json.dumps({
                        "type": "log",
                        "message": f"Processing row {row_num - 1}/{total_rows}...",
                        "current": row_num - 2,
                        "total": total_rows,
                        "row_num": row_num
                    }) + "\n"
                    
                    symbol = row.get('symbol', '').strip().upper()
                    if not symbol:
                        warning_msg = f"Row {row_num}: Missing symbol, skipped"
                        warnings.append(warning_msg)
                        yield json.dumps({
                            "type": "log",
                            "message": warning_msg,
                            "current": row_num - 1,
                            "total": total_rows,
                            "row_num": row_num
                        }) + "\n"
                        continue
                    
                    yield json.dumps({
                        "type": "log",
                        "message": f"Row {row_num - 1}: Adding {symbol} to watchlist",
                        "current": row_num - 2,
                        "total": total_rows,
                        "row_num": row_num
                    }) + "\n"
                    
                    notes = row.get('notes', '').strip() or None
                    alert_target_price = None
                    alert_enabled = row.get('alert_enabled', '').lower() in ('true', '1', 'yes')
                    
                    # Parse alert_target_price
                    price_str = row.get('alert_target_price', '').strip()
                    if price_str:
                        try:
                            alert_target_price = Decimal(price_str)
                        except Exception:
                            warning_msg = f"Row {row_num}: Invalid alert price '{price_str}', skipped alert"
                            warnings.append(warning_msg)
                            yield json.dumps({
                                "type": "log",
                                "message": warning_msg,
                                "current": row_num - 1,
                                "total": total_rows,
                                "row_num": row_num
                            }) + "\n"
                    
                    # Find or create asset
                    asset = assets_crud.get_asset_by_symbol(db, symbol)
                    if not asset:
                        yield json.dumps({
                            "type": "log",
                            "message": f"Creating new asset: {symbol}",
                            "current": row_num - 2,
                            "total": total_rows,
                            "row_num": row_num
                        }) + "\n"
                        
                        from app.schemas import AssetCreate
                        asset = assets_crud.create_asset(db, AssetCreate(symbol=symbol))
                        
                        warning_msg = f"Row {row_num}: Auto-created asset {symbol}"
                        warnings.append(warning_msg)
                        yield json.dumps({
                            "type": "log",
                            "message": warning_msg,
                            "current": row_num - 1,
                            "total": total_rows,
                            "row_num": row_num
                        }) + "\n"
                    
                    # Check if already in watchlist
                    existing = crud.get_watchlist_item_by_user_and_asset(
                        db, current_user.id, asset.id
                    )
                    if existing:
                        warning_msg = f"Row {row_num}: {symbol} already in watchlist, skipped"
                        warnings.append(warning_msg)
                        yield json.dumps({
                            "type": "log",
                            "message": warning_msg,
                            "current": row_num - 1,
                            "total": total_rows,
                            "row_num": row_num
                        }) + "\n"
                        continue
                    
                    # Create watchlist item
                    item = WatchlistItemCreate(
                        asset_id=asset.id,
                        notes=notes,
                        alert_target_price=alert_target_price,
                        alert_enabled=alert_enabled
                    )
                    crud.create_watchlist_item(db, item, current_user.id)
                    imported_count += 1
                    
                    yield json.dumps({
                        "type": "progress",
                        "message": f"Added {symbol} to watchlist ({imported_count}/{total_rows})",
                        "current": row_num - 1,
                        "total": total_rows,
                        "row_num": row_num
                    }) + "\n"
                    
                except Exception as e:
                    error_msg = f"Row {row_num}: {str(e)}"
                    errors.append(error_msg)
                    logger.error(error_msg)
                    
                    yield json.dumps({
                        "type": "error",
                        "message": error_msg,
                        "current": row_num - 1,
                        "total": total_rows,
                        "row_num": row_num
                    }) + "\n"
            
            success = len(errors) == 0
            result = {
                "success": success,
                "imported_count": imported_count,
                "errors": errors,
                "warnings": warnings
            }
            
            yield json.dumps({
                "type": "complete",
                "message": f"Import complete: {imported_count} items added to watchlist",
                "current": total_rows,
                "total": total_rows,
                "result": result
            }) + "\n"
            
        except Exception as e:
            logger.error(f"Watchlist CSV import failed: {e}")
            result = {
                "success": False,
                "imported_count": 0,
                "errors": [f"CSV parsing failed: {str(e)}"],
                "warnings": []
            }
            
            yield json.dumps({
                "type": "error",
                "message": f"CSV parsing failed: {str(e)}",
                "current": 0,
                "total": 0,
                "result": result
            }) + "\n"
    
    return StreamingResponse(
        generate_progress(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/import/csv", response_model=WatchlistImportResult)
async def import_watchlist_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import watchlist from CSV file
    
    Expected CSV format:
    symbol,notes,alert_target_price,alert_enabled
    AAPL,Watch for earnings,150.00,true
    MSFT,Long term hold,300.00,false
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV"
        )
    
    try:
        content = await file.read()
        csv_content = content.decode('utf-8')
        csv_reader = csv.DictReader(StringIO(csv_content))
        
        imported_count = 0
        errors = []
        warnings = []
        
        for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 (header is row 1)
            try:
                symbol = row.get('symbol', '').strip().upper()
                if not symbol:
                    warnings.append(f"Row {row_num}: Missing symbol, skipped")
                    continue
                
                notes = row.get('notes', '').strip() or None
                alert_target_price = None
                alert_enabled = row.get('alert_enabled', '').lower() in ('true', '1', 'yes')
                
                # Parse alert_target_price
                price_str = row.get('alert_target_price', '').strip()
                if price_str:
                    try:
                        alert_target_price = Decimal(price_str)
                    except Exception:
                        warnings.append(f"Row {row_num}: Invalid alert price '{price_str}', skipped alert")
                
                # Find or create asset
                asset = assets_crud.get_asset_by_symbol(db, symbol)
                if not asset:
                    from app.schemas import AssetCreate
                    asset = assets_crud.create_asset(db, AssetCreate(symbol=symbol))
                
                # Check if already in watchlist
                existing = crud.get_watchlist_item_by_user_and_asset(
                    db, current_user.id, asset.id
                )
                if existing:
                    warnings.append(f"Row {row_num}: {symbol} already in watchlist, skipped")
                    continue
                
                # Create watchlist item
                item = WatchlistItemCreate(
                    asset_id=asset.id,
                    notes=notes,
                    alert_target_price=alert_target_price,
                    alert_enabled=alert_enabled
                )
                crud.create_watchlist_item(db, item, current_user.id)
                imported_count += 1
                
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
        
        return WatchlistImportResult(
            success=len(errors) == 0,
            imported_count=imported_count,
            errors=errors,
            warnings=warnings
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV: {str(e)}"
        )


@router.get("/export/csv")
async def export_watchlist_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export watchlist as CSV file"""
    items = crud.get_watchlist_items_by_user(db, current_user.id)
    
    # Create CSV
    output = StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(['symbol', 'name', 'notes', 'alert_target_price', 'alert_enabled', 'created_at'])
    
    # Data
    for item in items:
        writer.writerow([
            item.asset.symbol,
            item.asset.name or '',
            item.notes or '',
            str(item.alert_target_price) if item.alert_target_price else '',
            'true' if item.alert_enabled else 'false',
            item.created_at.isoformat()
        ])
    
    # Return as downloadable file
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=watchlist_{datetime.now().strftime('%Y%m%d')}.csv"
        }
    )


@router.post("/refresh-prices")
async def refresh_watchlist_prices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Force refresh prices for all watchlist items
    Returns the number of prices refreshed
    """
    items = crud.get_watchlist_items_by_user(db, current_user.id)
    
    if not items:
        return {"refreshed_count": 0}
    
    # Get pricing service
    pricing_service = PricingService(db)
    
    # Force refresh prices for all watchlist assets
    count = 0
    for item in items:
        try:
            # Force refresh to get fresh data from Yahoo Finance
            price = pricing_service.get_price(item.asset.symbol, force_refresh=True)
            if price:
                count += 1
        except Exception:
            pass  # Continue with other assets
    
    return {"refreshed_count": count}
