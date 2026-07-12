import { ReactNode } from 'react'

interface WidgetTitleProps {
  children: ReactNode
  className?: string
}

/** Standardized widget header title */
export function WidgetTitle({ children, className = '' }: WidgetTitleProps) {
  return (
    <h3 className={`pf-widget-title ${className}`.trim()}>
      {children}
    </h3>
  )
}
