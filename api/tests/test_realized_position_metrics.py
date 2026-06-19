"""Realized P&L coverage for open and fully closed positions."""
from datetime import date, datetime
from decimal import Decimal

import pytest

from app.models import TransactionType
from app.services.portfolio_analytics.metrics import MetricsService
from tests.factories import (
    AssetFactory,
    PortfolioFactory,
    PriceFactory,
    TransactionFactory,
    UserFactory,
)


def create_context(test_db, symbol: str = "REAL"):
    user = UserFactory.create()
    portfolio = PortfolioFactory.create(user_id=user.id)
    asset = AssetFactory.create(symbol=symbol)
    return portfolio, asset


def add_transaction(portfolio, asset, tx_date, tx_type, quantity, price, fees="0"):
    return TransactionFactory.create(
        portfolio_id=portfolio.id,
        asset_id=asset.id,
        tx_date=tx_date,
        type=tx_type,
        quantity=Decimal(quantity),
        price=Decimal(price),
        fees=Decimal(fees),
    )


@pytest.mark.integration
@pytest.mark.service
class TestRealizedPositionMetrics:
    @pytest.mark.asyncio
    async def test_no_sells_exposes_zero_realized_metrics(self, test_db):
        portfolio, asset = create_context(test_db, "NONE")
        add_transaction(portfolio, asset, date(2024, 1, 1), TransactionType.BUY, "10", "100", "10")
        PriceFactory.create(asset_id=asset.id, price=Decimal("110"), asof=datetime.utcnow())
        test_db.commit()

        service = MetricsService(test_db)
        position = (await service.get_positions(portfolio.id))[0]

        assert position.realized_pnl == Decimal("0")
        assert position.realized_pnl_percent is None
        assert position.realized_quantity == Decimal("0")
        assert position.realized_sell_count == 0
        assert position.realized_cost_basis == Decimal("0")
        assert position.realized_sale_proceeds == Decimal("0")
        assert position.realized_fees == Decimal("0")
        assert position.lifetime_pnl == position.unrealized_pnl

    @pytest.mark.asyncio
    async def test_partial_sell_uses_weighted_average_cost_and_preserves_unrealized(self, test_db):
        portfolio, asset = create_context(test_db, "PART")
        add_transaction(portfolio, asset, date(2024, 1, 1), TransactionType.BUY, "10", "100", "10")
        add_transaction(portfolio, asset, date(2024, 2, 1), TransactionType.BUY, "10", "200", "10")
        add_transaction(portfolio, asset, date(2024, 3, 1), TransactionType.SELL, "5", "180", "5")
        PriceFactory.create(asset_id=asset.id, price=Decimal("170"), asof=datetime.utcnow())
        test_db.commit()

        service = MetricsService(test_db)
        position = (await service.get_positions(portfolio.id))[0]

        # Moving weighted average: (1010 + 2010) / 20 = 151 per share.
        assert position.quantity == Decimal("15")
        assert position.cost_basis == Decimal("2265")
        assert position.avg_cost == Decimal("151")
        assert position.unrealized_pnl == Decimal("285")
        assert position.realized_cost_basis == Decimal("755")
        assert position.realized_sale_proceeds == Decimal("900")
        assert position.realized_fees == Decimal("5")
        assert position.realized_pnl == Decimal("140")
        assert position.realized_pnl_percent == Decimal("140") / Decimal("755") * 100
        assert position.realized_quantity == Decimal("5")
        assert position.realized_sell_count == 1
        assert position.average_sell_price == Decimal("180")
        assert position.lifetime_pnl == Decimal("425")
        assert (await service.get_metrics(portfolio.id)).total_realized_pnl == Decimal("140")

    @pytest.mark.asyncio
    async def test_multiple_partial_sells_accumulate_basis_proceeds_and_fees(self, test_db):
        portfolio, asset = create_context(test_db, "MULTI")
        add_transaction(portfolio, asset, date(2024, 1, 1), TransactionType.BUY, "12", "50", "12")
        add_transaction(portfolio, asset, date(2024, 2, 1), TransactionType.SELL, "2", "70", "2")
        add_transaction(portfolio, asset, date(2024, 3, 1), TransactionType.SELL, "4", "60", "3")
        PriceFactory.create(asset_id=asset.id, price=Decimal("55"), asof=datetime.utcnow())
        test_db.commit()

        position = (await MetricsService(test_db).get_positions(portfolio.id))[0]

        assert position.quantity == Decimal("6")
        assert position.realized_quantity == Decimal("6")
        assert position.realized_sell_count == 2
        assert position.realized_cost_basis == Decimal("306")
        assert position.realized_sale_proceeds == Decimal("380")
        assert position.realized_fees == Decimal("5")
        assert position.realized_pnl == Decimal("69")
        assert position.cost_basis == Decimal("306")
        assert position.unrealized_pnl == Decimal("24")
        assert position.lifetime_pnl == Decimal("93")

    @pytest.mark.asyncio
    async def test_complete_exit_keeps_sold_positions_behavior(self, test_db):
        portfolio, asset = create_context(test_db, "CLOSED")
        add_transaction(portfolio, asset, date(2024, 1, 1), TransactionType.BUY, "10", "100", "10")
        add_transaction(portfolio, asset, date(2024, 2, 1), TransactionType.SELL, "10", "120", "5")
        PriceFactory.create(asset_id=asset.id, price=Decimal("120"), asof=datetime.utcnow())
        test_db.commit()

        service = MetricsService(test_db)
        assert await service.get_positions(portfolio.id) == []

        sold = await service.get_sold_positions_only(portfolio.id)
        assert len(sold) == 1
        position = sold[0]
        assert position.quantity == Decimal("0")
        assert position.unrealized_pnl == Decimal("185")
        assert position.realized_pnl == Decimal("185")
        assert position.realized_cost_basis == Decimal("1010")
        assert position.realized_sale_proceeds == Decimal("1200")
        assert position.realized_fees == Decimal("5")
        assert position.lifetime_pnl == Decimal("185")
