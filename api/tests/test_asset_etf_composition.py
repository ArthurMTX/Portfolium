from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pandas as pd
import pytest

from app.models import Asset, AssetThemeClassification, Portfolio, Transaction, User
from app.models.enums import AssetClass, TransactionType
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


def test_etf_theme_exposure_reuses_existing_holding_classifications(test_db):
    holdings = [
        Asset(symbol="AAPL", name="Apple Inc", currency="USD", class_=AssetClass.STOCK, asset_type="EQUITY"),
        Asset(symbol="MSFT", name="Microsoft Corp", currency="USD", class_=AssetClass.STOCK, asset_type="EQUITY"),
        Asset(symbol="NVDA", name="NVIDIA Corp", currency="USD", class_=AssetClass.STOCK, asset_type="EQUITY"),
    ]
    test_db.add_all(holdings)
    test_db.commit()

    by_symbol = {asset.symbol: asset for asset in holdings}
    test_db.add_all([
        AssetThemeClassification(
            asset_id=by_symbol["AAPL"].id,
            themes=[
                {"label": "AI Infrastructure", "weight": 0.75, "confidence": 0.9, "tier": "primary"},
                {"label": "Cloud Platforms", "weight": 0.25, "confidence": 0.8, "tier": "secondary"},
            ],
            method="gpt",
            source="gemini",
        ),
        AssetThemeClassification(
            asset_id=by_symbol["MSFT"].id,
            themes=[
                {"label": "Cloud Platforms", "weight": 1.0, "confidence": 0.9, "tier": "primary"},
            ],
            method="gpt",
            source="gemini",
        ),
    ])
    test_db.commit()

    service = AssetResearchService(test_db)
    payload = service._enrich_etf_composition({
        "available": True,
        "holdings": [
            {"symbol": "NVDA", "name": "NVIDIA Corp", "weight": 0.08},
            {"symbol": "AAPL", "name": "Apple Inc", "weight": 0.07},
            {"symbol": "MSFT", "name": "Microsoft Corp", "weight": 0.05},
        ],
    })

    exposure = {item["theme"]: item["weight"] for item in payload["theme_exposure"]}
    assert payload["theme_exposure_available"] is True
    assert payload["theme_coverage"] == pytest.approx(0.12)
    assert exposure["Cloud Platforms"] == pytest.approx(0.5625)
    assert exposure["AI Infrastructure"] == pytest.approx(0.4375)
    assert "NVDA" not in exposure


def test_etf_portfolio_overlap_uses_selected_users_current_holdings(test_db, test_user):
    portfolio = Portfolio(user_id=test_user.id, name="Main", base_currency="USD")
    other_user = User(username="other", email="other@example.com", hashed_password="hash", is_active=True)
    test_db.add_all([portfolio, other_user])
    test_db.commit()
    other_portfolio = Portfolio(user_id=other_user.id, name="Other", base_currency="USD")
    assets = [
        Asset(symbol="AAPL", name="Apple Inc", currency="USD", class_=AssetClass.STOCK, asset_type="EQUITY"),
        Asset(symbol="MSFT", name="Microsoft Corp", currency="USD", class_=AssetClass.STOCK, asset_type="EQUITY"),
        Asset(symbol="NVDA", name="NVIDIA Corp", currency="USD", class_=AssetClass.STOCK, asset_type="EQUITY"),
    ]
    test_db.add_all([other_portfolio, *assets])
    test_db.commit()

    by_symbol = {asset.symbol: asset for asset in assets}
    test_db.add_all([
        Transaction(
            portfolio_id=portfolio.id,
            asset_id=by_symbol["AAPL"].id,
            tx_date=date.today(),
            type=TransactionType.BUY,
            quantity=Decimal("2"),
            price=Decimal("100"),
            currency="USD",
        ),
        Transaction(
            portfolio_id=other_portfolio.id,
            asset_id=by_symbol["MSFT"].id,
            tx_date=date.today(),
            type=TransactionType.BUY,
            quantity=Decimal("2"),
            price=Decimal("100"),
            currency="USD",
        ),
    ])
    test_db.commit()

    service = AssetResearchService(test_db)
    payload = service._enrich_etf_composition(
        {
            "available": True,
            "holdings": [
                {"symbol": "NVDA", "name": "NVIDIA Corp", "weight": 0.08},
                {"symbol": "AAPL", "name": "Apple Inc", "weight": 0.07},
                {"symbol": "MSFT", "name": "Microsoft Corp", "weight": 0.05},
            ],
        },
        portfolio_id=portfolio.id,
        user_id=test_user.id,
    )

    overlap = payload["portfolio_overlap"]
    assert payload["portfolio_overlap_available"] is True
    assert overlap["overlap_weight"] == pytest.approx(0.07)
    assert overlap["overlapping_holdings_count"] == 1
    assert overlap["largest_overlapping_holding"]["symbol"] == "AAPL"
    assert [item["symbol"] for item in overlap["holdings"]] == ["AAPL"]


def test_etf_composition_endpoint_returns_payload(client, monkeypatch):
    monkeypatch.setattr(
        AssetResearchService,
        "get_etf_composition",
        lambda self, symbol, *args, **kwargs: {
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
