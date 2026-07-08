import { ReactNode } from 'react'

interface WidgetFooterProps {
  children: ReactNode
  className?: string
}

/** Persistent bottom strip below a widget's scrollable content */
export function WidgetFooter({ children, className = '' }: WidgetFooterProps) {
  return <div className={`pf-widget-footer ${className}`.trim()}>{children}</div>
}
