import { useTranslation } from 'react-i18next'
import { StateBlock } from '@/shared/components/StatePrimitives'

interface WidgetErrorProps {
  error: Error
  retry?: () => void
}

/**
 * Standardized widget error state
 */
export function WidgetError({ error, retry }: WidgetErrorProps) {
  const { t } = useTranslation()

  return (
    <StateBlock
      tone="error"
      eyebrow={t('common.error')}
      title="Widget data could not load."
      detail={error.message}
      actionLabel={retry ? t('common.retry') : undefined}
      onAction={retry}
    />
  )
}
