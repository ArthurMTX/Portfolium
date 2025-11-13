"""
Tests for stock splits and position calculations in metrics service
"""
import pytest
from decimal import Decimal
from datetime import date, datetime, timedelta

from app.models import TransactionType
from app.services.metrics import MetricsService
from tests.factories import (
    UserFactory, PortfolioFactory, AssetFactory, 
    TransactionFactory, PriceFactory
)


@pytest.mark.unit
@pytest.mark.service
class TestSplitRatioParsing:
    """Test split ratio string parsing"""
    
    def test_parse_2_for_1_split(self, test_db):
        """Test parsing 2:1 split"""
        service = MetricsService(test_db)
        
        ratio = service._parse_split_ratio("2:1")
        assert ratio == Decimal("2.0")
    
    def test_parse_1_for_2_reverse_split(self, test_db):
        """Test parsing 1:2 reverse split"""
        service = MetricsService(test_db)
        
        ratio = service._parse_split_ratio("1:2")
        assert ratio == Decimal("0.5")
    
    def test_parse_3_for_1_split(self, test_db):
        """Test parsing 3:1 split"""
        service = MetricsService(test_db)
        
        ratio = service._parse_split_ratio("3:1")
        assert ratio == Decimal("3.0")
    
    def test_parse_3_for_2_split(self, test_db):
        """Test parsing 3:2 split"""
        service = MetricsService(test_db)
        
        ratio = service._parse_split_ratio("3:2")
        assert ratio == Decimal("1.5")
    
    def test_parse_invalid_split_returns_one(self, test_db):
        """Test that invalid split strings return 1.0"""
        service = MetricsService(test_db)
        
        assert service._parse_split_ratio("invalid") == Decimal("1.0")
        assert service._parse_split_ratio("2-1") == Decimal("1.0")
        assert service._parse_split_ratio("") == Decimal("1.0")


@pytest.mark.integration
@pytest.mark.service
class TestPositionCalculationWithSplits:
    """Test position calculation handling stock splits"""
    
    @pytest.mark.asyncio
    async def test_simple_buy_no_split(self, test_db):
        """Test position calculation for simple buy without split"""
        user = UserFactory.create()
        portfolio = PortfolioFactory.create(user_id=user.id)
        asset = AssetFactory.create(symbol="AAPL")
        
        # Buy 10 shares @ $150
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            tx_date=date(2024, 1, 15),
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("150.00"),
            fees=Decimal("10.00")
        )
        
        # Create current price
        PriceFactory.create(
            asset_id=asset.id,
            price=Decimal("160.00"),
            asof=datetime.utcnow()
        )
        
        test_db.commit()
        
        service = MetricsService(test_db)
        positions = await service.get_positions(portfolio.id)
        
        assert len(positions) == 1
        pos = positions[0]
        assert pos.quantity == Decimal("10")
        assert pos.cost_basis == Decimal("1510.00")  # (10 * 150) + 10 fees
        assert pos.avg_cost == Decimal("151.00")  # 1510 / 10
        assert pos.current_price == Decimal("160.00")
        assert pos.market_value == Decimal("1600.00")
        assert pos.unrealized_pnl == Decimal("90.00")  # 1600 - 1510
    
    @pytest.mark.asyncio
    async def test_position_after_2_for_1_split(self, test_db):
        """Test position calculation after 2:1 stock split"""
        user = UserFactory.create()
        portfolio = PortfolioFactory.create(user_id=user.id)
        asset = AssetFactory.create(symbol="AAPL")
        
        # Buy 10 shares @ $150 before split
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            tx_date=date(2024, 1, 15),
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("150.00"),
            fees=Decimal("10.00")
        )
        
        # 2:1 split on June 1
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            tx_date=date(2024, 6, 1),
            type=TransactionType.SPLIT,
            quantity=Decimal("0"),
            price=Decimal("0"),
            fees=Decimal("0"),
            meta_data={"split": "2:1"}
        )
        
        # Current price after split (price should be halved)
        PriceFactory.create(
            asset_id=asset.id,
            price=Decimal("80.00"),  # $160 / 2 after split
            asof=datetime.utcnow()
        )
        
        test_db.commit()
        
        service = MetricsService(test_db)
        positions = await service.get_positions(portfolio.id)
        
        assert len(positions) == 1
        pos = positions[0]
        # Quantity doubles after 2:1 split
        assert pos.quantity == Decimal("20")  # 10 * 2
        # Cost basis stays the same
        assert pos.cost_basis == Decimal("1510.00")
        # Average cost halves
        assert pos.avg_cost == Decimal("75.50")  # 1510 / 20
        # Market value should be same (20 shares * $80)
        assert pos.market_value == Decimal("1600.00")
        # P&L unchanged
        assert pos.unrealized_pnl == Decimal("90.00")
    
    @pytest.mark.asyncio
    async def test_position_after_1_for_2_reverse_split(self, test_db):
        """Test position calculation after 1:2 reverse split"""
        user = UserFactory.create()
        portfolio = PortfolioFactory.create(user_id=user.id)
        asset = AssetFactory.create(symbol="LOWPRICE")
        
        # Buy 20 shares @ $5 before reverse split
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            tx_date=date(2024, 1, 15),
            type=TransactionType.BUY,
            quantity=Decimal("20"),
            price=Decimal("5.00"),
            fees=Decimal("5.00")
        )
        
        # 1:2 reverse split
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            tx_date=date(2024, 6, 1),
            type=TransactionType.SPLIT,
            quantity=Decimal("0"),
            price=Decimal("0"),
            fees=Decimal("0"),
            meta_data={"split": "1:2"}
        )
        
        # Current price after reverse split (price doubles)
        PriceFactory.create(
            asset_id=asset.id,
            price=Decimal("12.00"),  # $6 * 2 after reverse split
            asof=datetime.utcnow()
        )
        
        test_db.commit()
        
        service = MetricsService(test_db)
        positions = await service.get_positions(portfolio.id)
        
        assert len(positions) == 1
        pos = positions[0]
        # Quantity halves after 1:2 reverse split
        assert pos.quantity == Decimal("10")  # 20 * 0.5
        # Cost basis stays the same
        assert pos.cost_basis == Decimal("105.00")  # (20 * 5) + 5
        # Average cost doubles
        assert pos.avg_cost == Decimal("10.50")  # 105 / 10
        # Market value
        assert pos.market_value == Decimal("120.00")  # 10 * 12
        # P&L
        assert pos.unrealized_pnl == Decimal("15.00")  # 120 - 105
    
    @pytest.mark.asyncio
    async def test_buy_after_split(self, test_db):
        """Test buying more shares after a split"""
        user = UserFactory.create()
        portfolio = PortfolioFactory.create(user_id=user.id)
        asset = AssetFactory.create(symbol="AAPL")
        
        # Buy 10 shares @ $150 before split
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            tx_date=date(2024, 1, 15),
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("150.00"),
            fees=Decimal("10.00")
        )
        
        # 2:1 split
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            tx_date=date(2024, 6, 1),
            type=TransactionType.SPLIT,
            quantity=Decimal("0"),
            price=Decimal("0"),
            fees=Decimal("0"),
            meta_data={"split": "2:1"}
        )
        
        # Buy 5 more shares after split @ $80
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            tx_date=date(2024, 7, 1),
            type=TransactionType.BUY,
            quantity=Decimal("5"),
            price=Decimal("80.00"),
            fees=Decimal("5.00")
        )
        
        # Current price
        PriceFactory.create(
            asset_id=asset.id,
            price=Decimal("85.00"),
            asof=datetime.utcnow()
        )
        
        test_db.commit()
        
        service = MetricsService(test_db)
        positions = await service.get_positions(portfolio.id)
        
        assert len(positions) == 1
        pos = positions[0]
        # 10 shares split to 20, plus 5 more = 25 total
        assert pos.quantity == Decimal("25")
        # Cost: (10*150 + 10) + (5*80 + 5) = 1510 + 405 = 1915
        assert pos.cost_basis == Decimal("1915.00")
        # Avg cost: 1915 / 25 = 76.60
        assert pos.avg_cost == Decimal("76.60")
        # Market value: 25 * 85 = 2125
        assert pos.market_value == Decimal("2125.00")
        # P&L: 2125 - 1915 = 210
        assert pos.unrealized_pnl == Decimal("210.00")
    
    @pytest.mark.asyncio
    async def test_multiple_splits(self, test_db):
        """Test position calculation with multiple splits"""
        user = UserFactory.create()
        portfolio = PortfolioFactory.create(user_id=user.id)
        asset = AssetFactory.create(symbol="TESLA")
        
        # Buy 10 shares @ $200
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            tx_date=date(2020, 1, 1),
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("200.00"),
            fees=Decimal("10.00")
        )
        
        # First split: 5:1
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            tx_date=date(2020, 8, 31),
            type=TransactionType.SPLIT,
            quantity=Decimal("0"),
            price=Decimal("0"),
            fees=Decimal("0"),
            meta_data={"split": "5:1"}
        )
        
        # Second split: 3:1
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            tx_date=date(2022, 8, 25),
            type=TransactionType.SPLIT,
            quantity=Decimal("0"),
            price=Decimal("0"),
            fees=Decimal("0"),
            meta_data={"split": "3:1"}
        )
        
        # Current price
        PriceFactory.create(
            asset_id=asset.id,
            price=Decimal("15.00"),  # After 5:1 and 3:1 splits
            asof=datetime.utcnow()
        )
        
        test_db.commit()
        
        service = MetricsService(test_db)
        positions = await service.get_positions(portfolio.id)
        
        assert len(positions) == 1
        pos = positions[0]
        # 10 * 5 * 3 = 150 shares
        assert pos.quantity == Decimal("150")
        # Cost basis unchanged
        assert pos.cost_basis == Decimal("2010.00")  # (10*200 + 10)
        # Avg cost: 2010 / 150 = 13.40
        assert pos.avg_cost == Decimal("13.40")


@pytest.mark.integration
@pytest.mark.service
class TestSplitWithSellTransactions:
    """Test splits combined with sell transactions"""
    
    @pytest.mark.asyncio
    async def test_sell_before_split(self, test_db):
        """Test selling shares before a split"""
        user = UserFactory.create()
        portfolio = PortfolioFactory.create(user_id=user.id)
        asset = AssetFactory.create(symbol="AAPL")
        
        # Buy 20 shares
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            tx_date=date(2024, 1, 1),
            type=TransactionType.BUY,
            quantity=Decimal("20"),
            price=Decimal("150.00"),
            fees=Decimal("10.00")
        )
        
        # Sell 5 shares before split
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            tx_date=date(2024, 5, 1),
            type=TransactionType.SELL,
            quantity=Decimal("5"),
            price=Decimal("160.00"),
            fees=Decimal("5.00")
        )
        
        # 2:1 split
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            tx_date=date(2024, 6, 1),
            type=TransactionType.SPLIT,
            quantity=Decimal("0"),
            price=Decimal("0"),
            fees=Decimal("0"),
            meta_data={"split": "2:1"}
        )
        
        # Current price
        PriceFactory.create(
            asset_id=asset.id,
            price=Decimal("80.00"),
            asof=datetime.utcnow()
        )
        
        test_db.commit()
        
        service = MetricsService(test_db)
        positions = await service.get_positions(portfolio.id)
        
        assert len(positions) == 1
        pos = positions[0]
        # (20 - 5) * 2 = 30 shares after split
        assert pos.quantity == Decimal("30")
    
    @pytest.mark.asyncio
    async def test_sell_after_split(self, test_db):
        """Test selling shares after a split"""
        user = UserFactory.create()
        portfolio = PortfolioFactory.create(user_id=user.id)
        asset = AssetFactory.create(symbol="AAPL")
        
        # Buy 10 shares
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            tx_date=date(2024, 1, 1),
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("150.00"),
            fees=Decimal("10.00")
        )
        
        # 2:1 split (now have 20 shares)
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            tx_date=date(2024, 6, 1),
            type=TransactionType.SPLIT,
            quantity=Decimal("0"),
            price=Decimal("0"),
            fees=Decimal("0"),
            meta_data={"split": "2:1"}
        )
        
        # Sell 5 shares after split @ $80
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            tx_date=date(2024, 7, 1),
            type=TransactionType.SELL,
            quantity=Decimal("5"),
            price=Decimal("80.00"),
            fees=Decimal("5.00")
        )
        
        # Current price
        PriceFactory.create(
            asset_id=asset.id,
            price=Decimal("85.00"),
            asof=datetime.utcnow()
        )
        
        test_db.commit()
        
        service = MetricsService(test_db)
        positions = await service.get_positions(portfolio.id)
        
        assert len(positions) == 1
        pos = positions[0]
        # 10 * 2 - 5 = 15 shares remaining
        assert pos.quantity == Decimal("15")
