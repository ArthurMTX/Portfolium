
from decimal import Decimal
from datetime import date, timedelta, datetime
from unittest.mock import Mock
import math

from app.services.insights import InsightsService
from app.schemas import RiskMetrics

class TestSharpeFix:
    """Test Sharpe ratio fix with cash flows"""
    
    def test_sharpe_with_deposits(self):
        """Test that deposits don't cause artificial return spikes"""
        # Mock DB session
        db = Mock()
        service = InsightsService(db)
        
        # Mock _get_date_range
        service._get_date_range = Mock(return_value=(date(2023, 1, 1), date(2023, 1, 4)))
        
        # Mock _calculate_beta
        service._calculate_beta = Mock(return_value=Decimal("1.0"))
        
        # Mock _percentile to avoid complex logic dep
        service._percentile = Mock(return_value=0.0)
        
        # Create performance data with a deposit
        # Day 0: Start
        # Day 1: 10% gain
        # Day 2: Deposit 1000 (doubling capital), flat performance
        # Day 3: 10% gain
        
        perf_data = [
            (date(2023, 1, 1), Decimal("1000"), Decimal("1000")),
            (date(2023, 1, 2), Decimal("1100"), Decimal("1000")), # +10%
            (date(2023, 1, 3), Decimal("2100"), Decimal("2000")), # Deposit 1000, 0% return
            (date(2023, 1, 4), Decimal("2310"), Decimal("2000")), # +10%
        ]
        
        # Mock _get_daily_portfolio_performance
        service._get_daily_portfolio_performance = Mock(return_value=perf_data)
        
        # Run calculation
        metrics = service._calculate_risk_metrics(1, "1w")
        
        # Verify Volatility
        # Returns should be [0.10, 0.0, 0.10]
        # Mean = 0.0667
        # Variance = ((0.0333^2 + (-0.0667)^2 + 0.0333^2) / 3) = 0.00222
        # Daily Vol = 0.04714
        # Annual Vol = 0.04714 * sqrt(252) = 0.748
        
        vol = float(metrics.volatility)
        print(f"Volatility: {vol}")
        
        # It should be around 74.8%
        assert 70.0 < vol < 80.0
        
        # Verify Sharpe Ratio
        # It should NOT be huge.
        # If it was using old logic, Day 2 return would be 90%, leading to massive mean return and massive vol.
        
        sharpe = float(metrics.sharpe_ratio)
        print(f"Sharpe: {sharpe}")
        
        # With 21% total return over 3 days, annualized return is huge, so Sharpe will be large, 
        # but let's check if it's "sane" given the inputs.
        # Annualized Return = (1.21)^(365.25/3) - 1 ~= 1.21^121 ~= huge.
        # So Sharpe might still be large because the return IS large (20% in 3 days).
        # But it shouldn't be based on a 90% one-day return.
        
        # Let's try a more modest scenario to ensure Sharpe is reasonable.
        
    def test_sharpe_flat_with_deposit(self):
        """Test flat performance with a deposit"""
        db = Mock()
        service = InsightsService(db)
        service._get_date_range = Mock(return_value=(date(2023, 1, 1), date(2023, 1, 4)))
        service._calculate_beta = Mock(return_value=Decimal("1.0"))
        service._percentile = Mock(return_value=0.0)
        
        # Flat performance, but doubling money
        perf_data = [
            (date(2023, 1, 1), Decimal("1000"), Decimal("1000")),
            (date(2023, 1, 2), Decimal("1000"), Decimal("1000")), # 0%
            (date(2023, 1, 3), Decimal("2000"), Decimal("2000")), # Deposit 1000, 0% return
            (date(2023, 1, 4), Decimal("2000"), Decimal("2000")), # 0%
        ]
        
        service._get_daily_portfolio_performance = Mock(return_value=perf_data)
        
        metrics = service._calculate_risk_metrics(1, "1w")
        
        # Returns should be [0, 0, 0]
        # Volatility should be 0
        # Sharpe should be None (since vol is 0)
        
        assert float(metrics.volatility) == 0.0
        assert metrics.sharpe_ratio is None
        
        # Old logic would have seen a 100% return on day 2 and calculated high vol and high sharpe.

if __name__ == "__main__":
    # Manually run if executed as script
    t = TestSharpeFix()
    t.test_sharpe_with_deposits()
    t.test_sharpe_flat_with_deposit()
    print("All tests passed!")
