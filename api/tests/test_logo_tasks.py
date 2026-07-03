from app.models import Asset
from app.models.enums import AssetClass
from app.services.market_data.logo_resolver import LogoResolutionResult
from app.tasks import logo_tasks


def _make_asset(db, symbol, **overrides):
    defaults = dict(symbol=symbol, name=symbol, currency="USD", class_=AssetClass.STOCK)
    defaults.update(overrides)
    asset = Asset(**defaults)
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def test_backfill_mixed_outcomes(monkeypatch, test_db):
    good = _make_asset(test_db, "AAPL")
    bad = _make_asset(test_db, "BADCO")

    monkeypatch.setattr(logo_tasks, "get_db", lambda: iter([test_db]))

    def fake_resolve(db, asset, force=False, allow_isin_lookup=True, **kwargs):
        if asset.symbol == "BADCO":
            raise RuntimeError("provider exploded")
        return LogoResolutionResult(provider="trade_republic", isin_resolved=True)

    monkeypatch.setattr(
        "app.services.market_data.logo_resolver.resolve_asset_logo",
        fake_resolve,
    )

    result = logo_tasks.backfill_asset_logos()

    assert result["processed"] == 1
    assert result["trade_republic"] == 1
    assert result["isin_resolved"] == 1
    # The failing asset must not have prevented the other asset from being processed.
    assert len(result["errors"]) == 1
    assert "BADCO" in result["errors"][0]


def test_backfill_single_asset_id_filters(monkeypatch, test_db):
    target = _make_asset(test_db, "AAPL")
    _make_asset(test_db, "MSFT")

    monkeypatch.setattr(logo_tasks, "get_db", lambda: iter([test_db]))

    seen_symbols = []

    def fake_resolve(db, asset, force=False, allow_isin_lookup=True, **kwargs):
        seen_symbols.append(asset.symbol)
        return LogoResolutionResult(provider="generated")

    monkeypatch.setattr(
        "app.services.market_data.logo_resolver.resolve_asset_logo",
        fake_resolve,
    )

    result = logo_tasks.backfill_asset_logos(asset_id=target.id)

    assert seen_symbols == ["AAPL"]
    assert result["processed"] == 1


def test_backfill_second_run_does_not_refetch_sticky_resolution(monkeypatch, test_db):
    asset = _make_asset(test_db, "AAPL")

    call_count = {"n": 0}

    def fake_resolve(db, asset_obj, force=False, allow_isin_lookup=True, **kwargs):
        # Simulate the real resolver's stickiness: once trade_republic is set,
        # a subsequent call without force returns "unchanged" without doing
        # any further network work.
        if asset_obj.logo_provider == "trade_republic" and not force:
            return LogoResolutionResult(provider="unchanged")
        call_count["n"] += 1
        asset_obj.logo_provider = "trade_republic"
        db.commit()  # mirrors the real resolver persisting its resolution
        return LogoResolutionResult(provider="trade_republic", isin_resolved=True)

    monkeypatch.setattr(logo_tasks, "get_db", lambda: iter([test_db]))
    monkeypatch.setattr(
        "app.services.market_data.logo_resolver.resolve_asset_logo",
        fake_resolve,
    )

    first = logo_tasks.backfill_asset_logos()
    second = logo_tasks.backfill_asset_logos()

    assert first["trade_republic"] == 1
    assert second["unchanged"] == 1
    assert call_count["n"] == 1
