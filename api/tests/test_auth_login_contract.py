"""Authentication contract for /auth/login and protected endpoints.

When ENABLE_EMAIL is true, /auth/login requires a verified user, and the old
auth_headers fixture silently returned empty headers when that login failed,
turning one configuration problem into dozens of unrelated 401 assertions.
"""
from datetime import datetime, timedelta, timezone

from jose import jwt

from app.auth import get_password_hash, create_access_token
from app.config import settings
from app.models import User


def _make_user(test_db, *, email, is_active=True, is_verified=True):
    user = User(
        username=email.split("@")[0],
        email=email,
        hashed_password=get_password_hash("testpassword123"),
        is_active=is_active,
        is_verified=is_verified,
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


def _login(client, email, password="testpassword123"):
    return client.post("/auth/login", data={"username": email, "password": password})


def test_login_succeeds_and_token_authenticates(client, auth_headers):
    response = client.get("/auth/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"


def test_fixture_token_uses_app_jwt_config(client, auth_headers):
    token = auth_headers["Authorization"].removeprefix("Bearer ")
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["email"] == "test@example.com"
    expires_in = datetime.fromtimestamp(payload["exp"], tz=timezone.utc) - datetime.now(timezone.utc)
    expected = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    assert expected - timedelta(minutes=1) < expires_in <= expected


def test_login_wrong_password_is_401(client, test_user):
    response = _login(client, "test@example.com", password="wrong-password")
    assert response.status_code == 401


def test_login_unknown_email_is_401(client, test_db):
    assert _login(client, "nobody@example.com").status_code == 401


def test_login_inactive_user_is_403(client, test_db):
    _make_user(test_db, email="inactive@example.com", is_active=False)
    assert _login(client, "inactive@example.com").status_code == 403


def test_login_unverified_user_rejected_only_when_email_enabled(client, test_db, monkeypatch):
    _make_user(test_db, email="unverified@example.com", is_verified=False)

    monkeypatch.setattr(settings, "ENABLE_EMAIL", False)
    assert _login(client, "unverified@example.com").status_code == 200

    monkeypatch.setattr(settings, "ENABLE_EMAIL", True)
    assert _login(client, "unverified@example.com").status_code == 403


def test_protected_endpoint_without_token_is_401(client):
    assert client.get("/portfolios").status_code == 401


def test_protected_endpoint_with_garbage_token_is_401(client):
    response = client.get("/portfolios", headers={"Authorization": "Bearer not-a-jwt"})
    assert response.status_code == 401


def test_token_signed_with_wrong_secret_is_401(client, test_user):
    forged = jwt.encode(
        {"user_id": test_user.id, "email": test_user.email, "is_admin": False},
        "wrong-secret-key-0123456789-0123456789-0123456789",
        algorithm=settings.ALGORITHM,
    )
    response = client.get("/portfolios", headers={"Authorization": f"Bearer {forged}"})
    assert response.status_code == 401


def test_expired_token_is_401(client, test_user):
    expired = create_access_token(
        data={"user_id": test_user.id, "email": test_user.email, "is_admin": False},
        expires_delta=timedelta(minutes=-5),
    )
    response = client.get("/portfolios", headers={"Authorization": f"Bearer {expired}"})
    assert response.status_code == 401


def test_password_change_invalidates_existing_token(client, auth_headers):
    changed = client.post(
        "/auth/change-password",
        headers=auth_headers,
        json={
            "current_password": "testpassword123",
            "new_password": "replacement-password-456",
        },
    )
    assert changed.status_code == 200
    assert client.get("/auth/me", headers=auth_headers).status_code == 401
