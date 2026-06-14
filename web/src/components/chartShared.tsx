import type { ReactNode } from 'react'
import { CHART_PERIOD_OPTIONS, getChartPeriodLabel } from './chartUtils'
import type { ChartPeriodOption } from './chartUtils'

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
    <div className="flex gap-2 mb-4 flex-wrap justify-center">
      {CHART_PERIOD_OPTIONS.map(opt => (
        <button
          key={opt}
          className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition shadow-sm ${
            period === opt
              ? 'bg-pink-600 text-white border-pink-600'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700 hover:bg-pink-50 dark:hover:bg-pink-900/30'
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
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="h-6 w-48 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse"></div>
        <div className={`h-8 ${metricWidthClass} bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse`}></div>
      </div>
      <div style={{ height: '320px' }} className="relative">
        <div className="absolute inset-0 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse overflow-hidden">
          <svg className="w-full h-full opacity-30" viewBox="0 0 100 50" preserveAspectRatio="none">
            {children}
          </svg>
        </div>
      </div>
    </div>
  )
}
