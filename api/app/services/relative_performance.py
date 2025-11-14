"""
Relative performance calculation service - compare assets to sector benchmarks
"""
import logging
from decimal import Decimal
from typing import Dict, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
import yfinance as yf

from app.models import Asset, Price

logger = logging.getLogger(__name__)

# SPDR Sector ETF mapping (for relative performance)
# These map to the sector names from sectorIndustryUtils.ts
SECTOR_ETF_MAPPING = {
    "Technology": "XLK",
    "Communication Services": "XLC",
    "Healthcare": "XLV",
    "Financial Services": "XLF",
    "Energy": "XLE",
    "Utilities": "XLU",
    "Consumer Cyclical": "XLY",
    "Consumer Defensive": "XLP",
    "Industrials": "XLI",
    "Basic Materials": "XLB",
    "Real Estate": "XLRE",
}

# Beta benchmark mapping (logical market correlation)
# These map to the sector names from sectorIndustryUtils.ts
BETA_BENCHMARK_MAPPING = {
    "Technology": "QQQ",                    # Tech/momentum = NASDAQ
    "Communication Services": "QQQ",        # Usually tech-heavy
    "Consumer Cyclical": "SPY",             # Mix tech + retail + autos
    "Industrials": "SPY",                   # Global US market influence
    "Financial Services": "SPY",            # Banking follows S&P
    "Healthcare": "SPY",                    # Pharma is very S&P correlated
    "Energy": "XLE",                        # Cyclical sector specific
    "Basic Materials": "XLB",               # US commodities
    "Real Estate": "XLRE",                  # Specific sector
    "Utilities": "XLU",                     # Defensive
    "Consumer Defensive": "XLP",            # Solid values
}


class RelativePerformanceService:
    """Service to calculate relative performance vs sector benchmarks"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_sector_etf(self, sector: Optional[str]) -> Optional[str]:
        """Get the SPDR ETF symbol for a given sector"""
        if not sector:
            logger.warning("No sector provided for ETF mapping")
            return None
        
        etf = SECTOR_ETF_MAPPING.get(sector)
        if not etf:
            logger.warning(f"No ETF mapping found for sector: '{sector}'. Available sectors: {list(SECTOR_ETF_MAPPING.keys())}")
        return etf
    
    def get_beta_benchmark(self, sector: Optional[str]) -> str:
        """Get the appropriate benchmark for Beta calculation based on sector"""
        if not sector:
            return "SPY"  # Default fallback
        return BETA_BENCHMARK_MAPPING.get(sector, "SPY")
    
    def _get_price_at_date(self, symbol: str, target_date: datetime, is_etf: bool = False) -> Optional[Decimal]:
        """
        Get price closest to target date (within 7 days)
        For ETFs not in DB, fetches from yfinance API
        """
        if not is_etf:
            # For user assets, check database first
            price_record = (
                self.db.query(Price)
                .join(Asset, Price.asset_id == Asset.id)
                .filter(
                    Asset.symbol == symbol,
                    Price.asof >= target_date - timedelta(days=7),
                    Price.asof <= target_date
                )
                .order_by(Price.asof.desc())
                .first()
            )
            
            if price_record:
                return Decimal(str(price_record.price))
            
            # If no price found before, try after (within 7 days)
            price_record = (
                self.db.query(Price)
                .join(Asset, Price.asset_id == Asset.id)
                .filter(
                    Asset.symbol == symbol,
                    Price.asof > target_date,
                    Price.asof <= target_date + timedelta(days=7)
                )
                .order_by(Price.asof.asc())
                .first()
            )
            
            if price_record:
                return Decimal(str(price_record.price))
        
        # For ETFs or if DB lookup failed, fetch from yfinance
        try:
            ticker = yf.Ticker(symbol)
            
            # Ensure target_date is timezone-naive for datetime arithmetic
            if target_date.tzinfo is not None:
                target_date = target_date.replace(tzinfo=None)
            
            # Fetch historical data around target date (±7 days window)
            start = (target_date - timedelta(days=7)).strftime('%Y-%m-%d')
            end = (target_date + timedelta(days=7)).strftime('%Y-%m-%d')
            
            hist = ticker.history(start=start, end=end)
            
            if hist.empty:
                logger.warning(f"No price data found for {symbol} around {target_date.date()}")
                return None
            
            # Convert index to timezone-naive for comparison
            hist.index = hist.index.tz_localize(None)
            
            # Find the closest date to target_date
            time_diffs = abs(hist.index - target_date)
            closest_idx = time_diffs.argmin()
            closest_price = hist.iloc[closest_idx]['Close']
            closest_date = hist.index[closest_idx].date()
            
            logger.debug(f"Fetched {symbol} price from yfinance: {closest_price} on {closest_date}")
            return Decimal(str(closest_price))
            
        except Exception as e:
            logger.error(f"Error fetching price for {symbol} from yfinance: {e}")
            return None
    
    def _calculate_return(
        self, 
        start_price: Decimal, 
        end_price: Decimal
    ) -> Decimal:
        """Calculate percentage return between two prices"""
        if start_price <= 0:
            return Decimal(0)
        return ((end_price - start_price) / start_price) * Decimal(100)
    
    def calculate_relative_performance(
        self,
        asset_symbol: str,
        sector: Optional[str],
        current_price: Decimal
    ) -> Dict[str, Optional[Decimal]]:
        """
        Calculate relative performance vs sector ETF for multiple time periods
        
        Returns dict with keys: '30d', '90d', 'ytd', '1y' for relative performance
        Also includes 'asset_30d', 'asset_90d', etc. for asset returns
        And 'etf_30d', 'etf_90d', etc. for ETF returns
        """
        result = {
            '30d': None,
            '90d': None,
            'ytd': None,
            '1y': None,
            'asset_30d': None,
            'asset_90d': None,
            'asset_ytd': None,
            'asset_1y': None,
            'etf_30d': None,
            'etf_90d': None,
            'etf_ytd': None,
            'etf_1y': None
        }
        
        # Get sector ETF
        etf_symbol = self.get_sector_etf(sector)
        if not etf_symbol:
            logger.debug(f"No sector ETF mapping for sector: {sector}")
            return result
        
        # Get current ETF price from yfinance
        try:
            ticker = yf.Ticker(etf_symbol)
            hist = ticker.history(period="5d")  # Get last 5 days to ensure we have data
            
            if hist.empty:
                logger.warning(f"No current price data for ETF {etf_symbol}")
                return result
            
            etf_current_price = Decimal(str(hist.iloc[-1]['Close']))
            logger.debug(f"Current {etf_symbol} price: {etf_current_price}")
            
        except Exception as e:
            logger.error(f"Error fetching current price for {etf_symbol}: {e}")
            return result
        
        # Calculate for each time period
        now = datetime.utcnow()
        
        periods = {
            '30d': now - timedelta(days=30),
            '90d': now - timedelta(days=90),
            'ytd': datetime(now.year, 1, 1),
            '1y': now - timedelta(days=365)
        }
        
        for period_key, start_date in periods.items():
            # Get asset price at start date (from database)
            asset_start_price = self._get_price_at_date(asset_symbol, start_date, is_etf=False)
            if not asset_start_price:
                logger.debug(f"No price found for {asset_symbol} at {start_date.date()} ({period_key})")
                continue
            
            # Get ETF price at start date (from yfinance)
            etf_start_price = self._get_price_at_date(etf_symbol, start_date, is_etf=True)
            if not etf_start_price:
                logger.debug(f"No price found for {etf_symbol} at {start_date.date()} ({period_key})")
                continue
            
            # Calculate returns
            asset_return = self._calculate_return(asset_start_price, current_price)
            etf_return = self._calculate_return(etf_start_price, etf_current_price)
            
            # Relative performance = asset return - benchmark return
            relative_perf = asset_return - etf_return
            
            result[period_key] = relative_perf
            result[f'asset_{period_key}'] = asset_return
            result[f'etf_{period_key}'] = etf_return
            
            logger.debug(
                f"{asset_symbol} vs {etf_symbol} ({period_key}): "
                f"Asset: {asset_return:.2f}%, ETF: {etf_return:.2f}%, "
                f"Relative: {relative_perf:.2f}%"
            )
        
        return result
    
    def calculate_beta(
        self,
        asset_id: int,
        sector: Optional[str],
        period_days: int = 365
    ) -> Optional[float]:
        """
        Calculate Beta (volatility relative to benchmark)
        Beta = Covariance(Asset, Benchmark) / Variance(Benchmark)
        
        Beta > 1: More volatile than benchmark
        Beta = 1: Same volatility as benchmark  
        Beta < 1: Less volatile than benchmark
        """
        benchmark_symbol = self.get_beta_benchmark(sector)
        if not benchmark_symbol:
            logger.warning(f"No beta benchmark for sector={sector}")
            return None
        
        # Get asset from database
        asset = self.db.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            return None
        
        from datetime import datetime, timedelta
        start_date = datetime.utcnow() - timedelta(days=period_days)
        
        # Get historical prices for the asset (from database)
        asset_prices = (
            self.db.query(Price.price, Price.asof)
            .filter(
                Price.asset_id == asset_id,
                Price.asof >= start_date
            )
            .order_by(Price.asof)
            .all()
        )
        
        if len(asset_prices) < 30:  # Need minimum data points
            logger.warning(f"Insufficient price history for {asset.symbol} to calculate Beta")
            return None
        
        try:
            # Get benchmark prices from yfinance
            ticker = yf.Ticker(benchmark_symbol)
            hist = ticker.history(
                start=start_date.strftime('%Y-%m-%d'),
                end=datetime.utcnow().strftime('%Y-%m-%d')
            )
            
            if hist.empty or len(hist) < 30:
                logger.warning(f"Insufficient benchmark data for {benchmark_symbol}")
                return None
            
            # Normalize timezone
            hist.index = hist.index.tz_localize(None)
            
            # Convert asset prices to date → price dict
            asset_dict = {
                asof.date(): float(price)
                for (price, asof) in asset_prices
            }
            
            # Convert benchmark prices to date → price dict
            benchmark_dict = {
                idx.date(): float(hist.iloc[i]['Close'])
                for i, idx in enumerate(hist.index)
            }
            
            # Intersection of dates
            shared_dates = sorted(set(asset_dict.keys()) & set(benchmark_dict.keys()))
            
            if len(shared_dates) < 30:
                logger.warning("Not enough aligned dates for Beta calculation")
                return None
            
            asset_returns: list[float] = []
            benchmark_returns: list[float] = []
            
            for i in range(1, len(shared_dates)):
                d0 = shared_dates[i - 1]
                d1 = shared_dates[i]
                
                prev_asset = asset_dict[d0]
                curr_asset = asset_dict[d1]
                prev_bench = benchmark_dict[d0]
                curr_bench = benchmark_dict[d1]
                
                if prev_asset > 0 and prev_bench > 0:
                    r_asset = (curr_asset - prev_asset) / prev_asset
                    r_bench = (curr_bench - prev_bench) / prev_bench
                    asset_returns.append(r_asset)
                    benchmark_returns.append(r_bench)
            
            if len(asset_returns) < 30:
                logger.warning("Not enough valid return pairs for Beta calculation")
                return None
            
            asset_mean = sum(asset_returns) / len(asset_returns)
            benchmark_mean = sum(benchmark_returns) / len(benchmark_returns)
            
            n = len(asset_returns)
            covariance = sum(
                (asset_returns[i] - asset_mean) * (benchmark_returns[i] - benchmark_mean)
                for i in range(n)
            ) / (n - 1)
            
            benchmark_variance = sum(
                (r - benchmark_mean) ** 2 for r in benchmark_returns
            ) / (n - 1)
            
            if benchmark_variance == 0:
                logger.warning(f"Benchmark variance is zero, cannot calculate Beta")
                return None
            
            beta = covariance / benchmark_variance
            
            logger.info(f"Calculated Beta for {asset.symbol} vs {benchmark_symbol}: {beta:.2f}")
            return beta
        
        except Exception as e:
            logger.error(f"Error calculating Beta for {asset.symbol}: {e}")
            return None
