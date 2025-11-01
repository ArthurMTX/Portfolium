import { X, TrendingUp, TrendingDown, ShoppingCart, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { useEffect, useState, useMemo } from 'react'
import api from '../lib/api'

interface AssetTransaction {
  id: number
  tx_date: string
  type: string
  quantity: number
  adjusted_quantity: number
  price: number | null
  fees: number | null
  portfolio_name: string
  notes: string | null
}

interface TransactionHistoryProps {
  assetId: number
  assetSymbol: string
  portfolioId?: number
  portfolioCurrency?: string
  onClose: () => void
}

type SortKey = 'tx_date' | 'type' | 'quantity' | 'adjusted_quantity' | 'price' | 'fees' | 'total'
type SortDir = 'asc' | 'desc'

export default function TransactionHistory({ assetId, assetSymbol, portfolioId, portfolioCurrency = 'USD', onClose }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<AssetTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('tx_date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true)
        const data = await api.getAssetTransactionHistory(assetId, portfolioId)
        setTransactions(data)
      } catch (error) {
        console.error('Failed to fetch transaction history:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [assetId, portfolioId])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: portfolioCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const formatQuantity = (value: number | null) => {
    if (value === null || value === undefined) return '-'
    const formatted = value.toFixed(8)
    return formatted.replace(/\.?0+$/, '')
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const isActive = (key: SortKey) => sortKey === key
  
  const SortIcon = ({ col }: { col: SortKey }) => {
    const active = isActive(col)
    if (!active) return <ArrowUpDown size={14} className="inline ml-1 opacity-40" />
    return sortDir === 'asc' ? (
      <ChevronUp size={14} className="inline ml-1 opacity-80" />
    ) : (
      <ChevronDown size={14} className="inline ml-1 opacity-80" />
    )
  }

  const sortedTransactions = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => {
      let aVal: string | number
      let bVal: string | number

      switch (sortKey) {
        case 'tx_date':
          aVal = new Date(a.tx_date).getTime()
          bVal = new Date(b.tx_date).getTime()
          break
        case 'type':
          aVal = a.type
          bVal = b.type
          break
        case 'quantity':
          aVal = a.quantity
          bVal = b.quantity
          break
        case 'adjusted_quantity':
          aVal = a.adjusted_quantity
          bVal = b.adjusted_quantity
          break
        case 'price':
          aVal = a.price || 0
          bVal = b.price || 0
          break
        case 'fees':
          aVal = a.fees || 0
          bVal = b.fees || 0
          break
        case 'total': {
          aVal = a.price && a.quantity ? a.price * a.quantity + (a.fees || 0) : 0
          bVal = b.price && b.quantity ? b.price * b.quantity + (b.fees || 0) : 0
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
    
    return sorted
  }, [transactions, sortKey, sortDir])

  const buyTransactions = sortedTransactions.filter(tx => tx.type === 'BUY')
  const sellTransactions = sortedTransactions.filter(tx => tx.type === 'SELL')
  
  // Check if any transactions have been split-adjusted
  const hasSplitAdjustments = transactions.some(tx => Math.abs(tx.quantity - tx.adjusted_quantity) > 0.0001)

  return (
    <div className="modal-overlay bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <ShoppingCart className="text-blue-600" size={28} />
              Transaction History
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              {assetSymbol}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
              Loading transaction history...
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="mx-auto text-neutral-400 dark:text-neutral-600 mb-4" size={48} />
              <p className="text-neutral-600 dark:text-neutral-400">
                No buy/sell transactions recorded for {assetSymbol}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-2">
                Transaction history will appear here when recorded
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="text-green-600 dark:text-green-400" size={20} />
                    <span className="text-sm font-medium text-green-900 dark:text-green-300">Buy Transactions</span>
                  </div>
                  <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {buyTransactions.length}
                  </div>
                  <div className="text-xs text-green-700 dark:text-green-400 mt-1">
                    {hasSplitAdjustments ? 'Split-adjusted quantity: ' : 'Total quantity: '}
                    {buyTransactions.reduce((sum, tx) => sum + tx.adjusted_quantity, 0).toFixed(4)}
                  </div>
                </div>

                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="text-red-600 dark:text-red-400" size={20} />
                    <span className="text-sm font-medium text-red-900 dark:text-red-300">Sell Transactions</span>
                  </div>
                  <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                    {sellTransactions.length}
                  </div>
                  <div className="text-xs text-red-700 dark:text-red-400 mt-1">
                    {hasSplitAdjustments ? 'Split-adjusted quantity: ' : 'Total quantity: '}
                    {sellTransactions.reduce((sum, tx) => sum + tx.adjusted_quantity, 0).toFixed(4)}
                  </div>
                </div>
              </div>

              {/* Transaction Table */}
              <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
                <table className="w-full">
                  <thead className="bg-neutral-50 dark:bg-neutral-800/50">
                    <tr>
                      <th 
                        onClick={() => handleSort('tx_date')}
                        aria-sort={isActive('tx_date') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        Date <SortIcon col="tx_date" />
                      </th>
                      <th 
                        onClick={() => handleSort('type')}
                        aria-sort={isActive('type') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        Type <SortIcon col="type" />
                      </th>
                      <th 
                        onClick={() => handleSort('quantity')}
                        aria-sort={isActive('quantity') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        Quantity <SortIcon col="quantity" />
                      </th>
                      {hasSplitAdjustments && (
                        <th 
                          onClick={() => handleSort('adjusted_quantity')}
                          aria-sort={isActive('adjusted_quantity') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                          className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                          Adjusted Qty <SortIcon col="adjusted_quantity" />
                        </th>
                      )}
                      <th 
                        onClick={() => handleSort('price')}
                        aria-sort={isActive('price') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        Price <SortIcon col="price" />
                      </th>
                      <th 
                        onClick={() => handleSort('fees')}
                        aria-sort={isActive('fees') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        Fees <SortIcon col="fees" />
                      </th>
                      <th 
                        onClick={() => handleSort('total')}
                        aria-sort={isActive('total') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        Total <SortIcon col="total" />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {sortedTransactions.map((tx) => {
                      const isBuy = tx.type === 'BUY'
                      const total = tx.price && tx.quantity ? tx.price * tx.quantity + (tx.fees || 0) : null
                      const isSplitAdjusted = Math.abs(tx.quantity - tx.adjusted_quantity) > 0.0001
                      
                      return (
                        <tr
                          key={tx.id}
                          className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900 dark:text-neutral-100">
                            {formatDate(tx.tx_date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`flex items-center gap-2 text-sm font-medium ${isBuy ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {isBuy ? (
                                <TrendingUp size={16} />
                              ) : (
                                <TrendingDown size={16} />
                              )}
                              {tx.type}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-neutral-900 dark:text-neutral-100">
                            {formatQuantity(tx.quantity)}
                          </td>
                          {hasSplitAdjustments && (
                            <td className={`px-6 py-4 whitespace-nowrap text-right text-sm ${isSplitAdjusted ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-neutral-900 dark:text-neutral-100'}`}>
                              {formatQuantity(tx.adjusted_quantity)}
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-neutral-900 dark:text-neutral-100">
                            {formatCurrency(tx.price)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-neutral-900 dark:text-neutral-100">
                            {tx.fees ? formatCurrency(tx.fees) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                            {total !== null ? formatCurrency(total) : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-neutral-500 dark:text-neutral-400 max-w-xs truncate">
                            {tx.notes || '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="text-sm text-blue-900 dark:text-blue-300">
                  <strong>Total transactions:</strong> {transactions.length} ({buyTransactions.length} buys, {sellTransactions.length} sells)
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                  Net position change{hasSplitAdjustments ? ' (split-adjusted)' : ''}: {(buyTransactions.reduce((sum, tx) => sum + tx.adjusted_quantity, 0) - sellTransactions.reduce((sum, tx) => sum + tx.adjusted_quantity, 0)).toFixed(4)} shares
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
