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
      eyebrow="No data"
      title={displayMessage}
      description="Data will appear here when enough portfolio activity is available."
    />
  )
}
