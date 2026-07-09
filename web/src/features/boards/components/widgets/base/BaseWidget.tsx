import { BaseWidgetWrapperProps } from '@/features/boards/components/types'
import { WidgetHeader } from '@/features/boards/components/widgets/base/WidgetHeader'
import { WidgetLoadingState } from '@/features/boards/components/widgets/base/WidgetLoadingState'
import { WidgetEmptyState } from '@/features/boards/components/widgets/base/WidgetEmptyState'
import { WidgetErrorState } from '@/features/boards/components/widgets/base/WidgetErrorState'
import { WidgetFooter } from '@/features/boards/components/widgets/base/WidgetFooter'

/**
 * Base widget wrapper component that provides consistent structure
 * for all dashboard widgets including loading, error, and empty states
 */
export function BaseWidget({
  title,
  icon,
  iconColor,
  iconBgColor,
  description,
  isLoading = false,
  error = null,
  onRetry,
  isEmpty = false,
  emptyMessage,
  emptyDescription,
  emptyIconSlot,
  actions,
  subHeader,
  children,
  className = '',
  contentClassName = '',
  scrollable = true,
  footer,
}: BaseWidgetWrapperProps) {
  return (
    <div className={`card pf-widget-card ${className}`.trim()}>
      <WidgetHeader
        title={title}
        icon={icon}
        iconColor={iconColor}
        iconBgColor={iconBgColor}
        description={description}
        actions={actions}
        subHeader={subHeader}
      />

      <div
        className={`pf-widget-content ${scrollable ? 'pf-widget-content--scrollable scrollbar-hide' : 'pf-widget-content--clipped'} ${contentClassName}`.trim()}
      >
        {isLoading && <WidgetLoadingState />}
        {error && <WidgetErrorState error={error} retry={onRetry} />}
        {isEmpty && !isLoading && !error && (
          <WidgetEmptyState message={emptyMessage} description={emptyDescription} icon={emptyIconSlot} />
        )}
        {!isLoading && !error && !isEmpty && children}
      </div>

      {footer && <WidgetFooter>{footer}</WidgetFooter>}
    </div>
  )
}
