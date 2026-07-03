"""
Trade Republic logo provider.

Trade Republic hosts clean, versioned SVG logos for most listed instruments
keyed by ISIN. This is an unofficial, opportunistic source: there is no
documented API contract, and unavailable logos are not always signaled with a
normal HTTP error status. Instead, the CDN can return HTTP 200 with an XML
"AccessDenied" error document in the body. Validation here inspects the
response body, not just the status code, to avoid ever treating such a
response as a valid logo.
"""
import logging
from typing import Dict

import requests

from app.observability.metrics import TRADE_REPUBLIC_LOGO_VALIDATION

logger = logging.getLogger(__name__)

TRADE_REPUBLIC_LOGO_URL_TEMPLATE = "https://assets.traderepublic.com/img/logos/{isin}/v2/{variant}.min.svg"
TRADE_REPUBLIC_TIMEOUT_SECONDS = 5
TRADE_REPUBLIC_VARIANTS = ("light", "dark")

# Trade Republic is a public CDN and does not require browser-like headers
# (unlike Brandfetch's CDN_HEADERS), but a descriptive UA is still polite.
TRADE_REPUBLIC_HEADERS = {"User-Agent": "Portfolium-LogoResolver/1.0"}

_MIN_SVG_BYTES = 20
_MAX_SVG_BYTES = 2 * 1024 * 1024


def build_trade_republic_logo_url(isin: str, variant: str) -> str:
    """Build the Trade Republic CDN URL for a given ISIN and theme variant."""
    return TRADE_REPUBLIC_LOGO_URL_TEMPLATE.format(isin=isin, variant=variant)


def _first_tag_name(text: str) -> "str | None":
    """Return the lowercased name of the first real tag, skipping XML/comment preambles."""
    pos = 0
    length = len(text)
    while pos < length:
        idx = text.find("<", pos)
        if idx == -1:
            return None
        if text[idx:idx + 2] == "<?" or text[idx:idx + 4] == "<!--" or text[idx:idx + 2] == "<!":
            end = text.find(">", idx)
            if end == -1:
                return None
            pos = end + 1
            continue
        j = idx + 1
        while j < length and (text[j].isalnum() or text[j] in ":_-"):
            j += 1
        tag = text[idx + 1:j]
        return tag.split(":")[-1].lower() or None
    return None


def validate_trade_republic_logo_response(response: "requests.Response") -> bool:
    """
    Reject anything that isn't a genuine SVG image, including AccessDenied /
    error XML documents disguised as HTTP 200 responses.

    Rejects: non-2xx status, XML content-types without an svg body, bodies
    outside a sane size range, bodies whose root tag isn't <svg>, and bodies
    containing AccessDenied/Error markers (belt-and-suspenders even if tag
    sniffing were somehow fooled).

    Accepts: a 200 response whose body's first real tag is <svg>.
    """
    if response.status_code != 200:
        return False

    content_type = (response.headers.get("Content-Type") or "").lower()
    if "xml" in content_type and "svg" not in content_type:
        return False

    body = response.content or b""
    if len(body) < _MIN_SVG_BYTES or len(body) > _MAX_SVG_BYTES:
        return False

    text = body.decode("utf-8", errors="replace")
    lowered = text.lower()
    if "accessdenied" in lowered or "<error" in lowered:
        return False

    if _first_tag_name(text) != "svg":
        return False

    return True


def fetch_trade_republic_logos(isin: str) -> Dict[str, bytes]:
    """
    Fetch and validate light + dark Trade Republic logo variants for an ISIN.

    Returns a dict containing only the variants ("light"/"dark") that passed
    validation. Never raises: network errors and validation failures for a
    variant simply omit that variant from the result.
    """
    results: Dict[str, bytes] = {}

    for variant in TRADE_REPUBLIC_VARIANTS:
        url = build_trade_republic_logo_url(isin, variant)
        try:
            response = requests.get(
                url,
                headers=TRADE_REPUBLIC_HEADERS,
                timeout=TRADE_REPUBLIC_TIMEOUT_SECONDS,
            )
        except requests.RequestException as exc:
            TRADE_REPUBLIC_LOGO_VALIDATION.labels(variant=variant, result="request_failed").inc()
            logger.info(
                "Trade Republic logo request failed",
                extra={"provider": "trade_republic", "variant": variant, "event": "request_failed", "error": str(exc)},
            )
            continue

        if validate_trade_republic_logo_response(response):
            results[variant] = response.content
            TRADE_REPUBLIC_LOGO_VALIDATION.labels(variant=variant, result="valid").inc()
        else:
            TRADE_REPUBLIC_LOGO_VALIDATION.labels(variant=variant, result="invalid").inc()
            logger.info(
                "Trade Republic logo validation rejected",
                extra={
                    "provider": "trade_republic",
                    "variant": variant,
                    "event": "validation_rejected",
                    "status": response.status_code,
                    "content_type": response.headers.get("Content-Type"),
                },
            )

    return results
