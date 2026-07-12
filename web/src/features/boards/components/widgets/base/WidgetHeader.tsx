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
  description,
  actions,
  subHeader,
}: WidgetHeaderProps) {
  const { t } = useTranslation()

  // Try to translate, fall back to original string
  const displayTitle = title.includes('.') ? t(title) : title
  const displayDescription = description && (description.includes('.') ? t(description) : description)

  return (
    <div className="pf-widget-header-shell">
      <div className="pf-widget-header">
        <div className="pf-widget-header__identity">
          <div className="pf-widget-icon">
            <Icon className="pf-widget-icon__glyph" size={17} />
          </div>
          <div className="pf-widget-header__copy">
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
