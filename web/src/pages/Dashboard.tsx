import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, PiggyBank, Zap, ZapOff, Clock, LayoutDashboard } from 'lucide-react'
import usePortfolioStore from '../store/usePortfolioStore'
import api, { PositionDTO, BatchPriceDTO } from '../lib/api'
import PositionsTable from '../components/PositionsTable'
import EmptyPortfolioPrompt from '../components/EmptyPortfolioPrompt'
import { formatCurrency as formatCurrencyUtil } from '../lib/formatUtils'
import LoadingSpinner from '../components/LoadingSpinner'
import { useTranslation } from 'react-i18next'

type PositionsTab = 'current' | 'sold'

export default function Dashboard() {
  const {
    portfolios,
    activePortfolioId,
    setPortfolios,
    setActivePortfolio,
  } = usePortfolioStore()

  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [soldPositionsLoaded, setSoldPositionsLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState<PositionsTab>('current')
  
  // Load last update from localStorage - use a ref to avoid reinitialization
  const [lastUpdate, setLastUpdate] = useState<number>(() => {
    const stored = localStorage.getItem('dashboardLastUpdate')
    const timestamp = stored ? parseInt(stored, 10) : 0
    return timestamp
  })
  
  // Force re-render for live countdown (only when this component is mounted)
  const [, forceUpdate] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Update every second only while component is mounted
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    
    let counter = 0
    // Start new timer
    timerRef.current = setInterval(() => {
      counter++
      forceUpdate(counter) // Force re-render to update "time ago" display
    }, 1000)
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps - only run on mount/unmount, lastUpdate changes don't need timer restart

  // Auto-refresh settings from localStorage
  const getAutoRefreshSettings = useCallback(() => {
    const intervalStr = localStorage.getItem('autoRefreshInterval') || '60';
    const enabledStr = localStorage.getItem('autoRefreshEnabled');
    return {
      interval: Math.max(5, parseInt(intervalStr, 10)) * 1000, // fallback to 60s, min 5s
      enabled: enabledStr === 'true',
    };
  }, []);

  const [autoRefreshSettings, setAutoRefreshSettings] = useState(getAutoRefreshSettings());

  // Listen for localStorage changes (cross-tab)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'autoRefreshInterval' || e.key === 'autoRefreshEnabled') {
        setAutoRefreshSettings(getAutoRefreshSettings());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [getAutoRefreshSettings]);

  // Also update settings if user changes them in this tab
  useEffect(() => {
    const id = setInterval(() => {
      setAutoRefreshSettings(getAutoRefreshSettings());
    }, 2000);
    return () => clearInterval(id);
  }, [getAutoRefreshSettings]);

  // Load portfolios list (rarely changes, long cache)
  const { data: portfoliosData } = useQuery({
    queryKey: ['portfolios'],
    queryFn: () => api.getPortfolios(),
    staleTime: 5 * 60 * 1000, // 5 minutes - portfolios don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes
  })

  // Sync portfolios to store when data changes
  useEffect(() => {
    if (portfoliosData) {
      setPortfolios(portfoliosData)
      if (portfoliosData.length > 0 && !activePortfolioId) {
        setActivePortfolio(portfoliosData[0].id)
      }
    }
  }, [portfoliosData, activePortfolioId, setPortfolios, setActivePortfolio])

  // Load positions (changes on transactions, medium cache)
  const { 
    data: positions, 
    isLoading: positionsLoading,
  } = useQuery({
    queryKey: ['positions', activePortfolioId],
    queryFn: () => api.getPortfolioPositions(activePortfolioId!),
    enabled: !!activePortfolioId,
    staleTime: 60 * 1000, // 1 minute - positions only change on transactions
    gcTime: 5 * 60 * 1000, // 5 minutes
  })

  // Load metrics (aggregated data, short cache for live feel)
  const { 
    data: metrics, 
    isLoading: metricsLoading,
  } = useQuery({
    queryKey: ['metrics', activePortfolioId],
    queryFn: () => api.getPortfolioMetrics(activePortfolioId!),
    enabled: !!activePortfolioId,
    staleTime: 10 * 1000, // 10 seconds - metrics include daily changes
    gcTime: 2 * 60 * 1000, // 2 minutes
  })

  // Load sold positions (lazy loaded when tab is opened)
  const { 
    data: soldPositions, 
    isLoading: soldPositionsLoading,
  } = useQuery<PositionDTO[]>({
    queryKey: ['soldPositions', activePortfolioId],
    queryFn: () => api.getSoldPositions(activePortfolioId!),
    enabled: !!activePortfolioId && activeTab === 'sold' && !soldPositionsLoaded,
    staleTime: 2 * 60 * 1000, // 2 minutes - sold positions don't change often
    gcTime: 10 * 60 * 1000, // 10 minutes
  })

  // Mark sold positions as loaded when data arrives
  useEffect(() => {
    if (soldPositions) {
      setSoldPositionsLoaded(true)
    }
  }, [soldPositions])

  // Batch price updates for auto-refresh (ultra-fast, no cache)
  const { 
    data: batchPrices,
    isRefetching: isPriceRefetching,
    error: priceError,
  } = useQuery({
    queryKey: ['batchPrices', activePortfolioId],
    queryFn: async () => {
      const data = await api.getBatchPrices(activePortfolioId!)
      const timestamp = Date.now()
      setLastUpdate(timestamp)
      localStorage.setItem('dashboardLastUpdate', timestamp.toString())
      return data
    },
    enabled: !!activePortfolioId && autoRefreshSettings.enabled,
    staleTime: 0, // Always fetch fresh prices
    gcTime: 30 * 1000, // Keep for 30s
    refetchInterval: autoRefreshSettings.enabled ? autoRefreshSettings.interval : false,
    refetchOnWindowFocus: true,
  })

  // Merge cached positions with live prices for display
  const displayPositions = useMemo(() => {
    if (!positions || !batchPrices?.prices) return positions || []

    return positions.map(pos => {
      const priceUpdate = batchPrices.prices.find((p: BatchPriceDTO) => p.asset_id === pos.asset_id)
      if (!priceUpdate) return pos

      // Calculate new market value with updated price
      const newMarketValue = priceUpdate.current_price 
        ? priceUpdate.current_price * pos.quantity 
        : pos.market_value

      // Recalculate unrealized P&L if we have market value
      const newUnrealizedPnl = newMarketValue !== null 
        ? newMarketValue - pos.cost_basis
        : pos.unrealized_pnl

      const newUnrealizedPnlPct = newUnrealizedPnl !== null && pos.cost_basis > 0
        ? (newUnrealizedPnl / pos.cost_basis) * 100
        : pos.unrealized_pnl_pct

      return {
        ...pos,
        current_price: priceUpdate.current_price ?? pos.current_price,
        market_value: newMarketValue,
        unrealized_pnl: newUnrealizedPnl,
        unrealized_pnl_pct: newUnrealizedPnlPct,
        daily_change_pct: priceUpdate.daily_change_pct ?? pos.daily_change_pct,
        last_updated: priceUpdate.last_updated ?? pos.last_updated,
      }
    })
  }, [positions, batchPrices])

  // Reset sold positions loaded flag when portfolio changes
  useEffect(() => {
    setSoldPositionsLoaded(false)
  }, [activePortfolioId])

  // Manual refresh function
  const handleRefresh = useCallback(async () => {
    if (!activePortfolioId) return
    
    // Invalidate all queries to force fresh data
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['positions', activePortfolioId] }),
      queryClient.invalidateQueries({ queryKey: ['metrics', activePortfolioId] }),
      queryClient.invalidateQueries({ queryKey: ['batchPrices', activePortfolioId] }),
    ])
    
    const timestamp = Date.now()
    setLastUpdate(timestamp)
    localStorage.setItem('dashboardLastUpdate', timestamp.toString())
  }, [activePortfolioId, queryClient])

  // Toggle auto-refresh
  const toggleAutoRefresh = useCallback(() => {
    const newEnabled = !autoRefreshSettings.enabled
    localStorage.setItem('autoRefreshEnabled', String(newEnabled))
    setAutoRefreshSettings(prev => ({ ...prev, enabled: newEnabled }))
  }, [autoRefreshSettings.enabled])

  const formatLastUpdate = (timestamp: number) => {
    if (!timestamp) return t('common.never')
    const now = Date.now()
    const secondsAgo = Math.floor((now - timestamp) / 1000)
    if (secondsAgo < 0) return t('common.timeAgo', { time: '0s' }) // Guard against negative values
    if (secondsAgo < 60) return t('common.timeAgo', { time: `${secondsAgo}s` })
    const minutesAgo = Math.floor(secondsAgo / 60)
    if (minutesAgo < 60) return t('common.timeAgo', { time: `${minutesAgo}m` })
    const hoursAgo = Math.floor(minutesAgo / 60)
    return t('common.timeAgo', { time: `${hoursAgo}h` })
  }

  const getNextRefreshIn = () => {
    if (!lastUpdate || !autoRefreshSettings.enabled) return null
    const now = Date.now()
    const elapsed = now - lastUpdate
    const remaining = autoRefreshSettings.interval - elapsed
    if (remaining <= 0) return null
    const seconds = Math.ceil(remaining / 1000)
    return seconds
  }

  // Note: Dashboard metrics are always in EUR, so we use a wrapper
  const formatCurrency = (value: number | string) => {
    return formatCurrencyUtil(value, 'EUR')
  }

  const loading = positionsLoading || metricsLoading
  const isRefreshing = isPriceRefetching
  const isAutoRefreshEnabled = autoRefreshSettings.enabled
  const [marketStatus, setMarketStatus] = useState<'premarket' | 'open' | 'afterhours' | 'closed' | 'unknown'>('unknown');

  useEffect(() => {
    const checkMarketStatus = async () => {
      try {
        const health = await api.healthCheck();
        setMarketStatus(health.market_status as 'premarket' | 'open' | 'afterhours' | 'closed');
      } catch {
        setMarketStatus('unknown');
      }
    };
    checkMarketStatus();
    // Refresh market status every 5 minutes
    const interval = setInterval(checkMarketStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const isAnyRefreshing = isRefreshing

  // Show empty portfolio prompt if no portfolios exist or no active portfolio
  if (portfolios.length === 0 || !activePortfolioId) {
    return <EmptyPortfolioPrompt pageType="dashboard" />
  }

  // Show loading skeleton for initial portfolio data load
  if (loading && !metrics) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <LayoutDashboard className="text-pink-600" size={28} />
              {t('dashboard.title')}
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
              {t('dashboard.loadingMessage')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-8 w-20 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse"></div>
            <div className="h-10 w-20 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse"></div>
            <div className="h-10 w-24 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse"></div>
          </div>
        </div>

        {/* Portfolio Selector Skeleton */}
        <div className="card p-4">
          <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-700 rounded mb-2 animate-pulse"></div>
          <div className="h-10 w-full max-w-md bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse"></div>
        </div>

        {/* Metrics Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card p-4 sm:p-6 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                  <div className="h-8 w-28 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                  <div className="h-3 w-20 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-neutral-200 dark:bg-neutral-700 rounded-full"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Positions Table Skeleton */}
        <div>
          <div className="flex items-center gap-4 mb-4 border-b border-neutral-200 dark:border-neutral-700">
            <div className="h-10 w-48 bg-neutral-200 dark:bg-neutral-700 rounded-t animate-pulse"></div>
            <div className="h-10 w-48 bg-neutral-200 dark:bg-neutral-700 rounded-t animate-pulse"></div>
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase">Asset</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase">Quantity</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase">Avg Cost</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase">Price</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase">Value</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase">P&L</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase">P&L %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                          <div className="space-y-2">
                            <div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                            <div className="h-3 w-24 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right"><div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <LayoutDashboard className="text-pink-600" size={28} />
            {t('dashboard.title')}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
            {t('dashboard.description')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {marketStatus === 'premarket' && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
              ● {t('market.status.premarket')}
            </span>
          )}
          {marketStatus === 'open' && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full">
              ● {t('market.status.open')}
            </span>
          )}
          {marketStatus === 'afterhours' && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 rounded-full">
              ● {t('market.status.afterhours')}
            </span>
          )}
          {marketStatus === 'closed' && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-full">
              ● {t('market.status.closed')}
            </span>
          )}
          {marketStatus === 'unknown' && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300 rounded-full">
              ● {t('market.status.unknown')}
            </span>
          )}
          {lastUpdate > 0 && (
            <div className="flex flex-col items-end gap-0.5 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                <Clock size={12} />
                <span className="font-medium">{formatLastUpdate(lastUpdate)}</span>
              </div>
              {autoRefreshSettings.enabled && getNextRefreshIn() !== null && getNextRefreshIn()! > 0 && (
                <div className="text-[10px] text-neutral-500 dark:text-neutral-500">
                  {t('common.next')}: {getNextRefreshIn()}s
                </div>
              )}
            </div>
          )}
          <button
            onClick={toggleAutoRefresh}
            className={`btn text-sm sm:text-base ${
              isAutoRefreshEnabled
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
            } flex items-center gap-2 px-3 py-2`}
            title={isAutoRefreshEnabled ? t('dashboard.autoRefreshOn') : t('dashboard.autoRefreshOff')}
          >
            {isAutoRefreshEnabled ? <Zap size={16} /> : <ZapOff size={16} />}
            <span className="hidden sm:inline">{t('common.auto')}</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={isAnyRefreshing}
            className="btn-primary flex items-center gap-2 text-sm sm:text-base px-3 py-2"
          >
            <RefreshCw size={16} className={isAnyRefreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{t('common.refresh')}</span>
          </button>
        </div>
      </div>

      {/* Price Error Alert */}
      {priceError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">
            <strong>{t('common.priceUpdateError')}:</strong> {priceError.message || String(priceError)}
          </p>
        </div>
      )}

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="card p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">{t('dashboard.totalValue')}</p>
                <p className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1 truncate">
                  {formatCurrency(metrics.total_value)}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <DollarSign className="text-pink-600 dark:text-pink-400" size={20} />
              </div>
            </div>
          </div>

          <div className="card p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">{t('dashboard.dailyGain')}</p>
                <p
                  className={`text-xl sm:text-2xl font-bold mt-1 truncate ${
                    metrics.daily_change_value && metrics.daily_change_value > 0
                      ? 'text-green-600 dark:text-green-400'
                      : metrics.daily_change_value && metrics.daily_change_value < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {metrics.daily_change_value !== null && metrics.daily_change_value !== undefined
                    ? formatCurrency(metrics.daily_change_value)
                    : 'N/A'}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {metrics.daily_change_pct !== null && metrics.daily_change_pct !== undefined
                    ? `${metrics.daily_change_pct > 0 ? '+' : metrics.daily_change_pct < 0 ? '' : '+'}${Number(metrics.daily_change_pct).toFixed(2)}%`
                    : 'No data'}
                </p>
              </div>
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                metrics.daily_change_value && metrics.daily_change_value > 0
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : metrics.daily_change_value && metrics.daily_change_value < 0
                  ? 'bg-red-100 dark:bg-red-900/30'
                  : 'bg-neutral-100 dark:bg-neutral-700'
              }`}>
                {metrics.daily_change_value && metrics.daily_change_value > 0 ? (
                  <TrendingUp className="text-green-600 dark:text-green-400" size={20} />
                ) : metrics.daily_change_value && metrics.daily_change_value < 0 ? (
                  <TrendingDown className="text-red-600 dark:text-red-400" size={20} />
                ) : (
                  <TrendingUp className="text-neutral-600 dark:text-neutral-400" size={20} />
                )}
              </div>
            </div>
          </div>

          <div className="card p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">{t('dashboard.unrealizedPnL')}</p>
                <p
                  className={`text-xl sm:text-2xl font-bold mt-1 truncate ${
                    metrics.total_unrealized_pnl >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {formatCurrency(metrics.total_unrealized_pnl)}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {metrics.total_unrealized_pnl_pct >= 0 ? '+' : ''}
                  {Number(metrics.total_unrealized_pnl_pct).toFixed(2)}%
                </p>
              </div>
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                metrics.total_unrealized_pnl >= 0
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : 'bg-red-100 dark:bg-red-900/30'
              }`}>
                {metrics.total_unrealized_pnl >= 0 ? (
                  <TrendingUp className="text-green-600 dark:text-green-400" size={20} />
                ) : (
                  <TrendingDown className="text-red-600 dark:text-red-400" size={20} />
                )}
              </div>
            </div>
          </div>

          <div className="card p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">{t('dashboard.realizedPnL')}</p>
                <p
                  className={`text-xl sm:text-2xl font-bold mt-1 truncate ${
                    metrics.total_realized_pnl >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {formatCurrency(metrics.total_realized_pnl)}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <PiggyBank className="text-blue-600 dark:text-blue-400" size={20} />
              </div>
            </div>
          </div>

          <div className="card p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">{t('dashboard.dividends')}</p>
                <p className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1 truncate">
                  {formatCurrency(metrics.total_dividends)}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 truncate">
                  {t('fields.fees')}: {formatCurrency(metrics.total_fees)}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <TrendingUp className="text-purple-600 dark:text-purple-400" size={20} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Positions Table */}
      <div>
        {/* Tab Navigation */}
        <div className="flex items-center gap-4 mb-4 border-b border-neutral-200 dark:border-neutral-700">
          <button
            onClick={() => setActiveTab('current')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'current'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            {t('dashboard.currentPositions')} ({t('dashboard.unrealizedPnL')})
            {displayPositions && displayPositions.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                {displayPositions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('sold')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'sold'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            {t('dashboard.soldPositions')} ({t('dashboard.realizedPnL')})
            {soldPositions && soldPositions.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                {soldPositions.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'current' ? (
          <PositionsTable positions={displayPositions || []} />
        ) : soldPositionsLoading ? (
          <div className="card p-12 text-center">
            <div className="max-w-md mx-auto">
              <LoadingSpinner size="lg" variant="icon" className="mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                {t('dashboard.loadingSoldPositions')}
              </h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {t('dashboard.calculatingRealizedPnL')}
              </p>
            </div>
          </div>
        ) : soldPositions && soldPositions.length > 0 ? (
          <PositionsTable positions={soldPositions} isSold={true} />
        ) : (
          <div className="card p-12 text-center">
            <div className="max-w-md mx-auto">
              <PiggyBank className="mx-auto h-12 w-12 text-neutral-400 dark:text-neutral-600 mb-4" />
              <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                {t('dashboard.noSoldPositions')}
              </h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {t('dashboard.soldPositionsInfo')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
