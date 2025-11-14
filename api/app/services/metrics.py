"""
Portfolio metrics calculation service (PRU, P&L, positions)
"""
import asyncio
import logging
from decimal import Decimal
from typing import Any, List, Dict, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import Depends

from app.models import Transaction, Asset, TransactionType, Price, Portfolio
from app.schemas import Position, PortfolioMetrics
from app.crud import prices as crud_prices
from app.db import get_db
from app.services.cache import CacheService, cache_positions, get_cached_positions, invalidate_positions
from app.services.currency import CurrencyService

logger = logging.getLogger(__name__)

# Lock to prevent concurrent database access in async position calculations
_db_lock = asyncio.Lock()

# Task cache for deduplicating concurrent position calculations
_ongoing_calculations: Dict[Tuple[int, bool], asyncio.Task] = {}
_cache_lock = asyncio.Lock()


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
        
        async with _cache_lock:
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
            async with _cache_lock:
                if _ongoing_calculations.get(cache_key) == ongoing_task:
                    _ongoing_calculations.pop(cache_key, None)
            
            return result
        except Exception as e:
            # On error, remove from ongoing calculations
            async with _cache_lock:
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
        transactions = (
            self.db.query(Transaction)
            .filter(Transaction.portfolio_id == portfolio_id)
            .order_by(Transaction.tx_date, Transaction.created_at)
            .all()
        )
        
        # Group by asset
        asset_txs: Dict[int, List[Transaction]] = {}
        for tx in transactions:
            if tx.asset_id not in asset_txs:
                asset_txs[tx.asset_id] = []
            asset_txs[tx.asset_id].append(tx)
        
        logger.info(f"Calculating positions for {len(asset_txs)} assets in portfolio {portfolio_id}")
        
        # OPTIMIZATION: Pre-fetch all prices in parallel before calculating positions
        # This dramatically reduces the time from sequential fetches
        asset_symbols = []
        asset_id_to_symbol = {}
        for asset_id in asset_txs.keys():
            asset = self.db.query(Asset).filter_by(id=asset_id).first()
            if asset:
                asset_symbols.append(asset.symbol)
                asset_id_to_symbol[asset_id] = asset.symbol
        
        # Batch fetch all prices in parallel
        from app.services.pricing import get_pricing_service
        pricing_service = get_pricing_service(self.db)
        logger.info(f"Pre-fetching prices for {len(asset_symbols)} assets in parallel")
        await pricing_service.get_multiple_prices(asset_symbols)
        logger.info(f"Finished pre-fetching prices")
        
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
        Get only sold positions for a portfolio (optimized - doesn't calculate active positions)
        
        Returns assets that were fully sold with their realized P&L.
        This is more efficient than get_positions(include_sold=True) when you only need sold positions.
        """
        # Get portfolio to access base currency
        from app.models import Portfolio as PortfolioModel
        portfolio = self.db.query(PortfolioModel).filter_by(id=portfolio_id).first()
        portfolio_base_currency = portfolio.base_currency if portfolio else None
        
        # Get all transactions for portfolio, ordered by date
        transactions = (
            self.db.query(Transaction)
            .filter(Transaction.portfolio_id == portfolio_id)
            .order_by(Transaction.tx_date, Transaction.created_at)
            .all()
        )
        
        # Group by asset
        asset_txs: Dict[int, List[Transaction]] = {}
        for tx in transactions:
            if tx.asset_id not in asset_txs:
                asset_txs[tx.asset_id] = []
            asset_txs[tx.asset_id].append(tx)
        
        # Calculate positions sequentially to avoid database session concurrency issues
        all_positions = []
        logger.info(f"Calculating sold positions for {len(asset_txs)} assets in portfolio {portfolio_id}")
        for asset_id, txs in asset_txs.items():
            try:
                position = await self._calculate_position(asset_id, txs, portfolio_base_currency, include_sold=True)
                all_positions.append(position)
            except Exception as e:
                logger.error(f"Error calculating sold position for asset {asset_id}: {e}", exc_info=True)
                all_positions.append(e)
        
        # Filter to only sold positions (quantity = 0)
        sold_positions = []
        for position in all_positions:
            if isinstance(position, Exception):
                logger.error(f"Error calculating position: {position}")
                continue
            if position and position.quantity == 0:
                sold_positions.append(position)
        
        return sold_positions
    
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
        total_daily_change = Decimal(0)
        has_daily_data = False
        
        for pos in positions:
            total_cost += pos.cost_basis
            if pos.market_value:
                total_value += pos.market_value
                if pos.unrealized_pnl:
                    total_unrealized += pos.unrealized_pnl
                # Calculate daily change in value
                if pos.daily_change_pct is not None and pos.market_value:
                    has_daily_data = True
                    # daily_change_value = market_value * (daily_change_pct / 100)
                    daily_change = pos.market_value * (pos.daily_change_pct / Decimal(100))
                    total_daily_change += daily_change
        
        # Calculate daily change percentage
        if has_daily_data and total_value > 0:
            # yesterday_value = total_value - total_daily_change
            yesterday_value = total_value - total_daily_change
            if yesterday_value > 0:
                daily_change_pct = (total_daily_change / yesterday_value) * Decimal(100)
            else:
                daily_change_pct = Decimal(0)
        else:
            daily_change_pct = None
            total_daily_change = None
        
        # Calculate realized P&L and dividends
        # Calculate realized P&L by summing up all sold positions
        sold_positions = await self.get_positions(portfolio_id, include_sold=True)
        realized_pnl = sum(
            pos.unrealized_pnl for pos in sold_positions 
            if pos.quantity == 0 and pos.unrealized_pnl
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
            daily_change_value=total_daily_change,
            daily_change_pct=daily_change_pct,
            last_updated=datetime.utcnow()
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
        asset = self.db.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            return None
        
        quantity = Decimal(0)
        total_cost = Decimal(0)
        total_shares_for_cost = Decimal(0)
        realized_pnl = Decimal(0)  # Track realized P&L for sold positions
        # Track totals for sold position statistics
        total_buy_cost = Decimal(0)  # Total cost of all buys
        total_buy_shares = Decimal(0)  # Total shares bought
        total_sell_proceeds = Decimal(0)  # Total proceeds from all sells
        total_sell_shares = Decimal(0)  # Total shares sold
        # Use the currency from the first BUY transaction (most common currency for this position)
        position_currency = None
        
        for tx in transactions:
            if tx.type == TransactionType.BUY or tx.type == TransactionType.TRANSFER_IN:
                # Set position currency from first BUY transaction
                if position_currency is None:
                    position_currency = tx.currency
                quantity += tx.quantity
                cost = (tx.quantity * tx.price) + tx.fees
                total_cost += cost
                total_shares_for_cost += tx.quantity
                # Track for sold position stats
                total_buy_cost += cost
                total_buy_shares += tx.quantity
                
            elif tx.type == TransactionType.SELL or tx.type == TransactionType.TRANSFER_OUT:
                quantity -= tx.quantity
                # Calculate realized P&L and reduce cost basis proportionally (FIFO simplification)
                if total_shares_for_cost > 0:
                    avg_cost = total_cost / total_shares_for_cost
                    cost_reduction = tx.quantity * avg_cost
                    # Realized P&L = proceeds - cost basis
                    proceeds = (tx.quantity * tx.price) - tx.fees
                    realized_pnl += proceeds - cost_reduction
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
            
            # Calculate realized P&L percentage
            realized_pnl_pct = None
            if total_buy_cost > 0:
                realized_pnl_pct = (realized_pnl / total_buy_cost * 100)
            
            # Convert values to target currency if needed
            target_currency = portfolio_base_currency or position_currency or asset.currency
            if position_currency and position_currency != target_currency:
                from app.services.currency import CurrencyService
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
                if converted_pnl:
                    realized_pnl = converted_pnl
                if converted_buy_price:
                    avg_buy_price = converted_buy_price
                if converted_sell_price:
                    avg_sell_price = converted_sell_price
            
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
                asset_type=asset.asset_type
            )
        
        if quantity <= 0:
            return None
        
        # Get pricing and currency services
        from app.services.pricing import PricingService
        from app.services.currency import CurrencyService
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
                logger.error(
                    f"Failed to convert price for {asset.symbol} from "
                    f"{asset.currency} to {target_currency}. Skipping this position to avoid incorrect valuation."
                )
                # Return None instead of using unconverted price to avoid massive valuation errors
                return None
        
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
            sector_etf=None,  # Will be populated on-demand
            currency=target_currency,  # Use portfolio base currency if available
            last_updated=last_updated,
            asset_type=asset.asset_type
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
        """Calculate total dividends received"""
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
        """Calculate total fees paid"""
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
        except:
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
        from app.services.currency import CurrencyService
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
        asset_prices_dict: Dict[int, Dict[date, Decimal]] = defaultdict(dict)
        
        for asset_id in asset_ids:
            prices = crud_prices.get_prices(
                self.db,
                asset_id,
                date_from=datetime.combine(start_date, datetime.min.time()),
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
        all_dates = set()
        for asset_id in asset_ids:
            all_dates.update(asset_prices_dict[asset_id].keys())
        
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
        history: List[PortfolioHistoryPoint] = []
        tx_idx = 0
        
        logger.info("Portfolio history: Hybrid approach with split compensation")
        
        for current_date in sorted_dates:
            # Process ALL transactions including SPLITs up to current_date
            while tx_idx < len(transactions) and transactions[tx_idx].tx_date <= current_date:
                tx = transactions[tx_idx]
                
                if tx.type == TransactionType.BUY or tx.type == TransactionType.TRANSFER_IN:
                    holdings[tx.asset_id] += tx.quantity
                    # Add to cost basis for this asset
                    cost_basis[tx.asset_id] += (tx.quantity * tx.price) + tx.fees
                    # Add cost to invested amount (quantity * price + fees)
                    total_invested += (tx.quantity * tx.price) + tx.fees
                elif tx.type == TransactionType.SELL or tx.type == TransactionType.TRANSFER_OUT:
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
                        # Subtract the cost basis (not proceeds) from invested amount
                        total_invested -= cost_removed
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
            
            # Calculate value, compensating for Yahoo's retroactive adjustments
            total_value = Decimal(0)
            daily_breakdown = []
            
            for asset_id, quantity in holdings.items():
                if quantity <= 0:
                    continue
                
                # Get price for this date, or the most recent price before it
                price = None
                if current_date in asset_prices_dict[asset_id]:
                    price = asset_prices_dict[asset_id][current_date]
                else:
                    # Find the most recent price before current_date
                    available_dates = sorted([d for d in asset_prices_dict[asset_id].keys() if d <= current_date])
                    if available_dates:
                        price = asset_prices_dict[asset_id][available_dates[-1]]
                
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
                logger.warning(f"  Holdings: {dict(holdings)}")
                logger.warning(f"  Cost basis per asset: {dict(cost_basis)}")
            
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
                unrealized_pnl_pct=unrealized_pnl_pct
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


    @staticmethod
    def clamp(value: float, min_value: float = 0.0, max_value: float = 1.0) -> float:
        return max(min_value, min(max_value, value))

    @staticmethod
    def calculate_risk_score(metrics: Dict[str, Any]) -> Optional[float]:
        """
        Calculate a risk score (0-100) for a position based on various metrics.
        The score combines multiple factors like volatility, beta, distance to ATH,
        """

        # Fetch raw metric values and convert to float for calculations
        distance_to_ath_pct = metrics.get("distance_to_ath_pct")
        personal_drawdown_pct = metrics.get("personal_drawdown_pct")
        vol_30d = metrics.get("volatility_30d")
        vol_90d = metrics.get("volatility_90d")
        beta = metrics.get("beta")
        rel_30d = metrics.get("relative_perf_30d")
        rel_1y = metrics.get("relative_perf_1y")

        # If no metrics available, return None
        if all(v is None for v in [
            distance_to_ath_pct, personal_drawdown_pct,
            vol_30d, vol_90d, beta, rel_30d, rel_1y
        ]):
            return None
        
        # Convert Decimal types to float for calculations
        if distance_to_ath_pct is not None:
            distance_to_ath_pct = float(distance_to_ath_pct)
        if personal_drawdown_pct is not None:
            personal_drawdown_pct = float(personal_drawdown_pct)
        if vol_30d is not None:
            vol_30d = float(vol_30d)
        if vol_90d is not None:
            vol_90d = float(vol_90d)
        if beta is not None:
            beta = float(beta)
        if rel_30d is not None:
            rel_30d = float(rel_30d)
        if rel_1y is not None:
            rel_1y = float(rel_1y)

        # Normalization of each factor to [0, 1]

        # Volatility: use 30d if available, otherwise 90d
        # Consider 80% annualized vol as "max risk"
        vol_source = vol_30d if vol_30d is not None else vol_90d
        if vol_source is None:
            vol_norm = 0.5  # neutral if no data
        else:
            vol_norm = MetricsService.clamp(vol_source / 80.0, 0.0, 1.0)

        # Beta: 0.8 => low neutral, 2.0 => very risky
        if beta is None:
            beta_norm = 0.5
        else:
            beta_norm = MetricsService.clamp((beta - 0.8) / 1.2, 0.0, 1.0)

        # Distance to ATH: the farther away, the higher the structural risk
        # Risk saturates beyond 60% below ATH.
        if distance_to_ath_pct is None:
            dist_norm = 0.5
        else:
            dist = abs(distance_to_ath_pct)   # -60% => 60
            dist_norm = MetricsService.clamp(dist / 60.0, 0.0, 1.0)

        # Personal drawdown: combine historical volatility + psychological pain
        if personal_drawdown_pct is None:
            dd_norm = 0.5
        else:
            dd_norm = MetricsService.clamp(abs(personal_drawdown_pct) / 50.0, 0.0, 1.0)

        # Short-term momentum (30d):
        # Consider -30% underperformance vs sector as max risk
        if rel_30d is None:
            mom30_norm = 0.5
        else:
            mom30_norm = MetricsService.clamp(-rel_30d / 30.0, 0.0, 1.0)

        # Long-term momentum (1 year):
        # Strong underperformance = risk, but extreme outperformance also (penny mania)
        if rel_1y is None:
            mom1y_norm = 0.5
        else:
            # We take underperformance + extreme outperformance as risk
            mom1y_norm = MetricsService.clamp(abs(rel_1y) / 100.0, 0.0, 1.0)

        # Weighting of factors (sum of weights = 1.0)
        WEIGHTS = {
            "vol": 0.30,
            "beta": 0.25,
            "dist_ath": 0.15,
            "drawdown": 0.10,
            "mom30": 0.15,
            "mom1y": 0.05,
        }

        risk_0_1 = (
            WEIGHTS["vol"] * vol_norm +
            WEIGHTS["beta"] * beta_norm +
            WEIGHTS["dist_ath"] * dist_norm +
            WEIGHTS["drawdown"] * dd_norm +
            WEIGHTS["mom30"] * mom30_norm +
            WEIGHTS["mom1y"] * mom1y_norm
        )

        # Conversion to a 0–100 score 
        risk_score = round(risk_0_1 * 100.0, 1)
        return risk_score

    async def get_position_detailed_metrics(
        self,
        portfolio_id: int,
        asset_id: int
    ) -> Optional[Dict]:
        """
        Get detailed metrics for a single position (lazy-loaded on-demand)
        This includes expensive calculations like relative performance and advanced metrics
        """
        # Get the asset
        asset = self.db.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            return None
        
        # Get portfolio to determine target currency
        portfolio = self.db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
        target_currency = portfolio.base_currency if portfolio and portfolio.base_currency else asset.currency
        
        # Get current price
        from app.services.pricing import PricingService
        pricing_service = PricingService(self.db)
        price_quote = await pricing_service.get_price(asset.symbol)
        
        if not price_quote or not price_quote.price:
            return None
        
        current_price = Decimal(str(price_quote.price))
        
        # Convert price to target currency if needed
        if asset.currency != target_currency:
            converted_price = CurrencyService.convert(
                current_price,
                from_currency=asset.currency,
                to_currency=target_currency
            )
            if converted_price:
                current_price = converted_price
        
        # Get position data for advanced metrics
        transactions = (
            self.db.query(Transaction)
            .filter(
                Transaction.portfolio_id == portfolio_id,
                Transaction.asset_id == asset_id
            )
            .order_by(Transaction.tx_date)
            .all()
        )
        
        if not transactions:
            logger.warning(f"No transactions found for asset {asset_id} in portfolio {portfolio_id}")
            return None
        
        # Calculate quantity and average cost from transactions
        quantity = Decimal(0)
        total_cost = Decimal(0)
        total_shares_for_cost = Decimal(0)
        
        for tx in transactions:
            if tx.type == TransactionType.BUY or tx.type == TransactionType.TRANSFER_IN:
                quantity += tx.quantity
                cost = (tx.quantity * tx.price) + tx.fees
                total_cost += cost
                total_shares_for_cost += tx.quantity
            elif tx.type == TransactionType.SELL or tx.type == TransactionType.TRANSFER_OUT:
                quantity -= tx.quantity
                if total_shares_for_cost > 0:
                    avg_cost_temp = total_cost / total_shares_for_cost
                    cost_reduction = tx.quantity * avg_cost_temp
                    total_cost -= cost_reduction
                    total_shares_for_cost -= tx.quantity
            elif tx.type == TransactionType.SPLIT:
                split_ratio = self._parse_split_ratio(tx.meta_data.get("split", "1:1"))
                quantity *= split_ratio
                total_shares_for_cost *= split_ratio
        
        avg_cost = total_cost / total_shares_for_cost if total_shares_for_cost > 0 else Decimal(0)
        
        # Calculate advanced metrics
        distance_to_ath_pct = None
        avg_buy_zone_pct = None
        personal_drawdown_pct = None
        local_ath_price = None
        local_ath_date = None
        cost_to_average_down = None
        volatility_30d = None
        volatility_90d = None
        
        if current_price and current_price > 0:
            # Average Buy Zone: how far is current price from avg cost
            # Positive = opportunity (price below avg), Negative = price above avg
            avg_buy_zone_pct = ((avg_cost - current_price) / current_price) * Decimal(100)
            
            # Personal Drawdown: how far is current price from the highest price since you owned the asset
            if asset.first_transaction_date:
                # Get the highest price and its date since first transaction
                local_ath_record = (
                    self.db.query(Price.price, Price.asof)
                    .filter(
                        Price.asset_id == asset_id,
                        Price.asof >= asset.first_transaction_date
                    )
                    .order_by(Price.price.desc())
                    .first()
                )
                
                if local_ath_record:
                    local_ath_native = Decimal(str(local_ath_record[0]))
                    local_ath_date = local_ath_record[1]
                    local_ath_price = local_ath_native
                    
                    # Convert local ATH to target currency if needed
                    if asset.currency != target_currency:
                        converted_local_ath = CurrencyService.convert(
                            local_ath_native,
                            from_currency=asset.currency,
                            to_currency=target_currency
                        )
                        if converted_local_ath:
                            local_ath_price = converted_local_ath
                    
                    # Calculate drawdown from local peak
                    if local_ath_price and local_ath_price > 0:
                        personal_drawdown_pct = ((current_price - local_ath_price) / local_ath_price) * Decimal(100)
            
            # Distance to ATH: how far is current price from all-time high
            if asset.ath_price and asset.ath_price > 0:
                # Convert ATH price to target currency
                ath_price_converted = asset.ath_price
                if asset.currency != target_currency:
                    # Try historical rate first (most accurate)
                    if asset.ath_date:
                        converted_ath = CurrencyService.convert_historical(
                            asset.ath_price,
                            from_currency=asset.currency,
                            to_currency=target_currency,
                            date=asset.ath_date
                        )
                        if not converted_ath:
                            # Fallback to current rate
                            converted_ath = CurrencyService.convert(
                                asset.ath_price,
                                from_currency=asset.currency,
                                to_currency=target_currency
                            )
                        if converted_ath:
                            ath_price_converted = converted_ath
                    else:
                        # No ATH date available, use current rate
                        converted_ath = CurrencyService.convert(
                            asset.ath_price,
                            from_currency=asset.currency,
                            to_currency=target_currency
                        )
                        if converted_ath:
                            ath_price_converted = converted_ath
                
                if ath_price_converted:
                    distance_to_ath_pct = ((current_price - ath_price_converted) / ath_price_converted) * Decimal(100)
            
            # Cost to Average Down (target PRU = 95% of current avg_cost)
            target_pru = avg_cost * Decimal("0.95")
            if current_price < avg_cost and target_pru > current_price:
                # Calculate shares needed to reach target PRU
                shares_needed = (avg_cost - target_pru) * quantity / (target_pru - current_price)
                cost_to_average_down = shares_needed * current_price
        
        # Calculate volatility (30d and 90d)
        volatility_30d = None
        volatility_90d = None
        
        from datetime import timedelta
        import math
        
        now = datetime.utcnow()
        
        # Get 30-day price history
        prices_30d = (
            self.db.query(Price.price, Price.asof)
            .filter(
                Price.asset_id == asset_id,
                Price.asof >= now - timedelta(days=30)
            )
            .order_by(Price.asof)
            .all()
        )
        
        if len(prices_30d) >= 2:
            # Calculate daily returns
            returns = []
            for i in range(1, len(prices_30d)):
                prev_price = Decimal(str(prices_30d[i-1][0]))
                curr_price = Decimal(str(prices_30d[i][0]))
                if prev_price > 0:
                    daily_return = float((curr_price - prev_price) / prev_price)
                    returns.append(daily_return)
            
            if returns:
                # Calculate standard deviation (volatility)
                mean_return = sum(returns) / len(returns)
                variance = sum((r - mean_return) ** 2 for r in returns) / len(returns)
                volatility_30d = math.sqrt(variance) * math.sqrt(252) * 100  # Annualized volatility
        
        # Get 90-day price history
        prices_90d = (
            self.db.query(Price.price, Price.asof)
            .filter(
                Price.asset_id == asset_id,
                Price.asof >= now - timedelta(days=90)
            )
            .order_by(Price.asof)
            .all()
        )
        
        if len(prices_90d) >= 2:
            returns = []
            for i in range(1, len(prices_90d)):
                prev_price = Decimal(str(prices_90d[i-1][0]))
                curr_price = Decimal(str(prices_90d[i][0]))
                if prev_price > 0:
                    daily_return = float((curr_price - prev_price) / prev_price)
                    returns.append(daily_return)
            
            if returns:
                mean_return = sum(returns) / len(returns)
                variance = sum((r - mean_return) ** 2 for r in returns) / len(returns)
                volatility_90d = math.sqrt(variance) * math.sqrt(252) * 100  # Annualized volatility
        
        # Calculate relative performance vs sector and Beta
        relative_perf_30d = None
        relative_perf_90d = None
        relative_perf_ytd = None
        relative_perf_1y = None
        asset_perf_30d = None
        asset_perf_90d = None
        asset_perf_ytd = None
        asset_perf_1y = None
        etf_perf_30d = None
        etf_perf_90d = None
        etf_perf_ytd = None
        etf_perf_1y = None
        sector_etf = None
        beta = None
        beta_benchmark = None
        
        if asset.sector:
            from app.services.relative_performance import RelativePerformanceService
            rel_perf_service = RelativePerformanceService(self.db)
            
            sector_etf = rel_perf_service.get_sector_etf(asset.sector)
            if sector_etf:
                rel_perf = rel_perf_service.calculate_relative_performance(
                    asset.symbol,
                    asset.sector,
                    current_price
                )
                relative_perf_30d = rel_perf.get('30d')
                relative_perf_90d = rel_perf.get('90d')
                relative_perf_ytd = rel_perf.get('ytd')
                relative_perf_1y = rel_perf.get('1y')
                asset_perf_30d = rel_perf.get('asset_30d')
                asset_perf_90d = rel_perf.get('asset_90d')
                asset_perf_ytd = rel_perf.get('asset_ytd')
                asset_perf_1y = rel_perf.get('asset_1y')
                etf_perf_30d = rel_perf.get('etf_30d')
                etf_perf_90d = rel_perf.get('etf_90d')
                etf_perf_ytd = rel_perf.get('etf_ytd')
                etf_perf_1y = rel_perf.get('etf_1y')
            
            # Calculate Beta
            beta_benchmark = rel_perf_service.get_beta_benchmark(asset.sector)
            beta = rel_perf_service.calculate_beta(asset_id, asset.sector, period_days=365)

        metrics = {
            'distance_to_ath_pct': float(distance_to_ath_pct) if distance_to_ath_pct is not None else None,
            'avg_buy_zone_pct': float(avg_buy_zone_pct) if avg_buy_zone_pct is not None else None,
            'personal_drawdown_pct': float(personal_drawdown_pct) if personal_drawdown_pct is not None else None,
            'local_ath_price': float(local_ath_price) if local_ath_price is not None else None,
            'local_ath_date': local_ath_date.isoformat() if local_ath_date else None,
            'cost_to_average_down': float(cost_to_average_down) if cost_to_average_down is not None else None,
            'volatility_30d': volatility_30d,
            'volatility_90d': volatility_90d,
            'beta': beta,
            'beta_benchmark': beta_benchmark,
            'relative_perf_30d': relative_perf_30d,
            'relative_perf_90d': relative_perf_90d,
            'relative_perf_ytd': relative_perf_ytd,
            'relative_perf_1y': relative_perf_1y,
            'asset_perf_30d': asset_perf_30d,
            'asset_perf_90d': asset_perf_90d,
            'asset_perf_ytd': asset_perf_ytd,
            'asset_perf_1y': asset_perf_1y,
            'etf_perf_30d': etf_perf_30d,
            'etf_perf_90d': etf_perf_90d,
            'etf_perf_ytd': etf_perf_ytd,
            'etf_perf_1y': etf_perf_1y,
            'sector_etf': sector_etf,
        }

        risk_score = MetricsService.calculate_risk_score(metrics)
        metrics["risk_score"] = risk_score
        
        return metrics


def get_metrics_service(db: Session = Depends(get_db)) -> MetricsService:
    """Dependency for getting metrics service"""
    return MetricsService(db)
