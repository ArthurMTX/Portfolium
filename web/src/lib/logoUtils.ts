/**
 * Utility functions for handling asset logos
 */

/**
 * Validate that a loaded logo image is not empty or fully transparent
 * This catches edge cases where the backend returns a valid image file
 * that is actually invisible/blank
 * 
 * @param img The loaded HTMLImageElement to validate
 * @returns true if image is valid (has visible pixels), false if empty/transparent
 */
export const validateLogoImage = (img: HTMLImageElement): boolean => {
  // Skip if already validated
  if (img.dataset.validated) return true
  img.dataset.validated = 'true'

  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return true // Can't validate, assume valid

    const w = Math.min(img.naturalWidth || 0, 64) || 32
    const h = Math.min(img.naturalHeight || 0, 64) || 32
    if (w === 0 || h === 0) return false // No dimensions = invalid

    canvas.width = w
    canvas.height = h
    ctx.drawImage(img, 0, 0, w, h)
    
    const data = ctx.getImageData(0, 0, w, h).data
    let opaque = 0
    
    // Count opaque pixels (alpha > 8)
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3]
      if (a > 8) opaque++
    }
    
    const total = (data.length / 4) || 1
    const opacityRatio = opaque / total
    
    // Image is invalid if less than 1% of pixels are visible
    return opacityRatio >= 0.01
  } catch {
    // Canvas/security errors - assume valid
    return true
  }
}

/**
 * Normalize ticker symbol for logo lookup by removing currency suffixes
 */
export const normalizeTickerForLogo = (symbol: string): string => {
  return symbol.replace(/-(USD|EUR|GBP|USDT|BUSD|JPY|CAD|AUD|CHF|CNY)$/i, '')
}

/**
 * Get the appropriate logo URL for an asset
 * For ETFs, uses the API endpoint directly to ensure SVG fallback generation
 * For other assets, uses static logos with API fallback on error
 */
export const getAssetLogoUrl = (
  symbol: string,
  assetType?: string | null,
  assetName?: string | null
): string => {
  const normalizedSymbol = normalizeTickerForLogo(symbol)
  
  // For ETFs, use the API endpoint directly to ensure proper SVG fallback
  if (assetType?.toUpperCase() === 'ETF') {
    const params = new URLSearchParams()
    params.set('asset_type', 'ETF')
    if (assetName) {
      params.set('name', assetName)
    }
    return `/api/assets/logo/${normalizedSymbol}?${params.toString()}`
  }
  
  // For other asset types, use static logos (will fallback to API in onError)
  return `/logos/${normalizedSymbol}`
}

/**
 * Common onError handler for asset logo images
 * Attempts to fetch logo from API endpoint with proper parameters
 */
export const handleLogoError = (
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  symbol: string,
  assetName?: string | null,
  assetType?: string | null
) => {
  const img = e.currentTarget as HTMLImageElement
  
  if (!img.dataset.resolverTried) {
    img.dataset.resolverTried = 'true'
    const params = new URLSearchParams()
    if (assetName) params.set('name', assetName)
    if (assetType) params.set('asset_type', assetType)
    
    fetch(`/api/assets/logo/${symbol}?${params.toString()}`, { redirect: 'follow' })
      .then((res) => {
        if (res.redirected) {
          img.src = res.url
        } else if (res.ok) {
          return res.blob().then((blob) => {
            img.src = URL.createObjectURL(blob)
          })
        } else {
          img.style.display = 'none'
        }
      })
      .catch(() => {
        img.style.display = 'none'
      })
  } else {
    img.style.display = 'none'
  }
}
