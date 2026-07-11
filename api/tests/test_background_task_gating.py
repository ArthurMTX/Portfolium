"""ENABLE_BACKGROUND_TASKS must gate every fire-and-forget Celery enqueue.

With the flag off (the test default), request-path code must never attempt a
broker connection: `.delay()` against an unreachable broker blocks inside
kombu's connection-retry loop and once hung the whole suite mid-run (stack
captured via faulthandler: getaddrinfo("redis") under celery send_task).
The transactions router already honoured the flag; pricing and asset creation
did not.
"""
from unittest.mock import patch

import pytest

from app.config import settings
from app.services.market_data import pricing as pricing_module
from app.services.market_data.pricing import PricingService, _enqueue_price_refresh
from tests.factories import AssetFactory
from tests.test_pricing_service import FakeMarketDataProvider, run_inline


@pytest.fixture
def recorded_delays(monkeypatch):
    """Replace the relevant task publishers with in-memory recorders."""
    from app.tasks import ath_tasks, cache_tasks, logo_tasks

    calls = {"update_ath": [], "warmup_symbols": [], "backfill_ath": [], "backfill_logos": []}
    monkeypatch.setattr(
        ath_tasks.update_asset_ath, "delay",
        lambda *a, **k: calls["update_ath"].append((a, k)))
    monkeypatch.setattr(
        cache_tasks.warmup_specific_symbols, "delay",
        lambda *a, **k: calls["warmup_symbols"].append((a, k)))
    monkeypatch.setattr(
        ath_tasks.backfill_ath_from_yfinance, "delay",
        lambda *a, **k: calls["backfill_ath"].append((a, k)))
    monkeypatch.setattr(
        logo_tasks.backfill_asset_logos, "delay",
        lambda *a, **k: calls["backfill_logos"].append((a, k)))
    return calls


def _fresh_price_provider():
    return FakeMarketDataProvider(
        info={"AAPL": {"regularMarketPrice": 150.0, "previousClose": 148.0}}
    )


async def _fetch_price(test_db):
    service = PricingService(test_db)
    with (
        patch("app.services.market_data.pricing.get_market_data_provider",
              return_value=_fresh_price_provider()),
        patch("app.services.market_data.pricing.asyncio.to_thread", side_effect=run_inline),
    ):
        return await service.get_price("AAPL", force_refresh=True)


async def test_price_fetch_does_not_enqueue_ath_when_disabled(test_db, recorded_delays, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_BACKGROUND_TASKS", False)
    AssetFactory.create(symbol="AAPL")
    test_db.commit()

    result = await _fetch_price(test_db)

    assert result is not None, "price fetch itself must still work with tasks disabled"
    assert recorded_delays["update_ath"] == []


async def test_price_fetch_enqueues_ath_when_enabled(test_db, recorded_delays, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_BACKGROUND_TASKS", True)
    AssetFactory.create(symbol="AAPL")
    test_db.commit()

    result = await _fetch_price(test_db)

    assert result is not None
    assert len(recorded_delays["update_ath"]) == 1


def test_stale_refresh_enqueue_respects_flag(recorded_delays, monkeypatch):
    class AlwaysAcquiresCache:
        @staticmethod
        def set(key, value, ttl=None, nx=False):
            return True

    monkeypatch.setattr(pricing_module, "CacheService", AlwaysAcquiresCache)
    monkeypatch.setattr(pricing_module, "is_rate_limited", lambda: False)

    monkeypatch.setattr(settings, "ENABLE_BACKGROUND_TASKS", False)
    _enqueue_price_refresh(["AAPL"], reason="test")
    assert recorded_delays["warmup_symbols"] == []

    monkeypatch.setattr(settings, "ENABLE_BACKGROUND_TASKS", True)
    _enqueue_price_refresh(["AAPL"], reason="test")
    assert len(recorded_delays["warmup_symbols"]) == 1


def _create_asset_via_api(client, auth_headers, symbol):
    fake = FakeMarketDataProvider(
        info={symbol: {
            "quoteType": "EQUITY",
            "longName": f"{symbol} Test Corp",
            "currency": "USD",
            "regularMarketPrice": 10.0,
        }}
    )
    with patch("app.services.market_data.yahoo_finance.get_market_data_provider",
               return_value=fake):
        return client.post(
            "/assets",
            json={"symbol": symbol, "name": f"{symbol} Test Corp",
                  "currency": "USD", "class_": "stock"},
            headers=auth_headers,
        )


def test_asset_creation_does_not_enqueue_backfills_when_disabled(
    client, auth_headers, recorded_delays, monkeypatch
):
    monkeypatch.setattr(settings, "ENABLE_BACKGROUND_TASKS", False)

    response = _create_asset_via_api(client, auth_headers, "GATE0")

    assert response.status_code == 201, response.text
    assert recorded_delays["backfill_ath"] == []
    assert recorded_delays["backfill_logos"] == []


def test_asset_creation_enqueues_backfills_when_enabled(
    client, auth_headers, recorded_delays, monkeypatch
):
    monkeypatch.setattr(settings, "ENABLE_BACKGROUND_TASKS", True)

    response = _create_asset_via_api(client, auth_headers, "GATE1")

    assert response.status_code == 201, response.text
    assert len(recorded_delays["backfill_ath"]) == 1
    assert len(recorded_delays["backfill_logos"]) == 1
