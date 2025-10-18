"""
Assets router
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import Asset, AssetCreate
from app.crud import assets as crud
import yfinance as yf

router = APIRouter()

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
    - Total quantity held across all portfolios
    - Number of portfolios holding this asset
    """
    from sqlalchemy import func
    from app.models import Asset, Transaction, TransactionType
    
    # Calculate total quantity per asset
    from sqlalchemy import case
    
    subquery = (
        db.query(
            Transaction.asset_id,
            func.sum(
                case(
                    (Transaction.type == TransactionType.BUY, Transaction.quantity),
                    (Transaction.type == TransactionType.SELL, -Transaction.quantity),
                    (Transaction.type == TransactionType.TRANSFER_IN, Transaction.quantity),
                    (Transaction.type == TransactionType.TRANSFER_OUT, -Transaction.quantity),
                    else_=0
                )
            ).label("total_quantity"),
            func.count(func.distinct(Transaction.portfolio_id)).label("portfolio_count")
        )
        .group_by(Transaction.asset_id)
        .subquery()
    )
    
    # Join with assets table to get asset details
    results = (
        db.query(
            Asset,
            subquery.c.total_quantity,
            subquery.c.portfolio_count
        )
        .join(subquery, Asset.id == subquery.c.asset_id)
        .filter(subquery.c.total_quantity > 0)
        .order_by(Asset.symbol)
        .all()
    )
    
    return [
        {
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
            "portfolio_count": portfolio_count,
            "created_at": asset.created_at,
            "updated_at": asset.updated_at
        }
        for asset, total_quantity, portfolio_count in results
    ]


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
    
    # Calculate total quantity per asset
    from sqlalchemy import case
    
    subquery = (
        db.query(
            Transaction.asset_id,
            func.sum(
                case(
                    (Transaction.type == TransactionType.BUY, Transaction.quantity),
                    (Transaction.type == TransactionType.SELL, -Transaction.quantity),
                    (Transaction.type == TransactionType.TRANSFER_IN, Transaction.quantity),
                    (Transaction.type == TransactionType.TRANSFER_OUT, -Transaction.quantity),
                    else_=0
                )
            ).label("total_quantity"),
            func.count(func.distinct(Transaction.portfolio_id)).label("portfolio_count")
        )
        .group_by(Transaction.asset_id)
        .subquery()
    )
    
    # Join with assets table to get asset details
    results = (
        db.query(
            Asset,
            subquery.c.total_quantity,
            subquery.c.portfolio_count
        )
        .join(subquery, Asset.id == subquery.c.asset_id)
        .filter(subquery.c.total_quantity == 0)
        .order_by(Asset.symbol)
        .all()
    )
    
    return [
        {
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
            "portfolio_count": portfolio_count,
            "created_at": asset.created_at,
            "updated_at": asset.updated_at
        }
        for asset, total_quantity, portfolio_count in results
    ]


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
async def resolve_logo(symbol: str, name: Optional[str] = None):
    """
    Resolve the best available logo for a symbol and redirect to it.

    Tries direct ticker first; if the image is empty/invalid, use Brandfetch
    search with the FULL company name and redirect to the first result.
    If nothing is found, return 404 (no placeholder generation).

    Query params:
    - name: Optional company name to improve search quality.
    """
    # Lazy imports to avoid import-time issues
    from app.services.logos import (
        fetch_logo_direct,
        is_valid_image,
        brandfetch_search,
    )

    # 1) Try direct ticker logo and validate it's not transparent
    data = fetch_logo_direct(symbol)
    if data and is_valid_image(data):
        response = RedirectResponse(url=f"https://cdn.brandfetch.io/{symbol}", status_code=307)
        # Cache for 7 days (public, immutable)
        response.headers["Cache-Control"] = "public, max-age=604800, immutable"
        return response


    # 2) If invalid/transparent: search by normalized company name (remove suffixes) and take FIRST item
    def strip_company_suffix(company_name: str) -> str:
        suffixes = [
            "inc.", "inc", "corporation", "corp.", "corp", "ltd.", "ltd", "limited", "llc", "l.l.c.",
            "plc", "p.l.c.", "ag", "s.a.", "s.a", "n.v.", "nv", "gmbh", "co.", "and company", "& co.",
            "asa", "a.s.a.", "as", "ab", "oyj", "s.p.a.", "spa", "sa", "se", "usd", "us dollar", "eur", "gbp", "jpy"
        ]
        name = company_name.strip()
        lowered = name.lower()
        for suffix in suffixes:
            if lowered.endswith(" " + suffix):
                return name[:-(len(suffix)+1)].strip()
            if lowered.endswith(suffix):  # also match if no space (rare)
                return name[: -len(suffix)].strip()
        return name

    if name:
        normalized_name = strip_company_suffix(name)
        results = brandfetch_search(normalized_name)
        if results and isinstance(results, list) and len(results) > 0:
            first = results[0]
            brand_id = first.get('brandId')
            if brand_id:
                response = RedirectResponse(url=f"https://cdn.brandfetch.io/{brand_id}", status_code=307)
                # Cache for 7 days (public, immutable)
                response.headers["Cache-Control"] = "public, max-age=604800, immutable"
                return response

    # 3) Nothing found: return 404 (no generated placeholders)
    from fastapi.responses import JSONResponse
    response = JSONResponse(status_code=404, content={"detail": "Logo not found"})
    # Cache 404s for 1 minute to avoid hammering
    response.headers["Cache-Control"] = "public, max-age=60"
    return response
