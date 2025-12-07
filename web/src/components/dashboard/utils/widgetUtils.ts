/**
 * Utility functions for widget operations
 */

/**
 * Extract base widget ID from instance ID
 * Example: "total-value-2" -> "total-value"
 */
export function extractBaseWidgetId(widgetId: string): string {
  // Check if ID ends with a number (e.g., "-2", "-3")
  if (widgetId.includes('-') && /\d+$/.test(widgetId)) {
    return widgetId.replace(/-\d+$/, '')
  }
  return widgetId
}

/**
 * Generate a unique widget instance ID
 */
export function generateWidgetInstanceId(baseId: string, existingIds: string[]): string {
  // Count existing instances
  const existingInstances = existingIds.filter(id => 
    id === baseId || id.startsWith(`${baseId}-`)
  )
  
  if (existingInstances.length === 0) {
    return baseId
  }
  
  // Generate next instance number
  const instanceNumber = existingInstances.length + 1
  return `${baseId}-${instanceNumber}`
}

/**
 * Check if a widget ID represents an instance of a base widget
 */
export function isWidgetInstance(widgetId: string, baseWidgetId: string): boolean {
  return widgetId === baseWidgetId || widgetId.startsWith(`${baseWidgetId}-`)
}

/**
 * Get all instances of a specific widget from a layout
 */
export function getWidgetInstances(widgetId: string, existingIds: string[]): string[] {
  return existingIds.filter(id => isWidgetInstance(id, widgetId))
}

/**
 * Format currency value
 */
export function formatCurrency(value: number | string, currency: string = 'USD'): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  
  // Currency symbols
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CHF: 'CHF',
    CAD: 'C$',
    AUD: 'A$',
  }
  
  const symbol = symbols[currency] || currency
  const formatted = Math.abs(numValue).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  
  return numValue < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`
}

/**
 * Format percentage value
 */
export function formatPercent(value: number, decimals: number = 2): string {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(decimals)}%`
}

/**
 * Determine color class based on value
 */
export function getValueColorClass(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return 'text-neutral-600 dark:text-neutral-400'
  }
  if (value > 0) {
    return 'text-emerald-600 dark:text-emerald-400'
  }
  if (value < 0) {
    return 'text-red-600 dark:text-red-400'
  }
  return 'text-neutral-600 dark:text-neutral-400'
}

/**
 * Get background color class based on value
 */
export function getValueBgClass(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return 'bg-neutral-50 dark:bg-neutral-800/40'
  }
  if (value > 0) {
    return 'bg-emerald-50 dark:bg-emerald-900/20'
  }
  if (value < 0) {
    return 'bg-red-50 dark:bg-red-900/20'
  }
  return 'bg-neutral-50 dark:bg-neutral-800/40'
}
