/**
 * Export all widget components and utilities from a single point
 * Organized by category for better code organization
 */

// Base components
export { BaseWidget } from './base/BaseWidget'
export { WidgetHeader } from './base/WidgetHeader'
export { WidgetLoader } from './base/WidgetLoader'
export { WidgetEmptyState } from './base/WidgetEmptyState'
export { WidgetError } from './base/WidgetError'
export { ViewAllButton } from './base/ViewAllButton'

// Types
export type {
  BaseWidgetProps,
  WidgetConfig,
  WidgetContext,
  WidgetCategory,
  WidgetSize,
  DashboardMetrics,
  PerformanceMetrics,
} from '../types'

// Registry
export {
  widgetRegistry,
  getWidget,
  getAllWidgets,
  getWidgetsByCategory,
  getWidgetsGroupedByCategory,
  hasWidget,
  searchWidgets,
} from './registry'

// Utilities
export {
  extractBaseWidgetId,
  generateWidgetInstanceId,
  isWidgetInstance,
  getWidgetInstances,
  formatCurrency,
  formatPercent,
  getValueColorClass,
  getValueBgClass,
} from '../utils/widgetUtils'

// Metric widgets
export { default as MetricWidget } from './metric/MetricWidget'
export { default as TotalReturnWidget } from './metric/TotalReturnWidget'
export { default as WinRateWidget } from './metric/WinRateWidget'

// List/Data widgets
export { default as NotificationsWidget } from './list/NotificationsWidget'
export { default as WatchlistWidget } from './list/WatchlistWidget'
export { default as PositionsTableWidget } from './list/PositionsTableWidget'
export { default as RecentTransactionsWidget } from './list/RecentTransactionsWidget'

// Analysis widgets
export { default as ConcentrationRiskWidget } from './analysis/ConcentrationRiskWidget'
export { default as BestWorstTodayWidget } from './analysis/BestWorstTodayWidget'
export { default as TopPerformersWidget } from './analysis/TopPerformersWidget'
export { default as WorstPerformersWidget } from './analysis/WorstPerformersWidget'
export { default as LargestHoldingsWidget } from './analysis/LargestHoldingsWidget'
export { default as PerformanceMetricsWidget } from './analysis/PerformanceMetricsWidget'

// Market widgets
export { default as MarketStatusWidget } from './market/MarketStatusWidget'
export { default as MarketIndicesWidget } from './market/MarketIndicesWidget'
