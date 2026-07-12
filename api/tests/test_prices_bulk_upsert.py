"""
Tests for bulk price upsert helpers.
"""
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import Mock

from sqlalchemy.dialects import postgresql

from app.crud.prices import bulk_upsert_prices, get_prices
from app.schemas import PriceCreate
from tests.factories import AssetFactory, PriceFactory


def test_bulk_upsert_prices_inserts_and_updates_existing_rows(test_db):
    asset = AssetFactory.create(symbol="BULK1")
    existing_asof = datetime.utcnow().replace(microsecond=0)
    new_asof = existing_asof + timedelta(days=1)

    PriceFactory.create(
        asset_id=asset.id,
        asof=existing_asof,
        price=Decimal("100.00"),
        volume=100,
        source="old_source",
    )

    count = bulk_upsert_prices(
        test_db,
        [
            PriceCreate(
                asset_id=asset.id,
                asof=existing_asof,
                price=Decimal("101.50"),
                volume=150,
                source="bulk_update",
            ),
            PriceCreate(
                asset_id=asset.id,
                asof=new_asof,
                price=Decimal("102.75"),
                volume=200,
                source="bulk_insert",
            ),
        ],
    )

    prices = get_prices(test_db, asset.id, limit=10)
    by_asof = {price.asof: price for price in prices}

    assert count == 2
    assert len(prices) == 2
    assert by_asof[existing_asof].price == Decimal("101.50000000")
    assert by_asof[existing_asof].volume == 150
    assert by_asof[existing_asof].source == "bulk_update"
    assert by_asof[new_asof].price == Decimal("102.75000000")
    assert by_asof[new_asof].source == "bulk_insert"


def test_bulk_upsert_prices_deduplicates_input_and_commits_once(test_db, monkeypatch):
    asset = AssetFactory.create(symbol="BULK2")
    asof = datetime.utcnow().replace(microsecond=0)

    original_commit = test_db.commit
    commit_count = {"value": 0}

    def counted_commit():
        commit_count["value"] += 1
        return original_commit()

    monkeypatch.setattr(test_db, "commit", counted_commit)

    count = bulk_upsert_prices(
        test_db,
        [
            PriceCreate(
                asset_id=asset.id,
                asof=asof,
                price=Decimal("50.00"),
                volume=10,
                source="first",
            ),
            PriceCreate(
                asset_id=asset.id,
                asof=asof,
                price=Decimal("51.00"),
                volume=11,
                source="second",
            ),
        ],
    )

    prices = get_prices(test_db, asset.id, limit=10)

    assert count == 1
    assert commit_count["value"] == 1
    assert len(prices) == 1
    assert prices[0].price == Decimal("51.00000000")
    assert prices[0].volume == 11
    assert prices[0].source == "second"


def test_bulk_upsert_prices_uses_postgresql_on_conflict_path():
    mock_db = Mock()
    mock_db.bind.dialect.name = "postgresql"

    count = bulk_upsert_prices(
        mock_db,
        [
            PriceCreate(
                asset_id=1,
                asof=datetime(2026, 1, 1),
                price=Decimal("10.00"),
                volume=100,
                source="bulk",
            )
        ],
    )

    statement = mock_db.execute.call_args.args[0]
    compiled = str(statement.compile(dialect=postgresql.dialect()))

    assert count == 1
    assert "ON CONFLICT" in compiled
    assert "asset_id" in compiled
    assert "asof" in compiled
    mock_db.commit.assert_called_once()
