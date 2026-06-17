import assert from 'node:assert/strict'
import { getFilteredSortedTransactions } from '../../src/features/transactions/lib/transactionSortUtils'

const transactions = [
  {
    id: 1,
    asset: { symbol: 'BBB', name: 'Beta' },
    tx_date: '2024-01-02',
    type: 'BUY',
    quantity: '2',
    price: '10',
    fees: '1',
    currency: 'EUR',
  },
  {
    id: 2,
    asset: { symbol: 'AAA', name: 'Alpha' },
    tx_date: '2024-01-01',
    type: 'SELL',
    quantity: '2',
    price: '10',
    fees: '1',
    currency: 'EUR',
  },
  {
    id: 3,
    asset: { symbol: 'USD', name: 'Dollar Dividend' },
    tx_date: '2024-01-03',
    type: 'DIVIDEND',
    quantity: '10',
    price: '2',
    fees: '1',
    currency: 'USD',
  },
]

const baseParams = {
  transactions,
  sortKey: 'total' as const,
  sortDir: 'desc' as const,
  showAllTransactions: true,
  displayLimit: 100,
  searchQuery: '',
  fxRates: {},
  portfolioCurrency: 'EUR',
}

assert.deepEqual(
  getFilteredSortedTransactions(baseParams).map((transaction) => transaction.id),
  [1, 2, 3],
)

assert.deepEqual(
  getFilteredSortedTransactions({
    ...baseParams,
    fxRates: { 'USD|EUR|2024-01-03': 2 },
  }).map((transaction) => transaction.id),
  [3, 1, 2],
)

assert.deepEqual(
  getFilteredSortedTransactions({
    ...baseParams,
    fxRates: { 'USD|EUR|2024-01-03': null },
  }).map((transaction) => transaction.id),
  [1, 2, 3],
)

assert.deepEqual(
  getFilteredSortedTransactions({
    ...baseParams,
    sortKey: 'symbol',
    sortDir: 'asc',
    searchQuery: 'alp',
  }).map((transaction) => transaction.asset.symbol),
  ['AAA'],
)

assert.equal(
  getFilteredSortedTransactions({
    ...baseParams,
    sortKey: 'tx_date',
    showAllTransactions: false,
    displayLimit: 2,
  }).length,
  2,
)
