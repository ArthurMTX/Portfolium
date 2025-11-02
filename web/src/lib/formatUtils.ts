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
 */
export function formatCurrency(
  value: number | string | null, 
  currency: string = 'EUR'
): string {
  if (value === null || value === undefined) return '-'
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  
  if (isNaN(numValue)) return '-'
  
  const decimalPlaces = getOptimalDecimalPlaces(numValue)
  
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(numValue)
  
  return formatted
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
