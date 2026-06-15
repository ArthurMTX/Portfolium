import { useTranslation } from 'react-i18next'

interface WidgetLoaderProps {
  message?: string
}

/**
 * Standardized widget loading state
 */
export function WidgetLoader({ message }: WidgetLoaderProps) {
  const { t } = useTranslation()
  const displayMessage = message || t('common.loading')

  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-fuchsia-600 dark:border-fuchsia-400 mb-2"></div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{displayMessage}</p>
      </div>
    </div>
  )
}
