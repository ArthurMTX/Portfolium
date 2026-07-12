import pytest

from app.models import Asset
from app.models.enums import AssetClass
from app.services.market_data import trade_republic_logos as tr_logos

ISIN = "US0378331005"
LIGHT_URL = f"https://assets.traderepublic.com/img/logos/{ISIN}/v2/light.min.svg"
DARK_URL = f"https://assets.traderepublic.com/img/logos/{ISIN}/v2/dark.min.svg"
LIGHT_SVG = b'<svg xmlns="http://www.w3.org/2000/svg"><text>light</text></svg>'
DARK_SVG = b'<svg xmlns="http://www.w3.org/2000/svg"><text>dark</text></svg>'


@pytest.fixture
def fake_trade_republic_logo_fetch(monkeypatch):
    calls = []

    def fake_fetch(url):
        calls.append(url)
        if url == LIGHT_URL:
            return LIGHT_SVG
        if url == DARK_URL:
            return DARK_SVG
        return None

    monkeypatch.setattr(tr_logos, "fetch_trade_republic_logo_url", fake_fetch)
    return calls


def _make_asset(db, **overrides):
    defaults = dict(symbol="AAPL", name="Apple Inc.", currency="USD", class_=AssetClass.STOCK)
    defaults.update(overrides)
    asset = Asset(**defaults)
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def test_logo_proxies_trade_republic_light_by_default(client, test_db, fake_trade_republic_logo_fetch):
    asset = _make_asset(
        test_db,
        isin=ISIN,
        asset_type="EQUITY",
        logo_provider="trade_republic",
        logo_light_url=LIGHT_URL,
        logo_dark_url=DARK_URL,
    )

    response = client.get("/assets/logo/AAPL", follow_redirects=False)

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/svg+xml"
    assert response.content == LIGHT_SVG
    assert "location" not in response.headers
    assert fake_trade_republic_logo_fetch == [LIGHT_URL]

    test_db.refresh(asset)
    assert asset.logo_light_data == LIGHT_SVG


def test_logo_proxies_dark_variant_when_requested(client, test_db, fake_trade_republic_logo_fetch):
    _make_asset(
        test_db,
        isin=ISIN,
        asset_type="EQUITY",
        logo_provider="trade_republic",
        logo_light_url=LIGHT_URL,
        logo_dark_url=DARK_URL,
    )

    response = client.get("/assets/logo/AAPL?variant=dark", follow_redirects=False)

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/svg+xml"
    assert response.content == DARK_SVG
    assert "location" not in response.headers


def test_logo_dark_variant_falls_back_to_light_when_only_light_available(client, test_db, fake_trade_republic_logo_fetch):
    _make_asset(
        test_db,
        isin=ISIN,
        asset_type="EQUITY",
        logo_provider="trade_republic",
        logo_light_url=LIGHT_URL,
        logo_dark_url=None,
    )

    response = client.get("/assets/logo/AAPL?variant=dark", follow_redirects=False)

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/svg+xml"
    assert response.content == LIGHT_SVG
    assert "location" not in response.headers


def test_logo_uses_cached_trade_republic_variant_without_refetch(client, test_db, fake_trade_republic_logo_fetch):
    _make_asset(
        test_db,
        isin=ISIN,
        asset_type="EQUITY",
        logo_provider="trade_republic",
        logo_light_url=LIGHT_URL,
        logo_dark_url=DARK_URL,
        logo_light_data=LIGHT_SVG,
        logo_dark_data=DARK_SVG,
    )

    response = client.get("/assets/logo/AAPL?variant=dark", follow_redirects=False)

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/svg+xml"
    assert response.content == DARK_SVG
    assert fake_trade_republic_logo_fetch == []


def test_logo_without_isin_uses_legacy_generated_fallback(client, test_db, monkeypatch):
    _make_asset(test_db, symbol="SPY", asset_type="ETF")

    response = client.get("/assets/logo/SPY", follow_redirects=False)

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/svg+xml"
    assert b"<svg" in response.content


WEBP_BYTES = b"RIFF....WEBPVP8 fake-image-bytes"


class _FakeCache:
    """In-memory stand-in for CacheService (tests run with REDIS_ENABLED=false)."""

    def __init__(self):
        self.store = {}

    def exists(self, key):
        return key in self.store

    def set(self, key, value, ttl=None, nx=False):
        self.store[key] = value
        return True


@pytest.fixture
def fake_logo_cache(monkeypatch):
    from app.routers import assets as assets_router

    fake = _FakeCache()
    monkeypatch.setattr(assets_router, "CacheService", fake)
    return fake


def test_etf_logo_served_from_db_cache_without_external_fetch(client, test_db, fake_logo_cache, monkeypatch):
    """ETFs no longer bypass the server cache: a provider-supplied cached logo is returned as-is."""
    from app.services.market_data import logos as logos_module

    def _fail(*args, **kwargs):
        raise AssertionError("external logo fetch must not run for a cached ETF logo")

    monkeypatch.setattr(logos_module, "fetch_logo_with_source", _fail)

    _make_asset(
        test_db,
        symbol="VOO",
        asset_type="ETF",
        logo_provider="brandfetch",
        logo_data=WEBP_BYTES,
        logo_content_type="image/webp",
    )

    response = client.get("/assets/logo/VOO", follow_redirects=False)

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/webp"
    assert response.content == WEBP_BYTES


def test_crypto_logo_served_from_db_cache_without_external_fetch(client, test_db, fake_logo_cache, monkeypatch):
    from app.services.market_data import logos as logos_module

    def _fail(*args, **kwargs):
        raise AssertionError("external logo fetch must not run for a cached crypto logo")

    monkeypatch.setattr(logos_module, "fetch_logo_with_source", _fail)

    _make_asset(
        test_db,
        symbol="BTC-USD",
        asset_type="CRYPTO",
        logo_provider="brandfetch",
        logo_data=WEBP_BYTES,
        logo_content_type="image/webp",
    )

    response = client.get("/assets/logo/BTC-USD", follow_redirects=False)

    assert response.status_code == 200
    assert response.content == WEBP_BYTES


def test_generated_placeholder_bytes_never_served_from_db_cache(client, test_db, fake_logo_cache):
    """Legacy rows can hold image bytes under logo_provider='generated' (wrong-brand era); reject them."""
    _make_asset(
        test_db,
        symbol="VT",
        asset_type="ETF",
        logo_provider="generated",
        logo_data=b"legacy-wrong-brand-webp",
        logo_content_type="image/webp",
    )

    response = client.get("/assets/logo/VT", follow_redirects=False)

    assert response.status_code == 200
    assert response.content != b"legacy-wrong-brand-webp"
    assert response.headers["content-type"] == "image/svg+xml"  # generated fallback


def test_failed_resolution_is_negative_cached_and_not_retried(client, test_db, fake_logo_cache, monkeypatch):
    from app.services.market_data import logo_resolver
    from app.services.market_data.logo_resolver import LogoResolutionResult

    calls = []

    def fake_resolve(db, asset, **kwargs):
        calls.append(asset.symbol)
        return LogoResolutionResult(
            provider="generated",
            logo_bytes=b"<svg>fallback</svg>",
            logo_content_type="image/svg+xml",
        )

    monkeypatch.setattr(logo_resolver, "resolve_asset_logo", fake_resolve)
    _make_asset(test_db, symbol="NOLOGO", asset_type="EQUITY")

    first = client.get("/assets/logo/NOLOGO", follow_redirects=False)
    assert first.status_code == 200
    assert calls == ["NOLOGO"]
    assert fake_logo_cache.exists("logo:neg:NOLOGO")

    second = client.get("/assets/logo/NOLOGO", follow_redirects=False)
    assert second.status_code == 200
    assert second.headers["content-type"] == "image/svg+xml"
    assert calls == ["NOLOGO"], "resolution must not re-run during the negative-cache cooldown"


def test_transient_resolution_failure_is_not_negative_cached(client, test_db, fake_logo_cache, monkeypatch):
    from app.services.market_data import logo_resolver
    from app.services.market_data.logo_resolver import LogoResolutionResult

    calls = []

    def flaky_resolve(db, asset, **kwargs):
        calls.append(asset.symbol)
        if len(calls) == 1:
            raise RuntimeError("provider unreachable")
        return LogoResolutionResult(
            provider="generated",
            logo_bytes=b"<svg>fallback</svg>",
            logo_content_type="image/svg+xml",
        )

    monkeypatch.setattr(logo_resolver, "resolve_asset_logo", flaky_resolve)
    _make_asset(test_db, symbol="FLAKY", asset_type="EQUITY")

    with pytest.raises(RuntimeError):
        client.get("/assets/logo/FLAKY", follow_redirects=False)

    assert not fake_logo_cache.exists("logo:neg:FLAKY"), "exceptions must not be negative-cached"

    second = client.get("/assets/logo/FLAKY", follow_redirects=False)
    assert second.status_code == 200
    assert calls == ["FLAKY", "FLAKY"], "resolution must be retried after a transient failure"
