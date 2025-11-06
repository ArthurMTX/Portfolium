import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X, Database, TrendingUp, Calendar, DollarSign, Tag, Globe, Building2, BarChart3, AlertCircle, RefreshCw, Zap, Code, Activity } from 'lucide-react'
import api from '../lib/api'
import { getAssetLogoUrl, handleLogoError, validateLogoImage } from '../lib/logoUtils'

interface TickerInfo {
  symbol: string
  name: string
}

interface AssetDetails {
  // Basic info
  id: number
  symbol: string
  name: string | null
  currency: string
  class: string | null
  asset_type: string | null
  
  // Metadata
  sector: string | null
  industry: string | null
  country: string | null
  
  // Effective metadata (with user overrides)
  effective_sector: string | null
  effective_industry: string | null
  effective_country: string | null
  
  // Timestamps
  created_at: string
  updated_at: string
  first_transaction_date: string | null
  
  // Logo
  logo_fetched_at: string | null
  logo_content_type: string | null
}

interface TransactionInfo {
  id: number
  tx_date: string
  type: string
  quantity: number
  adjusted_quantity: number
  price: number | null
  fees: number | null
  portfolio_name: string
  notes: string | null
}

interface SplitInfo {
  id: number
  tx_date: string
  metadata: { split?: string }
  notes: string | null
}

interface PriceDataPoint {
  date: string
  price: number
  volume: number | null
  source: string
}

interface PriceHistory {
  asset_id: number
  symbol: string
  name: string | null
  currency: string
  period: string
  start_date: string
  end_date: string
  data_points: number
  prices: PriceDataPoint[]
}

interface HealthInfo {
  asset_id: number
  symbol: string
  name: string | null
  status: string
  total_price_records: number
  first_transaction_date: string | null
  first_transaction_actual: string | null
  data_range: {
    start: string
    end: string
    days: number
  } | null
  coverage: {
    expected_trading_days: number
    actual_data_points: number
    coverage_pct: number
    missing_days: number
    gap_count: number
  }
  sources: Record<string, number>
  gaps: string[] | { total: number; sample: string[]; message: string }
  recommendations: string[]
}

interface YFinanceData {
  asset_id: number | null
  symbol: string
  name: string | null
  in_database?: boolean
  fetched_at: string
  info: Record<string, unknown>
  recent_history: unknown
  calendar: unknown
  recommendations: unknown
  institutional_holders: unknown
  major_holders: unknown
  dividends: unknown
  splits: unknown
  actions: unknown
}

export default function AssetDebug() {
  const [searchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TickerInfo[]>([])
  const [selectedAsset, setSelectedAsset] = useState<AssetDetails | null>(null)
  const [transactions, setTransactions] = useState<TransactionInfo[]>([])
  const [splits, setSplits] = useState<SplitInfo[]>([])
  const [priceHistory, setPriceHistory] = useState<PriceHistory | null>(null)
  const [healthInfo, setHealthInfo] = useState<HealthInfo | null>(null)
  const [yfinanceData, setYfinanceData] = useState<YFinanceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'transactions' | 'splits' | 'prices' | 'health' | 'yfinance'>('details')

  // Load asset from URL parameter on mount
  useEffect(() => {
    const symbolParam = searchParams.get('symbol')
    if (symbolParam) {
      handleSelectAsset({ symbol: symbolParam, name: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    
    if (query.length > 1) {
      try {
        const data = await api.searchTicker(query)
        setSearchResults(data)
      } catch (err) {
        console.error("Failed to search tickers:", err)
      }
    } else {
      setSearchResults([])
    }
  }

  const handleSelectAsset = async (tickerInfo: TickerInfo) => {
    setLoading(true)
    setError(null)
    setSearchQuery(tickerInfo.symbol)
    setSearchResults([])
    
    try {
      // Find the asset
      const assets = await api.getAssets(tickerInfo.symbol)
      const match = assets.find((a) => a.symbol?.toUpperCase() === tickerInfo.symbol.toUpperCase())
      
      if (!match) {
        // Asset not in database - still fetch yfinance data
        setError(`Asset ${tickerInfo.symbol} not found in database - showing YFinance data only`)
        setSelectedAsset(null)
        setTransactions([])
        setSplits([])
        setPriceHistory(null)
        setHealthInfo(null)
        
        // Fetch yfinance data using symbol parameter
        try {
          const yfinanceRawData = await api.getYFinanceDataBySymbol(tickerInfo.symbol)
          setYfinanceData(yfinanceRawData)
          setActiveTab('yfinance') // Switch to yfinance tab
        } catch (err) {
          setYfinanceData(null)
          setError(`Asset ${tickerInfo.symbol} not found in database and failed to fetch YFinance data: ${(err as Error).message}`)
        }
        
        return
      }

      // Get detailed asset info from held or sold assets (which include complete data)
      const [heldAssets, soldAssets] = await Promise.all([
        api.getHeldAssets().catch(() => []),
        api.getSoldAssets().catch(() => [])
      ])
      
      const allAssets = [...heldAssets, ...soldAssets]
      const detailedAsset = allAssets.find((a) => a.id === match.id) || match
      
      setSelectedAsset(detailedAsset)

      // Fetch all related data
      const [txData, splitData, priceData, healthData, yfinanceRawData] = await Promise.all([
        api.getAssetTransactionHistory(match.id).catch(() => []),
        api.getAssetSplitHistory(match.id).catch(() => []),
        api.getAssetPriceHistory(match.id, 'ALL').catch(() => null),
        api.getAssetHealth(match.id).catch(() => null),
        api.getYFinanceData(match.id).catch(() => null),
      ])

      setTransactions(txData)
      setSplits(splitData)
      setPriceHistory(priceData)
      setHealthInfo(healthData)
      setYfinanceData(yfinanceRawData)
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch asset details')
      setSelectedAsset(null)
    } finally {
      setLoading(false)
    }
  }

  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults([])
    setSelectedAsset(null)
    setTransactions([])
    setSplits([])
    setPriceHistory(null)
    setHealthInfo(null)
    setYfinanceData(null)
    setError(null)
    setActiveTab('details')
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString()
  }

  const formatDateOnly = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString()
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'EXCELLENT':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'GOOD':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'FAIR':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'POOR':
      case 'NO_DATA':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      default:
        return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-400'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Database className="text-purple-600" size={28} />
            Asset Debugger
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            Deep dive into asset data, transactions, prices, and health metrics
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card p-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-400 dark:text-neutral-500" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search for an asset by symbol or name..."
            className="w-full pl-12 pr-12 py-3 text-lg border-2 border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-4 bg-white dark:bg-neutral-800 border-2 border-neutral-300 dark:border-neutral-700 rounded-lg shadow-lg max-h-80 overflow-y-auto">
            {searchResults.map((item) => (
              <button
                key={item.symbol}
                className="w-full p-4 text-left hover:bg-purple-50 dark:hover:bg-purple-900/20 border-b border-neutral-200 dark:border-neutral-700 last:border-b-0 transition-colors"
                onClick={() => handleSelectAsset(item)}
              >
                <div>
                  <div className="font-bold text-purple-600 dark:text-purple-400">{item.symbol}</div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">{item.name}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="card p-12 text-center">
          <RefreshCw className="animate-spin mx-auto mb-4 text-purple-600" size={48} />
          <p className="text-neutral-600 dark:text-neutral-400">Loading asset data...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="card p-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
            <AlertCircle size={24} />
            <div>
              <h3 className="font-bold">Error</h3>
              <p>{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* YFinance-only view (asset not in database) */}
      {!selectedAsset && !loading && yfinanceData && (
        <div className="space-y-6">
          {/* Asset Header from YFinance */}
          <div className="card p-6">
            <div className="flex items-start gap-6">
              <img 
                src={getAssetLogoUrl(yfinanceData.symbol, undefined, yfinanceData.name)}
                alt={`${yfinanceData.symbol} logo`}
                className="w-20 h-20 object-cover rounded-lg shadow-md"
                onLoad={(e) => {
                  const img = e.currentTarget as HTMLImageElement
                  if (!validateLogoImage(img)) {
                    img.dispatchEvent(new Event('error'))
                  }
                }}
                onError={(e) => handleLogoError(e, yfinanceData.symbol, yfinanceData.name)}
              />
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                  {yfinanceData.symbol}
                </h2>
                <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-3">
                  {yfinanceData.name || yfinanceData.info?.longName as string || yfinanceData.info?.shortName as string || 'No name available'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full text-sm font-medium">
                    Not in Database
                  </span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-sm font-medium">
                    {yfinanceData.info?.quoteType as string || 'Unknown Type'}
                  </span>
                  <span className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full text-sm font-medium">
                    {yfinanceData.info?.currency as string || 'USD'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* YFinance Data Card */}
          <div className="card overflow-hidden">
            <div className="bg-purple-600 text-white p-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Code size={20} />
                Raw YFinance Data
              </h3>
              <p className="text-sm opacity-90 mt-1">
                Complete data from Yahoo Finance API
              </p>
            </div>
            <div className="p-6">
              {activeTab === 'yfinance' && yfinanceData && (
                <div className="space-y-6">
                  {/* Info Section */}
                  {yfinanceData.info && typeof yfinanceData.info === 'object' ? (
                    <div>
                      <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                        <Database size={16} />
                        Ticker Info - Key Fields
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                        {Object.entries(yfinanceData.info)
                          .filter(([key]) => [
                            'symbol', 'shortName', 'longName', 'quoteType', 'currency',
                            'market', 'exchange', 'sector', 'industry', 'country',
                            'marketCap', 'enterpriseValue', 'trailingPE', 'forwardPE',
                            'priceToBook', 'dividendYield', 'beta', 'fiftyTwoWeekHigh',
                            'fiftyTwoWeekLow', 'regularMarketPrice', 'regularMarketVolume'
                          ].includes(key))
                          .map(([key, value]) => (
                            <div key={key} className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                              <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">{key}</div>
                              <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 break-words">
                                {value !== null && value !== undefined ? String(value) : '-'}
                              </div>
                            </div>
                          ))}
                      </div>

                      <details className="bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                        <summary className="cursor-pointer p-4 font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                          View complete info object (click to expand)
                        </summary>
                        <pre className="p-4 overflow-x-auto text-xs max-h-96 overflow-y-auto border-t border-neutral-300 dark:border-neutral-600">
                          {JSON.stringify(yfinanceData.info, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ) : null}

                  {/* Recent History */}
                  {yfinanceData.recent_history && typeof yfinanceData.recent_history === 'object' ? (
                    <div>
                      <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                        <TrendingUp size={16} />
                        Recent Price History (90 days)
                      </h4>
                      <details className="bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                        <summary className="cursor-pointer p-4 font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                          View recent history
                        </summary>
                        <pre className="p-4 overflow-x-auto text-xs max-h-96 overflow-y-auto border-t border-neutral-300 dark:border-neutral-600">
                          {JSON.stringify(yfinanceData.recent_history, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ) : null}

                  {/* Calendar */}
                  {yfinanceData.calendar && typeof yfinanceData.calendar === 'object' ? (
                    <div>
                      <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                        <Calendar size={16} />
                        Calendar (Earnings, Dividends)
                      </h4>
                      <details className="bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                        <summary className="cursor-pointer p-4 font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                          View calendar
                        </summary>
                        <pre className="p-4 overflow-x-auto text-xs max-h-96 overflow-y-auto border-t border-neutral-300 dark:border-neutral-600">
                          {JSON.stringify(yfinanceData.calendar, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ) : null}

                  {/* Recommendations */}
                  {yfinanceData.recommendations && typeof yfinanceData.recommendations === 'object' ? (
                    <div>
                      <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                        <BarChart3 size={16} />
                        Analyst Recommendations
                      </h4>
                      <details className="bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                        <summary className="cursor-pointer p-4 font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                          View recommendations
                        </summary>
                        <pre className="p-4 overflow-x-auto text-xs max-h-96 overflow-y-auto border-t border-neutral-300 dark:border-neutral-600">
                          {JSON.stringify(yfinanceData.recommendations, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ) : null}

                  {/* Institutional Holders */}
                  {yfinanceData.institutional_holders && typeof yfinanceData.institutional_holders === 'object' ? (
                    <div>
                      <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                        <Building2 size={16} />
                        Institutional Holders
                      </h4>
                      <details className="bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                        <summary className="cursor-pointer p-4 font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                          View institutional holders
                        </summary>
                        <pre className="p-4 overflow-x-auto text-xs max-h-96 overflow-y-auto border-t border-neutral-300 dark:border-neutral-600">
                          {JSON.stringify(yfinanceData.institutional_holders, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ) : null}

                  {/* Major Holders */}
                  {yfinanceData.major_holders && typeof yfinanceData.major_holders === 'object' ? (
                    <div>
                      <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                        <Building2 size={16} />
                        Major Holders
                      </h4>
                      <details className="bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                        <summary className="cursor-pointer p-4 font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                          View major holders
                        </summary>
                        <pre className="p-4 overflow-x-auto text-xs max-h-96 overflow-y-auto border-t border-neutral-300 dark:border-neutral-600">
                          {JSON.stringify(yfinanceData.major_holders, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ) : null}

                  {/* Dividends */}
                  {yfinanceData.dividends && typeof yfinanceData.dividends === 'object' ? (
                    <div>
                      <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                        <DollarSign size={16} />
                        Dividend History
                      </h4>
                      <details className="bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                        <summary className="cursor-pointer p-4 font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                          View dividends
                        </summary>
                        <pre className="p-4 overflow-x-auto text-xs max-h-96 overflow-y-auto border-t border-neutral-300 dark:border-neutral-600">
                          {JSON.stringify(yfinanceData.dividends, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ) : null}

                  {/* Splits */}
                  {yfinanceData.splits && typeof yfinanceData.splits === 'object' ? (
                    <div>
                      <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                        <Zap size={16} />
                        Stock Splits History
                      </h4>
                      <details className="bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                        <summary className="cursor-pointer p-4 font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                          View splits
                        </summary>
                        <pre className="p-4 overflow-x-auto text-xs max-h-96 overflow-y-auto border-t border-neutral-300 dark:border-neutral-600">
                          {JSON.stringify(yfinanceData.splits, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ) : null}

                  {/* Actions */}
                  {yfinanceData.actions && typeof yfinanceData.actions === 'object' ? (
                    <div>
                      <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                        <Activity size={16} />
                        All Corporate Actions
                      </h4>
                      <details className="bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                        <summary className="cursor-pointer p-4 font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                          View all actions (dividends + splits)
                        </summary>
                        <pre className="p-4 overflow-x-auto text-xs max-h-96 overflow-y-auto border-t border-neutral-300 dark:border-neutral-600">
                          {JSON.stringify(yfinanceData.actions, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ) : null}

                  {/* Complete Raw Dump */}
                  <div>
                    <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2">Complete Raw YFinance Response</h4>
                    <details className="bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                      <summary className="cursor-pointer p-4 font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                        View everything (click to expand)
                      </summary>
                      <pre className="p-4 overflow-x-auto text-xs max-h-[600px] overflow-y-auto border-t border-neutral-300 dark:border-neutral-600">
                        {JSON.stringify(yfinanceData, null, 2)}
                      </pre>
                    </details>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Asset Details */}
      {selectedAsset && !loading && (
        <div className="space-y-6">
          {/* Asset Header */}
          <div className="card p-6">
            <div className="flex items-start gap-6">
              <img 
                src={getAssetLogoUrl(selectedAsset.symbol, selectedAsset.asset_type, selectedAsset.name)}
                alt={`${selectedAsset.symbol} logo`}
                className="w-20 h-20 object-cover rounded-lg shadow-md"
                onLoad={(e) => {
                  const img = e.currentTarget as HTMLImageElement
                  if (!validateLogoImage(img)) {
                    img.dispatchEvent(new Event('error'))
                  }
                }}
                onError={(e) => handleLogoError(e, selectedAsset.symbol, selectedAsset.name, selectedAsset.asset_type)}
              />
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                  {selectedAsset.symbol}
                </h2>
                <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-3">
                  {selectedAsset.name || 'No name available'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-sm font-medium">
                    {selectedAsset.asset_type || 'Unknown Type'}
                  </span>
                  <span className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full text-sm font-medium">
                    {selectedAsset.currency}
                  </span>
                  {selectedAsset.class && (
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 rounded-full text-sm font-medium">
                      {selectedAsset.class}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="card overflow-hidden">
            <div className="border-b border-neutral-200 dark:border-neutral-700">
              <nav className="flex overflow-x-auto">
                {[
                  { id: 'details', label: 'Details', icon: Database },
                  { id: 'transactions', label: `Transactions (${transactions.length})`, icon: TrendingUp },
                  { id: 'splits', label: `Splits (${splits.length})`, icon: Zap },
                  { id: 'prices', label: `Price History (${priceHistory?.data_points || 0})`, icon: BarChart3 },
                  { id: 'health', label: 'Health Check', icon: AlertCircle },
                  { id: 'yfinance', label: 'Raw YFinance', icon: Code },
                ].map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as 'details' | 'transactions' | 'splits' | 'prices' | 'health' | 'yfinance')}
                      className={`
                        flex items-center gap-2 px-6 py-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap
                        ${activeTab === tab.id
                          ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300 dark:text-neutral-400 dark:hover:text-neutral-300'
                        }
                      `}
                    >
                      <Icon size={16} />
                      {tab.label}
                    </button>
                  )
                })}
              </nav>
            </div>

            <div className="p-6">
              {/* Details Tab */}
              {activeTab === 'details' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                      <Database size={20} />
                      Basic Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <DataField label="Asset ID" value={selectedAsset.id} icon={Tag} />
                      <DataField label="Symbol" value={selectedAsset.symbol} icon={TrendingUp} />
                      <DataField label="Name" value={selectedAsset.name || '-'} icon={Tag} />
                      <DataField label="Currency" value={selectedAsset.currency} icon={DollarSign} />
                      <DataField label="Asset Type" value={selectedAsset.asset_type || '-'} icon={Tag} />
                      <DataField label="Class" value={selectedAsset.class || '-'} icon={Tag} />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                      <Globe size={20} />
                      Metadata
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <DataField label="Sector" value={selectedAsset.sector || '-'} icon={Building2} />
                      <DataField label="Industry" value={selectedAsset.industry || '-'} icon={Building2} />
                      <DataField label="Country" value={selectedAsset.country || '-'} icon={Globe} />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                      <Zap size={20} />
                      Effective Metadata (with user overrides)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <DataField 
                        label="Effective Sector" 
                        value={selectedAsset.effective_sector || '-'} 
                        icon={Building2}
                        highlight={selectedAsset.effective_sector !== selectedAsset.sector}
                      />
                      <DataField 
                        label="Effective Industry" 
                        value={selectedAsset.effective_industry || '-'} 
                        icon={Building2}
                        highlight={selectedAsset.effective_industry !== selectedAsset.industry}
                      />
                      <DataField 
                        label="Effective Country" 
                        value={selectedAsset.effective_country || '-'} 
                        icon={Globe}
                        highlight={selectedAsset.effective_country !== selectedAsset.country}
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                      <Calendar size={20} />
                      Timestamps
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <DataField label="Created At" value={formatDate(selectedAsset.created_at)} icon={Calendar} />
                      <DataField label="Updated At" value={formatDate(selectedAsset.updated_at)} icon={Calendar} />
                      <DataField label="First Transaction" value={formatDateOnly(selectedAsset.first_transaction_date)} icon={Calendar} />
                      <DataField label="Logo Fetched" value={formatDate(selectedAsset.logo_fetched_at)} icon={Calendar} />
                    </div>
                  </div>

                  {/* JSON Dump */}
                  <div>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4">
                      Raw JSON Data
                    </h3>
                    <pre className="bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg overflow-x-auto text-xs">
                      {JSON.stringify(selectedAsset, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Transactions Tab */}
              {activeTab === 'transactions' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                    <TrendingUp size={20} />
                    Transaction History ({transactions.length} transactions)
                  </h3>
                  
                  {transactions.length === 0 ? (
                    <p className="text-neutral-600 dark:text-neutral-400 text-center py-8">
                      No transactions found for this asset
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-neutral-100 dark:bg-neutral-800">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Type</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Quantity</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Adjusted Qty</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Price</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Portfolio</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                          {transactions.map((tx) => (
                            <tr key={tx.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                              <td className="px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100">
                                {formatDateOnly(tx.tx_date)}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-medium px-2 py-1 rounded ${
                                  tx.type === 'BUY' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                  tx.type === 'SELL' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                  'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-400'
                                }`}>
                                  {tx.type}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-neutral-900 dark:text-neutral-100">
                                {tx.quantity.toFixed(8).replace(/\.?0+$/, '')}
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-medium text-purple-600 dark:text-purple-400">
                                {tx.adjusted_quantity.toFixed(8).replace(/\.?0+$/, '')}
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-neutral-900 dark:text-neutral-100">
                                {tx.price !== null ? `$${tx.price.toFixed(2)}` : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100">
                                {tx.portfolio_name}
                              </td>
                              <td className="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400 max-w-xs truncate">
                                {tx.notes || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Splits Tab */}
              {activeTab === 'splits' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                    <Zap size={20} />
                    Stock Splits ({splits.length} splits)
                  </h3>
                  
                  {splits.length === 0 ? (
                    <p className="text-neutral-600 dark:text-neutral-400 text-center py-8">
                      No stock splits found for this asset
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {splits.map((split) => (
                        <div key={split.id} className="card p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-purple-700 dark:text-purple-400">
                              {split.metadata?.split || 'Unknown ratio'}
                            </span>
                            <span className="text-sm text-neutral-600 dark:text-neutral-400">
                              {formatDateOnly(split.tx_date)}
                            </span>
                          </div>
                          {split.notes && (
                            <p className="text-sm text-neutral-600 dark:text-neutral-400">
                              {split.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Price History Tab */}
              {activeTab === 'prices' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                    <BarChart3 size={20} />
                    Price History
                  </h3>
                  
                  {!priceHistory || priceHistory.data_points === 0 ? (
                    <p className="text-neutral-600 dark:text-neutral-400 text-center py-8">
                      No price history available for this asset
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="card p-4 bg-blue-50 dark:bg-blue-900/20">
                          <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">Data Points</div>
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {priceHistory.data_points}
                          </div>
                        </div>
                        <div className="card p-4 bg-green-50 dark:bg-green-900/20">
                          <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">Start Date</div>
                          <div className="text-sm font-bold text-green-600 dark:text-green-400">
                            {formatDateOnly(priceHistory.start_date)}
                          </div>
                        </div>
                        <div className="card p-4 bg-purple-50 dark:bg-purple-900/20">
                          <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">End Date</div>
                          <div className="text-sm font-bold text-purple-600 dark:text-purple-400">
                            {formatDateOnly(priceHistory.end_date)}
                          </div>
                        </div>
                        <div className="card p-4 bg-orange-50 dark:bg-orange-900/20">
                          <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">Latest Price</div>
                          <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                            ${priceHistory.prices[priceHistory.prices.length - 1]?.price.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto max-h-96 overflow-y-auto">
                        <table className="w-full">
                          <thead className="bg-neutral-100 dark:bg-neutral-800 sticky top-0">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Date</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Price</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Volume</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Source</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                            {priceHistory.prices.slice().reverse().map((price, idx) => (
                              <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                                <td className="px-4 py-2 text-sm text-neutral-900 dark:text-neutral-100">
                                  {new Date(price.date).toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-right text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                  ${price.price.toFixed(4)}
                                </td>
                                <td className="px-4 py-2 text-right text-sm text-neutral-600 dark:text-neutral-400">
                                  {price.volume?.toLocaleString() || '-'}
                                </td>
                                <td className="px-4 py-2 text-xs">
                                  <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-400">
                                    {price.source}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Health Check Tab */}
              {activeTab === 'health' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                    <AlertCircle size={20} />
                    Data Health Check
                  </h3>
                  
                  {!healthInfo ? (
                    <p className="text-neutral-600 dark:text-neutral-400 text-center py-8">
                      No health data available
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {/* Status Badge */}
                      <div className="flex items-center gap-3">
                        <span className={`px-4 py-2 rounded-lg text-lg font-bold ${getStatusBadgeColor(healthInfo.status)}`}>
                          {healthInfo.status}
                        </span>
                        <span className="text-neutral-600 dark:text-neutral-400">
                          {healthInfo.total_price_records} price records
                        </span>
                      </div>

                      {/* Coverage Stats */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="card p-4 bg-blue-50 dark:bg-blue-900/20">
                          <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">Coverage</div>
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {healthInfo.coverage.coverage_pct.toFixed(1)}%
                          </div>
                          <div className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                            {healthInfo.coverage.actual_data_points} / {healthInfo.coverage.expected_trading_days} days
                          </div>
                        </div>
                        <div className="card p-4 bg-yellow-50 dark:bg-yellow-900/20">
                          <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">Missing Days</div>
                          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                            {healthInfo.coverage.missing_days}
                          </div>
                          <div className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                            {healthInfo.coverage.gap_count} gaps
                          </div>
                        </div>
                        <div className="card p-4 bg-green-50 dark:bg-green-900/20">
                          <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">Data Range</div>
                          <div className="text-sm font-bold text-green-600 dark:text-green-400">
                            {healthInfo.data_range ? `${healthInfo.data_range.days} days` : 'N/A'}
                          </div>
                          <div className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                            {healthInfo.data_range ? formatDateOnly(healthInfo.data_range.start) : '-'}
                          </div>
                        </div>
                      </div>

                      {/* Data Sources */}
                      <div>
                        <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2">Data Sources</h4>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(healthInfo.sources).map(([source, count]) => (
                            <span key={source} className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded text-sm">
                              <span className="font-medium">{source}</span>
                              <span className="text-neutral-600 dark:text-neutral-400 ml-2">({count})</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Recommendations */}
                      {healthInfo.recommendations.length > 0 && (
                        <div>
                          <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2">Recommendations</h4>
                          <div className="space-y-2">
                            {healthInfo.recommendations.map((rec, idx) => (
                              <div key={idx} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-300">
                                {rec}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Gaps */}
                      {Array.isArray(healthInfo.gaps) && healthInfo.gaps.length > 0 && (
                        <div>
                          <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                            Missing Dates (showing {healthInfo.gaps.length})
                          </h4>
                          <div className="bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg max-h-48 overflow-y-auto">
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs text-neutral-700 dark:text-neutral-300">
                              {healthInfo.gaps.map((date, idx) => (
                                <span key={idx} className="font-mono">{date}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* JSON Dump */}
                      <div>
                        <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2">Raw Health Data</h4>
                        <pre className="bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg overflow-x-auto text-xs max-h-96 overflow-y-auto">
                          {JSON.stringify(healthInfo, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* YFinance Tab */}
              {activeTab === 'yfinance' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                    <Code size={20} />
                    Raw Yahoo Finance Data
                  </h3>
                  
                  {!yfinanceData ? (
                    <p className="text-neutral-600 dark:text-neutral-400 text-center py-8">
                      No YFinance data available
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {/* Fetched timestamp */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
                          <Calendar size={16} />
                          <span className="font-medium">Fetched at:</span>
                          <span>{new Date(yfinanceData.fetched_at).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Info Section - The main data */}
                      {yfinanceData.info && Object.keys(yfinanceData.info).length > 0 ? (
                        <div>
                          <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                            <Database size={16} />
                            Ticker Info ({Object.keys(yfinanceData.info).length} fields)
                          </h4>
                          
                          {/* Key fields in a grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                            {[
                              'longName',
                              'shortName',
                              'symbol',
                              'quoteType',
                              'currency',
                              'exchange',
                              'marketCap',
                              'sector',
                              'industry',
                              'country',
                              'regularMarketPrice',
                              'previousClose',
                              'open',
                              'dayLow',
                              'dayHigh',
                              'volume',
                              'averageVolume',
                              'fiftyTwoWeekLow',
                              'fiftyTwoWeekHigh',
                              'dividendYield',
                              'trailingPE',
                              'forwardPE',
                              'priceToBook',
                              'beta',
                            ].map((key) => {
                              const value = yfinanceData.info[key]
                              if (value === undefined || value === null) return null
                              
                              return (
                                <div key={key} className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-3">
                                  <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1 font-medium">
                                    {key}
                                  </div>
                                  <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 break-words">
                                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                  </div>
                                </div>
                              )
                            }).filter(Boolean)}
                          </div>

                          {/* Full info object */}
                          <details className="bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                            <summary className="cursor-pointer p-4 font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                              View all {Object.keys(yfinanceData.info).length} fields (click to expand)
                            </summary>
                            <pre className="p-4 overflow-x-auto text-xs max-h-96 overflow-y-auto border-t border-neutral-300 dark:border-neutral-600">
                              {JSON.stringify(yfinanceData.info, null, 2)}
                            </pre>
                          </details>
                        </div>
                      ) : null}

                      {/* Recent History */}
                      {yfinanceData.recent_history && typeof yfinanceData.recent_history === 'object' ? (
                        <div>
                          <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                            <BarChart3 size={16} />
                            Recent History (Last 5 Days)
                          </h4>
                          <details className="bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                            <summary className="cursor-pointer p-4 font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                              View recent price data
                            </summary>
                            <pre className="p-4 overflow-x-auto text-xs max-h-96 overflow-y-auto border-t border-neutral-300 dark:border-neutral-600">
                              {JSON.stringify(yfinanceData.recent_history, null, 2)}
                            </pre>
                          </details>
                        </div>
                      ) : null}

                      {/* Calendar */}
                      {yfinanceData.calendar && typeof yfinanceData.calendar === 'object' ? (
                        <div>
                          <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                            <Calendar size={16} />
                            Calendar Events
                          </h4>
                          <details className="bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                            <summary className="cursor-pointer p-4 font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                              View calendar data
                            </summary>
                            <pre className="p-4 overflow-x-auto text-xs max-h-96 overflow-y-auto border-t border-neutral-300 dark:border-neutral-600">
                              {JSON.stringify(yfinanceData.calendar, null, 2)}
                            </pre>
                          </details>
                        </div>
                      ) : null}

                      {/* Recommendations */}
                      {yfinanceData.recommendations && typeof yfinanceData.recommendations === 'object' ? (
                        <div>
                          <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                            <TrendingUp size={16} />
                            Analyst Recommendations
                          </h4>
                          <details className="bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                            <summary className="cursor-pointer p-4 font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                              View recommendations
                            </summary>
                            <pre className="p-4 overflow-x-auto text-xs max-h-96 overflow-y-auto border-t border-neutral-300 dark:border-neutral-600">
                              {JSON.stringify(yfinanceData.recommendations, null, 2)}
                            </pre>
                          </details>
                        </div>
                      ) : null}

                      {/* Institutional Holders */}
                      {yfinanceData.institutional_holders && typeof yfinanceData.institutional_holders === 'object' ? (
                        <div>
                          <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                            <Building2 size={16} />
                            Institutional Holders
                          </h4>
                          <details className="bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                            <summary className="cursor-pointer p-4 font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                              View institutional holders
                            </summary>
                            <pre className="p-4 overflow-x-auto text-xs max-h-96 overflow-y-auto border-t border-neutral-300 dark:border-neutral-600">
                              {JSON.stringify(yfinanceData.institutional_holders, null, 2)}
                            </pre>
                          </details>
                        </div>
                      ) : null}

                      {/* Major Holders */}
                      {yfinanceData.major_holders && typeof yfinanceData.major_holders === 'object' ? (
                        <div>
                          <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                            <Building2 size={16} />
                            Major Holders
                          </h4>
                          <details className="bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                            <summary className="cursor-pointer p-4 font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                              View major holders
                            </summary>
                            <pre className="p-4 overflow-x-auto text-xs max-h-96 overflow-y-auto border-t border-neutral-300 dark:border-neutral-600">
                              {JSON.stringify(yfinanceData.major_holders, null, 2)}
                            </pre>
                          </details>
                        </div>
                      ) : null}

                      {/* Dividends */}
                      {yfinanceData.dividends && typeof yfinanceData.dividends === 'object' ? (
                        <div>
                          <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                            <DollarSign size={16} />
                            Dividend History
                          </h4>
                          <details className="bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                            <summary className="cursor-pointer p-4 font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                              View dividends
                            </summary>
                            <pre className="p-4 overflow-x-auto text-xs max-h-96 overflow-y-auto border-t border-neutral-300 dark:border-neutral-600">
                              {JSON.stringify(yfinanceData.dividends, null, 2)}
                            </pre>
                          </details>
                        </div>
                      ) : null}

                      {/* Splits */}
                      {yfinanceData.splits && typeof yfinanceData.splits === 'object' ? (
                        <div>
                          <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                            <Zap size={16} />
                            Stock Splits History
                          </h4>
                          <details className="bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                            <summary className="cursor-pointer p-4 font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                              View splits
                            </summary>
                            <pre className="p-4 overflow-x-auto text-xs max-h-96 overflow-y-auto border-t border-neutral-300 dark:border-neutral-600">
                              {JSON.stringify(yfinanceData.splits, null, 2)}
                            </pre>
                          </details>
                        </div>
                      ) : null}

                      {/* Actions */}
                      {yfinanceData.actions && typeof yfinanceData.actions === 'object' ? (
                        <div>
                          <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                            <Activity size={16} />
                            All Corporate Actions
                          </h4>
                          <details className="bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                            <summary className="cursor-pointer p-4 font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                              View all actions (dividends + splits)
                            </summary>
                            <pre className="p-4 overflow-x-auto text-xs max-h-96 overflow-y-auto border-t border-neutral-300 dark:border-neutral-600">
                              {JSON.stringify(yfinanceData.actions, null, 2)}
                            </pre>
                          </details>
                        </div>
                      ) : null}

                      {/* Complete Raw Dump */}
                      <div>
                        <h4 className="font-bold text-neutral-900 dark:text-neutral-100 mb-2">Complete Raw YFinance Response</h4>
                        <details className="bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                          <summary className="cursor-pointer p-4 font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                            View everything (click to expand)
                          </summary>
                          <pre className="p-4 overflow-x-auto text-xs max-h-[600px] overflow-y-auto border-t border-neutral-300 dark:border-neutral-600">
                            {JSON.stringify(yfinanceData, null, 2)}
                          </pre>
                        </details>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selectedAsset && !loading && !error && (
        <div className="card p-12 text-center">
          <Database className="mx-auto mb-4 text-neutral-400 dark:text-neutral-600" size={64} />
          <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            No Asset Selected
          </h3>
          <p className="text-neutral-600 dark:text-neutral-400">
            Search for an asset above to view its detailed information
          </p>
        </div>
      )}
    </div>
  )
}

interface DataFieldProps {
  label: string
  value: string | number
  icon?: React.ElementType
  highlight?: boolean
}

function DataField({ label, value, icon: Icon, highlight }: DataFieldProps) {
  return (
    <div className={`p-4 rounded-lg border ${
      highlight 
        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700' 
        : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
    }`}>
      <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400 mb-1">
        {Icon && <Icon size={14} />}
        {label}
        {highlight && <span className="text-yellow-600 dark:text-yellow-400 font-bold">*</span>}
      </div>
      <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 break-words">
        {value}
      </div>
    </div>
  )
}
