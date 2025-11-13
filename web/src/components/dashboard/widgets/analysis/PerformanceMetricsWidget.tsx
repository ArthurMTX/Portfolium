import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react'
import { BaseWidgetProps } from '../../types'
import usePortfolioStore from '@/store/usePortfolioStore'
import api, { PortfolioHistoryPointDTO } from '@/lib/api'
import { useTranslation } from 'react-i18next'

interface PerformanceMetricsWidgetProps extends BaseWidgetProps {
  batchData?: { performance_history?: unknown }
}

export default function PerformanceMetricsWidget({ isPreview = false, batchData }: PerformanceMetricsWidgetProps) {
  const { t } = useTranslation()
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const dataVersion = usePortfolioStore((state) => state.dataVersion)
  const [loading, setLoading] = useState(false)
  const [metrics, setMetrics] = useState<{
    weeklyReturn?: number
    monthlyReturn?: number
    ytdReturn?: number
  }>({})

  useEffect(() => {
    // Use mock data in preview mode
    if (isPreview) {
      setMetrics({
        weeklyReturn: 2.34,
        monthlyReturn: 5.67,
        ytdReturn: 17.16,
      })
      return
    }

    const calculatePeriodPerformance = (history: PortfolioHistoryPointDTO[]) => {
      if (history.length === 0) return undefined

      const firstPoint = history[0]
      const lastPoint = history[history.length - 1]

      // Calculate money-weighted return accounting for cash flows during the period
      const startValue = firstPoint.value
      const startInvested = firstPoint.invested || firstPoint.value
      const endValue = lastPoint.value
      const endInvested = lastPoint.invested || lastPoint.value

      // Calculate net capital change (deposits - withdrawals)
      const capitalChange = endInvested - startInvested

      // If no starting value, can't calculate return
      if (startValue <= 0) return undefined

      // Period return = (End Value - Start Value - Net Deposits) / Start Value * 100
      const valueChange = endValue - startValue - capitalChange
      return (valueChange / startValue) * 100
    }

    if (!activePortfolioId) return

    // Check if batch data is available (but always refetch when dataVersion changes)
    if (batchData?.performance_history) {
      const historyData = batchData.performance_history as Record<string, PortfolioHistoryPointDTO[]>
      setMetrics({
        weeklyReturn: historyData['1W'] ? calculatePeriodPerformance(historyData['1W']) : undefined,
        monthlyReturn: historyData['1M'] ? calculatePeriodPerformance(historyData['1M']) : undefined,
        ytdReturn: historyData['YTD'] ? calculatePeriodPerformance(historyData['YTD']) : undefined,
      })
      setLoading(false)
      return
    }

    const fetchMetrics = async () => {
      setLoading(true)
      try {
        // Fetch portfolio history for all three periods (same as the chart)
        const [weekData, monthData, ytdData] = await Promise.all([
          api.getPortfolioHistory(activePortfolioId, '1W'),
          api.getPortfolioHistory(activePortfolioId, '1M'),
          api.getPortfolioHistory(activePortfolioId, 'YTD'),
        ])

        setMetrics({
          weeklyReturn: calculatePeriodPerformance(weekData),
          monthlyReturn: calculatePeriodPerformance(monthData),
          ytdReturn: calculatePeriodPerformance(ytdData),
        })
      } catch (error) {
        console.error('Failed to fetch performance metrics:', error)
        // Set to undefined on error to show N/A
        setMetrics({})
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [activePortfolioId, isPreview, batchData, dataVersion])

  const periods = [
    { label: t('dashboard.widgets.performanceMetrics.weekly'), value: metrics.weeklyReturn, key: 'week' },
    { label: t('dashboard.widgets.performanceMetrics.monthly'), value: metrics.monthlyReturn, key: 'month' },
    { label: t('dashboard.widgets.performanceMetrics.ytd'), value: metrics.ytdReturn, key: 'ytd' },
  ]

  return (
    <div className="card h-full flex flex-col p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <BarChart3 className="text-indigo-600 dark:text-indigo-400" size={18} />
        </div>
        <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {t('dashboard.widgets.performanceMetrics.name')}
        </h3>
      </div>

      <div className="flex-1 flex flex-col justify-center -mt-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : (
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
        )}
      </div>
    </div>
  )
}
