/**
 * Hook for automatic data refreshing with configurable interval
 * Supports auto-refresh on visibility change and manual triggers
 */
import { useEffect, useRef, useCallback } from 'react'

interface UseAutoRefreshOptions {
  /**
   * Callback function to execute on each refresh
   */
  onRefresh: () => Promise<void> | void
  
  /**
   * Interval in milliseconds (default: 60000 = 1 minute)
   */
  interval?: number
  
  /**
   * Whether auto-refresh is enabled (default: true)
   */
  enabled?: boolean
  
  /**
   * Refresh when tab becomes visible (default: true)
   */
  refreshOnFocus?: boolean
  
  /**
   * Run refresh immediately on mount (default: true)
   */
  refreshOnMount?: boolean
}

/**
 * Hook that automatically refreshes data at specified intervals
 * 
 * @example
 * ```tsx
 * const { isRefreshing, refresh } = useAutoRefresh({
 *   onRefresh: async () => {
 *     await loadPrices()
 *   },
 *   interval: 30000, // 30 seconds
 *   enabled: true
 * })
 * ```
 */
export function useAutoRefresh({
  onRefresh,
  interval = 60000, // 1 minute default
  enabled = true,
  refreshOnFocus = true,
  refreshOnMount = true,
}: UseAutoRefreshOptions) {
  const isRefreshingRef = useRef(false)
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null)
  const lastRefreshRef = useRef<number>(0)

  const executeRefresh = useCallback(async () => {
    if (isRefreshingRef.current) {
      return // Already refreshing
    }

    isRefreshingRef.current = true
    try {
      await onRefresh()
      lastRefreshRef.current = Date.now()
    } catch (error) {
      console.error('Auto-refresh failed:', error)
    } finally {
      isRefreshingRef.current = false
    }
  }, [onRefresh])

  // Handle visibility change
  useEffect(() => {
    if (!enabled || !refreshOnFocus) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const timeSinceLastRefresh = Date.now() - lastRefreshRef.current
        
        // Only refresh if more than half the interval has passed
        if (timeSinceLastRefresh > interval / 2) {
          executeRefresh()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, refreshOnFocus, interval, executeRefresh])

  // Set up interval
  useEffect(() => {
    if (!enabled) {
      // Clear interval if disabled
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current)
        intervalIdRef.current = null
      }
      return
    }

    // Initial refresh on mount
    if (refreshOnMount) {
      executeRefresh()
    }

    // Set up periodic refresh
    intervalIdRef.current = setInterval(executeRefresh, interval)

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current)
        intervalIdRef.current = null
      }
    }
  }, [enabled, interval, executeRefresh, refreshOnMount])

  return {
    isRefreshing: isRefreshingRef.current,
    lastRefresh: lastRefreshRef.current,
    refresh: executeRefresh,
  }
}
