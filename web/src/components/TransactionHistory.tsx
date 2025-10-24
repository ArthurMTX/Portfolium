import { X, Calendar, TrendingUp, TrendingDown, ShoppingCart } from 'lucide-react'
import { useEffect, useState } from 'react'
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
  onClose: () => void
}

export default function TransactionHistory({ assetId, assetSymbol, onClose }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<AssetTransaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true)
        const data = await api.getAssetTransactionHistory(assetId)
        setTransactions(data)
      } catch (error) {
        console.error('Failed to fetch transaction history:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [assetId])

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
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const buyTransactions = transactions.filter(tx => tx.type === 'BUY')
  const sellTransactions = transactions.filter(tx => tx.type === 'SELL')
  
  // Check if any transactions have been split-adjusted
  const hasSplitAdjustments = transactions.some(tx => Math.abs(tx.quantity - tx.adjusted_quantity) > 0.0001)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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

              {/* Transaction List */}
              <div className="space-y-3">
                {transactions.map((tx) => {
                  const isBuy = tx.type === 'BUY'
                  const totalValue = tx.price && tx.quantity ? tx.price * tx.quantity : null
                  const isSplitAdjusted = Math.abs(tx.quantity - tx.adjusted_quantity) > 0.0001
                  
                  return (
                    <div
                      key={tx.id}
                      className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2 rounded-lg ${isBuy ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                              {isBuy ? (
                                <TrendingUp className="text-green-600 dark:text-green-400" size={20} />
                              ) : (
                                <TrendingDown className="text-red-600 dark:text-red-400" size={20} />
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${isBuy ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                                  {tx.type}
                                </span>
                                <span>{tx.quantity.toFixed(4)} shares</span>
                                {isSplitAdjusted && (
                                  <span className="text-xs text-purple-600 dark:text-purple-400">
                                    → {tx.adjusted_quantity.toFixed(4)} (split-adjusted)
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                                Portfolio: <span className="font-medium">{tx.portfolio_name}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Transaction Details */}
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div className="text-sm">
                              <span className="text-neutral-500 dark:text-neutral-400">Price per share:</span>
                              <span className="ml-2 font-medium text-neutral-900 dark:text-neutral-100">
                                {formatCurrency(tx.price)}
                              </span>
                            </div>
                            {totalValue !== null && (
                              <div className="text-sm">
                                <span className="text-neutral-500 dark:text-neutral-400">Total value:</span>
                                <span className="ml-2 font-medium text-neutral-900 dark:text-neutral-100">
                                  {formatCurrency(totalValue)}
                                </span>
                              </div>
                            )}
                            {tx.fees !== null && tx.fees > 0 && (
                              <div className="text-sm">
                                <span className="text-neutral-500 dark:text-neutral-400">Fees:</span>
                                <span className="ml-2 font-medium text-neutral-900 dark:text-neutral-100">
                                  {formatCurrency(tx.fees)}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mt-3">
                            <Calendar size={14} />
                            <span>{formatDate(tx.tx_date)}</span>
                          </div>
                          
                          {tx.notes && (
                            <div className="mt-3 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded text-sm text-neutral-700 dark:text-neutral-300">
                              {tx.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
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
