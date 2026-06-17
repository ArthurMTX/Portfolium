import type { ChangeEvent, FormEvent } from 'react'
import { AlertTriangle, Info, RefreshCw, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import AssetLogo from '@/shared/components/AssetLogo'
import { formatCurrency } from '@/shared/lib/formatUtils'
import { formatTransactionQuantity } from '@/features/transactions/lib/transactionFormUtils'

type ModalMode = 'add' | 'edit'
type PriceSource = 'empty' | 'auto' | 'manual'
type WarningLevel = 'info' | 'warning' | 'danger'

interface TickerInfo {
  symbol: string
  name: string
  type?: string | null
  asset_type?: string | null
}

interface FormWarning {
  key: string
  level: WarningLevel
  message: string
}

interface TransactionSummary {
  action: string
  asset: string
  date: string
  currency: string
  quantity: number
  price: number
  fees: number
  grossTotal: number
  netTotal: number
  impact: number
  priceSource: PriceSource
  splitRatio?: string
  isSplit: boolean
}

interface TransactionFormModalProps {
  modalMode: ModalMode
  ticker: string
  searchResults: TickerInfo[]
  selectedTicker: TickerInfo | null
  selectedTickerAssetType: string | null
  txDate: string
  txType: string
  splitRatio: string
  quantity: string
  price: string
  fees: string
  notes: string
  priceLoading: boolean
  priceInfo: { converted: boolean; asset_currency: string } | null
  assetCurrency: string | null
  portfolioCurrency: string
  currentLocale: string
  transactionSummary: TransactionSummary
  transactionWarnings: FormWarning[]
  sellQuantityLoading: boolean
  riskAcknowledged: boolean
  hasHighRiskSellWarning: boolean
  formError: string
  formLoading: boolean
  requiresRiskConfirmation: boolean
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onTickerChange: (event: ChangeEvent<HTMLInputElement>) => void
  onSelectTicker: (ticker: TickerInfo) => void
  onDateChange: (event: ChangeEvent<HTMLInputElement>) => void
  onTxTypeChange: (value: string) => void
  onSplitRatioChange: (value: string) => void
  onQuantityChange: (value: string) => void
  onPriceChange: (value: string) => void
  onFeesChange: (value: string) => void
  onNotesChange: (value: string) => void
  formatDate: (dateString: string) => string
  getPriceSourceLabel: (summary: TransactionSummary) => string
  getWarningClasses: (level: WarningLevel) => string
  getSubmitLabel: (requiresRiskConfirmation: boolean, hasHighRiskWarning: boolean) => string
}

export default function TransactionFormModal({
  modalMode,
  ticker,
  searchResults,
  selectedTicker,
  selectedTickerAssetType,
  txDate,
  txType,
  splitRatio,
  quantity,
  price,
  fees,
  notes,
  priceLoading,
  priceInfo,
  assetCurrency,
  portfolioCurrency,
  currentLocale,
  transactionSummary,
  transactionWarnings,
  sellQuantityLoading,
  riskAcknowledged,
  hasHighRiskSellWarning,
  formError,
  formLoading,
  requiresRiskConfirmation,
  onClose,
  onSubmit,
  onTickerChange,
  onSelectTicker,
  onDateChange,
  onTxTypeChange,
  onSplitRatioChange,
  onQuantityChange,
  onPriceChange,
  onFeesChange,
  onNotesChange,
  formatDate,
  getPriceSourceLabel,
  getWarningClasses,
  getSubmitLabel,
}: TransactionFormModalProps) {
  const { t } = useTranslation()

  return (
    <div className="modal-overlay bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {modalMode === 'add' ? t('transactions.addTransaction') : t('transactions.editTransaction')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          {modalMode === 'add' && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                {t('transactions.ticker')}
              </label>
              <input
                type="text"
                value={ticker}
                onChange={onTickerChange}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                placeholder={t('transactions.tickerSearchPlaceholder')}
              />
              {searchResults.length > 0 && (
                <ul className="mt-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.map((item: TickerInfo) => (
                    <li
                      key={item.symbol}
                      className="p-3 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-neutral-200 dark:border-neutral-700 last:border-b-0"
                      onClick={() => onSelectTicker(item)}
                    >
                      <div className="font-semibold text-blue-600 dark:text-blue-400">{item.symbol}</div>
                      <div className="text-sm text-neutral-600 dark:text-neutral-400">{item.name}</div>
                    </li>
                  ))}
                </ul>
              )}
              {selectedTicker && (
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center gap-3">
                  <AssetLogo
                    symbol={selectedTicker.symbol}
                    assetType={selectedTickerAssetType}
                    assetName={selectedTicker.name}
                    alt={`${selectedTicker.symbol} logo`}
                    className="w-10 h-10 flex-shrink-0 object-cover"
                  />
                  <div>
                    <div className="font-semibold text-blue-700 dark:text-blue-300">
                      {selectedTicker.symbol}
                    </div>

                    <div className="text-sm text-neutral-500 dark:text-neutral-400">
                      {selectedTicker.name}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                {t('fields.date')}
              </label>
              <input
                type="date"
                value={txDate}
                onChange={onDateChange}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                {t('fields.type')}
              </label>
              <select
                value={txType}
                onChange={(e) => onTxTypeChange(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              >
                <option value="BUY">{t('transaction.types.buy')}</option>
                <option value="SELL">{t('transaction.types.sell')}</option>
                <option value="DIVIDEND">{t('transaction.types.dividend')}</option>
                <option value="FEE">{t('transaction.types.fee')}</option>
                <option value="SPLIT">{t('transaction.types.split')}</option>
                <option value="TRANSFER_IN">{t('transaction.types.transferIn')}</option>
                <option value="TRANSFER_OUT">{t('transaction.types.transferOut')}</option>
              </select>
            </div>
          </div>

          {txType === 'SPLIT' && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                {t('transactions.splitRatio')}
              </label>
              <input
                type="text"
                value={splitRatio}
                onChange={(e) => onSplitRatioChange(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                placeholder={t('transactions.splitRatioPlaceholder')}
                required
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {t('transactions.splitRatioInfo')}  
              </p>
            </div>
          )}

          {txType !== 'SPLIT' && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  {txType === 'DIVIDEND' ? t('fields.shares') : t('fields.quantity')}
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => onQuantityChange(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  required
                  readOnly={txType === 'DIVIDEND'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  {txType === 'DIVIDEND'
                    ? `${t('transactions.dividendPerShare')} (${assetCurrency || portfolioCurrency})`
                    : `${t('fields.price')} (${portfolioCurrency})`}
                  {priceLoading && txType !== 'DIVIDEND' && (
                    <span className="ml-2 text-pink-500 animate-pulse">{t('common.loading')}...</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => onPriceChange(e.target.value)}
                    className={`w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 ${priceLoading ? 'opacity-50' : ''}`}
                    min={txType === 'DIVIDEND' ? '0.00000001' : '0'}
                    step="any"
                    placeholder="0.00"
                    disabled={priceLoading && txType !== 'DIVIDEND'}
                    required={txType === 'DIVIDEND'}
                  />
                  {priceLoading && txType !== 'DIVIDEND' && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <RefreshCw size={16} className="animate-spin text-pink-500" />
                    </div>
                  )}
                </div>
                {txType !== 'DIVIDEND' && priceInfo?.converted && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    ✓ {t('transactions.priceConverted', { from: priceInfo.asset_currency, to: portfolioCurrency })}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  {txType === 'DIVIDEND'
                    ? `${t('fields.tax')} (${assetCurrency || portfolioCurrency})`
                    : `${t('fields.fees')} (${portfolioCurrency})`}
                </label>
                <input
                  type="number"
                  value={fees}
                  onChange={(e) => onFeesChange(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  min="0"
                  max={
                    txType === 'DIVIDEND' &&
                    Number.isFinite(parseFloat(quantity)) &&
                    Number.isFinite(parseFloat(price))
                      ? String(parseFloat(quantity) * parseFloat(price))
                      : undefined
                  }
                  step="any"
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              {t('fields.notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              rows={3}
              placeholder={t('placeholders.enterNotes')}
            />
          </div>

          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/40 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                <Info size={16} className="text-pink-500" />
                {t('transactions.summary.title')}
              </div>
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {t('transactions.summary.amountsIn', { currency: transactionSummary.currency })}
              </span>
            </div>

            {transactionSummary.isSplit ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">{t('fields.type')}</div>
                  <div className="font-medium text-neutral-900 dark:text-neutral-100">{transactionSummary.action}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">{t('fields.asset')}</div>
                  <div className="font-medium text-neutral-900 dark:text-neutral-100">{transactionSummary.asset}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">{t('transactions.splitRatio')}</div>
                  <div className="font-medium text-neutral-900 dark:text-neutral-100">{transactionSummary.splitRatio || '-'}</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">{t('transactions.summary.action')}</div>
                  <div className="font-medium text-neutral-900 dark:text-neutral-100">{transactionSummary.action}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">{t('fields.asset')}</div>
                  <div className="font-medium text-neutral-900 dark:text-neutral-100">{transactionSummary.asset}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">{t('transactions.summary.impact')}</div>
                  <div className={`font-medium ${transactionSummary.impact < 0 ? 'text-red-600 dark:text-red-400' : transactionSummary.impact > 0 ? 'text-green-600 dark:text-green-400' : 'text-neutral-900 dark:text-neutral-100'}`}>
                    {transactionSummary.impact > 0 ? '+' : ''}{formatTransactionQuantity(transactionSummary.impact)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">{t('transactions.summary.priceSource')}</div>
                  <div className="font-medium text-neutral-900 dark:text-neutral-100">{getPriceSourceLabel(transactionSummary)}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">{t('transactions.summary.grossTotal')}</div>
                  <div className="font-medium text-neutral-900 dark:text-neutral-100">{formatCurrency(transactionSummary.grossTotal, transactionSummary.currency, currentLocale, true)}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">{txType === 'DIVIDEND' ? t('fields.tax') : t('fields.fees')}</div>
                  <div className="font-medium text-neutral-900 dark:text-neutral-100">{formatCurrency(transactionSummary.fees, transactionSummary.currency, currentLocale, true)}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">{t('transactions.summary.netTotal')}</div>
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100">{formatCurrency(transactionSummary.netTotal, transactionSummary.currency, currentLocale, true)}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">{t('fields.date')}</div>
                  <div className="font-medium text-neutral-900 dark:text-neutral-100">{txDate ? formatDate(txDate) : '-'}</div>
                </div>
              </div>
            )}
          </div>

          {(transactionWarnings.length > 0 || sellQuantityLoading || riskAcknowledged) && (
            <div className="space-y-2">
              {sellQuantityLoading && (
                <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-700 dark:text-blue-300">
                  {t('transactions.warnings.checkingPosition')}
                </div>
              )}
              {transactionWarnings.map((warning) => (
                <div key={warning.key} className={`p-3 rounded-lg border text-sm flex items-start gap-2 ${getWarningClasses(warning.level)}`}>
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{warning.message}</span>
                </div>
              ))}
              {riskAcknowledged && hasHighRiskSellWarning && (
                <div className="p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">
                  {t('transactions.warnings.riskySellConfirmation')}
                </div>
              )}
            </div>
          )}

          {formError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
              {formError}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={
                formLoading ||
                (modalMode === 'add' && txType === 'SELL' && sellQuantityLoading) ||
                (modalMode === 'add' && !selectedTicker) ||
                (txType === 'DIVIDEND' && (
                  (!(Number.isFinite(parseFloat(quantity))) || parseFloat(quantity) <= 0) ||
                  (!(Number.isFinite(parseFloat(price))) || parseFloat(price) <= 0) ||
                  (
                    Number.isFinite(parseFloat(fees)) &&
                    Number.isFinite(parseFloat(quantity)) &&
                    Number.isFinite(parseFloat(price)) &&
                    parseFloat(fees) - (parseFloat(quantity) * parseFloat(price)) > 1e-9
                  )
                ))
              }
              className="flex-1 px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:bg-neutral-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {getSubmitLabel(requiresRiskConfirmation, hasHighRiskSellWarning)}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
