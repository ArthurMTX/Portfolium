import { useState, useEffect, useMemo, useCallback } from 'react'
import usePortfolioStore from '../store/usePortfolioStore'
import api from '../lib/api'
import { PlusCircle, Upload, Download, TrendingUp, TrendingDown, Edit2, Trash2, X, ArrowUpDown, ChevronUp, ChevronDown, Shuffle, Search } from 'lucide-react'
import SplitHistory from '../components/SplitHistory'
import EmptyPortfolioPrompt from '../components/EmptyPortfolioPrompt'
import ImportProgressModal from '../components/ImportProgressModal'

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

// Normalize ticker by removing currency suffixes like -USD, -EUR, -USDT
const normalizeTickerForLogo = (symbol: string): string => {
  return symbol.replace(/-(USD|EUR|GBP|USDT|BUSD|JPY|CAD|AUD|CHF|CNY)$/i, '')
}


export default function Transactions() {
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
  const SortIcon = ({ col }: { col: SortKey }) => {
    const active = isActive(col)
    if (!active) return <ArrowUpDown size={14} className="inline ml-1 opacity-40" />
    return sortDir === 'asc' ? (
      <ChevronUp size={14} className="inline ml-1 opacity-80" />
    ) : (
      <ChevronDown size={14} className="inline ml-1 opacity-80" />
    )
  }

  const formatCurrency = (value: number | string | null, currency: string = 'EUR') => {
    if (value === null || value === undefined) return '-'
    const numValue = typeof value === 'string' ? parseFloat(value) : value
    
    // Format with up to 2 decimals, removing trailing zeros
    const formatted = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(numValue)
    
    return formatted
  }

  const formatQuantity = (value: number | string | null) => {
    if (value === null || value === undefined) return '-'
    const numValue = typeof value === 'string' ? parseFloat(value) : value
    // Format with up to 8 decimals, then remove trailing zeros
    const formatted = numValue.toFixed(8)
    return formatted.replace(/\.?0+$/, '')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'buy', label: 'Buy' },
    { id: 'sell', label: 'Sell' },
    { id: 'dividend', label: 'Dividend' },
    { id: 'fee', label: 'Fees' },
    { id: 'split', label: 'Split' },
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
            Transactions
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
            Track all your buy, sell, and dividend transactions
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button 
            onClick={handleImportClick}
            disabled={importLoading}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm px-3 py-2"
          >
            <Upload size={16} />
            <span className="hidden sm:inline">{importLoading ? 'Importing...' : 'Import'}</span>
            <span className="sm:hidden">Import</span>
          </button>
          <button 
            onClick={handleExportClick}
            className="btn-secondary flex items-center gap-2 text-sm px-3 py-2"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button onClick={openAddModal} className="btn-primary flex items-center gap-2 text-sm px-3 py-2">
            <PlusCircle size={16} />
            <span className="hidden sm:inline">Add Transaction</span>
            <span className="sm:hidden">Add</span>
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
              placeholder="Search symbol or name..."
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
              Showing <span className="font-semibold text-neutral-900 dark:text-neutral-100">{sortedTransactions.length}</span> of{' '}
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">{transactions.length}</span> transactions
            </div>
            {transactions.length > displayLimit && (
              <button
                onClick={() => setShowAllTransactions(!showAllTransactions)}
                className="text-sm px-3 py-1 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors text-neutral-700 dark:text-neutral-300 font-medium"
              >
                {showAllTransactions ? `Show Last ${displayLimit}` : 'Show All'}
              </button>
            )}
          </div>
        )}

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Asset</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Fees</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Notes</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Actions</th>
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
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
              <p>No transactions found</p>
              <p className="text-sm mt-2">Start by adding your first transaction</p>
            </div>
          ) : sortedTransactions.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
              <p>No transactions match your search</p>
              <p className="text-sm mt-2">
                Try searching for a different symbol or name, or{' '}
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-pink-600 dark:text-pink-400 hover:underline font-medium"
                >
                  clear the search
                </button>
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800/50">
                <tr>
                  <th 
                    onClick={() => handleSort('tx_date')}
                    aria-sort={isActive('tx_date') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Date <SortIcon col="tx_date" />
                  </th>
                  <th 
                    onClick={() => handleSort('symbol')}
                    aria-sort={isActive('symbol') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Asset <SortIcon col="symbol" />
                  </th>
                  <th 
                    onClick={() => handleSort('type')}
                    aria-sort={isActive('type') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Type <SortIcon col="type" />
                  </th>
                  <th 
                    onClick={() => handleSort('quantity')}
                    aria-sort={isActive('quantity') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Quantity <SortIcon col="quantity" />
                  </th>
                  <th 
                    onClick={() => handleSort('price')}
                    aria-sort={isActive('price') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Price <SortIcon col="price" />
                  </th>
                  <th 
                    onClick={() => handleSort('fees')}
                    aria-sort={isActive('fees') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Fees <SortIcon col="fees" />
                  </th>
                  <th 
                    onClick={() => handleSort('total')}
                    aria-sort={isActive('total') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Total <SortIcon col="total" />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Actions
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
                            src={`/logos/${normalizeTickerForLogo(transaction.asset.symbol)}${transaction.asset.asset_type?.toUpperCase() === 'ETF' ? '?asset_type=ETF' : ''}`}
                            alt={`${transaction.asset.symbol} logo`}
                            className="w-6 h-6 object-cover"
                            onLoad={(e) => {
                              const img = e.currentTarget as HTMLImageElement
                              if (img.dataset.validated) return
                              img.dataset.validated = 'true'
                              try {
                                const canvas = document.createElement('canvas')
                                const ctx = canvas.getContext('2d')
                                if (!ctx) return
                                const w = Math.min(img.naturalWidth || 0, 64) || 24
                                const h = Math.min(img.naturalHeight || 0, 64) || 24
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
                            onError={(e) => {
                              const img = e.currentTarget as HTMLImageElement
                              if (!img.dataset.resolverTried) {
                                img.dataset.resolverTried = 'true'
                                const params = new URLSearchParams()
                                if (transaction.asset.name) params.set('name', transaction.asset.name)
                                if (transaction.asset.asset_type) params.set('asset_type', transaction.asset.asset_type)
                                fetch(`/api/assets/logo/${transaction.asset.symbol}?${params.toString()}`, { redirect: 'follow' })
                                  .then((res) => {
                                    if (res.redirected) {
                                      img.src = res.url
                                    } else if (res.ok) {
                                      return res.blob().then((blob) => {
                                        img.src = URL.createObjectURL(blob)
                                      })
                                    } else {
                                      img.style.display = 'none'
                                    }
                                  })
                                  .catch(() => {
                                    img.style.display = 'none'
                                  })
                              } else {
                                img.style.display = 'none'
                              }
                            }}
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
                          {transaction.type}
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
                              <span className="font-medium text-purple-700 dark:text-purple-400">{metadata.split} split</span>
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
                              title="View Split History"
                            >
                              <Shuffle size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(transaction)}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(transaction.id)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete"
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
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalMode && (
        <div className="modal-overlay bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {modalMode === 'add' ? 'Add Transaction' : 'Edit Transaction'}
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
                    Ticker
                  </label>
                  <input
                    type="text"
                    value={ticker}
                    onChange={handleTickerChange}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                    placeholder="Search ticker (e.g., AAPL)..."
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
                    Date
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
                    Type
                  </label>
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="BUY">Buy</option>
                    <option value="SELL">Sell</option>
                    <option value="DIVIDEND">Dividend</option>
                    <option value="FEE">Fee</option>
                    <option value="SPLIT">Split</option>
                    <option value="TRANSFER_IN">Transfer In</option>
                    <option value="TRANSFER_OUT">Transfer Out</option>
                  </select>
                </div>
              </div>

              {/* Split Ratio Field - Only shown for SPLIT transactions */}
              {txType === 'SPLIT' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Split Ratio
                  </label>
                  <input
                    type="text"
                    value={splitRatio}
                    onChange={(e) => setSplitRatio(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                    placeholder="e.g., 2:1 (2-for-1 split) or 1:2 (reverse split)"
                    required
                  />
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    Format: "N:M" where N is new shares and M is old shares. Examples: "2:1" (doubles shares), "3:1" (triples), "1:2" (reverse split halves shares)
                  </p>
                </div>
              )}

              {/* Quantity, Price, Fees - Hidden for SPLIT transactions */}
              {txType !== 'SPLIT' && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      Quantity
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
                      Price ({portfolioCurrency}) {modalMode === 'add' && '(Optional)'}
                    </label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                      min="0"
                      step="any"
                      placeholder={modalMode === 'add' ? 'Auto-fetch' : '0.00'}
                      required={modalMode === 'edit'}
                    />
                    {modalMode === 'add' && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        Leave empty to auto-fetch price in USD, or enter price in {portfolioCurrency}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      Fees ({portfolioCurrency})
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
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  rows={3}
                  placeholder="Optional notes..."
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading || (modalMode === 'add' && !selectedTicker)}
                  className="flex-1 px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:bg-neutral-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  {formLoading ? 'Saving...' : modalMode === 'add' ? 'Add Transaction' : 'Save Changes'}
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
              Delete Transaction
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              Are you sure you want to delete this transaction? This action cannot be undone.
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

