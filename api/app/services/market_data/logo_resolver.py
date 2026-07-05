"""
Asset logo resolution orchestrator.

Priority chain:
  1. Trade Republic (via ISIN) -- for all listed instrument types (stocks,
     ETFs, funds, ETCs, ETNs) since Trade Republic has clean SVGs for
     financial instruments that Brandfetch usually cannot resolve.
  2. Brandfetch -- unchanged, existing behavior (mainly effective for
     equities/companies with a reliable domain; ETFs already skip straight
     to the generated fallback inside fetch_logo_with_validation).
  3. Generated ticker-initials fallback -- unchanged, existing behavior.

A Trade Republic or Brandfetch resolution is "sticky": once set, it is never
silently downgraded to a worse fallback. A "generated" resolution is
deliberately NOT sticky, matching the pre-existing behavior where SVG
fallbacks can be superseded by a real logo on a later attempt.
"""
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.observability.metrics import LOGO_RESOLUTION
from app.utils.isin import normalize_isin
from app.services.market_data.trade_republic_logos import (
    build_trade_republic_logo_url,
    fetch_trade_republic_logos,
)
from app.services.market_data.logos import fetch_logo_with_validation
from app.services.reference_data.adanos_listings import strip_yahoo_suffix

logger = logging.getLogger(__name__)

_CRYPTO_ASSET_TYPES = {"CRYPTO", "CRYPTOCURRENCY"}


@dataclass
class LogoResolutionResult:
    provider: str  # "trade_republic" | "brandfetch" | "generated" | "unchanged"
    isin_resolved: bool = False
    logo_bytes: Optional[bytes] = None
    logo_content_type: Optional[str] = None


def _is_crypto(asset_type: Optional[str]) -> bool:
    return bool(asset_type) and asset_type.upper() in _CRYPTO_ASSET_TYPES


def _find_sibling_trade_republic_logo(db: Session, asset: Asset) -> Optional[Asset]:
    """
    Find another asset that is very likely the same underlying company on a
    different exchange (e.g. "ASML" and "ASML.AS") which already has a
    resolved Trade Republic logo, so this asset can reuse it visually even
    though its own ISIN differs or its own Trade Republic lookup failed.

    Matches purely on the suffix-stripped base ticker -- deliberately does
    not require or copy the sibling's ISIN, since the two listings can be
    genuinely different legal ISINs for the same company (ADR vs ordinary
    shares, different share classes, etc.); only the logo is shared.
    """
    base_ticker, _ = strip_yahoo_suffix(asset.symbol)
    if not base_ticker:
        return None

    return (
        db.query(Asset)
        .filter(
            Asset.id != asset.id,
            Asset.logo_provider == "trade_republic",
            or_(
                Asset.logo_light_url.isnot(None),
                Asset.logo_dark_url.isnot(None),
            ),
            or_(
                Asset.symbol.ilike(base_ticker),
                Asset.symbol.ilike(f"{base_ticker}.%"),
            ),
        )
        .first()
    )


def resolve_asset_logo(
    db: Session,
    asset: Asset,
    *,
    force: bool = False,
    allow_isin_lookup: bool = True,
    name_hint: Optional[str] = None,
    asset_type_hint: Optional[str] = None,
) -> LogoResolutionResult:
    """
    Resolve (and persist) the best available logo for an asset.

    allow_isin_lookup=False skips the synchronous, experimental yfinance ISIN
    scrape -- used by the request-path logo endpoint so a slow/fragile
    external lookup never blocks an HTTP response. Async backfill contexts
    (Celery task / CLI) pass allow_isin_lookup=True. The local Adanos lookup
    is unaffected by this flag: it's an indexed Postgres query, not a network
    scrape, so it's safe (and needed) on the request path too -- otherwise a
    ticker seen for the first time on the request path would never get a
    chance at a Trade Republic logo.
    """
    if not force and asset.logo_provider == "trade_republic" and (asset.logo_light_url or asset.logo_dark_url):
        LOGO_RESOLUTION.labels(provider="unchanged").inc()
        return LogoResolutionResult(provider="unchanged")

    is_crypto = _is_crypto(asset.asset_type)
    isin_resolved = False
    had_isin = bool(asset.isin)

    # force also re-checks the ISIN (not just the logo), since force is an
    # explicit, opt-in "fully re-resolve from scratch" request -- this lets
    # Adanos correct an already-stored ISIN that came from yfinance's
    # experimental scrape (e.g. yfinance returning a Canadian ISIN for
    # GOOGL where Adanos has the correct US one) instead of leaving it stuck
    # forever just because *something* was already populated there. Yahoo's
    # scrape, however, is only ever used to fill a true gap -- it never
    # overwrites an already-stored ISIN, even under force, since it's the
    # least-trusted of the two sources.
    if not is_crypto and (not had_isin or force):
        # Adanos is checked first: it has proven more reliable than yfinance's
        # experimental ISIN scrape for some symbols (e.g. yfinance returns a
        # Canadian ISIN for GOOGL; Adanos has the correct US one), and it's a
        # local DB lookup so it always runs, even on the request path.
        # yfinance's scrape is kept only as a fallback when Adanos has
        # nothing, and only outside the request path (allow_isin_lookup).
        try:
            from app.services.reference_data.adanos_listings import lookup_adanos_isin

            adanos_isin = lookup_adanos_isin(db, asset.symbol, asset_type=asset.asset_type, name=asset.name)
        except Exception as exc:
            adanos_isin = None
            logger.info(
                "Adanos ISIN lookup failed",
                extra={"event": "isin_lookup_failed", "symbol": asset.symbol, "source": "adanos", "error": str(exc)},
            )

        if adanos_isin:
            asset.isin = adanos_isin
            isin_resolved = True
            logger.info(
                "ISIN resolved for asset via Adanos",
                extra={"event": "isin_backfilled", "symbol": asset.symbol, "source": "adanos"},
            )
        elif had_isin:
            logger.info(
                "Adanos found nothing on forced re-check; keeping existing ISIN",
                extra={"event": "isin_unchanged", "symbol": asset.symbol},
            )
        elif allow_isin_lookup:
            try:
                from app.services.market_data.yahoo_finance import get_market_data_provider

                provider = get_market_data_provider()
                raw_isin = provider.get_isin(asset.symbol, action="isin_backfill")
                normalized = normalize_isin(raw_isin)
                if normalized:
                    asset.isin = normalized
                    isin_resolved = True
                    logger.info(
                        "ISIN resolved for asset via Yahoo",
                        extra={"event": "isin_backfilled", "symbol": asset.symbol, "source": "yahoo"},
                    )
                else:
                    logger.info(
                        "No ISIN found for asset",
                        extra={"event": "isin_missing", "symbol": asset.symbol},
                    )
            except Exception as exc:
                logger.info(
                    "Yahoo ISIN lookup failed",
                    extra={"event": "isin_lookup_failed", "symbol": asset.symbol, "source": "yahoo", "error": str(exc)},
                )
        else:
            logger.info(
                "No ISIN found via Adanos; yfinance scrape skipped on request path",
                extra={"event": "isin_missing", "symbol": asset.symbol},
            )

    if asset.isin and not is_crypto:
        tr_results = fetch_trade_republic_logos(asset.isin)
        if tr_results:
            asset.logo_provider = "trade_republic"
            asset.logo_light_url = (
                build_trade_republic_logo_url(asset.isin, "light") if "light" in tr_results else None
            )
            asset.logo_dark_url = (
                build_trade_republic_logo_url(asset.isin, "dark") if "dark" in tr_results else None
            )
            asset.logo_light_data = tr_results.get("light")
            asset.logo_dark_data = tr_results.get("dark")
            asset.logo_url = asset.logo_light_url or asset.logo_dark_url
            asset.logo_fetched_at = datetime.utcnow()
            db.commit()
            db.refresh(asset)
            logger.info(
                "Trade Republic logo resolved",
                extra={"event": "trade_republic_resolved", "symbol": asset.symbol},
            )
            LOGO_RESOLUTION.labels(provider="trade_republic").inc()
            return LogoResolutionResult(provider="trade_republic", isin_resolved=isin_resolved)

        logger.info(
            "No Trade Republic logo match",
            extra={"event": "trade_republic_no_match", "symbol": asset.symbol},
        )

    if not is_crypto:
        sibling = _find_sibling_trade_republic_logo(db, asset)
        if sibling is not None:
            asset.logo_provider = "trade_republic"
            asset.logo_light_url = sibling.logo_light_url
            asset.logo_dark_url = sibling.logo_dark_url
            asset.logo_light_data = sibling.logo_light_data
            asset.logo_dark_data = sibling.logo_dark_data
            asset.logo_url = sibling.logo_url
            asset.logo_fetched_at = datetime.utcnow()
            db.commit()
            db.refresh(asset)
            logger.info(
                "Trade Republic logo reused from sibling listing",
                extra={"event": "trade_republic_resolved", "symbol": asset.symbol, "source": "sibling"},
            )
            LOGO_RESOLUTION.labels(provider="trade_republic").inc()
            return LogoResolutionResult(provider="trade_republic", isin_resolved=isin_resolved)

    if isin_resolved:
        # Persist the ISIN even though no Trade Republic logo was found for it.
        db.commit()

    effective_name = asset.name or name_hint
    effective_type = asset.asset_type or asset_type_hint
    logo_bytes = fetch_logo_with_validation(asset.symbol, company_name=effective_name, asset_type=effective_type)
    is_svg = logo_bytes.startswith(b"<svg") or logo_bytes.startswith(b"<?xml")
    content_type = "image/svg+xml" if is_svg else "image/webp"

    if not is_svg:
        from app.crud.assets import cache_logo

        cache_logo(db, asset.id, logo_bytes, content_type, provider="brandfetch")
        logger.info(
            "Brandfetch logo used as fallback",
            extra={"event": "fallback_brandfetch", "symbol": asset.symbol},
        )
        provider_result = "brandfetch"
    else:
        # Not sticky: leave room for a later attempt to supersede this with a
        # real Trade Republic/Brandfetch logo, matching existing behavior.
        asset.logo_provider = "generated"
        asset.logo_fetched_at = datetime.utcnow()
        db.commit()
        logger.info(
            "Generated fallback logo used",
            extra={"event": "fallback_generated", "symbol": asset.symbol},
        )
        provider_result = "generated"

    LOGO_RESOLUTION.labels(provider=provider_result).inc()
    return LogoResolutionResult(
        provider=provider_result,
        isin_resolved=isin_resolved,
        logo_bytes=logo_bytes,
        logo_content_type=content_type,
    )
