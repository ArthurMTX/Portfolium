import { useState, useEffect, useCallback } from 'react'
import { X, ArrowRight, Search, Loader2, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'
import { getAssetLogoUrl, handleLogoError, cleanCryptoName } from '../lib/logoUtils'

interface Asset {
  id: number
  symbol: string
  name: string | null
  currency: string
  asset_type?: string | null
  quantity?: number
}

interface TickerInfo {
  symbol: string
  name: string
  type?: string | null
}

interface ConversionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  portfolioId: number
  portfolioCurrency: string
}

export default function ConversionModal({
  isOpen,
  onClose,
  onSuccess,
  portfolioId,
  portfolioCurrency,
}: ConversionModalProps) {
  const { t } = useTranslation()
  
  // Form state
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0])
  const [fromAsset, setFromAsset] = useState<Asset | null>(null)
  const [toAsset, setToAsset] = useState<Asset | null>(null)
  const [fromQuantity, setFromQuantity] = useState('')
  const [toQuantity, setToQuantity] = useState('')
  const [fromPrice, setFromPrice] = useState('')
  const [toPrice, setToPrice] = useState('')
  const [fees, setFees] = useState('0')
  const [notes, setNotes] = useState('')
  
  // Search state
  const [fromSearch, setFromSearch] = useState('')
  const [toSearch, setToSearch] = useState('')
  const [fromSearchResults, setFromSearchResults] = useState<TickerInfo[]>([])
  const [toSearchResults, setToSearchResults] = useState<TickerInfo[]>([])
  const [portfolioAssets, setPortfolioAssets] = useState<Asset[]>([])
  
  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fetchingFromPrice, setFetchingFromPrice] = useState(false)
  const [fetchingToPrice, setFetchingToPrice] = useState(false)

  // Auto-compute toQuantity when fromQuantity or prices change
  useEffect(() => {
    const from = parseFloat(fromQuantity)
    const fPrice = parseFloat(fromPrice)
    const tPrice = parseFloat(toPrice)
    
    if (from > 0 && fPrice > 0 && tPrice > 0) {
      // Calculate: toQuantity = (fromQuantity * fromPrice) / toPrice
      const totalValue = from * fPrice
      const computed = totalValue / tPrice
      setToQuantity(computed.toFixed(8).replace(/\.?0+$/, ''))
    }
  }, [fromQuantity, fromPrice, toPrice])

  // Calculate conversion rate based on prices
  const getConversionRate = () => {
    const fPrice = parseFloat(fromPrice)
    const tPrice = parseFloat(toPrice)
    if (!fPrice || !tPrice || !fromAsset || !toAsset) return null
    
    const rate = fPrice / tPrice
    return rate
  }

  // Load portfolio assets on open
  useEffect(() => {
    if (isOpen && portfolioId) {
      loadPortfolioAssets()
    }
  }, [isOpen, portfolioId])

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTxDate(new Date().toISOString().split('T')[0])
      setFromAsset(null)
      setToAsset(null)
      setFromQuantity('')
      setToQuantity('')
      setFromPrice('')
      setToPrice('')
      setFees('0')
      setNotes('')
      setFromSearch('')
      setToSearch('')
      setFromSearchResults([])
      setToSearchResults([])
      setError('')
    }
  }, [isOpen])

  const loadPortfolioAssets = async () => {
    try {
      const positions = await api.getPortfolioPositions(portfolioId)
      // Filter for crypto assets only and with positive quantity
      const assets: Asset[] = positions
        .filter((p) => parseFloat(String(p.quantity)) > 0 && p.asset_type?.toUpperCase() === 'CRYPTOCURRENCY')
        .map((p) => ({
          id: p.asset_id,
          symbol: p.symbol,
          name: p.name || null,
          currency: p.currency,
          asset_type: p.asset_type,
          quantity: parseFloat(String(p.quantity)),
        }))
      setPortfolioAssets(assets)
    } catch (err) {
      console.error('Failed to load portfolio assets:', err)
    }
  }

  // Search for tickers (for the target asset) - crypto only
  const searchTickers = useCallback(async (query: string, isFromAsset: boolean) => {
    if (query.length < 1) {
      if (isFromAsset) setFromSearchResults([])
      else setToSearchResults([])
      return
    }
    
    try {
      // Use searchTicker (same as Add Transaction modal) and filter for crypto client-side
      const results = await api.searchTicker(query)
      // Filter for cryptocurrency results only
      const cryptoResults = results.filter(r => r.type?.toUpperCase() === 'CRYPTOCURRENCY')
      if (isFromAsset) {
        setFromSearchResults(cryptoResults)
      } else {
        setToSearchResults(cryptoResults)
      }
    } catch (err) {
      console.error('Search failed:', err)
    }
  }, [])

  // Debounced search for target asset
  useEffect(() => {
    const timer = setTimeout(() => {
      if (toSearch) searchTickers(toSearch, false)
    }, 300)
    return () => clearTimeout(timer)
  }, [toSearch, searchTickers])

  // Fetch current price for an asset
  const fetchPrice = async (symbol: string, isFrom: boolean) => {
    if (isFrom) setFetchingFromPrice(true)
    else setFetchingToPrice(true)
    
    try {
      const priceData = await api.getPriceQuote(symbol)
      const price = priceData.price
      if (isFrom) {
        setFromPrice(price.toString())
      } else {
        setToPrice(price.toString())
      }
    } catch (err) {
      console.error('Failed to fetch price:', err)
    } finally {
      if (isFrom) setFetchingFromPrice(false)
      else setFetchingToPrice(false)
    }
  }

  // Handle selecting from asset (from portfolio)
  const handleSelectFromAsset = (asset: Asset) => {
    setFromAsset(asset)
    setFromSearch('')
    fetchPrice(asset.symbol, true)
  }

  // Handle selecting to asset (from search)
  const handleSelectToAsset = async (ticker: TickerInfo) => {
    // Check if this asset exists in the portfolio (to get quantity)
    const portfolioAsset = portfolioAssets.find(a => a.symbol === ticker.symbol)
    
    // First, try to get existing asset from database
    try {
      const asset = await api.getAssetBySymbol(ticker.symbol)
      setToAsset({
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        currency: asset.currency,
        quantity: portfolioAsset?.quantity,
      })
      setToSearch('')
      setToSearchResults([])
      fetchPrice(ticker.symbol, false)
    } catch {
      // Asset doesn't exist, create it
      try {
        const newAsset = await api.createAsset({
          symbol: ticker.symbol,
          name: ticker.name,
          currency: 'USD',
          class: 'crypto',
          asset_type: 'CRYPTOCURRENCY',
        })
        setToAsset({
          id: newAsset.id,
          symbol: newAsset.symbol,
          name: newAsset.name,
          currency: newAsset.currency,
          quantity: 0, // New asset, no quantity yet
        })
        setToSearch('')
        setToSearchResults([])
        fetchPrice(ticker.symbol, false)
      } catch (createErr) {
        console.error('Failed to create asset:', createErr)
        setError('Failed to add asset. Please try again.')
      }
    }
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!fromAsset || !toAsset) {
      setError(t('conversion.selectBothAssets'))
      return
    }
    
    if (fromAsset.id === toAsset.id) {
      setError(t('conversion.sameAssetError'))
      return
    }
    
    if (!fromQuantity || !toQuantity) {
      setError(t('conversion.enterQuantities'))
      return
    }
    
    setLoading(true)
    
    try {
      await api.createConversion(portfolioId, {
        tx_date: txDate,
        from_asset_id: fromAsset.id,
        from_quantity: parseFloat(fromQuantity),
        from_price: parseFloat(fromPrice) || 0,
        to_asset_id: toAsset.id,
        to_quantity: parseFloat(toQuantity),
        to_price: parseFloat(toPrice) || 0,
        fees: parseFloat(fees) || 0,
        currency: portfolioCurrency,
        notes: notes || null,
      })
      
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 
        'Failed to create conversion'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
              {t('conversion.title')}
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              {t('conversion.description')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error message */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              {t('fields.date')}
            </label>
            <input
              type="date"
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              required
            />
          </div>

          {/* Assets Selection */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-start">
            {/* From Asset */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {t('conversion.fromAsset')}
              </label>
              
              {fromAsset ? (
                <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <img
                    src={getAssetLogoUrl(fromAsset.symbol, 'CRYPTOCURRENCY', fromAsset.name)}
                    alt={fromAsset.symbol}
                    className="w-8 h-8 rounded-full"
                    onError={(e) => handleLogoError(e, fromAsset.symbol, cleanCryptoName(fromAsset.name), 'CRYPTOCURRENCY')}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-neutral-900 dark:text-white">{fromAsset.symbol}</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{fromAsset.name}</div>
                    {fromAsset.quantity !== undefined && (
                      <div className="text-xs text-red-600 dark:text-red-400 font-medium mt-0.5">
                        {t('conversion.youOwn')}: {fromAsset.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setFromAsset(null)}
                    className="p-1 text-neutral-400 hover:text-red-500"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="max-h-40 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
                    {portfolioAssets.length === 0 ? (
                      <div className="p-3 text-sm text-neutral-500 dark:text-neutral-400 text-center">
                        {t('conversion.noAssetsInPortfolio')}
                      </div>
                    ) : (
                      portfolioAssets.map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => handleSelectFromAsset(asset)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800 border-b border-neutral-100 dark:border-neutral-800 last:border-b-0"
                        >
                          <img
                            src={getAssetLogoUrl(asset.symbol, asset.asset_type, asset.name)}
                            alt={asset.symbol}
                            className="w-6 h-6 rounded-full"
                            onError={(e) => handleLogoError(e, asset.symbol, cleanCryptoName(asset.name), asset.asset_type || 'CRYPTOCURRENCY')}
                          />
                          <div className="text-left">
                            <div className="font-medium text-neutral-900 dark:text-white text-sm">{asset.symbol}</div>
                            <div className="text-xs text-neutral-500 dark:text-neutral-400">{asset.name}</div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Arrow */}
            <div className="hidden md:flex items-center justify-center pt-8">
              <div className="p-2 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full">
                <ArrowRight className="w-5 h-5 text-white" />
              </div>
            </div>

            {/* To Asset */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {t('conversion.toAsset')}
              </label>
              
              {toAsset ? (
                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <img
                    src={getAssetLogoUrl(toAsset.symbol, toAsset.asset_type, toAsset.name)}
                    alt={toAsset.symbol}
                    className="w-8 h-8 rounded-full"
                    onError={(e) => handleLogoError(e, toAsset.symbol, cleanCryptoName(toAsset.name), toAsset.asset_type || 'CRYPTOCURRENCY')}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-neutral-900 dark:text-white">{toAsset.symbol}</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{toAsset.name}</div>
                    {toAsset.quantity !== undefined && toAsset.quantity > 0 && (
                      <div className="text-xs text-green-600 dark:text-green-400 font-medium mt-0.5">
                        {t('conversion.youOwn')}: {toAsset.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setToAsset(null)}
                    className="p-1 text-neutral-400 hover:text-red-500"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      value={toSearch}
                      onChange={(e) => setToSearch(e.target.value)}
                      placeholder={t('conversion.searchAsset')}
                      className="w-full pl-10 pr-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    />
                  </div>
                  {toSearchResults.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {toSearchResults.map((ticker) => (
                        <button
                          key={ticker.symbol}
                          type="button"
                          onClick={() => handleSelectToAsset(ticker)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-700 border-b border-neutral-100 dark:border-neutral-700 last:border-b-0"
                        >
                          <img
                            src={getAssetLogoUrl(ticker.symbol, ticker.type, ticker.name)}
                            alt={ticker.symbol}
                            className="w-6 h-6 rounded-full"
                            onError={(e) => handleLogoError(e, ticker.symbol, cleanCryptoName(ticker.name), ticker.type || 'CRYPTOCURRENCY')}
                          />
                          <div className="text-left">
                            <div className="font-medium text-blue-600 dark:text-blue-400 text-sm">{ticker.symbol}</div>
                            <div className="text-xs text-neutral-500 dark:text-neutral-400">{ticker.name}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quantities and Prices */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* From side */}
            <div className="space-y-4 p-4 bg-red-50/50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30">
              <h4 className="font-medium text-red-700 dark:text-red-400">{t('conversion.youSend')}</h4>
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  {t('fields.quantity')}
                </label>
                <input
                  type="number"
                  step="any"
                  value={fromQuantity}
                  onChange={(e) => setFromQuantity(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  {t('fields.pricePerUnit')} ({portfolioCurrency})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={fromPrice}
                    onChange={(e) => setFromPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 pr-10 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                  />
                  {fromAsset && (
                    <button
                      type="button"
                      onClick={() => fetchPrice(fromAsset.symbol, true)}
                      disabled={fetchingFromPrice}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-pink-500 disabled:opacity-50"
                      title={t('conversion.fetchCurrentPrice')}
                    >
                      {fetchingFromPrice ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* To side */}
            <div className="space-y-4 p-4 bg-green-50/50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-900/30">
              <h4 className="font-medium text-green-700 dark:text-green-400">{t('conversion.youReceive')}</h4>
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  {t('fields.quantity')} <span className="text-neutral-400">({t('conversion.autoCalculated')})</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={toQuantity}
                  readOnly
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-white cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  {t('fields.pricePerUnit')} ({portfolioCurrency})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={toPrice}
                    onChange={(e) => setToPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 pr-10 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                  />
                  {toAsset && (
                    <button
                      type="button"
                      onClick={() => fetchPrice(toAsset.symbol, false)}
                      disabled={fetchingToPrice}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-pink-500 disabled:opacity-50"
                      title={t('conversion.fetchCurrentPrice')}
                    >
                      {fetchingToPrice ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Conversion Rate Display */}
          {getConversionRate() && fromAsset && toAsset && (
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                  {t('conversion.rate')}: 1 {fromAsset.symbol} = {getConversionRate()!.toFixed(8).replace(/\.?0+$/, '')} {toAsset.symbol}
                </span>
                <span className="text-xs text-purple-600 dark:text-purple-400">
                  1 {toAsset.symbol} = {(1 / getConversionRate()!).toFixed(8).replace(/\.?0+$/, '')} {fromAsset.symbol}
                </span>
              </div>
            </div>
          )}

          {/* Fees */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              {t('fields.fees')} ({portfolioCurrency})
            </label>
            <input
              type="number"
              step="any"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              {t('fields.notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('conversion.notesPlaceholder')}
              rows={2}
              className="w-full px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || !fromAsset || !toAsset}
              className="px-6 py-2.5 text-sm font-medium text-white bg-pink-500 hover:bg-pink-600 disabled:bg-neutral-400 rounded-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t('common.processing')}
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  {t('conversion.convert')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
