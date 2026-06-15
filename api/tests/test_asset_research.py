import pytest

from app.models import Asset
from app.models.enums import AssetClass
from app.services.asset_intelligence.asset_research import AssetResearchService


def test_research_themes_skip_non_equity_without_fetching_company_info(monkeypatch, test_db):
    asset = Asset(
        symbol="SPY",
        name="SPDR S&P 500 ETF Trust",
        currency="USD",
        class_=AssetClass.ETF,
        asset_type="ETF",
    )
    test_db.add(asset)
    test_db.commit()
    test_db.refresh(asset)

    service = AssetResearchService(test_db)

    def fail_fetch(*_args, **_kwargs):
        pytest.fail("ETF theme lookup should not fetch company info")

    monkeypatch.setattr(service, "_get_company_info", fail_fetch)
    monkeypatch.setattr(service, "_ensure_theme_classification", fail_fetch)

    classification = service.get_themes("SPY")

    assert classification.asset_id == asset.id
    assert classification.themes == []
    assert classification.source_hash is None
