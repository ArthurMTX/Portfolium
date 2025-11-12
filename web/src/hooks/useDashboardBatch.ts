import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

interface DashboardBatchData {
  data: {
    metrics?: {
      total_value: number
      daily_change_value?: number | null
      daily_change_pct?: number | null
      total_unrealized_pnl: number
      total_unrealized_pnl_pct: number
      total_realized_pnl: number
      total_dividends: number
      total_fees: number
    }
    positions?: unknown[]
    sold_positions?: unknown[]
    watchlist?: unknown[]
    notifications?: unknown[]
    transactions?: unknown[]
    market_tnx?: unknown
    market_dxy?: unknown
    market_vix?: unknown
    market_indices?: unknown
    sentiment_stock?: unknown
    sentiment_crypto?: unknown
    asset_allocation?: unknown
    sector_allocation?: unknown
    country_allocation?: unknown
    performance_history?: unknown
    risk_metrics?: unknown
    benchmark_comparison?: unknown
  }
  errors?: Record<string, string>
  cached: boolean
  timestamp: string
  widgets_requested: number
  data_fetched: number
  cache_age_seconds?: number
}

interface UseDashboardBatchOptions {
  portfolioId: number
  visibleWidgets: string[]
  includeSold?: boolean
  enabled?: boolean
}

/**
 * Custom hook for fetching dashboard data in a single batch request
 * 
 * This hook intelligently fetches only the data required for visible widgets,
 * dramatically reducing the number of network requests and improving performance.
 * 
 * @param options - Configuration options
 * @returns Query result with batched dashboard data
 * 
 * @example
 * ```tsx
 * const { data, isLoading } = useDashboardBatch({
 *   portfolioId: 123,
 *   visibleWidgets: ['total-value', 'watchlist', 'tnx-index'],
 * })
 * 
 * // Access individual data sections
 * const metrics = data?.data.metrics
 * const watchlist = data?.data.watchlist
 * ```
 */
export function useDashboardBatch({
  portfolioId,
  visibleWidgets,
  includeSold = false,
  enabled = true,
}: UseDashboardBatchOptions) {
  // Create a stable key from visible widgets
  const widgetKey = useMemo(() => {
    return visibleWidgets.sort().join(',')
  }, [visibleWidgets])

  return useQuery<DashboardBatchData>({
    queryKey: ['dashboard-batch', portfolioId, widgetKey, includeSold],
    queryFn: async () => {
      // Use /api prefix (same as ApiClient) to go through proxy
      const baseURL = '/api'
      const token = localStorage.getItem('auth_token')
      
      console.log('[useDashboardBatch] Fetching batch data:', {
        portfolioId,
        visibleWidgetsCount: visibleWidgets.length,
        visibleWidgets: visibleWidgets.slice(0, 5), // Log first 5 for debugging
        includeSold,
        hasToken: !!token
      })
      
      const response = await fetch(`${baseURL}/batch/dashboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          portfolio_id: portfolioId,
          visible_widgets: visibleWidgets,
          include_sold: includeSold,
        }),
      })
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
        console.error('[useDashboardBatch] Error response:', error)
        throw new Error(error.detail || `Failed to fetch dashboard batch`)
      }
      
      const data = await response.json() as DashboardBatchData
      console.log('[useDashboardBatch] Success:', {
        dataFetched: data.data_fetched,
        widgetsRequested: data.widgets_requested,
        cached: data.cached,
        hasMetrics: !!data.data.metrics,
        hasPositions: !!data.data.positions,
        hasWatchlist: !!data.data.watchlist,
      })
      
      return data
    },
    enabled: enabled && portfolioId > 0 && visibleWidgets.length > 0,
    staleTime: 60 * 1000, // 1 minute - matches backend cache
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Auto-refresh every minute
    retry: 2,
  })
}

/**
 * Helper hook to extract specific data from batch response
 * 
 * @example
 * ```tsx
 * const batchQuery = useDashboardBatch({...})
 * const metrics = useBatchData(batchQuery, 'metrics')
 * const watchlist = useBatchData(batchQuery, 'watchlist')
 * ```
 */
export function useBatchData<K extends keyof DashboardBatchData['data']>(
  batchQuery: ReturnType<typeof useDashboardBatch>,
  key: K
): DashboardBatchData['data'][K] | undefined {
  return batchQuery.data?.data[key]
}

/**
 * Helper to check if specific data has errors
 */
export function useBatchError(
  batchQuery: ReturnType<typeof useDashboardBatch>,
  key: string
): string | undefined {
  return batchQuery.data?.errors?.[key]
}

/**
 * Helper to get cache status
 */
export function useBatchCacheStatus(
  batchQuery: ReturnType<typeof useDashboardBatch>
): {
  cached: boolean
  ageSeconds?: number
  timestamp?: string
} {
  return {
    cached: batchQuery.data?.cached ?? false,
    ageSeconds: batchQuery.data?.cache_age_seconds,
    timestamp: batchQuery.data?.timestamp,
  }
}
