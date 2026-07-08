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
