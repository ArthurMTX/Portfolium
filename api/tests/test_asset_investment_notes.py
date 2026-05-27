from app.auth import get_password_hash
from app.models import User


def test_create_and_get_asset_investment_note(client, auth_headers, sample_asset):
    payload = {
        "thesis": "Durable ecosystem and services growth.",
        "conviction": "high",
        "risks": "Multiple compression and slower iPhone cycle.",
        "target_price": "250.00",
        "target_text": "Reassess near analyst target range.",
        "invalidation_thesis": "Services growth turns negative.",
        "horizon": "long",
        "horizon_date": "2030-01-01",
    }

    put_response = client.put(
        f"/assets/{sample_asset.id}/investment-note",
        json=payload,
        headers=auth_headers,
    )

    assert put_response.status_code == 200
    created = put_response.json()
    assert created["asset_id"] == sample_asset.id
    assert created["thesis"] == payload["thesis"]
    assert created["conviction"] == "high"
    assert created["horizon"] == "long"

    get_response = client.get(f"/assets/{sample_asset.id}/investment-note", headers=auth_headers)
    assert get_response.status_code == 200
    assert get_response.json()["id"] == created["id"]


def test_update_asset_investment_note_replaces_fields(client, auth_headers, sample_asset):
    client.put(
        f"/assets/{sample_asset.id}/investment-note",
        json={"thesis": "Initial thesis", "conviction": "medium", "risks": "Initial risk"},
        headers=auth_headers,
    )

    response = client.put(
        f"/assets/{sample_asset.id}/investment-note",
        json={"thesis": "Updated thesis", "conviction": "low", "horizon": "short"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["thesis"] == "Updated thesis"
    assert data["conviction"] == "low"
    assert data["risks"] is None
    assert data["horizon"] == "short"


def test_delete_asset_investment_note(client, auth_headers, sample_asset):
    client.put(
        f"/assets/{sample_asset.id}/investment-note",
        json={"thesis": "Temporary thesis"},
        headers=auth_headers,
    )

    delete_response = client.delete(
        f"/assets/{sample_asset.id}/investment-note",
        headers=auth_headers,
    )
    assert delete_response.status_code == 204

    get_response = client.get(f"/assets/{sample_asset.id}/investment-note", headers=auth_headers)
    assert get_response.status_code == 200
    assert get_response.json() is None


def test_asset_investment_note_is_user_scoped(client, auth_headers, test_db, sample_asset):
    client.put(
        f"/assets/{sample_asset.id}/investment-note",
        json={"thesis": "First user's thesis"},
        headers=auth_headers,
    )

    other_user = User(
        username="otheruser",
        email="other@example.com",
        hashed_password=get_password_hash("testpassword123"),
        is_active=True,
    )
    test_db.add(other_user)
    test_db.commit()

    login_response = client.post(
        "/auth/login",
        data={"username": "other@example.com", "password": "testpassword123"},
    )
    other_headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

    get_response = client.get(f"/assets/{sample_asset.id}/investment-note", headers=other_headers)
    assert get_response.status_code == 200
    assert get_response.json() is None

    other_put = client.put(
        f"/assets/{sample_asset.id}/investment-note",
        json={"thesis": "Second user's thesis"},
        headers=other_headers,
    )
    assert other_put.status_code == 200

    first_get = client.get(f"/assets/{sample_asset.id}/investment-note", headers=auth_headers)
    assert first_get.json()["thesis"] == "First user's thesis"


def test_asset_investment_note_missing_asset_returns_404(client, auth_headers):
    response = client.put(
        "/assets/999999/investment-note",
        json={"thesis": "No asset"},
        headers=auth_headers,
    )

    assert response.status_code == 404
