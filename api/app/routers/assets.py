"""
Assets router
"""
from typing import Any, Dict, List, Optional
from decimal import Decimal
from datetime import datetime
import logging
import json
import time
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import Response
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.config import settings
from app.db import SessionLocal, get_db
from app.schemas import (
    Asset,
    AssetCreate,
    AssetInvestmentNote,
    AssetInvestmentNoteUpdate,
    AssetInvalidProviderCleanupRequest,
    AssetMetadataOverride,
    AssetResearchBusiness,
    AssetEtfCompositionResponse,
    AssetResearchFundamentals,
    AssetResearchMetadata,
    AssetResearchOwnership,
    AssetResearchRelativePerformance,
    AssetResearchRisk,
    AssetResearchSummaryResponse,
    AssetThemeClassification,
    AssetThemeClassifyRequest,
    AssetThemeClassifyResponse,
    AssetThemeTaxonomySuggestion,
    AssetThemeTaxonomySuggestionStats,
    AssetThemeTaxonomySuggestionUpdate,
    AssetWithOverrides,
)
from app.crud import assets as crud
from app.crud.assets import normalize_asset_type
from app.auth import get_current_admin_user, get_current_user
from app.models import Asset as AssetModel, AssetThemeTaxonomySuggestion as AssetThemeTaxonomySuggestionModel, User
from app.dependencies import MetricsServiceDep
from app.services.platform.cache import CacheService
from app.services.market_data.yahoo_finance import (
    YahooUnavailableError,
    call_yahoo,
    get_market_data_provider,
    yahoo_timeout_seconds,
)
from app.services.asset_intelligence.asset_research import AssetResearchService
from app.services.asset_intelligence.asset_themes import ALLOWED_THEME_HIERARCHY, AssetThemeService
from app.services.asset_intelligence.asset_theme_benchmark import (
    build_classification_benchmark_report,
    build_taxonomy_gap_report,
    serialize_theme_registry,
)
from app.services.market_data.fundamentals import FundamentalsService
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

router = APIRouter()
logger = logging.getLogger(__name__)
cache_service = CacheService()
logger = logging.getLogger(__name__)
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_optional_current_user(
    token: Optional[str] = Depends(optional_oauth2_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if not token:
        return None

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("user_id")
    except JWTError:
        return None

    if user_id is None:
        return None

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        return None
    return user


def _asset_market_cap_bucket(asset: AssetModel) -> str:
    market_cap = asset.market_cap_usd or asset.market_cap
    if market_cap is not None:
        parsed_market_cap = Decimal(str(market_cap))
        if parsed_market_cap >= Decimal("200000000000"):
            return "Mega Cap"
        if parsed_market_cap >= Decimal("10000000000"):
            return "Large Cap"
        if parsed_market_cap >= Decimal("2000000000"):
            return "Mid Cap"
        if parsed_market_cap >= Decimal("300000000"):
            return "Small Cap"
        if parsed_market_cap > 0:
            return "Micro Cap"

    asset_type = (asset.asset_type or "").upper()
    if asset_type in {"ETF", "FUND", "MUTUALFUND", "MUTUAL_FUND"}:
        return "Funds / ETFs"
    if asset_type in {"CRYPTO", "CRYPTOCURRENCY"}:
        return "Crypto assets"
    return "Market cap unavailable"


@router.get("/themes/hierarchy")
def get_theme_hierarchy() -> Dict[str, List[str]]:
    """Return the allowed theme hierarchy used by the classifier."""
    return {theme: list(subthemes) for theme, subthemes in ALLOWED_THEME_HIERARCHY.items()}


@router.get("/themes/registry")
def get_theme_registry(
    _current_user: User = Depends(get_current_admin_user),
) -> Dict[str, Any]:
    """Return taxonomy definitions used by MiniLM evaluation tooling."""
    return serialize_theme_registry()


@router.get("/themes/classification-benchmark")
def get_classification_benchmark(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    symbols: Optional[str] = Query(default=None),
    retrieved_candidate_limit: int = Query(default=10, ge=1, le=50),
    _current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Run a read-only MiniLM benchmark against stored Gemini classifications."""
    symbol_list = [
        item.strip().upper()
        for item in (symbols or "").split(",")
        if item.strip()
    ] or None
    try:
        return build_classification_benchmark_report(
            db,
            limit=limit,
            offset=offset,
            symbols=symbol_list,
            retrieved_candidate_limit=retrieved_candidate_limit,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.get("/themes/gap-analysis")
def get_theme_gap_analysis(
    _current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return taxonomy assignment coverage and frequent gap suggestions."""
    return build_taxonomy_gap_report(db)


def _serialize_taxonomy_suggestion(
    suggestion: AssetThemeTaxonomySuggestionModel,
) -> Dict[str, Any]:
    asset = suggestion.asset
    return {
        "id": suggestion.id,
        "asset_id": suggestion.asset_id,
        "symbol": suggestion.symbol,
        "company_name": suggestion.company_name,
        "sector": suggestion.sector,
        "industry": suggestion.industry,
        "summary_hash": suggestion.summary_hash,
        "summary_excerpt": suggestion.summary_excerpt,
        "suggested_theme": suggestion.suggested_theme,
        "suggested_subthemes": suggestion.suggested_subthemes or [],
        "reason": suggestion.reason,
        "confidence": float(suggestion.confidence) if suggestion.confidence is not None else 0,
        "status": suggestion.status,
        "reviewer_note": suggestion.reviewer_note,
        "current_themes": asset.themes if asset else [],
        "created_at": suggestion.created_at,
        "updated_at": suggestion.updated_at,
        "reviewed_at": suggestion.reviewed_at,
    }


def _taxonomy_gap_response(gap: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not gap or not gap.get("hasGap"):
        return None
    return gap


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


def _decimal_or_zero(value: Any) -> Decimal:
    if value is None:
        return Decimal(0)
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal(0)


def _extract_theme_weights(themes: Optional[List[Any]]) -> List[tuple[str, Decimal, List[str]]]:
    """Return de-duplicated top-level theme labels with normalized allocation weights."""
    extracted: List[tuple[str, Optional[Decimal], List[str]]] = []
    seen_labels: set[str] = set()

    for raw_theme in themes or []:
        if isinstance(raw_theme, dict):
            theme_payload = raw_theme.get("theme") if isinstance(raw_theme.get("theme"), dict) else raw_theme
            raw_label = theme_payload.get("label")
            raw_weight = theme_payload.get("weight", raw_theme.get("weight"))
            raw_children = theme_payload.get("children", raw_theme.get("children", []))
        else:
            raw_label = getattr(raw_theme, "label", None)
            raw_weight = getattr(raw_theme, "weight", None)
            raw_children = getattr(raw_theme, "children", [])

        if raw_label is None:
            continue
        label = str(raw_label).strip()
        if not label:
            continue

        normalized_label = label.casefold()
        if normalized_label in seen_labels:
            continue

        weight = None
        if raw_weight is not None:
            parsed_weight = _decimal_or_zero(raw_weight)
            if parsed_weight > 0:
                weight = parsed_weight

        seen_labels.add(normalized_label)
        subthemes: List[str] = []
        seen_subthemes: set[str] = set()
        for raw_child in raw_children or []:
            if isinstance(raw_child, dict):
                raw_child_label = raw_child.get("label")
            else:
                raw_child_label = getattr(raw_child, "label", None)
            if raw_child_label is None:
                continue
            child_label = str(raw_child_label).strip()
            normalized_child = child_label.casefold()
            if child_label and normalized_child not in seen_subthemes:
                seen_subthemes.add(normalized_child)
                subthemes.append(child_label)

        extracted.append((label, weight, subthemes))

    if not extracted:
        return []

    if all(weight is not None for _, weight, _ in extracted):
        total_weight = sum(weight for _, weight, _ in extracted if weight is not None)
        if total_weight > 0:
            return [
                (label, (weight or Decimal(0)) / total_weight, subthemes)
                for label, weight, subthemes in extracted
            ]

    equal_weight = Decimal(1) / Decimal(len(extracted))
    return [(label, equal_weight, subthemes) for label, _, subthemes in extracted]


def calculate_theme_allocation(positions) -> List[Dict[str, Any]]:
    """
    Compute portfolio theme allocation from already-loaded positions and their themes.

    Allocation method:
    - use stored theme.weight values when all top-level themes have weights
    - otherwise split equally across asset themes
    - no themes => 100% to Unclassified
    """
    theme_totals: Dict[str, Dict[str, Any]] = {}
    total_portfolio_value = Decimal(0)

    for position in positions:
        market_value_raw = getattr(position, "market_value", None)
        if market_value_raw is None:
            continue

        market_value = Decimal(str(market_value_raw))
        if market_value <= 0:
            continue

        cost_basis = _decimal_or_zero(getattr(position, "cost_basis", None))
        unrealized_pnl = _decimal_or_zero(getattr(position, "unrealized_pnl", None))
        total_portfolio_value += market_value

        weighted_themes = _extract_theme_weights(getattr(position, "themes", None))
        if not weighted_themes:
            weighted_themes = [("Unclassified", Decimal(1), [])]

        symbol = getattr(position, "symbol", "") or ""
        name = getattr(position, "name", None) or symbol
        asset_key = f"{symbol}|{name}"

        for label, weight, subthemes in weighted_themes:
            contribution_value = market_value * weight
            contribution_cost_basis = cost_basis * weight
            contribution_unrealized_pnl = unrealized_pnl * weight
            if label not in theme_totals:
                theme_totals[label] = {
                    "value": Decimal(0),
                    "cost_basis": Decimal(0),
                    "unrealized_pnl": Decimal(0),
                    "assets": {},
                    "subthemes": {},
                }

            theme_totals[label]["value"] += contribution_value
            theme_totals[label]["cost_basis"] += contribution_cost_basis
            theme_totals[label]["unrealized_pnl"] += contribution_unrealized_pnl
            asset_contributions = theme_totals[label]["assets"]
            if asset_key not in asset_contributions:
                asset_contributions[asset_key] = {
                    "value": Decimal(0),
                    "cost_basis": Decimal(0),
                    "unrealized_pnl": Decimal(0),
                }
            asset_contributions[asset_key]["value"] += contribution_value
            asset_contributions[asset_key]["cost_basis"] += contribution_cost_basis
            asset_contributions[asset_key]["unrealized_pnl"] += contribution_unrealized_pnl

            if subthemes:
                subtheme_weight = Decimal(1) / Decimal(len(subthemes))
                subtheme_totals = theme_totals[label]["subthemes"]
                for subtheme_name in subthemes:
                    subtheme_value = contribution_value * subtheme_weight
                    subtheme_cost_basis = contribution_cost_basis * subtheme_weight
                    subtheme_unrealized_pnl = contribution_unrealized_pnl * subtheme_weight

                    if subtheme_name not in subtheme_totals:
                        subtheme_totals[subtheme_name] = {
                            "value": Decimal(0),
                            "cost_basis": Decimal(0),
                            "unrealized_pnl": Decimal(0),
                            "assets": {},
                        }

                    subtheme_totals[subtheme_name]["value"] += subtheme_value
                    subtheme_totals[subtheme_name]["cost_basis"] += subtheme_cost_basis
                    subtheme_totals[subtheme_name]["unrealized_pnl"] += subtheme_unrealized_pnl

                    subtheme_assets = subtheme_totals[subtheme_name]["assets"]
                    if asset_key not in subtheme_assets:
                        subtheme_assets[asset_key] = {
                            "value": Decimal(0),
                            "cost_basis": Decimal(0),
                            "unrealized_pnl": Decimal(0),
                        }
                    subtheme_assets[asset_key]["value"] += subtheme_value
                    subtheme_assets[asset_key]["cost_basis"] += subtheme_cost_basis
                    subtheme_assets[asset_key]["unrealized_pnl"] += subtheme_unrealized_pnl

    if total_portfolio_value <= 0:
        return []

    def build_contributing_assets(asset_payload: Dict[str, Dict[str, Decimal]]) -> List[Dict[str, Any]]:
        assets = []
        for asset_key, contributions in asset_payload.items():
            symbol, name = asset_key.split("|", 1)
            contribution_cost_basis = contributions["cost_basis"]
            contribution_unrealized_pnl = contributions["unrealized_pnl"]
            contribution_unrealized_pnl_pct = (
                (contribution_unrealized_pnl / contribution_cost_basis * Decimal(100))
                if contribution_cost_basis > 0
                else Decimal(0)
            )
            assets.append(
                {
                    "symbol": symbol,
                    "name": name,
                    "contribution_value": round(float(contributions["value"]), 2),
                    "contribution_cost_basis": round(float(contribution_cost_basis), 2),
                    "contribution_unrealized_pnl": round(float(contribution_unrealized_pnl), 2),
                    "contribution_unrealized_pnl_pct": round(float(contribution_unrealized_pnl_pct), 2),
                }
            )

        assets.sort(key=lambda item: item["contribution_value"], reverse=True)
        return assets

    allocations: List[Dict[str, Any]] = []
    for theme_name, payload in theme_totals.items():
        theme_value: Decimal = payload["value"]
        theme_cost_basis: Decimal = payload["cost_basis"]
        theme_unrealized_pnl: Decimal = payload["unrealized_pnl"]
        percentage = (theme_value / total_portfolio_value) * Decimal(100)
        theme_unrealized_pnl_pct = (
            (theme_unrealized_pnl / theme_cost_basis * Decimal(100))
            if theme_cost_basis > 0
            else Decimal(0)
        )

        subthemes = []
        for subtheme_name, subtheme_payload in payload["subthemes"].items():
            subtheme_value: Decimal = subtheme_payload["value"]
            subtheme_cost_basis: Decimal = subtheme_payload["cost_basis"]
            subtheme_unrealized_pnl: Decimal = subtheme_payload["unrealized_pnl"]
            subtheme_percentage = (
                (subtheme_value / theme_value * Decimal(100))
                if theme_value > 0
                else Decimal(0)
            )
            subtheme_unrealized_pnl_pct = (
                (subtheme_unrealized_pnl / subtheme_cost_basis * Decimal(100))
                if subtheme_cost_basis > 0
                else Decimal(0)
            )
            subthemes.append(
                {
                    "name": subtheme_name,
                    "value": round(float(subtheme_value), 2),
                    "percentage": round(float(subtheme_percentage), 2),
                    "cost_basis": round(float(subtheme_cost_basis), 2),
                    "unrealized_pnl": round(float(subtheme_unrealized_pnl), 2),
                    "unrealized_pnl_pct": round(float(subtheme_unrealized_pnl_pct), 2),
                    "assets": build_contributing_assets(subtheme_payload["assets"]),
                }
            )

        subthemes.sort(key=lambda item: item["value"], reverse=True)
        allocations.append(
            {
                "theme": theme_name,
                "value": round(float(theme_value), 2),
                "percentage": round(float(percentage), 2),
                "cost_basis": round(float(theme_cost_basis), 2),
                "unrealized_pnl": round(float(theme_unrealized_pnl), 2),
                "unrealized_pnl_pct": round(float(theme_unrealized_pnl_pct), 2),
                "assets": build_contributing_assets(payload["assets"]),
                "subthemes": subthemes,
            }
        )

    allocations.sort(key=lambda item: item["value"], reverse=True)
    return allocations


def _fetch_theme_company_info(asset):
    try:
        return FundamentalsService.fetch_info(asset.symbol, action="asset_theme_refresh_info")
    except Exception as exc:
        logger.warning("Asset theme company info failed for %s: %s", asset.symbol, exc)
        return {}


def _fetch_theme_company_info_timed(service: AssetThemeService, asset):
    started_at = time.perf_counter()
    info = _fetch_theme_company_info(asset)
    if crud.update_asset_market_cap_from_info(asset, info):
        service.db.commit()
        service.db.refresh(asset)
    service.record_external_timing(
        "Yahoo metadata",
        time.perf_counter() - started_at,
        metadata={
            "symbol": getattr(asset, "symbol", None),
            "fields": len(info or {}),
            "action": "asset_theme_refresh_info",
        },
    )
    return info


def _asset_reference_counts(db: Session, asset_ids: List[int]) -> Dict[int, Dict[str, int]]:
    counts = {
        asset_id: {
            "transaction_count": 0,
            "watchlist_count": 0,
            "pending_dividend_count": 0,
            "investment_note_count": 0,
            "metadata_override_count": 0,
        }
        for asset_id in asset_ids
    }
    if not asset_ids:
        return counts

    from app.models import (
        AssetInvestmentNote as AssetInvestmentNoteModel,
        AssetMetadataOverride as AssetMetadataOverrideModel,
        PendingDividend,
        Transaction,
        Watchlist,
    )

    count_queries = (
        ("transaction_count", Transaction.asset_id, Transaction.id),
        ("watchlist_count", Watchlist.asset_id, Watchlist.id),
        ("pending_dividend_count", PendingDividend.asset_id, PendingDividend.id),
        ("investment_note_count", AssetInvestmentNoteModel.asset_id, AssetInvestmentNoteModel.id),
        ("metadata_override_count", AssetMetadataOverrideModel.asset_id, AssetMetadataOverrideModel.id),
    )

    for count_key, asset_id_column, id_column in count_queries:
        rows = (
            db.query(asset_id_column, func.count(id_column))
            .filter(asset_id_column.in_(asset_ids))
            .group_by(asset_id_column)
            .all()
        )
        for asset_id, count in rows:
            counts[int(asset_id)][count_key] = int(count)

    return counts


def _has_asset_user_references(counts: Dict[str, int]) -> bool:
    return any(counts.get(key, 0) > 0 for key in counts)


def _serialize_asset_cleanup_candidate(
    asset: AssetModel,
    *,
    reason: Optional[str] = None,
    reference_counts: Optional[Dict[str, int]] = None,
) -> Dict[str, Any]:
    payload = {
        "id": asset.id,
        "symbol": asset.symbol,
        "name": asset.name,
        "asset_type": asset.asset_type,
        "created_at": asset.created_at.isoformat() if asset.created_at else None,
    }
    if reason is not None:
        payload["reason"] = reason
    if reference_counts is not None:
        payload.update(reference_counts)
    return payload


def _invalidate_asset_list_caches() -> None:
    cache_service.delete_pattern("assets_held:*")
    cache_service.delete_pattern("assets_sold:*")


def _refresh_asset_theme_background(asset_id: int) -> None:
    db = SessionLocal()
    try:
        from app.models import Asset

        asset = db.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            return
        if not AssetThemeService.is_theme_supported_asset(asset):
            logger.info(
                "Background asset theme generation skipped asset_id=%s symbol=%s reason=non_equity asset_type=%s",
                asset.id,
                asset.symbol,
                asset.asset_type,
            )
            return

        logger.info("Background asset theme generation starting asset_id=%s symbol=%s", asset.id, asset.symbol)
        service = AssetThemeService(db)
        company_info = _fetch_theme_company_info_timed(service, asset)
        service.refresh_classification(
            asset=asset,
            summary=company_info.get("longBusinessSummary") or company_info.get("description"),
            sector=company_info.get("sector") or asset.sector,
            industry=company_info.get("industry") or asset.industry,
            name=company_info.get("longName") or company_info.get("shortName") or asset.name,
        )
        logger.info("Background asset theme generation finished asset_id=%s symbol=%s", asset.id, asset.symbol)
        _invalidate_asset_list_caches()
    except Exception as exc:
        logger.warning("Background asset theme generation failed for asset %s: %s", asset_id, exc)
        db.rollback()
    finally:
        db.close()


def _needs_theme_generation(asset) -> bool:
    classification = getattr(asset, "theme_classification", None)
    if not classification:
        return True
    if AssetThemeService.classification_source(classification) == "manual":
        return False
    themes = classification.themes or []
    if themes and any(
        isinstance(theme, dict)
        and "children" not in theme
        and "subthemes" not in theme
        for theme in themes
    ):
        return True
    return not bool(themes)

# Live ticker search endpoint
@router.get("/search_ticker")
def search_ticker(query: str):
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
            raise SearchTickerError(status_code=response.status_code)
        data = response.json()
        # Return top 10 results with symbol, name, and type
        results = [
            {
                "symbol": item["symbol"], 
                "name": item.get("shortname", item.get("longname", "")),
                "type": item.get("quoteType", "")
            }
            for item in data.get("quotes", [])[:10]
        ]
        return results
    except requests.RequestException as e:
        raise FailedToConnectToYahooError(reason=str(e))


@router.get("/search")
def search_assets(query: str, crypto_only: bool = False):
    """
    Live search for assets using Yahoo Finance API
    - **query**: Partial ticker or company name
    - **crypto_only**: If True, only return cryptocurrency results
    Returns simplified results for conversion/swap UI
    """
    import requests
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    results = []
    seen_symbols = set()
    
    # For crypto_only, also try direct symbol lookup with -USD suffix
    if crypto_only:
        # Try common crypto symbol patterns
        crypto_symbols_to_try = [
            f"{query.upper()}-USD",
            f"{query.upper()}-USDT", 
            f"{query.upper()}-EUR",
            f"{query.upper()}-CAD",
        ]
        provider = get_market_data_provider()
        for crypto_symbol in crypto_symbols_to_try:
            try:
                info = provider.get_info(
                    crypto_symbol,
                    action="asset_search_info",
                    timeout_seconds=yahoo_timeout_seconds(),
                )
                if info and info.get("quoteType") == "CRYPTOCURRENCY":
                    symbol = info.get("symbol", crypto_symbol)
                    if symbol not in seen_symbols:
                        seen_symbols.add(symbol)
                        results.append({
                            "symbol": symbol,
                            "name": info.get("shortName", info.get("longName", symbol)),
                            "type": "CRYPTOCURRENCY"
                        })
            except Exception:
                pass
    
    # Also do Yahoo Finance search API
    url = f"https://query2.finance.yahoo.com/v1/finance/search?q={query}"
    try:
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            quotes = data.get("quotes", [])
            
            # Filter for crypto only if requested
            if crypto_only:
                quotes = [q for q in quotes if q.get("quoteType", "").upper() == "CRYPTOCURRENCY"]
            
            # Add results that we haven't seen yet
            for item in quotes[:10]:
                symbol = item["symbol"]
                if symbol not in seen_symbols:
                    seen_symbols.add(symbol)
                    results.append({
                        "symbol": symbol, 
                        "name": item.get("shortname", item.get("longname", "")),
                        "type": item.get("quoteType", "")
                    })
    except requests.RequestException:
        pass  # If search fails, we still have direct lookup results
    
    return results[:10]


def _fetch_screener_tickers(screener: str, count: int = 10) -> list[dict]:
    import yfinance as yf

    try:
        result = call_yahoo(
            lambda: yf.screen(screener, count=count),
            symbol=f"__{screener}__",
            action=f"{screener}_tickers",
            timeout_seconds=yahoo_timeout_seconds(),
        )
    except YahooUnavailableError:
        return []

    quotes = result.get("quotes", []) if isinstance(result, dict) else []
    provider = get_market_data_provider()
    exchange_country_map = {
        "NMS": ("United States", "US"),
        "NYQ": ("United States", "US"),
        "NAS": ("United States", "US"),
        "PCX": ("United States", "US"),
        "PAR": ("France", "FR"),
        "AMS": ("Netherlands", "NL"),
        "GER": ("Germany", "DE"),
        "LSE": ("United Kingdom", "GB"),
        "TOR": ("Canada", "CA"),
    }

    symbols = [quote.get("symbol") for quote in quotes[:count] if quote.get("symbol")]
    metadata_by_symbol = provider.get_info_batch(
        symbols,
        action="market_mover_info_batch",
        timeout_seconds=yahoo_timeout_seconds(),
    )

    results: list[dict] = []
    for quote in quotes[:count]:
        symbol = quote.get("symbol")
        if not symbol:
            continue

        market_metadata = metadata_by_symbol.get(symbol, {})
        exchange = (market_metadata.get("exchange") or quote.get("exchange") or "").strip().upper()
        fallback_country = exchange_country_map.get(exchange)
        results.append(
            {
                "symbol": symbol,
                "name": quote.get("shortName") or quote.get("longName") or symbol,
                "type": quote.get("quoteType", ""),
                "exchange": market_metadata.get("exchange") or quote.get("exchange"),
                "exchange_name": market_metadata.get("exchange_name")
                or quote.get("fullExchangeName")
                or quote.get("exchangeName"),
                "country": market_metadata.get("country") or (fallback_country[0] if fallback_country else None),
                "country_code": market_metadata.get("country_code") or (fallback_country[1] if fallback_country else None),
                "currency": market_metadata.get("currency") or quote.get("currency"),
                "daily_change_pct": quote.get("regularMarketChangePercent"),
            }
        )

    return results


def _fetch_trending_tickers() -> list[dict]:
    """
    US-market "trending" proxy: the most actively traded equities today.

    Yahoo's dedicated trending endpoint (/v1/finance/trending/{region}) ignores the
    region in the URL and geo-detects from the caller's egress IP instead, which made
    results wander (e.g. Toronto-listed tickers from a Canadian-routed host) regardless
    of the region we asked for. yfinance's screener takes an explicit US-exchange query
    instead, so results are stable no matter where this server runs.
    """
    return _fetch_screener_tickers("most_actives", count=10)


def _fetch_market_movers() -> dict[str, list[dict]]:
    # The three screener queries are independent network calls (~2s each);
    # run them concurrently so a cache miss costs one round-trip, not three.
    from concurrent.futures import ThreadPoolExecutor

    screeners = {"trending": "most_actives", "gainers": "day_gainers", "losers": "day_losers"}
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {
            key: pool.submit(_fetch_screener_tickers, query, count=10)
            for key, query in screeners.items()
        }
        return {key: future.result() for key, future in futures.items()}


# Market movers stale-while-revalidate:
# - fresh key keeps the existing 15-minute freshness semantics
# - stale key retains the last good payload for a day so expiry never makes
#   an interactive request wait ~3s on Yahoo screeners
# - the lock ensures only one process (API worker or Celery) refreshes at a time
_MARKET_MOVERS_CACHE_KEY = "market_movers:US"
_MARKET_MOVERS_STALE_KEY = "market_movers:US:stale"
_MARKET_MOVERS_TTL_SECONDS = 900
_MARKET_MOVERS_STALE_TTL_SECONDS = 24 * 3600
_MARKET_MOVERS_LOCK_KEY = "lock:market_movers_refresh"
_MARKET_MOVERS_LOCK_TTL_SECONDS = 120
_MARKET_MOVERS_COLD_POLL_ATTEMPTS = 20
_MARKET_MOVERS_COLD_POLL_INTERVAL_SECONDS = 0.2


def refresh_market_movers_cache() -> dict[str, list[dict]]:
    """Fetch movers from Yahoo and populate both cache generations.

    Empty results (provider outage) are returned but not cached, so a failed
    refresh never pins empty lists for the full TTL; the refresh lock still
    bounds retry pressure to one attempt per lock window.
    """
    movers = _fetch_market_movers()
    if any(movers.values()):
        CacheService.set(_MARKET_MOVERS_CACHE_KEY, movers, ttl=_MARKET_MOVERS_TTL_SECONDS)
        CacheService.set(_MARKET_MOVERS_STALE_KEY, movers, ttl=_MARKET_MOVERS_STALE_TTL_SECONDS)
    return movers


@router.get("/trending")
def get_trending_assets():
    """
    Trending (most active) US tickers.
    Cached for 15 minutes since composition doesn't need per-request freshness.
    """
    return CacheService.get_or_set("trending:US", _fetch_trending_tickers, ttl=900)


@router.get("/market-movers")
def get_market_movers():
    """
    Lightweight discovery lists from Yahoo screeners.

    Fresh for 15 minutes. On expiry the last known payload (up to a day old)
    is served immediately while a single background Celery refresh runs;
    only a truly cold cache performs the provider fetch in-request, deduped
    across workers by a short Redis lock.
    """
    fresh = CacheService.get(_MARKET_MOVERS_CACHE_KEY)
    if fresh is not None:
        return fresh

    stale = CacheService.get(_MARKET_MOVERS_STALE_KEY)
    if stale is not None:
        if CacheService.set(_MARKET_MOVERS_LOCK_KEY, True, ttl=_MARKET_MOVERS_LOCK_TTL_SECONDS, nx=True):
            try:
                from app.tasks.cache_tasks import refresh_market_movers

                refresh_market_movers.delay()
            except Exception:
                # Don't strand the lock if the broker is unavailable; the next
                # request after the TTL can try again.
                CacheService.delete(_MARKET_MOVERS_LOCK_KEY)
                logger.warning(
                    "Failed to enqueue market movers refresh",
                    extra={"event": "market_movers_refresh_enqueue_failed"},
                )
        return stale

    # Truly cold cache: one process fetches, concurrent requests briefly poll
    # for its result instead of stampeding Yahoo with duplicate screener calls.
    if CacheService.set(_MARKET_MOVERS_LOCK_KEY, True, ttl=_MARKET_MOVERS_LOCK_TTL_SECONDS, nx=True):
        try:
            return refresh_market_movers_cache()
        finally:
            CacheService.delete(_MARKET_MOVERS_LOCK_KEY)

    for _ in range(_MARKET_MOVERS_COLD_POLL_ATTEMPTS):
        time.sleep(_MARKET_MOVERS_COLD_POLL_INTERVAL_SECONDS)
        fresh = CacheService.get(_MARKET_MOVERS_CACHE_KEY)
        if fresh is not None:
            return fresh

    # Degraded but well-formed: same shape a full screener outage produces.
    return {"trending": [], "gainers": [], "losers": []}


@router.get("/by-symbol/{symbol}", response_model=Asset)
def get_asset_by_symbol(symbol: str, db: Session = Depends(get_db)):
    """Get asset by symbol"""
    asset = crud.get_asset_by_symbol(db, symbol.upper())
    if not asset:
        raise AssetNotFoundError(symbol)
    return asset


@router.get("/research/{symbol}/summary", response_model=AssetResearchSummaryResponse)
async def get_asset_research_summary(symbol: str, db: Session = Depends(get_db)):
    """Get the fast first payload for an asset research page."""
    service = AssetResearchService(db)
    return await service.get_summary(symbol)


@router.get("/research/{symbol}/fundamentals", response_model=AssetResearchFundamentals)
def get_asset_research_fundamentals(symbol: str, db: Session = Depends(get_db)):
    """Get asset fundamentals and valuation data."""
    service = AssetResearchService(db)
    return service.get_fundamentals(symbol)


@router.get("/research/{symbol}/business", response_model=AssetResearchBusiness)
def get_asset_research_business(symbol: str, db: Session = Depends(get_db)):
    """Get asset business profile data."""
    service = AssetResearchService(db)
    return service.get_business(symbol)


@router.get("/research/{symbol}/ownership", response_model=AssetResearchOwnership)
def get_asset_research_ownership(symbol: str, db: Session = Depends(get_db)):
    """Get asset ownership and short-interest data."""
    service = AssetResearchService(db)
    return service.get_ownership(symbol)


@router.get("/research/{symbol}/themes", response_model=AssetThemeClassification)
def get_asset_research_themes(symbol: str, db: Session = Depends(get_db)):
    """Get or refresh asset theme/exposure classification."""
    service = AssetResearchService(db)
    return service.get_themes(symbol)


@router.get("/research/{symbol}/risk", response_model=AssetResearchRisk)
async def get_asset_research_risk(symbol: str, db: Session = Depends(get_db)):
    """Get asset-level risk metrics."""
    service = AssetResearchService(db)
    return await service.get_risk(symbol)


@router.get("/research/{symbol}/performance", response_model=AssetResearchRelativePerformance)
async def get_asset_research_performance(symbol: str, db: Session = Depends(get_db)):
    """Get relative performance data for an asset."""
    service = AssetResearchService(db)
    return await service.get_relative_performance(symbol)


@router.get("/research/{symbol}/metadata", response_model=AssetResearchMetadata)
def get_asset_research_metadata(symbol: str, db: Session = Depends(get_db)):
    """Get ATH/ATL market metadata for an asset."""
    service = AssetResearchService(db)
    return service.get_metadata(symbol)


@router.get("/{symbol}/etf-composition", response_model=AssetEtfCompositionResponse)
def get_asset_etf_composition(
    symbol: str,
    portfolio_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """Get Yahoo Finance ETF composition data when available."""
    service = AssetResearchService(db)
    return service.get_etf_composition(
        symbol,
        portfolio_id=portfolio_id,
        user_id=current_user.id if current_user else None,
    )


@router.get("/themes/taxonomy-suggestions", response_model=List[AssetThemeTaxonomySuggestion])
def list_theme_taxonomy_suggestions(
    status_filter: str = Query(default="pending", alias="status", pattern="^(pending|accepted|rejected|ignored|all)$"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None),
    _current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """List taxonomy gap suggestions for admin review."""
    query = db.query(AssetThemeTaxonomySuggestionModel).join(AssetModel)
    if status_filter != "all":
        query = query.filter(AssetThemeTaxonomySuggestionModel.status == status_filter)
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                AssetThemeTaxonomySuggestionModel.symbol.ilike(like),
                AssetThemeTaxonomySuggestionModel.company_name.ilike(like),
                AssetThemeTaxonomySuggestionModel.suggested_theme.ilike(like),
                AssetThemeTaxonomySuggestionModel.reason.ilike(like),
            )
        )

    suggestions = (
        query.order_by(AssetThemeTaxonomySuggestionModel.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_serialize_taxonomy_suggestion(suggestion) for suggestion in suggestions]


@router.get("/themes/taxonomy-suggestions/stats", response_model=AssetThemeTaxonomySuggestionStats)
def get_theme_taxonomy_suggestion_stats(
    _current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Return review counts and top taxonomy suggestions."""
    suggestions = db.query(AssetThemeTaxonomySuggestionModel).all()
    counts = {"pending": 0, "accepted": 0, "rejected": 0, "ignored": 0}
    theme_counts: Dict[str, int] = {}
    subtheme_counts: Dict[str, int] = {}

    for suggestion in suggestions:
        counts[suggestion.status] = counts.get(suggestion.status, 0) + 1
        theme_counts[suggestion.suggested_theme] = theme_counts.get(suggestion.suggested_theme, 0) + 1
        for subtheme in suggestion.suggested_subthemes or []:
            if isinstance(subtheme, str):
                subtheme_counts[subtheme] = subtheme_counts.get(subtheme, 0) + 1

    top_themes = [
        {"label": label, "count": count}
        for label, count in sorted(theme_counts.items(), key=lambda item: (-item[1], item[0]))[:10]
    ]
    top_subthemes = [
        {"label": label, "count": count}
        for label, count in sorted(subtheme_counts.items(), key=lambda item: (-item[1], item[0]))[:10]
    ]
    return {
        "counts_by_status": counts,
        "top_suggested_themes": top_themes,
        "top_suggested_subthemes": top_subthemes,
    }


@router.patch("/themes/taxonomy-suggestions/{suggestion_id}", response_model=AssetThemeTaxonomySuggestion)
def update_theme_taxonomy_suggestion(
    suggestion_id: int,
    payload: AssetThemeTaxonomySuggestionUpdate,
    _current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Mark a taxonomy suggestion as accepted, rejected, or ignored."""
    suggestion = (
        db.query(AssetThemeTaxonomySuggestionModel)
        .filter(AssetThemeTaxonomySuggestionModel.id == suggestion_id)
        .first()
    )
    if not suggestion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Taxonomy suggestion not found")

    suggestion.status = payload.status
    suggestion.reviewer_note = payload.reviewer_note
    suggestion.reviewed_at = datetime.utcnow()
    suggestion.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(suggestion)
    return _serialize_taxonomy_suggestion(suggestion)


def _get_or_create_classifiable_asset(db: Session, symbol: str) -> AssetModel:
    """Return an existing asset or create it from provider metadata for classification."""
    asset = crud.get_asset_by_symbol(db, symbol)
    if asset:
        return asset
    return crud.create_asset(db, AssetCreate(symbol=symbol))


@router.post("/themes/classify", response_model=AssetThemeClassifyResponse)
def classify_asset_themes(
    payload: AssetThemeClassifyRequest,
    _current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Classify one or more assets and collect taxonomy gap suggestions for review."""
    service = AssetThemeService(db)
    results: List[Dict[str, Any]] = []
    classified = 0
    skipped = 0
    failed = 0

    symbols = []
    seen_symbols: set[str] = set()
    for raw_symbol in payload.symbols:
        symbol = raw_symbol.strip().upper()
        if symbol and symbol not in seen_symbols:
            seen_symbols.add(symbol)
            symbols.append(symbol)

    for symbol in symbols:
        try:
            asset = _get_or_create_classifiable_asset(db, symbol)
            if not AssetThemeService.is_theme_supported_asset(asset):
                skipped += 1
                results.append({
                    "symbol": asset.symbol,
                    "status": "skipped",
                    "company_name": asset.name,
                    "themes": [],
                    "taxonomy_gap": None,
                    "skipped_reason": "non_equity_asset",
                })
                continue

            existing = service.get_classification(asset.id)
            if payload.missing_only and existing and existing.themes and not payload.force:
                skipped += 1
                results.append({
                    "symbol": asset.symbol,
                    "status": "skipped",
                    "company_name": asset.name,
                    "themes": existing.themes or [],
                    "taxonomy_gap": None,
                    "skipped_reason": "existing_classification",
                })
                continue

            company_info = _fetch_theme_company_info_timed(service, asset)
            classification = service.refresh_classification(
                asset=asset,
                summary=company_info.get("longBusinessSummary") or company_info.get("description"),
                sector=company_info.get("sector") or asset.sector,
                industry=company_info.get("industry") or asset.industry,
                name=company_info.get("longName") or company_info.get("shortName") or asset.name,
                force=payload.force,
            )
            if service.last_classification_unavailable_reason and not classification.themes:
                skipped += 1
                results.append({
                    "symbol": asset.symbol,
                    "status": "skipped",
                    "company_name": asset.name,
                    "themes": [],
                    "taxonomy_gap": None,
                    "skipped_reason": "classification_unavailable",
                })
                continue
            classified += 1
            results.append({
                "symbol": asset.symbol,
                "status": "classified",
                "company_name": asset.name,
                "themes": classification.themes or [],
                "taxonomy_gap": _taxonomy_gap_response(service.last_taxonomy_gap),
            })
        except Exception as exc:
            db.rollback()
            failed += 1
            logger.warning("Asset theme classification failed for %s: %s", symbol, exc)
            results.append({
                "symbol": symbol,
                "status": "failed",
                "company_name": None,
                "themes": [],
                "taxonomy_gap": None,
                "failure_reason": str(exc),
            })

    _invalidate_asset_list_caches()
    return {
        "total": len(symbols),
        "classified": classified,
        "skipped": skipped,
        "failed": failed,
        "results": results,
    }


@router.get("/{asset_id}/themes", response_model=AssetThemeClassification)
def get_asset_themes(
    asset_id: int,
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the stored global theme/exposure classification for an asset."""
    asset = crud.get_asset(db, asset_id)
    if not asset:
        raise AssetNotFoundError(id=asset_id)
    if not AssetThemeService.is_theme_supported_asset(asset):
        return AssetThemeService.empty_classification_for_asset(asset)

    service = AssetThemeService(db)
    classification = service.get_classification_for_fetch(
        asset,
        company_info_loader=lambda: _fetch_theme_company_info(asset),
    )
    if classification:
        return classification

    return {
        "id": None,
        "asset_id": asset.id,
        "themes": [],
        "method": "gpt",
        "model": None,
        "source": None,
        "model_name": None,
        "source_hash": None,
        "generated_at": None,
        "updated_at": None,
    }


@router.post("/{asset_id}/themes/refresh", response_model=AssetThemeClassification)
def refresh_asset_themes(
    asset_id: int,
    _current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Refresh an asset's global theme/exposure classification (admin only)."""
    asset = crud.get_asset(db, asset_id)
    if not asset:
        raise AssetNotFoundError(id=asset_id)
    if not AssetThemeService.is_theme_supported_asset(asset):
        return AssetThemeService.empty_classification_for_asset(asset)

    service = AssetThemeService(db)
    company_info = _fetch_theme_company_info_timed(service, asset)
    classification = service.refresh_classification(
        asset=asset,
        summary=company_info.get("longBusinessSummary") or company_info.get("description"),
        sector=company_info.get("sector") or asset.sector,
        industry=company_info.get("industry") or asset.industry,
        name=company_info.get("longName") or company_info.get("shortName") or asset.name,
        force=True,
    )
    _invalidate_asset_list_caches()
    return classification


@router.post("/themes/refresh-held")
def refresh_held_asset_themes(
    force: bool = Query(default=False, description="Force regeneration even when source_hash is unchanged"),
    _current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Refresh theme classifications for currently held assets (admin only)."""
    from app.models import Asset, Transaction, TransactionType

    asset_ids = [row[0] for row in db.query(Transaction.asset_id.distinct()).all()]
    service = AssetThemeService(db)
    refreshed = 0
    skipped = 0
    failed = 0

    for asset_id in asset_ids:
        transactions = (
            db.query(Transaction)
            .filter(Transaction.asset_id == asset_id)
            .order_by(Transaction.tx_date, Transaction.created_at)
            .all()
        )

        total_quantity = Decimal(0)
        for tx in transactions:
            if tx.type in [TransactionType.BUY, TransactionType.TRANSFER_IN, TransactionType.CONVERSION_IN]:
                total_quantity += tx.quantity
            elif tx.type in [TransactionType.SELL, TransactionType.TRANSFER_OUT, TransactionType.CONVERSION_OUT]:
                total_quantity -= tx.quantity
            elif tx.type == TransactionType.SPLIT:
                total_quantity *= _parse_split_ratio(tx.meta_data.get("split", "1:1") if tx.meta_data else "1:1")

        if total_quantity <= 0:
            skipped += 1
            continue

        asset = db.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            skipped += 1
            continue
        if not AssetThemeService.is_theme_supported_asset(asset):
            skipped += 1
            continue

        try:
            company_info = _fetch_theme_company_info_timed(service, asset)
            before = service.get_classification(asset.id)
            before_updated_at = before.updated_at if before else None
            classification = service.refresh_classification(
                asset=asset,
                summary=company_info.get("longBusinessSummary") or company_info.get("description"),
                sector=company_info.get("sector") or asset.sector,
                industry=company_info.get("industry") or asset.industry,
                name=company_info.get("longName") or company_info.get("shortName") or asset.name,
                force=force,
            )
            if before and before.id == classification.id and before_updated_at == classification.updated_at:
                skipped += 1
            else:
                refreshed += 1
        except Exception as exc:
            failed += 1
            logger.warning("Failed to refresh held asset themes for %s: %s", asset.symbol, exc)

    _invalidate_asset_list_caches()
    return {
        "refreshed": refreshed,
        "skipped": skipped,
        "failed": failed,
        "force": force,
    }


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


@router.get("/database/list")
def get_asset_database_list(
    query: Optional[str] = None,
    skip: int = 0,
    limit: int = Query(default=10000, ge=1, le=50000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return the full asset database for the developer assets list.

    Unlike the held/sold endpoints, this is based on the assets table itself, so
    assets created by research lookups are included even before any transaction
    exists for them.
    """
    q = db.query(AssetModel)

    if query:
        search = f"%{query}%"
        q = q.filter(or_(AssetModel.symbol.ilike(search), AssetModel.name.ilike(search)))

    assets = q.order_by(AssetModel.symbol).offset(skip).limit(limit).all()
    asset_ids = [asset.id for asset in assets]
    reference_counts = _asset_reference_counts(db, asset_ids)

    results = []
    for asset in assets:
        effective_data = crud.get_effective_asset_metadata(db, asset, current_user.id)
        themes_payload = asset.themes or AssetThemeService(db).get_themes(asset.id)
        counts = reference_counts.get(asset.id, {})

        results.append({
            "id": asset.id,
            "symbol": asset.symbol,
            "name": asset.name,
            "isin": asset.isin,
            "currency": asset.currency,
            "class": asset.class_.value if asset.class_ else None,
            "sector": asset.sector,
            "industry": asset.industry,
            "asset_type": asset.asset_type,
            "country": asset.country,
            "effective_sector": effective_data["effective_sector"],
            "effective_industry": effective_data["effective_industry"],
            "effective_country": effective_data["effective_country"],
            "themes": themes_payload,
            **counts,
            "first_transaction_date": asset.first_transaction_date.isoformat() if asset.first_transaction_date else None,
            "logo_fetched_at": asset.logo_fetched_at.isoformat() if asset.logo_fetched_at else None,
            "logo_content_type": asset.logo_content_type,
            "created_at": asset.created_at.isoformat() if asset.created_at else None,
            "updated_at": asset.updated_at.isoformat() if asset.updated_at else None,
        })

    return results


def _cleanup_invalid_provider_assets(
    db: Session,
    *,
    dry_run: bool,
    symbols: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Validate assets against Yahoo Finance and delete only provider-not-found rows
    that have no user-facing references.

    Assets are never deleted merely because they have no transactions or
    portfolios linked. yfinance sometimes logs a 404 internally but returns a
    sparse info dict instead of raising; those no-identity responses are treated
    as not-found cleanup candidates. Other provider failures are unresolved.
    """
    query = db.query(AssetModel)
    parsed_symbols: List[str] = []
    if symbols:
        parsed_symbols = [
            str(item).strip().upper()
            for item in symbols
            if str(item).strip()
        ]
        if parsed_symbols:
            query = query.filter(AssetModel.symbol.in_(parsed_symbols))

    assets = query.order_by(AssetModel.symbol).all()
    asset_ids = [asset.id for asset in assets]
    reference_counts = _asset_reference_counts(db, asset_ids)
    provider = get_market_data_provider()

    candidates: List[Dict[str, Any]] = []
    blocked: List[Dict[str, Any]] = []
    unresolved: List[Dict[str, Any]] = []
    valid_count = 0

    for asset in assets:
        reason: Optional[str] = None
        try:
            info = provider.get_info(
                asset.symbol,
                action="asset_invalid_provider_cleanup_info",
                timeout_seconds=yahoo_timeout_seconds(),
            )
            if crud.is_valid_provider_info(asset.symbol, info):
                valid_count += 1
                continue
            reason = "Yahoo Finance returned no identity metadata after quote lookup"
        except Exception as exc:
            reason = str(exc).strip() or exc.__class__.__name__
            if not crud.is_provider_not_found_error(exc):
                unresolved.append(
                    _serialize_asset_cleanup_candidate(
                        asset,
                        reason=reason,
                        reference_counts=reference_counts.get(asset.id, {}),
                    )
                )
                continue

        counts = reference_counts.get(asset.id, {})
        payload = _serialize_asset_cleanup_candidate(
            asset,
            reason=reason,
            reference_counts=counts,
        )
        if _has_asset_user_references(counts):
            blocked.append(payload)
        else:
            candidates.append(payload)

    if not dry_run and candidates:
        candidate_ids = [candidate["id"] for candidate in candidates]
        for asset in db.query(AssetModel).filter(AssetModel.id.in_(candidate_ids)).all():
            db.delete(asset)
        db.commit()
        _invalidate_asset_list_caches()

    return {
        "dry_run": dry_run,
        "scanned": len(assets),
        "valid": valid_count,
        "invalid": len(candidates) + len(blocked),
        "deleted": 0 if dry_run else len(candidates),
        "candidates": candidates,
        "blocked": blocked,
        "unresolved": unresolved,
    }


@router.post("/database/invalid-provider")
def cleanup_invalid_provider_assets(
    payload: AssetInvalidProviderCleanupRequest,
    _current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Body-based cleanup endpoint to avoid huge query strings in dev tools."""
    return _cleanup_invalid_provider_assets(
        db,
        dry_run=payload.dry_run,
        symbols=payload.symbols,
    )


@router.delete("/database/invalid-provider")
def delete_invalid_provider_assets(
    dry_run: bool = Query(default=True, description="Preview provider-invalid assets without deleting"),
    symbols: Optional[str] = Query(default=None, description="Optional comma-separated symbols to validate"),
    _current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Compatibility endpoint. Prefer POST with JSON body for large symbol sets."""
    parsed_symbols = symbols.split(",") if symbols else None
    return _cleanup_invalid_provider_assets(
        db,
        dry_run=dry_run,
        symbols=parsed_symbols,
    )


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
    
    new_asset = crud.create_asset(db, asset)
    
    # Trigger ATH fetch + ISIN/logo enrichment for the new asset in the background
    if settings.ENABLE_BACKGROUND_TASKS:
        try:
            from app.tasks.ath_tasks import backfill_ath_from_yfinance
            backfill_ath_from_yfinance.delay(asset_id=new_asset.id)
            logger.info(f"Triggered ATH backfill for new asset: {new_asset.symbol}")
        except Exception as e:
            logger.warning(f"Failed to trigger ATH backfill for {new_asset.symbol}: {e}")

        try:
            from app.tasks.logo_tasks import backfill_asset_logos
            backfill_asset_logos.delay(asset_id=new_asset.id)
            logger.info(f"Triggered logo/ISIN backfill for new asset: {new_asset.symbol}")
        except Exception as e:
            logger.warning(f"Failed to trigger logo backfill for {new_asset.symbol}: {e}")

    return new_asset


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
        
        # Invalidate cache for held and sold assets since effective metadata changed
        cache_service.delete_pattern(f"assets_held:{current_user.id}:*")
        cache_service.delete_pattern(f"assets_sold:{current_user.id}:*")
        
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


@router.get("/{asset_id}/investment-note", response_model=AssetInvestmentNote | None)
def get_investment_note(
    asset_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's investment thesis for an asset."""
    asset = crud.get_asset(db, asset_id)
    if not asset:
        raise AssetNotFoundError(id=asset_id)

    return crud.get_asset_investment_note(db, current_user.id, asset_id)


@router.put("/{asset_id}/investment-note", response_model=AssetInvestmentNote)
def save_investment_note(
    asset_id: int,
    note: AssetInvestmentNoteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create or replace the current user's investment thesis for an asset."""
    saved_note = crud.upsert_asset_investment_note(db, current_user.id, asset_id, note)
    if not saved_note:
        raise AssetNotFoundError(id=asset_id)

    return saved_note


@router.delete("/{asset_id}/investment-note", status_code=status.HTTP_204_NO_CONTENT)
def delete_investment_note(
    asset_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete the current user's investment thesis for an asset."""
    asset = crud.get_asset(db, asset_id)
    if not asset:
        raise AssetNotFoundError(id=asset_id)

    deleted = crud.delete_asset_investment_note(db, current_user.id, asset_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Investment note not found")


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    """Delete asset"""
    success = crud.delete_asset(db, asset_id)
    if not success:
        raise AssetNotFoundError(id=asset_id)


@router.get("/held/all")
async def get_held_assets(
    background_tasks: BackgroundTasks = None,
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
    
    Cached until next transaction is created/updated/deleted.
    """
    from sqlalchemy import func
    from app.models import Asset, Transaction, TransactionType
    from decimal import Decimal
    
    # Check cache
    cache_key = f"assets_held:{current_user.id}:{portfolio_id or 'all'}"
    cached = cache_service.get(cache_key)
    if cached:
        logger.debug(f"Cache HIT for held assets: {cache_key}")
        return json.loads(cached)
    
    logger.debug(f"Cache MISS for held assets: {cache_key}")
    
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
            
            if tx.type in [TransactionType.BUY, TransactionType.TRANSFER_IN, TransactionType.CONVERSION_IN]:
                total_quantity += tx.quantity
            elif tx.type in [TransactionType.SELL, TransactionType.TRANSFER_OUT, TransactionType.CONVERSION_OUT]:
                total_quantity -= tx.quantity
            elif tx.type == TransactionType.SPLIT:
                # Apply split ratio to current quantity
                split_ratio = _parse_split_ratio(tx.meta_data.get("split", "1:1") if tx.meta_data else "1:1")
                total_quantity *= split_ratio
        
        # Only include assets with positive quantity
        if total_quantity > 0:
            asset = db.query(Asset).filter(Asset.id == asset_id).first()
            if asset:
                if background_tasks is not None and _needs_theme_generation(asset):
                    background_tasks.add_task(_refresh_asset_theme_background, asset.id)

                # Count splits and buy/sell/conversion transactions (portfolio-specific if portfolio_id provided)
                split_count = sum(1 for tx in portfolio_transactions if tx.type == TransactionType.SPLIT)
                transaction_count = sum(1 for tx in portfolio_transactions if tx.type in [TransactionType.BUY, TransactionType.SELL, TransactionType.CONVERSION_IN, TransactionType.CONVERSION_OUT])
                
                # Get first transaction date (earliest BUY transaction)
                buy_transactions = [tx for tx in portfolio_transactions if tx.type == TransactionType.BUY]
                first_transaction_date = min([tx.tx_date for tx in buy_transactions]) if buy_transactions else None
                
                # Get user-specific effective metadata
                effective_data = crud.get_effective_asset_metadata(db, asset, current_user.id)
                themes_payload = asset.themes or AssetThemeService(db).get_themes(asset.id)
                
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
                    "themes": themes_payload,
                    "total_quantity": float(total_quantity),
                    "portfolio_count": len(portfolio_ids),
                    "split_count": split_count,
                    "transaction_count": transaction_count,
                    "first_transaction_date": first_transaction_date.isoformat() if first_transaction_date else None,
                    "logo_fetched_at": asset.logo_fetched_at.isoformat() if asset.logo_fetched_at else None,
                    "created_at": asset.created_at.isoformat() if asset.created_at else None,
                    "updated_at": asset.updated_at.isoformat() if asset.updated_at else None
                })
    
    # Sort by symbol
    results.sort(key=lambda x: x["symbol"])
    
    # Cache for 1 hour (invalidated on transaction changes)
    cache_service.set(cache_key, json.dumps(results), ttl=3600)
    
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
    
    Cached until next transaction is created/updated/deleted.
    """
    from sqlalchemy import func
    from app.models import Asset, Transaction, TransactionType
    from decimal import Decimal
    
    # Check cache
    cache_key = f"assets_sold:{current_user.id}:{portfolio_id or 'all'}"
    cached = cache_service.get(cache_key)
    if cached:
        logger.debug(f"Cache HIT for sold assets: {cache_key}")
        return json.loads(cached)
    
    logger.debug(f"Cache MISS for sold assets: {cache_key}")
    
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
            
            if tx.type in [TransactionType.BUY, TransactionType.TRANSFER_IN, TransactionType.CONVERSION_IN]:
                total_quantity += tx.quantity
            elif tx.type in [TransactionType.SELL, TransactionType.TRANSFER_OUT, TransactionType.CONVERSION_OUT]:
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
                transaction_count = sum(1 for tx in portfolio_transactions if tx.type in [TransactionType.BUY, TransactionType.SELL, TransactionType.CONVERSION_IN, TransactionType.CONVERSION_OUT])
                
                # Get first transaction date (earliest BUY transaction)
                buy_transactions = [tx for tx in portfolio_transactions if tx.type == TransactionType.BUY]
                first_transaction_date = min([tx.tx_date for tx in buy_transactions]) if buy_transactions else None
                
                # Get user-specific effective metadata
                effective_data = crud.get_effective_asset_metadata(db, asset, current_user.id)
                themes_payload = asset.themes or AssetThemeService(db).get_themes(asset.id)
                
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
                    "themes": themes_payload,
                    "total_quantity": float(total_quantity),
                    "portfolio_count": len(portfolio_ids),
                    "split_count": split_count,
                    "transaction_count": transaction_count,
                    "first_transaction_date": first_transaction_date.isoformat() if first_transaction_date else None,
                    "logo_fetched_at": asset.logo_fetched_at.isoformat() if asset.logo_fetched_at else None,
                    "created_at": asset.created_at.isoformat() if asset.created_at else None,
                    "updated_at": asset.updated_at.isoformat() if asset.updated_at else None
                })
    
    # Sort by symbol
    results.sort(key=lambda x: x["symbol"])
    
    # Cache for 1 hour (invalidated on transaction changes)
    cache_service.set(cache_key, json.dumps(results), ttl=3600)
    
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


# Cooldown for symbols whose full logo resolution found no provider logo.
# Short on purpose: a transiently unreachable provider must get another
# chance soon, while render-path requests stop hammering external APIs.
_LOGO_NEGATIVE_CACHE_TTL_SECONDS = 6 * 3600


@router.get("/logo/{symbol}")
def resolve_logo(
    symbol: str,
    name: Optional[str] = None,
    asset_type: Optional[str] = None,
    variant: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Fetch and return the best available logo for a symbol.

    Strategy:
    1. If the asset has a persisted ISIN, try Trade Republic first (proxied
       through this API) -- covers stocks, ETFs, funds, ETCs, ETNs alike.
    2. Check database cache for previously fetched provider logos (only
       trusted providers; 'generated' placeholders are never served from cache)
    3. Try direct ticker fetch and cache result
    4. Try API search with company name and cache result
    5. If all else fails, generate SVG fallback and negative-cache the
       resolution for a few hours so external providers are not re-queried
       on every render

    Returns the image data directly with aggressive caching headers.

    Query params:
    - name: Optional company name to improve search quality.
    - asset_type: Optional asset type (e.g., 'ETF', 'EQUITY', 'CRYPTO') to determine if generic logo should be used.
    - variant: Optional theme variant ('light' or 'dark') for Trade Republic logos.
    """
    # Lazy imports to avoid import-time issues
    from app.services.market_data.logos import fetch_logo_with_source
    from app.services.market_data.logo_resolver import resolve_asset_logo
    from app.crud import assets as crud_assets
    from fastapi.responses import Response
    import hashlib

    def image_response(logo_data: bytes, content_type: str, *, is_svg_fallback: bool = False) -> Response:
        response = Response(content=logo_data, media_type=content_type)
        if is_svg_fallback:
            # For SVG fallbacks, use short cache with must-revalidate so real logos can replace them
            response.headers["Cache-Control"] = "public, max-age=300, must-revalidate"
        else:
            # For real logos, use long cache with immutable
            response.headers["Cache-Control"] = "public, max-age=2592000, immutable"
        etag = hashlib.md5(logo_data).hexdigest()
        response.headers["ETag"] = f'"{etag}"'
        return response

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

    is_crypto = bool(effective_asset_type) and effective_asset_type.upper() in ('CRYPTO', 'CRYPTOCURRENCY')

    normalized_variant = "dark" if variant == "dark" else "light"
    resolution = None

    # Negative cache: when a completed resolution recently ended with no
    # provider logo (generated fallback), skip all external provider calls
    # for a cooldown period and serve the locally generated SVG instead.
    # Exceptions propagate without setting the key, so transient provider
    # failures are never negative-cached; only a completed "no logo found"
    # resolution is, and only for the short TTL below.
    negative_cache_key = f"logo:neg:{symbol.upper()}"
    resolution_cooldown = CacheService.exists(negative_cache_key)

    # Lazily resolve Trade Republic/Brandfetch/generated once per asset. This
    # never triggers the synchronous ISIN scrape (allow_isin_lookup=False) --
    # that only happens via the async backfill task/CLI. It does still run
    # the local Adanos ISIN lookup even when the asset has no ISIN yet
    # (resolve_asset_logo runs that unconditionally now), so a persisted
    # asset that simply hasn't been backfilled yet still gets a shot at
    # Trade Republic instead of being stuck requiring a pre-existing ISIN.
    if db_asset and not resolution_cooldown and db_asset.logo_provider not in ("trade_republic", "brandfetch", "logo_dev"):
        resolution = resolve_asset_logo(
            db,
            db_asset,
            allow_isin_lookup=False,
            name_hint=name,
            asset_type_hint=asset_type,
        )
        db.refresh(db_asset)
        if resolution.provider == "generated":
            CacheService.set(negative_cache_key, True, ttl=_LOGO_NEGATIVE_CACHE_TTL_SECONDS)

    if db_asset and db_asset.logo_provider == "trade_republic" and (db_asset.logo_light_url or db_asset.logo_dark_url):
        cached_tr_logo_data = crud_assets.get_cached_trade_republic_logo_variant(db_asset, normalized_variant)
        if cached_tr_logo_data:
            return image_response(cached_tr_logo_data, "image/svg+xml")

        tr_url = (
            (db_asset.logo_dark_url if normalized_variant == "dark" else db_asset.logo_light_url)
            or db_asset.logo_light_url
            or db_asset.logo_dark_url
        )
        from app.services.market_data.trade_republic_logos import fetch_trade_republic_logo_url

        tr_logo_data = fetch_trade_republic_logo_url(tr_url)
        if tr_logo_data:
            crud_assets.cache_trade_republic_logo_variant(
                db,
                db_asset.id,
                "dark" if tr_url == db_asset.logo_dark_url else "light",
                tr_logo_data,
            )
            return image_response(tr_logo_data, "image/svg+xml")

    # No persisted asset yet (e.g. a ticker search result the user hasn't
    # added anywhere) -- there's nothing to cache an ISIN/logo onto, but we
    # can still try Trade Republic for this one response via the same fast,
    # local Adanos lookup, instead of skipping straight to Brandfetch/generated.
    if not db_asset and not is_crypto and not resolution_cooldown:
        try:
            from app.services.reference_data.adanos_listings import lookup_adanos_isin
            from app.services.market_data.trade_republic_logos import (
                fetch_trade_republic_logos,
            )

            lookup_isin = lookup_adanos_isin(db, symbol.upper(), asset_type=effective_asset_type, name=effective_name)
            if lookup_isin:
                tr_results = fetch_trade_republic_logos(lookup_isin)
                if tr_results:
                    tr_variant = "dark" if normalized_variant == "dark" and "dark" in tr_results else "light"
                    tr_logo_data = tr_results[tr_variant]
                    return image_response(tr_logo_data, "image/svg+xml")
        except Exception as exc:
            logger.info(
                "Trade Republic lookup for unpersisted ticker failed",
                extra={"event": "trade_republic_lookup_failed", "symbol": symbol, "error": str(exc)},
            )

    if resolution is not None and resolution.logo_bytes is not None:
        logo_data = resolution.logo_bytes
        content_type = resolution.logo_content_type or "image/webp"
        is_svg_fallback = content_type == "image/svg+xml"
    else:
        # Check database cache first. Only trust logos that a real provider
        # supplied; legacy rows can carry image bytes under a 'generated'
        # provider from the era when ticker search could match the wrong brand.
        cached = None
        if db_asset and db_asset.logo_provider in ("trade_republic", "brandfetch", "logo_dev"):
            cached = crud_assets.get_cached_logo(db, db_asset.id)
        if cached:
            cached_logo_data, cached_content_type = cached
            # Don't use cached SVG fallbacks - try to fetch real logo instead
            is_cached_svg = cached_content_type == 'image/svg+xml'
            if not is_cached_svg:
                return image_response(cached_logo_data, cached_content_type)

        if resolution_cooldown:
            # A recent completed resolution found no provider logo: serve the
            # locally generated fallback without touching external providers.
            from app.services.market_data.logos import generate_svg_logo, LOGO_SOURCE_GENERATED

            logo_data = generate_svg_logo(symbol).encode('utf-8')
            logo_source = LOGO_SOURCE_GENERATED
        else:
            # Fetch logo using the consolidated validation function
            # For ETFs/Cryptocurrencies, this will skip ticker search and use appropriate fallback
            logo_data, logo_source = fetch_logo_with_source(symbol, company_name=effective_name, asset_type=effective_asset_type)
            if logo_source == "generated":
                CacheService.set(negative_cache_key, True, ttl=_LOGO_NEGATIVE_CACHE_TTL_SECONDS)

        # Determine content type based on data
        is_svg_fallback = logo_data.startswith(b'<svg') or logo_data.startswith(b'<?xml')
        content_type = 'image/svg+xml' if is_svg_fallback else 'image/webp'

        # Only cache real logos in database, not SVG fallbacks
        # SVG fallbacks should be regenerated so they can be replaced with real logos later
        if db_asset and not is_svg_fallback:
            crud_assets.cache_logo(db, db_asset.id, logo_data, content_type, provider=logo_source)

    # Return the logo
    return image_response(logo_data, content_type, is_svg_fallback=is_svg_fallback)



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
    
    # Get all transactions (BUY, SELL, CONVERSION, and SPLIT) ordered chronologically
    all_transactions = query.order_by(Transaction.tx_date.asc()).all()
    
    # Build query for BUY, SELL, and CONVERSION transactions with portfolio names
    tx_query = (
        db.query(Transaction, Portfolio.name)
        .join(Portfolio, Transaction.portfolio_id == Portfolio.id)
        .filter(
            Transaction.asset_id == asset_id,
            Transaction.type.in_([TransactionType.BUY, TransactionType.SELL, TransactionType.CONVERSION_IN, TransactionType.CONVERSION_OUT])
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
        asset_type = normalize_asset_type(asset.get("asset_type"))
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


@router.get("/distribution/market-caps")
async def get_market_caps_distribution(
    metrics_service: MetricsServiceDep,
    portfolio_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get distribution of assets by company market-cap bucket with performance metrics.

    Buckets use stored asset market-cap metadata. Funds, crypto assets, and missing
    equity market caps are shown as separate groups.
    """
    from collections import defaultdict

    held_assets_data = await get_held_assets(portfolio_id=portfolio_id, current_user=current_user, db=db)
    held_asset_ids = [asset["id"] for asset in held_assets_data]
    asset_models = {
        asset.id: asset
        for asset in db.query(AssetModel).filter(AssetModel.id.in_(held_asset_ids)).all()
    } if held_asset_ids else {}

    positions_map = {}
    if portfolio_id is not None:
        positions = await metrics_service.get_positions(portfolio_id)
        sold_positions = await metrics_service.get_sold_positions_only(portfolio_id)
        all_positions = positions + sold_positions
        positions_map = {pos.asset_id: pos for pos in all_positions}

    bucket_data = defaultdict(lambda: {
        "assets": [],
        "count": 0,
        "total_value": Decimal(0),
        "cost_basis": Decimal(0),
        "unrealized_pnl": Decimal(0),
    })

    total_assets = len(held_assets_data)
    total_portfolio_value = Decimal(0)

    if portfolio_id is not None:
        total_portfolio_value = sum(
            (positions_map[asset["id"]].market_value or Decimal(0))
            for asset in held_assets_data
            if asset["id"] in positions_map
        )

    for asset in held_assets_data:
        asset_model = asset_models.get(asset["id"])
        bucket = _asset_market_cap_bucket(asset_model) if asset_model else "Market cap unavailable"
        bucket_data[bucket]["assets"].append(asset["id"])
        bucket_data[bucket]["count"] += 1

        if portfolio_id is not None and asset["id"] in positions_map:
            pos = positions_map[asset["id"]]
            bucket_data[bucket]["total_value"] += pos.market_value or Decimal(0)
            bucket_data[bucket]["cost_basis"] += pos.cost_basis or Decimal(0)
            bucket_data[bucket]["unrealized_pnl"] += pos.unrealized_pnl or Decimal(0)

    result = []
    for bucket, data in bucket_data.items():
        unrealized_pnl_pct = (
            (data["unrealized_pnl"] / data["cost_basis"] * 100)
            if data["cost_basis"] > 0
            else Decimal(0)
        )

        if portfolio_id is not None and total_portfolio_value > 0:
            percentage = float(data["total_value"] / total_portfolio_value * 100)
        else:
            percentage = (data["count"] / total_assets * 100) if total_assets > 0 else 0

        asset_positions = []
        if portfolio_id is not None:
            bucket_total = data["total_value"]
            for asset_id in data["assets"]:
                if asset_id in positions_map:
                    pos = positions_map[asset_id]
                    asset_value = pos.market_value or Decimal(0)
                    asset_pct = float(asset_value / bucket_total * 100) if bucket_total > 0 else 0
                    asset_positions.append({
                        "asset_id": asset_id,
                        "total_value": float(asset_value),
                        "unrealized_pnl": float(pos.unrealized_pnl or Decimal(0)),
                        "unrealized_pnl_pct": float(getattr(pos, "unrealized_pnl_pct", None) or Decimal(0)),
                        "percentage": asset_pct,
                    })

        result.append({
            "name": bucket,
            "count": data["count"],
            "percentage": percentage,
            "total_value": float(data["total_value"]),
            "cost_basis": float(data["cost_basis"]),
            "unrealized_pnl": float(data["unrealized_pnl"]),
            "unrealized_pnl_pct": float(unrealized_pnl_pct),
            "asset_ids": data["assets"],
            "asset_positions": asset_positions,
        })

    if portfolio_id is not None:
        result.sort(key=lambda x: x["total_value"], reverse=True)
    else:
        result.sort(key=lambda x: x["count"], reverse=True)

    return result


@router.get("/themes/distribution")
@router.get("/distribution/themes")
async def get_themes_distribution(
    metrics_service: MetricsServiceDep,
    portfolio_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get distribution of portfolio market value by investment theme.

    Uses pre-computed position theme payloads and aggregates in-memory.
    """
    _ = current_user, db  # Injected for auth/session consistency with sibling endpoints.
    positions = await metrics_service.get_positions(portfolio_id)
    return calculate_theme_allocation(positions)


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
    # Use end of today to include all prices from today
    end_date = datetime.utcnow()
    
    period_upper = period.upper()
    
    # Add 1 extra day buffer and normalize to midnight to catch timezone edge cases
    # (e.g., market close at 4pm EST = 21:00 UTC might store as previous day)
    if period_upper in ["1W", "WEEKLY"]:
        start_date = (end_date - timedelta(days=8)).replace(hour=0, minute=0, second=0, microsecond=0)
    elif period_upper in ["1M", "MONTHLY"]:
        start_date = (end_date - timedelta(days=31)).replace(hour=0, minute=0, second=0, microsecond=0)
    elif period_upper == "3M":
        start_date = (end_date - timedelta(days=91)).replace(hour=0, minute=0, second=0, microsecond=0)
    elif period_upper == "6M":
        start_date = (end_date - timedelta(days=181)).replace(hour=0, minute=0, second=0, microsecond=0)
    elif period_upper == "YTD":
        # Year to date - from January 1st of current year (already at midnight)
        start_date = datetime(end_date.year, 1, 1)
    elif period_upper in ["1Y", "YEARLY"]:
        start_date = (end_date - timedelta(days=366)).replace(hour=0, minute=0, second=0, microsecond=0)
    elif period_upper in ["ALL", "ALL_TIME"]:
        # "ALL" means all available market history, not all owned history.
        # Ownership windows belong to transaction/position views, while this
        # endpoint powers price charts.
        start_date = datetime(1900, 1, 1)
    else:
        raise InvalidPriceHistoryPeriodError(period=period)
    
    # Fetch prices from database
    prices = crud_prices.get_prices(
        db,
        asset_id,
        date_from=start_date,
        date_to=end_date,
        limit=30000 if period_upper in ["ALL", "ALL_TIME"] else 10000
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
    - Data gaps (missing trading days based on actual exchange calendar)
    - Data quality metrics
    - First transaction date
    - Expected vs actual data points
    
    This helps debug issues with price history and identify data quality problems.
    Uses exchange calendars to properly exclude holidays for the asset's exchange.
    """
    from datetime import datetime, timedelta
    from app.crud import prices as crud_prices
    from app.models import Transaction
    from app.utils.exchange_calendars import calculate_coverage, get_exchange_code
    
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
    
    start_date = oldest_price.asof
    end_date = newest_price.asof
    
    # Get all price dates
    price_dates = set(p.asof.date() for p in all_prices)
    
    # Calculate coverage using exchange calendar (properly excludes holidays)
    coverage_info = calculate_coverage(
        symbol=asset.symbol,
        start_date=start_date.date(),
        end_date=end_date.date(),
        price_dates=price_dates
    )
    
    expected_days = coverage_info["expected_trading_days"]
    actual_days = coverage_info["actual_data_points"]
    coverage_pct = coverage_info["coverage_pct"]
    gaps = [d.isoformat() for d in coverage_info["missing_days"]]
    exchange_code = coverage_info["exchange"]
    
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
        "exchange": exchange_code,
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
        recommendations.append("Price data coverage is low. Consider running a manual backfill.")
        recommendations.append(f"Run: POST /portfolios/{{portfolio_id}}/backfill_history to fetch missing prices")
    
    if gap_count > 10:
        recommendations.append(f"📊 Found {gap_count} gaps in price history. This may affect chart accuracy.")
        if asset.first_transaction_date:
            recommendations.append("Consider re-fetching historical data from first transaction date.")
    
    if status == "EXCELLENT":
        recommendations.append("Price data coverage is excellent. No action needed.")
    
    if not asset.first_transaction_date:
        recommendations.append("No first_transaction_date set. Historical backfill may not work correctly.")
    
    return recommendations


@router.post("/{asset_id}/backfill-prices")
def backfill_asset_prices(
    asset_id: int,
    days: int = 365,
    all_time: bool = False,
    db: Session = Depends(get_db)
):
    """
    Backfill historical prices for an asset from yfinance
    
    - **asset_id**: The asset to backfill prices for
    - **days**: Number of days to backfill (default 365)
    - **all_time**: If true, fetch all available daily history instead of
      anchoring to the first portfolio transaction date.
    
    This fetches historical close prices from yfinance and saves them to the database.
    Useful for filling gaps in price history.
    """
    from datetime import datetime, timedelta
    from app.services.market_data.pricing import PricingService
    
    # Verify asset exists
    asset = crud.get_asset(db, asset_id)
    if not asset:
        raise AssetNotFoundError(id=asset_id)
    
    # Calculate date range
    end_date = datetime.utcnow()
    start_date = datetime(1900, 1, 1) if all_time else end_date - timedelta(days=days)
    
    # If asset has first_transaction_date, use that as the start if it's more recent.
    # Research charts explicitly opt out because they need pre-ownership history.
    if asset.first_transaction_date and not all_time:
        first_tx_date = datetime.combine(asset.first_transaction_date, datetime.min.time())
        if first_tx_date > start_date:
            start_date = first_tx_date
    
    # Run backfill
    pricing_service = PricingService(db)
    count = pricing_service.ensure_historical_prices(asset, start_date, end_date)
    
    return {
        "asset_id": asset.id,
        "symbol": asset.symbol,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "prices_added": count,
        "message": f"Successfully backfilled {count} historical prices for {asset.symbol}"
    }


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
        provider = get_market_data_provider()
        
        # Get the info dict - this contains all metadata
        info = provider.get_info(
            fetch_symbol,
            action="asset_debug_info",
            timeout_seconds=yahoo_timeout_seconds(),
        )
        
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
            history = provider.get_history(
                fetch_symbol,
                action="asset_debug_history",
                timeout_seconds=yahoo_timeout_seconds(default=12.0),
                period="3mo",
            )
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
            calendar = provider.get_calendar(
                fetch_symbol,
                action="asset_debug_calendar",
                timeout_seconds=yahoo_timeout_seconds(),
            )
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
            recommendations = provider.get_recommendations(
                fetch_symbol,
                action="asset_debug_recommendations",
                timeout_seconds=yahoo_timeout_seconds(),
            )
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
            institutional_holders = provider.get_institutional_holders(
                fetch_symbol,
                action="asset_debug_institutional_holders",
                timeout_seconds=yahoo_timeout_seconds(),
            )
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
            major_holders = provider.get_major_holders(
                fetch_symbol,
                action="asset_debug_major_holders",
                timeout_seconds=yahoo_timeout_seconds(),
            )
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
            dividends = provider.get_dividends(
                fetch_symbol,
                action="asset_debug_dividends",
                timeout_seconds=yahoo_timeout_seconds(),
            )
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
            splits = provider.get_splits(
                fetch_symbol,
                action="asset_debug_splits",
                timeout_seconds=yahoo_timeout_seconds(),
            )
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
            actions = provider.get_actions(
                fetch_symbol,
                action="asset_debug_actions",
                timeout_seconds=yahoo_timeout_seconds(),
            )
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
