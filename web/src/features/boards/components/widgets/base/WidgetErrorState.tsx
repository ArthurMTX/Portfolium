import { useTranslation } from 'react-i18next'
import { StateBlock } from '@/shared/components/StatePrimitives'

interface WidgetErrorStateProps {
  error: Error
  retry?: () => void
}

/**
 * Standardized widget error state
 */
export function WidgetErrorState({ error, retry }: WidgetErrorStateProps) {
  const { t } = useTranslation()

  return (
    <StateBlock
      tone="error"
      eyebrow={t('common.error')}
      title={t('dashboard.widgets.dataLoadError')}
      detail={error.message}
      actionLabel={retry ? t('common.retry') : undefined}
      onAction={retry}
    />
  )
}
