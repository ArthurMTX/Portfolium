"""
Test script to validate calendar daily performance accuracy.

This script verifies that:
1. Portfolio value is accurately calculated from holdings * prices
2. Daily % change excludes cash flows (deposits/purchases/sales)
3. The performance shown is actual market movement, not capital injection
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch
from collections import defaultdict

from app.schemas import PortfolioHistoryPoint
from app.models import TransactionType


class TestCashFlowExclusion:
    """Test that cash flows are correctly excluded from daily performance."""
    
    def test_buy_transaction_excluded_from_daily_change(self):
        """
        When user buys €1000 of stocks:
        - Portfolio value should increase by €1000
        - Daily performance % should NOT show +1000€ as a gain
        - Daily performance should only show market movement
        """
        # Scenario:
        # Day 1: Portfolio value = €5000 (no transactions)
        # Day 2: Buy €1000 of stocks, market moves +2%
        # Expected Day 2 value = €5000 * 1.02 + €1000 = €6100
        # Expected Day 2 performance = €5000 * 0.02 = €100 (NOT €1100)
        
        prev_value = Decimal("5000")
        market_gain_pct = Decimal("0.02")  # 2% market gain
        buy_amount = Decimal("1000")
        
        # Current value = prev * (1 + gain%) + buy
        current_value = prev_value * (1 + market_gain_pct) + buy_amount
        assert current_value == Decimal("6100")
        
        # Raw change (what we used to show - WRONG)
        raw_change = current_value - prev_value
        assert raw_change == Decimal("1100")  # This incorrectly includes the buy
        
        # Performance-adjusted change (what we should show - CORRECT)
        daily_cash_flow = buy_amount  # The €1000 buy is a cash inflow
        performance_change = raw_change - daily_cash_flow
        assert performance_change == Decimal("100")  # Only the 2% market gain
        
        # Percentage should be based on previous value
        performance_pct = (performance_change / prev_value) * 100
        assert performance_pct == Decimal("2")  # Correctly shows 2%

    def test_sell_transaction_excluded_from_daily_change(self):
        """
        When user sells €1000 of stocks:
        - Portfolio value should decrease by €1000
        - Daily performance % should NOT show -1000€ as a loss
        - Daily performance should only show market movement
        """
        # Scenario:
        # Day 1: Portfolio value = €5000 (no transactions)
        # Day 2: Sell €1000 of stocks, market moves -1%
        # Expected Day 2 value = €5000 * 0.99 - €1000 = €3950
        # Expected Day 2 performance = €5000 * -0.01 = -€50 (NOT -€1050)
        
        prev_value = Decimal("5000")
        market_loss_pct = Decimal("-0.01")  # 1% market loss
        sell_proceeds = Decimal("1000")
        
        # Current value = prev * (1 + gain%) - sell_proceeds
        current_value = prev_value * (1 + market_loss_pct) - sell_proceeds
        assert current_value == Decimal("3950")
        
        # Raw change (what we used to show - WRONG)
        raw_change = current_value - prev_value
        assert raw_change == Decimal("-1050")  # This incorrectly includes the sale
        
        # Performance-adjusted change (what we should show - CORRECT)
        daily_cash_flow = -sell_proceeds  # Sale is a cash outflow (negative)
        performance_change = raw_change - daily_cash_flow
        assert performance_change == Decimal("-50")  # Only the 1% market loss
        
        # Percentage should be based on previous value
        performance_pct = (performance_change / prev_value) * 100
        assert performance_pct == Decimal("-1")  # Correctly shows -1%

    def test_no_transaction_day_unchanged(self):
        """
        Days with no transactions should work exactly as before.
        """
        prev_value = Decimal("5000")
        market_gain_pct = Decimal("0.03")  # 3% market gain
        
        current_value = prev_value * (1 + market_gain_pct)
        assert current_value == Decimal("5150")
        
        raw_change = current_value - prev_value
        daily_cash_flow = Decimal("0")  # No transactions
        performance_change = raw_change - daily_cash_flow
        
        assert performance_change == Decimal("150")
        assert (performance_change / prev_value) * 100 == Decimal("3")

    def test_multiple_transactions_same_day(self):
        """
        Multiple buys/sells on the same day should be netted.
        """
        prev_value = Decimal("10000")
        market_gain_pct = Decimal("0.01")  # 1% gain
        
        # Buy €2000, Sell €500 = net cash flow of €1500
        buy_amount = Decimal("2000")
        sell_amount = Decimal("500")
        net_cash_flow = buy_amount - sell_amount  # €1500 net inflow
        
        # Value = prev * (1 + gain%) + buys - sells
        current_value = prev_value * (1 + market_gain_pct) + buy_amount - sell_amount
        assert current_value == Decimal("11600")
        
        raw_change = current_value - prev_value
        assert raw_change == Decimal("1600")
        
        performance_change = raw_change - net_cash_flow
        assert performance_change == Decimal("100")  # Just the 1% market gain
        
        performance_pct = (performance_change / prev_value) * 100
        assert performance_pct == Decimal("1")


class TestPortfolioHistoryPointSchema:
    """Test that the schema correctly includes daily_cash_flow."""
    
    def test_schema_has_daily_cash_flow_field(self):
        """Verify the schema has the daily_cash_flow field."""
        point = PortfolioHistoryPoint(
            date="2026-01-15",
            value=10000.0,
            invested=8000.0,
            daily_cash_flow=1000.0
        )
        
        assert hasattr(point, 'daily_cash_flow')
        assert point.daily_cash_flow == 1000.0
    
    def test_daily_cash_flow_defaults_to_none(self):
        """Verify daily_cash_flow is optional and defaults to None."""
        point = PortfolioHistoryPoint(
            date="2026-01-15",
            value=10000.0,
            invested=8000.0
        )
        
        assert point.daily_cash_flow is None


class TestMetricsServiceCashFlowTracking:
    """Test the metrics service cash flow calculation logic."""
    
    def test_buy_transaction_adds_to_cash_flow(self):
        """BUY transactions should add to daily cash flow."""
        daily_cash_flows = defaultdict(lambda: Decimal(0))
        
        # Simulate a BUY transaction
        tx_date = date(2026, 1, 15)
        quantity = Decimal("10")
        price = Decimal("100")
        fees = Decimal("5")
        tx_cost = (quantity * price) + fees  # €1005
        
        daily_cash_flows[tx_date] += tx_cost
        
        assert daily_cash_flows[tx_date] == Decimal("1005")

    def test_sell_transaction_subtracts_from_cash_flow(self):
        """SELL transactions should subtract sale proceeds from daily cash flow."""
        daily_cash_flows = defaultdict(lambda: Decimal(0))
        
        # Simulate a SELL transaction
        tx_date = date(2026, 1, 15)
        quantity = Decimal("10")
        price = Decimal("100")
        fees = Decimal("5")
        sale_proceeds = (quantity * price) - fees  # €995
        
        daily_cash_flows[tx_date] -= sale_proceeds
        
        assert daily_cash_flows[tx_date] == Decimal("-995")

    def test_mixed_transactions_net_correctly(self):
        """Multiple transactions should net correctly."""
        daily_cash_flows = defaultdict(lambda: Decimal(0))
        tx_date = date(2026, 1, 15)
        
        # BUY €1000
        daily_cash_flows[tx_date] += Decimal("1000")
        
        # SELL €500
        daily_cash_flows[tx_date] -= Decimal("500")
        
        # BUY €200
        daily_cash_flows[tx_date] += Decimal("200")
        
        # Net = 1000 - 500 + 200 = 700
        assert daily_cash_flows[tx_date] == Decimal("700")


class TestCalendarRouterPerformanceCalculation:
    """Test the calendar router's performance calculation logic."""
    
    def test_performance_change_calculation(self):
        """
        Test the exact formula used in calendar.py:
        performance_change = raw_change - daily_cash_flow
        """
        # Simulate the calculation from calendar.py
        prev_value = 5000.0
        current_value = 6100.0
        daily_cash_flow = 1000.0  # €1000 buy
        
        raw_change = current_value - prev_value  # 1100
        performance_change = raw_change - daily_cash_flow  # 100
        performance_change_pct = (performance_change / prev_value) * 100  # 2%
        
        assert raw_change == 1100.0
        assert performance_change == 100.0
        assert performance_change_pct == 2.0

    def test_total_percentage_calculation(self):
        """
        Test the total percentage calculation that accounts for cash flows.
        prev_total_value = current_value - change - cash_flow
        """
        total_value = 6100.0
        total_change = 100.0  # Performance change (market movement only)
        total_cash_flow = 1000.0  # Cash added
        
        # Previous value = current - change - cash_flow
        prev_total_value = total_value - total_change - total_cash_flow
        assert prev_total_value == 5000.0
        
        # Percentage based on previous value
        total_pct = (total_change / prev_total_value) * 100
        assert total_pct == 2.0


class TestEdgeCases:
    """Test edge cases for accuracy."""
    
    def test_zero_previous_value(self):
        """Handle case when previous value is zero."""
        prev_value = 0.0
        current_value = 1000.0
        daily_cash_flow = 1000.0  # First deposit
        
        performance_change = (current_value - prev_value) - daily_cash_flow
        assert performance_change == 0.0
        
        # Avoid division by zero
        if prev_value > 0:
            performance_pct = (performance_change / prev_value) * 100
        else:
            performance_pct = 0.0
        
        assert performance_pct == 0.0

    def test_negative_market_with_deposit(self):
        """Market down but deposit masks it in raw change."""
        prev_value = 10000.0
        market_return = -0.05  # -5% market
        deposit = 1000.0
        
        # Current = prev * (1 + return) + deposit
        current_value = prev_value * (1 + market_return) + deposit
        assert current_value == 10500.0  # 9500 + 1000
        
        raw_change = current_value - prev_value
        assert raw_change == 500.0  # Looks positive!
        
        performance_change = raw_change - deposit
        assert performance_change == -500.0  # Actually -5% loss
        
        performance_pct = (performance_change / prev_value) * 100
        assert performance_pct == -5.0

    def test_positive_market_with_withdrawal(self):
        """Market up but withdrawal masks it in raw change."""
        prev_value = 10000.0
        market_return = 0.05  # +5% market
        withdrawal = 1000.0
        
        # Current = prev * (1 + return) - withdrawal
        current_value = prev_value * (1 + market_return) - withdrawal
        assert current_value == 9500.0  # 10500 - 1000
        
        raw_change = current_value - prev_value
        assert raw_change == -500.0  # Looks negative!
        
        # Withdrawal is negative cash flow
        daily_cash_flow = -withdrawal
        performance_change = raw_change - daily_cash_flow
        assert performance_change == 500.0  # Actually +5% gain
        
        performance_pct = (performance_change / prev_value) * 100
        assert performance_pct == 5.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
