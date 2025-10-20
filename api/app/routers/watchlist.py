"""
Watchlist router - Track assets without owning them
"""
from typing import List
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
    WatchlistItem, WatchlistItemCreate, WatchlistItemUpdate,
    WatchlistItemWithPrice, WatchlistImportItem, WatchlistImportResult,
    WatchlistConvertToBuy
)
from app.crud import watchlist as crud
from app.crud import assets as assets_crud
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
    
    # Build response with current prices
    result = []
    for item in items:
        asset = item.asset
        
        # Get current price and daily change
        current_price = None
        daily_change_pct = None
        last_updated = None
        
        try:
            # Use the correct PricingService API
            quote = pricing_service.get_price(asset.symbol)
            if quote:
                current_price = quote.price
                daily_change_pct = quote.daily_change_pct
                last_updated = quote.asof
        except Exception:
            pass  # Continue without price data
        
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
    notes: str = None,
    alert_target_price: Decimal = None,
    alert_enabled: bool = False,
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
    
    # Create watchlist item
    item = WatchlistItemCreate(
        asset_id=asset.id,
        notes=notes,
        alert_target_price=alert_target_price,
        alert_enabled=alert_enabled
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


@router.post("/import/json", response_model=WatchlistImportResult)
async def import_watchlist_json(
    items: List[WatchlistImportItem],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Import watchlist from JSON array"""
    imported_count = 0
    errors = []
    warnings = []
    
    for idx, import_item in enumerate(items):
        try:
            symbol = import_item.symbol.strip().upper()
            if not symbol:
                warnings.append(f"Item {idx}: Missing symbol, skipped")
                continue
            
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
                warnings.append(f"Item {idx}: {symbol} already in watchlist, skipped")
                continue
            
            # Create watchlist item
            item = WatchlistItemCreate(
                asset_id=asset.id,
                notes=import_item.notes,
                alert_target_price=import_item.alert_target_price,
                alert_enabled=import_item.alert_enabled
            )
            crud.create_watchlist_item(db, item, current_user.id)
            imported_count += 1
            
        except Exception as e:
            errors.append(f"Item {idx}: {str(e)}")
    
    return WatchlistImportResult(
        success=len(errors) == 0,
        imported_count=imported_count,
        errors=errors,
        warnings=warnings
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


@router.get("/export/json")
async def export_watchlist_json(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export watchlist as JSON"""
    items = crud.get_watchlist_items_by_user(db, current_user.id)
    
    export_data = []
    for item in items:
        export_data.append({
            "symbol": item.asset.symbol,
            "name": item.asset.name,
            "notes": item.notes,
            "alert_target_price": float(item.alert_target_price) if item.alert_target_price else None,
            "alert_enabled": item.alert_enabled,
            "created_at": item.created_at.isoformat()
        })
    
    return export_data
