import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react'
import { BaseWidgetProps } from '../../types'

interface PerformanceMetricsWidgetProps extends BaseWidgetProps {
  metrics: {
    weeklyReturn?: number
    monthlyReturn?: number
    ytdReturn?: number
  }
}

export default function PerformanceMetricsWidget({ metrics, isPreview = false }: PerformanceMetricsWidgetProps) {
  // isPreview can be used for future optimizations
  const periods = [
    { label: '1 Week', value: metrics.weeklyReturn, key: 'week' },
    { label: '1 Month', value: metrics.monthlyReturn, key: 'month' },
    { label: 'YTD', value: metrics.ytdReturn, key: 'ytd' },
  ]

  return (
    <div className="card h-full flex flex-col p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <BarChart3 className="text-indigo-600 dark:text-indigo-400" size={18} />
        </div>
        <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          Performance
        </h3>
      </div>

      <div className="flex-1 flex flex-col justify-center -mt-2">
        <div className="grid grid-cols-1 gap-3">
          {periods.map((period) => {
            const value = period.value
            const isUndefined = value === undefined
            const isPositive = value !== undefined && value > 0
            const isNegative = value !== undefined && value < 0
            const isZero = value !== undefined && value === 0
            const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : BarChart3
            const colorClass = isUndefined || isZero
              ? 'text-neutral-500 dark:text-neutral-400'
              : isPositive
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'

            return (
              <div
                key={period.key}
                className="flex items-center justify-between p-3.5 bg-neutral-50 dark:bg-neutral-800/40 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${colorClass}`} />
                  <span className="text-sm text-neutral-600 dark:text-neutral-300">
                    {period.label}
                  </span>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${colorClass}`}>
                    {isUndefined ? 'N/A' : `${isPositive ? '+' : ''}${value.toFixed(2)}%`}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
