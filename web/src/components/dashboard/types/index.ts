import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'
import { PositionDTO } from '@/lib/api'

/**
 * Base props that all widgets should accept
 */
export interface BaseWidgetProps {
  /** Preview mode - disables data fetching and shows sample data */
  isPreview?: boolean
  /** Error callback for widget-level error handling */
  onError?: (error: Error) => void
}

/**
 * Widget size configuration
 */
export interface WidgetSize {
  /** Width in grid columns */
  w: number
  /** Height in grid rows */
  h: number
  /** Minimum width in grid columns */
  minW?: number
  /** Minimum height in grid rows */
  minH?: number
  /** Maximum height in grid rows */
  maxH?: number
}

/**
 * Widget category types
 */
export type WidgetCategory = 'metrics' | 'data' | 'insights'

/**
 * Complete widget configuration for registry
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface WidgetConfig<TProps = any> {
  /** Unique widget identifier */
  id: string
  /** Display name for widget library */
  name: string
  /** Short description of widget functionality */
  description: string
  /** Widget category for grouping */
  category: WidgetCategory
  /** Lucide icon component */
  icon: LucideIcon
  /** Icon color class (text-*) */
  iconColor: string
  /** Icon background color class (bg-*) */
  iconBgColor: string
  /** Default grid size configuration */
  defaultSize: WidgetSize
  /** Allow multiple instances on dashboard */
  allowMultiple: boolean
  /** Widget component to render */
  component: React.ComponentType<TProps>
  /** Optional separate preview component (defaults to main component with isPreview=true) */
  previewComponent?: React.ComponentType<TProps>
  /** Props to pass to the component (can be dynamic based on context) */
  getProps?: (context: WidgetContext) => TProps
}

/**
 * Context available to widgets when rendering
 */
export interface WidgetContext {
  /** Unique widget instance ID (e.g., "total-value-2") */
  widgetId: string
  /** Base widget type (e.g., "total-value") */
  baseWidgetId: string
  /** Current portfolio metrics */
  metrics: DashboardMetrics | null
  /** Current positions */
  positions: PositionDTO[]
  /** Sold positions */
  soldPositions: PositionDTO[]
  /** Whether sold positions are loading */
  soldPositionsLoading: boolean
  /** Portfolio currency */
  portfolioCurrency: string
  /** Active portfolio ID */
  portfolioId?: number
  /** User ID */
  userId?: number
  /** Is widget in preview mode */
  isPreview?: boolean
  /** Batch data from useDashboardBatch (contains all widget data) */
  batchData?: unknown
}

/**
 * Dashboard metrics data structure
 */
export interface DashboardMetrics {
  total_value: number
  daily_change_value?: number | null
  daily_change_pct?: number | null
  total_unrealized_pnl: number
  total_unrealized_pnl_pct: number
  total_realized_pnl: number
  total_dividends: number
  total_fees: number
}

/**
 * Performance metrics for period-based widgets
 */
export interface PerformanceMetrics {
  weeklyReturn?: number
  monthlyReturn?: number
  ytdReturn?: number
}

/**
 * Props for base widget wrapper component
 */
export interface BaseWidgetWrapperProps {
  /** Widget title (can be translation key or string) */
  title: string
  /** Widget icon component */
  icon: LucideIcon
  /** Icon text color class */
  iconColor: string
  /** Icon background color class */
  iconBgColor: string
  /** Widget is currently loading */
  isLoading?: boolean
  /** Error that occurred during data fetching */
  error?: Error | null
  /** Data is empty (no items to display) */
  isEmpty?: boolean
  /** Message to show when empty (can be translation key) */
  emptyMessage?: string
  /** Icon to show in empty state */
  emptyIcon?: LucideIcon
  /** Optional action buttons in header */
  actions?: ReactNode
  /** Widget content */
  children: ReactNode
  /** Optional className for custom styling */
  className?: string
  /** Enable scroll in content area */
  scrollable?: boolean
}

/**
 * Category display configuration
 */
export interface CategoryConfig {
  id: WidgetCategory
  label: string
  description?: string
}
