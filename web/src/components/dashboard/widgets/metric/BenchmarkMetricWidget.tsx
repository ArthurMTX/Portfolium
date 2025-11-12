import { useMemo } from 'react'
import { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BaseWidgetProps } from '../../types'
import { useBenchmarkComparison } from '../hooks/useRiskMetrics'

interface BenchmarkMetricWidgetProps extends BaseWidgetProps {
  title: string
  metricKey: 'alpha' | 'r_squared'
  icon: LucideIcon
  iconBgColor: string
  iconColor: string
  subtitle?: string
  benchmark?: string
  period?: string
  valueColor?: string
  formatter?: (value: number) => string
}

export default function BenchmarkMetricWidget({
  title,
  metricKey,
  icon: Icon,
  iconBgColor,
  iconColor,
  subtitle,
  benchmark = 'SPY',
  period = '1y',
  valueColor = 'text-neutral-900 dark:text-neutral-100',
  formatter,
  isPreview = false,
}: BenchmarkMetricWidgetProps) {
  const { t } = useTranslation()
  const { data, loading } = useBenchmarkComparison(benchmark, period, isPreview)

  const value = useMemo(() => {
    // Use mock data in preview mode
    if (isPreview) {
      const mockValues = {
        alpha: 2.3,
        r_squared: 85.4,
      }
      const mockValue = mockValues[metricKey]
      return formatter ? formatter(mockValue) : `${mockValue.toFixed(2)}%`
    }

    if (!data) {
      return 'N/A'
    }

    const metricValue = data[metricKey]
    
    if (metricValue === null || metricValue === undefined || typeof metricValue !== 'number') {
      return 'N/A'
    }
    
    return formatter ? formatter(metricValue) : `${metricValue.toFixed(2)}%`
  }, [data, metricKey, formatter, isPreview])

  return (
    <div className="card h-full flex flex-col p-5">
      <div className="flex items-start gap-2.5 mb-4">
        <div className={`w-9 h-9 ${iconBgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <Icon className={iconColor} size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t(title)}
          </h3>
          {subtitle && (
            <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 truncate">
              {t(subtitle)}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center -mt-2">
        {loading ? (
          <div className="flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-neutral-300 dark:border-neutral-600 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        ) : (
          <p className={`text-xl font-semibold break-words leading-tight ${valueColor}`}>
            {value}
          </p>
        )}
      </div>
    </div>
  )
}
