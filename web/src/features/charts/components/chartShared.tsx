import type { ReactNode } from 'react'
import { CHART_PERIOD_OPTIONS, getChartPeriodLabel } from '@/features/charts/components/chartUtils'
import type { ChartPeriodOption } from '@/features/charts/components/chartUtils'

export function ChartPeriodButtons({
  period,
  onChange,
  t,
}: {
  period: ChartPeriodOption
  onChange: (period: ChartPeriodOption) => void
  t: (key: string) => string
}) {
  return (
    <div className="charts__periods flex flex-wrap items-center gap-2">
      {CHART_PERIOD_OPTIONS.map(opt => (
        <button
          key={opt}
          type="button"
          className={`inline-flex h-9 min-w-10 items-center justify-center rounded-full border px-3 text-xs font-bold tracking-wide transition-colors ${
            period === opt
              ? 'is-active border-pink-500/50 bg-pink-500/10 text-pink-300'
              : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-pink-500/40 hover:bg-pink-500/5 hover:text-pink-300'
          }`}
          onClick={() => onChange(opt)}
        >
          {getChartPeriodLabel(opt, t)}
        </button>
      ))}
    </div>
  )
}

export function PortfolioChartSkeleton({
  metricWidthClass,
  children,
}: {
  metricWidthClass: string
  children: ReactNode
}) {
  return (
    <div className="charts__chart-skeleton">
      <div className="charts__chart-skeleton-header">
        <div />
        <div className={metricWidthClass} />
      </div>
      <div className="charts__chart-skeleton-plot">
        <div>
          <svg className="w-full h-full opacity-30" viewBox="0 0 100 50" preserveAspectRatio="none">
            {children}
          </svg>
        </div>
      </div>
    </div>
  )
}
