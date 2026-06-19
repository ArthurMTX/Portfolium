"""
Portfolio metrics calculation service (PRU, P&L, positions)
"""
import asyncio
import logging
from decimal import Decimal
from typing import Any, List, Dict, Optional, Tuple
from datetime import date, datetime, time, timedelta
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from fastapi import Depends

from app.models import Transaction, Asset, TransactionType, Price, Portfolio
from app.schemas import Position, PortfolioMetrics
from app.crud import prices as crud_prices
from app.db import get_db
from app.services.platform.cache import CacheService, cache_positions, get_cached_positions, invalidate_positions
from app.services.market_data.currency import CurrencyService
from app.observability.metrics import (
    DAILY_GAIN_RELIABLE,
    DAILY_GAIN_UNAVAILABLE,
    daily_gain_reason_category,
)
from app.utils.exchange_calendars import get_trading_sessions

logger = logging.getLogger(__name__)

# Lock to prevent concurrent database access in async position calculations
# NOTE: Locks are lazily initialized to avoid "bound to a different event loop" errors
_db_lock: Optional[asyncio.Lock] = None

# Task cache for deduplicating concurrent position calculations
_ongoing_calculations: Dict[Tuple[int, bool], asyncio.Task] = {}
_cache_lock: Optional[asyncio.Lock] = None


def _get_db_lock() -> asyncio.Lock:
    """Get or create the database lock for the current event loop."""
    global _db_lock
    if _db_lock is None:
        _db_lock = asyncio.Lock()
    return _db_lock


def _get_cache_lock() -> asyncio.Lock:
    """Get or create the cache lock for the current event loop."""
    global _cache_lock
    if _cache_lock is None:
        _cache_lock = asyncio.Lock()
    return _cache_lock


class MetricsService:
    """Service for calculating portfolio metrics"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def get_positions(self, portfolio_id: int, include_sold: bool = False) -> List[Position]:
        """
        Calculate current positions for a portfolio with Redis caching and task deduplication:
        1. Redis cache: Serves recent results (10 min TTL), shared across instances
        2. Task cache: Deduplicates concurrent requests (shares ongoing calculation)
        
        For each asset:
        - Net quantity (BUY/TRANSFER_IN - SELL/TRANSFER_OUT, adjusted for SPLIT)
        - Average cost (PRU - Prix de Revient Unitaire)
        - Current market value
        - Unrealized P&L (or Realized P&L for sold positions)
        
        Args:
            portfolio_id: Portfolio ID
            include_sold: If True, also return sold positions with realized P&L
        """
        cache_key = (portfolio_id, include_sold)
        
        # Check Redis cache first
        redis_cached = get_cached_positions(portfolio_id)
        if redis_cached and not include_sold:  # Only use cache for active positions
            logger.info(f"Using Redis cached positions for portfolio {portfolio_id}")
            # Convert dict back to Position objects
            return [Position(**pos) for pos in redis_cached]
        
        # Variable to track if we need to wait for an ongoing task
        ongoing_task = None
        
        async with _get_cache_lock():
            # Check if calculation is already ongoing
            if cache_key in _ongoing_calculations:
                ongoing_task = _ongoing_calculations[cache_key]
                logger.info(f"Reusing ongoing position calculation for portfolio {portfolio_id}")
            else:
                # Start new calculation
                logger.info(f"Starting new position calculation for portfolio {portfolio_id}")
                ongoing_task = asyncio.create_task(self._calculate_positions_internal(portfolio_id, include_sold))
                _ongoing_calculations[cache_key] = ongoing_task
        
        # Wait for the task to complete (outside the lock to allow concurrent access)
        try:
            result = await ongoing_task
            
            # Store result in Redis cache (only for active positions)
            if not include_sold and result:
                positions_data = [pos.model_dump() for pos in result]
                cache_positions(portfolio_id, positions_data, CacheService.TTL_POSITION)
            
            # Remove from ongoing calculations
            async with _get_cache_lock():
                if _ongoing_calculations.get(cache_key) == ongoing_task:
                    _ongoing_calculations.pop(cache_key, None)
            
            return result
        except Exception:
            # On error, remove from ongoing calculations
            async with _get_cache_lock():
                if _ongoing_calculations.get(cache_key) == ongoing_task:
                    _ongoing_calculations.pop(cache_key, None)
            raise
    
    async def _calculate_positions_internal(self, portfolio_id: int, include_sold: bool = False) -> List[Position]:
        """
        Internal method that actually calculates positions
        """
        # Get portfolio to access base currency
        from app.models import Portfolio as PortfolioModel
        portfolio = self.db.query(PortfolioModel).filter_by(id=portfolio_id).first()
        portfolio_base_currency = portfolio.base_currency if portfolio else None
        
        # Get all transactions for portfolio, ordered by date
        # Use joinedload to eagerly fetch assets and prevent N+1 queries
        transactions = (
            self.db.query(Transaction)
            .options(joinedload(Transaction.asset))
            .filter(Transaction.portfolio_id == portfolio_id)
            .order_by(Transaction.tx_date, Transaction.created_at)
            .all()
        )
        
        # Group by asset and pre-calculate dividends/fees while iterating
        asset_txs: Dict[int, List[Transaction]] = {}
        total_dividends = Decimal(0)
        total_fees = Decimal(0)
        from app.services.market_data.currency import CurrencyService
        from datetime import datetime
        
        for tx in transactions:
            if tx.asset_id not in asset_txs:
                asset_txs[tx.asset_id] = []
            asset_txs[tx.asset_id].append(tx)
            
            # Calculate dividends and fees in this loop to avoid separate queries
            if tx.type == TransactionType.DIVIDEND:
                dividend_amount = tx.price * tx.quantity
                if portfolio_base_currency and tx.currency and tx.currency != portfolio_base_currency:
                    converted = CurrencyService.convert_historical(
                        dividend_amount,
                        from_currency=tx.currency,
                        to_currency=portfolio_base_currency,
                        date=datetime.combine(tx.tx_date, datetime.min.time())
                    )
                    if converted is not None:
                        dividend_amount = converted
                total_dividends += dividend_amount

            fee_amount = tx.fees
            if portfolio_base_currency and tx.currency and tx.currency != portfolio_base_currency:
                converted_fee = CurrencyService.convert_historical(
                    fee_amount,
                    from_currency=tx.currency,
                    to_currency=portfolio_base_currency,
                    date=datetime.combine(tx.tx_date, datetime.min.time())
                )
                if converted_fee is not None:
                    fee_amount = converted_fee
            total_fees += fee_amount
        
        # Store pre-calculated values for later use in get_metrics
        self._cached_dividends = {portfolio_id: total_dividends}
        self._cached_fees = {portfolio_id: total_fees}
        
        # Calculate positions sequentially to avoid database session concurrency issues
        
        # Batch fetch all assets at once to prevent N+1 queries
        asset_ids = list(asset_txs.keys())
        assets = self.db.query(Asset).filter(Asset.id.in_(asset_ids)).all()
        
        # Pre-fetch all prices in parallel before calculating positions
        # This dramatically reduces the time from sequential fetches
        asset_symbols = [asset.symbol for asset in assets]
        
        # Batch fetch all prices in parallel
        from app.services.market_data.pricing import get_pricing_service
        pricing_service = get_pricing_service(self.db)
        logger.info(f"Pre-fetching prices for {len(asset_symbols)} assets in parallel")
        await pricing_service.get_multiple_prices(asset_symbols)
        logger.info("Finished pre-fetching prices")
        
        # Now calculate positions - prices will be cached
        all_positions = []
        for asset_id, txs in asset_txs.items():
            try:
                position = await self._calculate_position(asset_id, txs, portfolio_base_currency, include_sold)
                if position:
                    logger.info(f"Calculated position for asset {asset_id}: {position.symbol}, qty={position.quantity}")
                all_positions.append(position)
            except Exception as e:
                logger.error(f"Error calculating position for asset {asset_id}: {e}", exc_info=True)
                all_positions.append(e)
        
        positions = []
        for position in all_positions:
            if isinstance(position, Exception):
                logger.error(f"Error calculating position: {position}")
                continue
            if position:
                if include_sold:
                    # Include all positions (sold and held)
                    positions.append(position)
                elif position.quantity > 0:
                    # Only include held positions
                    positions.append(position)
        
        return positions

    async def get_sold_positions_only(self, portfolio_id: int) -> List[Position]:
        """
        Get only sold positions for a portfolio (optimized to use cached data)
        
        Returns assets that were fully sold with their realized P&L.
        Uses get_positions(include_sold=True) which leverages caching, then filters.
        """
        # Use get_positions with include_sold=True to leverage caching
        # Then filter for sold positions (quantity = 0)
        all_positions = await self.get_positions(portfolio_id, include_sold=True)
        
        # Filter to only sold positions (quantity = 0)
        sold_positions = [pos for pos in all_positions if pos.quantity == 0]
        
        logger.info(f"Filtered {len(sold_positions)} sold positions from {len(all_positions)} total positions for portfolio {portfolio_id}")
        return sold_positions

    async def get_position(self, portfolio_id: int, asset_id: int) -> Optional[Position]:
        """Return an open or fully closed position for one portfolio asset."""
        positions = await self.get_positions(portfolio_id, include_sold=True)
        return next((position for position in positions if position.asset_id == asset_id), None)
    
    async def get_metrics(self, portfolio_id: int) -> PortfolioMetrics:
        """Calculate portfolio-level metrics (async to avoid blocking)"""
        from app.crud.portfolios import get_portfolio
        
        portfolio = get_portfolio(self.db, portfolio_id)
        if not portfolio:
            raise ValueError(f"Portfolio {portfolio_id} not found")
        
        positions = await self.get_positions(portfolio_id)
        
        # Aggregate metrics
        total_value = Decimal(0)
        total_cost = Decimal(0)
        total_unrealized = Decimal(0)
        
        for pos in positions:
            total_cost += pos.cost_basis
            if pos.market_value:
                total_value += pos.market_value
                if pos.unrealized_pnl:
                    total_unrealized += pos.unrealized_pnl

        daily_change_value, daily_change_pct = self._calculate_portfolio_daily_gain(
            portfolio_id=portfolio_id,
            portfolio=portfolio,
            positions=positions,
            current_value=total_value,
        )
        
        # Include realized P&L from both partially and fully sold positions.
        all_positions = await self.get_positions(portfolio_id, include_sold=True)
        realized_pnl = sum(
            (pos.realized_pnl for pos in all_positions),
            Decimal(0),
        ) or Decimal(0)
        
        total_dividends = self._calculate_total_dividends(portfolio_id)
        total_fees = self._calculate_total_fees(portfolio_id)
        
        # P&L percentage
        unrealized_pct = (
            (total_unrealized / total_cost * 100) if total_cost > 0 else Decimal(0)
        )
        
        return PortfolioMetrics(
            portfolio_id=portfolio_id,
            portfolio_name=portfolio.name,
            total_value=total_value,
            total_cost=total_cost,
            total_unrealized_pnl=total_unrealized,
            total_unrealized_pnl_pct=unrealized_pct,
            total_realized_pnl=realized_pnl,
            total_dividends=total_dividends,
            total_fees=total_fees,
            positions_count=len(positions),
            daily_change_value=daily_change_value,
            daily_change_pct=daily_change_pct,
            last_updated=datetime.utcnow()
        )

    def _calculate_portfolio_daily_gain(
        self,
        portfolio_id: int,
        portfolio: Portfolio,
        positions: List[Position],
        current_value: Decimal,
    ) -> Tuple[Optional[Decimal], Optional[Decimal]]:
        """
        Calculate portfolio-level daily gain from the previous available close.

        Formula:
            current portfolio value
            - previous close portfolio value
            - net external cash flow since the previous close

        This avoids treating deposits, withdrawals, buys, sells and transfers as
        investment performance. It returns None when the prior close or current
        valuation is incomplete, because silently reporting zero is misleading.
        """
        transactions = (
            self.db.query(Transaction)
            .options(joinedload(Transaction.asset))
            .filter(Transaction.portfolio_id == portfolio_id)
            .order_by(Transaction.tx_date, Transaction.created_at)
            .all()
        )
        if not transactions:
            DAILY_GAIN_UNAVAILABLE.labels(reason_category="no_transactions").inc()
            return None, None

        today = datetime.utcnow().date()
        report = self._build_daily_gain_attribution_report(
            portfolio_id=portfolio_id,
            portfolio=portfolio,
            positions=positions,
            transactions=transactions,
            report_date=today,
            current_value=current_value,
        )
        totals = report["totals"]
        if not report["reliable"]:
            reason_category = daily_gain_reason_category(report["unavailable_reasons"])
            DAILY_GAIN_UNAVAILABLE.labels(reason_category=reason_category).inc()
            logger.info(
                "Daily gain unavailable",
                extra={
                    "event": "daily_gain_unavailable",
                    "reason_category": reason_category,
                },
            )
            return None, None

        DAILY_GAIN_RELIABLE.inc()
        return totals["computed_daily_gain_amount"], totals["computed_daily_gain_pct"]

    async def get_daily_gain_attribution_report(
        self,
        portfolio_id: int,
        force_refresh: bool = False,
        report_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        """Build an admin/debug attribution report for portfolio Daily Gain."""
        from app.crud.portfolios import get_portfolio

        portfolio = get_portfolio(self.db, portfolio_id)
        if not portfolio:
            raise ValueError(f"Portfolio {portfolio_id} not found")

        if force_refresh:
            invalidate_positions(portfolio_id)

        positions = await self.get_positions(portfolio_id)
        current_value = sum(
            position.market_value
            for position in positions
            if position.market_value is not None
        ) or Decimal(0)

        transactions = (
            self.db.query(Transaction)
            .options(joinedload(Transaction.asset))
            .filter(Transaction.portfolio_id == portfolio_id)
            .order_by(Transaction.tx_date, Transaction.created_at)
            .all()
        )
        return self._build_daily_gain_attribution_report(
            portfolio_id=portfolio_id,
            portfolio=portfolio,
            positions=positions,
            transactions=transactions,
            report_date=report_date or datetime.utcnow().date(),
            current_value=current_value,
        )

    def _build_daily_gain_attribution_report(
        self,
        portfolio_id: int,
        portfolio: Portfolio,
        positions: List[Position],
        transactions: List[Transaction],
        report_date: date,
        current_value: Decimal,
    ) -> Dict[str, Any]:
        portfolio_currency = portfolio.base_currency
        unavailable_reasons: List[str] = []

        if not transactions:
            unavailable_reasons.append("no transactions")

        baseline_date = self._latest_portfolio_price_date_before(portfolio_id, report_date)
        if baseline_date is None:
            unavailable_reasons.append(f"no official historical close before {report_date}")

        positions_by_asset_id = {position.asset_id: position for position in positions}
        assets_by_id: Dict[int, Asset] = {}
        for tx in transactions:
            if tx.asset:
                assets_by_id[tx.asset_id] = tx.asset

        expected_close_dates = {
            asset_id: self._expected_previous_close_date(asset.symbol, report_date)
            for asset_id, asset in assets_by_id.items()
        }
        top_level_expected_close_date = max(
            (expected_date for expected_date in expected_close_dates.values() if expected_date),
            default=None,
        )

        if baseline_date is None:
            rows = [
                self._empty_daily_gain_row(
                    position=position,
                    asset=assets_by_id.get(position.asset_id),
                    reason="no official historical close date",
                    expected_previous_close_date=expected_close_dates.get(position.asset_id),
                )
                for position in positions
            ]
            return {
                "portfolio_id": portfolio_id,
                "portfolio_currency": portfolio_currency,
                "report_date": report_date.isoformat(),
                "previous_close_date": None,
                "expected_previous_close_date": (
                    top_level_expected_close_date.isoformat()
                    if top_level_expected_close_date
                    else None
                ),
                "reliable": False,
                "unavailable_reasons": unavailable_reasons,
                "rows": rows,
                "totals": self._empty_daily_gain_totals(current_value),
            }

        baseline_quantities, split_adjustments = self._baseline_quantities(
            transactions,
            baseline_date,
        )
        cash_flows_by_asset, cash_flow_errors = self._net_external_cash_flows_by_asset(
            transactions=transactions,
            portfolio_currency=portfolio_currency,
            start_exclusive=baseline_date,
            end_inclusive=report_date,
        )
        unavailable_reasons.extend(cash_flow_errors)

        asset_ids = set(positions_by_asset_id)
        asset_ids.update(asset_id for asset_id, qty in baseline_quantities.items() if qty > 0)
        asset_ids.update(cash_flows_by_asset)

        rows = []
        previous_close_value = Decimal(0)
        net_cash_flow = Decimal(0)
        provider_contribution_sum = Decimal(0)
        actual_contribution_sum = Decimal(0)

        for asset_id in sorted(asset_ids):
            asset = assets_by_id.get(asset_id) or self.db.query(Asset).filter(Asset.id == asset_id).first()
            position = positions_by_asset_id.get(asset_id)
            row = self._daily_gain_attribution_row(
                asset=asset,
                position=position,
                baseline_quantity=baseline_quantities.get(asset_id, Decimal(0)),
                split_adjustment=split_adjustments.get(asset_id, Decimal(1)),
                cash_flow=cash_flows_by_asset.get(asset_id, Decimal(0)),
                portfolio_currency=portfolio_currency,
                baseline_date=baseline_date,
                expected_previous_close_date=expected_close_dates.get(asset_id),
            )
            rows.append(row)

            net_cash_flow += row["transaction_cashflow_adjustment"] or Decimal(0)
            provider_contribution_sum += row["provider_estimated_contribution"] or Decimal(0)

            if row["reason_if_excluded"]:
                unavailable_reasons.append(f"{row['symbol']}: {row['reason_if_excluded']}")
                continue

            previous_close_value += row["previous_close_market_value"] or Decimal(0)
            actual_contribution_sum += row["actual_daily_gain_contribution"] or Decimal(0)

        reliable = not unavailable_reasons and previous_close_value > 0
        if previous_close_value <= 0:
            reliable = False
            unavailable_reasons.append("previous close portfolio value is zero")

        computed_daily_gain = None
        computed_daily_gain_pct = None
        if reliable:
            computed_daily_gain = current_value - previous_close_value - net_cash_flow
            computed_daily_gain_pct = (computed_daily_gain / previous_close_value) * Decimal(100)

        return {
            "portfolio_id": portfolio_id,
            "portfolio_currency": portfolio_currency,
            "report_date": report_date.isoformat(),
            "previous_close_date": baseline_date.isoformat(),
            "expected_previous_close_date": (
                top_level_expected_close_date.isoformat()
                if top_level_expected_close_date
                else None
            ),
            "reliable": reliable,
            "unavailable_reasons": unavailable_reasons,
            "rows": rows,
            "totals": {
                "current_portfolio_value": current_value,
                "previous_close_portfolio_value": previous_close_value,
                "net_cash_flow_adjustment": net_cash_flow,
                "computed_daily_gain_amount": computed_daily_gain,
                "computed_daily_gain_pct": computed_daily_gain_pct,
                "sum_provider_change_contributions": provider_contribution_sum,
                "sum_actual_daily_gain_contributions": actual_contribution_sum,
                "difference_computed_vs_provider_estimate": (
                    computed_daily_gain - provider_contribution_sum
                    if computed_daily_gain is not None
                    else None
                ),
            },
        }

    def _empty_daily_gain_totals(self, current_value: Decimal) -> Dict[str, Optional[Decimal]]:
        return {
            "current_portfolio_value": current_value,
            "previous_close_portfolio_value": None,
            "net_cash_flow_adjustment": None,
            "computed_daily_gain_amount": None,
            "computed_daily_gain_pct": None,
            "sum_provider_change_contributions": None,
            "sum_actual_daily_gain_contributions": None,
            "difference_computed_vs_provider_estimate": None,
        }

    def _empty_daily_gain_row(
        self,
        position: Position,
        asset: Optional[Asset],
        reason: str,
        expected_previous_close_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        return {
            "symbol": position.symbol,
            "asset_id": position.asset_id,
            "quantity": position.quantity,
            "current_price": position.current_price,
            "current_price_timestamp": position.last_updated,
            "current_fx_rate_used": Decimal(1) if asset and asset.currency == position.currency else None,
            "current_market_value": position.market_value,
            "previous_close_price_used": None,
            "previous_close_date_used": None,
            "expected_previous_close_date": (
                expected_previous_close_date.isoformat()
                if expected_previous_close_date
                else None
            ),
            "previous_close_source": None,
            "previous_fx_rate_used": None,
            "previous_close_market_value": None,
            "provider_daily_change_pct": position.daily_change_pct,
            "provider_estimated_contribution": None,
            "actual_daily_gain_contribution": None,
            "transaction_cashflow_adjustment": Decimal(0),
            "reason_if_excluded": reason,
        }

    def _baseline_quantities(
        self,
        transactions: List[Transaction],
        baseline_date: date,
    ) -> Tuple[Dict[int, Decimal], Dict[int, Decimal]]:
        quantities: Dict[int, Decimal] = {}
        split_adjustments: Dict[int, Decimal] = {}

        for tx in transactions:
            if tx.type == TransactionType.SPLIT and tx.tx_date > baseline_date:
                ratio = self._parse_split_ratio((tx.meta_data or {}).get("split", "1:1"))
                split_adjustments[tx.asset_id] = split_adjustments.get(tx.asset_id, Decimal(1)) * ratio

            if tx.tx_date > baseline_date:
                continue

            current_quantity = quantities.get(tx.asset_id, Decimal(0))
            if tx.type in [TransactionType.BUY, TransactionType.TRANSFER_IN, TransactionType.CONVERSION_IN]:
                quantities[tx.asset_id] = current_quantity + tx.quantity
            elif tx.type in [TransactionType.SELL, TransactionType.TRANSFER_OUT, TransactionType.CONVERSION_OUT]:
                quantities[tx.asset_id] = current_quantity - tx.quantity
            elif tx.type == TransactionType.SPLIT:
                ratio = self._parse_split_ratio((tx.meta_data or {}).get("split", "1:1"))
                quantities[tx.asset_id] = current_quantity * ratio

        return quantities, split_adjustments

    def _daily_gain_attribution_row(
        self,
        asset: Optional[Asset],
        position: Optional[Position],
        baseline_quantity: Decimal,
        split_adjustment: Decimal,
        cash_flow: Decimal,
        portfolio_currency: str,
        baseline_date: date,
        expected_previous_close_date: Optional[date],
    ) -> Dict[str, Any]:
        symbol = position.symbol if position else asset.symbol if asset else "UNKNOWN"
        current_market_value = position.market_value if position else Decimal(0)
        current_price = position.current_price if position else None
        current_timestamp = position.last_updated if position else None
        daily_change_pct = position.daily_change_pct if position else None
        reason = None

        if position and position.quantity > 0 and current_market_value is None:
            reason = "missing current valuation"

        provider_contribution = None
        if current_market_value is not None and daily_change_pct is not None:
            provider_contribution = current_market_value * daily_change_pct / Decimal(100)

        previous_close_price = None
        previous_close_date = None
        previous_close_source = None
        previous_fx_rate = None
        previous_close_market_value = Decimal(0)

        if baseline_quantity > 0 and asset:
            close_record = self._closing_price_record_on_or_before(
                asset.id,
                baseline_date,
                require_historical=True,
            )
            if close_record is None:
                reason = reason or "missing official historical previous close"
            else:
                previous_close_price = close_record.price
                previous_close_date = close_record.asof.date()
                previous_close_source = close_record.source
                if (
                    expected_previous_close_date
                    and previous_close_date < expected_previous_close_date
                ):
                    reason = reason or (
                        "stale official historical previous close: "
                        f"expected {expected_previous_close_date.isoformat()} or later, "
                        f"got {previous_close_date.isoformat()}"
                    )
                converted_previous_price, previous_fx_rate = self._convert_price_for_daily_gain(
                    previous_close_price,
                    from_currency=asset.currency,
                    to_currency=portfolio_currency,
                    conversion_date=previous_close_date,
                )
                if converted_previous_price is None:
                    reason = reason or "missing previous close FX conversion"
                else:
                    previous_close_market_value = (
                        baseline_quantity
                        * split_adjustment
                        * converted_previous_price
                    )

        current_fx_rate = None
        if asset and current_price is not None:
            current_fx_rate = self._current_fx_rate_from_position_price(
                asset=asset,
                position_price=current_price,
                portfolio_currency=portfolio_currency,
            )

        actual_contribution = None
        if reason is None and current_market_value is not None:
            actual_contribution = current_market_value - previous_close_market_value - cash_flow

        return {
            "symbol": symbol,
            "asset_id": asset.id if asset else position.asset_id if position else None,
            "quantity": position.quantity if position else Decimal(0),
            "current_price": current_price,
            "current_price_timestamp": current_timestamp,
            "current_fx_rate_used": current_fx_rate,
            "current_market_value": current_market_value,
            "previous_close_price_used": previous_close_price,
            "previous_close_date_used": previous_close_date.isoformat() if previous_close_date else None,
            "expected_previous_close_date": (
                expected_previous_close_date.isoformat()
                if expected_previous_close_date
                else None
            ),
            "previous_close_source": previous_close_source,
            "previous_fx_rate_used": previous_fx_rate,
            "previous_close_market_value": previous_close_market_value if reason is None else None,
            "provider_daily_change_pct": daily_change_pct,
            "provider_estimated_contribution": provider_contribution,
            "actual_daily_gain_contribution": actual_contribution,
            "transaction_cashflow_adjustment": cash_flow,
            "reason_if_excluded": reason,
        }

    def _convert_price_for_daily_gain(
        self,
        price: Decimal,
        from_currency: str,
        to_currency: str,
        conversion_date: date,
    ) -> Tuple[Optional[Decimal], Optional[Decimal]]:
        if from_currency == to_currency:
            return price, Decimal(1)

        converted = CurrencyService.convert_historical(
            price,
            from_currency=from_currency,
            to_currency=to_currency,
            date=datetime.combine(conversion_date, time.min),
        )
        if converted is not None and price != 0:
            return converted, converted / price

        converted = CurrencyService.convert(
            price,
            from_currency=from_currency,
            to_currency=to_currency,
        )
        if converted is None or price == 0:
            return None, None
        return converted, converted / price

    def _current_fx_rate_from_position_price(
        self,
        asset: Asset,
        position_price: Decimal,
        portfolio_currency: str,
    ) -> Optional[Decimal]:
        if asset.currency == portfolio_currency:
            return Decimal(1)

        latest_price = crud_prices.get_latest_price(self.db, asset.id)
        if latest_price is not None and latest_price.price:
            return position_price / latest_price.price

        rate = CurrencyService.get_exchange_rate(asset.currency, portfolio_currency)
        return rate

    def _latest_portfolio_price_date_before(
        self,
        portfolio_id: int,
        before_date: date,
    ) -> Optional[date]:
        """Return the latest official historical price date before the report date."""
        latest_asof = (
            self.db.query(func.max(Price.asof))
            .join(Transaction, Transaction.asset_id == Price.asset_id)
            .filter(
                Transaction.portfolio_id == portfolio_id,
                Price.asof < datetime.combine(before_date, time.min),
                Price.source == "yfinance_history",
            )
            .scalar()
        )
        return latest_asof.date() if latest_asof else None

    def _expected_previous_close_date(
        self,
        symbol: str,
        report_date: date,
    ) -> Optional[date]:
        """Return the latest expected market session before the valuation date."""
        start_date = report_date - timedelta(days=14)
        end_date = report_date - timedelta(days=1)
        if end_date < start_date:
            return None

        sessions = get_trading_sessions(symbol, start_date, end_date)
        return max(sessions) if sessions else None

    def _portfolio_value_at_close(
        self,
        transactions: List[Transaction],
        portfolio_currency: str,
        valuation_date: date,
    ) -> Optional[Decimal]:
        """Reconstruct portfolio value at a prior close using saved prices."""
        holdings: Dict[int, Decimal] = {}
        assets_by_id: Dict[int, Asset] = {}
        split_adjustments_after_close: Dict[int, Decimal] = {}

        for tx in transactions:
            if tx.asset:
                assets_by_id[tx.asset_id] = tx.asset

            if tx.type == TransactionType.SPLIT and tx.tx_date > valuation_date:
                ratio = self._parse_split_ratio((tx.meta_data or {}).get("split", "1:1"))
                split_adjustments_after_close[tx.asset_id] = (
                    split_adjustments_after_close.get(tx.asset_id, Decimal(1)) * ratio
                )

            if tx.tx_date > valuation_date:
                continue

            current_quantity = holdings.get(tx.asset_id, Decimal(0))
            if tx.type in [TransactionType.BUY, TransactionType.TRANSFER_IN, TransactionType.CONVERSION_IN]:
                holdings[tx.asset_id] = current_quantity + tx.quantity
            elif tx.type in [TransactionType.SELL, TransactionType.TRANSFER_OUT, TransactionType.CONVERSION_OUT]:
                holdings[tx.asset_id] = current_quantity - tx.quantity
            elif tx.type == TransactionType.SPLIT:
                ratio = self._parse_split_ratio((tx.meta_data or {}).get("split", "1:1"))
                holdings[tx.asset_id] = current_quantity * ratio

        total_value = Decimal(0)
        for asset_id, quantity in holdings.items():
            if quantity <= 0:
                continue

            price = self._closing_price_on_or_before(
                asset_id,
                valuation_date,
                require_historical=True,
            )
            asset = assets_by_id.get(asset_id)
            if price is None or asset is None:
                return None

            if asset.currency != portfolio_currency:
                converted_price = CurrencyService.convert_historical(
                    price,
                    from_currency=asset.currency,
                    to_currency=portfolio_currency,
                    date=datetime.combine(valuation_date, time.min),
                )
                if converted_price is None:
                    converted_price = CurrencyService.convert(
                        price,
                        from_currency=asset.currency,
                        to_currency=portfolio_currency,
                    )
                if converted_price is None:
                    return None
                price = converted_price

            adjusted_quantity = quantity * split_adjustments_after_close.get(asset_id, Decimal(1))
            total_value += adjusted_quantity * price

        return total_value

    def _closing_price_on_or_before(
        self,
        asset_id: int,
        valuation_date: date,
        require_historical: bool = False,
    ) -> Optional[Decimal]:
        """Prefer official historical close for the latest available date up to valuation_date."""
        price = self._closing_price_record_on_or_before(
            asset_id,
            valuation_date,
            require_historical=require_historical,
        )
        return price.price if price else None

    def _closing_price_record_on_or_before(
        self,
        asset_id: int,
        valuation_date: date,
        require_historical: bool = False,
    ) -> Optional[Price]:
        """Return the closing price record used for a previous-close valuation."""
        query = self.db.query(Price).filter(
            Price.asset_id == asset_id,
            Price.asof <= datetime.combine(valuation_date, time.max),
        )
        if require_historical:
            query = query.filter(Price.source == "yfinance_history")

        prices = (
            query
            .order_by(Price.asof.desc())
            .limit(30)
            .all()
        )
        if not prices:
            return None

        latest_price_date = prices[0].asof.date()
        same_day_prices = [price for price in prices if price.asof.date() == latest_price_date]
        historical_prices = [price for price in same_day_prices if price.source == "yfinance_history"]
        best_price = max(historical_prices or same_day_prices, key=lambda price: price.asof)
        return best_price

    def _net_external_cash_flows_by_asset(
        self,
        transactions: List[Transaction],
        portfolio_currency: str,
        start_exclusive: date,
        end_inclusive: date,
    ) -> Tuple[Dict[int, Decimal], List[str]]:
        cash_flows: Dict[int, Decimal] = {}
        errors: List[str] = []

        for tx in transactions:
            if tx.tx_date <= start_exclusive or tx.tx_date > end_inclusive:
                continue

            amount = None
            if tx.type in [TransactionType.BUY, TransactionType.TRANSFER_IN]:
                amount = (tx.quantity * tx.price) + tx.fees
            elif tx.type in [TransactionType.SELL, TransactionType.TRANSFER_OUT]:
                amount = -((tx.quantity * tx.price) - tx.fees)

            if amount is None:
                continue

            converted = self._convert_transaction_amount(
                amount=amount,
                from_currency=tx.currency,
                to_currency=portfolio_currency,
                tx_date=tx.tx_date,
            )
            if converted is None:
                symbol = tx.asset.symbol if tx.asset else f"asset_id:{tx.asset_id}"
                errors.append(f"{symbol}: missing cash flow FX conversion")
                continue

            cash_flows[tx.asset_id] = cash_flows.get(tx.asset_id, Decimal(0)) + converted

        return cash_flows, errors

    def _net_external_cash_flow(
        self,
        transactions: List[Transaction],
        portfolio_currency: str,
        start_exclusive: date,
        end_inclusive: date,
    ) -> Optional[Decimal]:
        """
        Sum external flows after the previous close.

        Positive values add capital to the marked portfolio; negative values
        remove capital. Conversions, dividends, fees and splits are not external
        flows in this portfolio model.
        """
        cash_flow = Decimal(0)
        for tx in transactions:
            if tx.tx_date <= start_exclusive or tx.tx_date > end_inclusive:
                continue

            amount = None
            if tx.type in [TransactionType.BUY, TransactionType.TRANSFER_IN]:
                amount = (tx.quantity * tx.price) + tx.fees
            elif tx.type in [TransactionType.SELL, TransactionType.TRANSFER_OUT]:
                amount = -((tx.quantity * tx.price) - tx.fees)

            if amount is None:
                continue

            converted = self._convert_transaction_amount(
                amount=amount,
                from_currency=tx.currency,
                to_currency=portfolio_currency,
                tx_date=tx.tx_date,
            )
            if converted is None:
                return None
            cash_flow += converted

        return cash_flow

    def _convert_transaction_amount(
        self,
        amount: Decimal,
        from_currency: Optional[str],
        to_currency: str,
        tx_date: date,
    ) -> Optional[Decimal]:
        source_currency = from_currency or to_currency
        if source_currency == to_currency:
            return amount

        converted = CurrencyService.convert_historical(
            amount,
            from_currency=source_currency,
            to_currency=to_currency,
            date=datetime.combine(tx_date, time.min),
        )
        if converted is not None:
            return converted

        return CurrencyService.convert(
            amount,
            from_currency=source_currency,
            to_currency=to_currency,
        )
    
    async def _calculate_position(
        self, 
        asset_id: int, 
        transactions: List[Transaction],
        portfolio_base_currency: Optional[str] = None,
        include_sold: bool = False
    ) -> Optional[Position]:
        """
        Calculate position for a single asset (async to fetch prices without blocking)
        
        Args:
            asset_id: Asset ID
            transactions: List of transactions for this asset
            portfolio_base_currency: Portfolio base currency
            include_sold: If True, calculate realized P&L for sold positions
        """
        asset = (
            self.db.query(Asset)
            .options(joinedload(Asset.theme_classification))
            .filter(Asset.id == asset_id)
            .first()
        )
        if not asset:
            return None
        
        quantity = Decimal(0)
        total_cost = Decimal(0)
        total_shares_for_cost = Decimal(0)
        realized_pnl = Decimal(0)  # Track realized P&L for sold positions
        realized_cost_basis = Decimal(0)
        realized_sale_proceeds = Decimal(0)
        realized_fees = Decimal(0)
        realized_quantity = Decimal(0)
        realized_sell_count = 0
        # Track totals for sold position statistics
        total_buy_cost = Decimal(0)  # Total cost of all buys
        total_buy_shares = Decimal(0)  # Total shares bought
        total_sell_proceeds = Decimal(0)  # Total proceeds from all sells
        total_sell_shares = Decimal(0)  # Total shares sold
        # Use the currency from the first BUY transaction (most common currency for this position)
        position_currency = None
        
        for tx in transactions:
            if tx.type in [TransactionType.BUY, TransactionType.TRANSFER_IN, TransactionType.CONVERSION_IN]:
                # Set position currency from first BUY/CONVERSION_IN transaction
                if position_currency is None:
                    position_currency = tx.currency
                quantity += tx.quantity
                cost = (tx.quantity * tx.price) + tx.fees
                total_cost += cost
                total_shares_for_cost += tx.quantity
                # Track for sold position stats
                total_buy_cost += cost
                total_buy_shares += tx.quantity
                
            elif tx.type in [TransactionType.SELL, TransactionType.TRANSFER_OUT, TransactionType.CONVERSION_OUT]:
                quantity -= tx.quantity
                # Moving weighted-average cost (PRU): remove the current average
                # cost for every disposed unit. This is the same methodology used
                # for the remaining position's cost basis.
                if total_shares_for_cost > 0:
                    avg_cost = total_cost / total_shares_for_cost
                    cost_reduction = tx.quantity * avg_cost
                    gross_proceeds = tx.quantity * tx.price
                    net_proceeds = gross_proceeds - tx.fees
                    realized_pnl += net_proceeds - cost_reduction
                    realized_cost_basis += cost_reduction
                    realized_sale_proceeds += gross_proceeds
                    realized_fees += tx.fees
                    realized_quantity += tx.quantity
                    realized_sell_count += 1
                    total_cost -= cost_reduction
                    total_shares_for_cost -= tx.quantity
                # Track for sold position stats
                total_sell_proceeds += (tx.quantity * tx.price) - tx.fees
                total_sell_shares += tx.quantity
                
            elif tx.type == TransactionType.SPLIT:
                # Handle stock split (e.g., 2:1 means double shares, half price)
                split_ratio = self._parse_split_ratio(tx.meta_data.get("split", "1:1"))
                quantity *= split_ratio
                total_shares_for_cost *= split_ratio
                # Cost basis stays the same, just spread over more shares
                # Adjust buy shares for split
                total_buy_shares *= split_ratio
                total_sell_shares *= split_ratio
        
        # For sold positions, return with realized P&L and statistics
        if include_sold and quantity <= 0:
            # Calculate average buy and sell prices
            avg_buy_price = total_buy_cost / total_buy_shares if total_buy_shares > 0 else Decimal(0)
            avg_sell_price = total_sell_proceeds / total_sell_shares if total_sell_shares > 0 else Decimal(0)
            
            # Calculate realized P&L percentage against the basis actually sold.
            realized_pnl_pct = (
                realized_pnl / realized_cost_basis * 100
                if realized_cost_basis > 0
                else None
            )
            average_sell_price = (
                realized_sale_proceeds / realized_quantity
                if realized_quantity > 0
                else None
            )
            
            # Convert values to target currency if needed
            target_currency = portfolio_base_currency or position_currency or asset.currency
            if position_currency and position_currency != target_currency:
                from app.services.market_data.currency import CurrencyService
                converted_pnl = CurrencyService.convert(
                    realized_pnl,
                    from_currency=position_currency,
                    to_currency=target_currency
                )
                converted_buy_price = CurrencyService.convert(
                    avg_buy_price,
                    from_currency=position_currency,
                    to_currency=target_currency
                )
                converted_sell_price = CurrencyService.convert(
                    avg_sell_price,
                    from_currency=position_currency,
                    to_currency=target_currency
                )
                converted_realized_cost_basis = CurrencyService.convert(
                    realized_cost_basis,
                    from_currency=position_currency,
                    to_currency=target_currency
                )
                converted_realized_sale_proceeds = CurrencyService.convert(
                    realized_sale_proceeds,
                    from_currency=position_currency,
                    to_currency=target_currency
                )
                converted_realized_fees = CurrencyService.convert(
                    realized_fees,
                    from_currency=position_currency,
                    to_currency=target_currency
                )
                converted_average_sell_price = (
                    CurrencyService.convert(
                        average_sell_price,
                        from_currency=position_currency,
                        to_currency=target_currency
                    )
                    if average_sell_price is not None
                    else None
                )
                if converted_pnl:
                    realized_pnl = converted_pnl
                if converted_buy_price:
                    avg_buy_price = converted_buy_price
                if converted_sell_price:
                    avg_sell_price = converted_sell_price
                if converted_realized_cost_basis is not None:
                    realized_cost_basis = converted_realized_cost_basis
                if converted_realized_sale_proceeds is not None:
                    realized_sale_proceeds = converted_realized_sale_proceeds
                if converted_realized_fees is not None:
                    realized_fees = converted_realized_fees
                if converted_average_sell_price is not None:
                    average_sell_price = converted_average_sell_price
            
            return Position(
                asset_id=asset_id,
                symbol=asset.symbol,
                name=asset.name,
                quantity=Decimal(0),  # Sold, so quantity is 0
                avg_cost=avg_buy_price,  # Average buy price
                current_price=avg_sell_price,  # Repurpose as average sell price
                market_value=Decimal(0),
                cost_basis=total_buy_cost if position_currency == target_currency else Decimal(0),
                unrealized_pnl=realized_pnl,  # Use unrealized_pnl field for realized P&L
                unrealized_pnl_pct=realized_pnl_pct,
                daily_change_pct=None,
                currency=target_currency,
                last_updated=None,
                asset_type=asset.asset_type,
                themes=asset.themes,
                realized_pnl=realized_pnl,
                realized_pnl_percent=realized_pnl_pct,
                realized_quantity=realized_quantity,
                realized_sell_count=realized_sell_count,
                realized_cost_basis=realized_cost_basis,
                realized_sale_proceeds=realized_sale_proceeds,
                realized_fees=realized_fees,
                lifetime_pnl=realized_pnl,
                total_quantity_bought=total_buy_shares,
                average_sell_price=average_sell_price,
            )
        
        if quantity <= 0:
            return None
        
        # Get pricing and currency services
        from app.services.market_data.pricing import PricingService
        from app.services.market_data.currency import CurrencyService
        pricing_service = PricingService(self.db)
        
        # Determine target currency: prefer portfolio base currency, fallback to position currency
        target_currency = portfolio_base_currency or position_currency or asset.currency
        
        # Convert cost basis to target currency if needed
        if position_currency and position_currency != target_currency:
            logger.info(
                f"Converting {asset.symbol} cost basis from {position_currency} to {target_currency}"
            )
            converted_cost = CurrencyService.convert(
                total_cost,
                from_currency=position_currency,
                to_currency=target_currency
            )
            if converted_cost:
                total_cost = converted_cost
                logger.info(
                    f"Converted cost basis for {asset.symbol} to {target_currency}"
                )

            for metric_name, metric_value in (
                ("realized_pnl", realized_pnl),
                ("realized_cost_basis", realized_cost_basis),
                ("realized_sale_proceeds", realized_sale_proceeds),
                ("realized_fees", realized_fees),
            ):
                converted_value = CurrencyService.convert(
                    metric_value,
                    from_currency=position_currency,
                    to_currency=target_currency,
                )
                if converted_value is not None:
                    if metric_name == "realized_pnl":
                        realized_pnl = converted_value
                    elif metric_name == "realized_cost_basis":
                        realized_cost_basis = converted_value
                    elif metric_name == "realized_sale_proceeds":
                        realized_sale_proceeds = converted_value
                    else:
                        realized_fees = converted_value
        
        # Calculate average cost (PRU) in target currency
        avg_cost = total_cost / quantity if quantity > 0 else Decimal(0)
        
        # Get current price and daily change from pricing service (async)
        price_quote = await pricing_service.get_price(asset.symbol)
        current_price = price_quote.price if price_quote else None
        daily_change_pct = price_quote.daily_change_pct if price_quote else None
        last_updated = price_quote.asof if price_quote else None
        
        # Convert current price to target currency if needed
        if current_price and asset.currency != target_currency:
            logger.info(
                f"Converting {asset.symbol} price from {asset.currency} to {target_currency}"
            )
            converted_price = CurrencyService.convert(
                current_price,
                from_currency=asset.currency,
                to_currency=target_currency
            )
            if converted_price:
                current_price = converted_price
                logger.info(
                    f"Converted price for {asset.symbol}: "
                    f"{price_quote.price} {asset.currency} -> {current_price} {target_currency}"
                )
            else:
                logger.warning(
                    f"Failed to convert price for {asset.symbol} from "
                    f"{asset.currency} to {target_currency}. Keeping the position visible without valuation."
                )
                # Keep the position visible, but do not use an unconverted price for valuation.
                current_price = None
                daily_change_pct = None
        
        # Calculate market value and P&L
        market_value = quantity * current_price if current_price else None
        unrealized_pnl = None
        unrealized_pnl_pct = None
        breakeven_gain_pct = None
        breakeven_target_price = None
        
        if market_value:
            unrealized_pnl = market_value - total_cost
            unrealized_pnl_pct = (
                (unrealized_pnl / total_cost * 100) if total_cost > 0 else Decimal(0)
            )
            
            # Calculate breakeven metrics for negative positions
            if unrealized_pnl < 0 and current_price and current_price > 0:
                # Gain % needed to return to average cost
                # If current price is below avg cost, calculate required gain %
                # Formula: ((avg_cost - current_price) / current_price) * 100
                breakeven_gain_pct = ((avg_cost - current_price) / current_price) * Decimal(100)
                
                # Target price to reach (it's simply the average cost)
                breakeven_target_price = avg_cost

        realized_pnl_pct = (
            realized_pnl / realized_cost_basis * 100
            if realized_cost_basis > 0
            else None
        )
        average_sell_price = (
            realized_sale_proceeds / realized_quantity
            if realized_quantity > 0
            else None
        )
        lifetime_pnl = (
            realized_pnl + unrealized_pnl
            if unrealized_pnl is not None
            else None
        )
        
        # Advanced metrics moved to lazy-loaded endpoint
        distance_to_ath_pct = None
        avg_buy_zone_pct = None
        personal_drawdown_pct = None
        local_ath_price = None
        local_ath_date = None
        vol_contribution_pct = None  # Will be calculated at portfolio level
        cost_to_average_down = None
        
        # Convert ATH price to target currency for display
        ath_price_display = asset.ath_price
        if asset.ath_price and asset.currency != target_currency:
            # Try historical rate first if date available
            if asset.ath_date:
                converted_ath_display = CurrencyService.convert_historical(
                    asset.ath_price,
                    from_currency=asset.currency,
                    to_currency=target_currency,
                    date=asset.ath_date
                )
                if not converted_ath_display:
                    # Fallback to current rate
                    converted_ath_display = CurrencyService.convert(
                        asset.ath_price,
                        from_currency=asset.currency,
                        to_currency=target_currency
                    )
            else:
                # No date, use current rate
                converted_ath_display = CurrencyService.convert(
                    asset.ath_price,
                    from_currency=asset.currency,
                    to_currency=target_currency
                )
            
            if converted_ath_display:
                ath_price_display = converted_ath_display
        
        return Position(
            asset_id=asset_id,
            symbol=asset.symbol,
            name=asset.name,
            quantity=quantity,
            avg_cost=avg_cost,
            current_price=current_price,
            market_value=market_value,
            cost_basis=total_cost,
            unrealized_pnl=unrealized_pnl,
            unrealized_pnl_pct=unrealized_pnl_pct,
            daily_change_pct=daily_change_pct,
            breakeven_gain_pct=breakeven_gain_pct,
            breakeven_target_price=breakeven_target_price,
            distance_to_ath_pct=distance_to_ath_pct,
            avg_buy_zone_pct=avg_buy_zone_pct,
            personal_drawdown_pct=personal_drawdown_pct,
            local_ath_price=local_ath_price,
            local_ath_date=local_ath_date,
            vol_contribution_pct=vol_contribution_pct,
            cost_to_average_down=cost_to_average_down,
            ath_price=ath_price_display,  # Return ATH in target currency
            ath_price_native=asset.ath_price,  # Return ATH in native currency
            ath_currency=asset.currency,  # Asset's native currency
            ath_date=asset.ath_date,
            relative_perf_30d=None,  # Lazy-loaded via separate endpoint
            relative_perf_90d=None,
            relative_perf_ytd=None,
            relative_perf_1y=None,
            sector=asset.sector,
            industry=asset.industry,
            sector_etf=None,  # Will be populated on-demand
            currency=target_currency,  # Use portfolio base currency if available
            last_updated=last_updated,
            asset_type=asset.asset_type,
            themes=asset.themes,
            realized_pnl=realized_pnl,
            realized_pnl_percent=realized_pnl_pct,
            realized_quantity=realized_quantity,
            realized_sell_count=realized_sell_count,
            realized_cost_basis=realized_cost_basis,
            realized_sale_proceeds=realized_sale_proceeds,
            realized_fees=realized_fees,
            lifetime_pnl=lifetime_pnl,
            total_quantity_bought=total_buy_shares,
            average_sell_price=average_sell_price,
        )
    
    def _calculate_realized_pnl(self, portfolio_id: int) -> Decimal:
        """
        DEPRECATED: This method doesn't account for splits properly.
        Use get_positions(portfolio_id, include_sold=True) instead.
        
        Calculate realized P&L from SELL transactions
        """
        # NOTE: This simplified calculation doesn't handle splits correctly
        # The metrics now use the accurate calculation from get_positions()
        # which properly tracks all transactions chronologically including splits
        
        sells = (
            self.db.query(Transaction)
            .filter(
                Transaction.portfolio_id == portfolio_id,
                Transaction.type == TransactionType.SELL
            )
            .all()
        )
        
        total_realized = Decimal(0)
        
        for sell in sells:
            # Get average cost at time of sale (simplified)
            buys = (
                self.db.query(Transaction)
                .filter(
                    Transaction.portfolio_id == portfolio_id,
                    Transaction.asset_id == sell.asset_id,
                    Transaction.type == TransactionType.BUY,
                    Transaction.tx_date <= sell.tx_date
                )
                .all()
            )
            
            if buys:
                total_qty = sum(b.quantity for b in buys)
                total_cost = sum(b.quantity * b.price + b.fees for b in buys)
                avg_cost = total_cost / total_qty if total_qty > 0 else Decimal(0)
                
                # Realized P&L = (sell_price * qty - fees) - (avg_cost * qty)
                proceeds = (sell.price * sell.quantity) - sell.fees
                cost_basis = avg_cost * sell.quantity
                realized = proceeds - cost_basis
                total_realized += realized
        
        return total_realized
    
    def _calculate_total_dividends(self, portfolio_id: int) -> Decimal:
        """Calculate total dividends received (uses pre-calculated cache if available)"""
        # Use pre-calculated value from transaction loop if available
        if hasattr(self, '_cached_dividends') and portfolio_id in self._cached_dividends:
            return self._cached_dividends[portfolio_id]
        
        # Fallback to database query if not pre-calculated
        result = (
            self.db.query(func.sum(Transaction.price * Transaction.quantity))
            .filter(
                Transaction.portfolio_id == portfolio_id,
                Transaction.type == TransactionType.DIVIDEND
            )
            .scalar()
        )
        return Decimal(result or 0)
    
    def _calculate_total_fees(self, portfolio_id: int) -> Decimal:
        """Calculate total fees paid (uses pre-calculated cache if available)"""
        # Use pre-calculated value from transaction loop if available
        if hasattr(self, '_cached_fees') and portfolio_id in self._cached_fees:
            return self._cached_fees[portfolio_id]
        
        # Fallback to database query if not pre-calculated
        result = (
            self.db.query(func.sum(Transaction.fees))
            .filter(Transaction.portfolio_id == portfolio_id)
            .scalar()
        )
        return Decimal(result or 0)
    
    def _parse_split_ratio(self, split_str: str) -> Decimal:
        """
        Parse split ratio string (e.g., "2:1" -> 2.0, "1:2" -> 0.5)
        """
        try:
            parts = split_str.split(":")
            if len(parts) == 2:
                numerator = Decimal(parts[0])
                denominator = Decimal(parts[1])
                return numerator / denominator
        except Exception:
            pass
        return Decimal(1)


    def get_portfolio_history(self, portfolio_id: int, interval: str = "daily") -> list:
        """
        Return portfolio value history for charting using saved closing prices
        - Uses historical closing prices from asset_price table (yfinance_history source)
        - Calculates portfolio value at each date by: quantity * closing_price (in portfolio currency)
        - Handles currency conversion to portfolio base currency
        - IMPORTANT: Does NOT manually apply splits because Yahoo Finance prices are already split-adjusted
        """
        from app.schemas import PortfolioHistoryPoint
        from datetime import timedelta, date, datetime
        from app.models import Portfolio as PortfolioModel
        from app.crud import prices as crud_prices
        from app.services.market_data.currency import CurrencyService
        from collections import defaultdict
        
        portfolio = self.db.query(PortfolioModel).filter_by(id=portfolio_id).first()
        if not portfolio:
            raise ValueError(f"Portfolio {portfolio_id} not found")
        
        portfolio_currency = portfolio.base_currency

        # Get all transactions for portfolio
        transactions = (
            self.db.query(Transaction)
            .filter(Transaction.portfolio_id == portfolio_id)
            .order_by(Transaction.tx_date, Transaction.created_at)
            .all()
        )
        if not transactions:
            return []

        # Determine date range based on interval
        today: date = datetime.utcnow().date()
        first_tx_date: date = transactions[0].tx_date
        
        if interval == "1W":
            start_date = max(first_tx_date, today - timedelta(days=7))
        elif interval == "1M":
            start_date = max(first_tx_date, today - timedelta(days=30))
        elif interval == "3M":
            start_date = max(first_tx_date, today - timedelta(days=90))
        elif interval == "6M":
            start_date = max(first_tx_date, today - timedelta(days=180))
        elif interval == "YTD":
            start_date = max(first_tx_date, date(today.year, 1, 1))
        elif interval == "1Y":
            start_date = max(first_tx_date, today - timedelta(days=365))
        elif interval == "ALL":
            start_date = first_tx_date
        else:  # default to 1M
            start_date = max(first_tx_date, today - timedelta(days=30))
        
        end_date = today
        
        # Get all unique asset IDs in this portfolio
        asset_ids = list(set(tx.asset_id for tx in transactions))
        
        # Load all assets to get their currencies
        assets_dict = {}
        for asset_id in asset_ids:
            asset = self.db.query(Asset).filter(Asset.id == asset_id).first()
            if asset:
                assets_dict[asset_id] = asset
        
        # Fetch all prices for all assets in the date range
        # IMPORTANT: Fetch from 7 days BEFORE start_date to ensure we have fallback prices
        # for assets that may not have price data on exactly start_date (e.g., weekends, holidays)
        price_fetch_start = start_date - timedelta(days=7)
        asset_prices_dict: Dict[int, Dict[date, Decimal]] = defaultdict(dict)
        
        for asset_id in asset_ids:
            prices = crud_prices.get_prices(
                self.db,
                asset_id,
                date_from=datetime.combine(price_fetch_start, datetime.min.time()),
                date_to=datetime.combine(end_date, datetime.max.time()),
                limit=10000
            )
            
            # Group by date and prefer yfinance_history source (official closing prices)
            prices_by_date = defaultdict(list)
            for price in prices:
                price_date = price.asof.date()
                prices_by_date[price_date].append(price)
            
            # For each date, prefer yfinance_history source, then take the latest price
            for price_date, day_prices in prices_by_date.items():
                history_prices = [p for p in day_prices if p.source == 'yfinance_history']
                if history_prices:
                    best_price = max(history_prices, key=lambda p: p.asof)
                else:
                    best_price = max(day_prices, key=lambda p: p.asof)
                
                # Convert price to portfolio currency if needed
                price_value = best_price.price
                asset = assets_dict.get(asset_id)
                if asset and asset.currency != portfolio_currency:
                    converted_price = CurrencyService.convert(
                        price_value,
                        from_currency=asset.currency,
                        to_currency=portfolio_currency
                    )
                    if converted_price:
                        price_value = converted_price
                
                asset_prices_dict[asset_id][price_date] = price_value
        
        # Build a set of all unique dates that have at least one price
        # Filter to only include dates from start_date onwards (we fetched extra days for fallback)
        all_dates = set()
        for asset_id in asset_ids:
            for price_date in asset_prices_dict[asset_id].keys():
                if price_date >= start_date:
                    all_dates.add(price_date)
        
        # Sort dates
        sorted_dates = sorted(all_dates)
        
        # HYBRID APPROACH - The correct solution:
        # 1. Track holdings using dashboard logic (splits applied chronologically)
        # 2. When calculating value, compensate for Yahoo's retroactive price adjustments
        #
        # For each asset, calculate the "price adjustment factor" - the cumulative
        # effect of splits that have occurred AFTER the current date in the loop.
        # This compensates for Yahoo's retroactive adjustments.
        
        # Pre-calculate when each split occurs for each asset
        asset_splits: Dict[int, List[Tuple[date, Decimal]]] = defaultdict(list)
        for tx in transactions:
            if tx.type == TransactionType.SPLIT:
                ratio = self._parse_split_ratio((tx.meta_data or {}).get("split", "1:1"))
                asset_splits[tx.asset_id].append((tx.tx_date, ratio))
        
        # Track holdings, applying splits AS they occur chronologically
        # Also track total invested amount (cash flow) AND cost basis of current holdings
        holdings: Dict[int, Decimal] = defaultdict(lambda: Decimal(0))
        cost_basis: Dict[int, Decimal] = defaultdict(lambda: Decimal(0))  # Track cost basis per asset
        total_invested = Decimal(0)  # Running total of net cash invested (includes sold positions)
        daily_cash_flows: Dict[date, Decimal] = defaultdict(lambda: Decimal(0))  # Track cash flows per day
        history: List[PortfolioHistoryPoint] = []
        tx_idx = 0
        
        logger.info("Portfolio history: Hybrid approach with split compensation")
        
        for current_date in sorted_dates:
            # Reset daily cash flow for this date
            day_cash_flow = Decimal(0)
            
            # Process ALL transactions including SPLITs up to current_date
            while tx_idx < len(transactions) and transactions[tx_idx].tx_date <= current_date:
                tx = transactions[tx_idx]
                
                if tx.type in [TransactionType.BUY, TransactionType.TRANSFER_IN, TransactionType.CONVERSION_IN]:
                    holdings[tx.asset_id] += tx.quantity
                    # Add to cost basis for this asset
                    cost_basis[tx.asset_id] += (tx.quantity * tx.price) + tx.fees
                    # Add cost to invested amount (quantity * price + fees) - but not for conversions (they're swaps)
                    if tx.type != TransactionType.CONVERSION_IN:
                        tx_cost = (tx.quantity * tx.price) + tx.fees
                        total_invested += tx_cost
                        # Track as cash inflow (money spent = positive cash flow)
                        if tx.tx_date == current_date:
                            day_cash_flow += tx_cost
                elif tx.type in [TransactionType.SELL, TransactionType.TRANSFER_OUT, TransactionType.CONVERSION_OUT]:
                    # Calculate the proportion of position being sold
                    if holdings[tx.asset_id] > 0:
                        # Prevent overselling - cap at 100% of holdings
                        actual_quantity_sold = min(tx.quantity, holdings[tx.asset_id])
                        if tx.quantity > holdings[tx.asset_id]:
                            logger.warning(
                                f"OVERSELLING detected on {current_date}: Asset {tx.asset_id}, "
                                f"trying to sell {float(tx.quantity):.8f} but only have {float(holdings[tx.asset_id]):.8f}. "
                                f"Capping at holdings amount."
                            )
                        
                        sell_proportion = actual_quantity_sold / holdings[tx.asset_id]
                        # Calculate the cost basis being removed
                        cost_removed = cost_basis[tx.asset_id] * sell_proportion
                        # Reduce cost basis proportionally
                        cost_basis[tx.asset_id] -= cost_removed
                        # Subtract the cost basis (not proceeds) from invested amount - but not for conversions
                        if tx.type != TransactionType.CONVERSION_OUT:
                            total_invested -= cost_removed
                            # Track as cash outflow (money received = negative cash flow, reduces portfolio value contribution)
                            # We use sale proceeds (qty * price - fees), not cost basis
                            if tx.tx_date == current_date:
                                sale_proceeds = (actual_quantity_sold * tx.price) - tx.fees
                                day_cash_flow -= sale_proceeds
                        holdings[tx.asset_id] -= actual_quantity_sold
                    else:
                        # Trying to sell with no holdings - skip this transaction
                        logger.warning(
                            f"INVALID SELL on {current_date}: Asset {tx.asset_id}, "
                            f"no holdings to sell (tried to sell {float(tx.quantity):.8f})"
                        )
                elif tx.type == TransactionType.SPLIT:
                    # Apply split to holdings (dashboard logic)
                    # Splits don't affect cost basis or invested amount
                    ratio = self._parse_split_ratio((tx.meta_data or {}).get("split", "1:1"))
                    holdings[tx.asset_id] *= ratio
                
                tx_idx += 1
            
            # Store daily cash flow
            daily_cash_flows[current_date] = day_cash_flow
            
            # Calculate value, compensating for Yahoo's retroactive adjustments
            total_value = Decimal(0)
            daily_breakdown = []
            
            for asset_id, quantity in holdings.items():
                if quantity <= 0:
                    continue
                
                # Get price for this date, or the most recent price before it
                # If no historical price exists (new asset), use the first available future price
                price = None
                if current_date in asset_prices_dict[asset_id]:
                    price = asset_prices_dict[asset_id][current_date]
                else:
                    # First, try to find the most recent price BEFORE current_date
                    available_dates_before = sorted([d for d in asset_prices_dict[asset_id].keys() if d <= current_date])
                    if available_dates_before:
                        price = asset_prices_dict[asset_id][available_dates_before[-1]]
                    else:
                        # No historical price - use the FIRST available future price
                        # This handles newly purchased assets that don't have price history
                        available_dates_after = sorted([d for d in asset_prices_dict[asset_id].keys() if d > current_date])
                        if available_dates_after:
                            price = asset_prices_dict[asset_id][available_dates_after[0]]
                
                if price is not None:
                    # Calculate the adjustment factor: product of all splits AFTER current_date
                    # This compensates for Yahoo's retroactive price adjustments
                    adjustment_factor = Decimal(1)
                    for split_date, ratio in asset_splits.get(asset_id, []):
                        if split_date > current_date:
                            # This split happened in the future, but Yahoo has already
                            # adjusted the price backwards. We need to multiply quantity
                            # by the ratio to compensate.
                            adjustment_factor *= ratio
                    
                    adjusted_quantity = quantity * adjustment_factor
                    value = adjusted_quantity * price
                    total_value += value
                    
                    # Log for Sept 1 debugging
                    if current_date.month == 9 and current_date.day == 1:
                        daily_breakdown.append(f"Asset {asset_id}: {float(quantity):.4f} × {float(adjustment_factor):.4f} × €{float(price):.2f} = €{float(value):.2f}")
                else:
                    # No price available for this asset - log warning on first date only to avoid spam
                    if current_date == sorted_dates[0]:
                        asset = assets_dict.get(asset_id)
                        asset_symbol = asset.symbol if asset else f"ID:{asset_id}"
                        logger.warning(
                            f"Portfolio history: No price for {asset_symbol} on {current_date}. "
                            f"Holdings: {float(quantity):.4f} shares will show as €0 value."
                        )
            
            # Log Sept 1 details
            if current_date.month == 9 and current_date.day == 1 and total_value < 6000:
                logger.info(f"LOW VALUE on {current_date}: Total €{float(total_value):.2f}")
                for detail in daily_breakdown:
                    logger.info(f"  {detail}")
            
            # Calculate total cost basis of current holdings
            total_cost_basis = sum(cost_basis[asset_id] for asset_id in holdings.keys() if holdings[asset_id] > 0)
            
            # DEBUG: Log cost_basis calculation for troubleshooting
            if total_cost_basis == 0 and total_value > 0:
                logger.warning(f"ZERO cost_basis on {current_date} despite having value €{float(total_value):.2f}")
                logger.warning(
                    "Portfolio history cost basis unavailable",
                    extra={"event": "portfolio_history_cost_basis_unavailable"},
                )
            
            # Calculate gain percentage (value vs invested, excluding deposits/withdrawals)
            gain_pct = None
            if total_invested > 0:
                gain = total_value - total_invested
                gain_pct = float((gain / total_invested) * 100)
            elif total_invested < 0:
                # This should never happen - log for debugging
                logger.warning(f"NEGATIVE total_invested on {current_date}: {float(total_invested):.2f}, value: {float(total_value):.2f}")
                # Set gain_pct to None to avoid invalid calculations
                gain_pct = None
            
            # Calculate unrealized P&L percentage (current holdings only, matches Dashboard)
            unrealized_pnl_pct = None
            if total_cost_basis > 0:
                unrealized_gain = total_value - total_cost_basis
                unrealized_pnl_pct = float((unrealized_gain / total_cost_basis) * 100)
            elif total_cost_basis < 0:
                # This should never happen - log for debugging
                logger.warning(f"NEGATIVE cost_basis on {current_date}: {float(total_cost_basis):.2f}, value: {float(total_value):.2f}")
                unrealized_pnl_pct = None
            
            point = PortfolioHistoryPoint(
                date=current_date.isoformat(),
                value=float(total_value),
                invested=float(total_invested),
                gain_pct=gain_pct,
                cost_basis=float(total_cost_basis),
                unrealized_pnl_pct=unrealized_pnl_pct,
                daily_cash_flow=float(daily_cash_flows.get(current_date, Decimal(0)))
            )
            history.append(point)
        
        if history:
            logger.info(f"Portfolio history final value: €{history[-1].value:.2f} on {history[-1].date}")
        
        # For "ALL" interval, prepend a zero point before the first transaction
        # This makes the chart start at 0 visually
        if interval == "ALL" and history and transactions:
            first_tx_date = transactions[0].tx_date
            # Add a point one day before the first transaction with zero values
            zero_date = first_tx_date - timedelta(days=1)
            zero_point = PortfolioHistoryPoint(
                date=zero_date.isoformat(),
                value=0.0,
                invested=0.0,
                gain_pct=0.0,
                cost_basis=0.0,
                unrealized_pnl_pct=0.0
            )
            history.insert(0, zero_point)
        
        return history


    async def get_position_detailed_metrics(
        self,
        portfolio_id: int,
        asset_id: int
    ) -> Optional[Dict]:
        """
        Get detailed metrics for a single position (lazy-loaded on-demand)
        This includes expensive calculations like relative performance and advanced metrics
        
        Delegates to PositionDetailsService for the actual calculation
        """
        from app.services.portfolio_analytics.position_details import PositionDetailsService
        
        position_details_service = PositionDetailsService(self.db)
        return await position_details_service.get_position_detailed_metrics(portfolio_id, asset_id)


def get_metrics_service(db: Session = Depends(get_db)) -> MetricsService:
    """Dependency for getting metrics service"""
    return MetricsService(db)
