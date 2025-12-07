"""
Fundamental data service - fetches company fundamentals from yfinance
"""
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class FundamentalsService:
    """Service for fetching fundamental data from yfinance"""
    
    @staticmethod
    def fetch_fundamentals(symbol: str) -> Dict[str, Optional[float]]:
        """
        Fetch fundamental data for an asset from yfinance
        
        Returns a dictionary with all available fundamental metrics:
        - market_cap, volume, avg_volume, pe_ratio, eps, price
        - revenue_growth, earnings_growth, profit_margins, operating_margins, return_on_equity
        - debt_to_equity, current_ratio, quick_ratio, net_cash
        - recommendation_key, recommendation_mean, num_analysts
        - target_mean, target_high, target_low, implied_upside_pct
        """
        try:
            import yfinance as yf
            ticker = yf.Ticker(symbol)
            info = ticker.info
            
            if not info:
                logger.warning(f"No info data available for {symbol}")
                return {}
            
            # Basic metrics
            market_cap = info.get('marketCap')
            volume = info.get('volume')
            avg_volume = info.get('averageVolume')
            pe_ratio = info.get('trailingPE') or info.get('forwardPE')
            eps = info.get('trailingEps')
            price = info.get('currentPrice')
            
            # Growth & Profitability
            revenue_growth = info.get('revenueGrowth')
            earnings_growth = info.get('earningsGrowth')
            profit_margins = info.get('profitMargins')
            operating_margins = info.get('operatingMargins')
            return_on_equity = info.get('returnOnEquity')
            
            # Balance Sheet Health
            debt_to_equity = info.get('debtToEquity')
            current_ratio = info.get('currentRatio')
            quick_ratio = info.get('quickRatio')
            total_cash = info.get('totalCash')
            total_debt = info.get('totalDebt')
            net_cash = (total_cash - total_debt) if total_cash is not None and total_debt is not None else None
            
            # Analyst View & Valuation
            recommendation_key = info.get('recommendationKey')
            recommendation_mean = info.get('recommendationMean')
            num_analysts = info.get('numberOfAnalystOpinions')
            target_mean = info.get('targetMeanPrice')
            target_high = info.get('targetHighPrice')
            target_low = info.get('targetLowPrice')
            
            # Calculate implied upside
            implied_upside_pct = None
            if target_mean and price:
                implied_upside_pct = ((target_mean - price) / price) * 100
            
            # Calculate liquidity score
            liquidity_score = FundamentalsService.compute_liquidity_score(
                price=price,
                volume=volume,
                avg_volume=avg_volume,
                market_cap=market_cap
            )
            
            return {
                'market_cap': market_cap,
                'volume': volume,
                'avg_volume': avg_volume,
                'pe_ratio': pe_ratio,
                'eps': eps,
                'price': price,
                'liquidity_score': liquidity_score,
                'revenue_growth': revenue_growth,
                'earnings_growth': earnings_growth,
                'profit_margins': profit_margins,
                'operating_margins': operating_margins,
                'return_on_equity': return_on_equity,
                'debt_to_equity': debt_to_equity,
                'current_ratio': current_ratio,
                'quick_ratio': quick_ratio,
                'net_cash': net_cash,
                'recommendation_key': recommendation_key,
                'recommendation_mean': recommendation_mean,
                'num_analysts': num_analysts,
                'target_mean': target_mean,
                'target_high': target_high,
                'target_low': target_low,
                'implied_upside_pct': implied_upside_pct
            }
            
        except Exception as e:
            logger.warning(f"Failed to fetch yfinance fundamentals for {symbol}: {str(e)}")
            return {}
    
    @staticmethod
    def compute_liquidity_score(
        price: Optional[float],
        volume: Optional[float],
        avg_volume: Optional[float],
        market_cap: Optional[float]
    ) -> Optional[float]:
        """
        Calculate a liquidity score (0-100) based on volume, market cap, and price
        
        Score breakdown:
        - Volume (50%): Current volume vs average volume
        - Market Cap (30%): Company size
        - Price (20%): Stock price level
        """
        if not all([price, volume, avg_volume, market_cap]):
            return None
        
        volume_ratio = volume / avg_volume if avg_volume > 0 else 0.0
        
        # Volume score (50% weight)
        if volume_ratio >= 2:
            score_v = 100
        elif volume_ratio >= 1:
            score_v = 80
        elif volume_ratio >= 0.6:
            score_v = 60
        elif volume_ratio >= 0.3:
            score_v = 30
        else:
            score_v = 10
        
        # Market cap score (30% weight)
        if market_cap >= 50e9:
            score_mc = 100
        elif market_cap >= 10e9:
            score_mc = 80
        elif market_cap >= 2e9:
            score_mc = 60
        elif market_cap >= 300e6:
            score_mc = 30
        else:
            score_mc = 10
        
        # Price score (20% weight)
        if price >= 20:
            score_p = 100
        elif price >= 5:
            score_p = 70
        elif price >= 1:
            score_p = 40
        else:
            score_p = 10
        
        liquidity_score = score_v * 0.5 + score_mc * 0.3 + score_p * 0.2
        return round(liquidity_score, 1)
