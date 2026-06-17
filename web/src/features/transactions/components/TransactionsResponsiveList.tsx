import type { ReactNode } from 'react'
import { ChevronDown, ChevronUp, Edit2, Shuffle, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import AssetLogo from '@/shared/components/AssetLogo'
import SortIcon from '@/shared/components/SortIcon'
import { formatCurrency, formatCurrencyCompact } from '@/shared/lib/formatUtils'
import { formatTransactionQuantity } from '@/features/transactions/lib/transactionFormUtils'

type TabType = 'all' | 'buy' | 'sell' | 'dividend' | 'fee' | 'split' | 'conversion'
type SortKey = 'tx_date' | 'symbol' | 'type' | 'quantity' | 'price' | 'fees' | 'total'
type SortDir = 'asc' | 'desc'

interface Transaction {
  id: number
  asset_id: number
  asset: {
    symbol: string
    name: string | null
    asset_type?: string
  }
  tx_date: string
  type: string
  quantity: number | string
  price: number | string
  fees: number | string
  currency: string
  notes: string | null
  metadata?: {
    split?: string
    [key: string]: unknown
  }
}

interface TransactionsResponsiveListProps {
  transactions: Transaction[]
  activeTab: TabType
  availableSortOptions: SortKey[]
  sortKey: SortKey
  sortDir: SortDir
  portfolioCurrency: string
  fxRates: Record<string, number | null>
  formatDate: (dateString: string) => string
  getSortLabel: (key: SortKey) => string
  getTransactionColor: (type: string) => string
  getTransactionIcon: (type: string) => ReactNode
  getTranslatedType: (type: string) => string
  assetHasSplits: (assetId: number) => boolean
  onSort: (key: SortKey) => void
  onToggleSortDirection: () => void
  onEdit: (transaction: Transaction) => void
  onDelete: (transactionId: number) => void
  onViewSplitHistory: (asset: { id: number; symbol: string }) => void
}

const getTransactionMetadata = (transaction: Transaction) => {
  const txData = transaction as unknown as Record<string, unknown>
  return transaction.metadata || txData.meta_data as { split?: string } | undefined
}

const getTransactionDisplayTotal = (
  transaction: Transaction,
  portfolioCurrency: string,
  fxRates: Record<string, number | null>
) => {
  const quantity = typeof transaction.quantity === 'string'
    ? parseFloat(transaction.quantity)
    : transaction.quantity
  const price = typeof transaction.price === 'string'
    ? parseFloat(transaction.price)
    : transaction.price
  const fees = typeof transaction.fees === 'string'
    ? parseFloat(transaction.fees)
    : transaction.fees
  const nativeTotal = transaction.type === 'DIVIDEND' || transaction.type === 'SELL'
    ? (quantity * price - fees)
    : (quantity * price + fees)

  const needsDividendConversion =
    transaction.type === 'DIVIDEND' &&
    transaction.currency &&
    transaction.currency.toUpperCase() !== portfolioCurrency
  const fxKey = needsDividendConversion
    ? `${transaction.currency.toUpperCase()}|${portfolioCurrency}|${transaction.tx_date}`
    : null
  const fxRate = fxKey ? fxRates[fxKey] : undefined
  const displayTotal = needsDividendConversion && typeof fxRate === 'number'
    ? nativeTotal * fxRate
    : nativeTotal

  return { displayTotal, fxRate, nativeTotal, needsDividendConversion }
}

export default function TransactionsResponsiveList({
  transactions,
  activeTab,
  availableSortOptions,
  sortKey,
  sortDir,
  portfolioCurrency,
  fxRates,
  formatDate,
  getSortLabel,
  getTransactionColor,
  getTransactionIcon,
  getTranslatedType,
  assetHasSplits,
  onSort,
  onToggleSortDirection,
  onEdit,
  onDelete,
  onViewSplitHistory,
}: TransactionsResponsiveListProps) {
  const { t } = useTranslation()
  const isActive = (key: SortKey) => sortKey === key

  const renderTotal = (transaction: Transaction) => {
    const { displayTotal, fxRate, nativeTotal, needsDividendConversion } = getTransactionDisplayTotal(
      transaction,
      portfolioCurrency,
      fxRates
    )

    if (transaction.type === 'SPLIT') return '-'
    if (needsDividendConversion) {
      if (typeof fxRate === 'number') return formatCurrencyCompact(displayTotal, portfolioCurrency)
      if (fxRate === null) return formatCurrencyCompact(nativeTotal, transaction.currency)
      return t('common.loading')
    }
    return formatCurrencyCompact(displayTotal, transaction.currency)
  }

  const renderSplitNotes = (transaction: Transaction, fallback: ReactNode) => {
    const metadata = getTransactionMetadata(transaction)
    return transaction.type === 'SPLIT' && metadata?.split ? (
      <span className="inline-flex items-center gap-1">
        <span className="font-medium text-purple-700 dark:text-purple-400">{metadata.split} {t('transaction.types.split')}</span>
        {transaction.notes && <span className="text-neutral-400">•</span>}
        {transaction.notes}
      </span>
    ) : (
      fallback
    )
  }

  return (
    <>
      <div className="lg:hidden">
        <div className="flex items-center gap-2 p-3">
          <label htmlFor="mobile-sort-tx" className="text-sm font-medium text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
            {t('common.sortBy')}:
          </label>
          <select
            id="mobile-sort-tx"
            value={sortKey}
            onChange={(e) => onSort(e.target.value as SortKey)}
            className="flex-1 input text-sm py-2 px-3"
          >
            {availableSortOptions.map((option) => (
              <option key={option} value={option}>
                {getSortLabel(option)}
              </option>
            ))}
          </select>
          <button
            onClick={onToggleSortDirection}
            className="btn-secondary p-2 flex items-center gap-1"
            title={sortDir === 'asc' ? 'Sort Descending' : 'Sort Ascending'}
          >
            {sortDir === 'asc' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>

        <div className="space-y-3">
          {transactions.map((transaction) => {
            const metadata = getTransactionMetadata(transaction)

            return (
              <div key={transaction.id} className="card p-4">
                <div className="flex items-start justify-between mb-3 pb-3 border-b border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <AssetLogo
                      symbol={transaction.asset.symbol}
                      assetType={transaction.asset.asset_type}
                      assetName={transaction.asset.name}
                      alt={`${transaction.asset.symbol} logo`}
                      className="w-10 h-10 flex-shrink-0 object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                        {transaction.asset.symbol}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        {formatDate(transaction.tx_date)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <div className={`flex items-center justify-end gap-1 text-sm font-medium mb-1 ${getTransactionColor(transaction.type)}`}>
                      {getTransactionIcon(transaction.type)}
                      {getTranslatedType(transaction.type)}
                    </div>
                    <div className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                      {renderTotal(transaction)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('fields.quantity')}</span>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {transaction.type === 'SPLIT' ? '-' : formatTransactionQuantity(transaction.quantity)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('fields.price')}</span>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {transaction.type === 'SPLIT' ? '-' : formatCurrency(transaction.price, transaction.currency)}
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400 text-xs">{transaction.type === 'DIVIDEND' ? t('fields.tax') : t('fields.fees')}</span>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {transaction.type === 'SPLIT' ? '-' : formatCurrencyCompact(transaction.fees, transaction.currency)}
                    </div>
                  </div>
                  {transaction.asset.name && (
                    <div className="text-right">
                      <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('transactions.assetName')}</span>
                      <div className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        {transaction.asset.name}
                      </div>
                    </div>
                  )}
                </div>

                {(transaction.notes || (transaction.type === 'SPLIT' && metadata?.split)) && (
                  <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                    <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('fields.notes')}:</span>
                    <div className="text-sm text-neutral-700 dark:text-neutral-300 mt-1">
                      {renderSplitNotes(transaction, transaction.notes)}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                  {assetHasSplits(transaction.asset_id) && (
                    <button
                      onClick={() => onViewSplitHistory({ id: transaction.asset_id, symbol: transaction.asset.symbol })}
                      className="btn-secondary text-sm px-3 py-2 flex items-center gap-2"
                    >
                      <Shuffle size={16} />
                      {t('transactions.splits')}
                    </button>
                  )}
                  <button
                    onClick={() => onEdit(transaction)}
                    className="btn-secondary text-sm px-3 py-2 flex items-center gap-2"
                  >
                    <Edit2 size={16} />
                    {t('common.edit')}
                  </button>
                  <button
                    onClick={() => onDelete(transaction.id)}
                    className="btn-secondary text-sm px-3 py-2 flex items-center gap-2 text-red-600 dark:text-red-400"
                  >
                    <Trash2 size={16} />
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-neutral-50 dark:bg-neutral-800/50">
            <tr>
              <th
                onClick={() => onSort('tx_date')}
                aria-sort={isActive('tx_date') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                {t('fields.date')} <SortIcon column="tx_date" activeColumn={sortKey} direction={sortDir} />
              </th>
              <th
                onClick={() => onSort('symbol')}
                aria-sort={isActive('symbol') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                {t('fields.asset')} <SortIcon column="symbol" activeColumn={sortKey} direction={sortDir} />
              </th>
              <th
                onClick={() => onSort('type')}
                aria-sort={isActive('type') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                {t('fields.type')} <SortIcon column="type" activeColumn={sortKey} direction={sortDir} />
              </th>
              <th
                onClick={() => onSort('quantity')}
                aria-sort={isActive('quantity') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                {t('fields.quantity')} <SortIcon column="quantity" activeColumn={sortKey} direction={sortDir} />
              </th>
              <th
                onClick={() => onSort('price')}
                aria-sort={isActive('price') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                {t('fields.price')} <SortIcon column="price" activeColumn={sortKey} direction={sortDir} />
              </th>
              <th
                onClick={() => onSort('fees')}
                aria-sort={isActive('fees') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                {(activeTab === 'dividend'
                  ? t('fields.tax')
                  : activeTab === 'all'
                    ? `${t('fields.fees')} / ${t('fields.tax')}`
                    : t('fields.fees'))}{' '}
                <SortIcon column="fees" activeColumn={sortKey} direction={sortDir} />
              </th>
              <th
                onClick={() => onSort('total')}
                aria-sort={isActive('total') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                {t('fields.total')} <SortIcon column="total" activeColumn={sortKey} direction={sortDir} />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                {t('fields.notes')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                {t('common.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {transactions.map((transaction) => (
              <tr
                key={transaction.id}
                className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900 dark:text-neutral-100">
                  {formatDate(transaction.tx_date)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <AssetLogo
                      symbol={transaction.asset.symbol}
                      assetType={transaction.asset.asset_type}
                      assetName={transaction.asset.name}
                      alt={`${transaction.asset.symbol} logo`}
                      className="w-6 h-6 object-cover"
                    />
                    <div>
                      <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {transaction.asset.symbol}
                      </div>
                      {transaction.asset.name && (
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 max-w-[150px] truncate" title={transaction.asset.name}>
                          {transaction.asset.name}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`flex items-center gap-2 text-sm font-medium ${getTransactionColor(transaction.type)}`}>
                    {getTransactionIcon(transaction.type)}
                    {getTranslatedType(transaction.type)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-neutral-900 dark:text-neutral-100">
                  {transaction.type === 'SPLIT' ? '-' : formatTransactionQuantity(transaction.quantity)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-neutral-900 dark:text-neutral-100">
                  {transaction.type === 'SPLIT' ? '-' : formatCurrency(transaction.price, transaction.currency)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-neutral-900 dark:text-neutral-100">
                  {transaction.type === 'SPLIT' ? '-' : formatCurrencyCompact(transaction.fees, transaction.currency)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {renderTotal(transaction)}
                </td>
                <td className="px-6 py-4 text-sm text-neutral-500 dark:text-neutral-400 max-w-xs truncate">
                  {renderSplitNotes(transaction, transaction.notes || '-')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-2">
                    {assetHasSplits(transaction.asset_id) && (
                      <button
                        onClick={() => onViewSplitHistory({ id: transaction.asset_id, symbol: transaction.asset.symbol })}
                        className="p-2 text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20 rounded transition-colors"
                        title={t('transactions.viewSplitHistory')}
                      >
                        <Shuffle size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => onEdit(transaction)}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded transition-colors"
                      title={t('transactions.editTransaction')}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => onDelete(transaction.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded transition-colors"
                      title={t('transactions.deleteTransaction')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
