/**
 * Widget size configuration
 * 
 * This file defines the default sizes and constraints for each widget type.
 * These configurations are used both in the WidgetLibrary and when loading saved layouts
 * to ensure widgets maintain proper dimensions.
 */

export interface WidgetSizeConfig {
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
}

export const widgetSizes: Record<string, WidgetSizeConfig> = {
  // Metrics
  'total-value': { w: 3, h: 2, minW: 2, minH: 2 },
  'daily-gain': { w: 3, h: 2, minW: 2, minH: 2 },
  'unrealized-pnl': { w: 2, h: 2, minW: 2, minH: 2 },
  'realized-pnl': { w: 2, h: 2, minW: 2, minH: 2 },
  'dividends': { w: 2, h: 2, minW: 2, minH: 2 },
  
  // Data widgets
  'notifications': { w: 4, h: 3, minW: 4, minH: 2 },
  'watchlist': { w: 4, h: 3, minW: 4, minH: 2 },
  'positions': { w: 12, h: 12, minW: 8, minH: 6 },
  
  // Insights widgets
  'total-return': { w: 3, h: 2, minW: 2, minH: 2 },
  'win-rate': { w: 3, h: 3, minW: 2, minH: 3 },
  'concentration-risk': { w: 4, h: 5, minW: 3, minH: 5 },
  'best-worst-today': { w: 3, h: 4, minW: 3, minH: 4 },
  'performance-metrics': { w: 3, h: 4, minW: 3, minH: 4 },
  'top-performers': { w: 4, h: 7, minW: 3, minH: 3 },
  'worst-performers': { w: 4, h: 7, minW: 3, minH: 3 },
  'largest-holdings': { w: 4, h: 7, minW: 3, minH: 6 },
  'recent-transactions': { w: 4, h: 9, minW: 4, minH: 3 },
  'market-status': { w: 3, h: 5, minW: 2, minH: 5 },
  'market-indices': { w: 4, h: 7, minW: 3, minH: 6 },
  'asset-allocation': { w: 4, h: 8, minW: 3, minH: 6 },
  'portfolio-heatmap': { w: 6, h: 8, minW: 4, minH: 6 },
  'goal-tracker': { w: 3, h: 8, minW: 3, minH: 7 },
}

/**
 * Helper to extract widget base ID (removes -1, -2, etc. suffixes for multiple instances)
 */
export const getWidgetBaseId = (widgetId: string): string => {
  return widgetId.replace(/-\d+$/, '')
}

/**
 * Get size configuration for a specific widget ID
 */
export const getWidgetSize = (widgetId: string): WidgetSizeConfig | undefined => {
  const baseId = getWidgetBaseId(widgetId)
  return widgetSizes[baseId]
}
