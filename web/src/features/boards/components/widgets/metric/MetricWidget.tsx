import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BaseWidgetProps } from '@/features/boards/components/types'
import { BaseWidget } from '@/features/boards/components/widgets/base/BaseWidget'
import { WidgetMetric } from '@/features/boards/components/widgets/base/WidgetMetric'

interface MetricWidgetProps extends BaseWidgetProps {
  title: string
  value: string | number
  subtitle?: string | ReactNode
  subtitleKey?: string
  subtitleValue?: string
  subtitleParams?: Record<string, string | number>
  icon: LucideIcon
  iconBgColor: string
  iconColor: string
  valueColor?: string
}

export default function MetricWidget({
  title,
  value,
  subtitle,
  subtitleKey,
  subtitleValue,
  subtitleParams,
  icon,
  iconBgColor,
  iconColor,
  valueColor = 'text-neutral-900 dark:text-neutral-100',
}: MetricWidgetProps) {
  const { t } = useTranslation()

  // Determine subtitle content based on what props are provided
  const subtitleContent = subtitleKey && subtitleParams
    ? t(subtitleKey, subtitleParams)  // Interpolated translation (e.g., "{{profit}} of {{total}} profitable")
    : subtitleKey && subtitleValue
    ? `${t(subtitleKey)}: ${subtitleValue}`  // Label: Value format (e.g., "Fees: $123.45")
    : subtitle  // Plain text or ReactNode

  return (
    <BaseWidget
      title={title}
      icon={icon}
      iconColor={iconColor}
      iconBgColor={iconBgColor}
      description={typeof subtitleContent === 'string' ? subtitleContent : undefined}
      contentClassName="pf-card--content"
    >
      {typeof subtitleContent !== 'string' && subtitleContent}
      <WidgetMetric value={value} valueColor={valueColor} size="md" />
    </BaseWidget>
  )
}
