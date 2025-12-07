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
from fastapi import APIRouter, Depends, status, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.errors import (
    AssetNotFoundInDatabaseError,
    FailedToParseWatchlistImportError, 
    NotAuthorizedWatchlistAccessError,
    PortfolioNotFoundError,
    UnauthorizedPortfolioAccessError, 
    WatchlistItemAlreadyExistsError, 
    WatchlistItemNotFoundError,
    WatchlistTagAlreadyExistsError,
    WatchlistTagNotFoundError,
    NotAuthorizedWatchlistTagAccessError,
    WrongImportFormatError
)
from app.db import get_db
from app.schemas import (
    WatchlistItem, WatchlistItemCreate, WatchlistItemCreateBySymbol, WatchlistItemUpdate,
    WatchlistItemWithPrice, WatchlistImportItem, WatchlistImportResult,
    WatchlistConvertToBuy, WatchlistTagCreate, WatchlistTagUpdate, WatchlistTagResponse,
    WatchlistItemTagsUpdate
)
from app.crud import watchlist as crud
from app.crud import assets as assets_crud

logger = logging.getLogger(__name__)
from app.auth import get_current_user
from app.models import User, Asset
from app.dependencies import PricingServiceDep, MetricsServiceDep

router = APIRouter()


@router.get("", response_model=List[WatchlistItemWithPrice])
async def get_watchlist(
    pricing_service: PricingServiceDep,
    tag_ids: str = None,  # Comma-separated list of tag IDs
    tag_mode: str = "any",  # "any" (OR) or "all" (AND)
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all watchlist items for the current user with current prices.
    
    Optionally filter by tags by passing comma-separated tag IDs.
    Use tag_mode="any" to match items with ANY of the specified tags (OR).
    Use tag_mode="all" to match items with ALL of the specified tags (AND).
    """
    # Parse tag_ids if provided
    parsed_tag_ids = None
    if tag_ids:
        try:
            parsed_tag_ids = [int(tid.strip()) for tid in tag_ids.split(',') if tid.strip()]
        except ValueError:
            parsed_tag_ids = None
    
    # Validate tag_mode
    if tag_mode not in ("any", "all"):
        tag_mode = "any"
    
    items = crud.get_watchlist_items_by_user(db, current_user.id, tag_ids=parsed_tag_ids, tag_mode=tag_mode)
    
    if not items:
        return []
    
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
        
        # Convert tags to response format
        tags_response = [
            WatchlistTagResponse(
                id=tag.id,
                user_id=tag.user_id,
                name=tag.name,
                icon=tag.icon,
                color=tag.color,
                created_at=tag.created_at,
                updated_at=tag.updated_at
            ) for tag in item.tags
        ]
        
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
            created_at=item.created_at,
            tags=tags_response
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
        raise AssetNotFoundInDatabaseError(item.asset_id)
    
    # Check if already in watchlist
    existing = crud.get_watchlist_item_by_user_and_asset(
        db, current_user.id, item.asset_id
    )
    if existing:
        raise WatchlistItemAlreadyExistsError(asset.symbol)
    
    return crud.create_watchlist_item(db, item, current_user.id)


@router.post("/by-symbol", response_model=WatchlistItem, status_code=status.HTTP_201_CREATED)
async def create_watchlist_item_by_symbol(
    symbol: str,
    item_data: WatchlistItemCreateBySymbol,
    pricing_service: PricingServiceDep,
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
            pricing_service.enrich_asset_info(asset)
        except Exception:
            pass  # Continue without enrichment
    
    # Check if already in watchlist
    existing = crud.get_watchlist_item_by_user_and_asset(
        db, current_user.id, asset.id
    )
    if existing:
        raise WatchlistItemAlreadyExistsError(asset.symbol)
    
    # Create watchlist item with data from request body
    item = WatchlistItemCreate(
        asset_id=asset.id,
        notes=item_data.notes,
        alert_target_price=item_data.alert_target_price,
        alert_enabled=item_data.alert_enabled
    )
    
    created_item = crud.create_watchlist_item(db, item, current_user.id)
    
    # Assign tags if provided
    if item_data.tag_ids:
        crud.update_watchlist_item_tags(db, created_item.id, item_data.tag_ids, current_user.id)
        # Reload to get tags
        created_item = crud.get_watchlist_item(db, created_item.id)
    
    return created_item


# ============================================================================
# Watchlist Tag Endpoints (must be defined before /{item_id} routes)
# ============================================================================

@router.get("/tags", response_model=List[WatchlistTagResponse])
async def get_watchlist_tags(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all watchlist tags for the current user"""
    return crud.get_tags_by_user(db, current_user.id)


@router.post("/tags", response_model=WatchlistTagResponse, status_code=status.HTTP_201_CREATED)
async def create_watchlist_tag(
    tag: WatchlistTagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new watchlist tag"""
    # Check if tag with this name already exists
    existing = crud.get_tag_by_name(db, current_user.id, tag.name)
    if existing:
        raise WatchlistTagAlreadyExistsError(tag.name)
    
    return crud.create_tag(db, tag, current_user.id)


@router.put("/tags/{tag_id}", response_model=WatchlistTagResponse)
async def update_watchlist_tag(
    tag_id: int,
    tag: WatchlistTagUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a watchlist tag"""
    # Verify ownership
    existing = crud.get_tag(db, tag_id)
    if not existing:
        raise WatchlistTagNotFoundError(tag_id)
    if existing.user_id != current_user.id:
        raise NotAuthorizedWatchlistTagAccessError(tag_id)
    
    # Check if updating name to one that already exists
    if tag.name and tag.name != existing.name:
        name_exists = crud.get_tag_by_name(db, current_user.id, tag.name)
        if name_exists:
            raise WatchlistTagAlreadyExistsError(tag.name)
    
    updated = crud.update_tag(db, tag_id, tag)
    if not updated:
        raise WatchlistTagNotFoundError(tag_id)
    
    return updated


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_watchlist_tag(
    tag_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a watchlist tag"""
    # Verify ownership
    existing = crud.get_tag(db, tag_id)
    if not existing:
        raise WatchlistTagNotFoundError(tag_id)
    if existing.user_id != current_user.id:
        raise NotAuthorizedWatchlistTagAccessError(tag_id)
    
    success = crud.delete_tag(db, tag_id)
    if not success:
        raise WatchlistTagNotFoundError(tag_id)


# ============================================================================
# Watchlist Item Routes (with /{item_id} path parameter)
# ============================================================================

@router.get("/{item_id}", response_model=WatchlistItem)
async def get_watchlist_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific watchlist item"""
    item = crud.get_watchlist_item(db, item_id)
    if not item:
        raise WatchlistItemNotFoundError(item_id)
    
    # Verify ownership
    if item.user_id != current_user.id:
        raise NotAuthorizedWatchlistAccessError(item_id)
    
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
        raise WatchlistItemNotFoundError(item_id)
    if existing.user_id != current_user.id:
        raise NotAuthorizedWatchlistAccessError(item_id)
    
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
        raise WatchlistItemNotFoundError(item_id)
    if existing.user_id != current_user.id:
        raise NotAuthorizedWatchlistAccessError(item_id)
    
    success = crud.delete_watchlist_item(db, item_id)
    if not success:
        raise WatchlistItemNotFoundError(item_id)


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
        raise WatchlistItemNotFoundError(item_id)
    if item.user_id != current_user.id:
        raise NotAuthorizedWatchlistAccessError(item_id)
    
    # Verify portfolio ownership
    portfolio = db.query(Portfolio).filter(Portfolio.id == payload.portfolio_id).first()
    if not portfolio:
        raise PortfolioNotFoundError(payload.portfolio_id)
    if portfolio.user_id != current_user.id:
        raise UnauthorizedPortfolioAccessError(payload.portfolio_id)
    
    # Parse transaction date
    if payload.tx_date:
        transaction_date = date.fromisoformat(payload.tx_date)
    else:
        transaction_date = date.today()
    
    # Use provided currency or fall back to portfolio's base currency
    # This matches the logic used in Transactions page
    transaction_currency = payload.currency if payload.currency else portfolio.base_currency
    
    # Create BUY transaction
    transaction = Transaction(
        portfolio_id=payload.portfolio_id,
        asset_id=item.asset_id,
        tx_date=transaction_date,
        type=TransactionType.BUY,
        quantity=payload.quantity,
        price=payload.price,
        fees=payload.fees,
        currency=transaction_currency,
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
        raise WrongImportFormatError()
    
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
                    created_item = crud.create_watchlist_item(db, item, current_user.id)
                    imported_count += 1
                    
                    # Process tags if present
                    tags_str = row.get('tags', '').strip()
                    if tags_str:
                        tag_ids = []
                        for tag_part in tags_str.split('|'):
                            if not tag_part.strip():
                                continue
                            parts = tag_part.split(':')
                            tag_name = parts[0].strip() if len(parts) > 0 else ''
                            tag_icon = parts[1].strip() if len(parts) > 1 else 'tag'
                            tag_color = parts[2].strip() if len(parts) > 2 else '#6366f1'
                            
                            if not tag_name:
                                continue
                            
                            # Validate/normalize color - ensure it's a valid hex color
                            import re
                            if not re.match(r'^#[0-9A-Fa-f]{6}$', tag_color):
                                tag_color = '#6366f1'  # Use default if invalid
                            
                            try:
                                # Check if tag exists
                                existing_tag = crud.get_tag_by_name(db, current_user.id, tag_name)
                                if existing_tag:
                                    tag_ids.append(existing_tag.id)
                                else:
                                    # Create new tag
                                    new_tag = crud.create_tag(
                                        db, 
                                        WatchlistTagCreate(name=tag_name, icon=tag_icon, color=tag_color),
                                        current_user.id
                                    )
                                    tag_ids.append(new_tag.id)
                                    warning_msg = f"Row {row_num}: Created new tag '{tag_name}'"
                                    warnings.append(warning_msg)
                                    yield json.dumps({
                                        "type": "log",
                                        "message": warning_msg,
                                        "current": row_num - 1,
                                        "total": total_rows,
                                        "row_num": row_num
                                    }) + "\n"
                            except Exception as tag_error:
                                warning_msg = f"Row {row_num}: Failed to create tag '{tag_name}': {str(tag_error)}"
                                warnings.append(warning_msg)
                                yield json.dumps({
                                    "type": "log",
                                    "message": warning_msg,
                                    "current": row_num - 1,
                                    "total": total_rows,
                                    "row_num": row_num
                                }) + "\n"
                        
                        # Assign tags to the watchlist item
                        if tag_ids:
                            crud.update_watchlist_item_tags(db, created_item.id, tag_ids, current_user.id)
                    
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
    symbol,notes,alert_target_price,alert_enabled,tags
    AAPL,Watch for earnings,150.00,true,Tech:laptop:#3b82f6|Growth:trending-up:#22c55e
    MSFT,Long term hold,300.00,false,
    """
    if not file.filename.endswith('.csv'):
        raise WrongImportFormatError()
    
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
                created_item = crud.create_watchlist_item(db, item, current_user.id)
                imported_count += 1
                
                # Process tags if present
                tags_str = row.get('tags', '').strip()
                if tags_str:
                    tag_ids = []
                    for tag_part in tags_str.split('|'):
                        if not tag_part.strip():
                            continue
                        parts = tag_part.split(':')
                        tag_name = parts[0].strip() if len(parts) > 0 else ''
                        tag_icon = parts[1].strip() if len(parts) > 1 else 'tag'
                        tag_color = parts[2].strip() if len(parts) > 2 else '#6366f1'
                        
                        if not tag_name:
                            continue
                        
                        # Validate/normalize color - ensure it's a valid hex color
                        import re
                        if not re.match(r'^#[0-9A-Fa-f]{6}$', tag_color):
                            tag_color = '#6366f1'  # Use default if invalid
                        
                        try:
                            # Check if tag exists
                            existing_tag = crud.get_tag_by_name(db, current_user.id, tag_name)
                            if existing_tag:
                                tag_ids.append(existing_tag.id)
                            else:
                                # Create new tag
                                new_tag = crud.create_tag(
                                    db, 
                                    WatchlistTagCreate(name=tag_name, icon=tag_icon, color=tag_color),
                                    current_user.id
                                )
                                tag_ids.append(new_tag.id)
                                warnings.append(f"Row {row_num}: Created new tag '{tag_name}'")
                        except Exception as tag_error:
                            warnings.append(f"Row {row_num}: Failed to create tag '{tag_name}': {str(tag_error)}")
                    
                    # Assign tags to the watchlist item
                    if tag_ids:
                        crud.update_watchlist_item_tags(db, created_item.id, tag_ids, current_user.id)
                
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
        
        return WatchlistImportResult(
            success=len(errors) == 0,
            imported_count=imported_count,
            errors=errors,
            warnings=warnings
        )
        
    except Exception as e:
        raise FailedToParseWatchlistImportError(str(e))


@router.get("/export/csv")
async def export_watchlist_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export watchlist as CSV file with tags"""
    items = crud.get_watchlist_items_by_user(db, current_user.id)
    
    # Create CSV
    output = StringIO()
    writer = csv.writer(output)
    
    # Header - include tags column
    writer.writerow(['symbol', 'name', 'notes', 'alert_target_price', 'alert_enabled', 'tags', 'created_at'])
    
    # Data
    for item in items:
        # Build tags string: "name:icon:color|name:icon:color|..."
        tags_str = ''
        if item.tags:
            tag_parts = []
            for tag in item.tags:
                tag_parts.append(f"{tag.name}:{tag.icon}:{tag.color}")
            tags_str = '|'.join(tag_parts)
        
        writer.writerow([
            item.asset.symbol,
            item.asset.name or '',
            item.notes or '',
            str(item.alert_target_price) if item.alert_target_price else '',
            'true' if item.alert_enabled else 'false',
            tags_str,
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
    pricing_service: PricingServiceDep,
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


@router.put("/{item_id}/tags", response_model=WatchlistItem)
async def update_watchlist_item_tags(
    item_id: int,
    tags_update: WatchlistItemTagsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update tags for a watchlist item"""
    # Verify ownership
    existing = crud.get_watchlist_item(db, item_id)
    if not existing:
        raise WatchlistItemNotFoundError(item_id)
    if existing.user_id != current_user.id:
        raise NotAuthorizedWatchlistAccessError(item_id)
    
    updated = crud.update_watchlist_item_tags(db, item_id, tags_update.tag_ids, current_user.id)
    if not updated:
        raise WatchlistItemNotFoundError(item_id)
    
    return updated
