import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface WidgetHeaderProps {
  title: string
  icon: LucideIcon
  iconColor: string
  iconBgColor: string
  actions?: ReactNode
}

/**
 * Standardized widget header with icon and title
 */
export function WidgetHeader({
  title,
  icon: Icon,
  iconColor,
  iconBgColor,
  actions,
}: WidgetHeaderProps) {
  const { t } = useTranslation()
  
  // Try to translate, fall back to original string
  const displayTitle = title.includes('.') ? t(title) : title

  return (
    <div className="px-5 pt-5 pb-4 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`w-9 h-9 ${iconBgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <Icon className={iconColor} size={18} />
        </div>
        <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 truncate">
          {displayTitle}
        </h3>
      </div>
      {actions && <div className="flex-shrink-0">{actions}</div>}
    </div>
  )
}
