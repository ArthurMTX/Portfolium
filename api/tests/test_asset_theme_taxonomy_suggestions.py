from datetime import datetime

from app.models import Asset, AssetThemeClassification, AssetThemeTaxonomySuggestion
from app.models.enums import AssetClass
from app.services.asset_themes import AssetThemeService, settings


def _asset(db, symbol="TEST", name="Test Co"):
    asset = Asset(symbol=symbol, name=name, currency="USD", class_=AssetClass.STOCK)
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def _gap(theme="Home Safety", confidence=0.86):
    return {
        "hasGap": True,
        "reason": "No existing theme covers residential monitoring services",
        "suggestedTheme": theme,
        "suggestedSubthemes": ["Remote Dispatch", "Security Response"],
        "confidence": confidence,
    }


def _admin_headers(client, db, user):
    user.is_admin = True
    db.commit()
    response = client.post(
        "/auth/login",
        data={"username": "test@example.com", "password": "testpassword123"},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_stores_valid_taxonomy_gap_suggestion(test_db):
    asset = _asset(test_db)
    service = AssetThemeService(test_db)

    suggestion = service._persist_taxonomy_gap_suggestion(
        asset=asset,
        summary_hash="hash-1",
        taxonomy_gap=_gap(),
        summary="Provides monitored security response services for residential customers.",
        sector="Industrials",
        industry="Security",
        company_name=asset.name,
        themes=[],
    )

    assert suggestion is not None
    assert suggestion.suggested_theme == "Home Safety"
    assert suggestion.suggested_subthemes == []
    assert suggestion.status == "pending"


def test_does_not_store_duplicate_suggestion(test_db):
    asset = _asset(test_db)
    service = AssetThemeService(test_db)

    for _ in range(2):
        service._persist_taxonomy_gap_suggestion(
            asset=asset,
            summary_hash="hash-1",
            taxonomy_gap=_gap(),
            summary="Provides monitored security response services.",
            sector=None,
            industry=None,
            company_name=asset.name,
            themes=[],
        )

    assert test_db.query(AssetThemeTaxonomySuggestion).count() == 1


def test_does_not_store_subtheme_gap_when_disabled(test_db):
    asset = _asset(test_db)
    service = AssetThemeService(test_db)

    suggestion = service._persist_taxonomy_gap_suggestion(
        asset=asset,
        summary_hash="hash-1",
        taxonomy_gap=_gap(theme="Physical Security"),
        summary="Provides monitored security response services.",
        sector=None,
        industry=None,
        company_name=asset.name,
        themes=[],
    )

    assert suggestion is None
    assert test_db.query(AssetThemeTaxonomySuggestion).count() == 0


def test_stores_subtheme_gap_when_enabled(test_db, monkeypatch):
    monkeypatch.setattr(settings, "ASSET_THEME_SUBTHEME_GAP_SUGGESTIONS_ENABLED", True)
    asset = _asset(test_db)
    service = AssetThemeService(test_db)

    suggestion = service._persist_taxonomy_gap_suggestion(
        asset=asset,
        summary_hash="hash-1",
        taxonomy_gap=_gap(theme="Physical Security"),
        summary="Provides monitored security response services.",
        sector=None,
        industry=None,
        company_name=asset.name,
        themes=[],
    )

    assert suggestion is not None
    assert suggestion.suggested_theme == "Physical Security"
    assert suggestion.suggested_subthemes == ["Remote Dispatch", "Security Response"]
    assert test_db.query(AssetThemeTaxonomySuggestion).count() == 1


def test_stores_low_confidence_gap_for_admin_review(test_db):
    asset = _asset(test_db)
    service = AssetThemeService(test_db)

    suggestion = service._persist_taxonomy_gap_suggestion(
        asset=asset,
        summary_hash="hash-1",
        taxonomy_gap=_gap(confidence=0.4),
        summary="Provides monitored security response services.",
        sector=None,
        industry=None,
        company_name=asset.name,
        themes=[],
    )

    assert suggestion is not None
    assert float(suggestion.confidence) == 0.4
    assert test_db.query(AssetThemeTaxonomySuggestion).count() == 1


def test_stores_gap_even_when_classification_is_strong(test_db):
    asset = _asset(test_db)
    service = AssetThemeService(test_db)
    themes = [{"label": "AI Infrastructure", "confidence": 0.9, "weight": 1.0, "tier": "primary"}]

    suggestion = service._persist_taxonomy_gap_suggestion(
        asset=asset,
        summary_hash="hash-1",
        taxonomy_gap=_gap(),
        summary="Provides monitored security response services.",
        sector=None,
        industry=None,
        company_name=asset.name,
        themes=themes,
    )

    assert suggestion is not None
    assert test_db.query(AssetThemeTaxonomySuggestion).count() == 1


def test_patch_taxonomy_suggestion_status(client, test_db, test_user):
    asset = _asset(test_db)
    suggestion = AssetThemeTaxonomySuggestion(
        asset_id=asset.id,
        symbol=asset.symbol,
        company_name=asset.name,
        summary_hash="hash-1",
        suggested_theme="Home Safety",
        suggested_subthemes=["Remote Dispatch"],
        reason="No existing theme covers residential monitoring services",
        confidence=0.86,
    )
    test_db.add(suggestion)
    test_db.commit()
    test_db.refresh(suggestion)

    response = client.patch(
        f"/assets/themes/taxonomy-suggestions/{suggestion.id}",
        headers=_admin_headers(client, test_db, test_user),
        json={"status": "accepted", "reviewer_note": "Add this later"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "accepted"
    assert payload["reviewer_note"] == "Add this later"
    assert payload["reviewed_at"] is not None


def test_classify_single_symbol(client, test_db, test_user, monkeypatch):
    asset = _asset(test_db, "HZO", "MarineMax")
    calls = []

    def fake_refresh(self, asset, summary, sector=None, industry=None, name=None, force=False):
        calls.append((asset.symbol, force))
        classification = AssetThemeClassification(
            asset_id=asset.id,
            themes=[{"label": "Marine Recreation", "confidence": 0.9, "weight": 1.0, "tier": "primary", "children": []}],
            method="gpt",
            model="test",
            source_hash="hash",
            generated_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        self.db.add(classification)
        self.db.commit()
        self.db.refresh(classification)
        self.last_taxonomy_gap = None
        return classification

    monkeypatch.setattr("app.routers.assets._fetch_theme_company_info", lambda asset: {"longBusinessSummary": "Boats"})
    monkeypatch.setattr(AssetThemeService, "refresh_classification", fake_refresh)

    response = client.post(
        "/assets/themes/classify",
        headers=_admin_headers(client, test_db, test_user),
        json={"symbols": [asset.symbol], "force": False, "missing_only": False},
    )

    assert response.status_code == 200
    assert response.json()["classified"] == 1
    assert calls == [("HZO", False)]


def test_classify_missing_symbol_creates_asset(client, test_db, test_user, monkeypatch):
    calls = []

    def fake_create(db, asset_create):
        asset = Asset(
            symbol=asset_create.symbol,
            name="GATX Corporation",
            currency=asset_create.currency,
            class_=AssetClass.STOCK,
            sector="Industrials",
            industry="Rental & Leasing Services",
            asset_type="EQUITY",
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        return asset

    def fake_refresh(self, asset, summary, sector=None, industry=None, name=None, force=False):
        calls.append((asset.symbol, asset.name, sector, industry, name))
        classification = AssetThemeClassification(
            asset_id=asset.id,
            themes=[{"label": "Industrial Automation", "confidence": 0.8, "weight": 1.0, "tier": "primary", "children": []}],
            method="gpt",
            model="test",
            source_hash="hash",
            generated_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        self.db.add(classification)
        self.db.commit()
        self.db.refresh(classification)
        self.last_taxonomy_gap = None
        return classification

    monkeypatch.setattr("app.routers.assets.crud.create_asset", fake_create)
    monkeypatch.setattr(
        "app.routers.assets._fetch_theme_company_info",
        lambda asset: {
            "longBusinessSummary": "Leases railcars and related transport equipment.",
            "sector": asset.sector,
            "industry": asset.industry,
            "longName": asset.name,
        },
    )
    monkeypatch.setattr(AssetThemeService, "refresh_classification", fake_refresh)

    response = client.post(
        "/assets/themes/classify",
        headers=_admin_headers(client, test_db, test_user),
        json={"symbols": ["GATX"], "force": False, "missing_only": False},
    )

    payload = response.json()
    created = test_db.query(Asset).filter(Asset.symbol == "GATX").first()
    assert response.status_code == 200
    assert payload["classified"] == 1
    assert payload["failed"] == 0
    assert created is not None
    assert calls == [("GATX", "GATX Corporation", "Industrials", "Rental & Leasing Services", "GATX Corporation")]


def test_classify_multiple_symbols_with_partial_failure(client, test_db, test_user, monkeypatch):
    _asset(test_db, "HZO", "MarineMax")
    _asset(test_db, "GAP", "Gap Candidate")

    def fake_refresh(self, asset, summary, sector=None, industry=None, name=None, force=False):
        themes = []
        if asset.symbol == "HZO":
            themes = [{"label": "Marine Recreation", "confidence": 0.9, "weight": 1.0, "tier": "primary", "children": []}]
            self.last_taxonomy_gap = None
        else:
            self.last_taxonomy_gap = _gap()
            self._persist_taxonomy_gap_suggestion(
                asset=asset,
                summary_hash="gap-hash",
                taxonomy_gap=self.last_taxonomy_gap,
                summary=summary,
                sector=sector,
                industry=industry,
                company_name=name,
                themes=themes,
            )
        classification = AssetThemeClassification(
            asset_id=asset.id,
            themes=themes,
            method="gpt",
            model="test",
            source_hash=f"hash-{asset.symbol}",
            generated_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        self.db.add(classification)
        self.db.commit()
        self.db.refresh(classification)
        return classification

    def fake_create(db, asset_create):
        raise RuntimeError("lookup failed")

    monkeypatch.setattr("app.routers.assets._fetch_theme_company_info", lambda asset: {"longBusinessSummary": "Summary"})
    monkeypatch.setattr("app.routers.assets.crud.create_asset", fake_create)
    monkeypatch.setattr(AssetThemeService, "refresh_classification", fake_refresh)

    response = client.post(
        "/assets/themes/classify",
        headers=_admin_headers(client, test_db, test_user),
        json={"symbols": ["HZO", "GAP", "FAIL"], "force": False, "missing_only": False},
    )

    payload = response.json()
    assert response.status_code == 200
    assert payload["classified"] == 2
    assert payload["failed"] == 1
    assert any(item["taxonomy_gap"] for item in payload["results"] if item["symbol"] == "GAP")
    assert test_db.query(AssetThemeTaxonomySuggestion).count() == 1


def test_missing_only_skips_existing_classification(client, test_db, test_user, monkeypatch):
    asset = _asset(test_db, "HZO", "MarineMax")
    test_db.add(
        AssetThemeClassification(
            asset_id=asset.id,
            themes=[{"label": "Marine Recreation", "confidence": 0.9, "weight": 1.0, "tier": "primary", "children": []}],
            method="gpt",
            model="test",
            source_hash="hash",
            generated_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
    )
    test_db.commit()

    def fail_refresh(*args, **kwargs):
        raise AssertionError("refresh should not be called")

    monkeypatch.setattr(AssetThemeService, "refresh_classification", fail_refresh)
    response = client.post(
        "/assets/themes/classify",
        headers=_admin_headers(client, test_db, test_user),
        json={"symbols": ["HZO"], "force": False, "missing_only": True},
    )

    assert response.status_code == 200
    assert response.json()["skipped"] == 1


def test_force_refresh_overrides_missing_only(client, test_db, test_user, monkeypatch):
    asset = _asset(test_db, "HZO", "MarineMax")
    test_db.add(
        AssetThemeClassification(
            asset_id=asset.id,
            themes=[{"label": "Marine Recreation", "confidence": 0.9, "weight": 1.0, "tier": "primary", "children": []}],
            method="gpt",
            model="test",
            source_hash="hash",
            generated_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
    )
    test_db.commit()
    calls = []

    def fake_refresh(self, asset, summary, sector=None, industry=None, name=None, force=False):
        calls.append(force)
        classification = self.get_classification(asset.id)
        self.last_taxonomy_gap = None
        return classification

    monkeypatch.setattr("app.routers.assets._fetch_theme_company_info", lambda asset: {"longBusinessSummary": "Boats"})
    monkeypatch.setattr(AssetThemeService, "refresh_classification", fake_refresh)

    response = client.post(
        "/assets/themes/classify",
        headers=_admin_headers(client, test_db, test_user),
        json={"symbols": ["HZO"], "force": True, "missing_only": True},
    )

    assert response.status_code == 200
    assert response.json()["classified"] == 1
    assert calls == [True]
