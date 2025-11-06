import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Position {
  asset_id: number
  symbol: string
  name: string | null
  quantity: number
  avg_cost: number
  current_price: number | null
  market_value: number | null
  cost_basis: number
  unrealized_pnl: number | null
  unrealized_pnl_pct: number | null
  daily_change_pct: number | null
  currency: string
  last_updated: string | null
}

interface PortfolioMetrics {
  portfolio_id: number
  portfolio_name: string
  total_value: number
  total_cost: number
  total_unrealized_pnl: number
  total_unrealized_pnl_pct: number
  total_realized_pnl: number
  total_dividends: number
  total_fees: number
  positions_count: number
  daily_change_value?: number | null
  daily_change_pct?: number | null
  last_updated: string
}

interface Transaction {
  id: number
  portfolio_id: number
  asset_id: number
  tx_date: string
  type: string
  quantity: number
  price: number
  fees: number
  currency: string
  metadata: Record<string, unknown>
  notes: string | null
  asset?: unknown
}

interface Portfolio {
  id: number
  name: string
  base_currency: string
  description: string | null
  created_at: string
}

interface PortfolioStore {
  // State
  portfolios: Portfolio[]
  activePortfolioId: number | null
  positions: Position[]
  metrics: PortfolioMetrics | null
  transactions: Transaction[]
  loading: boolean
  error: string | null

  // Actions
  setPortfolios: (portfolios: Portfolio[]) => void
  setActivePortfolio: (id: number) => void
  setPositions: (positions: Position[]) => void
  setMetrics: (metrics: PortfolioMetrics) => void
  setTransactions: (transactions: Transaction[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

const usePortfolioStore = create<PortfolioStore>()(
  persist(
    (set) => ({
      // Initial state
      portfolios: [],
      activePortfolioId: null,
      positions: [],
      metrics: null,
      transactions: [],
      loading: false,
      error: null,

      // Actions
      setPortfolios: (portfolios) => set({ portfolios }),
      setActivePortfolio: (id) => set({ 
        activePortfolioId: id || null,
        // Clear old portfolio data immediately when switching to prevent showing stale data
        positions: [],
        metrics: null,
        transactions: [],
        loading: true,
      }),
      setPositions: (positions) => set({ positions }),
      setMetrics: (metrics) => set({ metrics }),
      setTransactions: (transactions) => set({ transactions }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      reset: () =>
        set({
          activePortfolioId: null,
          positions: [],
          metrics: null,
          transactions: [],
          loading: false,
          error: null,
        }),
    }),
    {
      name: 'portfolio-storage', // localStorage key
      partialize: (state) => ({ 
        activePortfolioId: state.activePortfolioId,
        portfolios: state.portfolios 
      }), // Only persist these fields
    }
  )
)

export default usePortfolioStore
