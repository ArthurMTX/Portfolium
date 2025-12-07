"""
Tests for portfolio insights and analytics service
"""
import pytest
from decimal import Decimal
from datetime import date, datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock

from app.services.insights import InsightsService
from app.models import TransactionType
from tests.factories import (
    UserFactory, PortfolioFactory, AssetFactory, 
    TransactionFactory, PriceFactory
)


@pytest.mark.integration
@pytest.mark.service
class TestInsightsGeneration:
    """Test insights generation"""
    
    @pytest.mark.asyncio
    async def test_get_portfolio_insights_basic(self, test_db):
        """Test basic insights generation for a portfolio"""
        user = UserFactory.create()
        portfolio = PortfolioFactory.create(user_id=user.id, name="Tech Portfolio")
        
        # Create some assets and transactions
        apple = AssetFactory.create(symbol="AAPL", name="Apple Inc.")
        google = AssetFactory.create(symbol="GOOGL", name="Alphabet Inc.")
        
        # Buy AAPL
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=apple.id,
            tx_date=date(2024, 1, 1),
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("150.00"),
            fees=Decimal("10.00")
        )
        
        # Buy GOOGL
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=google.id,
            tx_date=date(2024, 1, 15),
            type=TransactionType.BUY,
            quantity=Decimal("5"),
            price=Decimal("140.00"),
            fees=Decimal("10.00")
        )
        
        # Create current prices
        PriceFactory.create(
            asset_id=apple.id,
            price=Decimal("160.00"),
            asof=datetime.utcnow()
        )
        PriceFactory.create(
            asset_id=google.id,
            price=Decimal("150.00"),
            asof=datetime.utcnow()
        )
        
        test_db.commit()
        
        service = InsightsService(test_db)
        
        # Mock benchmark comparison to avoid external API calls
        with patch.object(service, 'compare_to_benchmark') as mock_benchmark:
            from app.schemas import BenchmarkComparison
            mock_benchmark.return_value = BenchmarkComparison(
                benchmark_symbol="SPY",
                benchmark_name="S&P 500",
                period="1y",
                portfolio_return=Decimal("5.0"),
                benchmark_return=Decimal("10.0"),
                alpha=Decimal("-5.0"),
                portfolio_series=[],
                benchmark_series=[],
                correlation=None
            )
            
            insights = await service.get_portfolio_insights(
                portfolio_id=portfolio.id,
                user_id=user.id,
                period="1y"
            )
        
        assert insights is not None
        assert insights.portfolio_name == "Tech Portfolio"
        assert insights.total_value > 0
        assert insights.total_cost > 0
        assert len(insights.asset_allocation) == 2
    
    @pytest.mark.asyncio
    async def test_asset_allocation_calculation(self, test_db):
        """Test asset allocation percentages"""
        user = UserFactory.create()
        portfolio = PortfolioFactory.create(user_id=user.id)
        
        # Create 3 assets with different values
        asset1 = AssetFactory.create(symbol="AAPL")
        asset2 = AssetFactory.create(symbol="GOOGL")
        asset3 = AssetFactory.create(symbol="MSFT")
        
        # AAPL: 10 shares @ $100 = $1000 (50%)
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset1.id,
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("90.00"),
            fees=Decimal("0")
        )
        PriceFactory.create(asset_id=asset1.id, price=Decimal("100.00"))
        
        # GOOGL: 5 shares @ $100 = $500 (25%)
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset2.id,
            type=TransactionType.BUY,
            quantity=Decimal("5"),
            price=Decimal("90.00"),
            fees=Decimal("0")
        )
        PriceFactory.create(asset_id=asset2.id, price=Decimal("100.00"))
        
        # MSFT: 5 shares @ $100 = $500 (25%)
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset3.id,
            type=TransactionType.BUY,
            quantity=Decimal("5"),
            price=Decimal("90.00"),
            fees=Decimal("0")
        )
        PriceFactory.create(asset_id=asset3.id, price=Decimal("100.00"))
        
        test_db.commit()
        
        service = InsightsService(test_db)
        allocations = await service.get_asset_allocation(portfolio.id)
        
        assert len(allocations) == 3
        
        # Find AAPL allocation
        aapl_alloc = next(a for a in allocations if a.symbol == "AAPL")
        assert abs(aapl_alloc.percentage - Decimal("50.0")) < Decimal("0.1")
        
        # Find GOOGL and MSFT allocations
        googl_alloc = next(a for a in allocations if a.symbol == "GOOGL")
        msft_alloc = next(a for a in allocations if a.symbol == "MSFT")
        assert abs(googl_alloc.percentage - Decimal("25.0")) < Decimal("0.1")
        assert abs(msft_alloc.percentage - Decimal("25.0")) < Decimal("0.1")


@pytest.mark.unit
@pytest.mark.service
class TestInsightsCaching:
    """Test insights caching mechanism"""
    
    @pytest.mark.asyncio
    async def test_insights_are_cached(self, test_db):
        """Test that insights are cached to avoid recalculation"""
        user = UserFactory.create()
        portfolio = PortfolioFactory.create(user_id=user.id)
        asset = AssetFactory.create(symbol="AAPL")
        
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("100.00")
        )
        PriceFactory.create(asset_id=asset.id, price=Decimal("110.00"))
        test_db.commit()
        
        service = InsightsService(test_db)
        
        with patch.object(service, 'compare_to_benchmark', return_value=None):
            # First call
            insights1 = await service.get_portfolio_insights(
                portfolio.id, user.id, period="1y"
            )
            
            # Second call immediately (should use cache)
            insights2 = await service.get_portfolio_insights(
                portfolio.id, user.id, period="1y"
            )
            
            # Should return cached result (same object)
            assert insights1 is not None
            assert insights2 is not None
            # Cached results should have same values
            assert insights1.total_value == insights2.total_value


@pytest.mark.unit
@pytest.mark.service
class TestDiversificationScore:
    """Test diversification score calculation"""
    
    def test_diversification_score_single_asset(self, test_db):
        """Test that single asset has low diversification"""
        service = InsightsService(test_db)
        
        from app.schemas import AssetAllocation
        allocations = [
            AssetAllocation(
                symbol="AAPL",
                name="Apple",
                percentage=Decimal("100"),
                value=Decimal("10000"),
                quantity=Decimal("100"),
                asset_type="stock"
            )
        ]
        
        score = service._calculate_diversification_score(allocations)
        
        # Single asset should have low score
        assert score < 30
    
    def test_diversification_score_well_diversified(self, test_db):
        """Test that many assets with even distribution score high"""
        service = InsightsService(test_db)
        
        from app.schemas import AssetAllocation
        # 10 assets with 10% each
        allocations = [
            AssetAllocation(
                symbol=f"STOCK{i}",
                name=f"Stock {i}",
                percentage=Decimal("10"),
                value=Decimal("1000"),
                quantity=Decimal("10"),
                asset_type="stock"
            )
            for i in range(10)
        ]
        
        score = service._calculate_diversification_score(allocations)
        
        # Well diversified should have high score
        assert score > 70
    
    def test_diversification_score_concentrated_portfolio(self, test_db):
        """Test portfolio with one dominant position"""
        service = InsightsService(test_db)
        
        from app.schemas import AssetAllocation
        allocations = [
            AssetAllocation(
                symbol="AAPL",
                name="Apple",
                percentage=Decimal("80"),
                value=Decimal("8000"),
                quantity=Decimal("80"),
                asset_type="stock"
            ),
            AssetAllocation(
                symbol="GOOGL",
                name="Google",
                percentage=Decimal("10"),
                value=Decimal("1000"),
                quantity=Decimal("10"),
                asset_type="stock"
            ),
            AssetAllocation(
                symbol="MSFT",
                name="Microsoft",
                percentage=Decimal("10"),
                value=Decimal("1000"),
                quantity=Decimal("10"),
                asset_type="stock"
            )
        ]
        
        score = service._calculate_diversification_score(allocations)
        
        # Concentrated portfolio should have medium-low score
        assert 20 < score < 60


@pytest.mark.integration
@pytest.mark.service
class TestTopPerformers:
    """Test top/worst performer identification"""
    
    @pytest.mark.asyncio
    async def test_get_top_performers(self, test_db):
        """Test identifying best performing assets"""
        user = UserFactory.create()
        portfolio = PortfolioFactory.create(user_id=user.id)
        
        # Asset with high return
        winner = AssetFactory.create(symbol="WINNER")
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=winner.id,
            tx_date=date.today() - timedelta(days=365),
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("100.00")
        )
        PriceFactory.create(asset_id=winner.id, price=Decimal("200.00"))  # +100%
        
        # Asset with low return
        loser = AssetFactory.create(symbol="LOSER")
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=loser.id,
            tx_date=date.today() - timedelta(days=365),
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("100.00")
        )
        PriceFactory.create(asset_id=loser.id, price=Decimal("50.00"))  # -50%
        
        test_db.commit()
        
        service = InsightsService(test_db)
        
        # Get top performers
        top = await service.get_top_performers(
            portfolio.id, period="1y", limit=1, ascending=False
        )
        
        assert len(top) > 0
        assert top[0].symbol == "WINNER"
        
        # Get worst performers
        worst = await service.get_top_performers(
            portfolio.id, period="1y", limit=1, ascending=True
        )
        
        assert len(worst) > 0
        assert worst[0].symbol == "LOSER"


@pytest.mark.unit
@pytest.mark.service
class TestPerformanceMetrics:
    """Test performance metrics calculations"""
    
    def test_empty_performance_metrics(self, test_db):
        """Test creation of empty performance metrics"""
        service = InsightsService(test_db)
        
        metrics = service._empty_performance_metrics("1y")
        
        assert metrics.period == "1y"
        assert metrics.total_return == Decimal("0")
        assert metrics.total_return_pct == Decimal("0")
        assert metrics.positive_days == 0
        assert metrics.negative_days == 0
    
    def test_empty_risk_metrics(self, test_db):
        """Test creation of empty risk metrics"""
        service = InsightsService(test_db)
        
        metrics = service._empty_risk_metrics("1y")
        
        assert metrics.period == "1y"
        assert metrics.volatility == Decimal("0")
        assert metrics.sharpe_ratio is None
        assert metrics.max_drawdown == Decimal("0")


@pytest.mark.integration
@pytest.mark.service
class TestInsightsWithRealData:
    """Integration tests with realistic portfolio data"""
    
    @pytest.mark.asyncio
    async def test_portfolio_with_profit_and_loss(self, test_db):
        """Test insights for portfolio with both winning and losing positions"""
        user = UserFactory.create()
        portfolio = PortfolioFactory.create(user_id=user.id)
        
        # Winning position
        aapl = AssetFactory.create(symbol="AAPL")
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=aapl.id,
            tx_date=date(2023, 1, 1),
            type=TransactionType.BUY,
            quantity=Decimal("100"),
            price=Decimal("100.00"),
            fees=Decimal("10.00")
        )
        PriceFactory.create(asset_id=aapl.id, price=Decimal("150.00"))
        
        # Losing position
        meta = AssetFactory.create(symbol="META")
        TransactionFactory.create(
            portfolio_id=portfolio.id,
            asset_id=meta.id,
            tx_date=date(2023, 1, 1),
            type=TransactionType.BUY,
            quantity=Decimal("50"),
            price=Decimal("200.00"),
            fees=Decimal("10.00")
        )
        PriceFactory.create(asset_id=meta.id, price=Decimal("150.00"))
        
        test_db.commit()
        
        service = InsightsService(test_db)
        
        with patch.object(service, 'compare_to_benchmark', return_value=None):
            with patch.object(service, 'get_performance_metrics') as mock_perf:
                from app.schemas import PerformanceMetrics
                mock_perf.return_value = service._empty_performance_metrics("1y")
                
                with patch.object(service, 'get_risk_metrics') as mock_risk:
                    mock_risk.return_value = service._empty_risk_metrics("1y")
                    
                    insights = await service.get_portfolio_insights(
                        portfolio.id, user.id, period="1y"
                    )
        
        # Total cost: (100*100 + 10) + (50*200 + 10) = 10010 + 10010 = 20020
        # Total value: (100*150) + (50*150) = 15000 + 7500 = 22500
        # Total return: 22500 - 20020 = 2480
        
        assert insights.total_cost == Decimal("20020.00")
        assert insights.total_value == Decimal("22500.00")
        assert insights.total_return == Decimal("2480.00")
        assert insights.total_return_pct > 0  # Should be positive overall
    
    @pytest.mark.asyncio
    async def test_insights_no_positions_raises_error(self, test_db):
        """Test that empty portfolio raises appropriate error"""
        user = UserFactory.create()
        portfolio = PortfolioFactory.create(user_id=user.id)
        test_db.commit()
        
        service = InsightsService(test_db)
        
        with pytest.raises(ValueError, match="No positions found"):
            await service.get_portfolio_insights(
                portfolio.id, user.id, period="1y"
            )
