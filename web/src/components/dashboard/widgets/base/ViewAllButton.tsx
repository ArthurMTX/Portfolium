import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ViewAllButtonProps {
  to?: string
  onClick?: () => void
  label?: string
}

/**
 * Reusable "View All" button for widgets
 */
export function ViewAllButton({ onClick, label }: ViewAllButtonProps) {
  const { t } = useTranslation()
  
  return (
    <button
      onClick={onClick}
      className="text-xs text-fuchsia-600 dark:text-fuchsia-400 hover:underline flex items-center gap-1"
    >
      {label || t('common.viewAll')}
      <ExternalLink size={12} />
    </button>
  )
}
