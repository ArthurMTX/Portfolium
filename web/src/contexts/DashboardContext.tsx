import { createContext, useContext, ReactNode } from 'react'

interface DashboardContextValue {
  visibleWidgetIds: Set<string>
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

interface DashboardProviderProps {
  children: ReactNode
  visibleWidgetIds: Set<string>
}

export function DashboardProvider({ children, visibleWidgetIds }: DashboardProviderProps) {
  return (
    <DashboardContext.Provider value={{ visibleWidgetIds }}>
      {children}
    </DashboardContext.Provider>
  )
}

/**
 * Hook to check if a widget should load data.
 * Returns true if the widget is visible on the dashboard, false otherwise.
 * 
 * This allows widgets to conditionally enable/disable their data queries,
 * preventing unnecessary API calls when the widget is not displayed.
 * 
 * @param widgetIdPrefix - The widget ID prefix (e.g., 'market-indices', 'watchlist')
 * @returns boolean indicating if widget should load data
 * 
 * @example
 * ```tsx
 * function MyWidget() {
 *   const shouldLoad = useWidgetVisibility('my-widget')
 *   
 *   const { data } = useQuery({
 *     queryKey: ['my-data'],
 *     queryFn: fetchMyData,
 *     enabled: shouldLoad // Only fetch when widget is visible
 *   })
 * }
 * ```
 */
export function useWidgetVisibility(widgetIdPrefix: string): boolean {
  const context = useContext(DashboardContext)
  
  // If no context (e.g., widget used outside dashboard), always load
  if (!context) {
    return true
  }
  
  const { visibleWidgetIds } = context
  
  // Check if any widget with this prefix exists in the layout
  // This handles both single instances ('watchlist') and multiple instances ('watchlist-1', 'watchlist-2')
  return Array.from(visibleWidgetIds).some(id => 
    id === widgetIdPrefix || id.startsWith(`${widgetIdPrefix}-`)
  )
}

export default DashboardContext
