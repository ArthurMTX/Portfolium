import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

export interface DashboardBatchData {
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
    theme_allocation?: unknown
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
  stale?: boolean
}

export interface DashboardRefreshPending {
  data: Record<string, never>
  errors: null
  cached: false
  refreshing: true
  lock_ttl_seconds: number
  timestamp: string
  widgets_requested: number
  data_fetched: 0
}

export const DASHBOARD_BATCH_QUERY_RETRY = false
const DEFAULT_RETRY_AFTER_SECONDS = 5
const MAX_RETRY_AFTER_SECONDS = 10
const MAX_REFRESH_PENDING_RESPONSES = 12

type DashboardFetch = typeof fetch
type Delay = (milliseconds: number, signal?: AbortSignal) => Promise<void>

function isRefreshPending(value: unknown): value is DashboardRefreshPending {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<DashboardRefreshPending>
  return candidate.refreshing === true
    && candidate.cached === false
    && candidate.errors === null
    && candidate.data_fetched === 0
    && typeof candidate.lock_ttl_seconds === 'number'
    && typeof candidate.timestamp === 'string'
    && typeof candidate.widgets_requested === 'number'
    && Boolean(candidate.data && typeof candidate.data === 'object')
}

function isDashboardBatchData(value: unknown): value is DashboardBatchData {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<DashboardBatchData>
  return Boolean(candidate.data && typeof candidate.data === 'object')
    && typeof candidate.cached === 'boolean'
    && typeof candidate.timestamp === 'string'
    && typeof candidate.widgets_requested === 'number'
    && typeof candidate.data_fetched === 'number'
}

function retryAfterMilliseconds(response: Response): number {
  const parsed = Number(response.headers.get('Retry-After'))
  const seconds = Number.isFinite(parsed) && parsed >= 0
    ? Math.min(parsed, MAX_RETRY_AFTER_SECONDS)
    : DEFAULT_RETRY_AFTER_SECONDS
  return seconds * 1000
}

const wait: Delay = (milliseconds, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    return
  }
  const timeout = window.setTimeout(resolve, milliseconds)
  signal?.addEventListener('abort', () => {
    window.clearTimeout(timeout)
    reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
  }, { once: true })
})

export async function fetchDashboardBatchUntilReady({
  portfolioId,
  visibleWidgets,
  includeSold,
  signal,
  fetchImpl = fetch,
  delay = wait,
}: {
  portfolioId: number
  visibleWidgets: string[]
  includeSold: boolean
  signal?: AbortSignal
  fetchImpl?: DashboardFetch
  delay?: Delay
}): Promise<DashboardBatchData> {
  const token = localStorage.getItem('auth_token')

  for (let pendingCount = 0; pendingCount <= MAX_REFRESH_PENDING_RESPONSES; pendingCount += 1) {
    const response = await fetchImpl('/api/batch/dashboard', {
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
      signal,
    })
    const payload: unknown = await response.json().catch(() => null)

    if (response.status === 202) {
      if (!isRefreshPending(payload)) {
        throw new Error('Invalid dashboard refresh-pending response')
      }
      if (pendingCount === MAX_REFRESH_PENDING_RESPONSES) {
        throw new Error('Dashboard refresh did not complete within the bounded polling window')
      }
      await delay(retryAfterMilliseconds(response), signal)
      continue
    }

    if (!response.ok) {
      const detail = payload && typeof payload === 'object' && 'detail' in payload
        ? String(payload.detail)
        : 'Failed to fetch dashboard batch'
      throw new Error(detail)
    }
    if (!isDashboardBatchData(payload)) {
      throw new Error('Invalid completed dashboard response')
    }
    return payload
  }

  throw new Error('Dashboard refresh polling exhausted')
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
    return [...visibleWidgets].sort().join(',')
  }, [visibleWidgets])

  return useQuery<DashboardBatchData>({
    queryKey: ['dashboard-batch', portfolioId, widgetKey, includeSold],
    queryFn: ({ signal }) => fetchDashboardBatchUntilReady({
      portfolioId,
      visibleWidgets,
      includeSold,
      signal,
    }),
    enabled: enabled && portfolioId > 0 && visibleWidgets.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    // The dashboard contains historical analytics. Prices and counters have
    // dedicated lightweight queries; do not poll or retry this heavy POST.
    refetchInterval: false,
    retry: DASHBOARD_BATCH_QUERY_RETRY,
  })
}
