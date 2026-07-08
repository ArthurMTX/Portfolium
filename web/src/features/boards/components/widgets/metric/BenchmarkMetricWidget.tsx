import { useMemo } from 'react'
import { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BaseWidgetProps } from '@/features/boards/components/types'
import { useBenchmarkComparison } from '@/features/boards/components/widgets/hooks/useRiskMetrics'
import { BaseWidget } from '@/features/boards/components/widgets/base/BaseWidget'
import { WidgetMetric } from '@/features/boards/components/widgets/base/WidgetMetric'

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
  batchData?: { benchmark_comparison?: unknown }
}

export default function BenchmarkMetricWidget({
  title,
  metricKey,
  icon,
  iconBgColor,
  iconColor,
  subtitle,
  benchmark = 'SPY',
  period = '1y',
  valueColor = 'text-neutral-900 dark:text-neutral-100',
  formatter,
  isPreview = false,
  batchData,
}: BenchmarkMetricWidgetProps) {
  const { t } = useTranslation()
  const { data, loading } = useBenchmarkComparison(benchmark, period, isPreview, batchData?.benchmark_comparison)

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
