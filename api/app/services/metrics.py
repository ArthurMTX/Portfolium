"""
Portfolio metrics calculation service (PRU, P&L, positions)
"""
import logging
from decimal import Decimal
from typing import List, Dict, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import Depends

from app.models import Transaction, Asset, TransactionType
from app.schemas import Position, PortfolioMetrics
from app.crud import prices as crud_prices
from app.db import get_db

logger = logging.getLogger(__name__)


class MetricsService:
    """Service for calculating portfolio metrics"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_positions(self, portfolio_id: int) -> List[Position]:
        """
        Calculate current positions for a portfolio
        
        For each asset:
        - Net quantity (BUY/TRANSFER_IN - SELL/TRANSFER_OUT, adjusted for SPLIT)
        - Average cost (PRU - Prix de Revient Unitaire)
        - Current market value
        - Unrealized P&L
        """
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
        
        positions = []
        for asset_id, txs in asset_txs.items():
            position = self._calculate_position(asset_id, txs)
            if position and position.quantity > 0:
                positions.append(position)
        
        return positions
    
    def get_metrics(self, portfolio_id: int) -> PortfolioMetrics:
        """Calculate portfolio-level metrics"""
        from app.crud.portfolios import get_portfolio
        
        portfolio = get_portfolio(self.db, portfolio_id)
        if not portfolio:
            raise ValueError(f"Portfolio {portfolio_id} not found")
        
        positions = self.get_positions(portfolio_id)
        
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
        
        # Calculate realized P&L and dividends
        realized_pnl = self._calculate_realized_pnl(portfolio_id)
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
            last_updated=datetime.utcnow()
        )
    
    def _calculate_position(
        self, 
        asset_id: int, 
        transactions: List[Transaction]
    ) -> Optional[Position]:
        """Calculate position for a single asset"""
        asset = self.db.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            return None
        
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
                # Reduce cost basis proportionally (FIFO simplification)
                if total_shares_for_cost > 0:
                    avg_cost = total_cost / total_shares_for_cost
                    cost_reduction = tx.quantity * avg_cost
                    total_cost -= cost_reduction
                    total_shares_for_cost -= tx.quantity
                
            elif tx.type == TransactionType.SPLIT:
                # Handle stock split (e.g., 2:1 means double shares, half price)
                split_ratio = self._parse_split_ratio(tx.meta_data.get("split", "1:1"))
                quantity *= split_ratio
                total_shares_for_cost *= split_ratio
                # Cost basis stays the same, just spread over more shares
        
        if quantity <= 0:
            return None
        
        # Calculate average cost (PRU)
        avg_cost = total_cost / quantity if quantity > 0 else Decimal(0)
        
        # Get current price and daily change from pricing service
        from app.services.pricing import PricingService
        pricing_service = PricingService(self.db)
        
        price_quote = pricing_service.get_price(asset.symbol)
        current_price = price_quote.price if price_quote else None
        daily_change_pct = price_quote.daily_change_pct if price_quote else None
        last_updated = price_quote.asof if price_quote else None
        
        # Calculate market value and P&L
        market_value = quantity * current_price if current_price else None
        unrealized_pnl = None
        unrealized_pnl_pct = None
        
        if market_value:
            unrealized_pnl = market_value - total_cost
            unrealized_pnl_pct = (
                (unrealized_pnl / total_cost * 100) if total_cost > 0 else Decimal(0)
            )
        
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
            currency=asset.currency,
            last_updated=last_updated,
            asset_type=asset.asset_type
        )
    
    def _calculate_realized_pnl(self, portfolio_id: int) -> Decimal:
        """Calculate realized P&L from SELL transactions"""
        # Simplified: sum of (sell_price - avg_cost) * quantity for all sells
        # In production, use proper FIFO/LIFO lot tracking
        
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
        Return portfolio value history for charting (daily, weekly, etc.)
        - Uses historical prices from DB (no external calls)
        - Values are computed as of each bucket date (quantity as-of date * last known price <= date)
        - Buckets are limited for performance
        """
        from app.schemas import PortfolioHistoryPoint
        from datetime import timedelta, date
        from app.models import Portfolio as PortfolioModel
        portfolio = self.db.query(PortfolioModel).filter_by(id=portfolio_id).first()
        if not portfolio:
            raise ValueError(f"Portfolio {portfolio_id} not found")

        # Get all transactions for portfolio
        transactions = (
            self.db.query(Transaction)
            .filter(Transaction.portfolio_id == portfolio_id)
            .order_by(Transaction.tx_date, Transaction.created_at)
            .all()
        )
        if not transactions:
            return []

        # Determine date range
        first_tx_date: date = transactions[0].tx_date
        today: date = datetime.utcnow().date()
        end_date: date = today
        start_date: date = first_tx_date

        # Build time buckets (limit count for performance)
        buckets: list[date] = []
        if interval == "daily":
            # Last 30 days daily
            start_date = max(first_tx_date, today - timedelta(days=30))
            step = timedelta(days=1)
        elif interval == "weekly":
            # Last 26 weeks weekly
            start_date = max(first_tx_date, today - timedelta(weeks=26))
            step = timedelta(weeks=1)
        elif interval == "6months":
            # Approx weekly over last 6 months
            start_date = max(first_tx_date, today - timedelta(days=180))
            step = timedelta(days=7)
        elif interval == "ytd":
            start_date = max(first_tx_date, date(today.year, 1, 1))
            step = timedelta(days=7)
        elif interval == "1year":
            start_date = max(first_tx_date, today - timedelta(days=365))
            step = timedelta(days=7)
        elif interval == "all":
            # Monthly sampling over entire history
            start_date = first_tx_date
            step = timedelta(days=30)
        else:
            start_date = max(first_tx_date, today - timedelta(days=30))
            step = timedelta(days=1)

        current = start_date
        while current <= end_date:
            buckets.append(current)
            current += step

        # Prepare transactions grouped per asset for faster iteration
        asset_txs: Dict[int, List[Transaction]] = {}
        for tx in transactions:
            asset_txs.setdefault(tx.asset_id, []).append(tx)

        # Preload price history per asset within range, ascending order
        from app.crud import prices as crud_prices
        # Optional: fetch missing history for accuracy if DB lacks data
        try:
            from app.services.pricing import PricingService
            pricing_service = PricingService(self.db)
        except Exception:
            pricing_service = None
        asset_prices: Dict[int, List] = {}
        for asset_id in asset_txs.keys():
            prices = crud_prices.get_prices(
                self.db,
                asset_id,
                date_from=datetime.combine(start_date, datetime.min.time()) - timedelta(days=7),
                date_to=datetime.combine(end_date, datetime.max.time()),
                limit=10000,
            )
            # get_prices returns desc; reverse to asc for pointer iteration
            asset_prices[asset_id] = list(reversed(prices))
            if pricing_service and len(asset_prices[asset_id]) == 0:
                # try to backfill historical prices to make chart meaningful
                asset = self.db.query(Asset).filter(Asset.id == asset_id).first()
                if asset:
                    pricing_service.ensure_historical_prices(asset, datetime.combine(start_date, datetime.min.time()), datetime.combine(end_date, datetime.max.time()))
                    # re-read
                    prices2 = crud_prices.get_prices(
                        self.db,
                        asset_id,
                        date_from=datetime.combine(start_date, datetime.min.time()) - timedelta(days=7),
                        date_to=datetime.combine(end_date, datetime.max.time()),
                        limit=10000,
                    )
                    asset_prices[asset_id] = list(reversed(prices2))

        # For each asset, maintain pointers for transactions and prices
        tx_ptr: Dict[int, int] = {aid: 0 for aid in asset_txs.keys()}
        px_ptr: Dict[int, int] = {aid: 0 for aid in asset_txs.keys()}
        current_qty: Dict[int, Decimal] = {aid: Decimal(0) for aid in asset_txs.keys()}

        history: List[PortfolioHistoryPoint] = []

        for bucket_date in buckets:
            bucket_dt = datetime.combine(bucket_date, datetime.max.time())

            # Advance quantities up to bucket_date per asset
            for aid, txs in asset_txs.items():
                i = tx_ptr[aid]
                while i < len(txs) and txs[i].tx_date <= bucket_date:
                    tx = txs[i]
                    if tx.type == TransactionType.BUY or tx.type == TransactionType.TRANSFER_IN:
                        current_qty[aid] += tx.quantity
                    elif tx.type == TransactionType.SELL or tx.type == TransactionType.TRANSFER_OUT:
                        current_qty[aid] -= tx.quantity
                    elif tx.type == TransactionType.SPLIT:
                        ratio = self._parse_split_ratio((tx.meta_data or {}).get("split", "1:1"))
                        current_qty[aid] *= ratio
                    i += 1
                tx_ptr[aid] = i

            # Compute value using last known price <= bucket_date
            total_value = Decimal(0)
            for aid, qty in current_qty.items():
                if qty <= 0:
                    continue
                prices = asset_prices.get(aid, [])
                j = px_ptr[aid]
                # Move pointer forward while price asof <= bucket_dt
                while j < len(prices) and prices[j].asof <= bucket_dt:
                    j += 1
                # The last valid price is j-1
                use_idx = j - 1
                if use_idx >= 0 and use_idx < len(prices):
                    price_val = prices[use_idx].price
                    total_value += qty * price_val
                px_ptr[aid] = j

            history.append(PortfolioHistoryPoint(date=bucket_date.isoformat(), value=float(total_value)))

        return history


def get_metrics_service(db: Session = Depends(get_db)) -> MetricsService:
    """Dependency for getting metrics service"""
    return MetricsService(db)
