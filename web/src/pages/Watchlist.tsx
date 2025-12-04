import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../lib/api'
import { Plus, Trash2, Pencil, RefreshCw, Download, Upload, ShoppingCart, Eye, X, ChevronUp, ChevronDown, Tag, Filter } from 'lucide-react'
import { getAssetLogoUrl, handleLogoError, validateLogoImage } from '../lib/logoUtils'
import { formatCurrency } from '../lib/formatUtils'
import EmptyPortfolioPrompt from '../components/EmptyPortfolioPrompt'
import ImportProgressModal from '../components/ImportProgressModal'
import SortIcon from '../components/SortIcon'
import WatchlistTagManager, { IconComponent } from '../components/WatchlistTagManager'
import WatchlistTagSelector from '../components/WatchlistTagSelector'
import { useTranslation } from 'react-i18next'

interface WatchlistTag {
  id: number
  user_id: number
  name: string
  icon: string
  color: string
  created_at: string
  updated_at: string
}

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
  tags: WatchlistTag[]
}

interface Portfolio {
  id: number
  name: string
  base_currency: string
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
  const [tags, setTags] = useState<WatchlistTag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showTagManager, setShowTagManager] = useState(false)
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
  const [editItemTags, setEditItemTags] = useState<number[]>([])
  const [showImportModal, setShowImportModal] = useState(false)
  const [showImportProgress, setShowImportProgress] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [convertItem, setConvertItem] = useState<WatchlistItem | null>(null)
  const [convertPortfolioId, setConvertPortfolioId] = useState<number | null>(null)
  const [convertQuantity, setConvertQuantity] = useState('')
  const [convertPrice, setConvertPrice] = useState('')
  const [convertFees, setConvertFees] = useState('0')
  const [convertDate, setConvertDate] = useState(new Date().toISOString().split('T')[0])
  const [convertPriceLoading, setConvertPriceLoading] = useState(false)
  const [convertPriceInfo, setConvertPriceInfo] = useState<{ converted: boolean; asset_currency: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('symbol')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const { t } = useTranslation()

  // Prevent body scroll when modals are open
  useEffect(() => {
    if (showAddModal || showImportModal || showImportProgress || convertItem || deleteConfirm || showTagManager) {
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
    // Reset convert modal state
    setConvertDate(new Date().toISOString().split('T')[0])
    setConvertPrice('')
    setConvertPriceInfo(null)
    // Preselect first portfolio if not set
    const portfolioId = convertPortfolioId || (portfolios.length > 0 ? portfolios[0].id : null)
    if (portfolioId) {
      setConvertPortfolioId(portfolioId)
      // Fetch price for selected portfolio and today's date
      fetchConvertPrice(portfolioId, item.symbol, new Date().toISOString().split('T')[0])
    }
  }

  // Fetch price converted to portfolio currency (same logic as Transactions page)
  const fetchConvertPrice = useCallback(async (portfolioId: number, symbol: string, date: string) => {
    if (!portfolioId || !symbol || !date) return
    
    setConvertPriceLoading(true)
    setConvertPriceInfo(null)
    try {
      const result = await api.fetchPriceForDate(portfolioId, symbol, date)
      setConvertPrice(String(result.price))
      setConvertPriceInfo({
        converted: result.converted,
        asset_currency: result.asset_currency
      })
    } catch (err) {
      console.error("Failed to fetch price:", err)
      // Don't show error - user can still enter price manually
    } finally {
      setConvertPriceLoading(false)
    }
  }, [])

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

  const loadWatchlist = useCallback(async (filterTagIds?: number[]) => {
    try {
      setLoading(true)
      const data = await api.getWatchlist(filterTagIds)
      const normalized = data.map((d) => ({
        ...d,
        alert_target_price: toNumber(d.alert_target_price),
        current_price: toNumber(d.current_price),
        daily_change_pct: toNumber(d.daily_change_pct),
        tags: d.tags || [],
      })) as unknown as WatchlistItem[]
      setWatchlist(normalized)
      setError(null)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load watchlist'))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadTags = useCallback(async () => {
    try {
      const data = await api.getWatchlistTags()
      setTags(data)
    } catch (err) {
      console.error('Failed to load tags:', err)
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

  // Get human-readable label for sort key
  const getSortLabel = (key: SortKey): string => {
    const labels: Record<SortKey, string> = {
      symbol: 'Symbol',
      name: 'Name',
      current_price: 'Price',
      daily_change_pct: 'Daily Change %',
      alert_target_price: 'Alert Price',
    }
    return labels[key]
  }

  useEffect(() => {
    loadWatchlist(selectedTagIds.length > 0 ? selectedTagIds : undefined)
    loadPortfolios()
    loadTags()
  }, [loadWatchlist, loadPortfolios, loadTags])

  // Re-load watchlist when tag filter changes
  useEffect(() => {
    loadWatchlist(selectedTagIds.length > 0 ? selectedTagIds : undefined)
  }, [selectedTagIds, loadWatchlist])

  // Handle tag filter change
  const handleTagFilterChange = (tagId: number) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }

  const clearTagFilter = () => {
    setSelectedTagIds([])
  }

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
    setEditItemTags(item.tags?.map(t => t.id) || [])
  }

  const handleUpdate = async (id: number) => {
    try {
      // Update the watchlist item
      await api.updateWatchlistItem(id, {
        notes: editNotes || null,  // Send null to clear, or the note text
        alert_target_price: editAlertPrice ? parseFloat(editAlertPrice) : null,  // Send null to clear
        alert_enabled: editAlertEnabled,
      })
      // Update tags separately
      await api.updateWatchlistItemTags(id, editItemTags)
      setEditingItem(null)
      loadWatchlist(selectedTagIds.length > 0 ? selectedTagIds : undefined)
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

    // Get the selected portfolio's currency
    const selectedPortfolio = portfolios.find(p => p.id === convertPortfolioId)
    const currency = selectedPortfolio?.base_currency || 'USD'

    try {
      await api.convertWatchlistToBuy(convertItem.id, {
        portfolio_id: convertPortfolioId,
        quantity: parseFloat(convertQuantity),
        price: parseFloat(convertPrice),
        fees: parseFloat(convertFees) || 0,
        tx_date: convertDate,
        currency: currency,
      })
      setConvertItem(null)
      setConvertPortfolioId(null)
      setConvertQuantity('')
      setConvertPrice('')
      setConvertFees('0')
      setConvertDate(new Date().toISOString().split('T')[0])
      setConvertPriceInfo(null)
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'Failed to convert to BUY'))
    }
  }

  // Handle portfolio change - refetch price in new portfolio currency
  const handleConvertPortfolioChange = (portfolioId: number) => {
    setConvertPortfolioId(portfolioId)
    if (convertItem) {
      fetchConvertPrice(portfolioId, convertItem.symbol, convertDate)
    }
  }

  // Handle date change - refetch price
  const handleConvertDateChange = (newDate: string) => {
    setConvertDate(newDate)
    if (convertItem && convertPortfolioId) {
      fetchConvertPrice(convertPortfolioId, convertItem.symbol, newDate)
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
              {t('watchlist.title')}
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
              {t('watchlist.loadingMessage')}
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
          <h2 className="text-lg font-semibold mb-4">{t('watchlist.addToWatchlist')}</h2>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{t('fields.symbol')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{t('fields.name')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{t('fields.price')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{t('watchlist.dailyChange')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{t('fields.notes')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{t('watchlist.alert')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{t('common.actions')}</th>
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
            {t('watchlist.title')}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
            {t('watchlist.description')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button 
            onClick={handleImportClick}
            className="btn-secondary flex items-center gap-2 text-sm px-3 py-2"
          >
            <Upload size={16} />
            <span className="hidden sm:inline">{t('common.import')}</span>
          </button>
          <button 
            onClick={handleExportClick}
            className="btn-secondary flex items-center gap-2 text-sm px-3 py-2"
          >
            <Download size={16} />
            <span className="hidden sm:inline">{t('common.export')}</span>
          </button>
          <button
            onClick={handleRefreshPrices}
            className="btn-secondary flex items-center gap-2 text-sm px-3 py-2"
          >
            <RefreshCw size={16} />
            <span className="hidden sm:inline">{t('common.refresh')}</span>
          </button>
          <button 
            onClick={() => setShowAddModal(true)} 
            className="btn-primary flex items-center gap-2 text-sm px-3 py-2"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">{t('watchlist.addToWatchlist')}</span>
            <span className="sm:hidden">{t('common.add')}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">
            <strong>{t('common.error')}:</strong> {error}
          </p>
        </div>
      )}

      {/* Tag Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 pb-2">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-neutral-500" />
          <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            {t('watchlist.tags.filterByTags')}:
          </span>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {tags.map(tag => (
            <button
              key={tag.id}
              onClick={() => handleTagFilterChange(tag.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                selectedTagIds.includes(tag.id)
                  ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-neutral-900'
                  : 'opacity-70 hover:opacity-100'
              }`}
              style={{ 
                backgroundColor: tag.color + '20', 
                color: tag.color,
                ...(selectedTagIds.includes(tag.id) ? { ringColor: tag.color } : {})
              }}
            >
              <IconComponent name={tag.icon} size={12} />
              {tag.name}
            </button>
          ))}
          
          {selectedTagIds.length > 0 && (
            <button
              onClick={clearTagFilter}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              <X size={12} />
              {t('common.clear')}
            </button>
          )}
        </div>

        <button
          onClick={() => setShowTagManager(true)}
          className="ml-auto btn-secondary flex items-center gap-1.5 text-xs px-2.5 py-1.5"
        >
          <Tag size={14} />
          {t('watchlist.tags.manageTags')}
        </button>
      </div>

      {/* Watchlist Table with Logo, Price, Daily Change */}
      <div>
        <>
          {/* Mobile: Sort Controls & Card Layout */}
          <div className="lg:hidden">
            {/* Sort Controls */}
            <div className="flex items-center gap-2 mb-3">
              <label htmlFor="mobile-sort-watchlist" className="text-sm font-medium text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                {t('common.sortBy')}:
              </label>
              <select
                id="mobile-sort-watchlist"
                value={sortKey}
                onChange={(e) => handleSort(e.target.value as SortKey)}
                className="flex-1 input text-sm py-2 px-3"
              >
                {sortableColumns.map((option) => (
                  <option key={option} value={option}>
                    {getSortLabel(option)}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                className="btn-secondary p-2 flex items-center gap-1"
                title={sortDir === 'asc' ? 'Sort Descending' : 'Sort Ascending'}
              >
                {sortDir === 'asc' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
            </div>

            {/* Cards */}
            <div className="space-y-3">
              {sortedWatchlist.length === 0 ? (
                <div className="card text-center py-12 text-neutral-500 dark:text-neutral-400">
                  {t('watchlist.empty.noWatchlistAssets')}
                </div>
              ) : (
                sortedWatchlist.map((item) => {
                  const raw = item.daily_change_pct as unknown as number | string | null
                  const changeNum = typeof raw === 'number' ? raw : (raw === null ? null : parseFloat(String(raw)))
                  const changeColor = changeNum !== null && !isNaN(changeNum)
                    ? (changeNum > 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : changeNum < 0 
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-neutral-600 dark:text-neutral-400')
                    : 'text-neutral-500 dark:text-neutral-400'

                  return (
                    <div key={item.id} className="card p-4">
                      {/* Header: Logo, Symbol, Price & Change */}
                      <div className="flex items-start justify-between mb-3 pb-3 border-b border-neutral-200 dark:border-neutral-700">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <img
                            src={getAssetLogoUrl(item.symbol, item.asset_type, item.name)}
                            alt={`${item.symbol} logo`}
                            className="w-10 h-10 flex-shrink-0 object-cover"
                            style={{ borderRadius: 0 }}
                            onLoad={(e) => {
                              const img = e.currentTarget as HTMLImageElement
                              if (!validateLogoImage(img)) {
                                img.dispatchEvent(new Event('error'))
                              }
                            }}
                            onError={(e) => handleLogoError(e, item.symbol, item.name, item.asset_type)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                              {item.symbol}
                            </div>
                            <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                              {item.name || 'N/A'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right ml-3">
                          <div className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                            {formatPrice(item.current_price, item.currency)}
                          </div>
                          <div className={`text-sm font-semibold ${changeColor}`}>
                            {changeNum !== null && !isNaN(changeNum)
                              ? `${changeNum > 0 ? '+' : changeNum < 0 ? '' : '+'}${changeNum.toFixed(2)}%`
                              : '-'}
                          </div>
                        </div>
                      </div>

                      {/* Data Grid / Edit Form */}
                      {editingItem === item.id ? (
                        <div className="space-y-3 text-sm">
                          <div>
                            <label className="text-neutral-500 dark:text-neutral-400 text-xs block mb-1">
                              {t('fields.notes')}
                            </label>
                            <textarea
                              placeholder={t('fields.notes')}
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              className="input w-full text-sm"
                              rows={2}
                            />
                          </div>
                          <div>
                            <label className="text-neutral-500 dark:text-neutral-400 text-xs block mb-1">
                              {t('watchlist.alertTargetPrice')}
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder={t('watchlist.alertTargetPrice')}
                              value={editAlertPrice}
                              onChange={(e) => setEditAlertPrice(e.target.value)}
                              className="input w-full text-sm"
                            />
                          </div>
                          <label className="flex items-center text-sm">
                            <input
                              type="checkbox"
                              checked={editAlertEnabled}
                              onChange={(e) => setEditAlertEnabled(e.target.checked)}
                              className="mr-2"
                            />
                            <span className="text-neutral-700 dark:text-neutral-300">{t('watchlist.alertEnabled')}</span>
                          </label>
                          <div>
                            <label className="text-neutral-500 dark:text-neutral-400 text-xs block mb-1">
                              {t('watchlist.tags.title')}
                            </label>
                            <WatchlistTagSelector
                              availableTags={tags}
                              selectedTagIds={editItemTags}
                              onChange={setEditItemTags}
                              placeholder={t('watchlist.tags.selectTags')}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-y-2.5 text-sm">
                          {item.tags && item.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {item.tags.map(tag => (
                                <span
                                  key={tag.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                                  style={{ backgroundColor: tag.color + '20', color: tag.color }}
                                >
                                  <IconComponent name={tag.icon} size={10} />
                                  {tag.name}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.notes && (
                            <div>
                              <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('fields.notes')}</span>
                              <div className="text-neutral-900 dark:text-neutral-100 mt-1">
                                {item.notes}
                              </div>
                            </div>
                          )}
                          {item.alert_target_price && (
                            <div>
                              <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('watchlist.alertPrice')}</span>
                              <div className="text-neutral-900 dark:text-neutral-100 mt-1 flex items-center gap-2">
                                {formatPrice(item.alert_target_price, item.currency)}
                                {item.alert_enabled && (
                                  <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                                    {t('common.enabled')}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                        {editingItem === item.id ? (
                          <>
                            <button
                              onClick={() => handleUpdate(item.id)}
                              className="btn-secondary text-xs px-3 py-2 bg-green-600 text-white hover:bg-green-700 flex items-center gap-1.5"
                            >
                              {t('common.save')}
                            </button>
                            <button
                              onClick={() => setEditingItem(null)}
                              className="btn-secondary text-xs px-3 py-2"
                            >
                              {t('common.cancel')}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(item)}
                              className="btn-secondary text-xs px-2 py-1.5 flex items-center gap-1.5"
                            >
                              <Pencil size={14} />
                              {t('common.edit')}
                            </button>
                            <button
                              onClick={() => openConvertModal(item)}
                              className="btn-secondary text-xs px-2 py-1.5 flex items-center gap-1.5"
                            >
                              <ShoppingCart size={14} />
                              {t('watchlist.buy')}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(item.id)}
                              className="btn-secondary text-xs px-2 py-1.5 flex items-center gap-1.5 text-red-600 dark:text-red-400"
                            >
                              <Trash2 size={14} />
                              {t('common.delete')}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Desktop: Table Layout */}
          <div className="hidden lg:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
              <tr>
                <th 
                  onClick={() => handleSort('symbol')}
                  aria-sort={isActive('symbol') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  {t('fields.symbol')} <SortIcon column="symbol" activeColumn={sortKey} direction={sortDir} />
                </th>
                <th 
                  onClick={() => handleSort('name')}
                  aria-sort={isActive('name') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  {t('fields.name')} <SortIcon column="name" activeColumn={sortKey} direction={sortDir} />
                </th>
                <th 
                  onClick={() => handleSort('current_price')}
                  aria-sort={isActive('current_price') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  {t('fields.price')} <SortIcon column="current_price" activeColumn={sortKey} direction={sortDir} />
                </th>
                <th 
                  onClick={() => handleSort('daily_change_pct')}
                  aria-sort={isActive('daily_change_pct') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  {t('watchlist.dailyChange')} <SortIcon column="daily_change_pct" activeColumn={sortKey} direction={sortDir} />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Notes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{t('watchlist.tags.title')}</th>
                <th 
                  onClick={() => handleSort('alert_target_price')}
                  aria-sort={isActive('alert_target_price') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  {t('watchlist.alert')} <SortIcon column="alert_target_price" activeColumn={sortKey} direction={sortDir} />
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {sortedWatchlist.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-neutral-500 dark:text-neutral-400">
                    {t('watchlist.empty.noWatchlistAssets')}
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
                            if (!validateLogoImage(img)) {
                              img.dispatchEvent(new Event('error'))
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
                          placeholder={t('placeholders.enterNotes')}
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          className="input w-full text-sm"
                        />
                      ) : (
                        <div className="text-sm text-neutral-500 dark:text-neutral-400">{item.notes || '-'}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingItem === item.id ? (
                        <WatchlistTagSelector
                          availableTags={tags}
                          selectedTagIds={editItemTags}
                          onChange={setEditItemTags}
                          compact
                        />
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {item.tags && item.tags.length > 0 ? (
                            item.tags.map(tag => (
                              <span
                                key={tag.id}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs"
                                style={{ backgroundColor: tag.color + '20', color: tag.color }}
                              >
                                <IconComponent name={tag.icon} size={10} />
                                {tag.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-neutral-400 text-sm">-</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {editingItem === item.id ? (
                        <div className="space-y-1">
                          <input
                            type="number"
                            step="0.01"
                            placeholder={t('watchlist.targetPrice')}
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
                            {t('common.enabled')}
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
                              {t('common.save')}
                            </button>
                            <button
                              onClick={() => setEditingItem(null)}
                              className="btn"
                            >
                              {t('common.cancel')}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(item)}
                              className="btn hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              title={t('common.edit')}
                            >
                              <Pencil size={18} className="text-blue-600 dark:text-blue-400" />
                            </button>
                            <button
                              onClick={() => openConvertModal(item)}
                              className="btn hover:bg-green-50 dark:hover:bg-green-900/20"
                              title={t('watchlist.convertToBuy')}
                            >
                              <ShoppingCart size={18} className="text-green-600 dark:text-green-400" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(item.id)}
                              className="btn hover:bg-red-50 dark:hover:bg-red-900/20"
                              title={t('common.delete')}
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
        </>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">{t('watchlist.importTitle')}</h2>
            <div className="space-y-4">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {t('watchlist.importDescription')}
              </p>
              <div className="text-xs bg-neutral-100 dark:bg-neutral-800 p-3 rounded">
                <strong>{t('watchlist.importFormatInfo')}:</strong>
                <br />
                <code className="text-xs">symbol,notes,alert_target_price,alert_enabled</code>
                <br />
                <code className="text-xs">{t('watchlist.importFormat')}</code>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="btn"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  handleImportClick()
                  setShowImportModal(false)
                }}
                className="btn-primary"
              >
                {t('watchlist.selectFile')}
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

      {/* Convert to BUY Modal */}
      {convertItem && (
        <div className="modal-overlay bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t('watchlist.convertToBuy')}</h2>
              <button
                onClick={() => {
                  setConvertItem(null)
                  setConvertPortfolioId(null)
                  setConvertQuantity('')
                  setConvertPrice('')
                  setConvertDate(new Date().toISOString().split('T')[0])
                  setConvertPriceInfo(null)
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
                    if (!validateLogoImage(img)) {
                      img.dispatchEvent(new Event('error'))
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
                <label className="block text-sm font-medium mb-1">{t('fields.portfolio')}</label>
                <select
                  value={convertPortfolioId || ''}
                  onChange={(e) => handleConvertPortfolioChange(Number(e.target.value))}
                  className="input w-full"
                  required
                >
                  {portfolios.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.base_currency})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('fields.date')}</label>
                <input
                  type="date"
                  value={convertDate}
                  onChange={(e) => handleConvertDateChange(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="input w-full"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('fields.quantity')}</label>
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
                  <label className="block text-sm font-medium mb-1">
                    {t('fields.price')} ({portfolios.find((p) => p.id === convertPortfolioId)?.base_currency || 'USD'})
                    {convertPriceLoading && <span className="ml-2 text-xs text-neutral-500">...</span>}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={convertPrice}
                    onChange={(e) => setConvertPrice(e.target.value)}
                    className="input w-full"
                    placeholder="0.00"
                    required
                  />
                  {convertPriceInfo?.converted && (
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                      ✓ {t('transactions.priceConverted', { from: convertPriceInfo.asset_currency, to: portfolios.find((p) => p.id === convertPortfolioId)?.base_currency || 'USD' })}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('fields.fees')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={convertFees}
                    onChange={(e) => setConvertFees(e.target.value)}
                    className="input w-full"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setConvertItem(null)
                    setConvertPortfolioId(null)
                    setConvertQuantity('')
                    setConvertPrice('')
                    setConvertFees('0')
                    setConvertDate(new Date().toISOString().split('T')[0])
                    setConvertPriceInfo(null)
                  }}
                  className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleConvertToBuy}
                  className="flex-1 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors"
                >
                  {t('watchlist.convertToBuy')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
              {t('watchlist.deleteWatchlistAsset')}
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              {t('watchlist.deleteConfirm')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                {t('common.delete')}
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
                {t('watchlist.addToWatchlist')}
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
                  {t('fields.symbol')}
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
                  {t('fields.notes')} <span className="text-neutral-500 dark:text-neutral-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  placeholder={t('placeholders.enterNotes')}
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
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors"
                >
                  {t('watchlist.addToWatchlist')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tag Manager Modal */}
      <WatchlistTagManager
        isOpen={showTagManager}
        onClose={() => setShowTagManager(false)}
        onTagsUpdated={() => {
          loadTags()
          loadWatchlist(selectedTagIds.length > 0 ? selectedTagIds : undefined)
        }}
      />
    </div>
  )
}
