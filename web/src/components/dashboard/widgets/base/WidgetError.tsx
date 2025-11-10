import { AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <AlertCircle size={32} className="mx-auto mb-2 text-red-500 dark:text-red-400" />
        <p className="text-sm text-neutral-900 dark:text-neutral-100 font-medium mb-1">
          {t('common.error')}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
          {error.message}
        </p>
        {retry && (
          <button
            onClick={retry}
            className="text-xs text-fuchsia-600 dark:text-fuchsia-400 hover:underline"
          >
            {t('common.retry')}
          </button>
        )}
      </div>
    </div>
  )
}
