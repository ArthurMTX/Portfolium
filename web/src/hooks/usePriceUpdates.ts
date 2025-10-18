/**
 * Hook for managing automatic price updates
 * Handles price refreshing with smart caching and error handling
 */
import { useState, useCallback } from 'react'
import { useAutoRefresh } from './useAutoRefresh'
import api from '../lib/api'
import usePortfolioStore from '../store/usePortfolioStore'

interface UsePriceUpdatesOptions {
  /**
   * Auto-refresh interval in milliseconds (default: 60000 = 1 minute)
   */
  interval?: number
  
  /**
   * Enable automatic price updates (default: false)
   */
  enabled?: boolean
  
  /**
   * Refresh when tab becomes visible (default: true)
   */
  refreshOnFocus?: boolean
}

/**
 * Hook for automatic price updates in the active portfolio
 * 
 * @example
 * ```tsx
 * const { 
 *   isRefreshing, 
 *   lastUpdate, 
 *   error, 
 *   refreshPrices,
 *   toggleAutoRefresh 
 * } = usePriceUpdates({ interval: 30000, enabled: true })
 * ```
 */
export function usePriceUpdates({
  interval = 60000, // 1 minute
  enabled = false,
  refreshOnFocus = true,
}: UsePriceUpdatesOptions = {}) {
  const [error, setError] = useState<string | null>(null)
  const [isManualRefreshing, setIsManualRefreshing] = useState(false)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(enabled)
  
  const { activePortfolioId, setPositions, setMetrics } = usePortfolioStore()

  /**
   * Fetch updated data for the active portfolio
   */
  const loadPortfolioData = useCallback(async (portfolioId: number) => {
    const [positionsData, metricsData] = await Promise.all([
      api.getPortfolioPositions(portfolioId),
      api.getPortfolioMetrics(portfolioId),
    ])
    setPositions(positionsData)
    setMetrics(metricsData)
  }, [setPositions, setMetrics])

  /**
   * Refresh prices and reload portfolio data
   */
  const refreshPricesAndData = useCallback(async () => {
    if (!activePortfolioId) {
      return
    }

    setError(null)
    
    try {
      // Refresh prices on backend
      await api.refreshPrices(activePortfolioId)
      
      // Reload portfolio data to get updated prices
      await loadPortfolioData(activePortfolioId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh prices'
      setError(errorMessage)
      console.error('Price refresh error:', err)
      throw err // Re-throw so auto-refresh can handle it
    }
  }, [activePortfolioId, loadPortfolioData])

  /**
   * Set up auto-refresh
   */
  const { isRefreshing: isAutoRefreshing, lastRefresh } = useAutoRefresh({
    onRefresh: refreshPricesAndData,
    interval,
    enabled: autoRefreshEnabled && !!activePortfolioId,
    refreshOnFocus,
    refreshOnMount: false, // Don't auto-refresh on mount
  })

  /**
   * Manual refresh with loading state
   */
  const manualRefresh = useCallback(async () => {
    if (!activePortfolioId) {
      return
    }

    setIsManualRefreshing(true)
    try {
      await refreshPricesAndData()
    } finally {
      setIsManualRefreshing(false)
    }
  }, [activePortfolioId, refreshPricesAndData])

  /**
   * Toggle auto-refresh on/off
   */
  const toggleAutoRefresh = useCallback(() => {
    setAutoRefreshEnabled(prev => !prev)
  }, [])

  return {
    // State
    isRefreshing: isAutoRefreshing || isManualRefreshing,
    isAutoRefreshEnabled: autoRefreshEnabled,
    lastUpdate: lastRefresh,
    error,
    
    // Actions
    refreshPrices: manualRefresh,
    toggleAutoRefresh,
    setAutoRefreshEnabled,
  }
}
