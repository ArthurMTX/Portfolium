import { useTranslation } from 'react-i18next'
import { ListSkeleton } from '@/shared/components/StatePrimitives'

interface WidgetLoaderProps {
  message?: string
}

/**
 * Standardized widget loading state
 */
export function WidgetLoader({ message }: WidgetLoaderProps) {
  const { t } = useTranslation()
  const displayMessage = message || t('common.loading')

  return <ListSkeleton rows={3} label={displayMessage} />
}
