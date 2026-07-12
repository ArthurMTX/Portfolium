type SortKey = 'tx_date' | 'symbol' | 'type' | 'quantity' | 'price' | 'fees' | 'total'
type SortDir = 'asc' | 'desc'

interface Transaction {
  asset: {
    symbol: string
    name: string | null
  }
  tx_date: string
  type: string
  quantity: number | string
  price: number | string
  fees: number | string
  currency: string
}

interface GetFilteredSortedTransactionsParams<TTransaction extends Transaction> {
  transactions: TTransaction[]
  sortKey: SortKey
  sortDir: SortDir
  showAllTransactions: boolean
  displayLimit: number
  searchQuery: string
  fxRates: Record<string, number | null>
  portfolioCurrency: string
}

export const getFilteredSortedTransactions = <TTransaction extends Transaction>({
  transactions,
  sortKey,
  sortDir,
  showAllTransactions,
  displayLimit,
  searchQuery,
  fxRates,
  portfolioCurrency,
}: GetFilteredSortedTransactionsParams<TTransaction>) => {
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
        const aNativeTotal = a.type === 'DIVIDEND' || a.type === 'SELL' ? (aQty * aPrice - aFees) : (aQty * aPrice + aFees)
        aVal = aNativeTotal
        if (a.type === 'DIVIDEND' && a.currency && a.currency.toUpperCase() !== portfolioCurrency) {
          const key = `${a.currency.toUpperCase()}|${portfolioCurrency}|${a.tx_date}`
          const rate = fxRates[key]
          if (typeof rate === 'number') aVal = aNativeTotal * rate
        }

        const bQty = typeof b.quantity === 'string' ? parseFloat(b.quantity) : b.quantity
        const bPrice = typeof b.price === 'string' ? parseFloat(b.price) : b.price
        const bFees = typeof b.fees === 'string' ? parseFloat(b.fees) : b.fees
        const bNativeTotal = b.type === 'DIVIDEND' || b.type === 'SELL' ? (bQty * bPrice - bFees) : (bQty * bPrice + bFees)
        bVal = bNativeTotal
        if (b.type === 'DIVIDEND' && b.currency && b.currency.toUpperCase() !== portfolioCurrency) {
          const key = `${b.currency.toUpperCase()}|${portfolioCurrency}|${b.tx_date}`
          const rate = fxRates[key]
          if (typeof rate === 'number') bVal = bNativeTotal * rate
        }
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

  return showAllTransactions ? sorted : sorted.slice(0, displayLimit)
}
