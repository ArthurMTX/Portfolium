import pytest

from app.models import AssetThemeClassification, Watchlist
from app.routers.watchlist import get_watchlist


class FakePricingService:
    async def get_multiple_prices(self, _symbols):
        return {}


@pytest.mark.asyncio
async def test_watchlist_includes_asset_themes(test_db, test_user, sample_asset):
    classification = AssetThemeClassification(
        asset_id=sample_asset.id,
        themes=[
            {
                "label": "AI Infrastructure",
                "confidence": 0.91,
                "weight": 1.0,
                "evidence": ["Builds accelerated computing platforms"],
                "tier": "primary",
                "children": [
                    {
                        "label": "GPU Computing",
                        "confidence": 0.86,
                        "evidence": ["Datacenter GPU demand"],
                    }
                ],
            }
        ],
        method="gpt",
        model="test-model",
    )
    item = Watchlist(
        user_id=test_user.id,
        asset_id=sample_asset.id,
    )
    test_db.add_all([classification, item])
    test_db.commit()

    data = await get_watchlist(
        pricing_service=FakePricingService(),
        db=test_db,
        current_user=test_user,
    )

    assert len(data) == 1
    assert data[0].symbol == sample_asset.symbol
    assert data[0].themes[0].label == "AI Infrastructure"
    assert data[0].themes[0].children[0].label == "GPU Computing"
