  // Normalize ticker by removing currency suffixes like -USD, -EUR, etc.
  const normalizeTickerForLogo = (symbol: string): string => {
    return symbol.replace(/-(USD|EUR|GBP|USDT|BUSD|JPY|CAD|AUD|CHF|CNY)$/i, '')
  }
import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api'
import { Plus, Trash2, Pencil, RefreshCw, Download, Upload, ShoppingCart, Eye, X } from 'lucide-react'

interface WatchlistItem {
  id: number
  user_id: number
  asset_id: number
  symbol: string
  name: string | null
  notes: string | null
  alert_target_price: number | null
  alert_enabled: boolean
  current_price: number | null
  daily_change_pct: number | null
  currency: string
  last_updated: string | null
  created_at: string
}

interface Portfolio {
  id: number
  name: string
}

export default function Watchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addSymbol, setAddSymbol] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ symbol: string; name: string; type?: string; exchange?: string }>>([])
  const [selectedTicker, setSelectedTicker] = useState<{ symbol: string; name: string; type?: string; exchange?: string } | null>(null)
  const [editingItem, setEditingItem] = useState<number | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [editAlertPrice, setEditAlertPrice] = useState('')
  const [editAlertEnabled, setEditAlertEnabled] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importType, setImportType] = useState<'csv' | 'json'>('csv')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [convertItem, setConvertItem] = useState<WatchlistItem | null>(null)
  const [convertPortfolioId, setConvertPortfolioId] = useState<number | null>(null)
  const [convertQuantity, setConvertQuantity] = useState('')
  const [convertPrice, setConvertPrice] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const openConvertModal = (item: WatchlistItem) => {
    setConvertItem(item)
    // Preselect first portfolio if not set
    if (!convertPortfolioId && portfolios.length > 0) {
      setConvertPortfolioId(portfolios[0].id)
    }
    // Autofill current price if available
    const p = toNumber(item.current_price)
    setConvertPrice(p !== null ? String(p) : '')
  }

  const getErrorMessage = (err: unknown, fallback = 'An unexpected error occurred') => {
    if (err instanceof Error) return err.message
    if (typeof err === 'string') return err
    try {
      return JSON.stringify(err)
    } catch {
      return fallback
    }
  }

  const toNumber = (val: unknown): number | null => {
    if (val === null || val === undefined) return null
    if (typeof val === 'number') return isNaN(val) ? null : val
    const n = parseFloat(String(val))
    return isNaN(n) ? null : n
  }

  const loadWatchlist = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getWatchlist()
      const normalized = data.map((d) => ({
        ...d,
        alert_target_price: toNumber(d.alert_target_price),
        current_price: toNumber(d.current_price),
        daily_change_pct: toNumber(d.daily_change_pct),
      })) as unknown as WatchlistItem[]
      setWatchlist(normalized)
      setError(null)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load watchlist'))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPortfolios = useCallback(async () => {
    try {
      const data = await api.getPortfolios()
      setPortfolios(data)
    } catch (err) {
      console.error('Failed to load portfolios:', err)
    }
  }, [])

  useEffect(() => {
    loadWatchlist()
    loadPortfolios()
  }, [loadWatchlist, loadPortfolios])

  // Ticker search logic (like Transactions page)
  const handleTickerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddSymbol(e.target.value)
    setSelectedTicker(null)
    if (e.target.value.length > 1) {
      try {
        const data = await api.searchTicker(e.target.value)
        setSearchResults(data)
      } catch (err) {
        setSearchResults([])
      }
    } else {
      setSearchResults([])
    }
  }

  const handleSelectTicker = (ticker: { symbol: string; name: string; type?: string; exchange?: string }) => {
    setSelectedTicker(ticker)
    setAddSymbol(ticker.symbol)
    setSearchResults([])
  }

  const handleAddSymbol = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addSymbol.trim()) return

    try {
      await api.addToWatchlist({
        symbol: addSymbol.toUpperCase(),
        notes: addNotes || undefined,
      })
      setAddSymbol('')
      setAddNotes('')
      setSelectedTicker(null)
      setSearchResults([])
      loadWatchlist()
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'Failed to add symbol'))
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await api.deleteWatchlistItem(id)
      await loadWatchlist()
      setDeleteConfirm(null)
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'Failed to delete item'))
    }
  }

  const startEdit = (item: WatchlistItem) => {
    setEditingItem(item.id)
    setEditNotes(item.notes || '')
    setEditAlertPrice(item.alert_target_price ? String(item.alert_target_price) : '')
    setEditAlertEnabled(item.alert_enabled)
  }

  const handleUpdate = async (id: number) => {
    try {
      await api.updateWatchlistItem(id, {
        notes: editNotes || undefined,
        alert_target_price: editAlertPrice ? parseFloat(editAlertPrice) : undefined,
        alert_enabled: editAlertEnabled,
      })
      setEditingItem(null)
      loadWatchlist()
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'Failed to update item'))
    }
  }

  const handleImportCSV = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/watchlist/import/csv', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Import failed')
      }

      const result = await response.json()
      alert(`Imported ${result.imported_count} items${result.warnings.length > 0 ? `\n\nWarnings:\n${result.warnings.join('\n')}` : ''}`)
      loadWatchlist()
      setShowImportModal(false)
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'Failed to import CSV'))
    }
  }

  const handleImportJSON = async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const result = await api.importWatchlistJSON(data)
      alert(`Imported ${result.imported_count} items${result.warnings.length > 0 ? `\n\nWarnings:\n${result.warnings.join('\n')}` : ''}`)
      loadWatchlist()
      setShowImportModal(false)
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'Failed to import JSON'))
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (importType === 'csv') {
      handleImportCSV(file)
    } else {
      handleImportJSON(file)
    }
  }

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      if (format === 'csv') {
        const blob = await api.exportWatchlistCSV()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `watchlist_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
      } else {
        const data = await api.exportWatchlistJSON()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `watchlist_${new Date().toISOString().split('T')[0]}.json`
        a.click()
      }
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'Failed to export'))
    }
  }

  const handleConvertToBuy = async () => {
    if (!convertItem || !convertPortfolioId || !convertQuantity || !convertPrice) {
      alert('Please fill in all fields')
      return
    }

    try {
      await api.convertWatchlistToBuy(convertItem.id, {
        portfolio_id: convertPortfolioId,
        quantity: parseFloat(convertQuantity),
        price: parseFloat(convertPrice),
        fees: 0,
      })
      setConvertItem(null)
      setConvertPortfolioId(null)
      setConvertQuantity('')
      setConvertPrice('')
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'Failed to convert to BUY'))
    }
  }

  const formatPrice = (price: number | null, currency: string) => {
    const n = toNumber(price as unknown)
    if (n === null) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(n)
  }

  // percentage formatting in table rows is done inline to match Dashboard style

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Eye className="text-pink-600" size={32} />
            Watchlist
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            Track assets you don't own yet, set alerts, and convert to investments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="btn flex items-center gap-2"
          >
            <Upload size={18} /> Import
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="btn flex items-center gap-2"
          >
            <Download size={18} /> Export CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            className="btn flex items-center gap-2"
          >
            <Download size={18} /> Export JSON
          </button>
          <button
            onClick={loadWatchlist}
            className="btn-primary flex items-center gap-2"
          >
            <RefreshCw size={18} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {/* Add Symbol Form with Ticker Search */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Add to Watchlist</h2>
        <form onSubmit={handleAddSymbol} className="flex gap-4 items-start">
          <div className="w-[40%] relative">
            <input
              type="text"
              placeholder="Search ticker (e.g., AAPL)..."
              value={addSymbol}
              onChange={handleTickerChange}
              className="input w-full"
              required
            />
            {searchResults.length > 0 && (
              <ul className="mt-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg shadow-lg max-h-60 overflow-y-auto absolute z-10 w-full">
                {searchResults.map((item) => (
                  <li
                    key={item.symbol}
                    className="p-3 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-neutral-200 dark:border-neutral-700 last:border-b-0"
                    onClick={() => handleSelectTicker(item)}
                  >
                    <div className="font-semibold text-blue-600 dark:text-blue-400">{item.symbol}</div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-400">{item.name}</div>
                  </li>
                ))}
              </ul>
            )}
            {selectedTicker && (
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="font-semibold text-blue-700 dark:text-blue-300">{selectedTicker.symbol}</div>
                <div className="text-sm text-blue-600 dark:text-blue-400">{selectedTicker.name}</div>
              </div>
            )}
          </div>
          <div className="w-[50%]">
            <input
              type="text"
              placeholder="Notes (optional)"
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
              className="input w-full"
            />
          </div>
          <div className="w-[10%]">
            <button
              type="submit"
              className="btn-primary flex items-center justify-center gap-2 w-full"
            >
              <Plus size={18} /> Add
            </button>
          </div>
        </form>
      </div>

      {/* Watchlist Table with Logo, Price, Daily Change */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Symbol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Daily Change %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Notes</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Alert</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {watchlist.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-neutral-500 dark:text-neutral-400">
                    No assets in your watchlist. Add symbols above to start tracking.
                  </td>
                </tr>
              ) : (
                watchlist.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap font-semibold text-neutral-900 dark:text-neutral-100">
                      <span className="flex items-center gap-2">
                        <img
                          src={`/logos/${normalizeTickerForLogo(item.symbol)}`}
                          alt={`${item.symbol} logo`}
                          className="w-8 h-8 object-cover"
                          style={{ borderRadius: 0 }}
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement
                            img.src = '/logos/default.svg'
                          }}
                        />
                        {item.symbol}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500 dark:text-neutral-400 max-w-xs truncate">{item.name || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-neutral-900 dark:text-neutral-100">{formatPrice(item.current_price, item.currency)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {(() => {
                        const raw = item.daily_change_pct as unknown as number | string | null
                        const num = typeof raw === 'number' ? raw : (raw === null ? null : parseFloat(String(raw)))
                        if (num !== null && !isNaN(num)) {
                          const isUp = num >= 0
                          return (
                            <div className={`text-sm font-medium ${isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {`${isUp ? '+' : ''}${num.toFixed(2)}%`}
                            </div>
                          )
                        }
                        return <div className="text-sm text-neutral-500 dark:text-neutral-400">-</div>
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      {editingItem === item.id ? (
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          className="input w-full text-sm"
                        />
                      ) : (
                        <div className="text-sm text-neutral-500 dark:text-neutral-400">{item.notes || '-'}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {editingItem === item.id ? (
                        <div className="space-y-1">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Target price"
                            value={editAlertPrice}
                            onChange={(e) => setEditAlertPrice(e.target.value)}
                            className="input w-full text-sm"
                          />
                          <label className="flex items-center text-xs">
                            <input
                              type="checkbox"
                              checked={editAlertEnabled}
                              onChange={(e) => setEditAlertEnabled(e.target.checked)}
                              className="mr-1"
                            />
                            Enabled
                          </label>
                        </div>
                      ) : item.alert_enabled && item.alert_target_price !== null ? (
                        <div className="text-sm font-medium">
                          <div>{formatPrice(item.alert_target_price, item.currency)}</div>
                          {(() => {
                            const currentPrice = toNumber(item.current_price)
                            const targetPrice = toNumber(item.alert_target_price)
                            if (currentPrice !== null && targetPrice !== null && currentPrice !== 0) {
                              const diffPct = ((targetPrice - currentPrice) / currentPrice) * 100
                              const isPositive = diffPct > 0
                              return (
                                <div className={`text-xs ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {isPositive ? '+' : ''}{diffPct.toFixed(2)}%
                                </div>
                              )
                            }
                            return null
                          })()}
                        </div>
                      ) : (
                        <div className="text-sm text-neutral-400">-</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {editingItem === item.id ? (
                          <>
                            <button
                              onClick={() => handleUpdate(item.id)}
                              className="btn-success"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingItem(null)}
                              className="btn"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(item)}
                              className="btn"
                              title="Edit"
                            >
                              <Pencil size={18} />
                            </button>
                            <button
                              onClick={() => openConvertModal(item)}
                              className="btn"
                              title="Convert to BUY"
                            >
                              <ShoppingCart size={18} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(item.id)}
                              className="btn-danger"
                              title="Delete"
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Import Watchlist</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Import Format</label>
                <select
                  value={importType}
                  onChange={(e) => setImportType(e.target.value as 'csv' | 'json')}
                  className="input w-full"
                >
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Select File</label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept={importType === 'csv' ? '.csv' : '.json'}
                  onChange={handleFileUpload}
                  className="input w-full"
                />
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {importType === 'csv' ? (
                  <p>CSV format: symbol,notes,alert_target_price,alert_enabled</p>
                ) : (
                  <p>JSON format: Array of objects with symbol, notes, alert_target_price, alert_enabled</p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to BUY Modal (styled like Transactions modal) */}
      {convertItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Convert to BUY</h2>
              <button
                onClick={() => {
                  setConvertItem(null)
                  setConvertPortfolioId(null)
                  setConvertQuantity('')
                  setConvertPrice('')
                }}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src={`/logos/${normalizeTickerForLogo(convertItem.symbol)}`}
                  alt={`${convertItem.symbol} logo`}
                  className="w-8 h-8 object-cover"
                  style={{ borderRadius: 0 }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logos/default.svg' }}
                />
                <div>
                  <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{convertItem.symbol}</div>
                  {convertItem.name && (
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">{convertItem.name}</div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Portfolio</label>
                <select
                  value={convertPortfolioId || ''}
                  onChange={(e) => setConvertPortfolioId(Number(e.target.value))}
                  className="input w-full"
                  required
                >
                  <option value="">Select Portfolio</option>
                  {portfolios.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Quantity</label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={convertQuantity}
                    onChange={(e) => setConvertQuantity(e.target.value)}
                    className="input w-full"
                    placeholder="0.0000"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Price ({convertItem.currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={convertPrice}
                    onChange={(e) => setConvertPrice(e.target.value)}
                    className="input w-full"
                    placeholder={toNumber(convertItem.current_price)?.toString() || '0.00'}
                    required
                  />
                  {toNumber(convertItem.current_price) !== null && (
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      Current: {new Intl.NumberFormat('en-US', { style: 'currency', currency: convertItem.currency || 'USD' }).format(toNumber(convertItem.current_price) || 0)}
                      {convertItem.last_updated ? ` • updated ${new Date(convertItem.last_updated).toLocaleString()}` : ''}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setConvertItem(null)
                    setConvertPortfolioId(null)
                    setConvertQuantity('')
                    setConvertPrice('')
                  }}
                  className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConvertToBuy}
                  className="flex-1 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors"
                >
                  Create BUY Transaction
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (matches Transactions style) */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
              Delete Watchlist Item
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              Are you sure you want to remove this asset from your watchlist? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
