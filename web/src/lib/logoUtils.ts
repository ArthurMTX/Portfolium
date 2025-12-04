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
  if (!symbol) return ''
  return symbol.replace(/-(USD|EUR|GBP|USDT|BUSD|JPY|CAD|AUD|CHF|CNY)$/i, '')
}

/**
 * Clean crypto asset names by removing currency suffixes like " USD", " EUR", etc.
 * For example: "XRP USD" -> "XRP", "Bitcoin USD" -> "Bitcoin"
 */
export const cleanCryptoName = (name: string | null): string | null => {
  if (!name) return null
  return name.replace(/\s+(USD|EUR|GBP|CAD|AUD|JPY|CHF|CNY|USDT|BUSD)$/i, '')
}

/**
 * Get the appropriate logo URL for an asset
 * For most assets, uses only the ticker symbol.
 * For cryptocurrencies, includes asset_type and name to avoid ambiguity (e.g., ETH company vs Ethereum)
 */
export const getAssetLogoUrl = (
  symbol: string,
  assetType?: string | null,
  assetName?: string | null
): string => {
  if (!symbol) return ''
  const normalizedSymbol = normalizeTickerForLogo(symbol)
  
  // For crypto, always include type and name to avoid ambiguity
  const assetTypeUpper = assetType?.toUpperCase()
  const isCrypto = assetTypeUpper === 'CRYPTOCURRENCY' || assetTypeUpper === 'CRYPTO'
  
  if (isCrypto) {
    const params = new URLSearchParams()
    params.set('asset_type', 'CRYPTOCURRENCY')
    if (assetName) {
      const cleanedName = cleanCryptoName(assetName)
      if (cleanedName) {
        params.set('name', cleanedName)
      }
    }
    return `/api/assets/logo/${normalizedSymbol}?${params.toString()}`
  }
  
  // For non-crypto, just use the ticker
  return `/api/assets/logo/${normalizedSymbol}`
}

/**
 * Get a fallback logo URL with asset type and name for better SVG generation
 * Use this only when the primary logo URL fails
 */
export const getFallbackLogoUrl = (
  symbol: string,
  assetType?: string | null,
  assetName?: string | null
): string => {
  if (!symbol) return ''
  const normalizedSymbol = normalizeTickerForLogo(symbol)
  
  const params = new URLSearchParams()
  if (assetType) {
    params.set('asset_type', assetType)
  }
  if (assetName) {
    // Clean crypto names to remove currency suffixes like " USD"
    const assetTypeUpper = assetType?.toUpperCase()
    const isCrypto = assetTypeUpper === 'CRYPTOCURRENCY' || assetTypeUpper === 'CRYPTO'
    const cleanedName = isCrypto ? cleanCryptoName(assetName) : assetName
    if (cleanedName) {
      params.set('name', cleanedName)
    }
  }
  
  const queryString = params.toString()
  return `/api/assets/logo/${normalizedSymbol}${queryString ? '?' + queryString : ''}`
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
    
    // Clean crypto names to remove currency suffixes like " USD"
    const assetTypeUpper = assetType?.toUpperCase()
    const isCrypto = assetTypeUpper === 'CRYPTOCURRENCY' || assetTypeUpper === 'CRYPTO'
    const cleanedName = isCrypto ? cleanCryptoName(assetName) : assetName
    
    if (cleanedName) params.set('name', cleanedName)
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
