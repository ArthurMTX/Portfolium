import { useEffect, useState } from 'react'
import { LineChart } from 'lucide-react'
import usePortfolioStore from '../store/usePortfolioStore'
import api from '../lib/api'
import PortfolioHistoryChart from '../components/PortfolioHistoryChart'
import PortfolioHeatmap from '../components/PortfolioHeatmap'

export default function Charts() {
  const {
    portfolios,
    activePortfolioId,
    setPortfolios,
    setActivePortfolio,
  } = usePortfolioStore()

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


  const [backfillStatus, setBackfillStatus] = useState<string | null>(null)
  const [backfilling, setBackfilling] = useState(false)

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
    return (
      <div className="text-neutral-500 dark:text-neutral-400">No portfolio selected.</div>
    )
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
            Visualize your portfolio performance over time
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
