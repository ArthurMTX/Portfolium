"""
Tests for metrics calculation service
"""
import pytest
from decimal import Decimal
from datetime import date, datetime, timedelta
from unittest.mock import AsyncMock, Mock, patch

from app.services.platform.cache import CacheService
from app.services.portfolio_analytics.metrics import INCOMPLETE_POSITION_CACHE_TTL_SECONDS, MetricsService
from app.models import Asset, Transaction, TransactionType, Portfolio, Price
from app.schemas import Position, PriceQuote


@pytest.fixture
def mock_db():
    """Mock database session"""
    return Mock()


@pytest.fixture
def metrics_service(mock_db):
    """Create metrics service with mocked DB"""
    return MetricsService(mock_db)


def _mock_asset_lookup(mock_db, asset: Asset) -> None:
    query = mock_db.query.return_value
    query.filter.return_value.first.return_value = asset
    query.options.return_value.filter.return_value.first.return_value = asset


@pytest.mark.asyncio
async def test_calculate_position_simple_buy(metrics_service, mock_db):
    """Test position calculation for simple BUY transaction"""
    asset = Asset(id=1, symbol="AAPL", name="Apple Inc.", currency="USD")
    
    transactions = [
        Transaction(
            id=1,
            portfolio_id=1,
            asset_id=1,
            tx_date=date(2024, 1, 15),
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("150.00"),
            fees=Decimal("10.00"),
            currency="USD"
        )
    ]
    
    _mock_asset_lookup(mock_db, asset)
    quote = PriceQuote(
        symbol="AAPL",
        price=Decimal("160.00"),
        asof=datetime.utcnow(),
        currency="USD",
        daily_change_pct=None,
    )

    with patch('app.services.market_data.pricing.PricingService.get_price', return_value=quote):
        position = await metrics_service._calculate_position(1, transactions)
        
        assert position is not None
        assert position.quantity == Decimal("10")
        assert position.cost_basis == Decimal("1510.00")  # (10 * 150) + 10 fees
        assert position.avg_cost == Decimal("151.00")  # 1510 / 10
        assert position.current_price == Decimal("160.00")
        assert position.market_value == Decimal("1600.00")  # 10 * 160
        assert position.unrealized_pnl == Decimal("90.00")  # 1600 - 1510


@pytest.mark.asyncio
async def test_calculate_position_buy_and_sell(metrics_service, mock_db):
    """Test position calculation with BUY and SELL"""
    asset = Asset(id=1, symbol="AAPL", name="Apple Inc.", currency="USD")
    
    transactions = [
        # Buy 10 shares @ 150
        Transaction(
            id=1, portfolio_id=1, asset_id=1,
            tx_date=date(2024, 1, 15),
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("150.00"),
            fees=Decimal("10.00"),
            currency="USD"
        ),
        # Sell 5 shares @ 170
        Transaction(
            id=2, portfolio_id=1, asset_id=1,
            tx_date=date(2024, 3, 20),
            type=TransactionType.SELL,
            quantity=Decimal("5"),
            price=Decimal("170.00"),
            fees=Decimal("10.00"),
            currency="USD"
        )
    ]
    
    _mock_asset_lookup(mock_db, asset)
    quote = PriceQuote(
        symbol="AAPL",
        price=Decimal("160.00"),
        asof=datetime.utcnow(),
        currency="USD",
        daily_change_pct=None,
    )

    with patch('app.services.market_data.pricing.PricingService.get_price', return_value=quote):
        position = await metrics_service._calculate_position(1, transactions)
        
        assert position is not None
        assert position.quantity == Decimal("5")  # 10 - 5
        # Cost basis: (10*150 + 10) - (5*151) = 1510 - 755 = 755
        assert position.cost_basis == Decimal("755.00")
        assert position.avg_cost == Decimal("151.00")


@pytest.mark.asyncio
async def test_calculate_position_keeps_asset_visible_when_price_fx_conversion_fails(metrics_service, mock_db):
    """If price FX conversion fails, keep the position without valuation instead of dropping it."""
    asset = Asset(id=1, symbol="NVDA", name="NVIDIA Corporation", currency="USD")

    transactions = [
        Transaction(
            id=1,
            portfolio_id=1,
            asset_id=1,
            tx_date=date(2024, 1, 15),
            type=TransactionType.BUY,
            quantity=Decimal("2"),
            price=Decimal("500.00"),
            fees=Decimal("0.00"),
            currency="USD"
        )
    ]

    _mock_asset_lookup(mock_db, asset)
    quote = PriceQuote(
        symbol="NVDA",
        price=Decimal("900.00"),
        asof=datetime.utcnow(),
        currency="USD",
        daily_change_pct=Decimal("1.25"),
    )

    with patch('app.services.market_data.pricing.PricingService.get_price', return_value=quote), \
         patch('app.services.market_data.currency.CurrencyService.convert', return_value=None):
        position = await metrics_service._calculate_position(
            1,
            transactions,
            portfolio_base_currency="EUR",
        )

    assert position is not None
    assert position.symbol == "NVDA"
    assert position.quantity == Decimal("2")
    assert position.current_price is None
    assert position.market_value is None
    assert position.unrealized_pnl is None
    assert position.daily_change_pct is None


@pytest.mark.asyncio
async def test_get_positions_uses_short_cache_ttl_when_active_valuation_is_incomplete(metrics_service):
    """Transient price/FX failures should not leave null market values cached for 30 minutes."""
    position = Position(
        asset_id=1,
        symbol="NVDA",
        name="NVIDIA Corporation",
        quantity=Decimal("2"),
        avg_cost=Decimal("500"),
        current_price=None,
        market_value=None,
        cost_basis=Decimal("1000"),
        unrealized_pnl=None,
        unrealized_pnl_pct=None,
        daily_change_pct=None,
        currency="EUR",
        last_updated=datetime.utcnow(),
    )

    with patch('app.services.portfolio_analytics.metrics.get_cached_positions', return_value=None), \
         patch('app.services.portfolio_analytics.metrics.cache_positions') as cache_positions_mock, \
         patch.object(
             metrics_service,
             '_calculate_positions_internal',
             new=AsyncMock(return_value=[position]),
         ):
        result = await metrics_service.get_positions(1)

    assert result == [position]
    cache_positions_mock.assert_called_once()
    assert cache_positions_mock.call_args.args[0] == 1
    assert cache_positions_mock.call_args.args[2] == INCOMPLETE_POSITION_CACHE_TTL_SECONDS
    assert cache_positions_mock.call_args.args[2] < CacheService.TTL_POSITION


@pytest.mark.asyncio
async def test_calculate_position_with_split(metrics_service, mock_db):
    """Test position calculation with stock split"""
    asset = Asset(id=1, symbol="AAPL", name="Apple Inc.", currency="USD")
    
    transactions = [
        # Buy 10 shares @ 150
        Transaction(
            id=1, portfolio_id=1, asset_id=1,
            tx_date=date(2024, 1, 15),
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("150.00"),
            fees=Decimal("10.00"),
            currency="USD",
            meta_data={}
        ),
        # 2:1 split
        Transaction(
            id=2, portfolio_id=1, asset_id=1,
            tx_date=date(2024, 6, 1),
            type=TransactionType.SPLIT,
            quantity=Decimal("0"),
            price=Decimal("0"),
            fees=Decimal("0"),
            currency="USD",
            meta_data={"split": "2:1"}
        )
    ]
    
    _mock_asset_lookup(mock_db, asset)
    quote = PriceQuote(
        symbol="AAPL",
        price=Decimal("80.00"),
        asof=datetime.utcnow(),
        currency="USD",
        daily_change_pct=None,
    )

    with patch('app.services.market_data.pricing.PricingService.get_price', return_value=quote):
        position = await metrics_service._calculate_position(1, transactions)
        
        assert position is not None
        assert position.quantity == Decimal("20")  # 10 * 2 (2:1 split)
        assert position.cost_basis == Decimal("1510.00")  # Cost basis unchanged
        assert position.avg_cost == Decimal("75.50")  # 1510 / 20


def test_parse_split_ratio(metrics_service):
    """Test parsing of split ratio strings"""
    assert metrics_service._parse_split_ratio("2:1") == Decimal("2")
    assert metrics_service._parse_split_ratio("1:2") == Decimal("0.5")
    assert metrics_service._parse_split_ratio("3:1") == Decimal("3")
    assert metrics_service._parse_split_ratio("invalid") == Decimal("1")


def _position(
    asset: Asset,
    quantity: str,
    current_price: str | None,
    market_value: str | None,
    daily_change_pct: str | None = None,
) -> Position:
    return Position(
        asset_id=asset.id,
        symbol=asset.symbol,
        name=asset.name,
        quantity=Decimal(quantity),
        avg_cost=Decimal("100"),
        current_price=Decimal(current_price) if current_price is not None else None,
        market_value=Decimal(market_value) if market_value is not None else None,
        cost_basis=Decimal("1000"),
        unrealized_pnl=None,
        unrealized_pnl_pct=None,
        daily_change_pct=Decimal(daily_change_pct) if daily_change_pct is not None else None,
        currency=asset.currency,
        last_updated=datetime.utcnow(),
        asset_type=asset.asset_type,
    )


def _add_close(test_db, asset: Asset, asof_date: date, price: str) -> None:
    test_db.add(
        Price(
            asset_id=asset.id,
            asof=datetime.combine(asof_date, datetime.min.time()),
            price=Decimal(price),
            source="yfinance_history",
        )
    )
    test_db.commit()


def _add_price(test_db, asset: Asset, asof_date: date, price: str, source: str) -> None:
    test_db.add(
        Price(
            asset_id=asset.id,
            asof=datetime.combine(asof_date, datetime.min.time()),
            price=Decimal(price),
            source=source,
        )
    )
    test_db.commit()


def test_portfolio_daily_gain_uses_previous_close_not_quote_pct(
    test_db,
    sample_portfolio: Portfolio,
    sample_asset: Asset,
):
    """Portfolio Daily Gain should be current value minus previous close."""
    today = datetime.utcnow().date()
    previous_close_date = today - timedelta(days=1)
    test_db.add(
        Transaction(
            portfolio_id=sample_portfolio.id,
            asset_id=sample_asset.id,
            tx_date=previous_close_date - timedelta(days=5),
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("50"),
            fees=Decimal("0"),
            currency="USD",
        )
    )
    test_db.commit()
    _add_close(test_db, sample_asset, previous_close_date, "100")

    service = MetricsService(test_db)
    daily_value, daily_pct = service._calculate_portfolio_daily_gain(
        portfolio_id=sample_portfolio.id,
        portfolio=sample_portfolio,
        positions=[_position(sample_asset, "10", "110", "1100")],
        current_value=Decimal("1100"),
    )

    assert daily_value == Decimal("100")
    assert daily_pct == Decimal("10.0")


def test_portfolio_daily_gain_excludes_buy_today(
    test_db,
    sample_portfolio: Portfolio,
    sample_asset: Asset,
):
    """A same-day purchase should not appear as portfolio performance."""
    today = datetime.utcnow().date()
    previous_close_date = today - timedelta(days=1)
    test_db.add_all(
        [
            Transaction(
                portfolio_id=sample_portfolio.id,
                asset_id=sample_asset.id,
                tx_date=previous_close_date - timedelta(days=5),
                type=TransactionType.BUY,
                quantity=Decimal("10"),
                price=Decimal("80"),
                fees=Decimal("0"),
                currency="USD",
            ),
            Transaction(
                portfolio_id=sample_portfolio.id,
                asset_id=sample_asset.id,
                tx_date=today,
                type=TransactionType.BUY,
                quantity=Decimal("5"),
                price=Decimal("100"),
                fees=Decimal("0"),
                currency="USD",
            ),
        ]
    )
    test_db.commit()
    _add_close(test_db, sample_asset, previous_close_date, "100")

    service = MetricsService(test_db)
    daily_value, daily_pct = service._calculate_portfolio_daily_gain(
        portfolio_id=sample_portfolio.id,
        portfolio=sample_portfolio,
        positions=[_position(sample_asset, "15", "102", "1530")],
        current_value=Decimal("1530"),
    )

    assert daily_value == Decimal("30")
    assert daily_pct == Decimal("3.00")


def test_portfolio_daily_gain_excludes_sell_today_but_keeps_realized_day_move(
    test_db,
    sample_portfolio: Portfolio,
    sample_asset: Asset,
):
    """A same-day sale should remove the cash flow while keeping price movement to sale."""
    today = datetime.utcnow().date()
    previous_close_date = today - timedelta(days=1)
    test_db.add_all(
        [
            Transaction(
                portfolio_id=sample_portfolio.id,
                asset_id=sample_asset.id,
                tx_date=previous_close_date - timedelta(days=5),
                type=TransactionType.BUY,
                quantity=Decimal("10"),
                price=Decimal("80"),
                fees=Decimal("0"),
                currency="USD",
            ),
            Transaction(
                portfolio_id=sample_portfolio.id,
                asset_id=sample_asset.id,
                tx_date=today,
                type=TransactionType.SELL,
                quantity=Decimal("4"),
                price=Decimal("102"),
                fees=Decimal("0"),
                currency="USD",
            ),
        ]
    )
    test_db.commit()
    _add_close(test_db, sample_asset, previous_close_date, "100")

    service = MetricsService(test_db)
    daily_value, daily_pct = service._calculate_portfolio_daily_gain(
        portfolio_id=sample_portfolio.id,
        portfolio=sample_portfolio,
        positions=[_position(sample_asset, "6", "102", "612")],
        current_value=Decimal("612"),
    )

    assert daily_value == Decimal("20")
    assert daily_pct == Decimal("2.00")


def test_portfolio_daily_gain_returns_none_without_prior_close(
    test_db,
    sample_portfolio: Portfolio,
    sample_asset: Asset,
):
    """First day or missing history should be shown as unavailable, not zero."""
    today = datetime.utcnow().date()
    test_db.add(
        Transaction(
            portfolio_id=sample_portfolio.id,
            asset_id=sample_asset.id,
            tx_date=today,
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("100"),
            fees=Decimal("0"),
            currency="USD",
        )
    )
    test_db.commit()

    service = MetricsService(test_db)
    daily_value, daily_pct = service._calculate_portfolio_daily_gain(
        portfolio_id=sample_portfolio.id,
        portfolio=sample_portfolio,
        positions=[_position(sample_asset, "10", "100", "1000")],
        current_value=Decimal("1000"),
    )

    assert daily_value is None
    assert daily_pct is None


def test_portfolio_daily_gain_returns_none_when_current_position_unpriced(
    test_db,
    sample_portfolio: Portfolio,
    sample_asset: Asset,
):
    """An open position without a current price makes the portfolio metric unreliable."""
    today = datetime.utcnow().date()
    previous_close_date = today - timedelta(days=1)
    test_db.add(
        Transaction(
            portfolio_id=sample_portfolio.id,
            asset_id=sample_asset.id,
            tx_date=previous_close_date - timedelta(days=5),
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("80"),
            fees=Decimal("0"),
            currency="USD",
        )
    )
    test_db.commit()
    _add_close(test_db, sample_asset, previous_close_date, "100")

    service = MetricsService(test_db)
    daily_value, daily_pct = service._calculate_portfolio_daily_gain(
        portfolio_id=sample_portfolio.id,
        portfolio=sample_portfolio,
        positions=[_position(sample_asset, "10", None, None)],
        current_value=Decimal("0"),
    )

    assert daily_value is None
    assert daily_pct is None


def test_portfolio_daily_gain_mixed_positive_and_negative_returns(
    test_db,
    sample_portfolio: Portfolio,
    sample_asset: Asset,
):
    """Mixed movers should aggregate by value, not by count of winners/losers."""
    today = datetime.utcnow().date()
    previous_close_date = today - timedelta(days=1)
    second_asset = Asset(symbol="MSFT", name="Microsoft", currency="USD")
    test_db.add(second_asset)
    test_db.commit()
    test_db.refresh(second_asset)

    test_db.add_all(
        [
            Transaction(
                portfolio_id=sample_portfolio.id,
                asset_id=sample_asset.id,
                tx_date=previous_close_date - timedelta(days=5),
                type=TransactionType.BUY,
                quantity=Decimal("10"),
                price=Decimal("80"),
                fees=Decimal("0"),
                currency="USD",
            ),
            Transaction(
                portfolio_id=sample_portfolio.id,
                asset_id=second_asset.id,
                tx_date=previous_close_date - timedelta(days=5),
                type=TransactionType.BUY,
                quantity=Decimal("10"),
                price=Decimal("80"),
                fees=Decimal("0"),
                currency="USD",
            ),
        ]
    )
    test_db.commit()
    _add_close(test_db, sample_asset, previous_close_date, "100")
    _add_close(test_db, second_asset, previous_close_date, "100")

    service = MetricsService(test_db)
    daily_value, daily_pct = service._calculate_portfolio_daily_gain(
        portfolio_id=sample_portfolio.id,
        portfolio=sample_portfolio,
        positions=[
            _position(sample_asset, "10", "90", "900"),
            _position(second_asset, "10", "120", "1200"),
        ],
        current_value=Decimal("2100"),
    )

    assert daily_value == Decimal("100")
    assert daily_pct == Decimal("5.00")


def test_portfolio_daily_gain_requires_official_historical_previous_close(
    test_db,
    sample_portfolio: Portfolio,
    sample_asset: Asset,
):
    """A cached quote from the prior date is not reliable enough for Daily Gain."""
    today = datetime.utcnow().date()
    previous_close_date = today - timedelta(days=1)
    test_db.add(
        Transaction(
            portfolio_id=sample_portfolio.id,
            asset_id=sample_asset.id,
            tx_date=previous_close_date - timedelta(days=5),
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("80"),
            fees=Decimal("0"),
            currency="USD",
        )
    )
    test_db.commit()
    _add_price(test_db, sample_asset, previous_close_date, "109", "yfinance_batch")

    service = MetricsService(test_db)
    daily_value, daily_pct = service._calculate_portfolio_daily_gain(
        portfolio_id=sample_portfolio.id,
        portfolio=sample_portfolio,
        positions=[_position(sample_asset, "10", "110", "1100")],
        current_value=Decimal("1100"),
    )

    assert daily_value is None
    assert daily_pct is None


def test_portfolio_daily_gain_non_eur_asset_with_fx_conversion(
    test_db,
    sample_portfolio: Portfolio,
    sample_asset: Asset,
):
    """Previous close should be converted into the portfolio base currency."""
    sample_portfolio.base_currency = "EUR"
    sample_asset.currency = "USD"
    test_db.commit()

    today = datetime.utcnow().date()
    previous_close_date = today - timedelta(days=1)
    test_db.add(
        Transaction(
            portfolio_id=sample_portfolio.id,
            asset_id=sample_asset.id,
            tx_date=previous_close_date - timedelta(days=5),
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("80"),
            fees=Decimal("0"),
            currency="USD",
        )
    )
    test_db.commit()
    _add_close(test_db, sample_asset, previous_close_date, "100")

    with patch(
        "app.services.market_data.currency.CurrencyService.convert_historical",
        return_value=Decimal("90"),
    ):
        service = MetricsService(test_db)
        daily_value, daily_pct = service._calculate_portfolio_daily_gain(
            portfolio_id=sample_portfolio.id,
            portfolio=sample_portfolio,
            positions=[_position(sample_asset, "10", "95", "950")],
            current_value=Decimal("950"),
        )

    assert daily_value == Decimal("50")
    assert daily_pct == Decimal("5.555555555555555555555555556")


def test_daily_gain_debug_report_explains_provider_vs_reconstructed_mismatch(
    test_db,
    sample_portfolio: Portfolio,
    sample_asset: Asset,
):
    """The debug report should expose provider contribution divergence."""
    today = datetime.utcnow().date()
    previous_close_date = today - timedelta(days=1)
    test_db.add(
        Transaction(
            portfolio_id=sample_portfolio.id,
            asset_id=sample_asset.id,
            tx_date=previous_close_date - timedelta(days=5),
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("80"),
            fees=Decimal("0"),
            currency="USD",
        )
    )
    test_db.commit()
    _add_close(test_db, sample_asset, previous_close_date, "100")

    service = MetricsService(test_db)
    report = service._build_daily_gain_attribution_report(
        portfolio_id=sample_portfolio.id,
        portfolio=sample_portfolio,
        positions=[_position(sample_asset, "10", "110", "1100", daily_change_pct="-5")],
        transactions=(
            test_db.query(Transaction)
            .filter(Transaction.portfolio_id == sample_portfolio.id)
            .all()
        ),
        report_date=today,
        current_value=Decimal("1100"),
    )

    assert report["reliable"] is True
    assert report["rows"][0]["actual_daily_gain_contribution"] == Decimal("100")
    assert report["rows"][0]["provider_estimated_contribution"] == Decimal("-55")
    assert report["totals"]["difference_computed_vs_provider_estimate"] == Decimal("155")


def test_portfolio_daily_gain_returns_none_when_previous_close_is_stale(
    test_db,
    sample_portfolio: Portfolio,
    sample_asset: Asset,
):
    """A stale historical close should not produce a confident Daily Gain."""
    report_date = date(2026, 6, 16)
    stale_close_date = date(2026, 6, 11)
    test_db.add(
        Transaction(
            portfolio_id=sample_portfolio.id,
            asset_id=sample_asset.id,
            tx_date=date(2026, 6, 1),
            type=TransactionType.BUY,
            quantity=Decimal("10"),
            price=Decimal("80"),
            fees=Decimal("0"),
            currency="USD",
        )
    )
    test_db.commit()
    _add_close(test_db, sample_asset, stale_close_date, "100")

    service = MetricsService(test_db)
    report = service._build_daily_gain_attribution_report(
        portfolio_id=sample_portfolio.id,
        portfolio=sample_portfolio,
        positions=[_position(sample_asset, "10", "110", "1100")],
        transactions=(
            test_db.query(Transaction)
            .filter(Transaction.portfolio_id == sample_portfolio.id)
            .all()
        ),
        report_date=report_date,
        current_value=Decimal("1100"),
    )

    assert report["previous_close_date"] == stale_close_date.isoformat()
    assert report["expected_previous_close_date"] == "2026-06-15"
    assert report["reliable"] is False
    assert report["totals"]["computed_daily_gain_amount"] is None
    assert "stale official historical previous close" in report["rows"][0]["reason_if_excluded"]
