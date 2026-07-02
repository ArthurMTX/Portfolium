import { useState, useEffect, useCallback, useMemo, type KeyboardEvent } from 'react'
import { api, type AssetThemeDTO } from '@/api'
import { Plus, Trash2, Pencil, RefreshCw, Download, Upload, ShoppingCart, X, ChevronUp, ChevronDown, Tag, Filter, MoreHorizontal } from 'lucide-react'
import { formatCurrency } from '@/shared/lib/formatUtils'
import EmptyPortfolioPrompt from '@/features/portfolios/components/EmptyPortfolioPrompt'
import ImportProgressModal from '@/features/transactions/components/ImportProgressModal'
import WatchlistTagManager, { IconComponent } from '@/features/watchlist/components/WatchlistTagManager'
import WatchlistEditModal from '@/features/watchlist/components/WatchlistEditModal'
import Toast from '@/shared/components/Toast'
import AssetLogo from '@/shared/components/AssetLogo'
import { InlineLoading, PageStateSkeleton, StateBlock } from '@/shared/components/StatePrimitives'
import {
  PageControls,
  PageHeader,
  PageMainColumn,
  PageMainGrid,
  PageMetric,
  PageMetricStrip,
  PageShell,
  PageSummaryPanel,
  PageTitleBlock,
} from '@/shared/components/PageLayout'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import '@/shared/design/pages/watchlist.css'

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
  themes?: AssetThemeDTO[]
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

// LocalStorage keys for persisting filter state
const STORAGE_KEY_TAG_IDS = 'watchlist_filter_tag_ids'
const STORAGE_KEY_TAG_MODE = 'watchlist_filter_tag_mode'

export default function Watchlist() {
  const navigate = useNavigate()
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [tags, setTags] = useState<WatchlistTag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TAG_IDS)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [tagFilterMode, setTagFilterMode] = useState<'any' | 'all'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TAG_MODE)
      return saved === 'all' ? 'all' : 'any'
    } catch {
      return 'any'
    }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showTagManager, setShowTagManager] = useState(false)
  const [addSymbol, setAddSymbol] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addTagIds, setAddTagIds] = useState<number[]>([])
  const [addFormError, setAddFormError] = useState<string | null>(null)
  const [addFormSuccess, setAddFormSuccess] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<Array<{ symbol: string; name: string; type?: string; exchange?: string }>>([])
  const [selectedTicker, setSelectedTicker] = useState<{ symbol: string; name: string; type?: string; exchange?: string } | null>(null)
  const [editingItem, setEditingItem] = useState<WatchlistItem | null>(null)
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
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const { t } = useTranslation()

  // Prevent body scroll when modals are open
  useEffect(() => {
    if (showAddModal || showImportModal || showImportProgress || convertItem || deleteConfirm || showTagManager || editingItem) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showAddModal, showImportModal, showImportProgress, convertItem, deleteConfirm, showTagManager, editingItem])

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

  const loadWatchlist = useCallback(async (filterTagIds?: number[], filterMode?: 'any' | 'all') => {
    try {
      setLoading(true)
      const data = await api.getWatchlist(filterTagIds, filterMode)
      const normalized = data.map((d) => ({
        ...d,
        alert_target_price: toNumber(d.alert_target_price),
        current_price: toNumber(d.current_price),
        daily_change_pct: toNumber(d.daily_change_pct),
        themes: d.themes || [],
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

  const openAssetResearch = (symbol: string) => {
    navigate(`/assets/${encodeURIComponent(symbol)}/research`)
  }

  const handleAssetResearchKeyDown = (event: KeyboardEvent<HTMLElement>, symbol: string) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openAssetResearch(symbol)
    }
  }

  useEffect(() => {
    loadPortfolios()
    loadTags()
  }, [loadPortfolios, loadTags])

  // Re-load watchlist when tag filter changes
  useEffect(() => {
    loadWatchlist(selectedTagIds.length > 0 ? selectedTagIds : undefined, tagFilterMode)
  }, [selectedTagIds, tagFilterMode, loadWatchlist])

  // Persist tag filter to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TAG_IDS, JSON.stringify(selectedTagIds))
  }, [selectedTagIds])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TAG_MODE, tagFilterMode)
  }, [tagFilterMode])

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
        tag_ids: addTagIds.length > 0 ? addTagIds : undefined,
      })
      
      // Success - close modal and clear form
      setShowAddModal(false)
      setAddSymbol('')
      setAddNotes('')
      setAddTagIds([])
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
      setToast({ type: 'error', message: getErrorMessage(err, 'Failed to delete item') })
    }
  }

  const handleCopySymbol = async (symbol: string) => {
    try {
      await navigator.clipboard.writeText(symbol)
      setToast({ type: 'success', message: `${symbol} copied` })
    } catch {
      setToast({ type: 'error', message: 'Failed to copy symbol' })
    }
  }

  const startEdit = (item: WatchlistItem) => {
    setEditingItem(item)
  }

  const handleEditSave = async (id: number, data: {
    notes: string | null
    alert_target_price: number | null
    alert_enabled: boolean
    tag_ids: number[]
  }) => {
    // Update the watchlist item
    await api.updateWatchlistItem(id, {
      notes: data.notes,
      alert_target_price: data.alert_target_price,
      alert_enabled: data.alert_enabled,
    })
    // Update tags separately
    await api.updateWatchlistItemTags(id, data.tag_ids)
    // Reload watchlist
    loadWatchlist(selectedTagIds.length > 0 ? selectedTagIds : undefined, tagFilterMode)
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
    // Reload watchlist and tags after modal closes (import may create new tags)
    loadWatchlist()
    loadTags()
  }, [loadWatchlist, loadTags])

  const handleExportClick = async () => {
    try {
      const blob = await api.exportWatchlistCSV()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `watchlist_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
    } catch (err: unknown) {
      setToast({ type: 'error', message: getErrorMessage(err, 'Failed to export') })
    }
  }

  const handleConvertToBuy = async () => {
    if (!convertItem || !convertPortfolioId || !convertQuantity || !convertPrice) {
      setToast({ type: 'error', message: 'Please fill in all fields' })
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
      setToast({ type: 'error', message: getErrorMessage(err, 'Failed to convert to BUY') })
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

  const getThemesTitle = (themes?: AssetThemeDTO[]) => {
    if (!themes || themes.length === 0) return undefined
    return themes
      .map((theme) => {
        const subthemes = theme.children?.length
          ? ` (${theme.children.map((child) => {
              const evidence = child.evidence?.length ? `: ${child.evidence.join(', ')}` : ''
              return `${child.label}${evidence}`
            }).join(', ')})`
          : ''
        const evidence = theme.evidence?.length ? `: ${theme.evidence.join(', ')}` : ''
        return `${theme.label}${subthemes}${evidence}`
      })
      .join('\n')
  }

  const formatSignedPercent = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return '—'
    const sign = value > 0 ? '+' : value < 0 ? '' : '+'
    return `${sign}${value.toFixed(2)}%`
  }

  const formatShortDate = (date: string | null) => {
    if (!date) return 'No recent update'
    const parsed = new Date(date)
    if (Number.isNaN(parsed.getTime())) return 'No recent update'
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(parsed)
  }

  const getDailyMove = (item: WatchlistItem) => {
    const value = toNumber(item.daily_change_pct)
    return value === null || Number.isNaN(value) ? null : value
  }

  const getTargetState = (item: WatchlistItem) => {
    const current = toNumber(item.current_price)
    const target = toNumber(item.alert_target_price)
    if (current === null || target === null || target === 0) return null

    const distancePct = ((current - target) / target) * 100
    const reached = current <= target
    const near = !reached && distancePct <= 5
    const distanceLabel = reached
      ? 'Target reached'
      : `${distancePct.toFixed(1)}% above target`

    return {
      current,
      target,
      reached,
      near,
      distancePct,
      distanceLabel,
    }
  }

  const getAttentionStatus = (item: WatchlistItem) => {
    const target = getTargetState(item)
    const dailyMove = getDailyMove(item)

    if (target?.reached) {
      return {
        label: 'Target reached',
        detail: 'Current price is at or below your watch target.',
        tone: 'urgent' as const,
      }
    }

    if (target?.near) {
      return {
        label: 'Near target',
        detail: target.distanceLabel,
        tone: 'attention' as const,
      }
    }

    if (dailyMove !== null && Math.abs(dailyMove) >= 5) {
      return {
        label: 'Large move today',
        detail: `${formatSignedPercent(dailyMove)} today.`,
        tone: 'attention' as const,
      }
    }

    if (!item.notes?.trim()) {
      return {
        label: 'Needs thesis',
        detail: 'No watch reason has been written yet.',
        tone: 'quiet' as const,
      }
    }

    return {
      label: 'Watching',
      detail: `Updated ${formatShortDate(item.last_updated)}`,
      tone: 'neutral' as const,
    }
  }

  const attentionCount = watchlist.filter((item) => {
    const status = getAttentionStatus(item)
    return status.label === 'Target reached' || status.label === 'Near target' || status.label === 'Large move today' || status.label === 'Needs thesis'
  }).length

  const targetReachedCount = watchlist.filter((item) => getAttentionStatus(item).label === 'Target reached').length
  const needsThesisCount = watchlist.filter((item) => getAttentionStatus(item).label === 'Needs thesis').length

  const newestWatchDate = (() => {
    const dates = watchlist
      .map((item) => new Date(item.created_at))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())
    return dates[0] ? formatShortDate(dates[0].toISOString()) : 'No assets yet'
  })()

  const primaryThemesLabel = (themes?: AssetThemeDTO[]) => {
    if (!themes || themes.length === 0) return 'No theme classified'
    const [primary, ...rest] = themes
    return rest.length > 0 ? `${primary.label} +${rest.length}` : primary.label
  }

  if (loading) {
    return <PageStateSkeleton label="Loading watchlist" className="watchlist" />
  }

  if (portfolios.length === 0) {
    return <EmptyPortfolioPrompt pageType="watchlist" />
  }

  return (
    <PageShell className="watchlist">
      <PageHeader>
        <PageTitleBlock
          kicker="Watchlist"
          title={`${watchlist.length} ${watchlist.length === 1 ? 'company' : 'companies'}.`}
        />
        <PageSummaryPanel
          lead={`${attentionCount} ${attentionCount === 1 ? 'deserves' : 'deserve'} attention today.`}
          description={
            <>
              Assets you are still evaluating. Nothing here is owned yet.
              {watchlist.length > 0 ? ` Latest addition: ${newestWatchDate}.` : ''}
            </>
          }
          actions={
            <>
              <button className="pf-button pf-button--secondary" type="button" onClick={handleImportClick}>
                <Upload size={15} />
                {t('common.import')}
              </button>
              <button className="pf-button pf-button--secondary" type="button" onClick={handleExportClick}>
                <Download size={15} />
                {t('common.export')}
              </button>
              <button className="pf-button pf-button--secondary" type="button" onClick={handleRefreshPrices}>
                <RefreshCw size={15} />
                {t('common.refresh')}
              </button>
              <button type="button" onClick={() => setShowAddModal(true)} className="pf-button pf-button--primary is-primary">
                <Plus size={15} />
                Add company
              </button>
            </>
          }
        />
      </PageHeader>

      <PageMetricStrip label="Watchlist context">
        <PageMetric label="Watching" value={watchlist.length} />
        <PageMetric label="Deserve attention" value={attentionCount} />
        <PageMetric label="Target reached" value={targetReachedCount} />
        <PageMetric label="Needs thesis" value={needsThesisCount} />
      </PageMetricStrip>

      {error && (
        <StateBlock
          tone="error"
          className="watchlist__error"
          eyebrow="Watchlist"
          title="Could not refresh watchlist data."
          description="Prices and watchlist companies could not be loaded."
          detail={error}
          actionLabel={t('common.retry')}
          onAction={() => loadWatchlist(selectedTagIds, tagFilterMode)}
        />
      )}

      <PageControls
        label="Watchlist controls"
        start={
        <div className="pf-control-group watchlist__filters">
          <span className="watchlist__toolbar-label">
            <Filter size={15} />
            Filters
          </span>
          {tags.length === 0 ? (
            <span className="watchlist__muted">No tags yet.</span>
          ) : (
            tags.map(tag => (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleTagFilterChange(tag.id)}
                className={`watchlist__tag-filter ${selectedTagIds.includes(tag.id) ? 'is-active' : ''}`}
                style={{
                  backgroundColor: selectedTagIds.includes(tag.id) ? `${tag.color}2e` : `${tag.color}14`,
                  borderColor: selectedTagIds.includes(tag.id) ? `${tag.color}a3` : `${tag.color}5c`,
                  color: tag.color,
                }}
              >
                <IconComponent name={tag.icon} size={12} />
                {tag.name}
              </button>
            ))
          )}
          {selectedTagIds.length > 0 && (
            <button type="button" onClick={clearTagFilter} className="watchlist__clear-filter">
              <X size={12} />
              {t('common.clear')}
            </button>
          )}
          {selectedTagIds.length > 1 && (
            <div className="watchlist__tag-mode" aria-label="Tag filter mode">
              <button
                type="button"
                onClick={() => setTagFilterMode('any')}
                className={tagFilterMode === 'any' ? 'is-active' : ''}
              >
                {t('watchlist.tags.any')}
              </button>
              <button
                type="button"
                onClick={() => setTagFilterMode('all')}
                className={tagFilterMode === 'all' ? 'is-active' : ''}
              >
                {t('watchlist.tags.all')}
              </button>
            </div>
          )}
        </div>
        }
        end={
        <div className="watchlist__sort">
          <label htmlFor="watchlist-sort">Sort by</label>
          <select
            id="watchlist-sort"
            value={sortKey}
            onChange={(e) => handleSort(e.target.value as SortKey)}
          >
            {sortableColumns.map((option) => (
              <option key={option} value={option}>
                {getSortLabel(option)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
            aria-label={sortDir === 'asc' ? 'Sort descending' : 'Sort ascending'}
          >
            {sortDir === 'asc' ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
          </button>
          <button
            type="button"
            onClick={() => setShowTagManager(true)}
            className="watchlist__manage-tags"
          >
            <Tag size={14} />
            {t('watchlist.tags.manageTags')}
          </button>
        </div>
        }
      />

      <PageMainGrid single>
      <PageMainColumn className="watchlist__ledger" aria-label="Watched companies">
        {sortedWatchlist.length === 0 ? (
          <StateBlock
            className="watchlist__empty"
            eyebrow={selectedTagIds.length > 0 ? 'No matching companies' : 'No watchlist'}
            title={selectedTagIds.length > 0 ? 'No companies match the selected tags.' : 'Companies you are evaluating before buying will appear here.'}
            description={selectedTagIds.length > 0 ? 'Clear the active tag filters to see the full watchlist.' : 'Add a company to start tracking it before investing.'}
          >
            <button type="button" onClick={() => setShowAddModal(true)}>
              <Plus size={15} />
              {selectedTagIds.length > 0 ? 'Add company' : 'Add first company'}
            </button>
          </StateBlock>
        ) : (
          <>
            <div className="watchlist__table-header" aria-hidden="true">
              <span>Company</span>
              <span>Price</span>
              <span>Today</span>
              <span>Target</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {sortedWatchlist.map((item) => {
            const dailyMove = getDailyMove(item)
            const targetState = getTargetState(item)
            const status = getAttentionStatus(item)
            const sortedTags = [...(item.tags || [])].sort((a, b) => a.name.localeCompare(b.name))

            return (
              <article
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => openAssetResearch(item.symbol)}
                onKeyDown={(event) => handleAssetResearchKeyDown(event, item.symbol)}
                className={`watchlist__item is-${status.tone}`}
              >
                <div className="watchlist__identity">
                  <AssetLogo
                    symbol={item.symbol}
                    assetType={item.asset_type}
                    assetName={item.name}
                    alt={`${item.symbol} logo`}
                    className="watchlist__logo"
                    style={{ borderRadius: 0 }}
                  />
                  <div>
                    <span title={getThemesTitle(item.themes)}>{primaryThemesLabel(item.themes)}</span>
                    <h2>{item.symbol}</h2>
                    <p>{item.name || 'Unknown company'}</p>
                    <div className="watchlist__row-tags" aria-label={`${item.symbol} tags`}>
                      {sortedTags.length === 0 ? (
                        <span>No tags</span>
                      ) : (
                        sortedTags.map(tag => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleTagFilterChange(tag.id)
                            }}
                            style={{
                              backgroundColor: selectedTagIds.includes(tag.id) ? `${tag.color}2e` : `${tag.color}14`,
                              borderColor: selectedTagIds.includes(tag.id) ? `${tag.color}a3` : `${tag.color}5c`,
                              color: tag.color,
                            }}
                            className={selectedTagIds.includes(tag.id) ? 'is-active' : ''}
                          >
                            <IconComponent name={tag.icon} size={11} />
                            {tag.name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="watchlist__price">
                  <strong>{formatPrice(item.current_price, item.currency)}</strong>
                </div>

                <div className="watchlist__move">
                  <strong className={dailyMove !== null && dailyMove > 0 ? 'is-positive' : dailyMove !== null && dailyMove < 0 ? 'is-negative' : ''}>
                    {formatSignedPercent(dailyMove)}
                  </strong>
                </div>

                <div className="watchlist__target">
                  {targetState ? (
                    <>
                      <strong>{formatPrice(targetState.target, item.currency)}</strong>
                      <small className={targetState.reached ? 'is-positive' : targetState.near ? 'is-attention' : ''}>
                        {targetState.distancePct > 0 ? '+' : ''}{targetState.distancePct.toFixed(1)}% distance
                      </small>
                      <em className={targetState.reached ? 'is-positive' : targetState.near ? 'is-attention' : ''}>
                        {item.alert_enabled ? 'Alert on' : 'Alert off'}
                      </em>
                    </>
                  ) : (
                    <>
                      <strong>—</strong>
                    </>
                  )}
                </div>

                <div className="watchlist__status">
                  <strong>{status.label}</strong>
                </div>

                <div className="watchlist__row-actions" onClick={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => openAssetResearch(item.symbol)} className="watchlist__research-link">
                    Research
                  </button>
                  <div className="watchlist__overflow">
                    <button
                      type="button"
                      aria-label={`Actions for ${item.symbol}`}
                      aria-expanded={openActionMenuId === item.id}
                      onClick={() => setOpenActionMenuId(openActionMenuId === item.id ? null : item.id)}
                      className="watchlist__overflow-trigger"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {openActionMenuId === item.id && (
                      <div className="watchlist__menu" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            startEdit(item)
                            setOpenActionMenuId(null)
                          }}
                        >
                          <Pencil size={14} />
                          Edit watch reason
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            openConvertModal(item)
                            setOpenActionMenuId(null)
                          }}
                        >
                          <ShoppingCart size={14} />
                          Record purchase
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            handleCopySymbol(item.symbol)
                            setOpenActionMenuId(null)
                          }}
                        >
                          Copy symbol
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="is-danger"
                          onClick={() => {
                            setDeleteConfirm(item.id)
                            setOpenActionMenuId(null)
                          }}
                        >
                          <Trash2 size={14} />
                          {t('common.delete')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
          </>
        )}
      </PageMainColumn>
      </PageMainGrid>

      {/* Edit Modal */}
      <WatchlistEditModal
        isOpen={editingItem !== null}
        item={editingItem}
        availableTags={tags}
        onClose={() => setEditingItem(null)}
        onSave={handleEditSave}
      />

      {/* Import Modal */}
      {showImportModal && (
        <div className="pf-modal-overlay">
          <div className="pf-modal-panel pf-modal-panel--sm" role="dialog" aria-modal="true">
            <div className="pf-modal-header">
              <h2 className="pf-modal-title">{t('watchlist.importTitle')}</h2>
            </div>
            <div className="pf-modal-body pf-modal-section">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {t('watchlist.importDescription')}
              </p>
              <div className="pf-modal-muted-box text-xs">
                <strong>{t('watchlist.importFormatInfo')}:</strong>
                <br />
                <code className="text-xs">symbol,notes,alert_target_price,alert_enabled</code>
                <br />
                <code className="text-xs">{t('watchlist.importFormat')}</code>
              </div>
            </div>
            <div className="pf-modal-footer">
              <div />
              <div className="pf-modal-footer-actions">
              <button
                onClick={() => setShowImportModal(false)}
                className="pf-modal-button pf-modal-button--secondary"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  handleImportClick()
                  setShowImportModal(false)
                }}
                className="pf-modal-button pf-modal-button--primary"
              >
                {t('watchlist.selectFile')}
              </button>
              </div>
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
        <div className="pf-modal-overlay">
          <div className="pf-modal-panel pf-modal-panel--sm" role="dialog" aria-modal="true">
            <div className="pf-modal-header">
              <h2 className="pf-modal-title">{t('watchlist.convertToBuy')}</h2>
              <button
                onClick={() => {
                  setConvertItem(null)
                  setConvertPortfolioId(null)
                  setConvertQuantity('')
                  setConvertPrice('')
                  setConvertDate(new Date().toISOString().split('T')[0])
                  setConvertPriceInfo(null)
                }}
                className="pf-modal-close"
                aria-label={t('common.close')}
              >
                <X size={20} />
              </button>
            </div>

            <div className="pf-modal-body pf-modal-section">
              <div className="flex items-center gap-3">
                <AssetLogo
                  symbol={convertItem.symbol}
                  assetType={convertItem.asset_type}
                  assetName={convertItem.name}
                  alt={`${convertItem.symbol} logo`}
                  className="w-8 h-8 object-cover"
                  style={{ borderRadius: 0 }}
                />
                <div>
                  <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{convertItem.symbol}</div>
                  {convertItem.name && (
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">{convertItem.name}</div>
                  )}
                </div>
              </div>

              <div>
                <label className="pf-modal-label">{t('fields.portfolio')}</label>
                <select
                  value={convertPortfolioId || ''}
                  onChange={(e) => handleConvertPortfolioChange(Number(e.target.value))}
                  className="pf-modal-select"
                  required
                >
                  {portfolios.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.base_currency})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="pf-modal-label">{t('fields.date')}</label>
                <input
                  type="date"
                  value={convertDate}
                  onChange={(e) => handleConvertDateChange(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="pf-modal-input"
                  required
                />
              </div>

              <div className="pf-modal-grid--3">
                <div>
                  <label className="pf-modal-label">{t('fields.quantity')}</label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={convertQuantity}
                    onChange={(e) => setConvertQuantity(e.target.value)}
                    className="pf-modal-input"
                    placeholder="0.0000"
                    required
                  />
                </div>
                <div>
                  <label className="pf-modal-label">
                    {t('fields.price')} ({portfolios.find((p) => p.id === convertPortfolioId)?.base_currency || 'USD'})
                    {convertPriceLoading && <InlineLoading label={t('common.loading')} className="ml-2" />}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={convertPrice}
                    onChange={(e) => setConvertPrice(e.target.value)}
                    className="pf-modal-input"
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
                  <label className="pf-modal-label">{t('fields.fees')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={convertFees}
                    onChange={(e) => setConvertFees(e.target.value)}
                    className="pf-modal-input"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="pf-modal-footer -mx-5 -mb-5 mt-2">
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
                  className="pf-modal-button pf-modal-button--secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleConvertToBuy}
                  className="pf-modal-button pf-modal-button--primary"
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
        <div className="pf-modal-overlay">
          <div className="pf-modal-panel pf-modal-panel--sm" role="dialog" aria-modal="true">
            <div className="pf-modal-header">
              <div>
            <h3 className="pf-modal-title">
              {t('watchlist.deleteWatchlistAsset')}
            </h3>
            <p className="pf-modal-description">
              {t('watchlist.deleteConfirm')}
            </p>
            </div>
            </div>
            <div className="pf-modal-footer">
              <div />
              <div className="pf-modal-footer-actions">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="pf-modal-button pf-modal-button--secondary"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="pf-modal-button pf-modal-button--danger"
              >
                {t('common.delete')}
              </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add to Watchlist Modal */}
      {showAddModal && (
        <div className="pf-modal-overlay">
          <div className="pf-modal-panel pf-modal-panel--lg" role="dialog" aria-modal="true">
            <div className="pf-modal-header">
              <h2 className="pf-modal-title">
                {t('watchlist.addToWatchlist')}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setAddSymbol('')
                  setAddNotes('')
                  setAddTagIds([])
                  setSearchResults([])
                  setSelectedTicker(null)
                  setAddFormError(null)
                  setAddFormSuccess(null)
                }}
                className="pf-modal-close"
                aria-label={t('common.close')}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddSymbol} className="pf-modal-body pf-modal-section--tight">
              <div>
                <label className="pf-modal-label">
                  {t('fields.symbol')}
                </label>
                <input
                  type="text"
                  value={addSymbol}
                  onChange={handleTickerChange}
                  className="pf-modal-input"
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
                <label className="pf-modal-label">
                  {t('fields.notes')} <span className="text-neutral-500 dark:text-neutral-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  className="pf-modal-input"
                  placeholder={t('placeholders.enterNotes')}
                />
              </div>

              {/* Tags Selector */}
              {tags.length > 0 && (
                <div>
                  <label className="pf-modal-label">
                    {t('watchlist.tags.title')} <span className="text-neutral-500 dark:text-neutral-400">(Optional)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          setAddTagIds(prev => 
                            prev.includes(tag.id) 
                              ? prev.filter(id => id !== tag.id)
                              : [...prev, tag.id]
                          )
                        }}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                          addTagIds.includes(tag.id)
                            ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-neutral-900'
                            : 'opacity-60 hover:opacity-100'
                        }`}
                        style={{ 
                          backgroundColor: tag.color + '20', 
                          color: tag.color,
                          ...(addTagIds.includes(tag.id) ? { ringColor: tag.color } : {})
                        }}
                      >
                        <IconComponent name={tag.icon} size={12} />
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {addFormError && (
                <div className="pf-modal-callout pf-modal-callout--warning flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm text-amber-800 dark:text-amber-200">{addFormError}</p>
                </div>
              )}

              {addFormSuccess && (
                <div className="pf-modal-callout pf-modal-callout--success flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm text-green-800 dark:text-green-200">{addFormSuccess}</p>
                </div>
              )}

              <div className="pf-modal-footer -mx-5 -mb-5 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setAddSymbol('')
                    setAddNotes('')
                    setAddTagIds([])
                    setSearchResults([])
                    setSelectedTicker(null)
                    setAddFormError(null)
                    setAddFormSuccess(null)
                  }}
                  className="pf-modal-button pf-modal-button--secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="pf-modal-button pf-modal-button--primary"
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
          loadWatchlist(selectedTagIds.length > 0 ? selectedTagIds : undefined, tagFilterMode)
        }}
      />

      {/* Toast Notifications */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </PageShell>
  )
}
