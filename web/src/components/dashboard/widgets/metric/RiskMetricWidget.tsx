import { useMemo } from 'react'
import { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BaseWidgetProps } from '../../types'
import { useRiskMetrics } from '../hooks/useRiskMetrics'

interface RiskMetricWidgetProps extends BaseWidgetProps {
  title: string
  metricKey: 'volatility' | 'sharpe_ratio' | 'max_drawdown' | 'var_95' | 'downside_deviation' | 'beta'
  icon: LucideIcon
  iconBgColor: string
  iconColor: string
  subtitle?: string
  period?: string
  valueColor?: string
  formatter?: (value: number) => string
}

export default function RiskMetricWidget({
  title,
  metricKey,
  icon: Icon,
  iconBgColor,
  iconColor,
  subtitle,
  period = '1y',
  valueColor = 'text-neutral-900 dark:text-neutral-100',
  formatter,
  isPreview = false,
}: RiskMetricWidgetProps) {
  const { t } = useTranslation()
  const { data, loading } = useRiskMetrics(period, isPreview)

  const value = useMemo(() => {
    // Use mock data in preview mode
    if (isPreview) {
      const mockValues: Record<typeof metricKey, number> = {
        volatility: 18.5,
        sharpe_ratio: 1.42,
        max_drawdown: -12.3,
        var_95: -2.5,
        downside_deviation: 12.1,
        beta: 0.95,
      }
      const mockValue = mockValues[metricKey]
      return formatter ? formatter(mockValue) : `${mockValue.toFixed(2)}%`
    }

    if (!data) {
      return 'N/A'
    }

    const metricValue = data[metricKey]
    
    if (metricValue === null || metricValue === undefined) {
      return 'N/A'
    }
    
    const numValue = Number(metricValue)
    return formatter ? formatter(numValue) : `${numValue.toFixed(2)}%`
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
