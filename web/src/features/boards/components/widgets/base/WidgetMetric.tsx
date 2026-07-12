import { ReactNode } from 'react'
import { WidgetLoadingState } from '@/features/boards/components/widgets/base/WidgetLoadingState'

interface WidgetMetricProps {
  value: string | number
  /** Tailwind text-* class for the value. Defaults to the standard ink color. */
  valueColor?: string
  /** 'md' matches the standard metric-card size, 'lg' matches market-index-card size. */
  size?: 'md' | 'lg'
  isLoading?: boolean
  align?: 'start' | 'center'
  /** Centers the value/change/secondary line horizontally too (default false = left-aligned) */
  centerText?: boolean
  /** Optional inline delta shown next to the value, e.g. market index % change */
  change?: number | null
  changeFormatter?: (change: number) => string
  changePositiveClass?: string
  changeNegativeClass?: string
  /** Optional secondary line under the value (e.g. MarketIndexCard's index level) */
  secondaryLine?: ReactNode
}

const SIZE_CLASSES: Record<NonNullable<WidgetMetricProps['size']>, string> = {
  md: 'pf-widget-metric__value--md',
  lg: 'pf-widget-metric__value--lg',
}

const defaultChangeFormatter = (change: number) => `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`

function metricToneClass(className?: string): string {
  if (!className) return ''
  if (/(rose|red)/.test(className)) return 'is-negative'
  if (/(emerald|green)/.test(className)) return 'is-positive'
  if (/(amber|orange|yellow)/.test(className)) return 'is-warning'
  if (/(blue|cyan|sky|indigo|purple|fuchsia)/.test(className)) return 'is-accent'
  return ''
}

/**
 * The single-big-number pattern shared by metric widgets and market index cards.
 */
export function WidgetMetric({
  value,
  valueColor = 'text-neutral-900 dark:text-neutral-100',
  size = 'md',
  isLoading = false,
  align = 'center',
  centerText = false,
  change,
  changeFormatter = defaultChangeFormatter,
  changePositiveClass = 'text-emerald-600 dark:text-emerald-400',
  changeNegativeClass = 'text-red-600 dark:text-red-400',
  secondaryLine,
}: WidgetMetricProps) {
  if (isLoading) {
    return <WidgetLoadingState variant="metric" />
  }

  return (
    <div className={`pf-widget-metric ${align === 'center' ? 'pf-widget-metric--center' : ''} ${centerText ? 'pf-widget-metric--text-center' : ''}`.trim()}>
      <div className="pf-widget-metric__line">
        <strong className={`pf-widget-metric__value ${SIZE_CLASSES[size]} ${metricToneClass(valueColor)}`.trim()}>
          {value}
        </strong>
        {change !== undefined && change !== null && (
          <span
            className={`pf-widget-metric__change ${metricToneClass(change >= 0 ? changePositiveClass : changeNegativeClass)}`.trim()}
          >
            {changeFormatter(change)}
          </span>
        )}
      </div>
      {secondaryLine}
    </div>
  )
}
