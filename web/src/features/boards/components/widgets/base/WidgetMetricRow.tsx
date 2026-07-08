import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'

type MetricRowTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

interface WidgetMetricRowProps {
  icon?: LucideIcon
  label: string
  value: ReactNode
  tone?: MetricRowTone
}

const TONE_STYLE: Record<MetricRowTone, { background: string; color?: string }> = {
  neutral: { background: 'var(--pf-inset)' },
  accent: { background: 'var(--pf-accent-soft)', color: 'var(--pf-accent)' },
  success: { background: 'var(--pf-success-soft)', color: 'var(--pf-success)' },
  warning: { background: 'var(--pf-warning-soft)', color: 'var(--pf-warning)' },
  danger: { background: 'var(--pf-danger-soft)', color: 'var(--pf-danger)' },
}

/**
 * A tinted label/value stat row, e.g. GoalTracker's Current/Goal/To-go rows.
 * `tone` maps to the shared soft-background token palette instead of
 * hardcoded Tailwind color-scale classes.
 */
export function WidgetMetricRow({ icon: Icon, label, value, tone = 'neutral' }: WidgetMetricRowProps) {
  const style = TONE_STYLE[tone]

  return (
    <div className="pf-widget-metric-row" style={{ background: style.background }}>
      <span className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
        {Icon && <Icon size={14} style={style.color ? { color: style.color } : undefined} />}
        {label}
      </span>
      <strong className="text-sm font-semibold" style={style.color ? { color: style.color } : undefined}>
        {value}
      </strong>
    </div>
  )
}
