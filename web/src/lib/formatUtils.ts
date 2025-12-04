/**
 * Determine optimal decimal places based on price value
 * For very small prices (like penny stocks or some crypto), show more decimal places
 */
export function getOptimalDecimalPlaces(price: number | string | null): number {
  if (price === null || price === undefined) return 2
  
  const numPrice = typeof price === 'string' ? parseFloat(price) : price
  
  if (isNaN(numPrice) || numPrice === 0) return 2
  
  const absPrice = Math.abs(numPrice)
  
  // For very small prices (< 0.01), use more decimal places
  if (absPrice < 0.001) return 6
  if (absPrice < 0.01) return 4
  if (absPrice < 0.1) return 3
  if (absPrice < 1) return 3
  
  // For larger prices, use standard 2 decimal places
  return 2
}

/**
 * Format currency with adaptive precision based on the value
 * Small values get more decimal places to show meaningful data
 * Values very close to zero (< 0.01) are treated as zero to avoid floating point noise
 */
export function formatCurrency(
  value: number | string | null, 
  currency: string = 'EUR',
  locale?: string
): string {
  if (value === null || value === undefined) return '-'
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  
  if (isNaN(numValue)) return '-'
  
  // Treat very small values as zero to avoid displaying floating point noise like -0.000002
  if (Math.abs(numValue) < 0.01) {
    const userLocale = locale || navigator.language || 'en-US'
    return new Intl.NumberFormat(userLocale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(0)
  }
  
  const decimalPlaces = getOptimalDecimalPlaces(numValue)
  const userLocale = locale || navigator.language || 'en-US'
  
  const formatted = new Intl.NumberFormat(userLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(numValue)
  
  return formatted
}

/**
 * Format currency without unnecessary decimals (101,00 -> 101)
 * Used for fees, totals, and other values where .00 is redundant
 */
export function formatCurrencyCompact(
  value: number | string | null, 
  currency: string = 'EUR',
  locale?: string
): string {
  if (value === null || value === undefined) return '-'
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  
  if (isNaN(numValue)) return '-'
  if (numValue === 0) return '-'
  
  const userLocale = locale || navigator.language || 'en-US'
  
  // Check if value is effectively a whole number (handles floating point precision issues)
  const rounded = Math.round(numValue * 100) / 100
  const isWholeNumber = rounded === Math.floor(rounded)
  
  return new Intl.NumberFormat(userLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: isWholeNumber ? 0 : 2,
    maximumFractionDigits: isWholeNumber ? 0 : 2,
  }).format(rounded)
}

/**
 * Format a number with specified decimal places
 */
export function formatNumber(value: number | string | null, decimals: number = 2): string {
  if (value === null || value === undefined) return '-'
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return '-'
  return numValue.toFixed(decimals)
}

/**
 * Format quantity with up to 8 decimals, removing trailing zeros
 */
export function formatQuantity(value: number | string | null): string {
  if (value === null || value === undefined) return '-'
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return '-'
  
  // Format with up to 8 decimals, then remove trailing zeros
  const formatted = numValue.toFixed(8)
  return formatted.replace(/\.?0+$/, '')
}

/**
 * Format asset type for display
 * Converts uppercase or snake_case to title case
 * Special handling for ETF to keep it uppercase
 */
export function formatAssetType(type: string | null): string {
  if (!type) return '-'
  if (type.trim().toLowerCase() === 'etf') return 'ETF'
  // Convert to title case and clean up
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Format large numbers with abbreviations (K, M, B, T)
 * For market cap and volume display
 * e.g., 30665161 -> 30.67M
 */
export function formatLargeNumber(value: number | string | null, decimals: number = 2): string {
  if (value === null || value === undefined) return '-'
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return '-'
  
  const absValue = Math.abs(numValue)
  const sign = numValue < 0 ? '-' : ''
  
  if (absValue >= 1e12) {
    return sign + (absValue / 1e12).toFixed(decimals) + 'T'
  } else if (absValue >= 1e9) {
    return sign + (absValue / 1e9).toFixed(decimals) + 'B'
  } else if (absValue >= 1e6) {
    return sign + (absValue / 1e6).toFixed(decimals) + 'M'
  } else if (absValue >= 1e3) {
    return sign + (absValue / 1e3).toFixed(decimals) + 'K'
  }
  
  return sign + absValue.toFixed(decimals)
}

/**
 * Format number with thousands separators
 * e.g., 30665161 -> 30,665,161
 */
export function formatWithSeparators(value: number | string | null): string {
  if (value === null || value === undefined) return '-'
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return '-'
  
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0
  }).format(numValue)
}
