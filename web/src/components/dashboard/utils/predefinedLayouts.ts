/**
 * Predefined Dashboard Layouts
 * Ready-to-use layout templates that users can import
 * 
 * These layouts are automatically imported from JSON files.
 * This ensures a single source of truth and eliminates duplicate maintenance.
 * 
 * To add a new layout: Simply add a JSON file to src/assets/layouts/
 * No code changes needed - it will be automatically discovered!
 */

import { DashboardLayoutExport } from '@/types/dashboard'

// Automatically import all JSON layout files
const layoutModules = import.meta.glob('@/assets/layouts/*.json', { eager: true })

/**
 * Transform imported JSON layouts and add runtime metadata
 */
const createLayoutExport = (layout: DashboardLayoutExport): DashboardLayoutExport => ({
  ...layout,
  exported_at: new Date().toISOString(),
})

// Automatically build the layouts array from all imported files
export const PREDEFINED_LAYOUTS: DashboardLayoutExport[] = Object.values(layoutModules)
  .map((module) => createLayoutExport((module as { default: DashboardLayoutExport }).default))

/**
 * Get a predefined layout by name
 */
export const getPredefinedLayout = (name: string): DashboardLayoutExport | undefined => {
  return PREDEFINED_LAYOUTS.find(layout => layout.name === name)
}

/**
 * Get all predefined layout names
 */
export const getPredefinedLayoutNames = (): string[] => {
  return PREDEFINED_LAYOUTS.map(layout => layout.name)
}
