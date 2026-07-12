import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { WidgetLoadingState } from '@/features/boards/components/widgets/base/WidgetLoadingState'
import { WidgetEmptyState } from '@/features/boards/components/widgets/base/WidgetEmptyState'

interface WidgetChartFrameProps {
  isLoading?: boolean
  isEmpty?: boolean
  emptyMessage?: string
  /** 'flex' fills the remaining card height (default); a number sets a fixed px height. */
  height?: 'flex' | number
  /** Optional legend row rendered below the chart area */
  legend?: ReactNode
  /** The chart itself (chart.js element, custom SVG, CSS grid, ...) — frame-agnostic on purpose */
  children: ReactNode
  className?: string
}

/**
 * Owns loading/empty/sizing/legend chrome around a chart-bearing widget's
 * content. Does NOT render the chart itself, so both chart.js widgets and
 * manual-visualization widgets (e.g. a CSS-grid heatmap) fit the same frame.
 */
export function WidgetChartFrame({
  isLoading = false,
  isEmpty = false,
  emptyMessage,
  height = 'flex',
  legend,
  children,
  className = '',
}: WidgetChartFrameProps) {
  const { t } = useTranslation()

  const sizeStyle = height === 'flex' ? undefined : { height }
  const sizeClass = height === 'flex' ? 'flex-1 min-h-0' : ''

  if (isLoading) {
    return (
      <div className={`${sizeClass} ${className}`.trim()} style={sizeStyle}>
        <WidgetLoadingState variant="chart" />
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className={`${sizeClass} ${className}`.trim()} style={sizeStyle}>
        <WidgetEmptyState message={emptyMessage || t('common.noData')} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className={`${sizeClass} ${className}`.trim()} style={sizeStyle}>
        {children}
      </div>
      {legend && <div className="mt-3 flex-shrink-0">{legend}</div>}
    </div>
  )
}
