import { Layout } from 'react-grid-layout'
import { getWidgetSize } from './widgetConstraints'

export interface WidgetConfig {
  id: string
  type: 'metric' | 'positions' | 'notifications' | 'watchlist'
  title: string
  visible: boolean
}

export const defaultWidgets: WidgetConfig[] = [
  { id: 'total-value', type: 'metric', title: 'Total Value', visible: true },
  { id: 'daily-gain', type: 'metric', title: 'Daily Gain', visible: true },
  { id: 'unrealized-pnl', type: 'metric', title: 'Unrealized P&L', visible: true },
  { id: 'realized-pnl', type: 'metric', title: 'Realized P&L', visible: true },
  { id: 'dividends', type: 'metric', title: 'Dividends & Fees', visible: true },
  { id: 'notifications', type: 'notifications', title: 'Recent Notifications', visible: true },
  { id: 'watchlist', type: 'watchlist', title: 'Watchlist', visible: true },
  { id: 'positions', type: 'positions', title: 'Positions', visible: true },
]

// Desktop layout (cols: 12)
// Note: rowHeight is 50px, so h: 2 = 100px
export const defaultLayout: Layout[] = [
  // Row 1: Metric cards (5 widgets, ~2.4 cols each fits nicely in 12)
  { i: 'total-value', x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'daily-gain', x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'unrealized-pnl', x: 6, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
  { i: 'realized-pnl', x: 8, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
  { i: 'dividends', x: 10, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
  
  // Row 2: Positions table
  { i: 'positions', x: 0, y: 8, w: 12, h: 12, minW: 8, minH: 6 },
]

// Tablet layout (cols: 8)
export const tabletLayout: Layout[] = [
  // Row 1: 2 metrics
  { i: 'total-value', x: 0, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
  { i: 'daily-gain', x: 4, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
  
  // Row 2: 3 metrics
  { i: 'unrealized-pnl', x: 0, y: 3, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'realized-pnl', x: 3, y: 3, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'dividends', x: 6, y: 3, w: 2, h: 2, minW: 2, minH: 2 },
  
  // Row 3: Positions table
  { i: 'positions', x: 0, y: 10, w: 8, h: 12, minW: 6, minH: 6 },
]

// Mobile layout (cols: 4)
export const mobileLayout: Layout[] = [
  // Stack everything vertically
  { i: 'total-value', x: 0, y: 0, w: 4, h: 2, minW: 4, minH: 2 },
  { i: 'daily-gain', x: 0, y: 3, w: 4, h: 2, minW: 4, minH: 2 },
  { i: 'unrealized-pnl', x: 0, y: 6, w: 4, h: 2, minW: 4, minH: 2 },
  { i: 'realized-pnl', x: 0, y: 9, w: 4, h: 2, minW: 4, minH: 2 },
  { i: 'dividends', x: 0, y: 12, w: 4, h: 2, minW: 4, minH: 2 },
  { i: 'positions', x: 0, y: 20, w: 4, h: 10, minW: 4, minH: 4 },
]

export const loadLayout = (breakpoint: 'lg' | 'md' | 'sm', userId?: number, portfolioId?: number): Layout[] => {
  // Create a storage key based on user and portfolio (if available)
  let storageKey = `dashboard-layout-${breakpoint}`
  if (userId && portfolioId) {
    storageKey = `dashboard-layout-${userId}-${portfolioId}-${breakpoint}`
  }
  
  const saved = localStorage.getItem(storageKey)
  
  if (saved) {
    try {
      const layout = JSON.parse(saved)
      // Migration: Remove maxH constraints and enforce current widget constraints
      let needsMigration = false
      const migratedLayout = layout.map((item: Layout & { maxH?: number }) => {
        let updatedItem = { ...item }
        
        // Remove maxH if present
        if ('maxH' in updatedItem) {
          needsMigration = true
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { maxH, ...rest } = updatedItem
          updatedItem = rest
        }
        
        // Enforce current widget constraints
        const constraints = getWidgetSize(item.i)
        
        if (constraints) {
          const constraintsChanged = 
            (constraints.minW !== undefined && updatedItem.minW !== constraints.minW) ||
            (constraints.minH !== undefined && updatedItem.minH !== constraints.minH) ||
            (constraints.maxW !== undefined && updatedItem.maxW !== constraints.maxW) ||
            (constraints.maxH !== undefined && updatedItem.maxH !== constraints.maxH)
          
          if (constraintsChanged) {
            needsMigration = true
            updatedItem = {
              ...updatedItem,
              minW: constraints.minW,
              minH: constraints.minH,
              maxW: constraints.maxW,
              maxH: constraints.maxH,
            }
            
            // Ensure current dimensions respect new constraints
            if (constraints.minW !== undefined && updatedItem.w < constraints.minW) {
              updatedItem.w = constraints.minW
            }
            if (constraints.minH !== undefined && updatedItem.h < constraints.minH) {
              updatedItem.h = constraints.minH
            }
            if (constraints.maxW !== undefined && updatedItem.w > constraints.maxW) {
              updatedItem.w = constraints.maxW
            }
            if (constraints.maxH !== undefined && updatedItem.h > constraints.maxH) {
              updatedItem.h = constraints.maxH
            }
          }
        }
        
        return updatedItem
      })
      
      // Save the migrated layout back to localStorage if changes were made
      if (needsMigration) {
        localStorage.setItem(storageKey, JSON.stringify(migratedLayout))
      }
      return migratedLayout
    } catch {
      // If parsing fails, return default
    }
  }
  
  switch (breakpoint) {
    case 'lg':
      return defaultLayout
    case 'md':
      return tabletLayout
    case 'sm':
      return mobileLayout
    default:
      return defaultLayout
  }
}

export const saveLayout = (layout: Layout[], breakpoint: 'lg' | 'md' | 'sm', userId?: number, portfolioId?: number) => {
  // Create a storage key based on user and portfolio (if available)
  let storageKey = `dashboard-layout-${breakpoint}`
  if (userId && portfolioId) {
    storageKey = `dashboard-layout-${userId}-${portfolioId}-${breakpoint}`
  }
  
  localStorage.setItem(storageKey, JSON.stringify(layout))
}

export const resetLayout = (breakpoint: 'lg' | 'md' | 'sm', userId?: number, portfolioId?: number) => {
  // Create a storage key based on user and portfolio (if available)
  let storageKey = `dashboard-layout-${breakpoint}`
  if (userId && portfolioId) {
    storageKey = `dashboard-layout-${userId}-${portfolioId}-${breakpoint}`
  }
  
  localStorage.removeItem(storageKey)
}

export const loadWidgetVisibility = (): Record<string, boolean> => {
  const saved = localStorage.getItem('dashboard-widget-visibility')
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch {
      // If parsing fails, return default (all visible)
    }
  }
  
  // Default: all widgets visible
  return defaultWidgets.reduce((acc, widget) => {
    acc[widget.id] = widget.visible
    return acc
  }, {} as Record<string, boolean>)
}

export const saveWidgetVisibility = (visibility: Record<string, boolean>) => {
  localStorage.setItem('dashboard-widget-visibility', JSON.stringify(visibility))
}
