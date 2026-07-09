import hashlib
import io

import requests
from PIL import Image, ImageDraw

from app.config import settings
from app.services.market_data import logos


class FakeResponse:
    def __init__(self, status_code=200, content=b"image-bytes", content_type="image/png", json_data=None):
        self.status_code = status_code
        self.content = content
        self.headers = {"Content-Type": content_type}
        self._json_data = json_data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"HTTP {self.status_code}")

    def json(self):
        return self._json_data


def _fake_placeholder_png() -> bytes:
    """Build a small, well-formed, non-solid, non-transparent PNG to stand
    in for Brandfetch's real generic "B" placeholder image (returned with
    HTTP 200 for unmatched brand IDs/tickers such as DIANATEA.BO or PLBL)."""
    img = Image.new("RGBA", (32, 32), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.ellipse((4, 4, 28, 28), fill=(20, 20, 20, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _flat_color_silhouette_png() -> bytes:
    """Build a single-flat-color RGBA image whose shape lives entirely in
    the alpha channel, mimicking real logos like Ethereum's solid-black
    diamond on a transparent background (RGB is uniformly (0,0,0), only
    alpha varies). Large enough and detailed enough that PNG compression
    keeps it above MIN_VALID_IMAGE_SIZE, like a real fetched logo would be."""
    size = 128
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.polygon(
        [(size // 2, 4), (size - 8, size // 2), (size // 2, size - 4), (8, size // 2)],
        fill=(0, 0, 0, 255),
    )
    draw.polygon(
        [(8, size // 2 + 10), (size // 2, size - 4), (size - 8, size // 2 + 10), (size // 2, size - 20)],
        fill=(0, 0, 0, 180),
    )
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


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


def test_placeholder_image_is_rejected_by_is_valid_image(monkeypatch):
    """Brandfetch returns HTTP 200 with a generic placeholder image (not a
    404) for unmatched brand IDs/tickers like PLBL or DIANATEA.BO. Without
    the hash check, is_valid_image would treat this well-formed, non-blank
    PNG as a real logo."""
    placeholder_bytes = _fake_placeholder_png()
    placeholder_hash = hashlib.sha256(placeholder_bytes).hexdigest()
    monkeypatch.setattr(logos, "BRANDFETCH_PLACEHOLDER_HASHES", {placeholder_hash})

    assert logos.is_valid_image(placeholder_bytes) is False


def test_flat_color_silhouette_logo_is_accepted(monkeypatch):
    """Regression test for ETH: is_valid_image previously flattened alpha
    via img.convert('RGB') before the solid-color check, so a legitimate
    single-flat-color silhouette logo (RGB uniformly black, shape carried
    entirely by the alpha channel -- e.g. Ethereum's diamond) was wrongly
    rejected as "solid color (likely empty)"."""
    monkeypatch.setattr(logos, "BRANDFETCH_PLACEHOLDER_HASHES", set())

    assert logos.is_valid_image(_flat_color_silhouette_png()) is True


def test_fully_opaque_solid_color_image_is_still_rejected(monkeypatch):
    """Guards against over-correcting the ETH fix: an image with no real
    alpha shape (uniformly opaque, single flat color) must still be
    rejected as blank/empty."""
    monkeypatch.setattr(logos, "BRANDFETCH_PLACEHOLDER_HASHES", set())

    img = Image.new("RGBA", (32, 32), (255, 0, 0, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")

    assert logos.is_valid_image(buf.getvalue()) is False


def test_ticker_with_only_placeholder_available_falls_back_to_svg(monkeypatch):
    """Regression test for PLBL/DIANATEA.BO: every Brandfetch strategy only
    ever returns the generic placeholder image, and logo.dev is not
    configured, so fetch_logo_with_validation must fall through to the
    generated SVG instead of returning the placeholder as if it were a real
    logo."""
    monkeypatch.setattr(settings, "BRANDFETCH_API_KEY", "test-client-id")
    monkeypatch.setattr(settings, "LOGO_DEV_API_KEY", "")

    placeholder_bytes = _fake_placeholder_png()
    placeholder_hash = hashlib.sha256(placeholder_bytes).hexdigest()
    monkeypatch.setattr(logos, "BRANDFETCH_PLACEHOLDER_HASHES", {placeholder_hash})

    requested_urls = []

    def fake_get(url, params=None, headers=None, timeout=None):
        requested_urls.append(url)
        if url.startswith("https://cdn.brandfetch.io/"):
            # Direct CDN fetch (by ticker or by searched brand ID) always
            # returns Brandfetch's generic placeholder for this ticker.
            return FakeResponse(content=placeholder_bytes)
        if url.startswith("https://api.brandfetch.io/v2/search/"):
            # No brand match found via search either.
            return FakeResponse(content_type="application/json", json_data=[])
        raise AssertionError(f"Unexpected URL requested: {url}")

    monkeypatch.setattr(logos.requests, "get", fake_get)

    result = logos.fetch_logo_with_validation("PLBL")

    assert result.startswith(b"<svg")
    # Confirm the direct CDN fetch by raw ticker was actually attempted.
    assert "https://cdn.brandfetch.io/PLBL" in requested_urls


def test_vpg_falls_back_to_logo_dev_after_brandfetch_ticker_search_removed(monkeypatch):
    """Regression test for VPG: Brandfetch's ticker search previously
    matched "Vertical Playground" (domain vpg.no) as the best result for
    ticker VPG, attaching an unrelated company's real logo. That search is
    no longer used; when the direct CDN fetch misses and no company name is
    given, fetch_logo_with_validation should go straight to logo.dev."""
    monkeypatch.setattr(settings, "BRANDFETCH_API_KEY", "test-client-id")
    monkeypatch.setattr(settings, "LOGO_DEV_API_KEY", "test-logo-dev-token")
    monkeypatch.setattr(logos, "is_valid_image", lambda image_data: True)
    monkeypatch.setattr(logos, "resize_and_optimize_image", lambda image_data: b"optimized-vpg-logo")

    requested_urls = []

    def fake_get(url, params=None, headers=None, timeout=None):
        requested_urls.append(url)
        if url == "https://cdn.brandfetch.io/VPG":
            return FakeResponse(status_code=404, content=b"", content_type="text/plain")
        if url == "https://img.logo.dev/ticker/VPG":
            assert params.get("fallback") == "404"
            return FakeResponse(content=b"real-vpg-logo-bytes")
        raise AssertionError(f"Unexpected URL requested: {url}")

    monkeypatch.setattr(logos.requests, "get", fake_get)

    result = logos.fetch_logo_with_validation("VPG")

    assert result == b"optimized-vpg-logo"
    assert "https://api.brandfetch.io/v2/search/VPG" not in requested_urls
    assert "https://img.logo.dev/ticker/VPG" in requested_urls


def test_logo_dev_unmatched_ticker_returns_none(monkeypatch):
    """logo.dev returns HTTP 404 with a JSON error body (not a placeholder
    image) for unmatched tickers when fallback=404 is set."""
    monkeypatch.setattr(settings, "LOGO_DEV_API_KEY", "test-logo-dev-token")

    def fake_get(url, params=None, headers=None, timeout=None):
        return FakeResponse(status_code=404, content=b'{"err":"not found"}', content_type="application/json")

    monkeypatch.setattr(logos.requests, "get", fake_get)

    assert logos.fetch_logo_from_logo_dev("ZZZQQQNOPE") is None


def test_ticker_search_rejects_unrelated_company_matches():
    """Regression test for PLBL: Brandfetch's search endpoint returns
    unrelated companies whose domain merely contains the ticker as a
    substring (plbltd.com, plblending.com, plblaw.com, plblw.com for
    ticker "PLBL"). None of these should be picked as the logo."""
    plbl_search_results = [
        {"brandId": "idBd0JWgXQ", "claimed": False, "domain": "plbltd.com",
         "name": "PLB Projects Ltd", "qualityScore": 0.5384615384615384},
        {"brandId": "id3xEWn4bS", "claimed": False, "domain": "plblending.com",
         "name": "Plb Lending Llc", "qualityScore": 0.4487179487179487},
        {"brandId": "idWB0wQS_T", "claimed": False, "domain": "plblaw.com",
         "name": "Law Offices", "qualityScore": 0.4258185776084905},
        {"brandId": "idKiycQDTh", "claimed": False, "domain": "plblw.com",
         "name": None, "qualityScore": 0.3832513073512884, "verified": False},
    ]

    assert logos.pick_best_brand(plbl_search_results, identifier="PLBL") is None


def test_pick_best_brand_still_matches_real_companies():
    apple_result = {"name": "Apple", "domain": "apple.com", "brandId": "apple-id",
                     "qualityScore": 0.95, "verified": True}

    best = logos.pick_best_brand([apple_result], identifier="Apple")

    assert best is not None
    assert best["brandId"] == "apple-id"
