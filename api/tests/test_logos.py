from app.config import settings
from app.services.market_data import logos


class FakeResponse:
    def __init__(self, status_code=200, content=b"image-bytes", content_type="image/png"):
        self.status_code = status_code
        self.content = content
        self.headers = {"Content-Type": content_type}


def test_crypto_logo_uses_brandfetch_crypto_namespace(monkeypatch):
    calls = []

    monkeypatch.setattr(settings, "BRANDFETCH_API_KEY", "test-client-id")
    monkeypatch.setattr(logos, "is_valid_image", lambda image_data: True)
    monkeypatch.setattr(logos, "resize_and_optimize_image", lambda image_data: b"optimized")

    def fake_get(url, params=None, headers=None, timeout=None):
        calls.append((url, params))
        return FakeResponse()

    monkeypatch.setattr(logos.requests, "get", fake_get)

    result = logos.fetch_logo_with_validation("BTC-USD", asset_type="CRYPTOCURRENCY")

    assert result == b"optimized"
    assert calls == [("https://cdn.brandfetch.io/crypto/BTC", {"c": "test-client-id"})]


def test_crypto_logo_falls_back_to_generated_when_brandfetch_crypto_misses(monkeypatch):
    monkeypatch.setattr(settings, "BRANDFETCH_API_KEY", "test-client-id")

    def fake_get(url, params=None, headers=None, timeout=None):
        return FakeResponse(status_code=404, content=b"", content_type="text/plain")

    monkeypatch.setattr(logos.requests, "get", fake_get)

    result = logos.fetch_logo_with_validation("BTC", asset_type="CRYPTOCURRENCY")

    assert result.startswith(b"<svg")
