import { useEffect, useState } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, PiggyBank, Zap, ZapOff, Clock, LayoutDashboard } from 'lucide-react'
import usePortfolioStore from '../store/usePortfolioStore'
import api from '../lib/api'
import PositionsTable from '../components/PositionsTable'
import { usePriceUpdates } from '../hooks/usePriceUpdates'

export default function Dashboard() {
  const {
    portfolios,
    activePortfolioId,
    positions,
    metrics,
    setPortfolios,
    setActivePortfolio,
    setPositions,
    setMetrics,
    setLoading,
  } = usePortfolioStore()

  const [refreshing, setRefreshing] = useState(false)

  // Auto price updates hook
  const {
    isRefreshing: isAutoPriceRefreshing,
    isAutoRefreshEnabled,
    lastUpdate,
    error: priceError,
    refreshPrices,
    toggleAutoRefresh,
  } = usePriceUpdates({
    interval: 60000, // 1 minute
    enabled: false, // Disabled by default, user can toggle
    refreshOnFocus: true,
  })

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
    } catch (error) {
      console.error('Failed to load portfolio data:', error)
    } finally {
      setLoading(false)
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
  const [marketStatus, setMarketStatus] = useState<'open' | 'closed' | 'unknown'>('unknown');

  useEffect(() => {
    const checkMarketStatus = async () => {
      try {
        const health = await api.healthCheck();
        // Assume backend returns status: 'open' | 'closed' (adjust if needed)
        setMarketStatus(health.status === 'open' ? 'open' : 'closed');
      } catch {
        setMarketStatus('unknown');
      }
    };
    checkMarketStatus();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <LayoutDashboard className="text-pink-600" size={32} />
            Dashboard
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            Track your investments in real-time
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate > 0 && (
            <div className="flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400">
              <Clock size={14} />
              {formatLastUpdate(lastUpdate)}
            </div>
          )}
          {marketStatus === 'open' && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded-full">
              ● Market Open
            </span>
          )}
          {marketStatus === 'closed' && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-red-100 text-red-700 rounded-full">
              ● Market Closed
            </span>
          )}
          {marketStatus === 'unknown' && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-700 rounded-full">
              ● Market Status Unknown
            </span>
          )}
          <button
            onClick={toggleAutoRefresh}
            className={`btn ${
              isAutoRefreshEnabled
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
            } flex items-center gap-2`}
            title={isAutoRefreshEnabled ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          >
            {isAutoRefreshEnabled ? <Zap size={18} /> : <ZapOff size={18} />}
            Auto
          </button>
          <button
            onClick={handleRefresh}
            disabled={isAnyRefreshing}
            className="btn-primary flex items-center gap-2"
          >
            <RefreshCw size={18} className={isAnyRefreshing ? 'animate-spin' : ''} />
            Refresh
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Total Value</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
                  {formatCurrency(metrics.total_value)}
                </p>
              </div>
              <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center">
                <DollarSign className="text-pink-600 dark:text-pink-400" size={24} />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Unrealized P&L</p>
                <p
                  className={`text-2xl font-bold mt-1 ${
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
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                metrics.total_unrealized_pnl >= 0
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : 'bg-red-100 dark:bg-red-900/30'
              }`}>
                {metrics.total_unrealized_pnl >= 0 ? (
                  <TrendingUp className="text-green-600 dark:text-green-400" size={24} />
                ) : (
                  <TrendingDown className="text-red-600 dark:text-red-400" size={24} />
                )}
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Realized P&L</p>
                <p
                  className={`text-2xl font-bold mt-1 ${
                    metrics.total_realized_pnl >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {formatCurrency(metrics.total_realized_pnl)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <PiggyBank className="text-blue-600 dark:text-blue-400" size={24} />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Dividends</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
                  {formatCurrency(metrics.total_dividends)}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Fees: {formatCurrency(metrics.total_fees)}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                <TrendingUp className="text-purple-600 dark:text-purple-400" size={24} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Positions Table */}
      <div>
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
          Current Positions
        </h2>
        <PositionsTable positions={positions} />
      </div>
    </div>
  )
}
