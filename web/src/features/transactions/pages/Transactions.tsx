import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import { invalidatePortfolioQueries } from '@/features/portfolios/lib/invalidatePortfolioQueries'
import api, { type CsvImportPreviewResultDTO } from '@/api'
import { PlusCircle, Upload, Download, X, Search, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import SplitHistory from '@/features/assets/components/SplitHistory'
import EmptyPortfolioPrompt from '@/features/portfolios/components/EmptyPortfolioPrompt'
import ImportReviewModal from '@/features/transactions/components/ImportReviewModal'
import ImportProgressModal from '@/features/transactions/components/ImportProgressModal'
import ConversionModal from '@/features/transactions/components/ConversionModal'
import PendingDividends from '@/features/transactions/components/PendingDividends'
import TransactionFormModal from '@/features/transactions/components/TransactionFormModal'
import Toast from '@/shared/components/Toast'
import { ListSkeleton, StateBlock } from '@/shared/components/StatePrimitives'
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
import AssetLogo from '@/shared/components/AssetLogo'
import { formatCurrency, formatQuantity } from '@/shared/lib/formatUtils'
import { Trans, useTranslation } from 'react-i18next'
import { getFilteredSortedTransactions } from '@/features/transactions/lib/transactionSortUtils'
import {
  getTransactionCashDelta,
  getTransactionSummary,
  getTransactionWarnings,
  type PriceSource,
} from '@/features/transactions/lib/transactionDerivedState'
import { findBalance, parseCashErrorFromMessage, toAmount } from '@/features/cash/lib/cashDerivedState'
import {
  buildAutoPricePayload,
  buildCreateTransactionPayload,
  buildUpdatePayload,
  shouldUseAutoPriceTransaction,
  validateTransactionSubmit,
  type TransactionValidationErrorCode,
} from '@/features/transactions/lib/transactionPayloadBuilders'
import '@/shared/design/pages/transactions.css'

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

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function getTransactionAmount(transaction: Transaction): number | null {
  if (transaction.type === 'SPLIT') return null
  const quantity = toNumber(transaction.quantity)
  const price = toNumber(transaction.price)
  const fees = toNumber(transaction.fees)
  const gross = quantity * price

  if (transaction.type === 'SELL' || transaction.type === 'DIVIDEND' || transaction.type === 'CONVERSION_OUT') {
    return gross - fees
  }

  return gross + fees
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

function formatSignedCurrency(value: number, currency: string, locale: string): string {
  if (value === 0) return formatCurrency(0, currency, locale)
  const prefix = value > 0 ? '+' : '−'
  return `${prefix}${formatCurrency(Math.abs(value), currency, locale)}`
}

function parseSplitMultiplier(split: string | undefined): number | null {
  if (!split) return null
  const normalized = split.replace('/', ':')
  const [from, to] = normalized.split(':').map((part) => Number(part.trim()))
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || to <= 0) return null
  return from / to
}

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
  // Cash tracking: untracked portfolios fire no cash queries and keep the
  // historical transaction workflow untouched
  const cashMode = activePortfolio?.cash_mode ?? 'untracked'
  const cashTracked = cashMode !== 'untracked'
  const cashBalancesQuery = useQuery({
    queryKey: ['cash-balances', activePortfolioId],
    queryFn: () => api.getCashBalances(activePortfolioId!),
    enabled: activePortfolioId != null && cashTracked,
  })

  // Helper to invalidate the transaction-derived caches of this portfolio.
  // Targeted on purpose: the previous queryClient.removeQueries() dropped the
  // entire query cache, forcing unrelated pages (boards, watchlist, market
  // data, research) to refetch everything on their next visit.
  const invalidatePortfolioData = useCallback(async () => {
    await invalidatePortfolioQueries(queryClient, activePortfolioId)
    // Increment data version to trigger useEffect re-fetches in widgets
    incrementDataVersion()
  }, [queryClient, activePortfolioId, incrementDataVersion])
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [expandedTransactionId, setExpandedTransactionId] = useState<number | null>(null)
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null)
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
  const [fees, setFees] = useState("")
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
    setLoadError(null)
    try {
      const data = await api.getTransactions(activePortfolioId)
      setTransactions(data)
    } catch (error: unknown) {
      console.error('Failed to fetch transactions:', error)
      setLoadError(error instanceof Error ? error.message : t('transactionsPage.loadFailedGeneric'))
    } finally {
      setLoading(false)
    }
  }, [activePortfolioId, t])

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
    // Handle both API metadata field spellings observed in saved transactions.
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
    setFees("")
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
      'portfolio-required': t('transactionsPage.portfolioRequired'),
      'ticker-required': t('transactionsPage.tickerRequired'),
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
            throw new Error(t('transactionsPage.tickerSymbolRequired'))
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
      // Strict cash mode returns a structured insufficient-cash rejection
      const cashDetail = err instanceof Error ? parseCashErrorFromMessage(err.message) : null
      if (cashDetail?.code === 'insufficient_cash') {
        setFormError(t('transactions.cash.insufficientCash', {
          currency: cashDetail.context.currency,
          available: cashDetail.context.available,
          required: cashDetail.context.required,
          missing: cashDetail.context.missing,
        }))
      } else {
        setFormError(message)
      }
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
      setImportSuccess(t('transactionsPage.importedSuccessfully'))
      await fetchTransactions()

      // Clear success message after 5 seconds
      setTimeout(() => setImportSuccess(""), 5000)
    } else {
      setImportError(t('transactionsPage.importFailedGeneric'))
    }
  }, [fetchTransactions, t])

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
      setToast({ type: 'error', message: t('transactionsPage.noTransactionsToExport') })
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

  const visibleTransactions = useMemo(() => {
    if (activeTab === 'all') return transactions
    if (activeTab === 'conversion') {
      return transactions.filter((tx) => tx.type === 'CONVERSION_IN' || tx.type === 'CONVERSION_OUT')
    }
    return transactions.filter((tx) => tx.type === activeTab.toUpperCase())
  }, [activeTab, transactions])

  const sortedTransactions = useMemo(() => {
    return getFilteredSortedTransactions({
      transactions: visibleTransactions,
      sortKey,
      sortDir,
      showAllTransactions,
      displayLimit,
      searchQuery,
      fxRates,
      portfolioCurrency,
    })
  }, [visibleTransactions, sortKey, sortDir, showAllTransactions, displayLimit, searchQuery, fxRates, portfolioCurrency])

  const investedCapital = useMemo(() => {
    return transactions.reduce((sum, transaction) => {
      if (transaction.type !== 'BUY') return sum
      return sum + (getTransactionAmount(transaction) ?? 0)
    }, 0)
  }, [transactions])

  const firstTransactionDate = useMemo(() => {
    if (!transactions.length) return null
    return transactions.reduce((earliest, transaction) => (
      new Date(transaction.tx_date).getTime() < new Date(earliest).getTime() ? transaction.tx_date : earliest
    ), transactions[0].tx_date)
  }, [transactions])

  const latestTransactionDate = useMemo(() => {
    if (!transactions.length) return null
    return transactions.reduce((latest, transaction) => (
      new Date(transaction.tx_date).getTime() > new Date(latest).getTime() ? transaction.tx_date : latest
    ), transactions[0].tx_date)
  }, [transactions])

  const largestPurchaseId = useMemo(() => {
    let largest: { id: number; amount: number } | null = null
    for (const transaction of transactions) {
      if (transaction.type !== 'BUY') continue
      const amount = getTransactionAmount(transaction) ?? 0
      if (!largest || amount > largest.amount) largest = { id: transaction.id, amount }
    }
    return largest?.id ?? null
  }, [transactions])

  const firstPurchaseByAssetId = useMemo(() => {
    const map = new Map<number, number>()
    for (const transaction of [...transactions].sort((a, b) => new Date(a.tx_date).getTime() - new Date(b.tx_date).getTime())) {
      if (transaction.type !== 'BUY') continue
      if (!map.has(transaction.asset_id)) map.set(transaction.asset_id, transaction.id)
    }
    return map
  }, [transactions])

  const getTimelineGroupLabel = useCallback((dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(currentLocale, { month: 'long', year: 'numeric' }).toUpperCase()
  }, [currentLocale])

  const getTransactionAmountInPortfolioCurrency = useCallback((transaction: Transaction) => {
    const nativeAmount = getTransactionAmount(transaction)
    if (nativeAmount === null) return 0
    const from = (transaction.currency || '').toUpperCase()
    const to = portfolioCurrency.toUpperCase()
    if (!from || from === to) return nativeAmount
    const rate = fxRates[`${from}|${to}|${transaction.tx_date}`]
    return typeof rate === 'number' ? nativeAmount * rate : nativeAmount
  }, [fxRates, portfolioCurrency])

  const getMonthlySummary = useCallback((items: Transaction[]) => {
    return items.reduce((summary, transaction) => {
      const amount = Math.abs(getTransactionAmountInPortfolioCurrency(transaction))
      switch (transaction.type) {
        case 'BUY':
        case 'CONVERSION_IN':
        case 'TRANSFER_IN':
          summary.invested += amount
          break
        case 'SELL':
        case 'CONVERSION_OUT':
        case 'TRANSFER_OUT':
          summary.sold += amount
          break
        case 'DIVIDEND':
          summary.dividends += amount
          break
        case 'FEE':
          summary.fees += amount
          break
      }
      return summary
    }, {
      invested: 0,
      sold: 0,
      dividends: 0,
      fees: 0,
    })
  }, [getTransactionAmountInPortfolioCurrency])

  const groupedTransactions = useMemo(() => {
    const groups: Array<{ label: string; transactions: Transaction[] }> = []
    const byLabel = new Map<string, Transaction[]>()

    for (const transaction of sortedTransactions) {
      const label = getTimelineGroupLabel(transaction.tx_date)
      const group = byLabel.get(label)
      if (group) {
        group.push(transaction)
      } else {
        const next = [transaction]
        byLabel.set(label, next)
        groups.push({ label, transactions: next })
      }
    }

    return groups
  }, [getTimelineGroupLabel, sortedTransactions])

  const ownershipByTransactionId = useMemo(() => {
    const balances = new Map<number, number>()
    const ownership = new Map<number, { before: number; after: number | null; sentence: string | null }>()
    const chronological = [...transactions].sort((a, b) => {
      const dateDiff = new Date(a.tx_date).getTime() - new Date(b.tx_date).getTime()
      return dateDiff || a.id - b.id
    })

    for (const transaction of chronological) {
      const before = balances.get(transaction.asset_id) ?? 0
      const quantity = toNumber(transaction.quantity)
      let after: number | null = before
      let sentence: string | null = null

      switch (transaction.type) {
        case 'BUY':
        case 'TRANSFER_IN':
        case 'CONVERSION_IN':
          after = before + quantity
          sentence = before <= 0
            ? t('transactions.ownership.openedPosition', { quantity: formatQuantity(after) })
            : t('transactions.ownership.positionIncreased', {
              before: formatQuantity(before),
              after: formatQuantity(after),
            })
          break
        case 'SELL':
        case 'TRANSFER_OUT':
        case 'CONVERSION_OUT':
          after = Math.max(0, before - quantity)
          sentence = after <= 0 && before > 0
            ? t('transactions.ownership.positionClosed')
            : t('transactions.ownership.positionReduced', {
              before: formatQuantity(before),
              after: formatQuantity(after),
            })
          break
        case 'SPLIT': {
          const multiplier = parseSplitMultiplier(transaction.metadata?.split)
          after = multiplier ? before * multiplier : null
          sentence = after !== null
            ? t('transactions.ownership.shareCountChangedWithAmounts', {
              before: formatQuantity(before),
              after: formatQuantity(after),
            })
            : t('transactions.ownership.shareCountChanged')
          break
        }
        case 'DIVIDEND':
          after = before
          sentence = t('transactions.ownership.cashAdded', {
            amount: formatCurrency(Math.abs(getTransactionAmountInPortfolioCurrency(transaction)), portfolioCurrency, currentLocale),
          })
          break
        case 'FEE':
          after = before
          sentence = t('transactions.ownership.cashPaid', {
            amount: formatCurrency(Math.abs(getTransactionAmountInPortfolioCurrency(transaction)), portfolioCurrency, currentLocale),
          })
          break
        default:
          after = before
      }

      ownership.set(transaction.id, { before, after, sentence })
      if (after !== null) balances.set(transaction.asset_id, after)
    }

    return ownership
  }, [currentLocale, getTransactionAmountInPortfolioCurrency, portfolioCurrency, t, transactions])

  // Get human-readable label for sort key
  const getSortLabel = (key: SortKey): string => t(`transactionsPage.sortLabels.${key}`)

  const availableSortOptions: SortKey[] = ['tx_date', 'symbol', 'type', 'quantity', 'price', 'fees', 'total']

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(currentLocale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatHeroDate = (dateString: string | null) => {
    if (!dateString) return '—'
    const date = new Date(dateString)
    if (isSameCalendarDay(date, new Date())) return t('transactionsPage.today')
    return date.toLocaleDateString(currentLocale, {
      day: 'numeric',
      month: 'long',
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

  const getEventVerb = (type: string) => {
    const labels: Record<string, string> = {
      BUY: t('transactionsPage.eventVerbs.BUY'),
      SELL: t('transactionsPage.eventVerbs.SELL'),
      DIVIDEND: t('transactionsPage.eventVerbs.DIVIDEND'),
      FEE: t('transactionsPage.eventVerbs.FEE'),
      SPLIT: t('transactionsPage.eventVerbs.SPLIT'),
      TRANSFER_IN: t('transactionsPage.eventVerbs.TRANSFER_IN'),
      TRANSFER_OUT: t('transactionsPage.eventVerbs.TRANSFER_OUT'),
      CONVERSION_IN: t('transactionsPage.eventVerbs.CONVERSION_IN'),
      CONVERSION_OUT: t('transactionsPage.eventVerbs.CONVERSION_OUT'),
    }
    return labels[type.toUpperCase()] || getTranslatedType(type)
  }

  const getTransactionContext = (transaction: Transaction) => {
    const tags: string[] = []
    if (firstPurchaseByAssetId.get(transaction.asset_id) === transaction.id) tags.push(t('transactionsPage.tags.firstPurchase'))
    if (largestPurchaseId === transaction.id) tags.push(t('transactionsPage.tags.largestPurchase'))
    if (transaction.type === 'SELL') tags.push(t('transactionsPage.tags.ownershipReduced'))
    if (transaction.type === 'DIVIDEND') tags.push(t('transactionsPage.tags.incomeEvent'))
    if (transaction.type === 'SPLIT') tags.push(t('transactionsPage.tags.shareCountChanged'))
    if (transaction.type === 'CONVERSION_IN' || transaction.type === 'CONVERSION_OUT') tags.push(t('transactionsPage.tags.currencyConversion'))
    return tags
  }

  const getTransactionSentence = (transaction: Transaction) => {
    const amount = getTransactionAmount(transaction)
    if (transaction.type === 'SPLIT') {
      const ratio = transaction.metadata?.split ? ` ${transaction.metadata.split}` : ''
      return t('transactionsPage.stockSplitRatio', { ratio })
    }

    const formattedAmount = amount === null
      ? '—'
      : formatCurrency(Math.abs(amount), transaction.currency || portfolioCurrency, currentLocale)
    return `${getEventVerb(transaction.type)} ${formattedAmount}`
  }

  const openAssetResearch = (symbol: string) => {
    navigate(`/assets/${encodeURIComponent(symbol)}/research`)
  }

  const getClipboardText = (transaction: Transaction) => {
    const amount = getTransactionAmount(transaction)
    const value = amount === null
      ? t('transactionsPage.noCapitalAmount')
      : formatCurrency(Math.abs(amount), transaction.currency || portfolioCurrency, currentLocale)
    return [
      `${getEventVerb(transaction.type)} ${transaction.asset.symbol}`,
      value,
      `${formatQuantity(toNumber(transaction.quantity))} ${t('assetsPage.shares')}`,
      formatDate(transaction.tx_date),
      transaction.notes ? t('transactionsPage.notesLine', { notes: transaction.notes }) : null,
    ].filter(Boolean).join('\n')
  }

  const handleCopyTransaction = async (transaction: Transaction) => {
    const text = getClipboardText(transaction)
    try {
      await navigator.clipboard.writeText(text)
      setToast({ type: 'success', message: t('transactionsPage.transactionCopied') })
    } catch {
      setToast({ type: 'error', message: t('transactionsPage.couldNotCopy') })
    } finally {
      setOpenActionMenuId(null)
    }
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

  const tabs: { id: TabType; label: string }[] = [
    { id: 'all', label: t('transactions.all') },
    { id: 'buy', label: t('transaction.types.buy') },
    { id: 'sell', label: t('transaction.types.sell') },
    { id: 'dividend', label: t('transaction.types.dividend') },
    { id: 'fee', label: t('transaction.types.fee') },
    { id: 'split', label: t('transaction.types.split') },
    { id: 'conversion', label: t('transaction.types.conversion') },
  ]

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
  // Available cash in the settlement currency (tracked portfolios only)
  const settlementBalance = cashTracked
    ? findBalance(cashBalancesQuery.data?.balances, transactionSummary.currency)
    : null
  const availableCash = cashTracked && cashBalancesQuery.data
    ? (settlementBalance ? toAmount(settlementBalance.balance) : 0)
    : null
  const transactionCashDelta = getTransactionCashDelta(transactionSummary, txType)

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
    cashMode,
    availableCash,
  })

  const hasHighRiskSellWarning = transactionWarnings.some((warning) => warning.key === 'sell-too-large')
  const requiresRiskConfirmation = hasHighRiskSellWarning && !riskAcknowledged

  if (portfolios.length === 0 || !activePortfolioId) {
    return <EmptyPortfolioPrompt pageType="transactions" />
  }

  return (
    <PageShell className="transactions-page">
      <PageHeader>
        <PageTitleBlock
          kicker={t('transactionsPage.kicker')}
          title={t('transactionsPage.capitalEvents', { count: transactions.length })}
        />
        <PageSummaryPanel
          lead={t('transactionsPage.investedLead', { amount: formatCurrency(investedCapital, portfolioCurrency, currentLocale) })}
          description={t('transactionsPage.pageDescription')}
          actions={
            <>
              <button className="pf-button pf-button--secondary" type="button" onClick={handleImportClick} disabled={importLoading}>
                <Upload size={15} />
                {importLoading ? t('common.importing') : t('common.import')}
              </button>
              <button className="pf-button pf-button--secondary" type="button" onClick={handleExportClick}>
                <Download size={15} />
                {t('common.export')}
              </button>
              <button className="pf-button pf-button--secondary" type="button" onClick={() => setShowConversionModal(true)}>
                <RefreshCw size={15} />
                {t('conversion.convert')}
              </button>
              <button className="pf-button pf-button--primary is-primary" type="button" onClick={openAddModal}>
                <PlusCircle size={15} />
                {t('transactionsPage.recordTransaction')}
              </button>
            </>
          }
        />
      </PageHeader>

      <PageMetricStrip label={t('transactionsPage.contextLabel')}>
        <PageMetric label={t('transactionsPage.transactionsMetric')} value={transactions.length} />
        <PageMetric label={t('transactionsPage.invested')} value={formatCurrency(investedCapital, portfolioCurrency, currentLocale)} />
        <PageMetric label={t('transactionsPage.firstInvestment')} value={formatHeroDate(firstTransactionDate)} />
        <PageMetric label={t('transactionsPage.latestActivity')} value={formatHeroDate(latestTransactionDate)} />
      </PageMetricStrip>

      {importSuccess && <div className="transactions-notice is-success">{importSuccess}</div>}
      {importError && <div className="transactions-notice is-error">{importError}</div>}

      <PendingDividends
        portfolioId={activePortfolioId}
        portfolioCurrency={portfolioCurrency}
        onDividendAccepted={() => {
          fetchTransactions()
          invalidatePortfolioData()
        }}
      />

      <PageControls
        label={t('transactionsPage.controlsLabel')}
        start={
        <div className="pf-search">
          <Search size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('transactionsPage.searchPlaceholder')}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} aria-label={t('transactionsPage.clearSearch')}>
              <X size={14} />
            </button>
          )}
        </div>
        }
        end={
        <div className="pf-control-group pf-dark-control-group transactions-controls">
          <label>
            {t('transactionsPage.type')}
            <select value={activeTab} onChange={(event) => setActiveTab(event.target.value as TabType)}>
              {tabs.map((tab) => (
                <option key={tab.id} value={tab.id}>{tab.label}</option>
              ))}
            </select>
          </label>
          <label>
            {t('transactionsPage.sort')}
            <select value={sortKey} onChange={(event) => handleSort(event.target.value as SortKey)}>
              {availableSortOptions.map((option) => (
                <option key={option} value={option}>{getSortLabel(option)}</option>
              ))}
            </select>
          </label>
          <button onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}>
            {sortDir === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {sortDir === 'asc' ? t('transactionsPage.ascending') : t('transactionsPage.descending')}
          </button>
        </div>
        }
      />

      {transactions.length > 0 && (
        <div className="pf-dark-control-group transactions-count">
          <span>
            <Trans
              i18nKey="transactionsPage.showingOfCapitalEvents"
              values={{ shown: sortedTransactions.length, total: transactions.length }}
              components={{ strong: <strong /> }}
            />
          </span>
          {transactions.length > displayLimit && (
            <button onClick={() => setShowAllTransactions(!showAllTransactions)}>
              {showAllTransactions ? t('transactions.showLast', { count: displayLimit }) : t('transactions.showAll')}
            </button>
          )}
        </div>
      )}

      <PageMainGrid single>
      <PageMainColumn className="transactions-timeline" aria-label={t('transactionsPage.capitalHistoryLabel')}>
        {loading ? (
          <ListSkeleton className="transactions-loading" rows={5} label={t('transactionsPage.loadingTransactions')} />
        ) : loadError ? (
          <StateBlock
            tone="error"
            eyebrow={t('transactionsPage.errorEyebrow')}
            title={t('transactionsPage.errorTitle')}
            description={t('transactionsPage.errorDescription')}
            detail={loadError}
            actionLabel={t('common.retry')}
            onAction={fetchTransactions}
          />
        ) : transactions.length === 0 ? (
          <StateBlock
            className="transactions-empty"
            eyebrow={t('transactionsPage.noTransactionsEyebrow')}
            title={t('transactionsPage.noTransactionsTitle')}
            description={t('transactionsPage.noTransactionsDescription')}
          >
            <button className="pf-button pf-button--primary is-primary" onClick={openAddModal}>{t('transactionsPage.recordFirstTransaction')}</button>
          </StateBlock>
        ) : sortedTransactions.length === 0 ? (
          <StateBlock
            className="transactions-empty"
            eyebrow={t('transactionsPage.noResultsEyebrow')}
            title={t('transactionsPage.noResultsTitle')}
            description={t('transactionsPage.noResultsDescription')}
          >
            <button className="pf-button pf-button--secondary is-primary" onClick={() => setSearchQuery('')}>{t('transactionsPage.clearSearch')}</button>
          </StateBlock>
        ) : (
          groupedTransactions.map((group) => (
            <div className="transactions-group" key={group.label}>
              <div className="transactions-period">
                <h2>{group.label}</h2>
                {(() => {
                  const summary = getMonthlySummary(group.transactions)
                  const netCapitalFlow = summary.invested - summary.sold - summary.dividends + summary.fees
                  return (
                    <div className="transactions-month-summary">
                      <p>{t('transactionsPage.investmentEvents', { count: group.transactions.length })}</p>
                      {summary.invested > 0 && (
                        <div>
                          <span>{formatCurrency(summary.invested, portfolioCurrency, currentLocale)}</span>
                          <em>{t('transactionsPage.investedLabel')}</em>
                        </div>
                      )}
                      {summary.sold > 0 && (
                        <div>
                          <span>{formatCurrency(summary.sold, portfolioCurrency, currentLocale)}</span>
                          <em>{t('transactionsPage.soldLabel')}</em>
                        </div>
                      )}
                      {summary.dividends > 0 && (
                        <div>
                          <span>{formatCurrency(summary.dividends, portfolioCurrency, currentLocale)}</span>
                          <em>{t('transactionsPage.dividendsLabel')}</em>
                        </div>
                      )}
                      {summary.fees > 0 && (
                        <div>
                          <span>{formatCurrency(summary.fees, portfolioCurrency, currentLocale)}</span>
                          <em>{t('transactionsPage.feesLabel')}</em>
                        </div>
                      )}
                      <div className="transactions-net-flow">
                        <em>{t('transactionsPage.netCapitalFlow')}</em>
                        <strong>{formatSignedCurrency(netCapitalFlow, portfolioCurrency, currentLocale)}</strong>
                      </div>
                    </div>
                  )
                })()}
              </div>
              <div className="transactions-events">
                {group.transactions.map((transaction) => {
                  const expanded = expandedTransactionId === transaction.id
                  const actionMenuOpen = openActionMenuId === transaction.id
                  const amount = getTransactionAmount(transaction)
                  const quantity = toNumber(transaction.quantity)
                  const priceValue = toNumber(transaction.price)
                  const feesValue = toNumber(transaction.fees)
                  const context = getTransactionContext(transaction)
                  const ownership = ownershipByTransactionId.get(transaction.id)

                  return (
                    <article
                      className="transactions-event"
                      key={transaction.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedTransactionId(expanded ? null : transaction.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setExpandedTransactionId(expanded ? null : transaction.id)
                        }
                      }}
                    >
                        <div className="transactions-event-main">
                          <button
                            className="transactions-asset"
                          onClick={(event) => {
                            event.stopPropagation()
                            openAssetResearch(transaction.asset.symbol)
                          }}
                        >
                          <AssetLogo
                            symbol={transaction.asset.symbol}
                            assetType={transaction.asset.asset_type}
                            assetName={transaction.asset.name}
                            alt=""
                            loading="lazy"
                            className="transactions-asset-logo"
                          />
                          <span>
                            <strong>{transaction.asset.name || transaction.asset.symbol}</strong>
                            <em>{transaction.asset.symbol}</em>
                          </span>
                        </button>

                        <div className="transactions-story">
                          <p className={`transactions-type is-${transaction.type.toLowerCase().replace(/_/g, '-')}`}>
                            {getEventVerb(transaction.type)}
                          </p>
                          <h3>{getTransactionSentence(transaction)}</h3>
                          <p>
                            {transaction.type === 'SPLIT'
                              ? t('transactionsPage.splitNoCapitalMove')
                              : t('transactionsPage.sharesPerShare', {
                                  quantity: formatQuantity(quantity),
                                  price: formatCurrency(priceValue, transaction.currency || portfolioCurrency, currentLocale),
                                })}
                          </p>
                          {feesValue > 0 && (
                            <p className="transactions-fee-sentence">
                              {t('transactionsPage.feesInFees', { amount: formatCurrency(feesValue, transaction.currency || portfolioCurrency, currentLocale) })}
                            </p>
                          )}
                          {transaction.notes && (
                            <p className="transactions-note-sentence">{transaction.notes}</p>
                          )}
                          {ownership?.sentence && (
                            <p className="transactions-ownership-sentence">{ownership.sentence}</p>
                          )}
                          <div className="transactions-context">
                            {context.map((tag) => <span key={tag}>{tag}</span>)}
                          </div>
                        </div>

                        <div className="transactions-meta">
                          <strong>{amount === null ? '—' : formatCurrency(Math.abs(amount), transaction.currency || portfolioCurrency, currentLocale)}</strong>
                          <span>{formatDate(transaction.tx_date)}</span>
                          <span>{activePortfolio?.name || portfolioCurrency}</span>
                        </div>
                      </div>

                      <div
                        className="transactions-overflow"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        >
                          <button
                          className="transactions-overflow-button"
                          aria-label={t('transactionsPage.transactionActions')}
                          aria-expanded={actionMenuOpen}
                          onClick={(event) => {
                            event.stopPropagation()
                            setOpenActionMenuId(actionMenuOpen ? null : transaction.id)
                          }}
                        >
                          ⋯
                        </button>
                        {actionMenuOpen && (
                          <div className="transactions-overflow-menu">
                            <button onClick={() => openEditModal(transaction)}>{t('common.edit')}</button>
                            <button onClick={() => setDeleteConfirm(transaction.id)}>{t('common.delete')}</button>
                            <button onClick={() => handleCopyTransaction(transaction)}>{t('transactionsPage.copy')}</button>
                            {assetHasSplits(transaction.asset_id) && (
                              <button onClick={() => setSplitHistoryAsset({ id: transaction.asset_id, symbol: transaction.asset.symbol })}>
                                {t('transactionsPage.splitHistory')}
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {expanded && (
                        <div className="transactions-details">
                          <dl>
                            <div>
                              <dt>{t('transactionsPage.fees')}</dt>
                              <dd>{formatCurrency(feesValue, transaction.currency || portfolioCurrency, currentLocale)}</dd>
                            </div>
                            <div>
                              <dt>{t('transactionsPage.currency')}</dt>
                              <dd>{transaction.currency || portfolioCurrency}</dd>
                            </div>
                            <div>
                              <dt>{t('transactionsPage.transactionType')}</dt>
                              <dd>{getTranslatedType(transaction.type)}</dd>
                            </div>
                            <div>
                              <dt>{t('transactionsPage.orderReference')}</dt>
                              <dd>#{transaction.id}</dd>
                            </div>
                            {transaction.metadata?.split && (
                              <div>
                                <dt>{t('transactionsPage.splitRatio')}</dt>
                                <dd>{transaction.metadata.split}</dd>
                              </div>
                            )}
                            {Boolean(transaction.metadata?.conversion_id) && (
                              <div>
                                <dt>{t('transactionsPage.conversionGroup')}</dt>
                                <dd>{String(transaction.metadata?.conversion_id)}</dd>
                              </div>
                            )}
                            <div>
                              <dt>{t('transactionsPage.notes')}</dt>
                              <dd>{transaction.notes || '—'}</dd>
                            </div>
                          </dl>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </PageMainColumn>
      </PageMainGrid>

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
          cashMode={cashMode}
          availableCash={availableCash}
          cashDelta={transactionCashDelta}
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
          getSubmitLabel={getSubmitLabel}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="pf-modal-overlay">
          <div className="pf-modal-panel pf-modal-panel--sm" role="dialog" aria-modal="true">
            <div className="pf-modal-header">
              <div>
                <h3 className="pf-modal-title">
                  {t('transactionsPage.deleteTransactionTitle')}
                </h3>
                <p className="pf-modal-description">
                  {t('transactionsPage.deleteTransactionConfirm')}
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
    </PageShell>
  )
}
