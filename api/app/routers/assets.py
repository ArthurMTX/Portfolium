"""
Assets router
"""
from typing import List, Optional
from decimal import Decimal
from datetime import datetime
import logging
from fastapi import APIRouter, Depends, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import Asset, AssetCreate, AssetMetadataOverride, AssetWithOverrides
from app.crud import assets as crud
from app.auth import get_current_user
from app.models import User
from app.dependencies import MetricsServiceDep
from app.errors import ( 
    AssetAlreadyExistsError,
    AssetNotFoundError,
    AssetNotFoundInDatabaseError,
    FailedToConnectToYahooError,
    FailedToFetchYahooFinanceDataError,
    InvalidAssetIDOrSymbolError,
    InvalidPriceHistoryPeriodError,
    SearchTickerError,
    SetMetadataError
)
import yfinance as yf

router = APIRouter()
logger = logging.getLogger(__name__)


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
            raise SearchTickerError(status=response.status_code)
        data = response.json()
        # Return top 10 results with symbol and name
        results = [
            {"symbol": item["symbol"], "name": item.get("shortname", item.get("longname", ""))}
            for item in data.get("quotes", [])[:10]
        ]
        return results
    except requests.RequestException as e:
        raise FailedToConnectToYahooError(reason=str(e))

@router.get("", response_model=List[Asset])
def get_assets(
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
def get_asset(asset_id: int, db: Session = Depends(get_db)):
    """Get asset by ID"""
    asset = crud.get_asset(db, asset_id)
    if not asset:
        raise AssetNotFoundError(id=asset_id)
    return asset


@router.post("", response_model=Asset, status_code=status.HTTP_201_CREATED)
def create_asset(
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
        raise AssetAlreadyExistsError(symbol=asset.symbol)
    
    return crud.create_asset(db, asset)


@router.put("/{asset_id}", response_model=Asset)
def update_asset(
    asset_id: int,
    asset: AssetCreate,
    db: Session = Depends(get_db)
):
    """Update existing asset"""
    updated = crud.update_asset(db, asset_id, asset)
    if not updated:
        raise AssetNotFoundError(id=asset_id)
    return updated


@router.patch("/{asset_id}/metadata-overrides", response_model=AssetWithOverrides)
def set_metadata_overrides(
    asset_id: int,
    overrides: AssetMetadataOverride,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Set user-specific metadata overrides for an asset (country, sector, industry).
    
    Overrides can ONLY be set when Yahoo Finance doesn't provide the corresponding data.
    This ensures overrides are used as a fallback, not to replace valid Yahoo Finance data.
    
    Overrides are USER-SPECIFIC - each user can set their own classification preferences.
    Other users will not see your overrides unless they set the same values.
    
    - **sector_override**: Custom sector when Yahoo Finance sector is None
    - **industry_override**: Custom industry when Yahoo Finance industry is None  
    - **country_override**: Custom country when Yahoo Finance country is None
    
    Example use case: ETFs often don't have sector/industry/country in Yahoo Finance,
    so users can provide meaningful categorization for portfolio insights.
    
    Returns HTTP 400 if attempting to override when Yahoo Finance data exists.
    """
    try:
        override_record = crud.set_asset_metadata_overrides(
            db,
            user_id=current_user.id,
            asset_id=asset_id,
            sector_override=overrides.sector_override,
            industry_override=overrides.industry_override,
            country_override=overrides.country_override
        )
        
        # Get the asset with effective metadata
        asset = crud.get_asset(db, asset_id)
        if not asset:
            raise AssetNotFoundError(id=asset_id)
        
        # Get effective metadata for response
        effective_data = crud.get_effective_asset_metadata(db, asset, current_user.id)
        
        # Build response with all fields
        response_data = {
            "id": asset.id,
            "symbol": asset.symbol,
            "name": asset.name,
            "currency": asset.currency,
            "class": asset.class_.value if asset.class_ else None,
            "sector": asset.sector,
            "industry": asset.industry,
            "asset_type": asset.asset_type,
            "country": asset.country,
            "created_at": asset.created_at,
            "updated_at": asset.updated_at,
            **effective_data
        }
        
        return response_data
        
    except ValueError as e:
        raise SetMetadataError(symbol=asset.symbol)


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    """Delete asset"""
    success = crud.delete_asset(db, asset_id)
    if not success:
        raise AssetNotFoundError(id=asset_id)


@router.get("/held/all")
async def get_held_assets(
    portfolio_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all currently held assets across all portfolios with metadata
    
    Returns assets that have non-zero positions with:
    - Asset details (symbol, name, sector, industry, asset_type)
    - Total quantity held across all portfolios (adjusted for splits)
    - Number of portfolios holding this asset
    - Portfolio-specific split_count and transaction_count if portfolio_id is provided
    - User-specific metadata overrides (effective_sector, effective_industry, effective_country)
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
            # Use portfolio transactions to calculate quantity for this specific portfolio
            transactions_for_calculation = portfolio_transactions
        else:
            # Global view - get all transactions
            all_transactions = tx_query.order_by(Transaction.tx_date, Transaction.created_at).all()
            portfolio_transactions = all_transactions
            transactions_for_calculation = all_transactions
        
        # Calculate total quantity with split adjustments
        total_quantity = Decimal(0)
        portfolio_ids = set()
        
        for tx in transactions_for_calculation:
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
                
                # Get first transaction date (earliest BUY transaction)
                buy_transactions = [tx for tx in portfolio_transactions if tx.type == TransactionType.BUY]
                first_transaction_date = min([tx.tx_date for tx in buy_transactions]) if buy_transactions else None
                
                # Get user-specific effective metadata
                effective_data = crud.get_effective_asset_metadata(db, asset, current_user.id)
                
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
                    "effective_sector": effective_data["effective_sector"],
                    "effective_industry": effective_data["effective_industry"],
                    "effective_country": effective_data["effective_country"],
                    "total_quantity": float(total_quantity),
                    "portfolio_count": len(portfolio_ids),
                    "split_count": split_count,
                    "transaction_count": transaction_count,
                    "first_transaction_date": first_transaction_date.isoformat() if first_transaction_date else None,
                    "logo_fetched_at": asset.logo_fetched_at.isoformat() if asset.logo_fetched_at else None,
                    "created_at": asset.created_at,
                    "updated_at": asset.updated_at
                })
    
    # Sort by symbol
    results.sort(key=lambda x: x["symbol"])
    return results


@router.get("/sold/all")
async def get_sold_assets(
    portfolio_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all sold assets across all portfolios with metadata
    
    Returns assets that were previously held but are no longer held (total_quantity = 0):
    - Asset details (symbol, name, sector, industry, asset_type)
    - Total quantity (will be 0)
    - Number of portfolios that held this asset
    - Portfolio-specific split_count and transaction_count if portfolio_id is provided
    - User-specific metadata overrides (effective_sector, effective_industry, effective_country)
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
            # Use portfolio transactions to calculate quantity for this specific portfolio
            transactions_for_calculation = portfolio_transactions
        else:
            # Global view - get all transactions
            all_transactions = tx_query.order_by(Transaction.tx_date, Transaction.created_at).all()
            portfolio_transactions = all_transactions
            transactions_for_calculation = all_transactions
        
        # Calculate total quantity with split adjustments
        total_quantity = Decimal(0)
        portfolio_ids = set()
        
        for tx in transactions_for_calculation:
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
                
                # Get first transaction date (earliest BUY transaction)
                buy_transactions = [tx for tx in portfolio_transactions if tx.type == TransactionType.BUY]
                first_transaction_date = min([tx.tx_date for tx in buy_transactions]) if buy_transactions else None
                
                # Get user-specific effective metadata
                effective_data = crud.get_effective_asset_metadata(db, asset, current_user.id)
                
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
                    "effective_sector": effective_data["effective_sector"],
                    "effective_industry": effective_data["effective_industry"],
                    "effective_country": effective_data["effective_country"],
                    "total_quantity": float(total_quantity),
                    "portfolio_count": len(portfolio_ids),
                    "split_count": split_count,
                    "transaction_count": transaction_count,
                    "first_transaction_date": first_transaction_date.isoformat() if first_transaction_date else None,
                    "logo_fetched_at": asset.logo_fetched_at.isoformat() if asset.logo_fetched_at else None,
                    "created_at": asset.created_at,
                    "updated_at": asset.updated_at
                })
    
    # Sort by symbol
    results.sort(key=lambda x: x["symbol"])
    return results


@router.post("/enrich/all")
def enrich_all_assets(db: Session = Depends(get_db)):
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
def enrich_asset(asset_id: int, db: Session = Depends(get_db)):
    """
    Enrich a single asset with metadata from Yahoo Finance
    
    Updates sector, industry, asset_type, and name if not already set
    """
    enriched = crud.enrich_asset_metadata(db, asset_id)
    if not enriched:
        raise AssetNotFoundError(id=asset_id)
    return enriched


@router.get("/logo/{symbol}")
async def resolve_logo(symbol: str, name: Optional[str] = None, asset_type: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Fetch and return the best available logo for a symbol.

    Strategy:
    1. For ETFs and Cryptocurrencies, skip cache and generate/fetch logo to avoid incorrect brand logos
    2. For other assets, check database cache first for previously fetched logos
    3. Try direct ticker fetch and cache result
    4. Try API search with company name and cache result
    5. If all else fails, generate SVG fallback
    
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
    
    # Use database asset_type if query param not provided
    effective_asset_type = asset_type
    if not effective_asset_type and db_asset:
        effective_asset_type = db_asset.asset_type
    
    # Use database name if query param not provided
    effective_name = name
    if not effective_name and db_asset:
        effective_name = db_asset.name
    
    # For ETFs and Cryptocurrencies, skip cache to avoid incorrect brand logos
    is_etf = effective_asset_type and effective_asset_type.upper() == 'ETF'
    is_crypto = effective_asset_type and effective_asset_type.upper() in ['CRYPTO', 'CRYPTOCURRENCY']
    skip_cache = is_etf or is_crypto
    
    # Check database cache first (but skip for ETFs and cryptocurrencies)
    if db_asset and not skip_cache:
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
    # For ETFs/Cryptocurrencies, this will skip ticker search and use appropriate fallback
    logo_data = fetch_logo_with_validation(symbol, company_name=effective_name, asset_type=effective_asset_type)
    
    # Determine content type based on data
    if logo_data.startswith(b'<svg') or logo_data.startswith(b'<?xml'):
        content_type = 'image/svg+xml'
        cache_time = 604800  # 7 days for SVG
    else:
        content_type = 'image/webp'
        cache_time = 2592000  # 30 days for real logos
    
    # Cache in database if asset exists and not ETF/Crypto (they should be refetched each time)
    if db_asset and not skip_cache:
        crud_assets.cache_logo(db, db_asset.id, logo_data, content_type)
    
    # Return the logo
    response = Response(content=logo_data, media_type=content_type)
    response.headers["Cache-Control"] = f"public, max-age={cache_time}, immutable"
    # Add ETag for cache validation
    etag = hashlib.md5(logo_data).hexdigest()
    response.headers["ETag"] = f'"{etag}"'
    return response



@router.get("/{asset_id}/splits")
def get_asset_split_history(
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
        raise AssetNotFoundError(id=asset_id)
    
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
def get_asset_transaction_history(
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
        raise AssetNotFoundError(id=asset_id)
    
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


@router.get("/distribution/sectors")
async def get_sectors_distribution(
    metrics_service: MetricsServiceDep,
    portfolio_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get distribution of assets by sector with performance metrics
    
    Uses user-specific metadata overrides for classification.
    
    Returns aggregated data for each sector including:
    - Sector name
    - Asset count
    - Total market value (sum of all positions in this sector)
    - Cost basis (sum of all cost bases)
    - Unrealized P&L (sum of unrealized gains/losses)
    - Percentage of total assets
    - List of asset IDs in this sector
    
    Optionally filter by portfolio_id to get sector distribution for a specific portfolio.
    """
    from collections import defaultdict
    
    # Get all held assets (with optional portfolio filter and user-specific overrides)
    held_assets_data = await get_held_assets(portfolio_id=portfolio_id, current_user=current_user, db=db)
    
    # If we have a portfolio_id, get positions for that portfolio
    positions_map = {}
    if portfolio_id is not None:
        positions = await metrics_service.get_positions(portfolio_id)
        # Also get sold positions which might still have data
        sold_positions = await metrics_service.get_sold_positions_only(portfolio_id)
        all_positions = positions + sold_positions
        positions_map = {pos.asset_id: pos for pos in all_positions}
    
    # Group by sector
    sector_data = defaultdict(lambda: {
        "assets": [],
        "count": 0,
        "total_value": Decimal(0),
        "cost_basis": Decimal(0),
        "unrealized_pnl": Decimal(0),
    })
    
    total_assets = len(held_assets_data)
    total_portfolio_value = Decimal(0)
    
    # Calculate total portfolio value if we have positions
    if portfolio_id is not None:
        total_portfolio_value = sum(
            (positions_map[asset["id"]].market_value or Decimal(0))
            for asset in held_assets_data
            if asset["id"] in positions_map
        )
    
    for asset in held_assets_data:
        # Use effective_sector which includes user-specific overrides
        sector = asset.get("effective_sector") or "Unknown"
        sector_data[sector]["assets"].append(asset["id"])
        sector_data[sector]["count"] += 1
        
        # Add position data if available
        if portfolio_id is not None and asset["id"] in positions_map:
            pos = positions_map[asset["id"]]
            sector_data[sector]["total_value"] += pos.market_value or Decimal(0)
            sector_data[sector]["cost_basis"] += pos.cost_basis or Decimal(0)
            sector_data[sector]["unrealized_pnl"] += pos.unrealized_pnl or Decimal(0)
    
    # Convert to list format
    result = []
    for sector, data in sector_data.items():
        unrealized_pnl_pct = (
            (data["unrealized_pnl"] / data["cost_basis"] * 100)
            if data["cost_basis"] > 0
            else Decimal(0)
        )
        
        # Calculate percentage based on total value if available, otherwise use count
        if portfolio_id is not None and total_portfolio_value > 0:
            percentage = float(data["total_value"] / total_portfolio_value * 100)
        else:
            percentage = (data["count"] / total_assets * 100) if total_assets > 0 else 0
        
        result.append({
            "name": sector,
            "count": data["count"],
            "percentage": percentage,
            "total_value": float(data["total_value"]),
            "cost_basis": float(data["cost_basis"]),
            "unrealized_pnl": float(data["unrealized_pnl"]),
            "unrealized_pnl_pct": float(unrealized_pnl_pct),
            "asset_ids": data["assets"],
        })
    
    # Sort by total value descending if we have portfolio data, otherwise by count
    if portfolio_id is not None:
        result.sort(key=lambda x: x["total_value"], reverse=True)
    else:
        result.sort(key=lambda x: x["count"], reverse=True)
    
    return result


@router.get("/distribution/countries")
async def get_countries_distribution(
    metrics_service: MetricsServiceDep,
    portfolio_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get distribution of assets by country with performance metrics
    
    Uses user-specific metadata overrides for classification.
    
    Returns aggregated data for each country including:
    - Country name
    - Asset count
    - Total market value
    - Cost basis
    - Unrealized P&L
    - Percentage of total assets
    - List of asset IDs in this country
    
    Optionally filter by portfolio_id to get country distribution for a specific portfolio.
    """
    from collections import defaultdict
    
    held_assets_data = await get_held_assets(portfolio_id=portfolio_id, current_user=current_user, db=db)
    
    positions_map = {}
    if portfolio_id is not None:
        positions = await metrics_service.get_positions(portfolio_id)
        sold_positions = await metrics_service.get_sold_positions_only(portfolio_id)
        all_positions = positions + sold_positions
        positions_map = {pos.asset_id: pos for pos in all_positions}
    
    country_data = defaultdict(lambda: {
        "assets": [],
        "count": 0,
        "total_value": Decimal(0),
        "cost_basis": Decimal(0),
        "unrealized_pnl": Decimal(0),
    })
    
    total_assets = len(held_assets_data)
    total_portfolio_value = Decimal(0)
    
    # Calculate total portfolio value if we have positions
    if portfolio_id is not None:
        total_portfolio_value = sum(
            (positions_map[asset["id"]].market_value or Decimal(0))
            for asset in held_assets_data
            if asset["id"] in positions_map
        )
    
    for asset in held_assets_data:
        # Use effective_country which includes user-specific overrides
        country = asset.get("effective_country") or "Unknown"
        country_data[country]["assets"].append(asset["id"])
        country_data[country]["count"] += 1
        
        if portfolio_id is not None and asset["id"] in positions_map:
            pos = positions_map[asset["id"]]
            country_data[country]["total_value"] += pos.market_value or Decimal(0)
            country_data[country]["cost_basis"] += pos.cost_basis or Decimal(0)
            country_data[country]["unrealized_pnl"] += pos.unrealized_pnl or Decimal(0)
    
    result = []
    for country, data in country_data.items():
        unrealized_pnl_pct = (
            (data["unrealized_pnl"] / data["cost_basis"] * 100)
            if data["cost_basis"] > 0
            else Decimal(0)
        )
        
        # Calculate percentage based on total value if available, otherwise use count
        if portfolio_id is not None and total_portfolio_value > 0:
            percentage = float(data["total_value"] / total_portfolio_value * 100)
        else:
            percentage = (data["count"] / total_assets * 100) if total_assets > 0 else 0
        
        # Build asset positions list if we have portfolio data
        asset_positions = []
        if portfolio_id is not None:
            country_total = data["total_value"]
            for asset_id in data["assets"]:
                if asset_id in positions_map:
                    pos = positions_map[asset_id]
                    asset_value = pos.market_value or Decimal(0)
                    asset_pct = float(asset_value / country_total * 100) if country_total > 0 else 0
                    asset_positions.append({
                        "asset_id": asset_id,
                        "total_value": float(asset_value),
                        "unrealized_pnl": float(pos.unrealized_pnl or Decimal(0)),
                        "percentage": asset_pct,
                    })
        
        result.append({
            "name": country,
            "count": data["count"],
            "percentage": percentage,
            "total_value": float(data["total_value"]),
            "cost_basis": float(data["cost_basis"]),
            "unrealized_pnl": float(data["unrealized_pnl"]),
            "unrealized_pnl_pct": float(unrealized_pnl_pct),
            "asset_ids": data["assets"],
            "asset_positions": asset_positions,
        })
    
    # Sort by total value descending if we have portfolio data, otherwise by count
    if portfolio_id is not None:
        result.sort(key=lambda x: x["total_value"], reverse=True)
    else:
        result.sort(key=lambda x: x["count"], reverse=True)
    
    return result


@router.get("/distribution/types")
async def get_types_distribution(
    metrics_service: MetricsServiceDep,
    portfolio_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get distribution of assets by type with performance metrics
    
    Returns aggregated data for each asset type including:
    - Type name (e.g., EQUITY, ETF, CRYPTO)
    - Asset count
    - Total market value
    - Cost basis
    - Unrealized P&L
    - Percentage of total assets
    - List of asset IDs of this type
    
    Optionally filter by portfolio_id to get type distribution for a specific portfolio.
    """
    from collections import defaultdict
    
    held_assets_data = await get_held_assets(portfolio_id=portfolio_id, current_user=current_user, db=db)
    
    positions_map = {}
    if portfolio_id is not None:
        positions = await metrics_service.get_positions(portfolio_id)
        sold_positions = await metrics_service.get_sold_positions_only(portfolio_id)
        all_positions = positions + sold_positions
        positions_map = {pos.asset_id: pos for pos in all_positions}
    
    type_data = defaultdict(lambda: {
        "assets": [],
        "count": 0,
        "total_value": Decimal(0),
        "cost_basis": Decimal(0),
        "unrealized_pnl": Decimal(0),
    })
    
    total_assets = len(held_assets_data)
    total_portfolio_value = Decimal(0)
    
    # Calculate total portfolio value if we have positions
    if portfolio_id is not None:
        total_portfolio_value = sum(
            (positions_map[asset["id"]].market_value or Decimal(0))
            for asset in held_assets_data
            if asset["id"] in positions_map
        )
    
    for asset in held_assets_data:
        asset_type = asset.get("asset_type") or "Unknown"
        type_data[asset_type]["assets"].append(asset["id"])
        type_data[asset_type]["count"] += 1
        
        if portfolio_id is not None and asset["id"] in positions_map:
            pos = positions_map[asset["id"]]
            type_data[asset_type]["total_value"] += pos.market_value or Decimal(0)
            type_data[asset_type]["cost_basis"] += pos.cost_basis or Decimal(0)
            type_data[asset_type]["unrealized_pnl"] += pos.unrealized_pnl or Decimal(0)
    
    result = []
    for asset_type, data in type_data.items():
        unrealized_pnl_pct = (
            (data["unrealized_pnl"] / data["cost_basis"] * 100)
            if data["cost_basis"] > 0
            else Decimal(0)
        )
        
        # Calculate percentage based on total value if available, otherwise use count
        if portfolio_id is not None and total_portfolio_value > 0:
            percentage = float(data["total_value"] / total_portfolio_value * 100)
        else:
            percentage = (data["count"] / total_assets * 100) if total_assets > 0 else 0
        
        # Build asset positions list if we have portfolio data
        asset_positions = []
        if portfolio_id is not None:
            type_total = data["total_value"]
            for asset_id in data["assets"]:
                if asset_id in positions_map:
                    pos = positions_map[asset_id]
                    asset_value = pos.market_value or Decimal(0)
                    asset_pct = float(asset_value / type_total * 100) if type_total > 0 else 0
                    asset_positions.append({
                        "asset_id": asset_id,
                        "total_value": float(asset_value),
                        "unrealized_pnl": float(pos.unrealized_pnl or Decimal(0)),
                        "percentage": asset_pct,
                    })
        
        result.append({
            "name": asset_type,
            "count": data["count"],
            "percentage": percentage,
            "total_value": float(data["total_value"]),
            "cost_basis": float(data["cost_basis"]),
            "unrealized_pnl": float(data["unrealized_pnl"]),
            "unrealized_pnl_pct": float(unrealized_pnl_pct),
            "asset_ids": data["assets"],
            "asset_positions": asset_positions,
        })
    
    # Sort by total value descending if we have portfolio data, otherwise by count
    if portfolio_id is not None:
        result.sort(key=lambda x: x["total_value"], reverse=True)
    else:
        result.sort(key=lambda x: x["count"], reverse=True)
    
    return result


@router.get("/distribution/industries")
async def get_industries_distribution(
    metrics_service: MetricsServiceDep,
    portfolio_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get distribution of assets by industry with performance metrics
    
    Uses user-specific metadata overrides for classification.
    
    Returns aggregated data for each industry including:
    - Industry name
    - Asset count
    - Total market value (sum of all positions in this industry)
    - Cost basis (sum of all cost bases)
    - Unrealized P&L (sum of unrealized gains/losses)
    - Percentage of total assets
    - List of asset IDs in this industry
    
    Optionally filter by portfolio_id to get industry distribution for a specific portfolio.
    """
    from collections import defaultdict
    
    # Get all held assets (with optional portfolio filter and user-specific overrides)
    held_assets_data = await get_held_assets(portfolio_id=portfolio_id, current_user=current_user, db=db)
    
    # If we have a portfolio_id, get positions for that portfolio
    positions_map = {}
    if portfolio_id is not None:
        positions = await metrics_service.get_positions(portfolio_id)
        # Also get sold positions which might still have data
        sold_positions = await metrics_service.get_sold_positions_only(portfolio_id)
        all_positions = positions + sold_positions
        positions_map = {pos.asset_id: pos for pos in all_positions}
    
    # Group by industry
    industry_data = defaultdict(lambda: {
        "assets": [],
        "count": 0,
        "total_value": Decimal(0),
        "cost_basis": Decimal(0),
        "unrealized_pnl": Decimal(0),
    })
    
    total_assets = len(held_assets_data)
    total_portfolio_value = Decimal(0)
    
    # Calculate total portfolio value if we have positions
    if portfolio_id is not None:
        total_portfolio_value = sum(
            (positions_map[asset["id"]].market_value or Decimal(0))
            for asset in held_assets_data
            if asset["id"] in positions_map
        )
    
    for asset in held_assets_data:
        # Use effective_industry which includes user-specific overrides
        industry = asset.get("effective_industry") or "Unknown"
        industry_data[industry]["assets"].append(asset["id"])
        industry_data[industry]["count"] += 1
        
        # Add position data if available
        if portfolio_id is not None and asset["id"] in positions_map:
            pos = positions_map[asset["id"]]
            industry_data[industry]["total_value"] += pos.market_value or Decimal(0)
            industry_data[industry]["cost_basis"] += pos.cost_basis or Decimal(0)
            industry_data[industry]["unrealized_pnl"] += pos.unrealized_pnl or Decimal(0)
    
    # Convert to list format
    result = []
    for industry, data in industry_data.items():
        unrealized_pnl_pct = (
            (data["unrealized_pnl"] / data["cost_basis"] * 100)
            if data["cost_basis"] > 0
            else Decimal(0)
        )
        
        # Calculate percentage based on total value if available, otherwise use count
        if portfolio_id is not None and total_portfolio_value > 0:
            percentage = float(data["total_value"] / total_portfolio_value * 100)
        else:
            percentage = (data["count"] / total_assets * 100) if total_assets > 0 else 0
        
        result.append({
            "name": industry,
            "count": data["count"],
            "percentage": percentage,
            "total_value": float(data["total_value"]),
            "cost_basis": float(data["cost_basis"]),
            "unrealized_pnl": float(data["unrealized_pnl"]),
            "unrealized_pnl_pct": float(unrealized_pnl_pct),
            "asset_ids": data["assets"],
        })
    
    # Sort by total value descending if we have portfolio data, otherwise by count
    if portfolio_id is not None:
        result.sort(key=lambda x: x["total_value"], reverse=True)
    else:
        result.sort(key=lambda x: x["count"], reverse=True)
    
    return result


@router.get("/distribution/sectors/{sector_name}/industries")
async def get_sector_industries_distribution(
    sector_name: str,
    metrics_service: MetricsServiceDep,
    portfolio_id: int | None = None, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get distribution of industries within a specific sector with performance metrics
    
    Returns aggregated data for each industry in the specified sector including:
    - Industry name
    - Asset count
    - Total market value (sum of all positions in this industry)
    - Cost basis (sum of all cost bases)
    - Unrealized P&L (sum of unrealized gains/losses)
    - Percentage of sector total
    - List of asset IDs in this industry
    
    Optionally filter by portfolio_id.
    """
    from collections import defaultdict
    from urllib.parse import unquote
    
    # Decode the sector name from URL encoding
    sector_name = unquote(sector_name)
    
    # Get all held assets for the sector
    held_assets_data = await get_held_assets(portfolio_id=portfolio_id, current_user=current_user, db=db)
    
    # Filter by sector - use effective_sector to include user-specific overrides
    sector_assets = [a for a in held_assets_data if (a.get("effective_sector") or "Unknown") == sector_name]
    
    if not sector_assets:
        return []
    
    # If we have a portfolio_id, get positions for that portfolio
    positions_map = {}
    if portfolio_id is not None:
        positions = await metrics_service.get_positions(portfolio_id)
        sold_positions = await metrics_service.get_sold_positions_only(portfolio_id)
        all_positions = positions + sold_positions
        positions_map = {pos.asset_id: pos for pos in all_positions}
    
    # Group by industry within this sector
    industry_data = defaultdict(lambda: {
        "assets": [],
        "count": 0,
        "total_value": Decimal(0),
        "cost_basis": Decimal(0),
        "unrealized_pnl": Decimal(0),
    })
    
    sector_total_value = Decimal(0)
    
    # Calculate sector total value if we have positions
    if portfolio_id is not None:
        sector_total_value = sum(
            (positions_map[asset["id"]].market_value or Decimal(0))
            for asset in sector_assets
            if asset["id"] in positions_map
        )
    
    for asset in sector_assets:
        # Use effective_industry which includes user-specific overrides
        industry = asset.get("effective_industry") or "Unknown"
        industry_data[industry]["assets"].append(asset["id"])
        industry_data[industry]["count"] += 1
        
        # Add position data if available
        if portfolio_id is not None and asset["id"] in positions_map:
            pos = positions_map[asset["id"]]
            industry_data[industry]["total_value"] += pos.market_value or Decimal(0)
            industry_data[industry]["cost_basis"] += pos.cost_basis or Decimal(0)
            industry_data[industry]["unrealized_pnl"] += pos.unrealized_pnl or Decimal(0)
    
    # Convert to list format
    result = []
    for industry, data in industry_data.items():
        unrealized_pnl_pct = (
            (data["unrealized_pnl"] / data["cost_basis"] * 100)
            if data["cost_basis"] > 0
            else Decimal(0)
        )
        
        # Calculate percentage based on sector total value if available, otherwise use count
        if portfolio_id is not None and sector_total_value > 0:
            percentage = float(data["total_value"] / sector_total_value * 100)
        else:
            percentage = (data["count"] / len(sector_assets) * 100) if len(sector_assets) > 0 else 0
        
        # Build asset positions list if we have portfolio data
        asset_positions = []
        if portfolio_id is not None:
            industry_total = data["total_value"]
            for asset_id in data["assets"]:
                if asset_id in positions_map:
                    pos = positions_map[asset_id]
                    asset_value = pos.market_value or Decimal(0)
                    asset_pct = float(asset_value / industry_total * 100) if industry_total > 0 else 0
                    asset_positions.append({
                        "asset_id": asset_id,
                        "total_value": float(asset_value),
                        "unrealized_pnl": float(pos.unrealized_pnl or Decimal(0)),
                        "percentage": asset_pct,
                    })
        
        result.append({
            "name": industry,
            "count": data["count"],
            "percentage": percentage,
            "total_value": float(data["total_value"]),
            "cost_basis": float(data["cost_basis"]),
            "unrealized_pnl": float(data["unrealized_pnl"]),
            "unrealized_pnl_pct": float(unrealized_pnl_pct),
            "asset_ids": data["assets"],
            "asset_positions": asset_positions,
        })
    
    # Sort by total value descending if we have portfolio data, otherwise by count
    if portfolio_id is not None:
        result.sort(key=lambda x: x["total_value"], reverse=True)
    else:
        result.sort(key=lambda x: x["count"], reverse=True)
    
    return result


@router.get("/{asset_id}/prices")
def get_asset_price_history(
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
        raise AssetNotFoundError(id=asset_id)
    
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
        raise InvalidPriceHistoryPeriodError(period=period)
    
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
def get_asset_price_health(asset_id: int, db: Session = Depends(get_db)):
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
        raise AssetNotFoundError(id=asset_id)
    
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


@router.get("/{asset_id}/yfinance")
def get_yfinance_data(
    asset_id: int = None, 
    symbol: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get raw yfinance data for an asset
    
    Fetches all available data from yfinance Ticker.info and returns it as-is.
    Useful for debugging and seeing what data Yahoo Finance provides for this asset.
    
    Can be called with either:
    - /assets/{asset_id}/yfinance - Fetch for an asset in the database
    - /assets/0/yfinance?symbol=AAPL - Fetch for any symbol (even if not in DB)
    """
    # Determine the symbol to fetch
    asset_in_db = None
    fetch_symbol = symbol
    
    if asset_id and asset_id > 0:
        # Try to get asset from database
        asset_in_db = crud.get_asset(db, asset_id)
        if not asset_in_db and not symbol:
            raise AssetNotFoundInDatabaseError(id=asset_id)
        if asset_in_db:
            fetch_symbol = asset_in_db.symbol
    
    if not fetch_symbol:
        raise InvalidAssetIDOrSymbolError()
    
    try:
        # Fetch ticker info from yfinance
        ticker = yf.Ticker(fetch_symbol)
        
        # Get the info dict - this contains all metadata
        info = ticker.info
        
        # Helper function to convert timestamps to strings
        def serialize_data(obj):
            """Convert pandas Timestamp and other non-serializable objects to JSON-serializable format"""
            import pandas as pd
            import numpy as np
            from datetime import datetime, date
            
            # Check for arrays first (before isna check)
            if isinstance(obj, np.ndarray):
                return obj.tolist()
            
            # Check for pandas/numpy scalar types
            if isinstance(obj, (pd.Timestamp, datetime, date)):
                return obj.isoformat()
            elif isinstance(obj, (np.integer, np.floating)):
                return obj.item()
            
            # Check for NaN/None (only for scalar values)
            try:
                if pd.isna(obj):
                    return None
            except (ValueError, TypeError):
                # If pd.isna() fails (e.g., on non-scalar), continue
                pass
            
            # Handle collections
            if isinstance(obj, dict):
                return {k: serialize_data(v) for k, v in obj.items()}
            elif isinstance(obj, (list, tuple)):
                return [serialize_data(item) for item in obj]
            
            return obj
        
        # Serialize info dict
        info = serialize_data(info)
        
        # Get additional data structures
        try:
            # Try to get recent history (last 90 days)
            history = ticker.history(period="3mo")
            history_dict = {
                "columns": list(history.columns) if not history.empty else [],
                "index": [str(idx) for idx in history.index] if not history.empty else [],
                "data": [serialize_data(row.to_dict()) for _, row in history.iterrows()] if not history.empty else []
            }
        except Exception as e:
            logger.error(f"Failed to fetch history for {fetch_symbol}: {str(e)}")
            history_dict = {"error": str(e)}
        
        # Try to get calendar data
        try:
            calendar = ticker.calendar
            if calendar is not None:
                if hasattr(calendar, 'to_dict'):
                    calendar_dict = serialize_data(calendar.to_dict())
                else:
                    calendar_dict = serialize_data(str(calendar))
            else:
                calendar_dict = None
        except Exception as e:
            logger.error(f"Failed to fetch calendar for {fetch_symbol}: {str(e)}")
            calendar_dict = {"error": str(e)}
        
        # Try to get recommendations
        try:
            recommendations = ticker.recommendations
            if recommendations is not None and not recommendations.empty:
                recommendations_dict = {
                    "data": [serialize_data(row.to_dict()) for _, row in recommendations.iterrows()]
                }
            else:
                recommendations_dict = None
        except Exception as e:
            logger.error(f"Failed to fetch recommendations for {fetch_symbol}: {str(e)}")
            recommendations_dict = {"error": str(e)}
        
        # Try to get institutional holders
        try:
            institutional_holders = ticker.institutional_holders
            if institutional_holders is not None and not institutional_holders.empty:
                institutional_holders_dict = {
                    "data": [serialize_data(row.to_dict()) for _, row in institutional_holders.iterrows()]
                }
            else:
                institutional_holders_dict = None
        except Exception as e:
            logger.error(f"Failed to fetch institutional_holders for {fetch_symbol}: {str(e)}")
            institutional_holders_dict = {"error": str(e)}
        
        # Try to get major holders
        try:
            major_holders = ticker.major_holders
            if major_holders is not None and not major_holders.empty:
                major_holders_dict = {
                    "data": [serialize_data(row.to_dict()) for _, row in major_holders.iterrows()]
                }
            else:
                major_holders_dict = None
        except Exception as e:
            logger.error(f"Failed to fetch major_holders for {fetch_symbol}: {str(e)}")
            major_holders_dict = {"error": str(e)}
        
        # Try to get dividends
        try:
            dividends = ticker.dividends
            if dividends is not None and not dividends.empty:
                dividends_dict = {
                    "data": {str(idx): serialize_data(val) for idx, val in dividends.items()}
                }
            else:
                dividends_dict = None
        except Exception as e:
            logger.error(f"Failed to fetch dividends for {fetch_symbol}: {str(e)}")
            dividends_dict = {"error": str(e)}
        
        # Try to get splits
        try:
            splits = ticker.splits
            if splits is not None and not splits.empty:
                splits_dict = {
                    "data": {str(idx): serialize_data(val) for idx, val in splits.items()}
                }
            else:
                splits_dict = None
        except Exception as e:
            logger.error(f"Failed to fetch splits for {fetch_symbol}: {str(e)}")
            splits_dict = {"error": str(e)}
        
        # Try to get actions (dividends + splits combined)
        try:
            actions = ticker.actions
            if actions is not None and not actions.empty:
                actions_dict = {
                    "columns": list(actions.columns),
                    "data": {str(idx): serialize_data(row.to_dict()) for idx, row in actions.iterrows()}
                }
            else:
                actions_dict = None
        except Exception as e:
            logger.error(f"Failed to fetch actions for {fetch_symbol}: {str(e)}")
            actions_dict = {"error": str(e)}
        
        return {
            "asset_id": asset_in_db.id if asset_in_db else None,
            "symbol": fetch_symbol,
            "name": asset_in_db.name if asset_in_db else info.get('longName') or info.get('shortName'),
            "in_database": asset_in_db is not None,
            "fetched_at": datetime.utcnow().isoformat(),
            "info": info,
            "recent_history": history_dict,
            "calendar": calendar_dict,
            "recommendations": recommendations_dict,
            "institutional_holders": institutional_holders_dict,
            "major_holders": major_holders_dict,
            "dividends": dividends_dict,
            "splits": splits_dict,
            "actions": actions_dict,
        }
    except Exception as e:
        logger.error(f"Failed to fetch yfinance data for {fetch_symbol}: {str(e)}", exc_info=True)
        raise FailedToFetchYahooFinanceDataError(symbol=fetch_symbol, reason=str(e))




