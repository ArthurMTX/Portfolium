import { ReactNode } from 'react'

interface WidgetDescriptionProps {
  children: ReactNode
  className?: string
}

/** Standardized secondary line under a widget title */
export function WidgetDescription({ children, className = '' }: WidgetDescriptionProps) {
  return (
    <p className={`pf-widget-description ${className}`.trim()}>
      {children}
    </p>
  )
}
