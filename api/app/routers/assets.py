"""
Assets router
"""
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import Asset, AssetCreate
from app.crud import assets as crud
import yfinance as yf

router = APIRouter()


def _parse_split_ratio(split_str: str) -> Decimal:
    """
    Parse split ratio string (e.g., "2:1" -> 2.0, "1:2" -> 0.5, "10:1" -> 10.0)
    """
    try:
        parts = split_str.split(":")
        if len(parts) == 2:
            numerator = Decimal(parts[0])
            denominator = Decimal(parts[1])
            return numerator / denominator
    except:
        pass
    return Decimal(1)

# Live ticker search endpoint
@router.get("/search_ticker")
async def search_ticker(query: str):
    """
    Live search for tickers using yfinance
    - **query**: Partial ticker or company name
    """
    import requests
    url = f"https://query2.finance.yahoo.com/v1/finance/search?q={query}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    try:
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Yahoo Finance search failed with status {response.status_code}")
        data = response.json()
        # Return top 10 results with symbol and name
        results = [
            {"symbol": item["symbol"], "name": item.get("shortname", item.get("longname", ""))}
            for item in data.get("quotes", [])[:10]
        ]
        return results
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to Yahoo Finance: {str(e)}")


@router.get("", response_model=List[Asset])
async def get_assets(
    query: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get list of assets with optional search
    
    - **query**: Search in symbol or name
    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum number of records to return
    """
    assets = crud.get_assets(db, skip=skip, limit=limit, query=query)
    return assets


@router.get("/{asset_id}", response_model=Asset)
async def get_asset(asset_id: int, db: Session = Depends(get_db)):
    """Get asset by ID"""
    asset = crud.get_asset(db, asset_id)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset {asset_id} not found"
        )
    return asset


@router.post("", response_model=Asset, status_code=status.HTTP_201_CREATED)
async def create_asset(
    asset: AssetCreate,
    db: Session = Depends(get_db)
):
    """
    Create new asset
    
    Symbol must be a valid Yahoo Finance ticker (e.g., AAPL, BTC-USD, ^GSPC)
    """
    # Check if symbol already exists
    existing = crud.get_asset_by_symbol(db, asset.symbol)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Asset with symbol {asset.symbol} already exists"
        )
    
    return crud.create_asset(db, asset)


@router.put("/{asset_id}", response_model=Asset)
async def update_asset(
    asset_id: int,
    asset: AssetCreate,
    db: Session = Depends(get_db)
):
    """Update existing asset"""
    updated = crud.update_asset(db, asset_id, asset)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset {asset_id} not found"
        )
    return updated


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    """Delete asset"""
    success = crud.delete_asset(db, asset_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset {asset_id} not found"
        )


@router.get("/held/all")
async def get_held_assets(db: Session = Depends(get_db)):
    """
    Get all currently held assets across all portfolios with metadata
    
    Returns assets that have non-zero positions with:
    - Asset details (symbol, name, sector, industry, asset_type)
    - Total quantity held across all portfolios (adjusted for splits)
    - Number of portfolios holding this asset
    """
    from sqlalchemy import func
    from app.models import Asset, Transaction, TransactionType
    from decimal import Decimal
    
    # Get all assets that have transactions
    asset_ids = db.query(Transaction.asset_id.distinct()).all()
    asset_ids = [aid[0] for aid in asset_ids]
    
    results = []
    for asset_id in asset_ids:
        # Get all transactions for this asset across all portfolios
        transactions = (
            db.query(Transaction)
            .filter(Transaction.asset_id == asset_id)
            .order_by(Transaction.tx_date, Transaction.created_at)
            .all()
        )
        
        # Calculate total quantity with split adjustments
        total_quantity = Decimal(0)
        portfolio_ids = set()
        
        for tx in transactions:
            portfolio_ids.add(tx.portfolio_id)
            
            if tx.type == TransactionType.BUY or tx.type == TransactionType.TRANSFER_IN:
                total_quantity += tx.quantity
            elif tx.type == TransactionType.SELL or tx.type == TransactionType.TRANSFER_OUT:
                total_quantity -= tx.quantity
            elif tx.type == TransactionType.SPLIT:
                # Apply split ratio to current quantity
                split_ratio = _parse_split_ratio(tx.meta_data.get("split", "1:1") if tx.meta_data else "1:1")
                total_quantity *= split_ratio
        
        # Only include assets with positive quantity
        if total_quantity > 0:
            asset = db.query(Asset).filter(Asset.id == asset_id).first()
            if asset:
                # Count splits and buy/sell transactions for this asset
                split_count = sum(1 for tx in transactions if tx.type == TransactionType.SPLIT)
                transaction_count = sum(1 for tx in transactions if tx.type in [TransactionType.BUY, TransactionType.SELL])
                
                results.append({
                    "id": asset.id,
                    "symbol": asset.symbol,
                    "name": asset.name,
                    "currency": asset.currency,
                    "class": asset.class_.value if asset.class_ else None,
                    "sector": asset.sector,
                    "industry": asset.industry,
                    "asset_type": asset.asset_type,
                    "country": asset.country,
                    "total_quantity": float(total_quantity),
                    "portfolio_count": len(portfolio_ids),
                    "split_count": split_count,
                    "transaction_count": transaction_count,
                    "created_at": asset.created_at,
                    "updated_at": asset.updated_at
                })
    
    # Sort by symbol
    results.sort(key=lambda x: x["symbol"])
    return results


@router.get("/sold/all")
async def get_sold_assets(db: Session = Depends(get_db)):
    """
    Get all sold assets across all portfolios with metadata
    
    Returns assets that were previously held but are no longer held (total_quantity = 0):
    - Asset details (symbol, name, sector, industry, asset_type)
    - Total quantity (will be 0)
    - Number of portfolios that held this asset
    """
    from sqlalchemy import func
    from app.models import Asset, Transaction, TransactionType
    from decimal import Decimal
    
    # Get all assets that have transactions
    asset_ids = db.query(Transaction.asset_id.distinct()).all()
    asset_ids = [aid[0] for aid in asset_ids]
    
    results = []
    for asset_id in asset_ids:
        # Get all transactions for this asset across all portfolios
        transactions = (
            db.query(Transaction)
            .filter(Transaction.asset_id == asset_id)
            .order_by(Transaction.tx_date, Transaction.created_at)
            .all()
        )
        
        # Calculate total quantity with split adjustments
        total_quantity = Decimal(0)
        portfolio_ids = set()
        
        for tx in transactions:
            portfolio_ids.add(tx.portfolio_id)
            
            if tx.type == TransactionType.BUY or tx.type == TransactionType.TRANSFER_IN:
                total_quantity += tx.quantity
            elif tx.type == TransactionType.SELL or tx.type == TransactionType.TRANSFER_OUT:
                total_quantity -= tx.quantity
            elif tx.type == TransactionType.SPLIT:
                # Apply split ratio to current quantity
                split_ratio = _parse_split_ratio(tx.meta_data.get("split", "1:1") if tx.meta_data else "1:1")
                total_quantity *= split_ratio
        
        # Only include assets with zero or negative quantity (sold)
        if total_quantity <= 0:
            asset = db.query(Asset).filter(Asset.id == asset_id).first()
            if asset:
                # Count splits and buy/sell transactions for this asset
                split_count = sum(1 for tx in transactions if tx.type == TransactionType.SPLIT)
                transaction_count = sum(1 for tx in transactions if tx.type in [TransactionType.BUY, TransactionType.SELL])
                
                results.append({
                    "id": asset.id,
                    "symbol": asset.symbol,
                    "name": asset.name,
                    "currency": asset.currency,
                    "class": asset.class_.value if asset.class_ else None,
                    "sector": asset.sector,
                    "industry": asset.industry,
                    "asset_type": asset.asset_type,
                    "country": asset.country,
                    "total_quantity": float(total_quantity),
                    "portfolio_count": len(portfolio_ids),
                    "split_count": split_count,
                    "transaction_count": transaction_count,
                    "created_at": asset.created_at,
                    "updated_at": asset.updated_at
                })
    
    # Sort by symbol
    results.sort(key=lambda x: x["symbol"])
    return results


@router.post("/enrich/all")
async def enrich_all_assets(db: Session = Depends(get_db)):
    """
    Enrich all assets with metadata from Yahoo Finance
    
    Fetches sector, industry, and asset_type for assets that don't have this data.
    This is useful for updating assets that were created before metadata enrichment was implemented.
    """
    result = crud.enrich_all_assets(db)
    return {
        "success": True,
        "message": f"Enriched {result['enriched']} out of {result['total']} assets",
        **result
    }


@router.post("/enrich/{asset_id}", response_model=Asset)
async def enrich_asset(asset_id: int, db: Session = Depends(get_db)):
    """
    Enrich a single asset with metadata from Yahoo Finance
    
    Updates sector, industry, asset_type, and name if not already set
    """
    enriched = crud.enrich_asset_metadata(db, asset_id)
    if not enriched:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset {asset_id} not found"
        )
    return enriched


@router.get("/logo/{symbol}")
async def resolve_logo(symbol: str, name: Optional[str] = None, asset_type: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Fetch and return the best available logo for a symbol.

    Strategy:
    1. Check database cache first for previously fetched logos
    2. If asset_type is 'ETF', generate and cache generic ETF logo
    3. Try direct ticker fetch and cache result
    4. Try API search with company name and cache result
    5. Cache 404 results to avoid repeated failed lookups
    
    Returns the image data directly with aggressive caching headers.

    Query params:
    - name: Optional company name to improve search quality.
    - asset_type: Optional asset type (e.g., 'ETF', 'EQUITY', 'CRYPTO') to determine if generic logo should be used.
    """
    # Lazy imports to avoid import-time issues
    from app.services.logos import fetch_logo_with_validation
    from app.crud import assets as crud_assets
    from fastapi.responses import Response
    import hashlib

    # Get or create asset in database
    db_asset = crud_assets.get_asset_by_symbol(db, symbol.upper())
    
    # Check database cache first
    if db_asset:
        cached = crud_assets.get_cached_logo(db, db_asset.id)
        if cached:
            logo_data, content_type = cached
            response = Response(content=logo_data, media_type=content_type)
            # Cache for 30 days
            response.headers["Cache-Control"] = "public, max-age=2592000, immutable"
            # Add ETag for cache validation
            etag = hashlib.md5(logo_data).hexdigest()
            response.headers["ETag"] = f'"{etag}"'
            return response

    # Fetch logo using the consolidated validation function
    # This tries: 1) direct ticker, 2) ticker search, 3) company name search, 4) SVG fallback
    logo_data = fetch_logo_with_validation(symbol, company_name=name, asset_type=asset_type)
    
    # Determine content type based on data
    if logo_data.startswith(b'<svg') or logo_data.startswith(b'<?xml'):
        content_type = 'image/svg+xml'
        cache_time = 604800  # 7 days for SVG
    else:
        content_type = 'image/webp'
        cache_time = 2592000  # 30 days for real logos
    
    # Cache in database if asset exists
    if db_asset:
        crud_assets.cache_logo(db, db_asset.id, logo_data, content_type)
    
    # Return the logo
    response = Response(content=logo_data, media_type=content_type)
    response.headers["Cache-Control"] = f"public, max-age={cache_time}, immutable"
    # Add ETag for cache validation
    etag = hashlib.md5(logo_data).hexdigest()
    response.headers["ETag"] = f'"{etag}"'
    return response



@router.get("/{asset_id}/splits")
async def get_asset_split_history(asset_id: int, db: Session = Depends(get_db)):
    """
    Get split history for a specific asset
    
    Returns all SPLIT transactions for the given asset, ordered by date (newest first).
    """
    from app.models import Transaction, TransactionType
    
    # Verify asset exists
    asset = crud.get_asset(db, asset_id)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset {asset_id} not found"
        )
    
    # Get all SPLIT transactions for this asset
    splits = (
        db.query(Transaction)
        .filter(
            Transaction.asset_id == asset_id,
            Transaction.type == TransactionType.SPLIT
        )
        .order_by(Transaction.tx_date.desc())
        .all()
    )
    
    return [
        {
            "id": split.id,
            "tx_date": split.tx_date.isoformat(),
            "metadata": split.meta_data or {},
            "notes": split.notes
        }
        for split in splits
    ]


@router.get("/{asset_id}/transactions")
async def get_asset_transaction_history(asset_id: int, db: Session = Depends(get_db)):
    """
    Get buy/sell transaction history for a specific asset across all portfolios
    
    Returns all BUY and SELL transactions for the given asset, ordered by date (newest first).
    Includes split-adjusted quantities to show the current equivalent quantity.
    """
    from app.models import Transaction, TransactionType, Portfolio
    from decimal import Decimal
    
    # Verify asset exists
    asset = crud.get_asset(db, asset_id)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset {asset_id} not found"
        )
    
    # Get all transactions (BUY, SELL, and SPLIT) ordered chronologically
    all_transactions = (
        db.query(Transaction)
        .filter(Transaction.asset_id == asset_id)
        .order_by(Transaction.tx_date, Transaction.created_at)
        .all()
    )
    
    # Get all BUY and SELL transactions with portfolio names
    transactions = (
        db.query(Transaction, Portfolio.name)
        .join(Portfolio, Transaction.portfolio_id == Portfolio.id)
        .filter(
            Transaction.asset_id == asset_id,
            Transaction.type.in_([TransactionType.BUY, TransactionType.SELL])
        )
        .order_by(Transaction.tx_date.desc())
        .all()
    )
    
    # Calculate split-adjusted quantities for each transaction
    result = []
    for tx, portfolio_name in transactions:
        # Find all splits that occurred after this transaction
        splits_after = [
            t for t in all_transactions
            if t.type == TransactionType.SPLIT and 
            (t.tx_date > tx.tx_date or (t.tx_date == tx.tx_date and t.created_at > tx.created_at))
        ]
        
        # Apply split adjustments
        adjusted_quantity = Decimal(str(tx.quantity))
        for split_tx in splits_after:
            split_ratio = _parse_split_ratio(
                split_tx.meta_data.get("split", "1:1") if split_tx.meta_data else "1:1"
            )
            adjusted_quantity *= split_ratio
        
        result.append({
            "id": tx.id,
            "tx_date": tx.tx_date.isoformat(),
            "type": tx.type.value,
            "quantity": float(tx.quantity),
            "adjusted_quantity": float(adjusted_quantity),
            "price": float(tx.price) if tx.price else None,
            "fees": float(tx.fees) if tx.fees else None,
            "portfolio_name": portfolio_name,
            "notes": tx.notes
        })
    
    return result

