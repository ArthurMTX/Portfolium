import { useTranslation } from 'react-i18next'
import { ChartSkeleton, ListSkeleton, MetricSkeletonStrip } from '@/shared/components/StatePrimitives'

interface WidgetLoadingStateProps {
  message?: string
  /** Selects the skeleton shape that best matches the widget's content. Default 'list'. */
  variant?: 'list' | 'chart' | 'metric'
  rows?: number
}

/**
 * Standardized widget loading state. Replaces hand-rolled spinners —
 * pick the `variant` that matches the widget's content shape.
 */
export function WidgetLoadingState({ message, variant = 'list', rows = 3 }: WidgetLoadingStateProps) {
  const { t } = useTranslation()
  const displayMessage = message || t('common.loading')

  if (variant === 'chart') {
    return <ChartSkeleton label={displayMessage} />
  }

  if (variant === 'metric') {
    return <MetricSkeletonStrip label={displayMessage} count={1} />
  }

  return <ListSkeleton rows={rows} label={displayMessage} />
}
