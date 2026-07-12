import { useMemo } from 'react'
import { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BaseWidgetProps } from '@/features/boards/components/types'
import { useRiskMetrics } from '@/features/boards/components/widgets/hooks/useRiskMetrics'
import { BaseWidget } from '@/features/boards/components/widgets/base/BaseWidget'
import { WidgetMetric } from '@/features/boards/components/widgets/base/WidgetMetric'

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
  batchData?: { risk_metrics?: unknown }
}

export default function RiskMetricWidget({
  title,
  metricKey,
  icon,
  iconBgColor,
  iconColor,
  subtitle,
  period = '1y',
  valueColor = 'text-neutral-900 dark:text-neutral-100',
  formatter,
  isPreview = false,
  batchData,
}: RiskMetricWidgetProps) {
  const { t } = useTranslation()
  const { data, loading } = useRiskMetrics(period, isPreview, batchData?.risk_metrics)

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
    <BaseWidget
      title={title}
      icon={icon}
      iconColor={iconColor}
      iconBgColor={iconBgColor}
      description={subtitle ? t(subtitle) : undefined}
      isLoading={loading}
      contentClassName="pf-card--content"
    >
      <WidgetMetric value={value} valueColor={valueColor} size="md" />
    </BaseWidget>
  )
}
