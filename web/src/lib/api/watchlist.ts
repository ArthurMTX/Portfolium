/* eslint-disable @typescript-eslint/no-explicit-any */
import { request, API_BASE_URL, getAuthHeaders } from './client'
import type { AssetThemeDTO } from './types'

// Watchlist Tags
export async function getWatchlistTags() {
  return request<Array<{
    id: number
    user_id: number
    name: string
    icon: string
    color: string
    created_at: string
    updated_at: string
  }>>('/watchlist/tags')
}

export async function createWatchlistTag(data: {
  name: string
  icon?: string
  color?: string
}) {
  return request<{
    id: number
    user_id: number
    name: string
    icon: string
    color: string
    created_at: string
    updated_at: string
  }>('/watchlist/tags', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateWatchlistTag(tagId: number, data: {
  name?: string
  icon?: string
  color?: string
}) {
  return request<{
    id: number
    user_id: number
    name: string
    icon: string
    color: string
    created_at: string
    updated_at: string
  }>(`/watchlist/tags/${tagId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteWatchlistTag(tagId: number) {
  return request<void>(`/watchlist/tags/${tagId}`, {
    method: 'DELETE',
  })
}

export async function updateWatchlistItemTags(itemId: number, tagIds: number[]) {
  return request<any>(`/watchlist/${itemId}/tags`, {
    method: 'PUT',
    body: JSON.stringify({ tag_ids: tagIds }),
  })
}

// Watchlist
export async function getWatchlist(tagIds?: number[], filterMode?: 'any' | 'all') {
  const params = new URLSearchParams()
  if (tagIds && tagIds.length > 0) {
    params.append('tag_ids', tagIds.join(','))
  }
  if (filterMode) {
    params.append('tag_mode', filterMode)
  }
  const queryString = params.toString() ? `?${params.toString()}` : ''
  return request<Array<{
    id: number
    user_id: number
    asset_id: number
    symbol: string
    name: string | null
    notes: string | null
    alert_target_price: number | string | null
    alert_enabled: boolean
    current_price: number | string | null
    daily_change_pct: number | string | null
    currency: string
    asset_type: string | null
    themes: AssetThemeDTO[]
    last_updated: string | null
    created_at: string
    tags: Array<{
      id: number
      user_id: number
      name: string
      icon: string
      color: string
      created_at: string
      updated_at: string
    }>
  }>>(`/watchlist${queryString}`)
}

export async function addToWatchlist(data: {
  symbol: string
  notes?: string
  alert_target_price?: number
  alert_enabled?: boolean
  tag_ids?: number[]
}) {
  const { symbol, ...rest } = data;
  const params = new URLSearchParams({ symbol });
  return request<{
    id: number
    user_id: number
    asset_id: number
    notes: string | null
    alert_target_price: number | string | null
    alert_enabled: boolean
    created_at: string
    updated_at: string
  }>(`/watchlist/by-symbol?${params.toString()}`, {
    method: 'POST',
    body: JSON.stringify(rest),
  });
}

export async function getWatchlistItemByAsset(assetId: number) {
  return request<{
    id: number
    user_id: number
    asset_id: number
    notes: string | null
    alert_target_price: number | string | null
    alert_enabled: boolean
    created_at: string
    updated_at: string
  } | null>(`/watchlist/by-asset/${assetId}`)
}

export async function updateWatchlistItem(itemId: number, data: {
  notes?: string | null
  alert_target_price?: number | null
  alert_enabled?: boolean
}) {
  return request<any>(`/watchlist/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteWatchlistItem(itemId: number) {
  return request<void>(`/watchlist/${itemId}`, {
    method: 'DELETE',
  })
}

export async function convertWatchlistToBuy(itemId: number, data: {
  portfolio_id: number
  quantity: number
  price: number
  fees?: number
  tx_date?: string
  currency?: string
}) {
  return request<{ success: boolean; transaction_id: number; message: string }>(
    `/watchlist/${itemId}/convert-to-buy`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  )
}

export async function importWatchlistCSV(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE_URL}/watchlist/import/csv`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(JSON.stringify(error))
  }

  return response.json()
}

export async function exportWatchlistCSV() {
  const response = await fetch(`${API_BASE_URL}/watchlist/export/csv`, {
    headers: {
      ...getAuthHeaders(),
    },
  })

  if (!response.ok) {
    throw new Error('Export failed')
  }

  return response.blob()
}

export async function refreshWatchlistPrices() {
  return request<{ refreshed_count: number }>(
    '/watchlist/refresh-prices',
    { method: 'POST' }
  )
}
