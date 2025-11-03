"""
CRUD operations for assets
"""
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models import Asset
from app.schemas import AssetCreate


def get_asset(db: Session, asset_id: int) -> Optional[Asset]:
    """Get asset by ID"""
    return db.query(Asset).filter(Asset.id == asset_id).first()


def get_asset_by_symbol(db: Session, symbol: str) -> Optional[Asset]:
    """Get asset by symbol"""
    return db.query(Asset).filter(Asset.symbol == symbol).first()


def get_assets(
    db: Session, 
    skip: int = 0, 
    limit: int = 100,
    query: Optional[str] = None
) -> List[Asset]:
    """
    Get list of assets with optional search
    
    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return
        query: Search query for symbol or name
    """
    q = db.query(Asset)
    
    if query:
        search = f"%{query}%"
        q = q.filter(
            or_(
                Asset.symbol.ilike(search),
                Asset.name.ilike(search)
            )
        )
    
    return q.offset(skip).limit(limit).all()


def create_asset(db: Session, asset: AssetCreate) -> Asset:
    """Create new asset with enriched data from yfinance"""
    import yfinance as yf
    import re
    
    # Fetch additional info from yfinance
    ticker = yf.Ticker(asset.symbol)
    try:
        info = ticker.info
        sector = info.get('sector')
        industry = info.get('industry')
        asset_type = info.get('quoteType')  # 'EQUITY', 'ETF', 'CRYPTOCURRENCY', etc.
        country = info.get('country')
        # Get currency from yfinance if available
        currency = info.get('currency') or asset.currency
        # Prioritize yfinance data for name if asset.name is not provided or is just the symbol
        if not asset.name or asset.name == asset.symbol:
            name = info.get('longName') or info.get('shortName') or asset.symbol
            # Strip currency suffixes from cryptocurrency names (e.g., "Bitcoin USD" -> "Bitcoin")
            if asset_type and asset_type.upper() in ['CRYPTOCURRENCY', 'CRYPTO']:
                name = re.sub(r'\s+(USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY|USDT|BUSD)$', '', name, flags=re.IGNORECASE)
        else:
            name = asset.name
    except Exception:
        # If yfinance fails, use provided values
        sector = None
        industry = None
        asset_type = None
        country = None
        currency = asset.currency
        name = asset.name or asset.symbol
    
    db_asset = Asset(
        symbol=asset.symbol.upper(),
        name=name,
        currency=currency,
        class_=asset.class_,
        sector=sector,
        industry=industry,
        asset_type=asset_type,
        country=country
    )
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    return db_asset


def update_asset(db: Session, asset_id: int, asset: AssetCreate) -> Optional[Asset]:
    """Update existing asset"""
    db_asset = get_asset(db, asset_id)
    if not db_asset:
        return None
    
    db_asset.symbol = asset.symbol.upper()
    db_asset.name = asset.name
    db_asset.currency = asset.currency
    db_asset.class_ = asset.class_
    db_asset.sector = asset.sector
    db_asset.industry = asset.industry
    db_asset.asset_type = asset.asset_type
    
    db.commit()
    db.refresh(db_asset)
    return db_asset


def delete_asset(db: Session, asset_id: int) -> bool:
    """Delete asset"""
    db_asset = get_asset(db, asset_id)
    if not db_asset:
        return False
    
    db.delete(db_asset)
    db.commit()
    return True


def enrich_asset_metadata(db: Session, asset_id: int) -> Optional[Asset]:
    """Enrich asset with metadata from yfinance"""
    import yfinance as yf
    import re
    
    db_asset = get_asset(db, asset_id)
    if not db_asset:
        return None
    
    try:
        ticker = yf.Ticker(db_asset.symbol)
        info = ticker.info
        # Update metadata if not already set or if name is same as symbol
        if not db_asset.sector:
            db_asset.sector = info.get('sector')
        if not db_asset.industry:
            db_asset.industry = info.get('industry')
        if not db_asset.asset_type:
            db_asset.asset_type = info.get('quoteType')
        if not db_asset.country:
            db_asset.country = info.get('country')
        # Update currency from yfinance if available (always update to correct currency from source)
        yf_currency = info.get('currency')
        if yf_currency:
            db_asset.currency = yf_currency
        
        # Check if name needs updating
        needs_name_update = (not db_asset.name or 
                           db_asset.name == db_asset.symbol or 
                           db_asset.name.upper() == db_asset.symbol.upper())
        
        # Also update if cryptocurrency name has currency suffix
        is_crypto_with_suffix = False
        if db_asset.asset_type and db_asset.asset_type.upper() in ['CRYPTOCURRENCY', 'CRYPTO'] and db_asset.name:
            is_crypto_with_suffix = bool(re.search(r'\s+(USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY|USDT|BUSD)$', db_asset.name, flags=re.IGNORECASE))
        
        # Always update name if it's missing, matches symbol, or is crypto with suffix
        if needs_name_update or is_crypto_with_suffix:
            yf_name = info.get('longName') or info.get('shortName')
            if yf_name:
                # Strip currency suffixes from cryptocurrency names
                asset_type = db_asset.asset_type or info.get('quoteType')
                if asset_type and asset_type.upper() in ['CRYPTOCURRENCY', 'CRYPTO']:
                    yf_name = re.sub(r'\s+(USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY|USDT|BUSD)$', '', yf_name, flags=re.IGNORECASE)
                db_asset.name = yf_name
        db.commit()
        db.refresh(db_asset)
        return db_asset
    except Exception as e:
        # If yfinance fails, log and return asset unchanged
        print(f"Failed to enrich asset {db_asset.symbol}: {str(e)}")
        return db_asset


def enrich_all_assets(db: Session) -> dict:
    """Enrich all assets with metadata from yfinance"""
    import yfinance as yf
    import re
    
    assets = db.query(Asset).all()
    enriched = 0
    failed = []
    
    for asset in assets:
        try:
            # Check if name needs updating (if it matches the symbol)
            needs_name_update = (not asset.name or 
                               asset.name == asset.symbol or 
                               asset.name.upper() == asset.symbol.upper())
            
            # Also check if cryptocurrency name has currency suffix that needs stripping
            is_crypto_with_suffix = False
            if asset.asset_type and asset.asset_type.upper() in ['CRYPTOCURRENCY', 'CRYPTO'] and asset.name:
                is_crypto_with_suffix = bool(re.search(r'\s+(USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY|USDT|BUSD)$', asset.name, flags=re.IGNORECASE))
            
            # Skip if already has all metadata and name doesn't need updating
            if (asset.sector and asset.industry and asset.asset_type and 
                asset.country and not needs_name_update and not is_crypto_with_suffix):
                continue
            
            ticker = yf.Ticker(asset.symbol)
            info = ticker.info
            updated = False
            
            if not asset.sector and info.get('sector'):
                asset.sector = info.get('sector')
                updated = True
            if not asset.industry and info.get('industry'):
                asset.industry = info.get('industry')
                updated = True
            if not asset.asset_type and info.get('quoteType'):
                asset.asset_type = info.get('quoteType')
                updated = True
            if not asset.country and info.get('country'):
                asset.country = info.get('country')
                updated = True
            # Update currency from yfinance if available (always update to correct currency from source)
            yf_currency = info.get('currency')
            if yf_currency and asset.currency != yf_currency:
                asset.currency = yf_currency
                updated = True
            # Always update name if it's missing or just the symbol, or if it's a crypto with currency suffix
            if needs_name_update or is_crypto_with_suffix:
                yf_name = info.get('longName') or info.get('shortName')
                if yf_name:
                    # Strip currency suffixes from cryptocurrency names
                    asset_type = asset.asset_type or info.get('quoteType')
                    if asset_type and asset_type.upper() in ['CRYPTOCURRENCY', 'CRYPTO']:
                        yf_name = re.sub(r'\s+(USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY|USDT|BUSD)$', '', yf_name, flags=re.IGNORECASE)
                    asset.name = yf_name
                    updated = True
            if updated:
                enriched += 1
        except Exception as e:
            failed.append(f"{asset.symbol}: {str(e)}")
    
    db.commit()
    
    return {
        "total": len(assets),
        "enriched": enriched,
        "failed": failed
    }


def cache_logo(
    db: Session, 
    asset_id: int, 
    logo_data: bytes, 
    content_type: str
) -> Optional[Asset]:
    """
    Cache logo data in the database for an asset
    
    Args:
        db: Database session
        asset_id: Asset ID
        logo_data: Logo image bytes
        content_type: MIME type (e.g., 'image/webp', 'image/svg+xml')
        
    Returns:
        Updated asset or None if not found
    """
    db_asset = get_asset(db, asset_id)
    if not db_asset:
        return None
    
    # Store binary data directly
    db_asset.logo_data = logo_data
    db_asset.logo_content_type = content_type
    db_asset.logo_fetched_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_asset)
    return db_asset


def get_cached_logo(db: Session, asset_id: int) -> Optional[tuple[bytes, str]]:
    """
    Get cached logo data for an asset
    
    Args:
        db: Database session
        asset_id: Asset ID
        
    Returns:
        Tuple of (logo_data, content_type) or None if not cached
    """
    db_asset = get_asset(db, asset_id)
    if not db_asset or not db_asset.logo_data:
        return None
    
    return (db_asset.logo_data, db_asset.logo_content_type or 'image/webp')
