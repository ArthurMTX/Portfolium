import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BaseWidgetProps } from '../../types'

interface MetricWidgetProps extends BaseWidgetProps {
  title: string
  value: string | number
  subtitle?: string | ReactNode
  icon: LucideIcon
  iconBgColor: string
  iconColor: string
  valueColor?: string
}

export default function MetricWidget({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBgColor,
  iconColor,
  valueColor = 'text-neutral-900 dark:text-neutral-100',
  isPreview = false,
}: MetricWidgetProps) {
  const { t } = useTranslation()
  
  // isPreview can be used for future optimizations
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
        <p className={`text-xl font-semibold break-words leading-tight ${valueColor}`}>
          {value}
        </p>
      </div>
    </div>
  )
}
