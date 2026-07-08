import { ReactNode } from 'react'

interface WidgetDescriptionProps {
  children: ReactNode
  className?: string
}

/** Standardized secondary line under a widget title */
export function WidgetDescription({ children, className = '' }: WidgetDescriptionProps) {
  return (
    <p className={`text-xs text-neutral-400 dark:text-neutral-500 mt-1 truncate ${className}`.trim()}>
      {children}
    </p>
  )
}
