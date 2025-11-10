/**
 * Dashboard Layout Types
 * Aligns with backend schemas and react-grid-layout
 */

import { Layout } from 'react-grid-layout'

export interface LayoutConfig {
  lg: Layout[]
  md: Layout[]
  sm: Layout[]
}

export interface DashboardLayoutDTO {
  id: number
  user_id: number
  portfolio_id: number | null
  name: string
  description: string | null
  is_default: boolean
  is_shared: boolean
  layout_config: LayoutConfig
  created_at: string
  updated_at: string
}

export interface DashboardLayoutCreate {
  name: string
  description?: string | null
  portfolio_id?: number | null
  is_default?: boolean
  is_shared?: boolean
  layout_config: LayoutConfig
}

export interface DashboardLayoutUpdate {
  name?: string
  description?: string | null
  is_default?: boolean
  is_shared?: boolean
  layout_config?: LayoutConfig
}

export interface DashboardLayoutExport {
  name: string
  description?: string | null
  layout_config: LayoutConfig
  version: string
  exported_at: string
}
