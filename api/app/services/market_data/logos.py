"""
Logo fetching service using Brandfetch API
"""
import hashlib
import io
import logging
import re
from typing import Optional, List, Dict, Any, Iterator
from urllib.parse import quote
import requests
from PIL import Image

from app.config import settings

logger = logging.getLogger(__name__)

# Brandfetch API configuration
BRANDFETCH_SEARCH_URL = "https://api.brandfetch.io/v2/search/{identifier}"
BRANDFETCH_CDN_URL = "https://cdn.brandfetch.io/{brand_id}"
BRANDFETCH_CRYPTO_CDN_URL = "https://cdn.brandfetch.io/crypto/{ticker}"

# logo.dev API configuration (ticker-based lookup, used as a fallback when
# Brandfetch's direct/company-name lookups fail). Brandfetch's own ticker
# search does loose substring matching and can attach an unrelated
# company's real logo to an obscure ticker (e.g. VPG matching "Vertical
# Playground" via the vpg.no domain), so it isn't used for ticker search.
LOGO_DEV_TICKER_URL = "https://img.logo.dev/ticker/{ticker}"

# Request headers for CDN requests (Brandfetch requires browser-like User-Agent)
CDN_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

# Minimum size in bytes for a valid PNG (empty PNGs are typically very small)
MIN_VALID_IMAGE_SIZE = 200  # bytes

# Minimum dimensions for a valid logo
MIN_VALID_WIDTH = 16
MIN_VALID_HEIGHT = 16

# SHA-256 hashes of Brandfetch's generic "B" placeholder image, returned for
# unmatched brand IDs/tickers instead of a 404. Confirmed identical bytes for
# e.g. DIANATEA.BO and PLBL. Reject any fetch that matches one of these.
BRANDFETCH_PLACEHOLDER_HASHES = {
    "95834f990aa9ee7de720095f1b578f67816b53903131b6404aadf526f36cfe8f",
}


def _candidate_names(company_name: str) -> Iterator[str]:
    """
    Generate candidate search names from a company name.
    
    Examples:
        "Apple Inc." -> ["Apple Inc.", "Apple"]
        "Microsoft Corporation" -> ["Microsoft Corporation", "Microsoft"]
        "Eli Lilly and Company" -> ["Eli Lilly and Company", "Eli Lilly"]
    
    Args:
        company_name: Full company name
        
    Yields:
        Candidate search strings in order of preference
    """
    # Yield original name first
    yield company_name
    
    # Common suffixes to remove
    suffixes = [
        " Inc.",
        " Inc",
        " Corporation",
        " Corp.",
        " Corp",
        " Ltd.",
        " Ltd",
        " Limited",
        " LLC",
        " L.L.C.",
        " PLC",
        " P.L.C.",
        " AG",
        " S.A.",
        " S.A",
        " N.V.",
        " NV",
        " GmbH",
        " Co.",
        " and Company",
        " & Co.",
        # Nordics and others
        " ASA",
        " A.S.A.",
        " AS",
        " Ab",
        " AB",
        " Oyj",
        # Southern Europe variations
        " S.p.A.",
        " SpA",
        " SA",
        " SE",
    ]
    
    # Try removing each suffix
    for suffix in suffixes:
        if company_name.endswith(suffix):
            base_name = company_name[:-len(suffix)].strip()
            if base_name:  # Only yield if not empty
                yield base_name
            break  # Only remove one suffix


def _normalize_ticker_for_search(ticker: str) -> str:
    """Normalize exchange-suffixed tickers for Brandfetch search.

    Examples:
        "CAVENO.OL" -> "CAVENO"
        "BRK-B" -> "BRK-B" (keep hyphenated core)
        "RIO.L" -> "RIO"
    """
    if not ticker:
        return ticker
    # Strip exchange suffix after a dot (e.g., .OL, .L, .TO, .SA, .HK, .F, etc.)
    core = ticker.split('.')[0]
    return core


def _normalize_crypto_ticker_for_cdn(ticker: str) -> str:
    """Normalize crypto pairs for Brandfetch's crypto CDN path.

    Examples:
        "BTC-USD" -> "BTC"
        "eth-usdt" -> "ETH"
    """
    if not ticker:
        return ticker
    core = re.sub(r"[-/](USD|EUR|GBP|USDT|BUSD|JPY|CAD|AUD|CHF|CNY)$", "", ticker, flags=re.IGNORECASE)
    return core.upper()


def is_valid_image(image_data: bytes) -> bool:
    """
    Check if the image data represents a valid, non-empty logo image.
    
    This detects:
    - Empty or very small PNG files
    - Images with dimensions too small to be useful
    - Corrupted image data
    
    Args:
        image_data: Raw image bytes
        
    Returns:
        True if the image is valid and usable, False otherwise
    """
    # Check minimum size
    if len(image_data) < MIN_VALID_IMAGE_SIZE:
        logger.debug(f"Image too small: {len(image_data)} bytes")
        return False

    # Reject Brandfetch's generic "B" placeholder, served for unmatched
    # brand IDs/tickers instead of a 404 (e.g. DIANATEA.BO, PLBL)
    if hashlib.sha256(image_data).hexdigest() in BRANDFETCH_PLACEHOLDER_HASHES:
        logger.debug("Image is Brandfetch's generic placeholder logo")
        return False

    try:
        # Try to open and validate the image
        img = Image.open(io.BytesIO(image_data))

        # Check dimensions
        width, height = img.size
        if width < MIN_VALID_WIDTH or height < MIN_VALID_HEIGHT:
            logger.debug(f"Image dimensions too small: {width}x{height}")
            return False

        # If the image has an alpha channel, ensure it's not fully or almost fully transparent
        # and check whether the alpha channel itself carries shape (e.g. a flat-color
        # silhouette logo like Ethereum's solid-black diamond on a transparent background).
        alpha_has_shape = False
        try:
            img_rgba = img.convert('RGBA')
            alpha = img_rgba.getchannel('A')
            # Fast path: bounding box of non-zero alpha
            bbox = alpha.getbbox()
            if bbox is None:
                logger.debug("Image is fully transparent (alpha=0 everywhere)")
                return False
            # Compute percentage of non-transparent pixels
            hist = alpha.histogram()
            total_pixels = width * height
            transparent_pixels = hist[0] if len(hist) > 0 else 0
            opaque_pixels = total_pixels - transparent_pixels
            opacity_ratio = opaque_pixels / float(total_pixels)
            if opacity_ratio < 0.01:  # less than 1% pixels are visible
                logger.debug(f"Image nearly fully transparent (opaque ratio: {opacity_ratio:.5f})")
                return False
            # If alpha itself varies (not uniformly opaque/transparent), the image
            # has a real shape even if its visible color is completely flat.
            alpha_extrema = alpha.getextrema()
            alpha_has_shape = alpha_extrema[0] != alpha_extrema[1]
        except Exception:
            # If alpha handling fails, continue with RGB checks below
            pass

        # Check if the image is essentially blank (all pixels same color).
        # Skip this for images whose alpha channel already proved they have a
        # real shape (e.g. a flat-color silhouette logo on transparent background)
        # -- convert('RGB') below would flatten alpha onto black and falsely
        # read such logos as a "solid color".
        if not alpha_has_shape:
            extrema = img.convert('RGB').getextrema()
            # extrema returns ((min_r, max_r), (min_g, max_g), (min_b, max_b))
            # If all channels have same min and max, it's a solid color
            is_solid_color = all(min_val == max_val for min_val, max_val in extrema)
            if is_solid_color:
                logger.debug("Image is solid color (likely empty)")
                return False

        return True

    except Exception as e:
        logger.warning(f"Failed to validate image: {e}")
        return False


def resize_and_optimize_image(image_data: bytes, max_size: int = 64) -> Optional[bytes]:
    """
    Resize and optimize an image to reduce file size while maintaining quality.
    
    Args:
        image_data: Raw image bytes
        max_size: Maximum width/height in pixels (default 64px)
        
    Returns:
        Optimized image bytes in WebP format, or None if processing fails
    """
    try:
        img = Image.open(io.BytesIO(image_data))
        
        # Convert RGBA to RGB if needed (WebP handles transparency well)
        if img.mode in ('RGBA', 'LA'):
            # Keep transparency
            pass
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Resize if larger than max_size
        if img.width > max_size or img.height > max_size:
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        # Save as WebP with high quality but good compression
        output = io.BytesIO()
        img.save(output, format='WEBP', quality=85, method=6)
        optimized_data = output.getvalue()
        
        # Log size reduction
        original_size = len(image_data)
        optimized_size = len(optimized_data)
        reduction = ((original_size - optimized_size) / original_size) * 100
        logger.debug(f"Image optimized: {original_size} -> {optimized_size} bytes ({reduction:.1f}% reduction)")
        
        return optimized_data
        
    except Exception as e:
        logger.warning(f"Failed to optimize image: {e}")
        return None


def fetch_logo_direct(ticker: str) -> Optional[bytes]:
    """
    Fetch logo directly from Brandfetch CDN using ticker as brand ID.
    
    This uses the direct CDN URL: https://cdn.brandfetch.io/{ticker}?c={api_key}
    Sometimes this works even when the API search doesn't return results.
    
    Args:
        ticker: Stock ticker symbol
        
    Returns:
        Optimized logo image bytes if valid logo found, None otherwise
    """
    # Skip if no API key configured
    if not settings.BRANDFETCH_API_KEY:
        logger.warning("BRANDFETCH_API_KEY not configured, skipping direct fetch")
        return None
    
    try:
        if ticker == "AMD":
            ticker = "amd.com"
        url = BRANDFETCH_CDN_URL.format(brand_id=ticker)
        # Add API key parameter
        params = {"c": settings.BRANDFETCH_API_KEY}
        response = requests.get(url, params=params, headers=CDN_HEADERS, timeout=5)
        
        if response.status_code == 200:
            # Check if response is actually an image (Brandfetch returns HTML for invalid brand IDs)
            content_type = response.headers.get('Content-Type', '').lower()
            if not content_type.startswith('image/'):
                logger.debug(f"Brandfetch returned non-image content type for {ticker}: {content_type}")
                return None
            
            # Check if it's a valid image
            if is_valid_image(response.content):
                # Optimize the image before returning
                optimized = resize_and_optimize_image(response.content)
                if optimized:
                    logger.info(f"Successfully fetched and optimized logo for {ticker} via direct CDN")
                    return optimized
                else:
                    # Fallback to original if optimization fails
                    logger.info(f"Successfully fetched logo for {ticker} via direct CDN (optimization failed)")
                    return response.content
            else:
                logger.warning(f"Brandfetch returned empty/invalid image for ticker {ticker}")
                return None
        else:
            logger.debug(f"Direct CDN fetch failed for {ticker}: HTTP {response.status_code}")
            return None
            
    except requests.RequestException as e:
        logger.warning(f"Failed to fetch logo for {ticker}: {e}")
        return None


def fetch_crypto_logo_direct(ticker: str) -> Optional[bytes]:
    """
    Fetch a cryptocurrency logo from Brandfetch's crypto namespace.

    This uses the direct CDN URL:
    https://cdn.brandfetch.io/crypto/{ticker}?c={api_key}
    """
    if not settings.BRANDFETCH_API_KEY:
        logger.warning("BRANDFETCH_API_KEY not configured, skipping crypto direct fetch")
        return None

    normalized_ticker = _normalize_crypto_ticker_for_cdn(ticker)
    if not normalized_ticker:
        return None

    try:
        url = BRANDFETCH_CRYPTO_CDN_URL.format(ticker=normalized_ticker)
        params = {"c": settings.BRANDFETCH_API_KEY}
        response = requests.get(url, params=params, headers=CDN_HEADERS, timeout=5)

        if response.status_code == 200:
            content_type = response.headers.get('Content-Type', '').lower()
            if not content_type.startswith('image/'):
                logger.debug(f"Brandfetch returned non-image content type for crypto {ticker}: {content_type}")
                return None

            if is_valid_image(response.content):
                optimized = resize_and_optimize_image(response.content)
                if optimized:
                    logger.info(f"Successfully fetched and optimized crypto logo for {ticker} via direct CDN")
                    return optimized

                logger.info(f"Successfully fetched crypto logo for {ticker} via direct CDN (optimization failed)")
                return response.content

            logger.warning(f"Brandfetch returned empty/invalid crypto image for ticker {ticker}")
            return None

        logger.debug(f"Direct crypto CDN fetch failed for {ticker}: HTTP {response.status_code}")
        return None

    except requests.RequestException as e:
        logger.warning(f"Failed to fetch crypto logo for {ticker}: {e}")
        return None


def fetch_logo_from_logo_dev(ticker: str) -> Optional[bytes]:
    """
    Fetch a logo from logo.dev's ticker-based lookup.

    Uses fallback=404 so unmatched tickers return an HTTP 404 with a JSON
    error body instead of a generated placeholder image, giving an
    unambiguous signal (unlike Brandfetch, whose ticker search can match
    unrelated companies and whose direct CDN fetch returns a generic "B"
    placeholder image with HTTP 200 for unmatched brand IDs).
    """
    if not settings.LOGO_DEV_API_KEY:
        logger.debug("LOGO_DEV_API_KEY not configured, skipping logo.dev fetch")
        return None

    normalized_ticker = _normalize_ticker_for_search(ticker)
    if not normalized_ticker:
        return None

    try:
        url = LOGO_DEV_TICKER_URL.format(ticker=normalized_ticker)
        params = {"token": settings.LOGO_DEV_API_KEY, "fallback": "404"}
        response = requests.get(url, params=params, timeout=5)

        if response.status_code == 200:
            content_type = response.headers.get('Content-Type', '').lower()
            if not content_type.startswith('image/'):
                logger.debug(f"logo.dev returned non-image content type for {ticker}: {content_type}")
                return None

            if is_valid_image(response.content):
                optimized = resize_and_optimize_image(response.content)
                if optimized:
                    logger.info(f"Successfully fetched and optimized logo for {ticker} via logo.dev")
                    return optimized

                logger.info(f"Successfully fetched logo for {ticker} via logo.dev (optimization failed)")
                return response.content

            logger.warning(f"logo.dev returned empty/invalid image for ticker {ticker}")
            return None

        logger.debug(f"logo.dev fetch failed for {ticker}: HTTP {response.status_code}")
        return None

    except requests.RequestException as e:
        logger.warning(f"Failed to fetch logo for {ticker} via logo.dev: {e}")
        return None


def brandfetch_search(identifier: str) -> List[Dict[str, Any]]:
    """
    Search Brandfetch API for brands matching the identifier.
    
    Args:
        identifier: Company name, domain, or search term
        
    Returns:
        List of brand results from Brandfetch API
    """
    # Skip if no API key configured
    if not settings.BRANDFETCH_API_KEY:
        logger.warning("BRANDFETCH_API_KEY not configured, skipping search")
        return []
    
    try:
        encoded = quote(identifier, safe="")
        url = BRANDFETCH_SEARCH_URL.format(identifier=encoded)
        params = {"c": settings.BRANDFETCH_API_KEY}
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        return data if isinstance(data, list) else []
        
    except requests.RequestException as e:
        logger.warning(f"Brandfetch search failed for '{identifier}': {e}")
        return []


# Minimum quality score required to accept a brand match. Brandfetch returns
# loosely-matched results (e.g. domains that merely contain the search term
# as a substring) even for obscure/unrelated companies, so unclaimed,
# unverified, low-quality matches must be rejected rather than picked as
# "best of a bad bunch".
MIN_BRAND_QUALITY_SCORE = 0.6

# Word-ish characters used to check that a search identifier appears as a
# whole token in a brand's name/domain, not merely as a substring inside an
# unrelated word (e.g. "plbl" inside "plblending.com").
_WORD_CHARS_RE = re.compile(r"[a-z0-9]+")


def _identifier_matches_brand(identifier: str, brand: Dict[str, Any]) -> bool:
    """Check whether a search identifier plausibly refers to this brand.

    Requires every word of the identifier to appear as a whole alnum token
    inside the brand's name or domain (not just anywhere as a raw
    substring), so a ticker like "PLBL" won't match domains such as
    "plblending.com" or "plblaw.com" that merely happen to contain the same
    letters, while a multi-word company name like "Eli Lilly" still matches
    a brand named "Eli Lilly and Company".
    """
    identifier_words = _WORD_CHARS_RE.findall(identifier.strip().lower())
    if not identifier_words:
        return False

    name = (brand.get('name') or '').lower()
    domain = (brand.get('domain') or '').lower()

    name_tokens = set(_WORD_CHARS_RE.findall(name))
    domain_tokens = set(_WORD_CHARS_RE.findall(domain.split('.')[0])) if domain else set()
    available_tokens = name_tokens | domain_tokens

    return all(word in available_tokens for word in identifier_words)


def pick_best_brand(results: List[Dict[str, Any]], identifier: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Pick the best brand from Brandfetch search results.

    Scoring criteria:
    - Verified brands get bonus points
    - Claimed brands get bonus points
    - Higher quality score is better
    - Shorter domain name is preferred (likely the main brand)

    Args:
        results: List of brand results from Brandfetch
        identifier: The search term used to obtain these results. When
            provided, candidates whose name/domain don't actually contain
            the identifier as a whole token are discarded, and a minimum
            quality bar is enforced, to avoid attaching an unrelated
            company's logo to the wrong asset.

    Returns:
        Best matching brand or None if no suitable match
    """
    if not results:
        return None

    candidates = results
    if identifier:
        candidates = [b for b in results if _identifier_matches_brand(identifier, b)]
        if not candidates:
            logger.debug(f"No brand result plausibly matches identifier '{identifier}'")
            return None

    def score_brand(brand: Dict[str, Any]) -> float:
        """Calculate score for a brand"""
        score = 0.0

        # Quality score is the base
        score += brand.get('qualityScore', 0.0)

        # Verified gets significant bonus
        if brand.get('verified', False):
            score += 2.0

        # Claimed gets moderate bonus
        if brand.get('claimed', False):
            score += 1.0

        # Prefer shorter domains (main brand vs subdomain)
        domain = brand.get('domain', '')
        if domain:
            # Penalize long domains slightly
            domain_penalty = len(domain) * 0.01
            score -= domain_penalty

        return score

    # Score all brands and pick the highest
    scored = [(score_brand(brand), brand) for brand in candidates]
    scored.sort(key=lambda x: x[0], reverse=True)

    best_score, best_brand = scored[0]

    if identifier and not (best_brand.get('verified') or best_brand.get('claimed')) \
            and best_brand.get('qualityScore', 0.0) < MIN_BRAND_QUALITY_SCORE:
        logger.debug(
            f"Best brand for '{identifier}' ({best_brand.get('name')}) is unverified, "
            f"unclaimed, and below quality threshold (score: {best_score:.2f}); rejecting"
        )
        return None

    logger.debug(f"Best brand: {best_brand.get('name')} (score: {best_score:.2f})")

    return best_brand


def find_logo_path(company_name: str) -> Optional[str]:
    """
    Find the Brandfetch brand ID (logo path) for a company.
    
    Tries multiple candidate names and returns the brand ID of the best match.
    
    Args:
        company_name: Company name to search for
        
    Returns:
        Brand ID (path component for CDN URL) or None if not found
    """
    for candidate in _candidate_names(company_name):
        results = brandfetch_search(candidate)
        if results:
            best = pick_best_brand(results, identifier=candidate)
            if best and best.get('brandId'):
                logger.info(f"Found logo for '{company_name}' via search '{candidate}': {best['brandId']}")
                return best['brandId']
    
    logger.info(f"No logo found for '{company_name}'")
    return None


def fetch_logo_by_brand_id(brand_id: str) -> Optional[bytes]:
    """
    Fetch and validate logo from a Brandfetch brand ID.
    
    Args:
        brand_id: Brandfetch brand ID
        
    Returns:
        Valid, optimized logo image bytes or None
    """
    # Skip if no API key configured
    if not settings.BRANDFETCH_API_KEY:
        logger.warning("BRANDFETCH_API_KEY not configured, skipping fetch")
        return None
    
    try:
        url = BRANDFETCH_CDN_URL.format(brand_id=brand_id)
        # Add API key parameter
        params = {"c": settings.BRANDFETCH_API_KEY}
        response = requests.get(url, params=params, headers=CDN_HEADERS, timeout=5)
        
        if response.status_code == 200:
            # Check if response is actually an image (Brandfetch returns HTML for invalid brand IDs)
            content_type = response.headers.get('Content-Type', '').lower()
            if not content_type.startswith('image/'):
                logger.debug(f"Brandfetch returned non-image content type for brand ID {brand_id}: {content_type}")
                return None
            
            if is_valid_image(response.content):
                # Optimize the image before returning
                optimized = resize_and_optimize_image(response.content)
                if optimized:
                    logger.info(f"Successfully fetched and optimized logo for brand ID {brand_id}")
                    return optimized
                else:
                    # Fallback to original if optimization fails
                    logger.info(f"Successfully fetched logo for brand ID {brand_id} (optimization failed)")
                    return response.content
            else:
                logger.warning(f"Brand ID {brand_id} returned empty/invalid image")
                return None
        else:
            logger.debug(f"Failed to fetch brand ID {brand_id}: HTTP {response.status_code}")
            return None
            
    except requests.RequestException as e:
        logger.warning(f"Failed to fetch logo from brand ID {brand_id}: {e}")
        return None


def generate_svg_logo(ticker: str) -> str:
    """
    Generate an SVG logo with pink gradient background and ticker letters.
    
    Args:
        ticker: Stock ticker symbol (first 3 letters will be used)
    
    Returns:
        SVG string with gradient background and ticker text
    """
    text = ticker[:3].upper()
    
    svg = f'''<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f472b6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#db2777;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="200" height="200" fill="url(#grad)" />
  <text x="100" y="100" text-anchor="middle" dominant-baseline="central" 
        font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="bold" 
        fill="white">{text}</text>
</svg>'''
    
    return svg


# Provider labels returned by fetch_logo_with_source, identifying which
# upstream service actually supplied the logo bytes.
LOGO_SOURCE_BRANDFETCH = "brandfetch"
LOGO_SOURCE_LOGO_DEV = "logo_dev"
LOGO_SOURCE_GENERATED = "generated"


def fetch_logo_with_source(ticker: str, company_name: Optional[str] = None, asset_type: Optional[str] = None) -> tuple[bytes, str]:
    """
    Fetch and validate a logo for a ticker, reporting which provider supplied it.

    Strategy:
    1. If asset_type is 'ETF', generate SVG logo immediately (skip brand search)
    2. For cryptocurrencies, try Brandfetch's crypto CDN namespace
    3. For other assets, try direct CDN fetch using ticker as brand ID (Brandfetch)
    4. If that fails and a company name is provided, search Brandfetch by company name
    5. If that fails, try logo.dev's ticker-based lookup (fallback=404 for a clean signal)
    6. If all else fails, generate an SVG logo with the ticker
    7. Validate all fetched images to ensure they're not empty

    Args:
        ticker: Stock ticker symbol
        company_name: Optional company name for fallback search
        asset_type: Optional asset type (e.g., 'ETF', 'EQUITY', 'CRYPTO')

    Returns:
        Tuple of (valid logo image bytes, or SVG string as bytes; provider label)
    """
    # For ETFs, generate SVG logo immediately to avoid incorrect brand matches
    if asset_type and asset_type.upper() == 'ETF':
        logger.info(f"Asset type is ETF for {ticker}, generating SVG logo")
        svg_logo = generate_svg_logo(ticker)
        return svg_logo.encode('utf-8'), LOGO_SOURCE_GENERATED

    # Check if cryptocurrency to skip company/ticker searches
    is_crypto = asset_type and asset_type.upper() in ['CRYPTO', 'CRYPTOCURRENCY']

    if is_crypto:
        logo_data = fetch_crypto_logo_direct(ticker)
        if logo_data:
            return logo_data, LOGO_SOURCE_BRANDFETCH

    # Strategy 1: Direct fetch by ticker (skip for cryptocurrencies)
    if not is_crypto:
        logo_data = fetch_logo_direct(ticker)
        if logo_data:
            return logo_data, LOGO_SOURCE_BRANDFETCH
    else:
        logger.info(f"Skipping generic direct CDN fetch for cryptocurrency {ticker}")

    # Strategy 2: Search by company name FIRST if provided (more reliable than ticker search)
    # Ticker search can return wrong companies
    if company_name and not is_crypto:
        logger.info(f"Direct ticker fetch failed for {ticker}, trying company name search: {company_name}")
        brand_id = find_logo_path(company_name)
        if brand_id:
            logo_data = fetch_logo_by_brand_id(brand_id)
            if logo_data:
                logger.info(f"Successfully fetched logo via company name search for {ticker}")
                return logo_data, LOGO_SOURCE_BRANDFETCH
    elif company_name:
        logger.info(f"Skipping company name search for cryptocurrency {ticker}")

    # Strategy 3: logo.dev ticker-based lookup (fallback if no company name match)
    # Brandfetch's own ticker search does loose substring matching and can attach an
    # unrelated company's logo (e.g. VPG matching "Vertical Playground" via vpg.no), so
    # logo.dev is used instead with fallback=404 for an unambiguous match/no-match signal.
    # Skip for cryptocurrencies to avoid matching company tickers (e.g., BTC matching companies named BTC)
    if not is_crypto:
        logger.info(f"Company name search failed for {ticker}, trying logo.dev by ticker")
        logo_data = fetch_logo_from_logo_dev(ticker)
        if logo_data:
            logger.info(f"Successfully fetched logo via logo.dev for {ticker}")
            return logo_data, LOGO_SOURCE_LOGO_DEV
    else:
        logger.info(f"Skipping logo.dev ticker lookup for cryptocurrency {ticker}")

    # Strategy 4: Generate SVG logo as final fallback
    logger.info(f"No logo found for {ticker}, generating SVG fallback")
    svg_logo = generate_svg_logo(ticker)
    return svg_logo.encode('utf-8'), LOGO_SOURCE_GENERATED


def fetch_logo_with_validation(ticker: str, company_name: Optional[str] = None, asset_type: Optional[str] = None) -> Optional[bytes]:
    """
    Fetch and validate a logo for a ticker.

    Thin backward-compatible wrapper around fetch_logo_with_source for
    callers that only need the image bytes and don't care which provider
    supplied them (e.g. PDF report generation).

    Returns:
        Valid logo image bytes (or SVG string as bytes)
    """
    logo_bytes, _source = fetch_logo_with_source(ticker, company_name=company_name, asset_type=asset_type)
    return logo_bytes
