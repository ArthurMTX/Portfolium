import type { KeyboardEvent, ReactNode } from 'react'
import { useWidgetListVariant, WidgetListVariant } from '@/features/boards/components/widgets/base/WidgetList'

interface WidgetListItemProps {
  leading?: ReactNode
  /** Ignored when `children` is provided */
  title?: ReactNode
  /** Ignored when `children` is provided */
  subtitle?: ReactNode
  trailing?: ReactNode
  badge?: ReactNode
  onClick?: () => void
  isUnread?: boolean
  /** Escape hatch to override the parent WidgetList's variant for this one row */
  variant?: WidgetListVariant
  className?: string
  /**
   * Escape hatch for rows whose internals don't fit the title/subtitle shape
   * (e.g. a multi-line message plus an inline delete button). When provided,
   * this replaces the default title/subtitle block entirely; row-level chrome
   * (variant, unread background, click handling) is still shared.
   */
  children?: ReactNode
}

const VARIANT_CLASS: Record<WidgetListVariant, string> = {
  divide: 'pf-widget-list-item--divide',
  cards: 'pf-widget-list-item--cards',
  compact: 'pf-widget-list-item--compact',
}

export function WidgetListItem({
  leading,
  title,
  subtitle,
  trailing,
  badge,
  onClick,
  isUnread = false,
  variant: variantOverride,
  className = '',
  children,
}: WidgetListItemProps) {
  const contextVariant = useWidgetListVariant()
  const variant = variantOverride ?? contextVariant

  // A plain clickable div (not <button>) so rows can safely contain their own
  // interactive elements (e.g. a per-row delete button) without nesting buttons.
  const interactiveProps = onClick
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick,
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onClick()
          }
        },
      }
    : {}

  return (
    <div
      {...interactiveProps}
      className={`w-full flex items-center gap-3 text-left ${VARIANT_CLASS[variant]} ${
        isUnread ? 'pf-widget-list-item--unread' : ''
      } ${onClick ? 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors' : ''} ${className}`.trim()}
    >
      {leading && <div className="flex-shrink-0 flex items-center gap-3">{leading}</div>}
      {children ?? (
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{title}</div>
          {subtitle && <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{subtitle}</div>}
        </div>
      )}
      {badge && <div className="flex-shrink-0">{badge}</div>}
      {trailing && <div className="flex-shrink-0 text-right">{trailing}</div>}
    </div>
  )
}
