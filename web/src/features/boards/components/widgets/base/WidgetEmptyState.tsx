import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { StateBlock } from '@/shared/components/StatePrimitives'

interface WidgetEmptyStateProps {
  message?: string
  description?: string
  icon?: ReactNode
}

/**
 * Standardized widget empty state
 */
export function WidgetEmptyState({ message, description, icon }: WidgetEmptyStateProps) {
  const { t } = useTranslation()

  // Try to translate, fall back to original string
  const displayMessage = message
    ? (message.includes('.') ? t(message) : message)
    : t('common.noData')

  const displayDescription = description
    ? (description.includes('.') ? t(description) : description)
    : t('common.widgetEmptyStateDescription')

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      {icon && <div className="mb-2">{icon}</div>}
      <StateBlock
        eyebrow={t('common.noData')}
        title={displayMessage}
        description={displayDescription}
      />
    </div>
  )
}
