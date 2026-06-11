import pytest

from app.crud import assets as crud_assets
from app.errors import InvalidAssetSymbolError
from app.models import Asset
from app.routers.assets import _cleanup_invalid_provider_assets
from app.schemas import AssetCreate


class FakeProvider:
    def __init__(self, info_by_symbol=None, errors_by_symbol=None):
        self.info_by_symbol = info_by_symbol or {}
        self.errors_by_symbol = errors_by_symbol or {}

    def get_info(self, symbol, **_kwargs):
        if symbol in self.errors_by_symbol:
            raise self.errors_by_symbol[symbol]
        return self.info_by_symbol.get(symbol, {})


def patch_provider(monkeypatch, provider):
    monkeypatch.setattr(
        "app.services.yahoo_finance.get_market_data_provider",
        lambda: provider,
    )


def test_create_asset_rejects_yahoo_lookup_failure(test_db, monkeypatch):
    patch_provider(
        monkeypatch,
        FakeProvider(errors_by_symbol={"EXAS": RuntimeError("Quote not found for symbol: EXAS")}),
    )
    before_count = test_db.query(Asset).count()

    with pytest.raises(InvalidAssetSymbolError):
        crud_assets.create_asset(test_db, AssetCreate(symbol="EXAS"))

    assert test_db.query(Asset).count() == before_count
    assert crud_assets.get_asset_by_symbol(test_db, "EXAS") is None


def test_create_asset_uses_yahoo_identity_fields(test_db, monkeypatch):
    patch_provider(
        monkeypatch,
        FakeProvider(
            info_by_symbol={
                "AAPL": {
                    "symbol": "AAPL",
                    "quoteType": "EQUITY",
                    "longName": "Apple Inc.",
                    "currency": "USD",
                    "sector": "Technology",
                }
            }
        ),
    )

    asset = crud_assets.create_asset(test_db, AssetCreate(symbol="AAPL", name="AAPL"))

    assert asset.symbol == "AAPL"
    assert asset.name == "Apple Inc."
    assert asset.asset_type == "EQUITY"
    assert asset.sector == "Technology"


def test_delete_invalid_provider_assets_deletes_only_rejected_symbols(test_db, test_user, monkeypatch):
    good = Asset(symbol="AAPL", name="Apple Inc.", currency="USD")
    bad = Asset(symbol="NOPE", name="NOPE", currency="USD")
    sparse = Asset(symbol="SPARSE", name="SPARSE", currency="USD")
    transient = Asset(symbol="TIMEOUT", name="TIMEOUT", currency="USD")
    test_db.add_all([good, bad, sparse, transient])
    test_db.commit()

    patch_provider(
        monkeypatch,
        FakeProvider(
            info_by_symbol={
                "AAPL": {"symbol": "AAPL", "quoteType": "EQUITY", "shortName": "Apple"},
                "SPARSE": {},
            },
            errors_by_symbol={
                "NOPE": RuntimeError("Quote not found for symbol: NOPE"),
                "TIMEOUT": RuntimeError("Yahoo timeout"),
            },
        ),
    )

    preview = _cleanup_invalid_provider_assets(
        test_db,
        dry_run=True,
        symbols=["AAPL", "NOPE", "SPARSE", "TIMEOUT"],
    )

    assert preview["scanned"] == 4
    assert preview["valid"] == 1
    assert [candidate["symbol"] for candidate in preview["candidates"]] == ["NOPE", "SPARSE"]
    assert {asset["symbol"] for asset in preview["unresolved"]} == {"TIMEOUT"}

    result = _cleanup_invalid_provider_assets(
        test_db,
        dry_run=False,
        symbols=["AAPL", "NOPE", "SPARSE", "TIMEOUT"],
    )

    assert result["deleted"] == 2
    assert crud_assets.get_asset_by_symbol(test_db, "NOPE") is None
    assert crud_assets.get_asset_by_symbol(test_db, "AAPL") is not None
    assert crud_assets.get_asset_by_symbol(test_db, "SPARSE") is None
    assert crud_assets.get_asset_by_symbol(test_db, "TIMEOUT") is not None
