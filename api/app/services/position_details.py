"""
Position detailed metrics service - calculates detailed metrics for individual positions
"""
import logging
from typing import Dict, Optional
from decimal import Decimal
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import Transaction, Asset, TransactionType, Price, Portfolio
from app.services.currency import CurrencyService
from app.services.fundamentals import FundamentalsService
from app.services.risk_analysis import RiskAnalysisService

logger = logging.getLogger(__name__)


class PositionDetailsService:
    """Service for calculating detailed position metrics"""
    
    def __init__(self, db: Session):
        self.db = db
        self.risk_service = RiskAnalysisService(db)
    
    @staticmethod
    def _parse_split_ratio(split_str: str) -> Decimal:
        """Parse split ratio string like '2:1' or '1:10' into a multiplier"""
        try:
            parts = split_str.split(':')
            if len(parts) == 2:
                numerator = Decimal(parts[0])
                denominator = Decimal(parts[1])
                if denominator > 0:
                    return numerator / denominator
        except Exception as e:
            logger.warning(f"Failed to parse split ratio '{split_str}': {e}")
        return Decimal(1)
    
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
            if tx.type in [TransactionType.BUY, TransactionType.TRANSFER_IN, TransactionType.CONVERSION_IN]:
                quantity += tx.quantity
                cost = (tx.quantity * tx.price) + tx.fees
                total_cost += cost
                total_shares_for_cost += tx.quantity
            elif tx.type in [TransactionType.SELL, TransactionType.TRANSFER_OUT, TransactionType.CONVERSION_OUT]:
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
        
        # Calculate position-specific metrics
        distance_to_ath_pct = None
        avg_buy_zone_pct = None
        personal_drawdown_pct = None
        local_ath_price = None
        local_ath_date = None
        cost_to_average_down = None
        
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
        volatility_30d = self.risk_service.calculate_volatility(asset_id, days=30)
        volatility_90d = self.risk_service.calculate_volatility(asset_id, days=90)
        
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

        # Fetch fundamental data
        fundamentals = FundamentalsService.fetch_fundamentals(asset.symbol)
        
        # Build metrics dictionary
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
            'asset_currency': asset.currency,
        }
        
        # Add fundamental data
        metrics.update(fundamentals)
        
        # Calculate risk score
        risk_score = RiskAnalysisService.calculate_risk_score(metrics)
        metrics["risk_score"] = risk_score
        
        return metrics
