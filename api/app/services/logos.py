"""
Logo fetching service using Brandfetch API
"""
import io
import logging
from typing import Optional, List, Dict, Any, Iterator
from urllib.parse import quote
import requests
from PIL import Image

from app.config import settings

logger = logging.getLogger(__name__)

# Brandfetch API configuration
BRANDFETCH_SEARCH_URL = "https://api.brandfetch.io/v2/search/{identifier}"
BRANDFETCH_CDN_URL = "https://cdn.brandfetch.io/{brand_id}"

# Request headers for CDN requests (Brandfetch requires browser-like User-Agent)
CDN_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

# Minimum size in bytes for a valid PNG (empty PNGs are typically very small)
MIN_VALID_IMAGE_SIZE = 200  # bytes

# Minimum dimensions for a valid logo
MIN_VALID_WIDTH = 16
MIN_VALID_HEIGHT = 16


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
    
    try:
        # Try to open and validate the image
        img = Image.open(io.BytesIO(image_data))

        # Check dimensions
        width, height = img.size
        if width < MIN_VALID_WIDTH or height < MIN_VALID_HEIGHT:
            logger.debug(f"Image dimensions too small: {width}x{height}")
            return False

        # If the image has an alpha channel, ensure it's not fully or almost fully transparent
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
        except Exception:
            # If alpha handling fails, continue with RGB checks below
            pass

        # Check if the image is essentially blank (all pixels same color)
        # Convert to RGB (drops alpha) and test extrema
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


def pick_best_brand(results: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Pick the best brand from Brandfetch search results.
    
    Scoring criteria:
    - Verified brands get bonus points
    - Claimed brands get bonus points
    - Higher quality score is better
    - Shorter domain name is preferred (likely the main brand)
    
    Args:
        results: List of brand results from Brandfetch
        
    Returns:
        Best matching brand or None if no suitable match
    """
    if not results:
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
    scored = [(score_brand(brand), brand) for brand in results]
    scored.sort(key=lambda x: x[0], reverse=True)
    
    best_score, best_brand = scored[0]
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
            best = pick_best_brand(results)
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


def generate_etf_logo(ticker: str) -> str:
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


def fetch_logo_with_validation(ticker: str, company_name: Optional[str] = None, asset_type: Optional[str] = None) -> Optional[bytes]:
    """
    Fetch and validate a logo for a ticker.
    
    Strategy:
    1. If asset_type is 'ETF', generate SVG logo immediately (skip brand search)
    2. For cryptocurrencies, skip direct CDN and ticker search to avoid wrong matches
    3. For other assets, try direct CDN fetch using ticker as brand ID
    4. If direct ticker returns empty/invalid, try searching by ticker (API search)
    5. If that fails, try searching by company name
    6. If all else fails, generate an SVG logo with the ticker
    7. Validate all fetched images to ensure they're not empty
    
    Args:
        ticker: Stock ticker symbol
        company_name: Optional company name for fallback search
        asset_type: Optional asset type (e.g., 'ETF', 'EQUITY', 'CRYPTO')
        
    Returns:
        Valid logo image bytes (or SVG string as bytes)
    """
    # For ETFs, generate SVG logo immediately to avoid incorrect brand matches
    if asset_type and asset_type.upper() == 'ETF':
        logger.info(f"Asset type is ETF for {ticker}, generating SVG logo")
        svg_logo = generate_etf_logo(ticker)
        return svg_logo.encode('utf-8')
    
    # Check if cryptocurrency to skip ticker-based searches
    is_crypto = asset_type and asset_type.upper() in ['CRYPTO', 'CRYPTOCURRENCY']
    
    # Strategy 1: Direct fetch by ticker (skip for cryptocurrencies)
    if not is_crypto:
        logo_data = fetch_logo_direct(ticker)
        if logo_data:
            return logo_data
    else:
        logger.info(f"Skipping direct CDN fetch for cryptocurrency {ticker}")
    
    # Strategy 2: Search API using normalized ticker as search term
    # Skip ticker search for cryptocurrencies to avoid matching company tickers (e.g., BTC matching companies named BTC)
    if not is_crypto:
        logger.info(f"Direct ticker fetch failed for {ticker}, trying API search by ticker")
        normalized_ticker = _normalize_ticker_for_search(ticker)
        if normalized_ticker:
            results = brandfetch_search(normalized_ticker)
            best = pick_best_brand(results) if results else None
            brand_id = best.get('brandId') if best else None
            if brand_id and brand_id != ticker:
                logo_data = fetch_logo_by_brand_id(brand_id)
                if logo_data:
                    logger.info(f"Successfully fetched logo via ticker search for {ticker}")
                    return logo_data
    else:
        logger.info(f"Skipping ticker search for cryptocurrency {ticker}")
    
    # Strategy 3: Search by company name if provided
    if company_name:
        logger.info(f"Trying company name search for {ticker}: {company_name}")
        brand_id = find_logo_path(company_name)
        if brand_id:
            logo_data = fetch_logo_by_brand_id(brand_id)
            if logo_data:
                logger.info(f"Successfully fetched logo via company name search for {ticker}")
                return logo_data
    
    # Strategy 4: Generate SVG logo as final fallback
    logger.info(f"No logo found for {ticker}, generating SVG fallback")
    svg_logo = generate_etf_logo(ticker)
    return svg_logo.encode('utf-8')


# Note: placeholder generation and brand ID-only helpers were removed.
