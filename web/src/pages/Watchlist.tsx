import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../lib/api'
import { Plus, Trash2, Pencil, RefreshCw, Download, Upload, ShoppingCart, Eye, X, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { getAssetLogoUrl, handleLogoError } from '../lib/logoUtils'
import { formatCurrency } from '../lib/formatUtils'
import EmptyPortfolioPrompt from '../components/EmptyPortfolioPrompt'
import ImportProgressModal from '../components/ImportProgressModal'

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
  asset_type: string | null
  last_updated: string | null
  created_at: string
}

interface Portfolio {
  id: number
  name: string
}

const sortableColumns = [
  'symbol',
  'name',
  'current_price',
  'daily_change_pct',
  'alert_target_price',
] as const
type SortKey = typeof sortableColumns[number]
type SortDir = 'asc' | 'desc'

export default function Watchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addSymbol, setAddSymbol] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addFormError, setAddFormError] = useState<string | null>(null)
  const [addFormSuccess, setAddFormSuccess] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<Array<{ symbol: string; name: string; type?: string; exchange?: string }>>([])
  const [selectedTicker, setSelectedTicker] = useState<{ symbol: string; name: string; type?: string; exchange?: string } | null>(null)
  const [editingItem, setEditingItem] = useState<number | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [editAlertPrice, setEditAlertPrice] = useState('')
  const [editAlertEnabled, setEditAlertEnabled] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showImportProgress, setShowImportProgress] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [convertItem, setConvertItem] = useState<WatchlistItem | null>(null)
  const [convertPortfolioId, setConvertPortfolioId] = useState<number | null>(null)
  const [convertQuantity, setConvertQuantity] = useState('')
  const [convertPrice, setConvertPrice] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('symbol')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Prevent body scroll when modals are open
  useEffect(() => {
    if (showAddModal || showImportModal || showImportProgress || convertItem || deleteConfirm) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showAddModal, showImportModal, showImportProgress, convertItem, deleteConfirm])

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

  const handleRefreshPrices = async () => {
    try {
      setLoading(true)
      await api.refreshWatchlistPrices()
      await loadWatchlist()
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to refresh prices'))
    } finally {
      setLoading(false)
    }
  }

  const loadPortfolios = useCallback(async () => {
    try {
      const data = await api.getPortfolios()
      setPortfolios(data)
    } catch (err) {
      console.error('Failed to load portfolios:', err)
    }
  }, [])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedWatchlist = useMemo(() => {
    const keyTypes = {
      symbol: 'string',
      name: 'string',
      current_price: 'number',
      daily_change_pct: 'number',
      alert_target_price: 'number',
    } as const satisfies Record<SortKey, 'string' | 'number'>

    const dir = sortDir === 'asc' ? 1 : -1

    return [...watchlist].sort((a, b) => {
      const aVal = a[sortKey as keyof WatchlistItem] as string | number | null | undefined
      const bVal = b[sortKey as keyof WatchlistItem] as string | number | null | undefined

      const aNull = aVal === null || aVal === undefined
      const bNull = bVal === null || bVal === undefined
      if (aNull && bNull) return 0
      if (aNull) return 1
      if (bNull) return -1

      if (keyTypes[sortKey] === 'string') {
        const sa = String(aVal).toLowerCase()
        const sb = String(bVal).toLowerCase()
        return sa.localeCompare(sb) * dir
      }

      const na = Number(aVal)
      const nb = Number(bVal)
      if (isNaN(na) && isNaN(nb)) return 0
      if (isNaN(na)) return 1
      if (isNaN(nb)) return -1
      return (na - nb) * dir
    })
  }, [watchlist, sortKey, sortDir])

  const isActive = (key: SortKey) => sortKey === key
  const SortIcon = ({ col }: { col: SortKey }) => {
    const active = isActive(col)
    if (!active) return <ArrowUpDown size={14} className="inline ml-1 opacity-40" />
    return sortDir === 'asc' 
      ? <ChevronUp size={14} className="inline ml-1 opacity-80" />
      : <ChevronDown size={14} className="inline ml-1 opacity-80" />
  }

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

    // Clear previous messages
    setAddFormError(null)
    setAddFormSuccess(null)

    try {
      await api.addToWatchlist({
        symbol: addSymbol.toUpperCase(),
        notes: addNotes || undefined,
      })
      
      // Success - close modal and clear form
      setShowAddModal(false)
      setAddSymbol('')
      setAddNotes('')
      setSelectedTicker(null)
      setSearchResults([])
      
      // Reload watchlist
      loadWatchlist()
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err, 'Failed to add symbol')
      setAddFormError(errorMsg)
      
      // Clear error message after 5 seconds
      setTimeout(() => setAddFormError(null), 5000)
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
        notes: editNotes || null,  // Send null to clear, or the note text
        alert_target_price: editAlertPrice ? parseFloat(editAlertPrice) : null,  // Send null to clear
        alert_enabled: editAlertEnabled,
      })
      setEditingItem(null)
      loadWatchlist()
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'Failed to update item'))
    }
  }

  const handleImportClick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      setImportFile(file)
      setShowImportProgress(true)
      setShowImportModal(false)
    }
    input.click()
  }

  const handleImportComplete = useCallback(() => {
    // Don't reload here - just mark as complete
    // The watchlist will be reloaded when the modal closes
  }, [])

  const handleImportClose = useCallback(() => {
    setShowImportProgress(false)
    setImportFile(null)
    // Reload watchlist after modal closes
    loadWatchlist()
  }, [loadWatchlist])

  const handleExportClick = async () => {
    try {
      const blob = await api.exportWatchlistCSV()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `watchlist_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
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
    return formatCurrency(n, currency)
  }

  // percentage formatting in table rows is done inline to match Dashboard style

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <Eye className="text-pink-600" size={28} />
              Watchlist
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
              Loading your watchlist...
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-10 w-24 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse"></div>
            <div className="h-10 w-28 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse"></div>
            <div className="h-10 w-32 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse"></div>
            <div className="h-10 w-24 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse"></div>
          </div>
        </div>

        {/* Add Form Skeleton */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Add to Watchlist</h2>
          <div className="flex gap-4">
            <div className="w-[40%] h-10 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse"></div>
            <div className="w-[50%] h-10 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse"></div>
            <div className="w-[10%] h-10 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse"></div>
          </div>
        </div>

        {/* Table Skeleton */}
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
                {[1, 2, 3, 4].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                        <div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-700 rounded"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-700 rounded"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  if (portfolios.length === 0) {
    return <EmptyPortfolioPrompt pageType="watchlist" />
  }

  return (
    <div className="space-y-8">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Eye className="text-pink-600" size={28} />
            Watchlist
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
            Track assets you don't own yet, set alerts, and convert to investments.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button 
            onClick={handleImportClick}
            className="btn-secondary flex items-center gap-2 text-sm px-3 py-2"
          >
            <Upload size={16} />
            <span className="hidden sm:inline">Import</span>
          </button>
          <button 
            onClick={handleExportClick}
            className="btn-secondary flex items-center gap-2 text-sm px-3 py-2"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={handleRefreshPrices}
            className="btn-secondary flex items-center gap-2 text-sm px-3 py-2"
          >
            <RefreshCw size={16} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button 
            onClick={() => setShowAddModal(true)} 
            className="btn-primary flex items-center gap-2 text-sm px-3 py-2"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Add to Watchlist</span>
            <span className="sm:hidden">Add</span>
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

      {/* Watchlist Table with Logo, Price, Daily Change */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
              <tr>
                <th 
                  onClick={() => handleSort('symbol')}
                  aria-sort={isActive('symbol') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  Symbol <SortIcon col="symbol" />
                </th>
                <th 
                  onClick={() => handleSort('name')}
                  aria-sort={isActive('name') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  Name <SortIcon col="name" />
                </th>
                <th 
                  onClick={() => handleSort('current_price')}
                  aria-sort={isActive('current_price') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  Price <SortIcon col="current_price" />
                </th>
                <th 
                  onClick={() => handleSort('daily_change_pct')}
                  aria-sort={isActive('daily_change_pct') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  Daily Change % <SortIcon col="daily_change_pct" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Notes</th>
                <th 
                  onClick={() => handleSort('alert_target_price')}
                  aria-sort={isActive('alert_target_price') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  Alert <SortIcon col="alert_target_price" />
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {sortedWatchlist.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-neutral-500 dark:text-neutral-400">
                    No assets in your watchlist. Add symbols above to start tracking.
                  </td>
                </tr>
              ) : (
                sortedWatchlist.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap font-semibold text-neutral-900 dark:text-neutral-100">
                      <span className="flex items-center gap-2">
                        <img
                          src={getAssetLogoUrl(item.symbol, item.asset_type, item.name)}
                          alt={`${item.symbol} logo`}
                          className="w-8 h-8 object-cover"
                          style={{ borderRadius: 0 }}
                          onLoad={(e) => {
                            const img = e.currentTarget as HTMLImageElement
                            if (img.dataset.validated) return
                            img.dataset.validated = 'true'
                            try {
                              const canvas = document.createElement('canvas')
                              const ctx = canvas.getContext('2d')
                              if (!ctx) return
                              const w = Math.min(img.naturalWidth || 0, 64) || 32
                              const h = Math.min(img.naturalHeight || 0, 64) || 32
                              if (w === 0 || h === 0) return
                              canvas.width = w
                              canvas.height = h
                              ctx.drawImage(img, 0, 0, w, h)
                              const data = ctx.getImageData(0, 0, w, h).data
                              let opaque = 0
                              for (let i = 0; i < data.length; i += 4) {
                                const a = data[i + 3]
                                if (a > 8) opaque++
                              }
                              const total = (data.length / 4) || 1
                              if (opaque / total < 0.01) {
                                img.dispatchEvent(new Event('error'))
                              }
                            } catch {
                              // Ignore canvas/security errors
                            }
                          }}
                          onError={(e) => handleLogoError(e, item.symbol, item.name, item.asset_type)}
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
                          const colorClass = num > 0 
                            ? 'text-green-600 dark:text-green-400' 
                            : num < 0 
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-neutral-600 dark:text-neutral-400'
                          return (
                            <div className={`text-sm font-medium ${colorClass}`}>
                              {`${num > 0 ? '+' : num < 0 ? '' : '+'}${num.toFixed(2)}%`}
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
                              className="btn-primary"
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
                              className="btn hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              title="Edit"
                            >
                              <Pencil size={18} className="text-blue-600 dark:text-blue-400" />
                            </button>
                            <button
                              onClick={() => openConvertModal(item)}
                              className="btn hover:bg-green-50 dark:hover:bg-green-900/20"
                              title="Convert to BUY"
                            >
                              <ShoppingCart size={18} className="text-green-600 dark:text-green-400" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(item.id)}
                              className="btn hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Delete"
                            >
                              <Trash2 size={18} className="text-red-600 dark:text-red-400" />
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
        <div className="modal-overlay bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Import Watchlist</h2>
            <div className="space-y-4">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Import your watchlist from a CSV file. Click the button below to select a file.
              </p>
              <div className="text-xs bg-neutral-100 dark:bg-neutral-800 p-3 rounded">
                <strong>CSV format:</strong>
                <br />
                <code className="text-xs">symbol,notes,alert_target_price,alert_enabled</code>
                <br />
                <code className="text-xs">AAPL,Watch for earnings,150.00,true</code>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="btn"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleImportClick()
                  setShowImportModal(false)
                }}
                className="btn-primary"
              >
                Select CSV File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Progress Modal */}
      <ImportProgressModal
        isOpen={showImportProgress}
        onClose={handleImportClose}
        onComplete={handleImportComplete}
        file={importFile}
        apiEndpoint="/api/watchlist/import/csv/stream"
      />

      {/* Convert to BUY Modal (styled like Transactions modal) */}
      {convertItem && (
        <div className="modal-overlay bg-black/50 flex items-center justify-center z-50 p-4">
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
                  src={getAssetLogoUrl(convertItem.symbol, convertItem.asset_type, convertItem.name)}
                  alt={`${convertItem.symbol} logo`}
                  className="w-8 h-8 object-cover"
                  style={{ borderRadius: 0 }}
                  onLoad={(e) => {
                    const img = e.currentTarget as HTMLImageElement
                    if (img.dataset.validated) return
                    img.dataset.validated = 'true'
                    try {
                      const canvas = document.createElement('canvas')
                      const ctx = canvas.getContext('2d')
                      if (!ctx) return
                      const w = Math.min(img.naturalWidth || 0, 64) || 32
                      const h = Math.min(img.naturalHeight || 0, 64) || 32
                      if (w === 0 || h === 0) return
                      canvas.width = w
                      canvas.height = h
                      ctx.drawImage(img, 0, 0, w, h)
                      const data = ctx.getImageData(0, 0, w, h).data
                      let opaque = 0
                      for (let i = 0; i < data.length; i += 4) {
                        const a = data[i + 3]
                        if (a > 8) opaque++
                      }
                      const total = (data.length / 4) || 1
                      if (opaque / total < 0.01) {
                        img.dispatchEvent(new Event('error'))
                      }
                    } catch {
                      // Ignore canvas/security errors
                    }
                  }}
                  onError={(e) => handleLogoError(e, convertItem.symbol, convertItem.name, convertItem.asset_type)}
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
        <div className="modal-overlay bg-black/50 flex items-center justify-center z-50 p-4">
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

      {/* Add to Watchlist Modal */}
      {showAddModal && (
        <div className="modal-overlay bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                Add to Watchlist
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setAddSymbol('')
                  setAddNotes('')
                  setSearchResults([])
                  setSelectedTicker(null)
                  setAddFormError(null)
                  setAddFormSuccess(null)
                }}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddSymbol} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Ticker Symbol
                </label>
                <input
                  type="text"
                  value={addSymbol}
                  onChange={handleTickerChange}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  placeholder="Search ticker (e.g., AAPL)..."
                  required
                />
                {searchResults.length > 0 && (
                  <ul className="mt-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
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

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  placeholder="Add any notes..."
                />
              </div>

              {addFormError && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm text-amber-800 dark:text-amber-200">{addFormError}</p>
                </div>
              )}

              {addFormSuccess && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm text-green-800 dark:text-green-200">{addFormSuccess}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setAddSymbol('')
                    setAddNotes('')
                    setSearchResults([])
                    setSelectedTicker(null)
                    setAddFormError(null)
                    setAddFormSuccess(null)
                  }}
                  className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors"
                >
                  Add to Watchlist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
