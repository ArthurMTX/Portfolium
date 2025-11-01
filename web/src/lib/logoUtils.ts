/**
 * Utility functions for handling asset logos
 */

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
