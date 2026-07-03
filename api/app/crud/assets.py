"""
CRUD operations for assets
"""
import logging
import re
from decimal import Decimal
from typing import Any, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.errors import InvalidAssetSymbolError
from app.models import Asset
from app.schemas import AssetCreate, AssetInvestmentNoteUpdate

logger = logging.getLogger(__name__)


_CRYPTO_CURRENCY_SUFFIX_RE = re.compile(
    r"\s+(USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY|USDT|BUSD)$",
    flags=re.IGNORECASE,
)


def _strip_crypto_currency_suffix(name: str) -> str:
    return _CRYPTO_CURRENCY_SUFFIX_RE.sub("", name)


def _decimal_or_none(value: Any) -> Optional[Decimal]:
    if value is None:
        return None
    try:
        parsed = Decimal(str(value))
    except Exception:
        return None
    return parsed if parsed > 0 else None


def update_asset_market_cap_from_info(asset: Asset, info: Any) -> bool:
    """Persist provider market-cap metadata on an asset when available."""
    if not isinstance(info, dict):
        return False

    market_cap = _decimal_or_none(info.get("marketCap"))
    if market_cap is None:
        return False

    market_cap_currency = (
        info.get("financialCurrency")
        or info.get("currency")
        or getattr(asset, "currency", None)
        or "USD"
    )
    market_cap_currency = str(market_cap_currency).upper()[:3]
    market_cap_usd = market_cap if market_cap_currency == "USD" else None

    if market_cap_currency != "USD":
        try:
            from app.services.market_data.currency import CurrencyService

            converted = CurrencyService.convert(market_cap, market_cap_currency, "USD")
            if converted is not None:
                market_cap_usd = converted
        except Exception as exc:
            logger.warning(
                "Failed to convert market cap for %s from %s to USD: %s",
                getattr(asset, "symbol", None),
                market_cap_currency,
                exc,
            )

    asset.market_cap = market_cap
    asset.market_cap_currency = market_cap_currency
    asset.market_cap_usd = market_cap_usd
    asset.market_cap_fetched_at = datetime.utcnow()
    return True


def is_valid_provider_info(symbol: str, info: Any) -> bool:
    """
    Return whether Yahoo returned enough metadata to trust asset creation.

    yfinance may raise on 404s, but some bad symbols can return sparse placeholder
    dictionaries. Do not create an asset unless the provider gives an identity
    field that real instruments normally have.
    """
    if not isinstance(info, dict) or not info:
        return False

    quote_type = str(info.get("quoteType") or "").strip().upper()
    if quote_type and quote_type not in {"NONE", "UNKNOWN"}:
        return True

    for name_field in ("longName", "shortName"):
        name = info.get(name_field)
        if isinstance(name, str) and name.strip():
            return True

    provider_symbol = info.get("symbol")
    if isinstance(provider_symbol, str) and provider_symbol.strip():
        return any(
            info.get(field) is not None
            for field in ("regularMarketPrice", "previousClose", "currency")
        )

    return False


def _invalid_symbol_reason(exc: Exception) -> str:
    message = str(exc).strip()
    if not message:
        message = exc.__class__.__name__
    return f"Yahoo Finance did not return usable metadata ({message})"


def is_provider_not_found_error(exc: Exception) -> bool:
    """Best-effort detection for provider-confirmed missing symbols."""
    message = str(exc).lower()
    return any(
        marker in message
        for marker in (
            "404",
            "not found",
            "quote not found",
            "symbol may be delisted",
        )
    )


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
    from app.services.market_data.yahoo_finance import get_market_data_provider, yahoo_timeout_seconds
    from app.services.reference_data.adanos_listings import lookup_adanos_isin
    from app.utils.isin import normalize_isin

    symbol = asset.symbol.strip().upper()
    
    # Fetch additional info from yfinance
    try:
        provider = get_market_data_provider()
        info = provider.get_info(
            symbol,
            action="asset_create_info",
            timeout_seconds=yahoo_timeout_seconds(),
        )
    except Exception as exc:
        logger.warning("Rejecting asset creation for %s: provider lookup failed: %s", symbol, exc)
        raise InvalidAssetSymbolError(symbol, _invalid_symbol_reason(exc))

    if not is_valid_provider_info(symbol, info):
        logger.warning("Rejecting asset creation for %s: provider returned sparse info: %s", symbol, info)
        raise InvalidAssetSymbolError(symbol, "Yahoo Finance returned no usable metadata")

    sector = info.get('sector')
    industry = info.get('industry')
    asset_type = info.get('quoteType') or asset.asset_type  # 'EQUITY', 'ETF', 'CRYPTOCURRENCY', etc.
    country = info.get('country')
    # Get currency from yfinance if available
    currency = info.get('currency') or asset.currency
    # Prioritize yfinance data for name if asset.name is not provided or is just the symbol
    if not asset.name or asset.name.strip().upper() == symbol:
        name = info.get('longName') or info.get('shortName') or symbol
    else:
        name = asset.name
    # Strip currency suffixes from cryptocurrency names (e.g., "Bitcoin USD" -> "Bitcoin")
    if asset_type and asset_type.upper() in ['CRYPTOCURRENCY', 'CRYPTO']:
        name = _strip_crypto_currency_suffix(name)

    # ISIN: Adanos is checked first -- it has proven more reliable than
    # yfinance's ISIN scrape for some symbols (e.g. yfinance returns a
    # Canadian ISIN for GOOGL where Adanos has the correct US one). Yahoo's
    # 'isin' field (rarely populated, defensive check only) is a fallback.
    isin = lookup_adanos_isin(db, symbol, asset_type=asset_type, name=name)
    if not isin:
        isin = normalize_isin(info.get('isin'))

    db_asset = Asset(
        symbol=symbol,
        name=name,
        currency=currency,
        class_=asset.class_,
        sector=sector,
        industry=industry,
        asset_type=asset_type,
        country=country,
        isin=isin,
    )
    update_asset_market_cap_from_info(db_asset, info)
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
    db_asset.country = asset.country
    if asset.market_cap is not None:
        db_asset.market_cap = asset.market_cap
        db_asset.market_cap_currency = asset.market_cap_currency or db_asset.currency
        db_asset.market_cap_usd = asset.market_cap_usd
        db_asset.market_cap_fetched_at = asset.market_cap_fetched_at or datetime.utcnow()
    
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
    import re
    from app.services.market_data.yahoo_finance import get_market_data_provider, yahoo_timeout_seconds
    from app.services.reference_data.adanos_listings import lookup_adanos_isin
    from app.utils.isin import normalize_isin

    db_asset = get_asset(db, asset_id)
    if not db_asset:
        return None
    
    try:
        provider = get_market_data_provider()
        info = provider.get_info(
            db_asset.symbol,
            action="asset_enrich_info",
            timeout_seconds=yahoo_timeout_seconds(),
        )
        # Update metadata ONLY if not already set
        if not db_asset.sector:
            db_asset.sector = info.get('sector')
        if not db_asset.industry:
            db_asset.industry = info.get('industry')
        if not db_asset.asset_type:
            db_asset.asset_type = info.get('quoteType')
        if not db_asset.country:
            db_asset.country = info.get('country')
        # ISIN: never overwrite an already-valid one. Adanos is checked first
        # (more reliable than yfinance's ISIN scrape for some symbols), then
        # Yahoo's info dict defensively as a fallback.
        if not normalize_isin(db_asset.isin):
            candidate_isin = lookup_adanos_isin(
                db, db_asset.symbol, asset_type=db_asset.asset_type, name=db_asset.name
            ) or normalize_isin(info.get('isin'))
            if candidate_isin:
                db_asset.isin = candidate_isin
        update_asset_market_cap_from_info(db_asset, info)
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
            elif is_crypto_with_suffix:
                # If yfinance didn't return a name, just strip the suffix from existing name
                db_asset.name = re.sub(r'\s+(USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY|USDT|BUSD)$', '', db_asset.name, flags=re.IGNORECASE)
        db.commit()
        db.refresh(db_asset)
        return db_asset
    except Exception as e:
        # If yfinance fails, log and return asset unchanged
        print(f"Failed to enrich asset {db_asset.symbol}: {str(e)}")
        return db_asset


def enrich_all_assets(db: Session) -> dict:
    """Enrich all assets with metadata from yfinance"""
    import re
    from app.services.market_data.yahoo_finance import get_market_data_provider, yahoo_timeout_seconds
    
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
                asset.country and asset.market_cap and not needs_name_update and not is_crypto_with_suffix):
                continue
            
            provider = get_market_data_provider()
            info = provider.get_info(
                asset.symbol,
                action="asset_enrich_all_info",
                timeout_seconds=yahoo_timeout_seconds(),
            )
            updated = False
            
            # Only update fields if they're not set
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
            if update_asset_market_cap_from_info(asset, info):
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
    content_type: str,
    provider: Optional[str] = None,
) -> Optional[Asset]:
    """
    Cache logo data in the database for an asset

    Args:
        db: Database session
        asset_id: Asset ID
        logo_data: Logo image bytes
        content_type: MIME type (e.g., 'image/webp', 'image/svg+xml')
        provider: Optional logo provider label (e.g. 'brandfetch'). When
            given, also sets Asset.logo_provider; omit to leave it untouched.

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
    if provider is not None:
        db_asset.logo_provider = provider

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


def get_user_asset_override(db: Session, user_id: int, asset_id: int):
    """
    Get user-specific metadata override for an asset
    
    Args:
        db: Database session
        user_id: User ID
        asset_id: Asset ID
        
    Returns:
        AssetMetadataOverride or None if not found
    """
    from app.models import AssetMetadataOverride
    
    return (
        db.query(AssetMetadataOverride)
        .filter(
            AssetMetadataOverride.user_id == user_id,
            AssetMetadataOverride.asset_id == asset_id
        )
        .first()
    )


def set_asset_metadata_overrides(
    db: Session,
    user_id: int,
    asset_id: int,
    sector_override: Optional[str] = None,
    industry_override: Optional[str] = None,
    country_override: Optional[str] = None
):
    """
    Set user-specific metadata overrides for an asset.
    
    Overrides can only be set when the corresponding Yahoo Finance field is None.
    This ensures overrides are only used as a fallback when Yahoo Finance doesn't provide data.
    Overrides are user-specific - each user can have their own classification preferences.
    
    Passing None will CLEAR that specific override field.
    If all fields become None, the entire override record is deleted.
    
    Args:
        db: Database session
        user_id: User ID
        asset_id: Asset ID
        sector_override: Override for sector (None to clear)
        industry_override: Override for industry (None to clear)
        country_override: Override for country (None to clear)
        
    Returns:
        Updated or created AssetMetadataOverride, or None if all overrides cleared
        
    Raises:
        ValueError: If attempting to set a non-None override when Yahoo Finance data exists
    """
    from app.models import AssetMetadataOverride
    
    # Verify asset exists
    db_asset = get_asset(db, asset_id)
    if not db_asset:
        raise ValueError(f"Asset {asset_id} not found")
    
    # Validate: only allow setting NON-NULL overrides when Yahoo Finance data is None
    # Null values are allowed (they clear the override)
    if sector_override is not None and sector_override.strip() and db_asset.sector is not None:
        raise ValueError(
            f"Cannot set sector override: Yahoo Finance already provides sector '{db_asset.sector}'. "
            "Overrides can only be set when Yahoo Finance data is missing."
        )
    
    if industry_override is not None and industry_override.strip() and db_asset.industry is not None:
        raise ValueError(
            f"Cannot set industry override: Yahoo Finance already provides industry '{db_asset.industry}'. "
            "Overrides can only be set when Yahoo Finance data is missing."
        )
    
    if country_override is not None and country_override.strip() and db_asset.country is not None:
        raise ValueError(
            f"Cannot set country override: Yahoo Finance already provides country '{db_asset.country}'. "
            "Overrides can only be set when Yahoo Finance data is missing."
        )
    
    # Get existing override record
    override = get_user_asset_override(db, user_id, asset_id)
    
    if override is None:
        # Only create new record if at least one override has a value
        if (sector_override and sector_override.strip()) or \
           (industry_override and industry_override.strip()) or \
           (country_override and country_override.strip()):
            override = AssetMetadataOverride(
                user_id=user_id,
                asset_id=asset_id,
                sector_override=sector_override if sector_override and sector_override.strip() else None,
                industry_override=industry_override if industry_override and industry_override.strip() else None,
                country_override=country_override if country_override and country_override.strip() else None
            )
            db.add(override)
            db.commit()
            db.refresh(override)
            return override
        else:
            # All values are None/empty, nothing to create
            return None
    else:
        # Update existing override record - always update all fields
        override.sector_override = sector_override if sector_override and sector_override.strip() else None
        override.industry_override = industry_override if industry_override and industry_override.strip() else None
        override.country_override = country_override if country_override and country_override.strip() else None
        
        # If all overrides are now None, delete the record entirely
        if not override.sector_override and not override.industry_override and not override.country_override:
            db.delete(override)
            db.commit()
            return None
        
        db.commit()
        db.refresh(override)
    return override


def get_effective_asset_metadata(db: Session, asset: Asset, user_id: int) -> dict:
    """
    Get effective metadata for an asset including user-specific overrides
    
    Args:
        db: Database session
        asset: Asset object
        user_id: User ID
        
    Returns:
        Dict with effective_sector, effective_industry, effective_country
    """
    # Get user's overrides if they exist
    override = get_user_asset_override(db, user_id, asset.id)
    
    return {
        "effective_sector": asset.sector if asset.sector is not None else (override.sector_override if override else None),
        "effective_industry": asset.industry if asset.industry is not None else (override.industry_override if override else None),
        "effective_country": asset.country if asset.country is not None else (override.country_override if override else None),
        "sector_override": override.sector_override if override else None,
        "industry_override": override.industry_override if override else None,
        "country_override": override.country_override if override else None,
    }


def get_asset_investment_note(db: Session, user_id: int, asset_id: int):
    """Get a user's investment note for an asset."""
    from app.models import AssetInvestmentNote

    return (
        db.query(AssetInvestmentNote)
        .filter(
            AssetInvestmentNote.user_id == user_id,
            AssetInvestmentNote.asset_id == asset_id,
        )
        .first()
    )


def upsert_asset_investment_note(
    db: Session,
    user_id: int,
    asset_id: int,
    note: AssetInvestmentNoteUpdate,
):
    """Create or update a user's investment note for an asset."""
    from app.models import AssetInvestmentNote

    db_asset = get_asset(db, asset_id)
    if not db_asset:
        return None

    db_note = get_asset_investment_note(db, user_id, asset_id)
    update_data = note.model_dump()

    if db_note is None:
        db_note = AssetInvestmentNote(user_id=user_id, asset_id=asset_id, **update_data)
        db.add(db_note)
    else:
        for field, value in update_data.items():
            setattr(db_note, field, value)

    db.commit()
    db.refresh(db_note)
    return db_note


def delete_asset_investment_note(db: Session, user_id: int, asset_id: int) -> bool:
    """Delete a user's investment note for an asset."""
    db_note = get_asset_investment_note(db, user_id, asset_id)
    if not db_note:
        return False

    db.delete(db_note)
    db.commit()
    return True
