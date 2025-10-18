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


def fetch_logo_direct(ticker: str) -> Optional[bytes]:
    """
    Fetch logo directly from Brandfetch CDN using ticker as brand ID.
    
    This uses the direct CDN URL: https://cdn.brandfetch.io/{ticker}
    Sometimes this works even when the API search doesn't return results.
    
    Args:
        ticker: Stock ticker symbol
        
    Returns:
        Logo image bytes if valid logo found, None otherwise
    """
    try:
        url = BRANDFETCH_CDN_URL.format(brand_id=ticker)
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            # Check if it's a valid image
            if is_valid_image(response.content):
                logger.info(f"Successfully fetched logo for {ticker} via direct CDN")
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
        Valid logo image bytes or None
    """
    try:
        url = BRANDFETCH_CDN_URL.format(brand_id=brand_id)
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            if is_valid_image(response.content):
                logger.info(f"Successfully fetched logo for brand ID {brand_id}")
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


def fetch_logo_with_validation(ticker: str, company_name: Optional[str] = None) -> Optional[bytes]:
    """
    Fetch and validate a logo for a ticker.
    
    Strategy:
    1. Try direct CDN fetch using ticker as brand ID
    2. If direct ticker returns empty/invalid, try searching by ticker (API search)
    3. If that fails, try searching by company name
    4. Validate all fetched images to ensure they're not empty
    
    Args:
        ticker: Stock ticker symbol
        company_name: Optional company name for fallback search
        
    Returns:
        Valid logo image bytes or None
    """
    # Strategy 1: Direct fetch by ticker
    logo_data = fetch_logo_direct(ticker)
    if logo_data:
        return logo_data
    
    # Strategy 2: Search API using normalized ticker as search term
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
    
    # Strategy 3: Search by company name if provided
    if company_name:
        logger.info(f"Trying company name search for {ticker}: {company_name}")
        brand_id = find_logo_path(company_name)
        if brand_id:
            logo_data = fetch_logo_by_brand_id(brand_id)
            if logo_data:
                logger.info(f"Successfully fetched logo via company name search for {ticker}")
                return logo_data
    
    logger.info(f"No valid logo found for {ticker}")
    return None


# Note: placeholder generation and brand ID-only helpers were removed.
