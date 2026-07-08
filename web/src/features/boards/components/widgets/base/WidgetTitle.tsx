import { ReactNode } from 'react'

interface WidgetTitleProps {
  children: ReactNode
  className?: string
}

/** Standardized widget header title */
export function WidgetTitle({ children, className = '' }: WidgetTitleProps) {
  return (
    <h3 className={`text-xs font-medium text-neutral-500 dark:text-neutral-400 truncate ${className}`.trim()}>
      {children}
    </h3>
  )
}
