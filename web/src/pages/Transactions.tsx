import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import usePortfolioStore from '../store/usePortfolioStore'
import api from '../lib/api'
import { getAssetLogoUrl, handleLogoError, validateLogoImage } from '../lib/logoUtils'
import { formatCurrency as formatCurrencyUtil } from '../lib/formatUtils'
import { PlusCircle, Upload, Download, TrendingUp, TrendingDown, Edit2, Trash2, X, ChevronUp, ChevronDown, Shuffle, Search, BarChart3 } from 'lucide-react'
import SplitHistory from '../components/SplitHistory'
import EmptyPortfolioPrompt from '../components/EmptyPortfolioPrompt'
import ImportProgressModal from '../components/ImportProgressModal'
import SortIcon from '../components/SortIcon'
import { useTranslation } from 'react-i18next'

interface TickerInfo {
  symbol: string
  name: string
}

interface Transaction {
  id: number
  asset_id: number
  asset: {
    symbol: string
    name: string | null
    asset_type?: string
  }
  tx_date: string
  type: string
  quantity: number | string
  price: number | string
  fees: number | string
  currency: string
  notes: string | null
  metadata?: {
    split?: string
    [key: string]: unknown
  }
}

type TabType = 'all' | 'buy' | 'sell' | 'dividend' | 'fee' | 'split'
type ModalMode = 'add' | 'edit' | null
type SortKey = 'tx_date' | 'symbol' | 'type' | 'quantity' | 'price' | 'fees' | 'total'
type SortDir = 'asc' | 'desc'

export default function Transactions() {
  const navigate = useNavigate()
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const portfolios = usePortfolioStore((state) => state.portfolios)
  const setPortfolios = usePortfolioStore((state) => state.setPortfolios)
  const activePortfolio = portfolios.find(p => p.id === activePortfolioId)
  const portfolioCurrency = activePortfolio?.base_currency || 'EUR'
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('tx_date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showAllTransactions, setShowAllTransactions] = useState(false)
  const [displayLimit] = useState(100)
  const [searchQuery, setSearchQuery] = useState('')
  const { t, i18n } = useTranslation()

  // Get the current locale for date formatting
  const currentLocale = i18n.language || 'en-US'

  // Form state
  const [ticker, setTicker] = useState("")
  const [searchResults, setSearchResults] = useState<TickerInfo[]>([])
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0])
  const [txType, setTxType] = useState("BUY")
  const [quantity, setQuantity] = useState("")
  const [selectedTicker, setSelectedTicker] = useState<TickerInfo | null>(null)
  const [price, setPrice] = useState("")
  const [fees, setFees] = useState("0")
  const [notes, setNotes] = useState("")
  const [splitRatio, setSplitRatio] = useState("")
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState("")
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState("")
  const [importSuccess, setImportSuccess] = useState("")
  const [splitHistoryAsset, setSplitHistoryAsset] = useState<{ id: number; symbol: string } | null>(null)
  const [showImportProgress, setShowImportProgress] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)

  // Load portfolios if not already loaded
  useEffect(() => {
    if (portfolios.length === 0) {
      api.getPortfolios().then(setPortfolios).catch(console.error)
    }
  }, [portfolios.length, setPortfolios])

  // Prevent body scroll when modals are open
  useEffect(() => {
    if (modalMode || deleteConfirm || showImportProgress) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [modalMode, deleteConfirm, showImportProgress])

  const fetchTransactions = useCallback(async () => {
    if (!activePortfolioId) return
    
    setLoading(true)
    try {
      const filters = activeTab !== 'all' ? { tx_type: activeTab.toUpperCase() } : undefined
      const data = await api.getTransactions(activePortfolioId, filters)
      setTransactions(data)
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setLoading(false)
    }
  }, [activePortfolioId, activeTab])

  useEffect(() => {
    if (activePortfolioId) {
      fetchTransactions()
    }
  }, [activePortfolioId, fetchTransactions])

  // moved into useCallback above

  // Ticker search
  const handleTickerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setTicker(e.target.value)
    setSelectedTicker(null)
    setPrice("")
    if (e.target.value.length > 1) {
      try {
        const data = await api.searchTicker(e.target.value)
        setSearchResults(data)
      } catch (err) {
        console.error("Failed to search tickers:", err)
      }
    } else {
      setSearchResults([])
    }
  }

  const handleSelectTicker = (tickerInfo: TickerInfo) => {
    setSelectedTicker(tickerInfo)
    setTicker(tickerInfo.symbol)
    setSearchResults([])
    setPrice("")
  }

  // Helper function to format decimal numbers, removing trailing zeros after decimal point only
  const formatDecimalForInput = (value: number | string): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(num)) return ''
    const str = num.toString()
    // Only remove trailing zeros if there's a decimal point
    if (str.includes('.')) {
      return str.replace(/\.?0+$/, '')
    }
    return str
  }

  const openAddModal = () => {
    resetForm()
    setModalMode('add')
  }

  const openEditModal = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setSelectedTicker({ symbol: transaction.asset.symbol, name: transaction.asset.name || '' })
    setTicker(transaction.asset.symbol)
    setTxDate(transaction.tx_date)
    setTxType(transaction.type)
    setQuantity(formatDecimalForInput(transaction.quantity))
    setPrice(formatDecimalForInput(transaction.price))
    setFees(formatDecimalForInput(transaction.fees))
    setNotes(transaction.notes || '')
    // Extract split ratio from metadata if it's a SPLIT transaction
    // Handle both 'metadata' and 'meta_data' for backwards compatibility
    const transactionData = transaction as unknown as Record<string, unknown>
    const metadata = transaction.metadata || transactionData.meta_data as { split?: string } | undefined
    if (transaction.type === 'SPLIT' && metadata?.split) {
      setSplitRatio(metadata.split)
    } else {
      setSplitRatio('')
    }
    setModalMode('edit')
  }

  const closeModal = () => {
    setModalMode(null)
    setEditingTransaction(null)
    resetForm()
  }

  const resetForm = () => {
    setTicker("")
    setSelectedTicker(null)
    setTxDate(new Date().toISOString().split('T')[0])
    setTxType("BUY")
    setQuantity("")
    setPrice("")
    setFees("0")
    setNotes("")
    setSplitRatio("")
    setFormError("")
    setSearchResults([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError("")

    if (!activePortfolioId) {
      setFormError("Please select a portfolio first")
      setFormLoading(false)
      return
    }

    if (!selectedTicker && modalMode === 'add') {
      setFormError("Please select a ticker")
      setFormLoading(false)
      return
    }

    try {
      if (modalMode === 'add') {
        // Add new transaction
        if (!price && txType !== 'SPLIT') {
          // Auto-fetch price using API client (for BUY/SELL)
          await api.addPositionTransaction(
            activePortfolioId,
            selectedTicker!.symbol,
            txDate,
            txType,
            parseFloat(quantity)
          )
        } else {
          // Manual price entry or SPLIT transaction - ensure we have a valid asset_id
          let assetId: number | null = null
          const symbol = selectedTicker?.symbol || ticker

          if (!symbol) {
            throw new Error("Ticker symbol is required")
          }

          try {
            // Try to find an existing asset by symbol
            const assets = await api.getAssets(symbol)
            const match = (assets as Array<{ id?: number; symbol?: string }>).find((a) => a.symbol?.toUpperCase() === symbol.toUpperCase())
            if (match) {
              assetId = match.id ?? null
            }
          } catch (lookupErr) {
            // Non-fatal: we'll attempt to create below
            console.warn('Asset lookup failed, will attempt to create:', lookupErr)
          }

          if (!assetId) {
            // Create the asset if it doesn't exist
            const created = await api.createAsset({
              symbol,
              name: selectedTicker?.name,
              currency: portfolioCurrency,
            })
            assetId = created.id
          }

          // Prepare metadata for SPLIT transactions
          const metadata = txType === 'SPLIT' ? { split: splitRatio } : {}

          await api.createTransaction(activePortfolioId!, {
            asset_id: assetId,
            tx_date: txDate,
            type: txType,
            quantity: txType === 'SPLIT' ? 0 : parseFloat(quantity),
            price: txType === 'SPLIT' ? 0 : parseFloat(price),
            fees: txType === 'SPLIT' ? 0 : parseFloat(fees),
            currency: portfolioCurrency,
            metadata: metadata,
            notes: notes || null
          })
        }
      } else if (modalMode === 'edit' && editingTransaction) {
        // Update existing transaction
        const metadata = txType === 'SPLIT' ? { split: splitRatio } : editingTransaction.metadata || {}
        
        await api.updateTransaction(
          activePortfolioId,
          editingTransaction.id,
          {
            asset_id: editingTransaction.asset_id,
            tx_date: txDate,
            type: txType,
            quantity: txType === 'SPLIT' ? 0 : parseFloat(quantity),
            price: txType === 'SPLIT' ? 0 : parseFloat(price),
            fees: txType === 'SPLIT' ? 0 : parseFloat(fees),
            currency: editingTransaction.currency,
            metadata: metadata,
            notes: notes || null
          }
        )
      }

      await fetchTransactions()
      closeModal()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Operation failed'
      setFormError(message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (transactionId: number) => {
    try {
      await api.deleteTransaction(activePortfolioId!, transactionId)
      await fetchTransactions()
      setDeleteConfirm(null)
    } catch (err) {
      console.error("Failed to delete transaction:", err)
    }
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const handleImportClick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file || !activePortfolioId) return

      // Show progress modal
      setImportFile(file)
      setShowImportProgress(true)
      setImportLoading(true)
      setImportError("")
      setImportSuccess("")
    }
    input.click()
  }

  const handleImportComplete = useCallback(async (success: boolean) => {
    setImportLoading(false)
    
    if (success) {
      setImportSuccess(`Successfully imported transactions!`)
      await fetchTransactions()
      
      // Clear success message after 5 seconds
      setTimeout(() => setImportSuccess(""), 5000)
    } else {
      setImportError('Import failed. Check the log for details.')
    }
  }, [fetchTransactions])

  const handleImportClose = useCallback(() => {
    setShowImportProgress(false)
    setImportFile(null)
    setImportLoading(false)
  }, [])

  const handleExportClick = () => {
    if (transactions.length === 0) {
      alert('No transactions to export')
      return
    }

    // Create CSV content
    const headers = ['date', 'symbol', 'type', 'quantity', 'price', 'fees', 'currency', 'split_ratio', 'notes']
    const rows = transactions.map(tx => [
      tx.tx_date,
      tx.asset.symbol,
      tx.type,
      tx.quantity,
      tx.price,
      tx.fees,
      tx.currency,
      tx.metadata?.split || '',
      tx.notes || ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        // Escape cells that contain commas or quotes
        const str = String(cell)
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }).join(','))
    ].join('\n')

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Check if an asset has any split transactions
  const assetHasSplits = useCallback((assetId: number) => {
    return transactions.some(tx => tx.asset_id === assetId && tx.type === 'SPLIT')
  }, [transactions])

  const sortedTransactions = useMemo(() => {
    // Filter by search query
    let filtered = transactions
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = transactions.filter(tx => {
        const symbol = tx.asset.symbol.toLowerCase()
        const name = (tx.asset.name || '').toLowerCase()
        
        return symbol.includes(query) || name.includes(query)
      })
    }
    
    const sorted = [...filtered].sort((a, b) => {
      let aVal: string | number
      let bVal: string | number

      switch (sortKey) {
        case 'tx_date':
          aVal = new Date(a.tx_date).getTime()
          bVal = new Date(b.tx_date).getTime()
          break
        case 'symbol':
          aVal = a.asset.symbol
          bVal = b.asset.symbol
          break
        case 'type':
          aVal = a.type
          bVal = b.type
          break
        case 'quantity':
          aVal = typeof a.quantity === 'string' ? parseFloat(a.quantity) : a.quantity
          bVal = typeof b.quantity === 'string' ? parseFloat(b.quantity) : b.quantity
          break
        case 'price':
          aVal = typeof a.price === 'string' ? parseFloat(a.price) : a.price
          bVal = typeof b.price === 'string' ? parseFloat(b.price) : b.price
          break
        case 'fees':
          aVal = typeof a.fees === 'string' ? parseFloat(a.fees) : a.fees
          bVal = typeof b.fees === 'string' ? parseFloat(b.fees) : b.fees
          break
        case 'total': {
          const aQty = typeof a.quantity === 'string' ? parseFloat(a.quantity) : a.quantity
          const aPrice = typeof a.price === 'string' ? parseFloat(a.price) : a.price
          const aFees = typeof a.fees === 'string' ? parseFloat(a.fees) : a.fees
          aVal = aQty * aPrice + aFees
          
          const bQty = typeof b.quantity === 'string' ? parseFloat(b.quantity) : b.quantity
          const bPrice = typeof b.price === 'string' ? parseFloat(b.price) : b.price
          const bFees = typeof b.fees === 'string' ? parseFloat(b.fees) : b.fees
          bVal = bQty * bPrice + bFees
          break
        }
        default:
          return 0
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }

      return sortDir === 'asc' ? (Number(aVal) - Number(bVal)) : (Number(bVal) - Number(aVal))
    })
    
    // Apply limit if showAllTransactions is false
    return showAllTransactions ? sorted : sorted.slice(0, displayLimit)
  }, [transactions, sortKey, sortDir, showAllTransactions, displayLimit, searchQuery])

  const isActive = (key: SortKey) => sortKey === key

  // Get human-readable label for sort key
  const getSortLabel = (key: SortKey): string => {
    const labels: Record<SortKey, string> = {
      tx_date: 'Date',
      symbol: 'Symbol',
      type: 'Type',
      quantity: 'Quantity',
      price: 'Price',
      fees: 'Fees',
      total: 'Total',
    }
    return labels[key]
  }

  const availableSortOptions: SortKey[] = ['tx_date', 'symbol', 'type', 'quantity', 'price', 'fees', 'total']

  const formatCurrency = (value: number | string | null, currency: string = 'EUR') => {
    return formatCurrencyUtil(value, currency)
  }

  const formatQuantity = (value: number | string | null) => {
    if (value === null || value === undefined) return '-'
    const numValue = typeof value === 'string' ? parseFloat(value) : value
    // Format with up to 8 decimals, then remove trailing zeros
    const formatted = numValue.toFixed(8)
    return formatted.replace(/\.?0+$/, '')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(currentLocale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const getTranslatedType = (type: string): string => {
    const typeMap: Record<string, string> = {
      'BUY': t('transactions.buy'),
      'SELL': t('transactions.sell'),
      'DIVIDEND': t('transactions.dividend'),
      'FEE': t('transactions.fee'),
      'SPLIT': t('transactions.split'),
      'TRANSFER_IN': t('transactions.transferIn'),
      'TRANSFER_OUT': t('transactions.transferOut'),
    }
    return typeMap[type.toUpperCase()] || type
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'all', label: t('transactions.all') },
    { id: 'buy', label: t('transactions.buy') },
    { id: 'sell', label: t('transactions.sell') },
    { id: 'dividend', label: t('transactions.dividend') },
    { id: 'fee', label: t('transactions.fee') },
    { id: 'split', label: t('transactions.split') },
  ]

  const getTransactionIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'BUY':
        return <TrendingUp size={16} className="text-green-600 dark:text-green-400" />
      case 'SELL':
        return <TrendingDown size={16} className="text-red-600 dark:text-red-400" />
      case 'SPLIT':
        return <Shuffle size={16} className="text-purple-600 dark:text-purple-400" />
      default:
        return null
    }
  }

  const getTransactionColor = (type: string) => {
    switch (type.toUpperCase()) {
      case 'BUY':
        return 'text-green-600 dark:text-green-400'
      case 'SELL':
        return 'text-red-600 dark:text-red-400'
      case 'SPLIT':
        return 'text-purple-600 dark:text-purple-400'
      default:
        return 'text-neutral-600 dark:text-neutral-400'
    }
  }

  if (portfolios.length === 0 || !activePortfolioId) {
    return <EmptyPortfolioPrompt pageType="transactions" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <TrendingUp className="text-pink-600" size={28} />
            {t('transactions.title')}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
            {t('transactions.description')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button 
            onClick={() => navigate('/transactions/metrics')}
            className="relative group px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 text-sm overflow-hidden"
          >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
            <BarChart3 size={18} className="relative z-10" />
            <span className="relative z-10 hidden sm:inline">{t('transactions.viewMetrics')}</span>
            <span className="relative z-10 sm:hidden">{t('transactions.metrics')}</span>
          </button>
          <button 
            onClick={handleImportClick}
            disabled={importLoading}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm px-3 py-2"
          >
            <Upload size={16} />
            <span className="hidden sm:inline">{importLoading ? t('common.importing') : t('common.import')}</span>
            <span className="sm:hidden">{t('common.import')}</span>
          </button>
          <button 
            onClick={handleExportClick}
            className="btn-secondary flex items-center gap-2 text-sm px-3 py-2"
          >
            <Download size={16} />
            <span className="hidden sm:inline">{t('common.export')}</span>
          </button>
          <button onClick={openAddModal} className="btn-primary flex items-center gap-2 text-sm px-3 py-2">
            <PlusCircle size={16} />
            <span className="hidden sm:inline">{t('transactions.addTransaction')}</span>
            <span className="sm:hidden">{t('common.add')}</span>
          </button>
        </div>
      </div>

      {/* Import Success/Error Messages */}
      {importSuccess && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400">
          {importSuccess}
        </div>
      )}
      {importError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {importError}
        </div>
      )}

      <div className="card overflow-hidden">
        {/* Tabs with Search Bar */}
        <div className="border-b border-neutral-200 dark:border-neutral-700 flex items-center gap-4 px-4 sm:px-6">
          <nav className="-mb-px flex space-x-4 sm:space-x-8 flex-1 overflow-x-auto scrollbar-hide" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-4 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap
                  ${
                    activeTab === tab.id
                      ? 'border-pink-500 text-pink-600 dark:text-pink-400'
                      : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300 dark:text-neutral-400 dark:hover:text-neutral-300'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          
          {/* Search Bar */}
          <div className="relative min-w-[200px] sm:min-w-[300px] py-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 dark:text-neutral-500" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('transactions.searchSymbol')}
              className="w-full pl-9 pr-8 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Transaction Count and Limit Toggle */}
        {transactions.length > 0 && (
          <div className="px-4 sm:px-6 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm text-neutral-600 dark:text-neutral-400">
              {t('common.showing')} <span className="font-semibold text-neutral-900 dark:text-neutral-100">{sortedTransactions.length}</span> {t('common.of')}{' '}
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">{transactions.length}</span> {t('transactions.transactions')}
            </div>
            {transactions.length > displayLimit && (
              <button
                onClick={() => setShowAllTransactions(!showAllTransactions)}
                className="text-sm px-3 py-1 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors text-neutral-700 dark:text-neutral-300 font-medium"
              >
                {showAllTransactions ? t('transactions.showLast', { count: displayLimit }) : t('transactions.showAll')}
              </button>
            )}
          </div>
        )}

        {/* Transactions Table */}
        <div>
          {loading ? (
            // Loading skeleton
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 dark:bg-neutral-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{t('transactions.date')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{t('transactions.asset')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{t('transactions.type')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{t('transactions.quantity')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{t('transactions.price')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{t('transactions.fees')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{t('transactions.total')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{t('transactions.notes')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{t('transactions.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-700 rounded"></div></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                          <div className="space-y-2">
                            <div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                            <div className="h-3 w-20 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4"><div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-700 rounded"></div></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div></td>
                      <td className="px-6 py-4"><div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-700 rounded"></div></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
              <p>{t('transactions.noTransactions')}</p>
              <p className="text-sm mt-2">{t('transactions.noTransactionsInfo')}</p>
            </div>
          ) : sortedTransactions.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
              <p>{t('transactions.noTransactionMatches')}</p>
              <p className="text-sm mt-2">
                {t('transactions.noTransactionMatchesInfo')}{' '}
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-pink-600 dark:text-pink-400 hover:underline font-medium"
                >
                  {t('transactions.noTransactionMatchesClear')}
                </button>
              </p>
            </div>
          ) : (
            <>
              {/* Mobile: Sort Controls & Card Layout */}
              <div className="lg:hidden">
                {/* Sort Controls */}
                <div className="flex items-center gap-2 p-3">
                  <label htmlFor="mobile-sort-tx" className="text-sm font-medium text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                    {t('common.sortBy')}:
                  </label>
                  <select
                    id="mobile-sort-tx"
                    value={sortKey}
                    onChange={(e) => handleSort(e.target.value as SortKey)}
                    className="flex-1 input text-sm py-2 px-3"
                  >
                    {availableSortOptions.map((option) => (
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
                  {sortedTransactions.map((transaction) => {
                    const quantity = typeof transaction.quantity === 'string' 
                      ? parseFloat(transaction.quantity) 
                      : transaction.quantity
                    const price = typeof transaction.price === 'string' 
                      ? parseFloat(transaction.price) 
                      : transaction.price
                    const fees = typeof transaction.fees === 'string' 
                      ? parseFloat(transaction.fees) 
                      : transaction.fees
                    const total = quantity * price + fees
                    const txData = transaction as unknown as Record<string, unknown>
                    const metadata = transaction.metadata || txData.meta_data as { split?: string } | undefined

                    return (
                      <div key={transaction.id} className="card p-4">
                        {/* Header: Date, Symbol, Type, Total */}
                        <div className="flex items-start justify-between mb-3 pb-3 border-b border-neutral-200 dark:border-neutral-700">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <img 
                              src={getAssetLogoUrl(transaction.asset.symbol, transaction.asset.asset_type, transaction.asset.name)}
                              alt={`${transaction.asset.symbol} logo`}
                              className="w-10 h-10 flex-shrink-0 object-cover"
                              onLoad={(e) => {
                                const img = e.currentTarget as HTMLImageElement
                                if (!validateLogoImage(img)) {
                                  img.dispatchEvent(new Event('error'))
                                }
                              }}
                              onError={(e) => handleLogoError(e, transaction.asset.symbol, transaction.asset.name, transaction.asset.asset_type)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                                {transaction.asset.symbol}
                              </div>
                              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                                {formatDate(transaction.tx_date)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right ml-3">
                            <div className={`flex items-center justify-end gap-1 text-sm font-medium mb-1 ${getTransactionColor(transaction.type)}`}>
                              {getTransactionIcon(transaction.type)}
                              {getTranslatedType(transaction.type)}
                            </div>
                            <div className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                              {transaction.type === 'SPLIT' ? '-' : formatCurrency(total, transaction.currency)}
                            </div>
                          </div>
                        </div>

                        {/* Data Grid */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                          <div>
                            <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('transactions.quantity')}</span>
                            <div className="font-medium text-neutral-900 dark:text-neutral-100">
                              {transaction.type === 'SPLIT' ? '-' : formatQuantity(transaction.quantity)}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('transactions.price')}</span>
                            <div className="font-medium text-neutral-900 dark:text-neutral-100">
                              {transaction.type === 'SPLIT' ? '-' : formatCurrency(transaction.price, transaction.currency)}
                            </div>
                          </div>
                          <div>
                            <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('transactions.fees')}</span>
                            <div className="font-medium text-neutral-900 dark:text-neutral-100">
                              {transaction.type === 'SPLIT' ? '-' : formatCurrency(transaction.fees, transaction.currency)}
                            </div>
                          </div>
                          {transaction.asset.name && (
                            <div className="text-right">
                              <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('transactions.assetName')}</span>
                              <div className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                                {transaction.asset.name}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Notes */}
                        {(transaction.notes || (transaction.type === 'SPLIT' && metadata?.split)) && (
                          <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                            <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('transactions.notes')}:</span>
                            <div className="text-sm text-neutral-700 dark:text-neutral-300 mt-1">
                              {transaction.type === 'SPLIT' && metadata?.split ? (
                                <span className="inline-flex items-center gap-1">
                                  <span className="font-medium text-purple-700 dark:text-purple-400">{metadata.split} {t('transactions.split')}</span>
                                  {transaction.notes && <span className="text-neutral-400">•</span>}
                                  {transaction.notes}
                                </span>
                              ) : (
                                transaction.notes
                              )}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                          {assetHasSplits(transaction.asset_id) && (
                            <button
                              onClick={() => setSplitHistoryAsset({ id: transaction.asset_id, symbol: transaction.asset.symbol })}
                              className="btn-secondary text-sm px-3 py-2 flex items-center gap-2"
                            >
                              <Shuffle size={16} />
                              {t('transactions.splits')}
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(transaction)}
                            className="btn-secondary text-sm px-3 py-2 flex items-center gap-2"
                          >
                            <Edit2 size={16} />
                            {t('common.edit')}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(transaction.id)}
                            className="btn-secondary text-sm px-3 py-2 flex items-center gap-2 text-red-600 dark:text-red-400"
                          >
                            <Trash2 size={16} />
                            {t('common.delete')}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Desktop: Table Layout */}
              <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800/50">
                <tr>
                  <th 
                    onClick={() => handleSort('tx_date')}
                    aria-sort={isActive('tx_date') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {t('transactions.date')} <SortIcon column="tx_date" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('symbol')}
                    aria-sort={isActive('symbol') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {t('transactions.asset')} <SortIcon column="symbol" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('type')}
                    aria-sort={isActive('type') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {t('transactions.type')} <SortIcon column="type" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('quantity')}
                    aria-sort={isActive('quantity') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {t('transactions.quantity')} <SortIcon column="quantity" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('price')}
                    aria-sort={isActive('price') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {t('transactions.price')} <SortIcon column="price" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('fees')}
                    aria-sort={isActive('fees') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {t('transactions.fees')} <SortIcon column="fees" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('total')}
                    aria-sort={isActive('total') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {t('transactions.total')} <SortIcon column="total" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    {t('transactions.notes')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    {t('transactions.action')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {sortedTransactions.map((transaction) => {
                  const quantity = typeof transaction.quantity === 'string' 
                    ? parseFloat(transaction.quantity) 
                    : transaction.quantity
                  const price = typeof transaction.price === 'string' 
                    ? parseFloat(transaction.price) 
                    : transaction.price
                  const fees = typeof transaction.fees === 'string' 
                    ? parseFloat(transaction.fees) 
                    : transaction.fees
                  const total = quantity * price + fees

                  return (
                    <tr
                      key={transaction.id}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900 dark:text-neutral-100">
                        {formatDate(transaction.tx_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <img 
                            src={getAssetLogoUrl(transaction.asset.symbol, transaction.asset.asset_type, transaction.asset.name)}
                            alt={`${transaction.asset.symbol} logo`}
                            className="w-6 h-6 object-cover"
                            onLoad={(e) => {
                              const img = e.currentTarget as HTMLImageElement
                              if (!validateLogoImage(img)) {
                                img.dispatchEvent(new Event('error'))
                              }
                            }}
                            onError={(e) => handleLogoError(e, transaction.asset.symbol, transaction.asset.name, transaction.asset.asset_type)}
                          />
                          <div>
                            <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                              {transaction.asset.symbol}
                            </div>
                            {transaction.asset.name && (
                              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                                {transaction.asset.name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`flex items-center gap-2 text-sm font-medium ${getTransactionColor(transaction.type)}`}>
                          {getTransactionIcon(transaction.type)}
                          {getTranslatedType(transaction.type)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-neutral-900 dark:text-neutral-100">
                        {transaction.type === 'SPLIT' ? '-' : formatQuantity(transaction.quantity)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-neutral-900 dark:text-neutral-100">
                        {transaction.type === 'SPLIT' ? '-' : formatCurrency(transaction.price, transaction.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-neutral-900 dark:text-neutral-100">
                        {transaction.type === 'SPLIT' ? '-' : formatCurrency(transaction.fees, transaction.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {transaction.type === 'SPLIT' ? '-' : formatCurrency(total, transaction.currency)}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-500 dark:text-neutral-400 max-w-xs truncate">
                        {(() => {
                          const txData = transaction as unknown as Record<string, unknown>
                          const metadata = transaction.metadata || txData.meta_data as { split?: string } | undefined
                          return transaction.type === 'SPLIT' && metadata?.split ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="font-medium text-purple-700 dark:text-purple-400">{metadata.split} {t('transactions.split')}</span>
                              {transaction.notes && <span className="text-neutral-400">•</span>}
                              {transaction.notes}
                            </span>
                          ) : (
                            transaction.notes || '-'
                          )
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {assetHasSplits(transaction.asset_id) && (
                            <button
                              onClick={() => setSplitHistoryAsset({ id: transaction.asset_id, symbol: transaction.asset.symbol })}
                              className="p-2 text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20 rounded transition-colors"
                              title={t('transactions.viewSplitHistory')}
                            >
                              <Shuffle size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(transaction)}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title={t('transactions.editTransaction')}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(transaction.id)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded transition-colors"
                            title={t('transactions.deleteTransaction')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalMode && (
        <div className="modal-overlay bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {modalMode === 'add' ? t('transactions.addTransaction') : t('transactions.editTransaction')}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {modalMode === 'add' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    {t('transactions.ticker')}
                  </label>
                  <input
                    type="text"
                    value={ticker}
                    onChange={handleTickerChange}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                    placeholder={t('transactions.tickerSearchPlaceholder')}
                  />
                  {searchResults.length > 0 && (
                    <ul className="mt-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {searchResults.map((item: TickerInfo) => (
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
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    {t('transactions.date')}
                  </label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    {t('transactions.type')}
                  </label>
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="BUY">{t('transactions.buy')}</option>
                    <option value="SELL">{t('transactions.sell')}</option>
                    <option value="DIVIDEND">{t('transactions.dividend')}</option>
                    <option value="FEE">{t('transactions.fee')}</option>
                    <option value="SPLIT">{t('transactions.split')}</option>
                    <option value="TRANSFER_IN">{t('transactions.transferIn')}</option>
                    <option value="TRANSFER_OUT">{t('transactions.transferOut')}</option>
                  </select>
                </div>
              </div>

              {/* Split Ratio Field - Only shown for SPLIT transactions */}
              {txType === 'SPLIT' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    {t('transactions.splitRatio')}
                  </label>
                  <input
                    type="text"
                    value={splitRatio}
                    onChange={(e) => setSplitRatio(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                    placeholder={t('transactions.splitRatioPlaceholder')}
                    required
                  />
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    {t('transactions.splitRatioInfo')}  
                  </p>
                </div>
              )}

              {/* Quantity, Price, Fees - Hidden for SPLIT transactions */}
              {txType !== 'SPLIT' && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      {t('transactions.quantity')}
                    </label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      {t('transactions.price')} ({portfolioCurrency}) {modalMode === 'add' && `(${t('transactions.optional')})`}
                    </label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                      min="0"
                      step="any"
                      placeholder={modalMode === 'add' ? t('transactions.autoFetch') : '0.00'}
                      required={modalMode === 'edit'}
                    />
                    {modalMode === 'add' && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        {t('transactions.autoFetchInfo', { currency: portfolioCurrency })}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      {t('transactions.fees')} ({portfolioCurrency})
                    </label>
                    <input
                      type="number"
                      value={fees}
                      onChange={(e) => setFees(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                      min="0"
                      step="any"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  {t('transactions.notes')}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  rows={3}
                  placeholder={t('transactions.notesPlaceholder')}
                />
              </div>

              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={formLoading || (modalMode === 'add' && !selectedTicker)}
                  className="flex-1 px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:bg-neutral-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  {formLoading ? t('common.saving') : modalMode === 'add' ? t('common.add') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
              {t('transactions.deleteTransaction')}
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              {t('transactions.deleteConfirm')}
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

      {/* Split History Modal */}
      {splitHistoryAsset && (
        <SplitHistory
          assetId={splitHistoryAsset.id}
          assetSymbol={splitHistoryAsset.symbol}
          onClose={() => setSplitHistoryAsset(null)}
        />
      )}

      {/* Import Progress Modal */}
      <ImportProgressModal
        isOpen={showImportProgress}
        onClose={handleImportClose}
        onComplete={handleImportComplete}
        portfolioId={activePortfolioId || 0}
        file={importFile}
      />
    </div>
  )
}

