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
    def fake_fetch(url):
        if url == LIGHT_URL:
            return LIGHT_SVG
        if url == DARK_URL:
            return DARK_SVG
        return None

    monkeypatch.setattr(tr_logos, "fetch_trade_republic_logo_url", fake_fetch)


def _make_asset(db, **overrides):
    defaults = dict(symbol="AAPL", name="Apple Inc.", currency="USD", class_=AssetClass.STOCK)
    defaults.update(overrides)
    asset = Asset(**defaults)
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def test_logo_proxies_trade_republic_light_by_default(client, test_db, fake_trade_republic_logo_fetch):
    _make_asset(
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


def test_logo_without_isin_uses_legacy_generated_fallback(client, test_db, monkeypatch):
    _make_asset(test_db, symbol="SPY", asset_type="ETF")

    response = client.get("/assets/logo/SPY", follow_redirects=False)

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/svg+xml"
    assert b"<svg" in response.content
