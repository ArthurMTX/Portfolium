import { useEffect, useState } from 'react'
import { LineChart } from 'lucide-react'
import usePortfolioStore from '../store/usePortfolioStore'
import api from '../lib/api'
import PortfolioHistoryChart from '../components/PortfolioHistoryChart'
import PortfolioHeatmap from '../components/PortfolioHeatmap'
import EmptyPortfolioPrompt from '../components/EmptyPortfolioPrompt'
import EmptyTransactionsPrompt from '../components/EmptyTransactionsPrompt'

export default function Charts() {
  const {
    portfolios,
    activePortfolioId,
    setPortfolios,
    setActivePortfolio,
  } = usePortfolioStore()

  const [backfillStatus, setBackfillStatus] = useState<string | null>(null)
  const [backfilling, setBackfilling] = useState(false)
  const [hasTransactions, setHasTransactions] = useState<boolean | null>(null)
  const [checkingTransactions, setCheckingTransactions] = useState(false)

  useEffect(() => {
    let canceled = false
    const load = async () => {
      if (portfolios.length === 0) {
        const data = await api.getPortfolios()
        if (canceled) return
        setPortfolios(data)
        if (data.length > 0 && !activePortfolioId) setActivePortfolio(data[0].id)
      }
    }
    load()
    return () => { canceled = true }
  }, [portfolios.length, activePortfolioId, setActivePortfolio, setPortfolios])

  // Check if portfolio has transactions
  useEffect(() => {
    let canceled = false
    const checkTransactions = async () => {
      if (!activePortfolioId) return
      
      setCheckingTransactions(true)
      try {
        const transactions = await api.getTransactions(activePortfolioId)
        if (!canceled) {
          setHasTransactions(transactions.length > 0)
        }
      } catch (err) {
        console.error('Failed to check transactions:', err)
        if (!canceled) {
          setHasTransactions(false)
        }
      } finally {
        if (!canceled) {
          setCheckingTransactions(false)
        }
      }
    }
    checkTransactions()
    return () => { canceled = true }
  }, [activePortfolioId])

  const handleBackfill = async () => {
    if (!activePortfolioId) return
    setBackfilling(true)
    setBackfillStatus(null)
    try {
      const res = await api.backfillPortfolioHistory(activePortfolioId, 365)
      setBackfillStatus(`Backfilled ${res.assets} assets. Saved: ` + Object.entries(res.history_points_saved).map(([sym, n]) => `${sym}: ${n}`).join(', '))
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setBackfillStatus('Backfill failed: ' + message)
    } finally {
      setBackfilling(false)
    }
  }

  if (!activePortfolioId) {
    return <EmptyPortfolioPrompt pageType="charts" />
  }

  if (checkingTransactions) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <LineChart className="text-pink-600" size={32} />
              Portfolio Charts
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              Loading your portfolio data...
            </p>
          </div>
          <div className="h-10 w-36 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse"></div>
        </div>

        {/* Heatmap Skeleton */}
        <div className="card p-6">
          <div className="h-6 w-48 bg-neutral-200 dark:bg-neutral-700 rounded mb-4 animate-pulse"></div>
          <div className="h-64 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse"></div>
        </div>

        {/* Chart Skeleton */}
        <div className="card p-6">
          <div className="h-6 w-56 bg-neutral-200 dark:bg-neutral-700 rounded mb-4 animate-pulse"></div>
          <div className="h-96 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse"></div>
        </div>
      </div>
    )
  }

  if (hasTransactions === false) {
    const activePortfolio = portfolios.find(p => p.id === activePortfolioId)
    return <EmptyTransactionsPrompt pageType="charts" portfolioName={activePortfolio?.name} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <LineChart className="text-pink-600" size={32} />
            Portfolio Charts
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            Track your portfolio value and visualize asset allocation
          </p>
        </div>
        <button
          className="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={handleBackfill}
          disabled={backfilling}
        >
          {backfilling ? 'Backfilling…' : 'Backfill History'}
        </button>
      </div>

      {/* Status message */}
      {backfillStatus && (
        <div className="card p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">{backfillStatus}</p>
        </div>
      )}

      {/* Heatmap */}
      <PortfolioHeatmap portfolioId={activePortfolioId} />

      {/* Chart */}
      <PortfolioHistoryChart portfolioId={activePortfolioId} />
    </div>
  )
}
