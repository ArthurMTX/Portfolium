import assert from 'node:assert/strict'
import { QueryClient } from '@tanstack/react-query'
import { invalidatePortfolioQueries } from '../../src/features/portfolios/lib/invalidatePortfolioQueries'

function seededClient(): QueryClient {
  const client = new QueryClient()
  const keys: ReadonlyArray<ReadonlyArray<unknown>> = [
    // Transaction-derived data for portfolio 17 (must invalidate)
    ['portfolio-metrics', 17, 3],
    ['recent-transactions', 17],
    ['dashboard-batch', 17, 'widgets', false],
    ['insights', 17, 'benchmark', 'SPY', '1y'],
    ['batchPrices', 17],
    // Same families for another portfolio (must NOT invalidate)
    ['portfolio-metrics', 99, 3],
    ['dashboard-batch', 99, 'widgets', false],
    // Unrelated data (must NOT invalidate)
    ['portfolios'],
    ['boards'],
    ['market-movers'],
    ['watchlist-widget'],
    ['asset-research-summary', 'AAPL'],
  ]
  for (const key of keys) {
    client.setQueryData(key, { seeded: true })
  }
  return client
}

function invalidatedKeys(client: QueryClient): string[] {
  return client
    .getQueryCache()
    .getAll()
    .filter((query) => query.state.isInvalidated)
    .map((query) => JSON.stringify(query.queryKey))
    .sort()
}

{
  // Scoped invalidation: only portfolio 17's transaction-derived queries.
  const client = seededClient()
  await invalidatePortfolioQueries(client, 17)
  assert.deepEqual(invalidatedKeys(client), [
    '["batchPrices",17]',
    '["dashboard-batch",17,"widgets",false]',
    '["insights",17,"benchmark","SPY","1y"]',
    '["portfolio-metrics",17,3]',
    '["recent-transactions",17]',
  ])
}

{
  // Null portfolio id (e.g. multi-portfolio CSV import): all portfolio-scoped
  // families are invalidated, unrelated queries still untouched.
  const client = seededClient()
  await invalidatePortfolioQueries(client, null)
  assert.deepEqual(invalidatedKeys(client), [
    '["batchPrices",17]',
    '["dashboard-batch",17,"widgets",false]',
    '["dashboard-batch",99,"widgets",false]',
    '["insights",17,"benchmark","SPY","1y"]',
    '["portfolio-metrics",17,3]',
    '["portfolio-metrics",99,3]',
    '["recent-transactions",17]',
  ])
}

console.log('invalidatePortfolioQueries tests passed')
