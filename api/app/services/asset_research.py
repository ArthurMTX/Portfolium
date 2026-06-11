"""
Asset research service - asset-level analytics that do not require ownership.
"""
import logging
import re
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Optional

from sqlalchemy import asc, desc
from sqlalchemy.orm import Session

from app.crud import assets as crud_assets
from app.models import Asset, Price
from app.schemas import AssetCreate, PriceQuote
from app.services.fundamentals import FundamentalsService
from app.services.pricing import PricingService
from app.services.relative_performance import RelativePerformanceService
from app.services.risk_analysis import RiskAnalysisService
from app.services.asset_themes import AssetThemeService

logger = logging.getLogger(__name__)


class AssetResearchService:
    """Build an asset research payload without relying on portfolio transactions."""

    def __init__(self, db: Session):
        self.db = db
        self.pricing_service = PricingService(db)
        self.risk_service = RiskAnalysisService(db)
        self.relative_performance_service = RelativePerformanceService(db)

    async def get_summary(self, symbol: str) -> Dict[str, Any]:
        """Return the fast data needed to paint the page shell."""
        asset = self._get_or_create_asset(symbol.strip().upper())
        quote = await self._get_quote(asset.symbol)
        return {
            "asset": asset,
            "quote": quote,
            "metadata": self._get_metadata(asset),
        }

    def get_fundamentals(self, symbol: str) -> Dict[str, Any]:
        asset = self._get_or_create_asset(symbol.strip().upper())
        company_info = self._get_company_info(asset.symbol)
        return self._get_fundamentals(asset.symbol, company_info)

    def get_business(self, symbol: str) -> Dict[str, Any]:
        asset = self._get_or_create_asset(symbol.strip().upper())
        company_info = self._get_company_info(asset.symbol)
        return self._get_business(asset, company_info)

    def get_ownership(self, symbol: str) -> Dict[str, Any]:
        asset = self._get_or_create_asset(symbol.strip().upper())
        company_info = self._get_company_info(asset.symbol)
        return self._get_ownership(company_info)

    def get_themes(self, symbol: str) -> Dict[str, Any]:
        asset = self._get_or_create_asset(symbol.strip().upper())
        company_info = self._get_company_info(asset.symbol)
        business = self._get_business(asset, company_info)
        self._ensure_theme_classification(asset, business)

        classification = AssetThemeService(self.db).get_classification(asset.id)
        if classification:
            return classification

        return {
            "id": None,
            "asset_id": asset.id,
            "themes": [],
            "method": "gpt",
            "model": None,
            "source_hash": None,
            "generated_at": None,
            "updated_at": None,
        }

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

    async def get_relative_performance(self, symbol: str) -> Dict[str, Any]:
        asset = self._get_or_create_asset(symbol.strip().upper())
        quote = await self._get_quote(asset.symbol)
        return self._get_relative_performance(asset, quote)

    def get_metadata(self, symbol: str) -> Dict[str, Any]:
        asset = self._get_or_create_asset(symbol.strip().upper())
        self._ensure_market_metadata(asset)
        return self._get_metadata(asset)

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
            AssetThemeService(self.db).refresh_gemini_classification(
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
