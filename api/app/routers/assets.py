"""
Assets router
"""
from typing import List, Optional, Dict, Any
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
async def get_held_assets(portfolio_id: int | None = None, db: Session = Depends(get_db)):
    """
    Get all currently held assets across all portfolios with metadata
    
    Returns assets that have non-zero positions with:
    - Asset details (symbol, name, sector, industry, asset_type)
    - Total quantity held across all portfolios (adjusted for splits)
    - Number of portfolios holding this asset
    - Portfolio-specific split_count and transaction_count if portfolio_id is provided
    """
    from sqlalchemy import func
    from app.models import Asset, Transaction, TransactionType
    from decimal import Decimal
    
    # Get all assets that have transactions
    query = db.query(Transaction.asset_id.distinct())
    if portfolio_id is not None:
        query = query.filter(Transaction.portfolio_id == portfolio_id)
    asset_ids = query.all()
    asset_ids = [aid[0] for aid in asset_ids]
    
    results = []
    for asset_id in asset_ids:
        # Get all transactions for this asset
        tx_query = db.query(Transaction).filter(Transaction.asset_id == asset_id)
        if portfolio_id is not None:
            # For portfolio-specific view, only get transactions from that portfolio
            portfolio_transactions = tx_query.filter(Transaction.portfolio_id == portfolio_id).order_by(Transaction.tx_date, Transaction.created_at).all()
            # But we still need global transactions to calculate total quantity across all portfolios
            all_transactions = db.query(Transaction).filter(Transaction.asset_id == asset_id).order_by(Transaction.tx_date, Transaction.created_at).all()
        else:
            # Global view - get all transactions
            all_transactions = tx_query.order_by(Transaction.tx_date, Transaction.created_at).all()
            portfolio_transactions = all_transactions
        
        # Calculate total quantity with split adjustments (using all transactions)
        total_quantity = Decimal(0)
        portfolio_ids = set()
        
        for tx in all_transactions:
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
                # Count splits and buy/sell transactions (portfolio-specific if portfolio_id provided)
                split_count = sum(1 for tx in portfolio_transactions if tx.type == TransactionType.SPLIT)
                transaction_count = sum(1 for tx in portfolio_transactions if tx.type in [TransactionType.BUY, TransactionType.SELL])
                
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
async def get_sold_assets(portfolio_id: int | None = None, db: Session = Depends(get_db)):
    """
    Get all sold assets across all portfolios with metadata
    
    Returns assets that were previously held but are no longer held (total_quantity = 0):
    - Asset details (symbol, name, sector, industry, asset_type)
    - Total quantity (will be 0)
    - Number of portfolios that held this asset
    - Portfolio-specific split_count and transaction_count if portfolio_id is provided
    """
    from sqlalchemy import func
    from app.models import Asset, Transaction, TransactionType
    from decimal import Decimal
    
    # Get all assets that have transactions
    query = db.query(Transaction.asset_id.distinct())
    if portfolio_id is not None:
        query = query.filter(Transaction.portfolio_id == portfolio_id)
    asset_ids = query.all()
    asset_ids = [aid[0] for aid in asset_ids]
    
    results = []
    for asset_id in asset_ids:
        # Get all transactions for this asset
        tx_query = db.query(Transaction).filter(Transaction.asset_id == asset_id)
        if portfolio_id is not None:
            # For portfolio-specific view, only get transactions from that portfolio
            portfolio_transactions = tx_query.filter(Transaction.portfolio_id == portfolio_id).order_by(Transaction.tx_date, Transaction.created_at).all()
            # But we still need global transactions to calculate total quantity across all portfolios
            all_transactions = db.query(Transaction).filter(Transaction.asset_id == asset_id).order_by(Transaction.tx_date, Transaction.created_at).all()
        else:
            # Global view - get all transactions
            all_transactions = tx_query.order_by(Transaction.tx_date, Transaction.created_at).all()
            portfolio_transactions = all_transactions
        
        # Calculate total quantity with split adjustments (using all transactions)
        total_quantity = Decimal(0)
        portfolio_ids = set()
        
        for tx in all_transactions:
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
                # Count splits and buy/sell transactions (portfolio-specific if portfolio_id provided)
                split_count = sum(1 for tx in portfolio_transactions if tx.type == TransactionType.SPLIT)
                transaction_count = sum(1 for tx in portfolio_transactions if tx.type in [TransactionType.BUY, TransactionType.SELL])
                
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
async def get_asset_split_history(
    asset_id: int, 
    portfolio_id: int | None = None,
    db: Session = Depends(get_db)
):
    """
    Get split history for a specific asset
    
    Returns all SPLIT transactions for the given asset, ordered by date (newest first).
    Optionally filter by portfolio_id.
    """
    from app.models import Transaction, TransactionType
    
    # Verify asset exists
    asset = crud.get_asset(db, asset_id)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset {asset_id} not found"
        )
    
    # Build query
    query = db.query(Transaction).filter(
        Transaction.asset_id == asset_id,
        Transaction.type == TransactionType.SPLIT
    )
    
    # Filter by portfolio if specified
    if portfolio_id is not None:
        query = query.filter(Transaction.portfolio_id == portfolio_id)
    
    splits = query.order_by(Transaction.tx_date.desc()).all()
    
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
async def get_asset_transaction_history(
    asset_id: int, 
    portfolio_id: int | None = None,
    db: Session = Depends(get_db)
):
    """
    Get buy/sell transaction history for a specific asset
    
    Returns all BUY and SELL transactions for the given asset, ordered by date (newest first).
    Includes split-adjusted quantities to show the current equivalent quantity.
    Optionally filter by portfolio_id.
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
    
    # Build query for all transactions
    query = db.query(Transaction).filter(Transaction.asset_id == asset_id)
    
    # Filter by portfolio if specified
    if portfolio_id is not None:
        query = query.filter(Transaction.portfolio_id == portfolio_id)
    
    # Get all transactions (BUY, SELL, and SPLIT) ordered chronologically
    all_transactions = query.order_by(Transaction.tx_date.asc()).all()
    
    # Build query for BUY and SELL transactions with portfolio names
    tx_query = (
        db.query(Transaction, Portfolio.name)
        .join(Portfolio, Transaction.portfolio_id == Portfolio.id)
        .filter(
            Transaction.asset_id == asset_id,
            Transaction.type.in_([TransactionType.BUY, TransactionType.SELL])
        )
    )
    
    # Filter by portfolio if specified
    if portfolio_id is not None:
        tx_query = tx_query.filter(Transaction.portfolio_id == portfolio_id)
    
    transactions = tx_query.order_by(Transaction.tx_date.desc()).all()
    
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


@router.get("/{asset_id}/prices")
async def get_asset_price_history(
    asset_id: int,
    period: str = "1M",
    db: Session = Depends(get_db)
):
    """
    Get price history for an asset with different time periods
    
    - **period**: Time period for the chart
      - "1W" or "weekly": Last 7 days
      - "1M" or "monthly": Last 30 days
      - "3M": Last 3 months
      - "6M": Last 6 months
      - "YTD": Year to date
      - "1Y" or "yearly": Last 12 months
      - "ALL" or "all": All available data from first transaction
    
    Returns array of price points with date and price.
    """
    from datetime import datetime, timedelta
    from app.crud import prices as crud_prices
    
    # Verify asset exists
    asset = crud.get_asset(db, asset_id)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset {asset_id} not found"
        )
    
    # Determine date range based on period
    end_date = datetime.utcnow()
    
    period_upper = period.upper()
    
    if period_upper in ["1W", "WEEKLY"]:
        start_date = end_date - timedelta(days=7)
    elif period_upper in ["1M", "MONTHLY"]:
        start_date = end_date - timedelta(days=30)
    elif period_upper == "3M":
        start_date = end_date - timedelta(days=90)
    elif period_upper == "6M":
        start_date = end_date - timedelta(days=180)
    elif period_upper == "YTD":
        # Year to date - from January 1st of current year
        start_date = datetime(end_date.year, 1, 1)
    elif period_upper in ["1Y", "YEARLY"]:
        start_date = end_date - timedelta(days=365)
    elif period_upper in ["ALL", "ALL_TIME"]:
        # Use first transaction date or created date
        if asset.first_transaction_date:
            start_date = datetime.combine(asset.first_transaction_date, datetime.min.time())
        else:
            start_date = asset.created_at
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid period '{period}'. Valid values: 1W, 1M, 3M, 6M, YTD, 1Y, ALL"
        )
    
    # Fetch prices from database
    prices = crud_prices.get_prices(
        db,
        asset_id,
        date_from=start_date,
        date_to=end_date,
        limit=10000  # Large limit to get all data for the period
    )
    
    # Group by date (calendar day) and keep only the latest price for each day
    # This ensures we return daily closes, not intraday updates
    from collections import defaultdict
    prices_by_date = defaultdict(list)
    
    for price in prices:
        # Group by calendar date (ignore time component)
        date_key = price.asof.date()
        prices_by_date[date_key].append(price)
    
    # For each date, take the price with the latest timestamp (closing price)
    daily_prices = []
    for date_key in sorted(prices_by_date.keys()):
        day_prices = prices_by_date[date_key]
        # Prefer prices from 'yfinance_history' source (official closes), otherwise take latest
        history_prices = [p for p in day_prices if p.source == 'yfinance_history']
        if history_prices:
            latest_price = max(history_prices, key=lambda p: p.asof)
        else:
            latest_price = max(day_prices, key=lambda p: p.asof)
        daily_prices.append(latest_price)
    
    result = [
        {
            "date": price.asof.isoformat(),
            "price": float(price.price),
            "volume": price.volume if price.volume else None,
            "source": price.source
        }
        for price in daily_prices
    ]
    
    return {
        "asset_id": asset.id,
        "symbol": asset.symbol,
        "name": asset.name,
        "currency": asset.currency,
        "period": period,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "data_points": len(result),
        "prices": result
    }


@router.get("/{asset_id}/health")
async def get_asset_price_health(asset_id: int, db: Session = Depends(get_db)):
    """
    Get health metrics for asset price data
    
    Returns diagnostic information about price data coverage:
    - Total price records
    - Date range of available data
    - Data gaps (missing trading days)
    - Data quality metrics
    - First transaction date
    - Expected vs actual data points
    
    This helps debug issues with price history and identify data quality problems.
    """
    from datetime import datetime, timedelta
    from app.crud import prices as crud_prices
    from app.models import Transaction
    
    # Verify asset exists
    asset = crud.get_asset(db, asset_id)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset {asset_id} not found"
        )
    
    # Get all prices for this asset
    all_prices = crud_prices.get_prices(
        db,
        asset_id,
        limit=100000  # Get all prices
    )
    
    if not all_prices:
        return {
            "asset_id": asset.id,
            "symbol": asset.symbol,
            "name": asset.name,
            "status": "NO_DATA",
            "message": "No price data available for this asset",
            "total_price_records": 0,
            "first_transaction_date": asset.first_transaction_date.isoformat() if asset.first_transaction_date else None,
            "data_range": None,
            "gaps": [],
            "coverage_pct": 0.0
        }
    
    # Sort prices by date
    prices_sorted = sorted(all_prices, key=lambda p: p.asof)
    
    # Get date range
    oldest_price = prices_sorted[0]
    newest_price = prices_sorted[-1]
    
    # Calculate expected trading days (approximate - excludes weekends but not holidays)
    start_date = oldest_price.asof
    end_date = newest_price.asof
    
    # Count expected trading days (Monday-Friday)
    expected_days = 0
    current_date = start_date
    while current_date <= end_date:
        # 0 = Monday, 6 = Sunday
        if current_date.weekday() < 5:
            expected_days += 1
        current_date += timedelta(days=1)
    
    # Find gaps (missing trading days with no price data)
    gaps = []
    price_dates = set(p.asof.date() for p in all_prices)
    
    current_date = start_date.date()
    end_date_only = end_date.date()
    
    while current_date <= end_date_only:
        # Check if it's a weekday and we don't have data
        if current_date.weekday() < 5 and current_date not in price_dates:
            gaps.append(current_date.isoformat())
        current_date += timedelta(days=1)
    
    # Calculate coverage percentage
    # Only count weekday prices (exclude weekend data from actual count)
    actual_days = len([d for d in price_dates if d.weekday() < 5])
    coverage_pct = (actual_days / expected_days * 100) if expected_days > 0 else 0
    
    # Count by source
    source_counts = {}
    for price in all_prices:
        source = price.source or "unknown"
        source_counts[source] = source_counts.get(source, 0) + 1
    
    # Get first transaction info
    first_transaction = (
        db.query(Transaction)
        .filter(Transaction.asset_id == asset_id)
        .order_by(Transaction.tx_date)
        .first()
    )
    
    # Determine status
    if coverage_pct >= 95:
        status = "EXCELLENT"
    elif coverage_pct >= 80:
        status = "GOOD"
    elif coverage_pct >= 60:
        status = "FAIR"
    else:
        status = "POOR"
    
    return {
        "asset_id": asset.id,
        "symbol": asset.symbol,
        "name": asset.name,
        "status": status,
        "total_price_records": len(all_prices),
        "first_transaction_date": asset.first_transaction_date.isoformat() if asset.first_transaction_date else None,
        "first_transaction_actual": first_transaction.tx_date.isoformat() if first_transaction else None,
        "data_range": {
            "start": oldest_price.asof.isoformat(),
            "end": newest_price.asof.isoformat(),
            "days": (end_date - start_date).days
        },
        "coverage": {
            "expected_trading_days": expected_days,
            "actual_data_points": actual_days,
            "coverage_pct": round(coverage_pct, 2),
            "missing_days": expected_days - actual_days,
            "gap_count": len(gaps)
        },
        "sources": source_counts,
        "gaps": gaps[:50] if len(gaps) <= 50 else {
            "total": len(gaps),
            "sample": gaps[:50],
            "message": f"Showing first 50 of {len(gaps)} gaps"
        },
        "recommendations": _get_health_recommendations(status, coverage_pct, len(gaps), asset)
    }


def _get_health_recommendations(status: str, coverage_pct: float, gap_count: int, asset) -> List[str]:
    """Generate recommendations based on health status"""
    recommendations = []
    
    if status == "POOR" or coverage_pct < 60:
        recommendations.append("⚠️ Price data coverage is low. Consider running a manual backfill.")
        recommendations.append(f"Run: POST /portfolios/{{portfolio_id}}/backfill_history to fetch missing prices")
    
    if gap_count > 10:
        recommendations.append(f"📊 Found {gap_count} gaps in price history. This may affect chart accuracy.")
        if asset.first_transaction_date:
            recommendations.append("Consider re-fetching historical data from first transaction date.")
    
    if status == "EXCELLENT":
        recommendations.append("✅ Price data coverage is excellent. No action needed.")
    
    if not asset.first_transaction_date:
        recommendations.append("⚠️ No first_transaction_date set. Historical backfill may not work correctly.")
    
    return recommendations


