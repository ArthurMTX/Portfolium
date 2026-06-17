import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import api, { type CsvImportPreviewResultDTO } from '@/api'
import { PlusCircle, Upload, Download, TrendingUp, TrendingDown, ArrowLeftRight, X, Shuffle, Search, BarChart3, RefreshCw, DollarSign } from 'lucide-react'
import SplitHistory from '@/features/assets/components/SplitHistory'
import EmptyPortfolioPrompt from '@/features/portfolios/components/EmptyPortfolioPrompt'
import ImportReviewModal from '@/features/transactions/components/ImportReviewModal'
import ImportProgressModal from '@/features/transactions/components/ImportProgressModal'
import ConversionModal from '@/features/transactions/components/ConversionModal'
import PendingDividends from '@/features/transactions/components/PendingDividends'
import TransactionFormModal from '@/features/transactions/components/TransactionFormModal'
import TransactionsLoadingTable from '@/features/transactions/components/TransactionsLoadingTable'
import TransactionsResponsiveList from '@/features/transactions/components/TransactionsResponsiveList'
import Toast from '@/shared/components/Toast'
import { useTranslation } from 'react-i18next'
import { getFilteredSortedTransactions } from '@/features/transactions/lib/transactionSortUtils'
import {
  getTransactionSummary,
  getTransactionWarnings,
  type PriceSource,
  type TransactionSummary,
  type WarningLevel,
} from '@/features/transactions/lib/transactionDerivedState'
import {
  buildAutoPricePayload,
  buildCreateTransactionPayload,
  buildUpdatePayload,
  shouldUseAutoPriceTransaction,
  validateTransactionSubmit,
  type TransactionValidationErrorCode,
} from '@/features/transactions/lib/transactionPayloadBuilders'

interface TickerInfo {
  symbol: string
  name: string
  type?: string | null
  asset_type?: string | null
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

type TabType = 'all' | 'buy' | 'sell' | 'dividend' | 'fee' | 'split' | 'conversion'
type ModalMode = 'add' | 'edit' | null
type SortKey = 'tx_date' | 'symbol' | 'type' | 'quantity' | 'price' | 'fees' | 'total'
type SortDir = 'asc' | 'desc'

export default function Transactions() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const portfolios = usePortfolioStore((state) => state.portfolios)
  const setPortfolios = usePortfolioStore((state) => state.setPortfolios)
  const incrementDataVersion = usePortfolioStore((state) => state.incrementDataVersion)
  const activePortfolio = portfolios.find(p => p.id === activePortfolioId)
  const portfolioCurrency = activePortfolio?.base_currency || 'EUR'

  // Helper to invalidate all portfolio-related caches
  const invalidatePortfolioData = useCallback(async () => {
    // Remove all queries from cache to force fresh fetch
    queryClient.removeQueries()
    // Increment data version to trigger useEffect re-fetches in widgets
    incrementDataVersion()
  }, [queryClient, incrementDataVersion])
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
  const [priceLoading, setPriceLoading] = useState(false)
  const [handledPrefillSymbol, setHandledPrefillSymbol] = useState(false)
  const [priceInfo, setPriceInfo] = useState<{ converted: boolean; asset_currency: string } | null>(null)
  const [priceSource, setPriceSource] = useState<PriceSource>('empty')
  const [priceFetchFailed, setPriceFetchFailed] = useState(false)
  const [assetCurrency, setAssetCurrency] = useState<string | null>(null)
  const [sellAvailableQuantity, setSellAvailableQuantity] = useState<number | null>(null)
  const [sellQuantityLoading, setSellQuantityLoading] = useState(false)
  const [riskAcknowledged, setRiskAcknowledged] = useState(false)
  const [fxRates, setFxRates] = useState<Record<string, number | null>>({})
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState("")
  const [importSuccess, setImportSuccess] = useState("")
  const [splitHistoryAsset, setSplitHistoryAsset] = useState<{ id: number; symbol: string } | null>(null)
  const [showImportReview, setShowImportReview] = useState(false)
  const [showImportProgress, setShowImportProgress] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<CsvImportPreviewResultDTO | null>(null)
  const [importPreviewLoading, setImportPreviewLoading] = useState(false)
  const [importPreviewError, setImportPreviewError] = useState("")
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showConversionModal, setShowConversionModal] = useState(false)

  const selectedTickerAssetType = selectedTicker?.asset_type || selectedTicker?.type || null

  // Load portfolios if not already loaded
  useEffect(() => {
    if (portfolios.length === 0) {
      api.getPortfolios().then(setPortfolios).catch(console.error)
    }
  }, [portfolios.length, setPortfolios])

  // Prevent body scroll when modals are open
  useEffect(() => {
    if (modalMode || deleteConfirm || showImportReview || showImportProgress || showConversionModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [modalMode, deleteConfirm, showImportReview, showImportProgress, showConversionModal])

  const fetchTransactions = useCallback(async () => {
    if (!activePortfolioId) return
    
    setLoading(true)
    try {
      // For conversion tab, we need to fetch all and filter client-side
      // because conversions include both CONVERSION_IN and CONVERSION_OUT
      const filters = activeTab !== 'all' && activeTab !== 'conversion' 
        ? { tx_type: activeTab.toUpperCase() } 
        : undefined
      let data = await api.getTransactions(activePortfolioId, filters)
      
      // Filter for conversion types on client-side
      if (activeTab === 'conversion') {
        data = data.filter((tx: Transaction) => 
          tx.type === 'CONVERSION_IN' || tx.type === 'CONVERSION_OUT'
        )
      }
      
      setTransactions(data)
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setLoading(false)
    }
  }, [activePortfolioId, activeTab])

  useEffect(() => {
    // Clear transactions immediately when portfolio changes
    setTransactions([])
    
    if (activePortfolioId) {
      fetchTransactions()
    }
  }, [activePortfolioId, fetchTransactions])

  // Cache FX rates needed to display DIVIDEND totals in portfolio currency
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (!activePortfolioId) return
      if (!transactions.length) return

      const needed: Array<{ key: string; from: string; to: string; date: string }> = []
      const seen = new Set<string>()

      for (const tx of transactions) {
        if (tx.type !== 'DIVIDEND') continue
        const from = (tx.currency || '').toUpperCase()
        const to = portfolioCurrency
        const date = tx.tx_date
        if (!from || !date) continue
        if (from === to) continue

        const key = `${from}|${to}|${date}`
        if (key in fxRates) continue // already loaded (rate or failure)
        if (seen.has(key)) continue
        seen.add(key)
        needed.push({ key, from, to, date })
      }

      if (!needed.length) return

      const results = await Promise.all(
        needed.map(async (item) => {
          try {
            const res = await api.getFxRateForDate(activePortfolioId, item.from, item.to, item.date)
            return { key: item.key, rate: res.rate as number }
          } catch {
            return { key: item.key, rate: null as null }
          }
        })
      )

      if (cancelled) return
      setFxRates((prev) => {
        const next = { ...prev }
        for (const r of results) next[r.key] = r.rate
        return next
      })
    }

    run()
    return () => {
      cancelled = true
    }
  }, [activePortfolioId, transactions, portfolioCurrency, fxRates])

  // moved into useCallback above

  // Ticker search
  const handleTickerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setTicker(e.target.value)
    setSelectedTicker(null)
    setPrice("")
    setPriceSource('empty')
    setPriceFetchFailed(false)
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
    setPriceInfo(null)
    setPriceSource('empty')
    setPriceFetchFailed(false)
    // Auto-fetch price for the selected ticker and current date
    if (activePortfolioId && txDate && txType !== 'SPLIT' && txType !== 'DIVIDEND') {
      fetchPriceForTicker(tickerInfo.symbol, txDate)
    }
  }

  // Auto-fetch price when ticker or date changes
  const fetchPriceForTicker = useCallback(async (symbol: string, date: string) => {
    if (!activePortfolioId || !symbol || !date) return
    
    setPriceLoading(true)
    setPriceInfo(null)
    setPriceFetchFailed(false)
    setPrice("")
    setPriceSource('empty')
    try {
      const result = await api.fetchPriceForDate(activePortfolioId, symbol, date)
      setPrice(formatDecimalForInput(result.price))
      setPriceSource('auto')
      setPriceInfo({
        converted: result.converted,
        asset_currency: result.asset_currency
      })
    } catch (err) {
      console.error("Failed to fetch price:", err)
      setPriceFetchFailed(true)
      // Don't show error - user can still enter price manually
    } finally {
      setPriceLoading(false)
    }
  }, [activePortfolioId])

  useEffect(() => {
    const prefillSymbol = searchParams.get('symbol')?.trim().toUpperCase()
    if (!prefillSymbol || handledPrefillSymbol) return

    setTicker(prefillSymbol)
    setSelectedTicker({ symbol: prefillSymbol, name: '' })
    setTxType('BUY')
    setModalMode('add')
    setHandledPrefillSymbol(true)

    if (activePortfolioId && txDate) {
      fetchPriceForTicker(prefillSymbol, txDate)
    }
  }, [activePortfolioId, fetchPriceForTicker, handledPrefillSymbol, searchParams, txDate])

  // Handle date change - auto-fetch price if ticker is selected
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value
    setTxDate(newDate)
    // Auto-fetch price if we have a selected ticker and it's not a SPLIT
    if (selectedTicker && txType !== 'SPLIT' && txType !== 'DIVIDEND') {
      fetchPriceForTicker(selectedTicker.symbol, newDate)
    }
  }

  // Auto-fill shares for DIVIDEND and fetch asset currency for labeling/submission
  useEffect(() => {
    const run = async () => {
      if (!activePortfolioId) return
      if (txType !== 'DIVIDEND') return
      const symbol = selectedTicker?.symbol || ticker
      if (!symbol || !txDate) return

      try {
        // Try to resolve asset id (if not found, shares are necessarily 0)
        const assets = await api.getAssets(symbol)
        const match = (assets as Array<{ id?: number; symbol?: string; currency?: string }>).find(
          (a) => a.symbol?.toUpperCase() === symbol.toUpperCase()
        )
        const resolvedAssetId = match?.id
        if (!resolvedAssetId) {
          setQuantity('0')
          setAssetCurrency(match?.currency || assetCurrency || portfolioCurrency)
          return
        }

        const result = await api.getPositionQuantityAtDate(activePortfolioId, resolvedAssetId, txDate)
        setQuantity(formatDecimalForInput(result.quantity))
        setAssetCurrency(result.asset_currency || portfolioCurrency)

        if (result.quantity <= 0) {
          setFormError(t('transactions.noSharesAtDate'))
        } else {
          // Only clear the specific "no shares" error when shares become > 0
          setFormError((prev) => (prev === t('transactions.noSharesAtDate') ? "" : prev))
        }
      } catch (err) {
        // Non-fatal: keep quantity editable value
        setAssetCurrency(assetCurrency || portfolioCurrency)
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePortfolioId, selectedTicker?.symbol, ticker, txDate, txType])

  useEffect(() => {
    setRiskAcknowledged(false)
  }, [txType, quantity, price, fees, txDate, selectedTicker?.symbol, splitRatio, sellAvailableQuantity])

  useEffect(() => {
    let cancelled = false

    const loadAvailableQuantity = async () => {
      setSellAvailableQuantity(null)

      if (
        modalMode !== 'add' ||
        txType !== 'SELL' ||
        !activePortfolioId ||
        !selectedTicker?.symbol ||
        !txDate
      ) {
        setSellQuantityLoading(false)
        return
      }

      setSellQuantityLoading(true)
      try {
        const assets = await api.getAssets(selectedTicker.symbol)
        const match = (assets as Array<{ id?: number; symbol?: string }>).find(
          (a) => a.symbol?.toUpperCase() === selectedTicker.symbol.toUpperCase()
        )
        if (!match?.id) {
          if (!cancelled) setSellAvailableQuantity(0)
          return
        }

        const result = await api.getPositionQuantityAtDate(activePortfolioId, match.id, txDate)
        if (!cancelled) setSellAvailableQuantity(result.quantity)
      } catch (err) {
        console.error('Failed to fetch available sell quantity:', err)
      } finally {
        if (!cancelled) setSellQuantityLoading(false)
      }
    }

    loadAvailableQuantity()
    return () => {
      cancelled = true
    }
  }, [activePortfolioId, modalMode, selectedTicker?.symbol, txDate, txType])

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
    setSelectedTicker({
      symbol: transaction.asset.symbol,
      name: transaction.asset.name || '',
      asset_type: transaction.asset.asset_type || null,
    })
    setTicker(transaction.asset.symbol)
    setTxDate(transaction.tx_date)
    setTxType(transaction.type)
    setQuantity(formatDecimalForInput(transaction.quantity))
    setPrice(formatDecimalForInput(transaction.price))
    setPriceSource(transaction.price ? 'manual' : 'empty')
    setFees(formatDecimalForInput(transaction.fees))
    setAssetCurrency(transaction.currency || null)
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
    setPriceLoading(false)
    setPriceInfo(null)
    setPriceSource('empty')
    setPriceFetchFailed(false)
    setAssetCurrency(null)
    setSellAvailableQuantity(null)
    setSellQuantityLoading(false)
    setRiskAcknowledged(false)
  }

  const getValidationErrorMessage = (code: TransactionValidationErrorCode) => {
    const messages: Record<TransactionValidationErrorCode, string> = {
      'portfolio-required': 'Please select a portfolio first',
      'ticker-required': 'Please select a ticker',
      'invalid-date': t('transactions.errors.invalidDate'),
      'future-date': t('transactions.warnings.futureDate'),
      'quantity-must-be-positive': t('transactions.errors.quantityMustBePositive'),
      'fees-must-be-positive': t('transactions.errors.feesMustBePositive'),
      'price-must-be-positive': t('transactions.errors.priceMustBePositive'),
      'checking-position': t('transactions.warnings.checkingPosition'),
      'no-shares-at-date': t('transactions.noSharesAtDate'),
      'dividend-per-share-must-be-positive': t('transactions.dividendPerShareMustBePositive'),
      'tax-cannot-exceed-gross': t('transactions.taxCannotExceedGross'),
    }
    return messages[code]
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError("")

    const validation = validateTransactionSubmit({
      activePortfolioId,
      hasSelectedTicker: Boolean(selectedTicker),
      modalMode,
      txDate,
      txType,
      quantity,
      price,
      fees,
      sellQuantityLoading,
      riskAcknowledged,
      sellAvailableQuantity,
    })

    if (!validation.ok && validation.action === 'confirm-risk') {
      setRiskAcknowledged(true)
      setFormLoading(false)
      return
    }

    if (!validation.ok) {
      setFormError(getValidationErrorMessage(validation.code))
      setFormLoading(false)
      return
    }

    const portfolioId = activePortfolioId!

    try {
      if (modalMode === 'add') {
        // Add new transaction
        if (shouldUseAutoPriceTransaction(txType, price)) {
          // Auto-fetch price using API client (for BUY/SELL)
          const autoPricePayload = buildAutoPricePayload(selectedTicker!.symbol, txDate, txType, quantity)
          await api.addPositionTransaction(
            portfolioId,
            autoPricePayload.symbol,
            autoPricePayload.txDate,
            autoPricePayload.txType,
            autoPricePayload.quantity
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
              asset_type: selectedTickerAssetType || undefined,
            })
            assetId = created.id
          }
          const resolvedAssetId = assetId as number

          let txCurrency = txType === 'DIVIDEND' ? (assetCurrency || portfolioCurrency) : portfolioCurrency
          if (txType === 'DIVIDEND') {
            try {
              const atDate = await api.getPositionQuantityAtDate(portfolioId, resolvedAssetId, txDate)
              if (atDate.asset_currency) txCurrency = atDate.asset_currency
            } catch {
              // Non-fatal
            }
          }

          await api.createTransaction(portfolioId, buildCreateTransactionPayload({
            assetId: resolvedAssetId,
            txDate,
            txType,
            quantity,
            price,
            fees,
            currency: txCurrency,
            notes,
            splitRatio,
          }))
        }
      } else if (modalMode === 'edit' && editingTransaction) {
        // Update existing transaction
        const txCurrency = txType === 'DIVIDEND' ? (assetCurrency || editingTransaction.currency || portfolioCurrency) : editingTransaction.currency
        
        await api.updateTransaction(
          portfolioId,
          editingTransaction.id,
          buildUpdatePayload({
            assetId: editingTransaction.asset_id,
            txDate,
            txType,
            quantity,
            price,
            fees,
            currency: txCurrency,
            notes,
            existingMetadata: editingTransaction.metadata || {},
            splitRatio,
          })
        )
      }

      // Clear caches immediately
      await invalidatePortfolioData()
      
      // Refetch to get fresh data
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
      // Optimistically remove from local state immediately
      setTransactions(prev => prev.filter(t => t.id !== transactionId))
      setDeleteConfirm(null)
      
      // Delete on backend
      await api.deleteTransaction(activePortfolioId!, transactionId)
      
      // Clear all caches immediately (no delay needed with optimistic update)
      await invalidatePortfolioData()
      
      // Refetch to ensure consistency
      await fetchTransactions()
    } catch (err) {
      console.error("Failed to delete transaction:", err)
      // Refetch on error to restore correct state
      await fetchTransactions()
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

      setImportFile(file)
      setShowImportReview(true)
      setImportLoading(true)
      setImportPreviewLoading(true)
      setImportPreview(null)
      setImportPreviewError("")
      setImportError("")
      setImportSuccess("")

      try {
        const preview = await api.previewImportCsv(activePortfolioId, file)
        setImportPreview(preview)
      } catch (err) {
        console.error('Failed to preview import:', err)
        setImportPreviewError(err instanceof Error ? err.message : t('importReviewModal.previewFailed'))
      } finally {
        setImportPreviewLoading(false)
        setImportLoading(false)
      }
    }
    input.click()
  }

  const handleImportReviewCancel = useCallback(() => {
    setShowImportReview(false)
    setImportFile(null)
    setImportPreview(null)
    setImportPreviewError("")
    setImportPreviewLoading(false)
    setImportLoading(false)
  }, [])

  const handleImportReviewConfirm = useCallback(() => {
    if (!importPreview || importPreview.error_count > 0) return
    setShowImportReview(false)
    setShowImportProgress(true)
    setImportLoading(true)
  }, [importPreview])

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
    setImportPreview(null)
    setImportPreviewError("")
    setImportPreviewLoading(false)
    setImportLoading(false)
  }, [])

  const handleExportClick = () => {
    if (transactions.length === 0) {
      setToast({ type: 'error', message: 'No transactions to export' })
      return
    }

    // Create CSV content with sequence for ordering and conversion_id for linked conversions
    const headers = ['date', 'symbol', 'type', 'quantity', 'price', 'fees', 'currency', 'split_ratio', 'conversion_id', 'notes', 'sequence']
    
    // Sort by date and then by id to ensure consistent ordering
    const sortedForExport = [...transactions].sort((a, b) => {
      const dateCompare = new Date(a.tx_date).getTime() - new Date(b.tx_date).getTime()
      if (dateCompare !== 0) return dateCompare
      return a.id - b.id
    })
    
    const rows = sortedForExport.map((tx, index) => [
      tx.tx_date,
      tx.asset.symbol,
      tx.type,
      tx.quantity,
      tx.price,
      tx.fees,
      tx.currency,
      tx.metadata?.split || '',
      tx.metadata?.conversion_id || '',
      tx.notes || '',
      index + 1  // Sequence number to preserve order
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
    return getFilteredSortedTransactions({
      transactions,
      sortKey,
      sortDir,
      showAllTransactions,
      displayLimit,
      searchQuery,
      fxRates,
      portfolioCurrency,
    })
  }, [transactions, sortKey, sortDir, showAllTransactions, displayLimit, searchQuery, fxRates, portfolioCurrency])

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(currentLocale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const getTranslatedType = (type: string): string => {
    const typeMap: Record<string, string> = {
      'BUY': t('transaction.types.buy'),
      'SELL': t('transaction.types.sell'),
      'DIVIDEND': t('transaction.types.dividend'),
      'FEE': t('transaction.types.fee'),
      'SPLIT': t('transaction.types.split'),
      'TRANSFER_IN': t('transaction.types.transferIn'),
      'TRANSFER_OUT': t('transaction.types.transferOut'),
      'CONVERSION_IN': t('transaction.types.conversionIn'),
      'CONVERSION_OUT': t('transaction.types.conversionOut'),
    }
    return typeMap[type.toUpperCase()] || type
  }

  const getSubmitLabel = (requiresRiskConfirmation: boolean, hasHighRiskWarning: boolean) => {
    if (formLoading) return t('common.saving')
    if (requiresRiskConfirmation) return t('transactions.actions.reviewWarnings')
    if (hasHighRiskWarning) return t('transactions.actions.confirmRiskySell')
    if (modalMode === 'edit') return t('transactions.actions.saveTransaction')
    return t('transactions.actions.addType', {
      type: getTranslatedType(txType).toLocaleLowerCase(currentLocale),
    })
  }

  const getWarningClasses = (level: WarningLevel) => {
    switch (level) {
      case 'danger':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
      case 'warning':
        return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
    }
  }

  const getPriceSourceLabel = (summary: TransactionSummary) => {
    if (summary.isSplit) return t('transactions.summary.notApplicable')
    if (priceFetchFailed && summary.price <= 0) return t('transactions.summary.priceUnavailable')
    if (summary.priceSource === 'auto') return t('transactions.summary.autoPrice')
    if (summary.priceSource === 'manual') return t('transactions.summary.manualPrice')
    return t('transactions.summary.pendingAutoPrice')
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'all', label: t('transactions.all') },
    { id: 'buy', label: t('transaction.types.buy') },
    { id: 'sell', label: t('transaction.types.sell') },
    { id: 'dividend', label: t('transaction.types.dividend') },
    { id: 'fee', label: t('transaction.types.fee') },
    { id: 'split', label: t('transaction.types.split') },
    { id: 'conversion', label: t('transaction.types.conversion') },
  ]

  const getTransactionIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'BUY':
        return <TrendingUp size={16} className="text-green-600 dark:text-green-400" />
      case 'CONVERSION_IN':
        return <ArrowLeftRight size={16} className="text-green-600 dark:text-green-400" />
      case 'SELL':
        return <TrendingDown size={16} className="text-red-600 dark:text-red-400" />
      case 'CONVERSION_OUT':
        return <ArrowLeftRight size={16} className="text-red-600 dark:text-red-400" />
      case 'DIVIDEND':
        return <DollarSign size={16} className="text-amber-600 dark:text-amber-400" />
      case 'SPLIT':
        return <Shuffle size={16} className="text-purple-600 dark:text-purple-400" />
      default:
        return null
    }
  }

  const getTransactionColor = (type: string) => {
    switch (type.toUpperCase()) {
      case 'BUY':
      case 'CONVERSION_IN':
        return 'text-green-600 dark:text-green-400'
      case 'SELL':
      case 'CONVERSION_OUT':
        return 'text-red-600 dark:text-red-400'
      case 'DIVIDEND':
        return 'text-amber-600 dark:text-amber-400'
      case 'SPLIT':
        return 'text-purple-600 dark:text-purple-400'
      default:
        return 'text-neutral-600 dark:text-neutral-400'
    }
  }

  const transactionSummary = getTransactionSummary({
    txType,
    quantity,
    price,
    fees,
    txDate,
    assetCurrency,
    portfolioCurrency,
    selectedTickerSymbol: selectedTicker?.symbol,
    ticker,
    editingTransactionSymbol: editingTransaction?.asset.symbol,
    unknownAssetLabel: t('common.unknown'),
    priceSource,
    splitRatio,
    getTranslatedType,
  })
  const transactionWarnings = getTransactionWarnings({
    summary: transactionSummary,
    txType,
    txDate,
    priceFetchFailed,
    modalMode,
    sellAvailableQuantity,
    priceInfo,
    portfolioCurrency,
    translate: (key, options) => t(key, options),
  })

  const hasHighRiskSellWarning = transactionWarnings.some((warning) => warning.key === 'sell-too-large')
  const requiresRiskConfirmation = hasHighRiskSellWarning && !riskAcknowledged

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
          <button 
            onClick={() => setShowConversionModal(true)}
            className="btn-secondary flex items-center gap-2 text-sm px-3 py-2"
          >
            <RefreshCw size={16} />
            <span className="hidden sm:inline">{t('conversion.convert')}</span>
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

      {/* Pending Dividends Section */}
      <PendingDividends 
        portfolioId={activePortfolioId}
        portfolioCurrency={portfolioCurrency}
        onDividendAccepted={() => {
          fetchTransactions()
          invalidatePortfolioData()
        }}
      />

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
              placeholder={t('placeholders.searchSymbol')}
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
            <TransactionsLoadingTable />
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
              <p>{t('transactions.empty.noTransactions')}</p>
              <p className="text-sm mt-2">{t('transactions.empty.noTransactionsInfo')}</p>
            </div>
          ) : sortedTransactions.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
              <p>{t('transactions.empty.noTransactionMatches')}</p>
              <p className="text-sm mt-2">
                {t('transactions.empty.noTransactionMatchesInfo')}{' '}
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-pink-600 dark:text-pink-400 hover:underline font-medium"
                >
                  {t('transactions.empty.noTransactionMatchesClear')}
                </button>
              </p>
            </div>
          ) : (
            <TransactionsResponsiveList
              transactions={sortedTransactions}
              activeTab={activeTab}
              availableSortOptions={availableSortOptions}
              sortKey={sortKey}
              sortDir={sortDir}
              portfolioCurrency={portfolioCurrency}
              fxRates={fxRates}
              formatDate={formatDate}
              getSortLabel={getSortLabel}
              getTransactionColor={getTransactionColor}
              getTransactionIcon={getTransactionIcon}
              getTranslatedType={getTranslatedType}
              assetHasSplits={assetHasSplits}
              onSort={handleSort}
              onToggleSortDirection={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
              onEdit={openEditModal}
              onDelete={setDeleteConfirm}
              onViewSplitHistory={setSplitHistoryAsset}
            />
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalMode && (
        <TransactionFormModal
          modalMode={modalMode}
          ticker={ticker}
          searchResults={searchResults}
          selectedTicker={selectedTicker}
          selectedTickerAssetType={selectedTickerAssetType}
          txDate={txDate}
          txType={txType}
          splitRatio={splitRatio}
          quantity={quantity}
          price={price}
          fees={fees}
          notes={notes}
          priceLoading={priceLoading}
          priceInfo={priceInfo}
          assetCurrency={assetCurrency}
          portfolioCurrency={portfolioCurrency}
          currentLocale={currentLocale}
          transactionSummary={transactionSummary}
          transactionWarnings={transactionWarnings}
          sellQuantityLoading={sellQuantityLoading}
          riskAcknowledged={riskAcknowledged}
          hasHighRiskSellWarning={hasHighRiskSellWarning}
          formError={formError}
          formLoading={formLoading}
          requiresRiskConfirmation={requiresRiskConfirmation}
          onClose={closeModal}
          onSubmit={handleSubmit}
          onTickerChange={handleTickerChange}
          onSelectTicker={handleSelectTicker}
          onDateChange={handleDateChange}
          onTxTypeChange={(nextType) => {
            setTxType(nextType)
            setRiskAcknowledged(false)
            if (nextType === 'DIVIDEND') {
              setPriceLoading(false)
              setPriceInfo(null)
              setPriceFetchFailed(false)
            }
          }}
          onSplitRatioChange={setSplitRatio}
          onQuantityChange={setQuantity}
          onPriceChange={(nextPrice) => {
            setPrice(nextPrice)
            setPriceSource(nextPrice.trim() ? 'manual' : 'empty')
            setPriceFetchFailed(false)
            setPriceInfo(null)
          }}
          onFeesChange={setFees}
          onNotesChange={setNotes}
          formatDate={formatDate}
          getPriceSourceLabel={getPriceSourceLabel}
          getWarningClasses={getWarningClasses}
          getSubmitLabel={getSubmitLabel}
        />
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

      {/* Import Review Modal */}
      <ImportReviewModal
        isOpen={showImportReview}
        file={importFile}
        preview={importPreview}
        loading={importPreviewLoading}
        error={importPreviewError}
        onCancel={handleImportReviewCancel}
        onConfirm={handleImportReviewConfirm}
      />

      {/* Import Progress Modal */}
      <ImportProgressModal
        isOpen={showImportProgress}
        onClose={handleImportClose}
        onComplete={handleImportComplete}
        portfolioId={activePortfolioId || 0}
        file={importFile}
      />

      {/* Conversion Modal */}
      <ConversionModal
        isOpen={showConversionModal}
        onClose={() => setShowConversionModal(false)}
        onSuccess={() => {
          fetchTransactions()
          invalidatePortfolioData()
        }}
        portfolioId={activePortfolioId || 0}
        portfolioCurrency={portfolioCurrency}
      />

      {/* Toast Notifications */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
