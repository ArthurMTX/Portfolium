import requests

from app.services.market_data import trade_republic_logos as tr_logos

ISIN = "US0378331005"

VALID_SVG = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle r="1"/></svg>'
ACCESS_DENIED_XML = (
    b'<?xml version="1.0" encoding="UTF-8"?>\n'
    b"<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>"
)


class FakeResponse:
    def __init__(self, status_code=200, content=b"", content_type="image/svg+xml"):
        self.status_code = status_code
        self.content = content
        self.headers = {"Content-Type": content_type}


def test_validate_accepts_valid_svg():
    response = FakeResponse(200, VALID_SVG, "image/svg+xml")
    assert tr_logos.validate_trade_republic_logo_response(response) is True


def test_validate_rejects_404():
    response = FakeResponse(404, b"not found", "text/plain")
    assert tr_logos.validate_trade_republic_logo_response(response) is False


def test_validate_rejects_403():
    response = FakeResponse(403, ACCESS_DENIED_XML, "application/xml")
    assert tr_logos.validate_trade_republic_logo_response(response) is False


def test_validate_rejects_access_denied_xml_at_200():
    response = FakeResponse(200, ACCESS_DENIED_XML, "application/xml")
    assert tr_logos.validate_trade_republic_logo_response(response) is False


def test_validate_rejects_access_denied_xml_at_403():
    response = FakeResponse(403, ACCESS_DENIED_XML, "application/xml")
    assert tr_logos.validate_trade_republic_logo_response(response) is False


def test_validate_rejects_generic_xml_content_type_even_with_svg_like_body():
    # content-type/tag mismatch guard: application/xml is rejected outright
    # even if the body happens to start with <svg, as defense-in-depth.
    response = FakeResponse(200, VALID_SVG, "application/xml")
    assert tr_logos.validate_trade_republic_logo_response(response) is False


def test_validate_rejects_garbage_body():
    response = FakeResponse(200, b"not an svg document at all, just text padding", "text/plain")
    assert tr_logos.validate_trade_republic_logo_response(response) is False


def test_validate_rejects_body_too_small():
    response = FakeResponse(200, b"<svg/>", "image/svg+xml")
    assert tr_logos.validate_trade_republic_logo_response(response) is False


def test_validate_rejects_body_too_large():
    huge = b'<svg xmlns="http://www.w3.org/2000/svg">' + b"a" * (3 * 1024 * 1024) + b"</svg>"
    response = FakeResponse(200, huge, "image/svg+xml")
    assert tr_logos.validate_trade_republic_logo_response(response) is False


def test_fetch_both_variants_valid(monkeypatch):
    def fake_get(url, headers=None, timeout=None):
        return FakeResponse(200, VALID_SVG, "image/svg+xml")

    monkeypatch.setattr(tr_logos.requests, "get", fake_get)
    result = tr_logos.fetch_trade_republic_logos(ISIN)
    assert result == {"light": VALID_SVG, "dark": VALID_SVG}


def test_fetch_light_only_valid_dark_404(monkeypatch):
    def fake_get(url, headers=None, timeout=None):
        if "light" in url:
            return FakeResponse(200, VALID_SVG, "image/svg+xml")
        return FakeResponse(404, b"", "text/plain")

    monkeypatch.setattr(tr_logos.requests, "get", fake_get)
    result = tr_logos.fetch_trade_republic_logos(ISIN)
    assert result == {"light": VALID_SVG}


def test_fetch_dark_only_valid_light_access_denied(monkeypatch):
    def fake_get(url, headers=None, timeout=None):
        if "dark" in url:
            return FakeResponse(200, VALID_SVG, "image/svg+xml")
        return FakeResponse(200, ACCESS_DENIED_XML, "application/xml")

    monkeypatch.setattr(tr_logos.requests, "get", fake_get)
    result = tr_logos.fetch_trade_republic_logos(ISIN)
    assert result == {"dark": VALID_SVG}


def test_fetch_both_404_returns_empty_dict(monkeypatch):
    def fake_get(url, headers=None, timeout=None):
        return FakeResponse(404, b"", "text/plain")

    monkeypatch.setattr(tr_logos.requests, "get", fake_get)
    result = tr_logos.fetch_trade_republic_logos(ISIN)
    assert result == {}


def test_fetch_swallows_request_exception(monkeypatch):
    def fake_get(url, headers=None, timeout=None):
        raise requests.ConnectionError("boom")

    monkeypatch.setattr(tr_logos.requests, "get", fake_get)
    result = tr_logos.fetch_trade_republic_logos(ISIN)
    assert result == {}


def test_fetch_trade_republic_logo_url_returns_valid_svg(monkeypatch):
    url = tr_logos.build_trade_republic_logo_url(ISIN, "light")

    def fake_get(request_url, headers=None, timeout=None):
        assert request_url == url
        return FakeResponse(200, VALID_SVG, "image/svg+xml")

    monkeypatch.setattr(tr_logos.requests, "get", fake_get)

    assert tr_logos.fetch_trade_republic_logo_url(url) == VALID_SVG


def test_fetch_trade_republic_logo_url_rejects_unexpected_host(monkeypatch):
    def fail_get(*_args, **_kwargs):
        raise AssertionError("Unexpected URLs should not be fetched")

    monkeypatch.setattr(tr_logos.requests, "get", fail_get)

    assert tr_logos.fetch_trade_republic_logo_url("https://example.com/logo.svg") is None


def test_build_trade_republic_logo_url():
    assert tr_logos.build_trade_republic_logo_url(ISIN, "light") == (
        f"https://assets.traderepublic.com/img/logos/{ISIN}/v2/light.min.svg"
    )
    assert tr_logos.build_trade_republic_logo_url(ISIN, "dark") == (
        f"https://assets.traderepublic.com/img/logos/{ISIN}/v2/dark.min.svg"
    )
