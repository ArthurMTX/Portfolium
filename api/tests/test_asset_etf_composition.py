from types import SimpleNamespace

import pandas as pd
import pytest

from app.models import Asset
from app.models.enums import AssetClass
from app.services.asset_research import AssetResearchService


def test_etf_composition_returns_normalized_payload_for_etf(test_db, monkeypatch):
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
    monkeypatch.setattr(service, "_get_company_info", lambda _symbol: {"quoteType": "ETF"})

    holdings = pd.DataFrame(
        [
            {"Symbol": "MSFT", "Name": "Microsoft Corp", "Holding Percent": 0.0514},
            {"Symbol": "AAPL", "Name": "Apple Inc", "Holding Percent": 0.0705},
            {"Symbol": "NVDA", "Name": "NVIDIA Corp", "Holding Percent": 0.0789},
        ]
    ).set_index("Symbol")
    funds_data = SimpleNamespace(
        top_holdings=holdings,
        sector_weightings={"technology": 0.3905, "financial_services": 0.1107, "energy": 0.0313},
        asset_classes={"stockPosition": 0.9989, "cashPosition": 0.0011, "bondPosition": 0.0, "otherPosition": 0.0},
    )
    monkeypatch.setattr(service, "_get_funds_data", lambda _symbol: funds_data)

    result = service.get_etf_composition("SPY")

    assert result["available"] is True
    assert result["holdings_available"] is True
    assert result["sector_weightings_available"] is True
    assert result["asset_classes_available"] is True
    assert result["largest_holding"] == {"symbol": "NVDA", "name": "NVIDIA Corp", "weight": 0.0789}
    assert result["holdings"][0]["symbol"] == "NVDA"
    assert result["holdings"][1]["symbol"] == "AAPL"
    assert result["holdings"][2]["symbol"] == "MSFT"
    assert result["total_top10_weight"] == pytest.approx(0.2008)
    assert result["sector_weightings"][0]["sector"] == "Technology"
    assert result["asset_classes"][0]["name"] == "Stocks"


def test_etf_composition_hides_uninformative_asset_allocation(test_db, monkeypatch):
    asset = Asset(
        symbol="CL2.PA",
        name="Example ETF",
        currency="EUR",
        class_=AssetClass.ETF,
        asset_type="ETF",
    )
    test_db.add(asset)
    test_db.commit()
    test_db.refresh(asset)

    service = AssetResearchService(test_db)
    monkeypatch.setattr(service, "_get_company_info", lambda _symbol: {"quoteType": "ETF"})
    monkeypatch.setattr(
        service,
        "_get_funds_data",
        lambda _symbol: SimpleNamespace(
            top_holdings=pd.DataFrame(columns=["Name", "Holding Percent"]),
            sector_weightings={},
            asset_classes={
                "stockPosition": 0.0,
                "cashPosition": 0.0,
                "bondPosition": 0.0,
                "preferredPosition": 0.0,
                "convertiblePosition": 0.0,
                "otherPosition": 1.0,
            },
        ),
    )

    result = service.get_etf_composition("CL2.PA")

    assert result["available"] is True
    assert result["holdings_available"] is False
    assert result["sector_weightings_available"] is False
    assert result["asset_classes_available"] is False
    assert result["holdings"] == []
    assert result["sector_weightings"] == []
    assert result["asset_classes"] == []


def test_etf_composition_returns_unavailable_for_non_etf(test_db, monkeypatch):
    asset = Asset(
        symbol="AAPL",
        name="Apple Inc",
        currency="USD",
        class_=AssetClass.STOCK,
        asset_type="EQUITY",
    )
    test_db.add(asset)
    test_db.commit()
    test_db.refresh(asset)

    service = AssetResearchService(test_db)
    monkeypatch.setattr(service, "_get_company_info", lambda _symbol: {"quoteType": "EQUITY"})

    result = service.get_etf_composition("AAPL")

    assert result == {"available": False}


def test_etf_composition_endpoint_returns_payload(client, monkeypatch):
    monkeypatch.setattr(
        AssetResearchService,
        "get_etf_composition",
        lambda self, symbol: {
            "available": True,
            "holdings_available": False,
            "sector_weightings_available": False,
            "asset_classes_available": False,
            "holdings": [],
            "sector_weightings": [],
            "asset_classes": [],
        },
    )

    response = client.get("/assets/SPY/etf-composition")

    assert response.status_code == 200
    assert response.json()["available"] is True