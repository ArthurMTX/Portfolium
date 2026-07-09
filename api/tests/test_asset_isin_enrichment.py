"""Integration tests: Adanos ISIN enrichment via crud.assets and logo_resolver.

Yahoo Finance stays authoritative; Adanos only fills ISIN when Yahoo doesn't
provide one, and never overwrites a valid existing ISIN.
"""
from app.crud import assets as crud_assets
from app.models import Asset
from app.models.enums import AssetClass
from app.models.reference_data import AdanosListing
from app.schemas import AssetCreate
from app.services.market_data import logo_resolver


class FakeProvider:
    def __init__(self, info_by_symbol=None, isin_by_symbol=None):
        self.info_by_symbol = info_by_symbol or {}
        self.isin_by_symbol = isin_by_symbol or {}
        self.get_isin_calls = 0

    def get_info(self, symbol, **_kwargs):
        return self.info_by_symbol.get(symbol, {})

    def get_isin(self, symbol, **_kwargs):
        self.get_isin_calls += 1
        return self.isin_by_symbol.get(symbol)


def _patch_provider(monkeypatch, provider):
    monkeypatch.setattr(
        "app.services.market_data.yahoo_finance.get_market_data_provider",
        lambda: provider,
    )


def _seed_adanos(db, listing_key, ticker, exchange, isin, name="D-Wave Quantum Inc."):
    db.add(
        AdanosListing(
            listing_key=listing_key,
            ticker=ticker,
            exchange=exchange,
            isin=isin,
            name=name,
        )
    )
    db.commit()


def _make_asset(db, **overrides):
    defaults = dict(symbol="AAPL", name="Apple Inc.", currency="USD", class_=AssetClass.STOCK)
    defaults.update(overrides)
    asset = Asset(**defaults)
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


# --- crud.create_asset ---------------------------------------------------

def test_create_asset_backfills_isin_from_adanos_when_yahoo_has_none(test_db, monkeypatch):
    _patch_provider(
        monkeypatch,
        FakeProvider(info_by_symbol={"QBTS": {"quoteType": "EQUITY", "longName": "D-Wave Quantum Inc."}}),
    )
    _seed_adanos(test_db, "NYSE::QBTS", "QBTS", "NYSE", "US26740W1099")

    asset = crud_assets.create_asset(test_db, AssetCreate(symbol="QBTS"))

    assert asset.isin == "US26740W1099"


def test_create_asset_prefers_adanos_isin_over_yahoo_info_field(test_db, monkeypatch):
    # Adanos is checked before Yahoo's (rarely populated) info['isin'] field --
    # confirmed necessary in practice: yfinance's ISIN scrape has been observed
    # returning a wrong-country ISIN for some symbols (e.g. a Canadian ISIN for
    # GOOGL) while Adanos has the correct one.
    _patch_provider(
        monkeypatch,
        FakeProvider(
            info_by_symbol={
                "QBTS": {"quoteType": "EQUITY", "longName": "D-Wave Quantum Inc.", "isin": "US67066G1040"}
            }
        ),
    )
    _seed_adanos(test_db, "NYSE::QBTS", "QBTS", "NYSE", "US26740W1099")

    asset = crud_assets.create_asset(test_db, AssetCreate(symbol="QBTS"))

    assert asset.isin == "US26740W1099"  # Adanos value wins over Yahoo's info['isin']


def test_create_asset_falls_back_to_yahoo_info_isin_when_adanos_has_nothing(test_db, monkeypatch):
    _patch_provider(
        monkeypatch,
        FakeProvider(
            info_by_symbol={
                "QBTS": {"quoteType": "EQUITY", "longName": "D-Wave Quantum Inc.", "isin": "US26740W1099"}
            }
        ),
    )
    # No Adanos row seeded at all -- Yahoo's info['isin'] is the only source available.

    asset = crud_assets.create_asset(test_db, AssetCreate(symbol="QBTS"))

    assert asset.isin == "US26740W1099"


def test_create_asset_leaves_isin_null_when_neither_source_has_one(test_db, monkeypatch):
    _patch_provider(monkeypatch, FakeProvider(info_by_symbol={"QBTS": {"quoteType": "EQUITY", "longName": "D-Wave"}}))

    asset = crud_assets.create_asset(test_db, AssetCreate(symbol="QBTS"))

    assert asset.isin is None


# --- crud.enrich_asset_metadata -------------------------------------------

def test_enrich_asset_metadata_backfills_missing_isin_via_adanos(test_db, monkeypatch):
    asset = _make_asset(test_db, symbol="QBTS", name="D-Wave Quantum Inc.", isin=None)
    _patch_provider(monkeypatch, FakeProvider(info_by_symbol={"QBTS": {"sector": "Technology"}}))
    _seed_adanos(test_db, "NYSE::QBTS", "QBTS", "NYSE", "US26740W1099")

    updated = crud_assets.enrich_asset_metadata(test_db, asset.id)

    assert updated.isin == "US26740W1099"


def test_enrich_asset_metadata_does_not_overwrite_existing_valid_isin(test_db, monkeypatch):
    asset = _make_asset(test_db, symbol="QBTS", isin="US26740W1099")
    _patch_provider(monkeypatch, FakeProvider(info_by_symbol={"QBTS": {"sector": "Technology"}}))
    _seed_adanos(test_db, "NYSE::QBTS", "QBTS", "NYSE", "US67066G1040")  # different, deliberately wrong ISIN

    updated = crud_assets.enrich_asset_metadata(test_db, asset.id)

    assert updated.isin == "US26740W1099"


# --- logo_resolver.resolve_asset_logo -------------------------------------

def test_resolve_asset_logo_resolves_isin_via_adanos_before_trying_yahoo(test_db, monkeypatch):
    asset = _make_asset(test_db, symbol="QBTS", name="D-Wave Quantum Inc.", asset_type="EQUITY", isin=None)

    def fail_get_isin(*_args, **_kwargs):
        raise AssertionError("Yahoo's get_isin should not be called when Adanos already resolved the ISIN")

    provider = FakeProvider()
    provider.get_isin = fail_get_isin
    monkeypatch.setattr(
        "app.services.market_data.yahoo_finance.get_market_data_provider",
        lambda: provider,
    )
    _seed_adanos(test_db, "NYSE::QBTS", "QBTS", "NYSE", "US26740W1099")
    monkeypatch.setattr(
        logo_resolver,
        "fetch_logo_with_source",
        lambda ticker, company_name=None, asset_type=None: (b'<svg xmlns="http://www.w3.org/2000/svg"></svg>', "generated"),
    )

    result = logo_resolver.resolve_asset_logo(test_db, asset, allow_isin_lookup=True)

    assert asset.isin == "US26740W1099"
    assert result.isin_resolved is True


def test_resolve_asset_logo_falls_back_to_yahoo_when_adanos_has_nothing(test_db, monkeypatch):
    asset = _make_asset(test_db, symbol="QBTS", name="D-Wave Quantum Inc.", asset_type="EQUITY", isin=None)
    provider = FakeProvider(isin_by_symbol={"QBTS": "US26740W1099"})  # no Adanos row seeded at all
    monkeypatch.setattr(
        "app.services.market_data.yahoo_finance.get_market_data_provider",
        lambda: provider,
    )
    monkeypatch.setattr(
        logo_resolver,
        "fetch_logo_with_source",
        lambda ticker, company_name=None, asset_type=None: (b'<svg xmlns="http://www.w3.org/2000/svg"></svg>', "generated"),
    )

    result = logo_resolver.resolve_asset_logo(test_db, asset, allow_isin_lookup=True)

    assert asset.isin == "US26740W1099"
    assert result.isin_resolved is True


def test_resolve_asset_logo_never_touches_existing_isin(test_db, monkeypatch):
    asset = _make_asset(test_db, symbol="QBTS", asset_type="EQUITY", isin="US26740W1099")
    provider = FakeProvider()

    def fail_get_isin(*_args, **_kwargs):
        raise AssertionError("get_isin should not be called when asset.isin is already set")

    provider.get_isin = fail_get_isin
    monkeypatch.setattr(
        "app.services.market_data.yahoo_finance.get_market_data_provider",
        lambda: provider,
    )
    monkeypatch.setattr(
        logo_resolver,
        "fetch_logo_with_source",
        lambda ticker, company_name=None, asset_type=None: (b'<svg xmlns="http://www.w3.org/2000/svg"></svg>', "generated"),
    )

    logo_resolver.resolve_asset_logo(test_db, asset, allow_isin_lookup=True)

    assert asset.isin == "US26740W1099"
