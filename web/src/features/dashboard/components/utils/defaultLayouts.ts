import { Layout } from 'react-grid-layout'
import { getWidgetSize } from '@/features/dashboard/components/utils/widgetConstraints'

// Desktop layout (cols: 12)
// Note: rowHeight is 50px, so h: 2 = 100px
const defaultLayout: Layout[] = [
  // Executive KPI stack: anchor value first, daily movement second, supporting KPIs secondary.
  { i: 'total-value', x: 0, y: 0, w: 4, h: 3, minW: 2, minH: 2 },
  { i: 'daily-gain', x: 4, y: 0, w: 4, h: 3, minW: 2, minH: 2 },
  { i: 'unrealized-pnl', x: 8, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
  { i: 'realized-pnl', x: 8, y: 2, w: 2, h: 2, minW: 2, minH: 2 },
  { i: 'dividends', x: 10, y: 2, w: 2, h: 2, minW: 2, minH: 2 },
  
  // Core portfolio table
  { i: 'positions', x: 0, y: 5, w: 12, h: 12, minW: 8, minH: 6 },

  // Allocation widgets
  { i: 'asset-allocation', x: 0, y: 17, w: 6, h: 8, minW: 3, minH: 6 },
  { i: 'theme-allocation', x: 6, y: 17, w: 6, h: 8, minW: 3, minH: 6 },
]

// Tablet layout (cols: 8)
const tabletLayout: Layout[] = [
  // Row 1: primary metrics
  { i: 'total-value', x: 0, y: 0, w: 4, h: 3, minW: 2, minH: 2 },
  { i: 'daily-gain', x: 4, y: 0, w: 4, h: 3, minW: 2, minH: 2 },
  
  // Row 2: supporting metrics
  { i: 'unrealized-pnl', x: 0, y: 4, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'realized-pnl', x: 3, y: 4, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'dividends', x: 6, y: 4, w: 2, h: 2, minW: 2, minH: 2 },
  
  // Core portfolio table
  { i: 'positions', x: 0, y: 7, w: 8, h: 12, minW: 6, minH: 6 },

  // Allocation widgets
  { i: 'asset-allocation', x: 0, y: 19, w: 8, h: 8, minW: 3, minH: 6 },
  { i: 'theme-allocation', x: 0, y: 27, w: 8, h: 8, minW: 3, minH: 6 },
]

// Mobile layout (cols: 4)
const mobileLayout: Layout[] = [
  // Stack everything vertically
  { i: 'total-value', x: 0, y: 0, w: 4, h: 3, minW: 4, minH: 2 },
  { i: 'daily-gain', x: 0, y: 4, w: 4, h: 3, minW: 4, minH: 2 },
  { i: 'unrealized-pnl', x: 0, y: 8, w: 4, h: 2, minW: 4, minH: 2 },
  { i: 'realized-pnl', x: 0, y: 11, w: 4, h: 2, minW: 4, minH: 2 },
  { i: 'dividends', x: 0, y: 14, w: 4, h: 2, minW: 4, minH: 2 },
  { i: 'positions', x: 0, y: 18, w: 4, h: 10, minW: 4, minH: 4 },
  { i: 'asset-allocation', x: 0, y: 28, w: 4, h: 8, minW: 4, minH: 6 },
  { i: 'theme-allocation', x: 0, y: 36, w: 4, h: 8, minW: 4, minH: 6 },
]

export const loadLayout = (breakpoint: 'lg' | 'md' | 'sm', userId?: number): Layout[] => {
  // Create a storage key based on user only (layouts are global across portfolios)
  let storageKey = `dashboard-layout-${breakpoint}`
  if (userId) {
    storageKey = `dashboard-layout-${userId}-${breakpoint}`
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

export const saveLayout = (layout: Layout[], breakpoint: 'lg' | 'md' | 'sm', userId?: number) => {
  // Create a storage key based on user only (layouts are global across portfolios)
  let storageKey = `dashboard-layout-${breakpoint}`
  if (userId) {
    storageKey = `dashboard-layout-${userId}-${breakpoint}`
  }
  
  localStorage.setItem(storageKey, JSON.stringify(layout))
}
