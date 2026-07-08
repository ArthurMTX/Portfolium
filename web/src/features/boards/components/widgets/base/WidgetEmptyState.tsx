import { useTranslation } from 'react-i18next'
import { StateBlock } from '@/shared/components/StatePrimitives'

interface WidgetEmptyStateProps {
  message?: string
  icon?: unknown
}

/**
 * Standardized widget empty state
 */
export function WidgetEmptyState({ message }: WidgetEmptyStateProps) {
  const { t } = useTranslation()
  
  // Try to translate, fall back to original string
  const displayMessage = message 
    ? (message.includes('.') ? t(message) : message)
    : t('common.noData')

  return (
    <StateBlock
      eyebrow={t('common.noData')}
      title={displayMessage}
      description={t('common.widgetEmptyStateDescription')}
    />
  )
}
