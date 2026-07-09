"""
Asset research service - asset-level analytics that do not require ownership.
"""
import logging
import copy
import re
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Optional

from sqlalchemy import asc, case, desc, func, literal
from sqlalchemy.orm import Session

from app.crud import assets as crud_assets
from app.models import Asset, AssetThemeClassification, Portfolio, Price, Transaction, TransactionType
from app.schemas import AssetCreate, PriceQuote
from app.services.platform.cache import CacheService
from app.services.market_data.fundamentals import FundamentalsService
from app.services.market_data.pricing import PricingService
from app.services.portfolio_analytics.relative_performance import RelativePerformanceService
from app.services.portfolio_analytics.risk_analysis import RiskAnalysisService
from app.services.asset_intelligence.asset_themes import AssetThemeService
from app.services.market_data.yahoo_finance import call_yahoo, yahoo_timeout_seconds
from app.observability.metrics import observe_async_operation, observe_operation

logger = logging.getLogger(__name__)


class AssetResearchService:
    """Build an asset research payload without relying on portfolio transactions."""

    ETF_COMPOSITION_CACHE_TTL_SECONDS = 24 * 60 * 60

    def __init__(self, db: Session):
        self.db = db
        self.pricing_service = PricingService(db)
        self.risk_service = RiskAnalysisService(db)
        self.relative_performance_service = RelativePerformanceService(db)
        self.cache_service = CacheService()

    @observe_async_operation("asset_research")
    async def get_summary(self, symbol: str) -> Dict[str, Any]:
        """Return the fast data needed to paint the page shell."""
        asset = self._get_or_create_asset(symbol.strip().upper())
        self._ensure_full_price_history(asset)
        quote = await self._get_quote(asset.symbol)
        return {
            "asset": asset,
            "quote": quote,
            "metadata": self._get_metadata(asset),
        }

    @observe_operation("asset_research")
    def get_fundamentals(self, symbol: str) -> Dict[str, Any]:
        asset = self._get_or_create_asset(symbol.strip().upper())
        company_info = self._get_company_info(asset.symbol)
        fundamentals = self._get_fundamentals(asset.symbol, company_info)
        if company_info and crud_assets.update_asset_market_cap_from_info(asset, company_info):
            self.db.commit()
            self.db.refresh(asset)
        return fundamentals

    @observe_operation("asset_research")
    def get_business(self, symbol: str) -> Dict[str, Any]:
        asset = self._get_or_create_asset(symbol.strip().upper())
        company_info = self._get_company_info(asset.symbol)
        return self._get_business(asset, company_info)

    @observe_operation("asset_research")
    def get_ownership(self, symbol: str) -> Dict[str, Any]:
        asset = self._get_or_create_asset(symbol.strip().upper())
        company_info = self._get_company_info(asset.symbol)
        return self._get_ownership(company_info)

    @observe_operation("asset_research")
    def get_themes(self, symbol: str) -> Dict[str, Any]:
        asset = self._get_or_create_asset(symbol.strip().upper())
        if not AssetThemeService.is_theme_supported_asset(asset):
            return AssetThemeService.empty_classification_for_asset(asset)

        company_info = self._get_company_info(asset.symbol)
        business = self._get_business(asset, company_info)

        theme_service = AssetThemeService(self.db)
        classification = theme_service.get_classification_for_fetch(
            asset,
            summary=business.get("description"),
            sector=business.get("sector"),
            industry=business.get("industry"),
            name=asset.name,
        )
        if classification:
            return classification

        self._ensure_theme_classification(asset, business)
        classification = theme_service.get_classification(asset.id)
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

    @observe_async_operation("asset_research")
    async def get_risk(self, symbol: str) -> Dict[str, Any]:
        asset = self._get_or_create_asset(symbol.strip().upper())
        quote = await self._get_quote(asset.symbol)
        risk = self._get_risk(asset, quote)
        risk["risk_score"] = self._calculate_asset_risk_score(
            volatility_30d=risk.get("volatility_30d"),
            volatility_90d=risk.get("volatility_90d"),
            beta=risk.get("beta"),
            distance_to_ath_pct=risk.get("distance_to_ath_pct"),
            relative_perf_30d=None,
            relative_perf_1y=None,
        )
        return risk

    @observe_async_operation("asset_research")
    async def get_relative_performance(self, symbol: str) -> Dict[str, Any]:
        asset = self._get_or_create_asset(symbol.strip().upper())
        quote = await self._get_quote(asset.symbol)
        return self._get_relative_performance(asset, quote)

    @observe_operation("asset_research")
    def get_metadata(self, symbol: str) -> Dict[str, Any]:
        asset = self._get_or_create_asset(symbol.strip().upper())
        self._ensure_market_metadata(asset)
        return self._get_metadata(asset)

    @observe_operation("asset_research")
    def get_etf_composition(
        self,
        symbol: str,
        portfolio_id: Optional[int] = None,
        user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        normalized_symbol = symbol.strip().upper()
        asset = crud_assets.get_asset_by_symbol(self.db, normalized_symbol)
        cache_symbol = asset.symbol if asset else normalized_symbol
        cache_key = f"asset_etf_composition:{cache_symbol}"
        payload = self.cache_service.get_or_set(
            cache_key,
            lambda: self._build_etf_composition(cache_symbol),
            ttl=self.ETF_COMPOSITION_CACHE_TTL_SECONDS,
        )
        return self._enrich_etf_composition(copy.deepcopy(payload), portfolio_id=portfolio_id, user_id=user_id)

    @staticmethod
    def _get_metadata(asset: Asset) -> Dict[str, Any]:
        return {
            "ath_price": asset.ath_price,
            "ath_date": asset.ath_date,
            "atl_price": asset.atl_price,
            "atl_date": asset.atl_date,
            "asset_currency": asset.currency,
        }

    def _ensure_theme_classification(self, asset: Asset, business: Dict[str, Any]) -> None:
        try:
            AssetThemeService(self.db).refresh_classification(
                asset=asset,
                summary=business.get("description"),
                sector=business.get("sector"),
                industry=business.get("industry"),
                name=asset.name,
            )
            self.db.refresh(asset)
        except Exception as exc:
            logger.warning("Asset research theme generation failed for %s: %s", asset.symbol, exc)

    def _get_or_create_asset(self, symbol: str) -> Asset:
        asset = crud_assets.get_asset_by_symbol(self.db, symbol)
        if asset:
            return asset

        logger.info("Creating asset from research lookup: %s", symbol)
        return crud_assets.create_asset(self.db, AssetCreate(symbol=symbol))

    # Below this many stored price rows, treat an asset as needing a full
    # historical backfill (e.g. only live-quote snapshots exist so far).
    _MIN_PRICE_ROWS_FOR_FULL_HISTORY = 30

    def _ensure_full_price_history(self, asset: Asset) -> None:
        """Backfill all-time price history the first few times an asset is researched."""
        existing_rows = (
            self.db.query(Price)
            .filter(Price.asset_id == asset.id)
            .count()
        )
        if existing_rows >= self._MIN_PRICE_ROWS_FOR_FULL_HISTORY:
            # A held asset's price rows are usually anchored to
            # first_transaction_date (backfilled on transaction creation), which
            # hides pre-ownership history from research charts. Only skip the
            # all-time refetch once we've confirmed history predates ownership.
            earliest_price = (
                self.db.query(func.min(Price.asof))
                .filter(Price.asset_id == asset.id)
                .scalar()
            )
            if not asset.first_transaction_date or (
                earliest_price and earliest_price.date() < asset.first_transaction_date
            ):
                return

        try:
            self.pricing_service.ensure_historical_prices(
                asset,
                datetime(1900, 1, 1),
                datetime.utcnow(),
            )
        except Exception as exc:
            logger.warning("Asset research price history backfill failed for %s: %s", asset.symbol, exc)

    def _ensure_market_metadata(self, asset: Asset) -> None:
        if asset.ath_price is not None and asset.atl_price is not None:
            return

        try:
            self.pricing_service.ensure_historical_prices(
                asset,
                datetime(1900, 1, 1),
                datetime.utcnow(),
            )

            highest = (
                self.db.query(Price)
                .filter(Price.asset_id == asset.id)
                .order_by(desc(Price.price), asc(Price.asof))
                .first()
            )
            lowest = (
                self.db.query(Price)
                .filter(Price.asset_id == asset.id)
                .order_by(asc(Price.price), asc(Price.asof))
                .first()
            )

            changed = False
            if highest and (asset.ath_price is None or highest.price > asset.ath_price):
                asset.ath_price = highest.price
                asset.ath_date = highest.asof
                changed = True
            if lowest and (asset.atl_price is None or lowest.price < asset.atl_price):
                asset.atl_price = lowest.price
                asset.atl_date = lowest.asof
                changed = True

            if changed:
                asset.updated_at = datetime.utcnow()
                self.db.commit()
                self.db.refresh(asset)
        except Exception as exc:
            logger.warning("Asset research metadata hydration failed for %s: %s", asset.symbol, exc)
            self.db.rollback()

    async def _get_quote(self, symbol: str) -> Optional[PriceQuote]:
        try:
            return await self.pricing_service.get_price(symbol)
        except Exception as exc:
            logger.warning("Asset research quote failed for %s: %s", symbol, exc)
            return None

    def _get_company_info(self, symbol: str) -> Dict[str, Any]:
        try:
            return FundamentalsService.fetch_info(symbol, action="asset_research_info")
        except Exception as exc:
            logger.warning("Asset research company info failed for %s: %s", symbol, exc)
            return {}

    def _get_fundamentals(self, symbol: str, company_info: Dict[str, Any]) -> Dict[str, Any]:
        try:
            if company_info:
                return FundamentalsService.build_fundamentals_from_info(company_info)
            return FundamentalsService.fetch_fundamentals(symbol)
        except Exception as exc:
            logger.warning("Asset research fundamentals failed for %s: %s", symbol, exc)
            return {}

    def _get_business(self, asset: Asset, company_info: Dict[str, Any]) -> Dict[str, Any]:
        city = self._to_clean_string(company_info.get("city"))
        state = self._to_clean_string(company_info.get("state"))
        headquarters_parts = [part for part in [city, state] if part]
        description = self._to_clean_string(
            company_info.get("longBusinessSummary")
            or company_info.get("description")
        )
        founded = self._to_int(
            company_info.get("founded")
            or company_info.get("foundedYear")
            or company_info.get("yearFounded")
        ) or self._extract_founded_year(description)

        return {
            "founded": founded,
            "employees": self._to_int(company_info.get("fullTimeEmployees")),
            "headquarters": ", ".join(headquarters_parts) if headquarters_parts else None,
            "country": self._to_clean_string(company_info.get("country")) or asset.country,
            "sector": self._to_clean_string(company_info.get("sector")) or asset.sector,
            "industry": self._to_clean_string(company_info.get("industry")) or asset.industry,
            "description": description,
        }

    def _get_ownership(self, company_info: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "institutional_ownership": self._to_float(company_info.get("heldPercentInstitutions")),
            "insider_ownership": self._to_float(company_info.get("heldPercentInsiders")),
            "short_interest": self._to_float(
                company_info.get("shortPercentOfFloat")
                or company_info.get("sharesPercentSharesOut")
            ),
        }

    def _build_etf_composition(self, symbol: str) -> Dict[str, Any]:
        company_info = self._get_company_info(symbol)
        quote_type = str(company_info.get("quoteType") or "").strip().upper()
        if quote_type != "ETF":
            return {"available": False}

        try:
            funds_data = self._get_funds_data(symbol)
        except Exception as exc:
            logger.warning("ETF composition funds data failed for %s: %s", symbol, exc)
            return {
                "available": True,
                "holdings_available": False,
                "sector_weightings_available": False,
                "asset_classes_available": False,
                "holdings": [],
                "sector_weightings": [],
                "asset_classes": [],
            }

        holdings = self._normalize_holdings(getattr(funds_data, "top_holdings", None))
        sector_weightings = self._normalize_sector_weightings(getattr(funds_data, "sector_weightings", None))
        asset_classes = self._normalize_asset_classes(getattr(funds_data, "asset_classes", None))

        payload: Dict[str, Any] = {
            "available": True,
            "holdings_available": bool(holdings),
            "sector_weightings_available": bool(sector_weightings),
            "asset_classes_available": bool(asset_classes),
            "holdings": holdings,
            "sector_weightings": sector_weightings,
            "asset_classes": asset_classes,
        }

        if holdings:
            payload["total_top10_weight"] = round(sum(item["weight"] for item in holdings[:10]), 6)
            payload["largest_holding"] = holdings[0]

        return payload

    def _enrich_etf_composition(
        self,
        payload: Dict[str, Any],
        portfolio_id: Optional[int] = None,
        user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        payload.setdefault("theme_exposure_available", False)
        payload.setdefault("theme_coverage", 0)
        payload.setdefault("theme_exposure", [])
        payload.setdefault("portfolio_overlap_available", False)
        payload.setdefault("portfolio_overlap", None)

        if not payload.get("available"):
            return payload

        holdings = payload.get("holdings") or []
        if not holdings:
            if portfolio_id is not None:
                payload["portfolio_overlap_available"] = True
                payload["portfolio_overlap"] = self._empty_portfolio_overlap(portfolio_id)
            return payload

        holdings_by_symbol = {
            str(item.get("symbol") or "").strip().upper(): item
            for item in holdings
            if isinstance(item, dict) and str(item.get("symbol") or "").strip()
        }
        symbols = list(holdings_by_symbol)
        if not symbols:
            return payload

        position_subquery = None
        if portfolio_id is not None and user_id is not None:
            position_quantity = func.sum(
                case(
                    (Transaction.type.in_([
                        TransactionType.BUY,
                        TransactionType.TRANSFER_IN,
                        TransactionType.CONVERSION_IN,
                    ]), Transaction.quantity),
                    (Transaction.type.in_([
                        TransactionType.SELL,
                        TransactionType.TRANSFER_OUT,
                        TransactionType.CONVERSION_OUT,
                    ]), -Transaction.quantity),
                    else_=0,
                )
            ).label("quantity")
            position_subquery = (
                self.db.query(
                    Transaction.asset_id.label("asset_id"),
                    position_quantity,
                )
                .join(Portfolio, Portfolio.id == Transaction.portfolio_id)
                .filter(
                    Transaction.portfolio_id == portfolio_id,
                    Portfolio.user_id == user_id,
                    Transaction.type != TransactionType.SPLIT,
                )
                .group_by(Transaction.asset_id)
                .subquery()
            )

        query = (
            self.db.query(
                Asset.symbol,
                Asset.name,
                AssetThemeClassification.themes,
                position_subquery.c.quantity if position_subquery is not None else literal(None).label("quantity"),
            )
            .outerjoin(AssetThemeClassification, AssetThemeClassification.asset_id == Asset.id)
        )
        if position_subquery is not None:
            query = query.outerjoin(position_subquery, position_subquery.c.asset_id == Asset.id)

        rows = query.filter(Asset.symbol.in_(symbols)).all()

        theme_totals: Dict[str, Decimal] = {}
        classified_weight = Decimal(0)
        overlapping_holdings: list[Dict[str, Any]] = []

        for row in rows:
            holding = holdings_by_symbol.get(str(row.symbol or "").upper())
            if not holding:
                continue

            holding_weight = Decimal(str(holding.get("weight") or 0))
            if holding_weight <= 0:
                continue

            theme_weights = self._extract_theme_allocations(row.themes)
            if theme_weights:
                classified_weight += holding_weight
                for theme, allocation in theme_weights:
                    theme_totals[theme] = theme_totals.get(theme, Decimal(0)) + holding_weight * allocation

            quantity = getattr(row, "quantity", None)
            if quantity is not None and Decimal(str(quantity)) > 0:
                overlapping_holdings.append({
                    "symbol": str(row.symbol),
                    "name": str(row.name or holding.get("name") or row.symbol),
                    "weight": float(holding_weight),
                })

        total_theme_weight = sum(theme_totals.values(), Decimal(0))
        if total_theme_weight > 0:
            theme_exposure = [
                {"theme": theme, "weight": float(weight / total_theme_weight)}
                for theme, weight in theme_totals.items()
            ]
            theme_exposure.sort(key=lambda item: item["weight"], reverse=True)
            payload["theme_exposure"] = theme_exposure[:8]
            payload["theme_exposure_available"] = True
            payload["theme_coverage"] = float(min(classified_weight, Decimal(1)))

        if portfolio_id is not None:
            overlapping_holdings.sort(key=lambda item: item["weight"], reverse=True)
            overlap_weight = sum(Decimal(str(item["weight"])) for item in overlapping_holdings)
            payload["portfolio_overlap_available"] = True
            payload["portfolio_overlap"] = {
                "portfolio_id": portfolio_id,
                "overlap_weight": float(overlap_weight),
                "overlapping_holdings_count": len(overlapping_holdings),
                "largest_overlapping_holding": overlapping_holdings[0] if overlapping_holdings else None,
                "holdings": overlapping_holdings,
            }

        return payload

    @staticmethod
    def _empty_portfolio_overlap(portfolio_id: int) -> Dict[str, Any]:
        return {
            "portfolio_id": portfolio_id,
            "overlap_weight": 0,
            "overlapping_holdings_count": 0,
            "largest_overlapping_holding": None,
            "holdings": [],
        }

    @staticmethod
    def _extract_theme_allocations(themes: Any) -> list[tuple[str, Decimal]]:
        extracted: list[tuple[str, Optional[Decimal]]] = []
        seen_labels: set[str] = set()

        for raw_theme in themes or []:
            if isinstance(raw_theme, dict):
                theme_payload = raw_theme.get("theme") if isinstance(raw_theme.get("theme"), dict) else raw_theme
                raw_label = theme_payload.get("label")
                raw_weight = theme_payload.get("weight", raw_theme.get("weight"))
            else:
                raw_label = getattr(raw_theme, "label", None)
                raw_weight = getattr(raw_theme, "weight", None)

            if raw_label is None:
                continue

            label = str(raw_label).strip()
            normalized_label = label.casefold()
            if not label or normalized_label in seen_labels:
                continue

            weight = None
            if raw_weight is not None:
                try:
                    parsed_weight = Decimal(str(raw_weight))
                    if parsed_weight > 0:
                        weight = parsed_weight
                except Exception:
                    weight = None

            seen_labels.add(normalized_label)
            extracted.append((label, weight))

        if not extracted:
            return []

        if all(weight is not None for _, weight in extracted):
            total_weight = sum(weight for _, weight in extracted if weight is not None)
            if total_weight > 0:
                return [
                    (label, (weight or Decimal(0)) / total_weight)
                    for label, weight in extracted
                ]

        equal_weight = Decimal(1) / Decimal(len(extracted))
        return [(label, equal_weight) for label, _ in extracted]

    def _get_funds_data(self, symbol: str) -> Any:
        import yfinance as yf

        return call_yahoo(
            lambda: yf.Ticker(symbol).funds_data,
            symbol=symbol,
            action="funds_data",
            timeout_seconds=yahoo_timeout_seconds(),
        )

    @staticmethod
    def _normalize_holdings(raw_holdings: Any) -> list[Dict[str, Any]]:
        rows: list[Dict[str, Any]] = []
        if raw_holdings is None:
            return rows

        try:
            iterable = raw_holdings.reset_index().to_dict("records")
        except Exception:
            iterable = raw_holdings if isinstance(raw_holdings, list) else []

        for item in iterable:
            if not isinstance(item, dict):
                continue

            symbol = str(item.get("Symbol") or item.get("symbol") or item.get("ticker") or "").strip().upper()
            name = str(item.get("Name") or item.get("name") or symbol).strip() or symbol
            weight = AssetResearchService._to_float(
                item.get("Holding Percent") or item.get("holding_percent") or item.get("weight")
            )
            if not symbol or weight is None or weight <= 0:
                continue

            rows.append({"symbol": symbol, "name": name, "weight": float(weight)})

        rows.sort(key=lambda item: item["weight"], reverse=True)
        return rows[:10]

    @staticmethod
    def _normalize_sector_weightings(raw_weightings: Any) -> list[Dict[str, Any]]:
        if not isinstance(raw_weightings, dict):
            return []

        sector_labels = {
            "realestate": "Real Estate",
            "consumer_cyclical": "Consumer Cyclical",
            "basic_materials": "Basic Materials",
            "consumer_defensive": "Consumer Defensive",
            "technology": "Technology",
            "communication_services": "Communication Services",
            "financial_services": "Financial Services",
            "utilities": "Utilities",
            "industrials": "Industrials",
            "energy": "Energy",
            "healthcare": "Healthcare",
        }

        rows: list[Dict[str, Any]] = []
        for raw_label, raw_weight in raw_weightings.items():
            weight = AssetResearchService._to_float(raw_weight)
            if weight is None or weight <= 0:
                continue
            label = sector_labels.get(str(raw_label).strip().lower(), str(raw_label).replace("_", " ").title())
            rows.append({"sector": label, "weight": float(weight)})

        rows.sort(key=lambda item: item["weight"], reverse=True)
        return rows

    @staticmethod
    def _normalize_asset_classes(raw_asset_classes: Any) -> list[Dict[str, Any]]:
        if not isinstance(raw_asset_classes, dict):
            return []

        class_labels = {
            "stockPosition": "Stocks",
            "cashPosition": "Cash",
            "bondPosition": "Bonds",
            "preferredPosition": "Preferred",
            "convertiblePosition": "Convertibles",
            "otherPosition": "Other",
        }

        rows: list[Dict[str, Any]] = []
        for raw_label, raw_weight in raw_asset_classes.items():
            weight = AssetResearchService._to_float(raw_weight)
            if weight is None or weight <= 0:
                continue
            label = class_labels.get(str(raw_label), str(raw_label).replace("Position", "").replace("_", " ").title())
            rows.append({"name": label, "weight": float(weight)})

        rows.sort(key=lambda item: item["weight"], reverse=True)
        if len(rows) == 1 and rows[0]["name"] == "Other" and rows[0]["weight"] >= 0.999:
            return []
        return rows

    def _get_risk(self, asset: Asset, quote: Optional[PriceQuote]) -> Dict[str, Optional[float]]:
        volatility_30d = None
        volatility_90d = None
        beta = None
        beta_benchmark = None
        distance_to_ath_pct = None

        try:
            volatility_30d = self.risk_service.calculate_volatility(asset.id, days=30)
            volatility_90d = self.risk_service.calculate_volatility(asset.id, days=90)
        except Exception as exc:
            logger.warning("Asset research volatility failed for %s: %s", asset.symbol, exc)

        try:
            beta_benchmark = self.relative_performance_service.get_beta_benchmark(asset.sector)
            beta = self.relative_performance_service.calculate_beta(asset.id, asset.sector, period_days=365)
        except Exception as exc:
            logger.warning("Asset research beta failed for %s: %s", asset.symbol, exc)

        current_price = self._quote_price_as_decimal(quote)
        if current_price and current_price > 0 and asset.ath_price and asset.ath_price > 0:
            distance_to_ath_pct = float(((current_price - asset.ath_price) / asset.ath_price) * Decimal(100))

        return {
            "volatility_30d": volatility_30d,
            "volatility_90d": volatility_90d,
            "beta": beta,
            "beta_benchmark": beta_benchmark,
            "risk_score": None,
            "distance_to_ath_pct": distance_to_ath_pct,
        }

    def _get_relative_performance(self, asset: Asset, quote: Optional[PriceQuote]) -> Dict[str, Optional[float]]:
        result = {
            "relative_perf_30d": None,
            "relative_perf_90d": None,
            "relative_perf_ytd": None,
            "relative_perf_1y": None,
            "asset_perf_30d": None,
            "asset_perf_90d": None,
            "asset_perf_ytd": None,
            "asset_perf_1y": None,
            "etf_perf_30d": None,
            "etf_perf_90d": None,
            "etf_perf_ytd": None,
            "etf_perf_1y": None,
            "sector_etf": None,
        }

        current_price = self._quote_price_as_decimal(quote)
        if not asset.sector or not current_price:
            return result

        try:
            sector_etf = self.relative_performance_service.get_sector_etf(asset.sector)
            result["sector_etf"] = sector_etf
            if not sector_etf:
                return result

            rel_perf = self.relative_performance_service.calculate_relative_performance(
                asset.symbol,
                asset.sector,
                current_price,
            )
            result.update({
                "relative_perf_30d": self._to_float(rel_perf.get("30d")),
                "relative_perf_90d": self._to_float(rel_perf.get("90d")),
                "relative_perf_ytd": self._to_float(rel_perf.get("ytd")),
                "relative_perf_1y": self._to_float(rel_perf.get("1y")),
                "asset_perf_30d": self._to_float(rel_perf.get("asset_30d")),
                "asset_perf_90d": self._to_float(rel_perf.get("asset_90d")),
                "asset_perf_ytd": self._to_float(rel_perf.get("asset_ytd")),
                "asset_perf_1y": self._to_float(rel_perf.get("asset_1y")),
                "etf_perf_30d": self._to_float(rel_perf.get("etf_30d")),
                "etf_perf_90d": self._to_float(rel_perf.get("etf_90d")),
                "etf_perf_ytd": self._to_float(rel_perf.get("etf_ytd")),
                "etf_perf_1y": self._to_float(rel_perf.get("etf_1y")),
            })
        except Exception as exc:
            logger.warning("Asset research relative performance failed for %s: %s", asset.symbol, exc)

        return result

    @staticmethod
    def _quote_price_as_decimal(quote: Optional[PriceQuote]) -> Optional[Decimal]:
        if not quote or quote.price is None:
            return None
        return Decimal(str(quote.price))

    @staticmethod
    def _to_float(value: Any) -> Optional[float]:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _to_int(value: Any) -> Optional[int]:
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _to_clean_string(value: Any) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @staticmethod
    def _extract_founded_year(description: Optional[str]) -> Optional[int]:
        if not description:
            return None

        match = re.search(
            r"\b(?:was\s+)?(?:incorporated|founded|established)\s+in\s+((?:18|19|20)\d{2})\b",
            description,
            flags=re.IGNORECASE,
        )
        if not match:
            return None

        return int(match.group(1))

    @staticmethod
    def _normalize_factor(value: Optional[float], neutral: float, transform) -> Optional[float]:
        if value is None:
            return neutral
        return max(0.0, min(1.0, transform(float(value))))

    @classmethod
    def _calculate_asset_risk_score(
        cls,
        volatility_30d: Optional[float],
        volatility_90d: Optional[float],
        beta: Optional[float],
        distance_to_ath_pct: Optional[float],
        relative_perf_30d: Optional[float],
        relative_perf_1y: Optional[float],
    ) -> Optional[float]:
        factors = [volatility_30d, volatility_90d, beta, distance_to_ath_pct, relative_perf_30d, relative_perf_1y]
        if all(value is None for value in factors):
            return None

        vol_source = volatility_30d if volatility_30d is not None else volatility_90d
        vol_norm = cls._normalize_factor(vol_source, 0.5, lambda value: value / 80.0)
        beta_norm = cls._normalize_factor(beta, 0.5, lambda value: (value - 0.8) / 1.2)
        dist_norm = cls._normalize_factor(distance_to_ath_pct, 0.5, lambda value: abs(value) / 60.0)
        mom30_norm = cls._normalize_factor(relative_perf_30d, 0.5, lambda value: -value / 30.0)
        mom1y_norm = cls._normalize_factor(relative_perf_1y, 0.5, lambda value: abs(value) / 100.0)

        risk_0_1 = (
            0.35 * vol_norm +
            0.25 * beta_norm +
            0.20 * dist_norm +
            0.15 * mom30_norm +
            0.05 * mom1y_norm
        )
        return round(risk_0_1 * 100.0, 1)
