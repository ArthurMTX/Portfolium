import type { QueryClient } from '@tanstack/react-query'

/**
 * React Query key families whose data is derived from a portfolio's
 * transactions. They all follow the shape [name, portfolioId, ...rest],
 * so they can be invalidated per portfolio after a transaction mutation.
 *
 * Deliberately excluded: ['portfolios'] (portfolio definitions), boards,
 * watchlist, market-* reference data, auth/session data, and symbol-scoped
 * asset research — none of those change when a transaction is edited.
 */
const PORTFOLIO_SCOPED_QUERY_NAMES = new Set([
  'batchPrices',
  'portfolio-metrics',
  'portfolio-position',
  'portfolio-goals',
  'recent-transactions',
  'top-performers',
  'worst-performers',
  'today-brief',
  'dashboard-batch',
  'insights',
  'research-positions',
  'asset-position-transactions',
  'asset-etf-composition',
  // Cash ledger data moves with every transaction on tracked portfolios
  'cash-balances',
  'cash-movements',
  'cash-summary',
])

/**
 * Invalidate every transaction-derived query for one portfolio (or for all
 * portfolios when portfolioId is null, e.g. a CSV import touching several).
 * Active queries refetch in the background; inactive ones refetch on next use.
 */
export function invalidatePortfolioQueries(queryClient: QueryClient, portfolioId: number | null): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey
      if (!Array.isArray(key) || typeof key[0] !== 'string' || !PORTFOLIO_SCOPED_QUERY_NAMES.has(key[0])) {
        return false
      }
      return portfolioId == null || key[1] === portfolioId
    },
  })
}
