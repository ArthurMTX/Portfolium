/* eslint-disable react-refresh/only-export-components */
import { createContext, ReactNode, useContext } from 'react'

export type WidgetListVariant = 'divide' | 'cards' | 'compact'

const WidgetListVariantContext = createContext<WidgetListVariant>('divide')

export function useWidgetListVariant(): WidgetListVariant {
  return useContext(WidgetListVariantContext)
}

interface WidgetListProps {
  /**
   * divide  = hairline-divided rows (e.g. Watchlist)
   * cards   = tinted rounded rows (e.g. RecentTransactions, PerformerList)
   * compact = dense rounded-md rows (e.g. MarketIndices)
   */
  variant?: WidgetListVariant
  children: ReactNode
  className?: string
}

/**
 * Standardizes list-row density/style across widgets. Wrap `WidgetListItem`s
 * in this so every list widget shares one of three consistent row conventions
 * instead of each widget hand-rolling its own row markup.
 */
export function WidgetList({ variant = 'divide', children, className = '' }: WidgetListProps) {
  const wrapperClass = variant === 'divide' ? '' : 'flex flex-col gap-2 px-5 py-2'

  return (
    <WidgetListVariantContext.Provider value={variant}>
      <div className={`${wrapperClass} ${className}`.trim()}>{children}</div>
    </WidgetListVariantContext.Provider>
  )
}
