# Logo Fetching

Technical documentation for the company logo fetching and caching system.

## Overview

Portfolium automatically fetches and displays company logos for assets using a multi-strategy approach with fallbacks. Logos are fetched from the Brandfetch API, validated, optimized, and cached in the database.

## Architecture

### Service Location

`api/app/services/logos.py`

### Key Components

1. **Brandfetch API Integration**: Primary logo source
2. **Image Validation**: Ensure logos are not empty or corrupted
3. **Image Optimization**: Resize and convert to WebP format
4. **Database Caching**: Store logos in `assets.logo_data`
5. **SVG Fallback**: Generate pink gradient logos when fetch fails

## Logo Fetching Strategies

### Strategy 1: Direct CDN Fetch

**Endpoint**: `https://cdn.brandfetch.io/{ticker}?c={api_key}`

Attempts to fetch logo directly using the ticker symbol as brand ID:

```python
def fetch_logo_direct(ticker: str) -> Optional[bytes]:
    """
    Fetch logo directly from Brandfetch CDN using ticker as brand ID.
    
    Returns:
        Optimized logo image bytes if valid logo found, None otherwise
    """
    url = BRANDFETCH_CDN_URL.format(brand_id=ticker)
    params = {"c": settings.BRANDFETCH_API_KEY}
    response = requests.get(url, params=params, headers=CDN_HEADERS, timeout=5)
    
    if response.status_code == 200:
        if is_valid_image(response.content):
            return resize_and_optimize_image(response.content)
    return None
```

**Works for**:

- Tickers that match brand domains (e.g., `AAPL`, `MSFT`, `GOOGL`)
- Companies with simple brand IDs
- Common stocks with well-known tickers

**Fails for**:

- Exchange-suffixed tickers (e.g., `CAVENO.OL`)
- Less common companies
- Crypto pairs (e.g., `BTC-USD`)

### Strategy 2: API Search by Ticker

**Endpoint**: `https://api.brandfetch.io/v2/search/{ticker}?c={api_key}`

Searches Brandfetch database using normalized ticker:

```python
def brandfetch_search(identifier: str) -> List[Dict[str, Any]]:
    """
    Search Brandfetch API for brands matching the identifier.
    
    Returns:
        List of brand results from Brandfetch API
    """
    encoded = quote(identifier, safe="")
    url = BRANDFETCH_SEARCH_URL.format(identifier=encoded)
    params = {"c": settings.BRANDFETCH_API_KEY}
    
    response = requests.get(url, params=params, timeout=10)
    data = response.json()
    return data if isinstance(data, list) else []
```

**Ticker Normalization**:

```python
def _normalize_ticker_for_search(ticker: str) -> str:
    """
    Normalize exchange-suffixed tickers for Brandfetch search.
    
    Examples:
        "CAVENO.OL" -> "CAVENO"
        "RIO.L" -> "RIO"
        "BRK-B" -> "BRK-B" (keep hyphen)
    """
    return ticker.split('.')[0]
```

Removes exchange suffixes (`.OL`, `.L`, `.TO`, `.HK`, etc.) for better search results.

### Strategy 3: API Search by Company Name

**Fallback**: Search using the company name instead of ticker

```python
def find_logo_path(company_name: str) -> Optional[str]:
    """
    Find the Brandfetch brand ID for a company.
    
    Tries multiple candidate names and returns the brand ID of the best match.
    """
    for candidate in _candidate_names(company_name):
        results = brandfetch_search(candidate)
        if results:
            best = pick_best_brand(results)
            if best and best.get('brandId'):
                return best['brandId']
    return None
```

**Company Name Candidates**:

```python
def _candidate_names(company_name: str) -> Iterator[str]:
    """
    Generate candidate search names from a company name.
    
    Examples:
        "Apple Inc." -> ["Apple Inc.", "Apple"]
        "Microsoft Corporation" -> ["Microsoft Corporation", "Microsoft"]
        "Eli Lilly and Company" -> ["Eli Lilly and Company", "Eli Lilly"]
    """
    yield company_name  # Try full name first
    
    # Remove common suffixes
    suffixes = [
        " Inc.", " Inc", " Corporation", " Corp.", " Corp",
        " Ltd.", " Ltd", " Limited", " LLC", " L.L.C.",
        " PLC", " P.L.C.", " AG", " S.A.", " S.A",
        " N.V.", " NV", " GmbH", " Co.", " and Company", " & Co.",
        " ASA", " A.S.A.", " AS", " Ab", " AB", " Oyj",
        " S.p.A.", " SpA", " SA", " SE"
    ]
    
    for suffix in suffixes:
        if company_name.endswith(suffix):
            base_name = company_name[:-len(suffix)].strip()
            if base_name:
                yield base_name
            break  # Only remove one suffix
```

Strips common corporate suffixes to improve search accuracy.

### Strategy 4: SVG Fallback Generation

**Final fallback**: Generate a pink gradient SVG with ticker letters

```python
def generate_etf_logo(ticker: str) -> str:
    """
    Generate an SVG logo with pink gradient background and ticker letters.
    
    Returns:
        SVG string with gradient background and ticker text
    """
    text = ticker[:3].upper()  # First 3 letters
    
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
```

**Result**: Pink gradient square with white ticker text (e.g., "AAP" for AAPL)

## Brand Selection Logic

When API search returns multiple brands, pick the best match:

```python
def pick_best_brand(results: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Pick the best brand from Brandfetch search results.
    
    Scoring criteria:
    - Verified brands get +2.0 bonus
    - Claimed brands get +1.0 bonus
    - Higher quality score is better
    - Shorter domain name preferred (less penalty)
    """
    def score_brand(brand: Dict[str, Any]) -> float:
        score = brand.get('qualityScore', 0.0)  # Base score
        
        if brand.get('verified', False):
            score += 2.0  # Significant bonus
        
        if brand.get('claimed', False):
            score += 1.0  # Moderate bonus
        
        domain = brand.get('domain', '')
        if domain:
            score -= len(domain) * 0.01  # Penalize long domains
        
        return score
    
    # Pick highest scoring brand
    scored = [(score_brand(brand), brand) for brand in results]
    scored.sort(key=lambda x: x[0], reverse=True)
    
    return scored[0][1] if scored else None
```

**Scoring Example**:

```
Brand A: example.com, verified=True, qualityScore=8.0
Score: 8.0 + 2.0 - (11 * 0.01) = 9.89

Brand B: subdomain.example.com, verified=False, claimed=True, qualityScore=9.0
Score: 9.0 + 1.0 - (22 * 0.01) = 9.78

Winner: Brand A (higher score despite lower qualityScore)
```

## Image Validation

Ensures fetched images are not empty, transparent, or corrupted:

```python
def is_valid_image(image_data: bytes) -> bool:
    """
    Check if the image data represents a valid, non-empty logo image.
    
    Detects:
    - Empty or very small PNG files (<200 bytes)
    - Images with dimensions too small (<16x16px)
    - Fully or nearly fully transparent images
    - Solid color (blank) images
    - Corrupted image data
    """
    # Size check
    if len(image_data) < MIN_VALID_IMAGE_SIZE:  # 200 bytes
        return False
    
    try:
        img = Image.open(io.BytesIO(image_data))
        
        # Dimension check
        width, height = img.size
        if width < MIN_VALID_WIDTH or height < MIN_VALID_HEIGHT:  # 16x16
            return False
        
        # Transparency check (alpha channel)
        img_rgba = img.convert('RGBA')
        alpha = img_rgba.getchannel('A')
        hist = alpha.histogram()
        
        total_pixels = width * height
        transparent_pixels = hist[0] if len(hist) > 0 else 0
        opaque_pixels = total_pixels - transparent_pixels
        opacity_ratio = opaque_pixels / float(total_pixels)
        
        if opacity_ratio < 0.01:  # Less than 1% visible
            return False
        
        # Solid color check
        extrema = img.convert('RGB').getextrema()
        is_solid_color = all(min_val == max_val for min_val, max_val in extrema)
        if is_solid_color:
            return False
        
        return True
        
    except Exception:
        return False
```

**Validation Steps**:

1. **Size**: Minimum 200 bytes (empty PNGs are ~100 bytes)
2. **Dimensions**: Minimum 16×16 pixels (tiny images unusable)
3. **Opacity**: At least 1% of pixels must be visible (not transparent)
4. **Color variance**: Must have different pixel colors (not blank)

## Image Optimization

Reduces file size while maintaining quality:

```python
def resize_and_optimize_image(image_data: bytes, max_size: int = 64) -> Optional[bytes]:
    """
    Resize and optimize an image to reduce file size.
    
    Args:
        image_data: Raw image bytes
        max_size: Maximum width/height in pixels (default 64px)
        
    Returns:
        Optimized image bytes in WebP format
    """
    img = Image.open(io.BytesIO(image_data))
    
    # Resize if larger than max_size
    if img.width > max_size or img.height > max_size:
        img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    
    # Save as WebP with high quality compression
    output = io.BytesIO()
    img.save(output, format='WEBP', quality=85, method=6)
    optimized_data = output.getvalue()
    
    # Log size reduction
    reduction = ((len(image_data) - len(optimized_data)) / len(image_data)) * 100
    logger.debug(f"Image optimized: {len(image_data)} -> {len(optimized_data)} bytes ({reduction:.1f}% reduction)")
    
    return optimized_data
```

**Optimization Steps**:

1. **Resize**: Thumbnail to 64×64 max (maintains aspect ratio)
2. **Format**: Convert to WebP (better compression than PNG/JPEG)
3. **Quality**: 85% quality (good balance of size vs. quality)
4. **Method**: Compression method 6 (slowest but best compression)

**Typical Results**:

- PNG 50KB → WebP 5KB (90% reduction)
- JPEG 30KB → WebP 4KB (87% reduction)
- SVG 2KB → WebP 3KB (minimal change, but raster)

## Database Caching

Logos are stored directly in the database:

### Schema

```python
class Asset(Base):
    # ... other fields ...
    
    logo_data = Column(LargeBinary)         # Binary logo data
    logo_content_type = Column(String)      # MIME type
    logo_fetched_at = Column(DateTime)      # Cache timestamp
```

**Fields**:

- `logo_data`: Raw bytes of WebP or SVG image
- `logo_content_type`: `image/webp` or `image/svg+xml`
- `logo_fetched_at`: When logo was last fetched/cached

### Caching Logic

```python
# In asset router (app/routers/assets.py)

if asset.logo_data and asset.logo_content_type:
    # Serve from cache
    return Response(
        content=asset.logo_data,
        media_type=asset.logo_content_type
    )
else:
    # Fetch, validate, optimize, cache
    logo_data = fetch_logo_with_validation(
        ticker=symbol,
        company_name=asset.name,
        asset_type=asset.asset_type
    )
    
    if logo_data:
        # Determine content type
        if logo_data.startswith(b'<svg'):
            content_type = 'image/svg+xml'
        else:
            content_type = 'image/webp'
        
        # Save to database
        asset.logo_data = logo_data
        asset.logo_content_type = content_type
        asset.logo_fetched_at = datetime.utcnow()
        db.commit()
        
        return Response(content=logo_data, media_type=content_type)
```

**Cache Behavior**:

- **Hit**: Serve from `logo_data` immediately
- **Miss**: Fetch, optimize, save, then serve
- **No expiration**: Logos cached indefinitely (corporate logos rarely change)
- **Manual refresh**: Delete `logo_data` to force re-fetch

## API Endpoint

### Get Asset Logo

`GET /api/assets/logo/{symbol}`

**Query Parameters**:

- `name` (optional): Company name for fallback search
- `asset_type` (optional): Asset type (e.g., 'ETF', 'EQUITY')

**Response**:

- **Content-Type**: `image/webp` or `image/svg+xml`
- **Body**: Binary image data
- **Status**: 200 OK (even for generated SVG fallback)

**Example**:

```http
GET /api/assets/logo/AAPL?name=Apple%20Inc.&asset_type=EQUITY
```

**Response Headers**:

```
Content-Type: image/webp
Content-Length: 4532
Cache-Control: public, max-age=86400
```

## Frontend Integration

### Image Tag

```tsx
<img
  src={`/logos/${symbol}${asset_type === 'ETF' ? '?asset_type=ETF' : ''}`}
  alt={`${symbol} logo`}
  className="w-8 h-8 object-cover"
  onError={(e) => {
    // Fallback: try API endpoint with name
    const img = e.currentTarget
    const params = new URLSearchParams()
    if (name) params.set('name', name)
    if (asset_type) params.set('asset_type', asset_type)
    
    fetch(`/api/assets/logo/${symbol}?${params.toString()}`)
      .then(res => res.blob())
      .then(blob => {
        img.src = URL.createObjectURL(blob)
      })
      .catch(() => {
        img.style.display = 'none'  // Hide on failure
      })
  }}
/>
```

**Error Handling**:

1. Try static `/logos/{symbol}` route first (nginx serves from filesystem)
2. On 404, fetch from API `/api/assets/logo/{symbol}` with company name
3. API returns either fetched logo or generated SVG
4. Cache blob URL in browser
5. Hide image if all strategies fail (rare)

### Logo Validation on Frontend

```tsx
onLoad={(e) => {
  const img = e.currentTarget
  
  // Create canvas to check if image is empty
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  ctx.drawImage(img, 0, 0)
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = imageData.data
  
  // Check if mostly transparent
  let opaquePixels = 0
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] > 8) opaquePixels++  // Alpha > 8
  }
  
  const totalPixels = pixels.length / 4
  if (opaquePixels / totalPixels < 0.01) {
    // Image is empty, trigger error handler
    img.dispatchEvent(new Event('error'))
  }
}}
```

Double-checks that loaded image isn't empty (catches edge cases backend missed).

## Configuration

### Environment Variables

```env
# Brandfetch API Key (optional but recommended)
BRANDFETCH_API_KEY=your-api-key-here
```

**Without API Key**:

- Logo fetching still works
- API calls return fewer/lower quality results
- More reliance on SVG fallback

**With API Key** (recommended):

- Better search results
- Higher quality logos
- More coverage for less-known companies

### API Rate Limits

Brandfetch limits (vary by plan):

- **Free tier**: ~100 requests/month
- **Paid tiers**: Higher limits

**Mitigation**:

- Database caching reduces API calls drastically
- Only fetch once per asset
- Logos rarely change (long cache lifetime)

## Performance Considerations

### Database Storage

**Typical logo sizes**:

- WebP optimized: 2-8 KB each
- SVG fallback: 1-2 KB each
- Average: ~5 KB per asset

**100 assets**: ~500 KB total
**1,000 assets**: ~5 MB total

Negligible database impact.

### Network Performance

**First request** (cache miss):

- Brandfetch API call: 200-500ms
- Image optimization: 50-100ms
- Database save: 10-20ms
- **Total**: 260-620ms

**Subsequent requests** (cache hit):

- Database query: 5-10ms
- Binary data transfer: 10-20ms
- **Total**: 15-30ms

95%+ of requests are cache hits.

### Frontend Caching

Browser caches logos:

```
Cache-Control: public, max-age=86400  # 24 hours
```

After first load, logos served from browser cache (0ms).

## Troubleshooting

### Logo Not Appearing

**Check 1: API Key**

```bash
# In .env file
BRANDFETCH_API_KEY=your-key-here
```

Without key, many logos won't fetch.

**Check 2: Database**

```sql
SELECT symbol, logo_data IS NOT NULL as has_logo, logo_content_type 
FROM portfolio.assets 
WHERE symbol = 'AAPL';
```

If `has_logo` is FALSE, logo fetch failed or hasn't been attempted.

**Check 3: Backend Logs**

```bash
docker compose logs api | grep -i logo
```

Look for errors like:

- `Brandfetch returned non-image content type`
- `Image too small: X bytes`
- `Image is fully transparent`

**Check 4: Manual Fetch**

```bash
curl "http://localhost:8000/api/assets/logo/AAPL?name=Apple%20Inc."
```

Should return image/webp or image/svg+xml.

### Empty/Transparent Logos

**Cause**: Brandfetch sometimes returns placeholder images

**Solution**: Image validation catches these and falls back to SVG

**Manual fix**: Delete cached logo to force re-fetch

```sql
UPDATE portfolio.assets 
SET logo_data = NULL, logo_content_type = NULL, logo_fetched_at = NULL 
WHERE symbol = 'AAPL';
```

### SVG Fallback Showing Instead of Real Logo

**Cause**: All fetch strategies failed

**Debugging**:

1. Check company name is set correctly
2. Try searching Brandfetch website manually for the ticker
3. Verify API key is valid
4. Check rate limits aren't exceeded

**Workaround**: Manually upload logo via database or use custom logo service

## Testing

### Unit Tests

```python
def test_parse_split_ratio():
    """Test ticker normalization"""
    assert _normalize_ticker_for_search("AAPL") == "AAPL"
    assert _normalize_ticker_for_search("CAVENO.OL") == "CAVENO"
    assert _normalize_ticker_for_search("BRK-B") == "BRK-B"

def test_candidate_names():
    """Test company name suffix removal"""
    names = list(_candidate_names("Apple Inc."))
    assert "Apple Inc." in names
    assert "Apple" in names
    
    names = list(_candidate_names("Microsoft Corporation"))
    assert "Microsoft" in names

def test_image_validation():
    """Test empty image detection"""
    # Empty PNG (transparent 1x1)
    empty_png = b'\x89PNG\r\n\x1a\n...'  # Minimal PNG
    assert not is_valid_image(empty_png)
    
    # Valid image
    valid_image = open('test_logo.png', 'rb').read()
    assert is_valid_image(valid_image)

def test_svg_generation():
    """Test fallback SVG generation"""
    svg = generate_etf_logo("AAPL")
    assert svg.startswith('<svg')
    assert 'AAP' in svg  # First 3 letters
    assert 'linearGradient' in svg
```

### Integration Tests

```python
@pytest.mark.integration
def test_logo_fetch_and_cache():
    """Test full logo fetch workflow"""
    # Clear cache
    asset = db.query(Asset).filter_by(symbol="AAPL").first()
    asset.logo_data = None
    db.commit()
    
    # Fetch logo
    response = client.get("/api/assets/logo/AAPL?name=Apple Inc.")
    assert response.status_code == 200
    assert response.headers['content-type'] in ['image/webp', 'image/svg+xml']
    
    # Verify cached
    db.refresh(asset)
    assert asset.logo_data is not None
    assert asset.logo_content_type is not None
    
    # Second request should be faster (from cache)
    response2 = client.get("/api/assets/logo/AAPL")
    assert response2.status_code == 200
    assert response2.content == response.content
```

## Best Practices

### For Developers

1. **Always validate images**: Check for empty/transparent before caching
2. **Optimize before storing**: Resize and convert to WebP
3. **Handle failures gracefully**: Always have SVG fallback
4. **Log fetch results**: Help debug issues
5. **Don't retry indefinitely**: Cache failures to avoid rate limit exhaustion

### For Users

1. **Provide company names**: Improves logo fetch success rate
2. **Accept SVG fallbacks**: Better than no logo
3. **Report missing logos**: Help improve the system
4. **Don't expect perfection**: Some logos simply aren't available

## Future Improvements

### Potential Enhancements

1. **Multiple logo sources**: Add Alpha Vantage, Clearbit, or Logo.dev
2. **Manual logo upload**: Allow users to upload custom logos
3. **Logo refresh**: Periodic re-fetch to catch updated branding
4. **CDN serving**: Serve logos from CDN instead of database
5. **Lazy loading**: Only fetch logos for visible assets

### Known Limitations

1. **New companies**: Recently IPO'd companies may not have logos yet
2. **International exchanges**: Non-US tickers may have lower success rates
3. **Crypto**: Crypto pair logos (BTC-USD) often fail (use BTC instead)
4. **Private companies**: No public logos available

## Related Documentation

- [Assets User Guide](../user-guide/assets.md) - User perspective on logos
- [Data Models](data-models.md) - Asset model schema
- [Pricing Service](pricing-service.md) - Related asset enrichment

## References

- [Brandfetch API Documentation](https://docs.brandfetch.com/)
- [Pillow (PIL) Documentation](https://pillow.readthedocs.io/)
- [WebP Format Specification](https://developers.google.com/speed/webp)