import type { LucideIcon } from 'lucide-react'
import { BaseWidget } from '@/features/boards/components/widgets/base/BaseWidget'
import { WidgetMetric } from '@/features/boards/components/widgets/base/WidgetMetric'

interface MarketIndexCardProps {
  icon: LucideIcon
  iconColor: string
  iconBgColor: string
  title: string
  subtitle?: string
  loading: boolean
  value: string
  valueClass: string
  change: number | null
  changePositiveClass: string
  changeNegativeClass: string
  level: string
}

export default function MarketIndexCard({
  icon,
  iconColor,
  iconBgColor,
  title,
  subtitle,
  loading,
  value,
  valueClass,
  change,
  changePositiveClass,
  changeNegativeClass,
  level,
}: MarketIndexCardProps) {
  return (
    <BaseWidget
      title={title}
      icon={icon}
      iconColor={iconColor}
      iconBgColor={iconBgColor}
      description={subtitle}
      isLoading={loading}
      contentClassName="pf-card--content"
    >
      <WidgetMetric
        value={value}
        valueColor={valueClass}
        size="lg"
        change={change}
        changePositiveClass={changePositiveClass}
        changeNegativeClass={changeNegativeClass}
        secondaryLine={<p className="pf-widget-metric__secondary">{level}</p>}
      />
    </BaseWidget>
  )
}
