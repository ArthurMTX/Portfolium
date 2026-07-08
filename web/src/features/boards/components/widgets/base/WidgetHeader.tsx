import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { WidgetTitle } from '@/features/boards/components/widgets/base/WidgetTitle'
import { WidgetDescription } from '@/features/boards/components/widgets/base/WidgetDescription'
import { WidgetActions } from '@/features/boards/components/widgets/base/WidgetActions'

interface WidgetHeaderProps {
  title: string
  icon: LucideIcon
  iconColor: string
  iconBgColor: string
  description?: string
  actions?: ReactNode
  subHeader?: ReactNode
}

/**
 * Standardized widget header with icon, title, optional description,
 * optional right-aligned actions, and an optional sub-header row
 * (tabs, toggles) rendered beneath the title row.
 */
export function WidgetHeader({
  title,
  icon: Icon,
  iconColor,
  iconBgColor,
  description,
  actions,
  subHeader,
}: WidgetHeaderProps) {
  const { t } = useTranslation()

  // Try to translate, fall back to original string
  const displayTitle = title.includes('.') ? t(title) : title
  const displayDescription = description && (description.includes('.') ? t(description) : description)

  return (
    <div className="flex flex-col gap-1 flex-shrink-0">
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-9 h-9 ${iconBgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
            <Icon className={iconColor} size={18} />
          </div>
          <div className="min-w-0">
            <WidgetTitle>{displayTitle}</WidgetTitle>
            {displayDescription && <WidgetDescription>{displayDescription}</WidgetDescription>}
          </div>
        </div>
        {actions && <WidgetActions>{actions}</WidgetActions>}
      </div>
      {subHeader}
    </div>
  )
}
