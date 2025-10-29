import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, PiggyBank, Zap, ZapOff, Clock, LayoutDashboard } from 'lucide-react'
import usePortfolioStore from '../store/usePortfolioStore'
import api, { PositionDTO } from '../lib/api'
import PositionsTable from '../components/PositionsTable'
import { usePriceUpdates } from '../hooks/usePriceUpdates'
import EmptyPortfolioPrompt from '../components/EmptyPortfolioPrompt'

type PositionsTab = 'current' | 'sold'

export default function Dashboard() {
  const {
    portfolios,
    activePortfolioId,
    positions,
    metrics,
    loading,
    setPortfolios,
    setActivePortfolio,
    setPositions,
    setMetrics,
    setLoading,
  } = usePortfolioStore()

  const [refreshing, setRefreshing] = useState(false)
  const [soldPositions, setSoldPositions] = useState<PositionDTO[]>([])
  const [soldPositionsLoading, setSoldPositionsLoading] = useState(false)
  const [soldPositionsLoaded, setSoldPositionsLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState<PositionsTab>('current')


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

  // Auto price updates hook
  const {
    isRefreshing: isAutoPriceRefreshing,
    isAutoRefreshEnabled,
    lastUpdate,
    error: priceError,
    refreshPrices,
    setAutoRefreshEnabled,
  } = usePriceUpdates({
    interval: autoRefreshSettings.interval,
    enabled: autoRefreshSettings.enabled,
    refreshOnFocus: true,
  });

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (activePortfolioId) {
      loadPortfolioData(activePortfolioId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePortfolioId])

  // Load sold positions when user switches to the sold tab
  useEffect(() => {
    if (activeTab === 'sold' && activePortfolioId && !soldPositionsLoaded) {
      loadSoldPositions(activePortfolioId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activePortfolioId])

  const loadData = async () => {
    try {
      const portfoliosData = await api.getPortfolios()
      setPortfolios(portfoliosData)
      if (portfoliosData.length > 0 && !activePortfolioId) {
        setActivePortfolio(portfoliosData[0].id)
      }
    } catch (error) {
      console.error('Failed to load portfolios:', error)
    }
  }

  const loadPortfolioData = async (portfolioId: number) => {
    setLoading(true)
    try {
      const [positionsData, metricsData] = await Promise.all([
        api.getPortfolioPositions(portfolioId),
        api.getPortfolioMetrics(portfolioId),
      ])
      setPositions(positionsData)
      setMetrics(metricsData)
      // Reset sold positions when switching portfolios
      setSoldPositions([])
      setSoldPositionsLoaded(false)
    } catch (error) {
      console.error('Failed to load portfolio data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSoldPositions = async (portfolioId: number) => {
    if (soldPositionsLoaded) return // Already loaded
    
    setSoldPositionsLoading(true)
    try {
      const soldPositionsData = await api.getSoldPositions(portfolioId)
      setSoldPositions(soldPositionsData)
      setSoldPositionsLoaded(true)
    } catch (error) {
      console.error('Failed to load sold positions:', error)
    } finally {
      setSoldPositionsLoading(false)
    }
  }

  const handleRefresh = async () => {
    if (!activePortfolioId) return
    setRefreshing(true)
    try {
      await refreshPrices()
    } catch (error) {
      console.error('Failed to refresh prices:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const formatLastUpdate = (timestamp: number) => {
    if (!timestamp) return 'Never'
    const secondsAgo = Math.floor((Date.now() - timestamp) / 1000)
    if (secondsAgo < 60) return `${secondsAgo}s ago`
    const minutesAgo = Math.floor(secondsAgo / 60)
    if (minutesAgo < 60) return `${minutesAgo}m ago`
    const hoursAgo = Math.floor(minutesAgo / 60)
    return `${hoursAgo}h ago`
  }

  const formatCurrency = (value: number | string) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(numValue)
  }

  const isAnyRefreshing = refreshing || isAutoPriceRefreshing;
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

  // Show empty portfolio prompt if no portfolios exist
  if (portfolios.length === 0) {
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
              Dashboard
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
              Loading your portfolio data...
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
            Dashboard
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
            Track your investments in real-time
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lastUpdate > 0 && (
            <div className="flex items-center gap-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              <Clock size={14} />
              {formatLastUpdate(lastUpdate)}
            </div>
          )}
          {marketStatus === 'premarket' && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
              ● Pre-Market
            </span>
          )}
          {marketStatus === 'open' && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full">
              ● Market Open
            </span>
          )}
          {marketStatus === 'afterhours' && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 rounded-full">
              ● After Hours
            </span>
          )}
          {marketStatus === 'closed' && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-full">
              ● Market Closed
            </span>
          )}
          {marketStatus === 'unknown' && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300 rounded-full">
              ● Status Unknown
            </span>
          )}
          <button
            onClick={() => setAutoRefreshEnabled(!isAutoRefreshEnabled)}
            className={`btn text-sm sm:text-base ${
              isAutoRefreshEnabled
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
            } flex items-center gap-2 px-3 py-2`}
            title={isAutoRefreshEnabled ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          >
            {isAutoRefreshEnabled ? <Zap size={16} /> : <ZapOff size={16} />}
            <span className="hidden sm:inline">Auto</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={isAnyRefreshing}
            className="btn-primary flex items-center gap-2 text-sm sm:text-base px-3 py-2"
          >
            <RefreshCw size={16} className={isAnyRefreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Price Error Alert */}
      {priceError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">
            <strong>Price Update Error:</strong> {priceError}
          </p>
        </div>
      )}

      {/* Portfolio Selector */}
      {portfolios.length > 0 && (
        <div className="card p-4">
          <label className="block text-sm font-medium mb-2">Active Portfolio</label>
          <select
            value={activePortfolioId ?? ''}
            onChange={(e) => setActivePortfolio(Number(e.target.value))}
            className="input w-full max-w-md"
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="card p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">Total Value</p>
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
                <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">Daily Gain</p>
                <p
                  className={`text-xl sm:text-2xl font-bold mt-1 truncate ${
                    metrics.daily_change_value && metrics.daily_change_value >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {metrics.daily_change_value !== null && metrics.daily_change_value !== undefined
                    ? formatCurrency(metrics.daily_change_value)
                    : 'N/A'}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {metrics.daily_change_pct !== null && metrics.daily_change_pct !== undefined
                    ? `${metrics.daily_change_pct >= 0 ? '+' : ''}${Number(metrics.daily_change_pct).toFixed(2)}%`
                    : 'No data'}
                </p>
              </div>
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                metrics.daily_change_value && metrics.daily_change_value >= 0
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : 'bg-red-100 dark:bg-red-900/30'
              }`}>
                {metrics.daily_change_value && metrics.daily_change_value >= 0 ? (
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
                <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">Unrealized P&L</p>
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
                <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">Realized P&L</p>
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
                <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">Dividends</p>
                <p className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1 truncate">
                  {formatCurrency(metrics.total_dividends)}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 truncate">
                  Fees: {formatCurrency(metrics.total_fees)}
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
            Current Positions (Unrealized P&L)
            {positions.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                {positions.length}
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
            Sold Positions (Realized P&L)
            {soldPositions.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                {soldPositions.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'current' ? (
          <PositionsTable positions={positions} />
        ) : soldPositionsLoading ? (
          <div className="card p-12 text-center">
            <div className="max-w-md mx-auto">
              <RefreshCw className="mx-auto h-12 w-12 text-pink-600 animate-spin mb-4" />
              <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                Loading sold positions...
              </h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Calculating realized P&L for your historical trades
              </p>
            </div>
          </div>
        ) : soldPositions.length > 0 ? (
          <PositionsTable positions={soldPositions} isSold={true} />
        ) : (
          <div className="card p-12 text-center">
            <div className="max-w-md mx-auto">
              <PiggyBank className="mx-auto h-12 w-12 text-neutral-400 dark:text-neutral-600 mb-4" />
              <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                No sold positions yet
              </h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                When you sell all shares of an asset, it will appear here with its realized P&L.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
