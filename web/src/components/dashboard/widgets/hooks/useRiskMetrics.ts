import { useState, useEffect } from 'react'
import api from '@/lib/api'
import usePortfolioStore from '@/store/usePortfolioStore'

interface RiskMetrics {
  period: string
  volatility: number
  sharpe_ratio: number | null
  max_drawdown: number
  max_drawdown_date: string | null
  beta: number | null
  var_95: number | null
  downside_deviation: number
}

// Cache for risk metrics to prevent multiple API calls
const riskMetricsCache: Map<string, { data: RiskMetrics | null; timestamp: number }> = new Map()
const pendingRiskRequests: Map<string, Promise<RiskMetrics>> = new Map()
const CACHE_DURATION = 60000 // 1 minute cache

/**
 * Shared hook for fetching risk metrics
 * Uses caching to prevent multiple API calls for the same portfolio/period
 */
export function useRiskMetrics(period: string = '1y', isPreview: boolean = false) {
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const [data, setData] = useState<RiskMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (isPreview || !activePortfolioId) {
      setData(null)
      setLoading(false)
      return
    }

    const cacheKey = `${activePortfolioId}-${period}`
    const now = Date.now()
    
    // Check cache first
    const cached = riskMetricsCache.get(cacheKey)
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      setData(cached.data)
      setLoading(false)
      return
    }

    const fetchRiskMetrics = async () => {
      setLoading(true)
      setError(null)
      
      try {
        // Check if there's already a pending request for this key
        let requestPromise = pendingRiskRequests.get(cacheKey)
        
        if (!requestPromise) {
          // Create new request
          requestPromise = api.getRiskMetrics(activePortfolioId, period)
          pendingRiskRequests.set(cacheKey, requestPromise)
        }
        
        const response = await requestPromise
        
        // Update cache
        riskMetricsCache.set(cacheKey, {
          data: response,
          timestamp: Date.now()
        })
        
        setData(response)
      } catch (err) {
        console.error('Failed to fetch risk metrics:', err)
        setError(err instanceof Error ? err : new Error('Failed to fetch risk metrics'))
        setData(null)
      } finally {
        setLoading(false)
        // Clean up pending request
        pendingRiskRequests.delete(cacheKey)
      }
    }

    fetchRiskMetrics()
  }, [activePortfolioId, period, isPreview])

  return { data, loading, error }
}

/**
 * Clear the risk metrics cache
 * Useful when you want to force a refresh
 */
export function clearRiskMetricsCache() {
  riskMetricsCache.clear()
}

// Benchmark comparison cache
interface BenchmarkData {
  alpha: number
  correlation: number
  r_squared: number
}
const benchmarkCache: Map<string, { data: BenchmarkData; timestamp: number }> = new Map()
const pendingBenchmarkRequests: Map<string, Promise<{ alpha: number; benchmark_return: number; benchmark_symbol: string; benchmark_name: string; period: string; portfolio_return: number; correlation: number | null }>> = new Map()

/**
 * Hook for fetching benchmark comparison (for Alpha and R-Squared)
 */
export function useBenchmarkComparison(benchmark: string = 'SPY', period: string = '1y', isPreview: boolean = false) {
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const [data, setData] = useState<{ alpha: number; correlation: number; r_squared: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (isPreview || !activePortfolioId) {
      setData(null)
      setLoading(false)
      return
    }

    const cacheKey = `${activePortfolioId}-${benchmark}-${period}`
    const now = Date.now()
    
    // Check cache first
    const cached = benchmarkCache.get(cacheKey)
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      setData(cached.data)
      setLoading(false)
      return
    }

    const fetchBenchmark = async () => {
      setLoading(true)
      setError(null)
      
      try {
        // Check if there's already a pending request for this key
        let requestPromise = pendingBenchmarkRequests.get(cacheKey)
        
        if (!requestPromise) {
          // Create new request
          requestPromise = api.getBenchmarkComparison(activePortfolioId, benchmark, period)
          pendingBenchmarkRequests.set(cacheKey, requestPromise)
        }
        
        const response = await requestPromise
        
        // Ensure alpha is a number (API returns Decimal which becomes string in JSON)
        const alpha = typeof response.alpha === 'number' ? response.alpha : Number(response.alpha)
        const correlation = response.correlation !== null 
          ? (typeof response.correlation === 'number' ? response.correlation : Number(response.correlation))
          : 0
        
        // R-squared is correlation squared
        const r_squared = correlation !== 0
          ? Math.pow(correlation, 2) * 100 
          : 0
        
        const result = {
          alpha: isNaN(alpha) ? 0 : alpha,
          correlation,
          r_squared
        }
        
        // Update cache
        benchmarkCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        })
        
        setData(result)
      } catch (err) {
        console.error('Failed to fetch benchmark comparison:', err)
        setError(err instanceof Error ? err : new Error('Failed to fetch benchmark'))
        setData(null)
      } finally {
        setLoading(false)
        // Clean up pending request
        pendingBenchmarkRequests.delete(cacheKey)
      }
    }

    fetchBenchmark()
  }, [activePortfolioId, benchmark, period, isPreview])

  return { data, loading, error }
}

// Average holding period cache
const holdingPeriodCache: Map<number, { data: number | null; timestamp: number }> = new Map()
const pendingHoldingPeriodRequests: Map<number, Promise<{ portfolio_id: number; average_holding_period_days: number | null }>> = new Map()

/**
 * Hook for fetching average holding period
 */
export function useAverageHoldingPeriod(isPreview: boolean = false) {
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const [data, setData] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (isPreview || !activePortfolioId) {
      setData(null)
      setLoading(false)
      return
    }

    const now = Date.now()
    
    // Check cache first
    const cached = holdingPeriodCache.get(activePortfolioId)
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      setData(cached.data)
      setLoading(false)
      return
    }

    const fetchHoldingPeriod = async () => {
      setLoading(true)
      setError(null)
      
      try {
        // Check if there's already a pending request
        let requestPromise = pendingHoldingPeriodRequests.get(activePortfolioId)
        
        if (!requestPromise) {
          // Create new request
          requestPromise = api.getAverageHoldingPeriod(activePortfolioId)
          pendingHoldingPeriodRequests.set(activePortfolioId, requestPromise)
        }
        
        const response = await requestPromise
        
        // Update cache
        holdingPeriodCache.set(activePortfolioId, {
          data: response.average_holding_period_days,
          timestamp: Date.now()
        })
        
        setData(response.average_holding_period_days)
      } catch (err) {
        console.error('Failed to fetch average holding period:', err)
        setError(err instanceof Error ? err : new Error('Failed to fetch holding period'))
        setData(null)
      } finally {
        setLoading(false)
        // Clean up pending request
        pendingHoldingPeriodRequests.delete(activePortfolioId)
      }
    }

    fetchHoldingPeriod()
  }, [activePortfolioId, isPreview])

  return { data, loading, error }
}
