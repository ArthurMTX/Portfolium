import { ReactNode } from 'react'

interface WidgetActionsProps {
  children: ReactNode
  className?: string
}

/** Right-aligned widget header action slot */
export function WidgetActions({ children, className = '' }: WidgetActionsProps) {
  return <div className={`flex-shrink-0 flex items-center gap-2 ${className}`.trim()}>{children}</div>
}
