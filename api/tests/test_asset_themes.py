from datetime import datetime
from types import SimpleNamespace
from unittest.mock import Mock

from sqlalchemy.exc import IntegrityError

from app.models import AssetThemeClassification
from app.services.asset_themes import AssetThemeService, GEMINI_THEME_MODEL


def test_refresh_gemini_classification_recovers_from_duplicate_insert(
    monkeypatch,
):
    asset = SimpleNamespace(
        id=41,
        symbol="PLTR",
        name="Palantir Technologies",
        sector="Technology",
        industry="Software",
    )

    existing = AssetThemeClassification(
        asset_id=asset.id,
        themes=[],
        method="gpt",
        model=GEMINI_THEME_MODEL,
        source_hash="stale-hash",
        generated_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db = Mock()
    db.commit.side_effect = [
        IntegrityError("INSERT", {}, Exception("duplicate key")),
        None,
    ]

    service = AssetThemeService(db)
    get_classification = Mock(side_effect=[None, existing])
    monkeypatch.setattr(service, "get_classification", get_classification)
    monkeypatch.setattr(
        service,
        "generate_themes",
        lambda name, sector, industry, summary: [
            {
                "label": "AI Infrastructure",
                "confidence": 0.91,
                "evidence": [],
                "tier": "primary",
            }
        ],
    )

    classification = service.refresh_gemini_classification(
        asset=asset,
        summary="Updated business summary",
        sector=asset.sector,
        industry=asset.industry,
        name=asset.name,
        force=True,
    )

    assert classification.id == existing.id
    assert classification.asset_id == asset.id
    assert classification.themes[0]["label"] == "AI Infrastructure"
    assert classification.source_hash != "stale-hash"
    assert db.commit.call_count == 2
    db.rollback.assert_called_once()
    db.refresh.assert_called_once_with(existing)
    assert get_classification.call_count == 2