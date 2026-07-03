import pytest

from app.models import Asset
from app.models.enums import AssetClass
from app.models.reference_data import AdanosListing
from app.services.market_data import logo_resolver

ISIN = "US0378331005"
GENERATED_SVG = b'<svg xmlns="http://www.w3.org/2000/svg"><text>AAP</text></svg>'
BRANDFETCH_BYTES = b"\x89PNG\r\n\x1a\nfakebytes"


def _make_asset(db, **overrides):
    defaults = dict(symbol="AAPL", name="Apple Inc.", currency="USD", class_=AssetClass.STOCK)
    defaults.update(overrides)
    asset = Asset(**defaults)
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


class FakeProvider:
    def __init__(self, isin=None, raises=False):
        self._isin = isin
        self._raises = raises
        self.calls = 0

    def get_isin(self, symbol, **kwargs):
        self.calls += 1
        if self._raises:
            raise RuntimeError("boom")
        return self._isin


def test_resolves_isin_then_trade_republic(monkeypatch, test_db):
    asset = _make_asset(test_db, asset_type="EQUITY")

    fake_provider = FakeProvider(isin=ISIN)
    monkeypatch.setattr(
        "app.services.market_data.yahoo_finance.get_market_data_provider",
        lambda: fake_provider,
    )
    monkeypatch.setattr(
        logo_resolver,
        "fetch_trade_republic_logos",
        lambda isin: {"light": b"<svg>light</svg>", "dark": b"<svg>dark</svg>"},
    )

    result = logo_resolver.resolve_asset_logo(test_db, asset)

    assert result.provider == "trade_republic"
    assert result.isin_resolved is True
    assert asset.isin == ISIN
    assert asset.logo_provider == "trade_republic"
    assert asset.logo_light_url.endswith("/light.min.svg")
    assert asset.logo_dark_url.endswith("/dark.min.svg")
    assert asset.logo_url == asset.logo_light_url
    assert asset.logo_fetched_at is not None


def test_isin_present_tr_empty_falls_back_to_brandfetch(monkeypatch, test_db):
    asset = _make_asset(test_db, asset_type="EQUITY", isin=ISIN)

    monkeypatch.setattr(logo_resolver, "fetch_trade_republic_logos", lambda isin: {})
    monkeypatch.setattr(
        logo_resolver,
        "fetch_logo_with_validation",
        lambda ticker, company_name=None, asset_type=None: BRANDFETCH_BYTES,
    )

    result = logo_resolver.resolve_asset_logo(test_db, asset, allow_isin_lookup=False)

    assert result.provider == "brandfetch"
    assert result.logo_bytes == BRANDFETCH_BYTES
    assert asset.logo_provider == "brandfetch"
    assert asset.logo_data == BRANDFETCH_BYTES


def test_etf_without_isin_falls_back_to_generated(monkeypatch, test_db):
    asset = _make_asset(test_db, symbol="SPY", asset_type="ETF")

    monkeypatch.setattr(
        logo_resolver,
        "fetch_logo_with_validation",
        lambda ticker, company_name=None, asset_type=None: GENERATED_SVG,
    )

    result = logo_resolver.resolve_asset_logo(test_db, asset, allow_isin_lookup=False)

    assert result.provider == "generated"
    assert result.logo_bytes == GENERATED_SVG
    assert asset.logo_provider == "generated"


def test_existing_trade_republic_logo_is_not_overwritten_without_force(monkeypatch, test_db):
    asset = _make_asset(
        test_db,
        isin=ISIN,
        logo_provider="trade_republic",
        logo_light_url="https://assets.traderepublic.com/img/logos/US0378331005/v2/light.min.svg",
    )

    calls = {"count": 0}

    def spy_fetch(isin):
        calls["count"] += 1
        return {"light": b"<svg>should not be called</svg>"}

    monkeypatch.setattr(logo_resolver, "fetch_trade_republic_logos", spy_fetch)

    result = logo_resolver.resolve_asset_logo(test_db, asset)

    assert result.provider == "unchanged"
    assert calls["count"] == 0


def test_force_true_reresolves_existing_trade_republic_logo(monkeypatch, test_db):
    asset = _make_asset(
        test_db,
        isin=ISIN,
        logo_provider="trade_republic",
        logo_light_url="https://assets.traderepublic.com/img/logos/US0378331005/v2/light.min.svg",
    )

    monkeypatch.setattr(logo_resolver, "fetch_trade_republic_logos", lambda isin: {})
    monkeypatch.setattr(
        logo_resolver,
        "fetch_logo_with_validation",
        lambda ticker, company_name=None, asset_type=None: GENERATED_SVG,
    )

    result = logo_resolver.resolve_asset_logo(test_db, asset, force=True, allow_isin_lookup=False)

    assert result.provider == "generated"


def test_crypto_asset_never_triggers_isin_or_trade_republic(monkeypatch, test_db):
    asset = _make_asset(test_db, symbol="BTC-USD", asset_type="CRYPTOCURRENCY")

    fake_provider = FakeProvider(isin=ISIN)
    monkeypatch.setattr(
        "app.services.market_data.yahoo_finance.get_market_data_provider",
        lambda: fake_provider,
    )

    def fail_tr(isin):
        pytest.fail("Trade Republic should never be called for crypto")

    monkeypatch.setattr(logo_resolver, "fetch_trade_republic_logos", fail_tr)
    monkeypatch.setattr(
        logo_resolver,
        "fetch_logo_with_validation",
        lambda ticker, company_name=None, asset_type=None: GENERATED_SVG,
    )

    result = logo_resolver.resolve_asset_logo(test_db, asset, allow_isin_lookup=True)

    assert fake_provider.calls == 0
    assert result.provider == "generated"


def test_get_isin_exception_does_not_break_resolution(monkeypatch, test_db):
    asset = _make_asset(test_db, asset_type="EQUITY")

    fake_provider = FakeProvider(raises=True)
    monkeypatch.setattr(
        "app.services.market_data.yahoo_finance.get_market_data_provider",
        lambda: fake_provider,
    )
    monkeypatch.setattr(
        logo_resolver,
        "fetch_logo_with_validation",
        lambda ticker, company_name=None, asset_type=None: GENERATED_SVG,
    )

    result = logo_resolver.resolve_asset_logo(test_db, asset, allow_isin_lookup=True)

    assert result.provider == "generated"
    assert asset.isin is None


def test_adanos_isin_resolved_before_yahoo_is_ever_called(monkeypatch, test_db):
    asset = _make_asset(test_db, symbol="QBTS", name="D-Wave Quantum Inc.", asset_type="EQUITY")
    test_db.add(
        AdanosListing(
            listing_key="NYSE::QBTS",
            ticker="QBTS",
            exchange="NYSE",
            name="D-Wave Quantum Inc.",
            isin="US26740W1099",
        )
    )
    test_db.commit()

    def fail_get_isin(*_args, **_kwargs):
        raise AssertionError("Yahoo's get_isin should not be called when Adanos already resolved the ISIN")

    fake_provider = FakeProvider()
    fake_provider.get_isin = fail_get_isin
    monkeypatch.setattr(
        "app.services.market_data.yahoo_finance.get_market_data_provider",
        lambda: fake_provider,
    )
    monkeypatch.setattr(logo_resolver, "fetch_trade_republic_logos", lambda isin: {})
    monkeypatch.setattr(
        logo_resolver,
        "fetch_logo_with_validation",
        lambda ticker, company_name=None, asset_type=None: GENERATED_SVG,
    )

    result = logo_resolver.resolve_asset_logo(test_db, asset, allow_isin_lookup=True)

    assert asset.isin == "US26740W1099"
    assert result.isin_resolved is True


def test_sibling_trade_republic_logo_is_reused_across_exchanges(monkeypatch, test_db):
    # "ASML" already has a resolved Trade Republic logo. "ASML.AS" (the same
    # company on a different exchange, with its own ISIN lookup failing)
    # should reuse ASML's logo instead of falling through to Brandfetch.
    sibling = _make_asset(
        test_db,
        symbol="ASML",
        name="ASML Holding N.V.",
        asset_type="EQUITY",
        isin="USN070592100",
        logo_provider="trade_republic",
        logo_light_url="https://assets.traderepublic.com/img/logos/USN070592100/v2/light.min.svg",
        logo_dark_url="https://assets.traderepublic.com/img/logos/USN070592100/v2/dark.min.svg",
        logo_url="https://assets.traderepublic.com/img/logos/USN070592100/v2/light.min.svg",
    )
    asset = _make_asset(test_db, symbol="ASML.AS", name="ASML Holding N.V.", asset_type="EQUITY", isin=None)

    monkeypatch.setattr(logo_resolver, "fetch_trade_republic_logos", lambda isin: {})

    def fail_brandfetch(*_args, **_kwargs):
        pytest.fail("Should reuse the sibling's Trade Republic logo instead of falling back to Brandfetch")

    monkeypatch.setattr(logo_resolver, "fetch_logo_with_validation", fail_brandfetch)

    result = logo_resolver.resolve_asset_logo(test_db, asset, allow_isin_lookup=False)

    assert result.provider == "trade_republic"
    assert asset.logo_provider == "trade_republic"
    assert asset.logo_light_url == sibling.logo_light_url
    assert asset.logo_dark_url == sibling.logo_dark_url
    # The asset's own (missing) ISIN is not touched/borrowed -- only the logo is shared.
    assert asset.isin is None


def test_sibling_logo_not_reused_for_crypto(monkeypatch, test_db):
    _make_asset(
        test_db,
        symbol="BTC",
        asset_type="EQUITY",
        logo_provider="trade_republic",
        logo_light_url="https://assets.traderepublic.com/img/logos/FAKE/v2/light.min.svg",
    )
    asset = _make_asset(test_db, symbol="BTC-USD", asset_type="CRYPTOCURRENCY", isin=None)

    monkeypatch.setattr(
        logo_resolver,
        "fetch_logo_with_validation",
        lambda ticker, company_name=None, asset_type=None: GENERATED_SVG,
    )

    result = logo_resolver.resolve_asset_logo(test_db, asset, allow_isin_lookup=True)

    assert result.provider == "generated"
    assert asset.logo_provider == "generated"


def test_force_lets_adanos_correct_a_wrong_existing_isin(monkeypatch, test_db):
    # A previously-stored (wrong) ISIN, e.g. from yfinance's scrape, should
    # be correctable by Adanos on a forced re-resolve.
    asset = _make_asset(
        test_db, symbol="GOOGL", name="Alphabet Inc.", asset_type="EQUITY", isin="CA02080M1005"
    )
    test_db.add(
        AdanosListing(
            listing_key="NASDAQ::GOOGL",
            ticker="GOOGL",
            exchange="NASDAQ",
            name="Alphabet Inc Class A",
            isin="US02079K3059",
        )
    )
    test_db.commit()

    monkeypatch.setattr(logo_resolver, "fetch_trade_republic_logos", lambda isin: {})
    monkeypatch.setattr(
        logo_resolver,
        "fetch_logo_with_validation",
        lambda ticker, company_name=None, asset_type=None: GENERATED_SVG,
    )

    logo_resolver.resolve_asset_logo(test_db, asset, force=True, allow_isin_lookup=True)

    assert asset.isin == "US02079K3059"


def test_force_keeps_existing_isin_when_adanos_has_nothing(monkeypatch, test_db):
    # Yahoo's scrape must never overwrite an already-stored ISIN, even under
    # force -- it's only ever used to fill a true gap.
    asset = _make_asset(test_db, symbol="QBTS", name="D-Wave Quantum Inc.", asset_type="EQUITY", isin=ISIN)

    def fail_get_isin(*_args, **_kwargs):
        raise AssertionError("Yahoo's get_isin should never be called when the asset already has an ISIN")

    fake_provider = FakeProvider()
    fake_provider.get_isin = fail_get_isin
    monkeypatch.setattr(
        "app.services.market_data.yahoo_finance.get_market_data_provider",
        lambda: fake_provider,
    )
    monkeypatch.setattr(logo_resolver, "fetch_trade_republic_logos", lambda isin: {})
    monkeypatch.setattr(
        logo_resolver,
        "fetch_logo_with_validation",
        lambda ticker, company_name=None, asset_type=None: GENERATED_SVG,
    )

    logo_resolver.resolve_asset_logo(test_db, asset, force=True, allow_isin_lookup=True)

    assert asset.isin == ISIN


def test_no_sibling_falls_through_to_brandfetch(monkeypatch, test_db):
    asset = _make_asset(test_db, symbol="ZZZZ", asset_type="EQUITY", isin=None)

    monkeypatch.setattr(
        logo_resolver,
        "fetch_logo_with_validation",
        lambda ticker, company_name=None, asset_type=None: BRANDFETCH_BYTES,
    )

    result = logo_resolver.resolve_asset_logo(test_db, asset, allow_isin_lookup=False)

    assert result.provider == "brandfetch"
