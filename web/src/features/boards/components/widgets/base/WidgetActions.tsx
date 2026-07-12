import { ReactNode } from 'react'

interface WidgetActionsProps {
  children: ReactNode
  className?: string
}

/** Right-aligned widget header action slot */
export function WidgetActions({ children, className = '' }: WidgetActionsProps) {
  return <div className={`pf-widget-actions ${className}`.trim()}>{children}</div>
}
