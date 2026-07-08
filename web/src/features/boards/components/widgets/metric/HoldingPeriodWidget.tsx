import { useMemo } from 'react'
import { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BaseWidgetProps } from '@/features/boards/components/types'
import { useAverageHoldingPeriod } from '@/features/boards/components/widgets/hooks/useRiskMetrics'
import { formatHoldingPeriod } from '@/features/boards/components/widgets/utils/metricsCalculations'
import { BaseWidget } from '@/features/boards/components/widgets/base/BaseWidget'
import { WidgetMetric } from '@/features/boards/components/widgets/base/WidgetMetric'

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
  icon,
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
