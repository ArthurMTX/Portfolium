import { LucideIcon, Inbox } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface WidgetEmptyStateProps {
  message?: string
  icon?: LucideIcon
}

/**
 * Standardized widget empty state
 */
export function WidgetEmptyState({ message, icon: Icon = Inbox }: WidgetEmptyStateProps) {
  const { t } = useTranslation()
  
  // Try to translate, fall back to original string
  const displayMessage = message 
    ? (message.includes('.') ? t(message) : message)
    : t('common.noData')

  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center text-neutral-500 dark:text-neutral-400">
        <Icon size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">{displayMessage}</p>
      </div>
    </div>
  )
}
