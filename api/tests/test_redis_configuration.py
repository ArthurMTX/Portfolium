"""Redis authentication configuration and URL construction contracts."""

import logging

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.redis_client import RedisManager


BASE_SETTINGS = {
    "SECRET_KEY": "test-only-secret-key-0123456789abcdef0123456789",
    "ADMIN_AUTO_CREATE": False,
    "ENABLE_EMAIL": False,
    "REDIS_ENABLED": True,
}


def test_development_redis_may_be_explicitly_unauthenticated():
    settings = Settings(**BASE_SETTINGS, ENVIRONMENT="development", REDIS_PASSWORD="")
    assert settings.redis_url == "redis://redis:6379/0"
    assert settings.celery_broker_url == settings.redis_url
    assert settings.celery_result_backend == settings.redis_url


def test_redis_password_is_percent_encoded_in_all_generated_urls():
    settings = Settings(
        **BASE_SETTINGS,
        ENVIRONMENT="production",
        REDIS_PASSWORD="long p@ss:/?#[]word",
    )
    expected = "redis://:long%20p%40ss%3A%2F%3F%23%5B%5Dword@redis:6379/0"
    assert settings.redis_url == expected
    assert settings.celery_broker_url == expected
    assert settings.celery_result_backend == expected


def test_explicit_celery_urls_override_generated_urls_only_for_celery():
    settings = Settings(
        **BASE_SETTINGS,
        ENVIRONMENT="development",
        REDIS_PASSWORD="cache-password",
        CELERY_BROKER_URL="redis://broker:6379/1",
        CELERY_RESULT_BACKEND="redis://results:6379/2",
    )
    assert settings.redis_url == "redis://:cache-password@redis:6379/0"
    assert settings.celery_broker_url == "redis://broker:6379/1"
    assert settings.celery_result_backend == "redis://results:6379/2"


def test_production_rejects_missing_or_example_redis_password():
    for password in ("", "change-this-redis-password"):
        with pytest.raises(ValidationError, match="REDIS_PASSWORD"):
            Settings(**BASE_SETTINGS, ENVIRONMENT="production", REDIS_PASSWORD=password)


def test_redis_connection_failure_log_never_contains_password(monkeypatch, caplog):
    from app import redis_client

    secret = "never-log-this-p@ssword"
    monkeypatch.setattr(redis_client.settings, "REDIS_PASSWORD", secret)
    monkeypatch.setattr(redis_client.settings, "REDIS_HOST", "127.0.0.1")
    monkeypatch.setattr(redis_client.settings, "REDIS_PORT", 1)
    monkeypatch.setattr(redis_client.settings, "REDIS_SOCKET_CONNECT_TIMEOUT", 0.01)
    with caplog.at_level(logging.WARNING):
        RedisManager()
    assert secret not in caplog.text
