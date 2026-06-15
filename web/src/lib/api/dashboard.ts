import { request } from './client'
import type { DashboardLayoutCreate, DashboardLayoutDTO, DashboardLayoutExport, DashboardLayoutUpdate } from '../../types/dashboard'

// ============================================================================
// Dashboard Layouts
// ============================================================================

export async function getDashboardLayouts(portfolioId?: number) {
  const params = portfolioId ? `?portfolio_id=${portfolioId}` : ''
  return request<DashboardLayoutDTO[]>(`/dashboard-layouts/${params}`)
}

export async function getDefaultDashboardLayout(portfolioId?: number) {
  const params = portfolioId ? `?portfolio_id=${portfolioId}` : ''
  try {
    return await request<DashboardLayoutDTO>(`/dashboard-layouts/default${params}`)
  } catch (error) {
    // Return null if no default layout exists (404)
    return null
  }
}

export async function getDashboardLayout(layoutId: number) {
  return request<DashboardLayoutDTO>(`/dashboard-layouts/${layoutId}`)
}

export async function createDashboardLayout(layout: DashboardLayoutCreate) {
  return request<DashboardLayoutDTO>('/dashboard-layouts/', {
    method: 'POST',
    body: JSON.stringify(layout),
  })
}

export async function updateDashboardLayout(layoutId: number, update: DashboardLayoutUpdate) {
  return request<DashboardLayoutDTO>(`/dashboard-layouts/${layoutId}`, {
    method: 'PUT',
    body: JSON.stringify(update),
  })
}

export async function deleteDashboardLayout(layoutId: number) {
  return request<void>(`/dashboard-layouts/${layoutId}`, {
    method: 'DELETE',
  })
}

export async function duplicateDashboardLayout(layoutId: number, newName: string) {
  return request<DashboardLayoutDTO>(
    `/dashboard-layouts/${layoutId}/duplicate?new_name=${encodeURIComponent(newName)}`,
    { method: 'POST' }
  )
}

export async function exportDashboardLayout(layoutId: number) {
  return request<DashboardLayoutExport>(`/dashboard-layouts/${layoutId}/export`)
}

export async function importDashboardLayout(layout: DashboardLayoutExport, portfolioId?: number) {
  const params = portfolioId ? `?portfolio_id=${portfolioId}` : ''
  return request<DashboardLayoutDTO>(`/dashboard-layouts/import${params}`, {
    method: 'POST',
    body: JSON.stringify(layout),
  })
}
