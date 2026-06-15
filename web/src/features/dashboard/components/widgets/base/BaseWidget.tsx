import { BaseWidgetWrapperProps } from '@/features/dashboard/components/types'
import { WidgetHeader } from '@/features/dashboard/components/widgets/base/WidgetHeader'
import { WidgetLoader } from '@/features/dashboard/components/widgets/base/WidgetLoader'
import { WidgetEmptyState } from '@/features/dashboard/components/widgets/base/WidgetEmptyState'
import { WidgetError } from '@/features/dashboard/components/widgets/base/WidgetError'

/**
 * Base widget wrapper component that provides consistent structure
 * for all dashboard widgets including loading, error, and empty states
 */
export function BaseWidget({
  title,
  icon,
  iconColor,
  iconBgColor,
  isLoading = false,
  error = null,
  isEmpty = false,
  emptyMessage,
  emptyIcon,
  actions,
  children,
  className = '',
  scrollable = true,
}: BaseWidgetWrapperProps) {
  return (
    <div className={`card h-full flex flex-col ${className}`}>
      <WidgetHeader
        title={title}
        icon={icon}
        iconColor={iconColor}
        iconBgColor={iconBgColor}
        actions={actions}
      />

      <div className={`flex-1 ${scrollable ? 'overflow-y-auto scrollbar-hide' : 'overflow-hidden'}`}>
        {isLoading && <WidgetLoader />}
        {error && <WidgetError error={error} />}
        {isEmpty && !isLoading && !error && (
          <WidgetEmptyState message={emptyMessage} icon={emptyIcon} />
        )}
        {!isLoading && !error && !isEmpty && children}
      </div>
    </div>
  )
}
