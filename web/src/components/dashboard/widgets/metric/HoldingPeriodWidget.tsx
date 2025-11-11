import { useMemo } from 'react'
import { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BaseWidgetProps } from '../../types'
import { useAverageHoldingPeriod } from '../hooks/useRiskMetrics'
import { formatHoldingPeriod } from '../utils/metricsCalculations'

interface HoldingPeriodWidgetProps extends BaseWidgetProps {
  title: string
  icon: LucideIcon
  iconBgColor: string
  iconColor: string
  subtitle?: string
  valueColor?: string
}

export default function HoldingPeriodWidget({
  title,
  icon: Icon,
  iconBgColor,
  iconColor,
  subtitle,
  valueColor = 'text-neutral-900 dark:text-neutral-100',
  isPreview = false,
}: HoldingPeriodWidgetProps) {
  const { t } = useTranslation()
  const { data, loading } = useAverageHoldingPeriod(isPreview)

  const value = useMemo(() => {
    // Use mock data in preview mode
    if (isPreview) {
      return formatHoldingPeriod(45)
    }

    if (data === null) {
      return 'N/A'
    }

    return formatHoldingPeriod(data)
  }, [data, isPreview])

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
              {subtitle}
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
