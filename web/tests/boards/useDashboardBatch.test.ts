import assert from 'node:assert/strict'
import {
  DASHBOARD_BATCH_QUERY_RETRY,
  fetchDashboardBatchUntilReady,
  type DashboardBatchData,
} from '../../src/features/boards/hooks/useDashboardBatch'

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: () => 'test-token' },
})

const pendingPayload = {
  data: {},
  errors: null,
  cached: false,
  refreshing: true,
  lock_ttl_seconds: 600,
  timestamp: '2026-07-14T12:00:00',
  widgets_requested: 1,
  data_fetched: 0,
}
const completedPayload: DashboardBatchData = {
  data: { metrics: {
    total_value: 123,
    total_unrealized_pnl: 10,
    total_unrealized_pnl_pct: 8,
    total_realized_pnl: 0,
    total_dividends: 0,
    total_fees: 0,
  } },
  cached: true,
  timestamp: '2026-07-14T12:00:05',
  widgets_requested: 1,
  data_fetched: 1,
}

{
  let requestCount = 0
  let releaseDelay!: () => void
  let settled = false
  const observedDelays: number[] = []
  const delayGate = new Promise<void>((resolve) => { releaseDelay = resolve })

  const resultPromise = fetchDashboardBatchUntilReady({
    portfolioId: 7,
    visibleWidgets: ['performance-metrics'],
    includeSold: false,
    fetchImpl: (async () => {
      requestCount += 1
      if (requestCount === 1) {
        return new Response(JSON.stringify(pendingPayload), {
          status: 202,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '2' },
        })
      }
      return new Response(JSON.stringify(completedPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch,
    delay: async (milliseconds) => {
      observedDelays.push(milliseconds)
      await delayGate
    },
  })
  resultPromise.finally(() => { settled = true })

  await Promise.resolve()
  await Promise.resolve()
  assert.equal(settled, false, 'the query stays loading while the server reports 202')
  assert.equal(requestCount, 1)

  releaseDelay()
  const result = await resultPromise
  assert.deepEqual(observedDelays, [2000])
  assert.equal(requestCount, 2)
  assert.deepEqual(result, completedPayload)
}

{
  const malformed202 = fetchDashboardBatchUntilReady({
    portfolioId: 7,
    visibleWidgets: ['performance-metrics'],
    includeSold: false,
    fetchImpl: (async () => new Response(JSON.stringify(completedPayload), {
      status: 202,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '0' },
    })) as typeof fetch,
    delay: async () => {},
  })
  await assert.rejects(malformed202, /Invalid dashboard refresh-pending response/)
}

assert.equal(DASHBOARD_BATCH_QUERY_RETRY, false)
console.log('useDashboardBatch 202 flow tests passed')
