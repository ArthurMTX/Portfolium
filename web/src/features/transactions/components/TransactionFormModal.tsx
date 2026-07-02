import type { ChangeEvent, FormEvent } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import AssetLogo from '@/shared/components/AssetLogo'
import { InlineLoading } from '@/shared/components/StatePrimitives'
import { formatCurrency } from '@/shared/lib/formatUtils'
import { formatTransactionQuantity } from '@/features/transactions/lib/transactionFormUtils'
import type { FormWarning, TransactionSummary } from '@/features/transactions/lib/transactionDerivedState'

type ModalMode = 'add' | 'edit'

interface TickerInfo {
  symbol: string
  name: string
  type?: string | null
  asset_type?: string | null
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
  getSubmitLabel,
}: TransactionFormModalProps) {
  const { t } = useTranslation()
  const warningFor = (...keys: string[]) => transactionWarnings.find((warning) => keys.includes(warning.key))
  const hasQuantityInput = quantity.trim() !== ''
  const hasPriceInput = price.trim() !== ''
  const dateWarning = warningFor('future-date', 'old-date')
  const quantityWarning = warningFor('quantity', 'sell-too-large')
  const visibleQuantityWarning = quantityWarning && (quantityWarning.key !== 'quantity' || hasQuantityInput)
    ? quantityWarning
    : null
  const priceWarning = warningFor('price', 'price-fetch', 'converted-price')
  const visiblePriceWarning = priceWarning && (priceWarning.key !== 'price' || hasPriceInput) && priceWarning.key !== 'converted-price'
    ? priceWarning
    : null
  const feesWarning = warningFor('high-fees')
  const globalWarning = warningFor('dividend-currency')

  return (
    <div className="pf-modal-overlay">
      <div className="pf-modal-panel pf-modal-panel--lg" role="dialog" aria-modal="true">
        <div className="pf-modal-header">
          <h2 className="pf-modal-title">
            {modalMode === 'add' ? t('transactions.addTransaction') : t('transactions.editTransaction')}
          </h2>
          <button
            onClick={onClose}
            className="pf-modal-close" aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="pf-modal-body pf-modal-section">
          {modalMode === 'add' && (
            <div className="pf-modal-subsection">
              <div className="pf-modal-subsection-title">Asset</div>
              <label className="pf-modal-label">
                {t('transactions.ticker')}
              </label>
              <input
                type="text"
                value={ticker}
                onChange={onTickerChange}
                className="pf-modal-input"
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

          <div className="pf-modal-subsection">
            <div className="pf-modal-subsection-title">Trade</div>
            <div className="pf-modal-grid">
            <div>
              <label className="pf-modal-label">
                {t('fields.date')}
              </label>
              <input
                type="date"
                value={txDate}
                onChange={onDateChange}
                max={new Date().toISOString().split('T')[0]}
                className="pf-modal-select"
                required
              />
              {dateWarning && <p className="pf-modal-field-error">{dateWarning.message}</p>}
            </div>

            <div>
              <label className="pf-modal-label">
                {t('fields.type')}
              </label>
              <select
                value={txType}
                onChange={(e) => onTxTypeChange(e.target.value)}
                className="pf-modal-input"
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
          </div>

          {txType === 'SPLIT' && (
            <div className="pf-modal-subsection">
              <div className="pf-modal-subsection-title">Execution</div>
              <label className="pf-modal-label">
                {t('transactions.splitRatio')}
              </label>
              <input
                type="text"
                value={splitRatio}
                onChange={(e) => onSplitRatioChange(e.target.value)}
                className="pf-modal-input"
                placeholder={t('transactions.splitRatioPlaceholder')}
                required
              />
              <p className="pf-modal-help">
                {t('transactions.splitRatioInfo')}  
              </p>
            </div>
          )}

          {txType !== 'SPLIT' && (
            <div className="pf-modal-subsection">
              <div className="pf-modal-subsection-title">Execution</div>
              <div className="pf-modal-grid--3">
              <div>
                <label className="pf-modal-label">
                  {txType === 'DIVIDEND' ? t('fields.shares') : t('fields.quantity')}
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => onQuantityChange(e.target.value)}
                  className="pf-modal-input"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  required
                  readOnly={txType === 'DIVIDEND'}
                />
                {visibleQuantityWarning && <p className="pf-modal-field-error">{visibleQuantityWarning.message}</p>}
                {sellQuantityLoading && (
                  <p className="pf-modal-help">{t('transactions.warnings.checkingPosition')}</p>
                )}
              </div>

              <div>
                <label className="pf-modal-label">
                  {txType === 'DIVIDEND'
                    ? `${t('transactions.dividendPerShare')} (${assetCurrency || portfolioCurrency})`
                    : `${t('fields.price')} (${portfolioCurrency})`}
                  {priceLoading && txType !== 'DIVIDEND' && (
                    <InlineLoading label={t('common.loading')} className="ml-2" />
                  )}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => onPriceChange(e.target.value)}
                    className={`pf-modal-input ${priceLoading ? 'opacity-50' : ''}`}
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
                  <p className="pf-modal-help text-emerald-300">
                    ✓ {t('transactions.priceConverted', { from: priceInfo.asset_currency, to: portfolioCurrency })}
                  </p>
                )}
                {visiblePriceWarning && (
                  <p className="pf-modal-field-error">{visiblePriceWarning.message}</p>
                )}
              </div>

              <div>
                <label className="pf-modal-label">
                  {txType === 'DIVIDEND'
                    ? `${t('fields.tax')} (${assetCurrency || portfolioCurrency})`
                    : `${t('fields.fees')} (${portfolioCurrency})`}
                </label>
                <input
                  type="number"
                  value={fees}
                  onChange={(e) => onFeesChange(e.target.value)}
                  className="pf-modal-input"
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
                {feesWarning && <p className="pf-modal-field-error">{feesWarning.message}</p>}
              </div>
              </div>
            </div>
          )}

          <div className="pf-modal-subsection">
            <div className="pf-modal-subsection-title">Notes</div>
            <label className="sr-only">
              {t('fields.notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              className="pf-modal-textarea"
              rows={3}
              placeholder={t('placeholders.enterNotes')}
            />
          </div>

          <div className="pf-modal-summary space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="pf-modal-summary-title">
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">{t('transactions.summary.impact')}</div>
                  <div className={`font-medium ${transactionSummary.impact < 0 ? 'text-red-600 dark:text-red-400' : transactionSummary.impact > 0 ? 'text-green-600 dark:text-green-400' : 'text-neutral-900 dark:text-neutral-100'}`}>
                    {transactionSummary.impact > 0 ? '+' : ''}{formatTransactionQuantity(transactionSummary.impact)}
                  </div>
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
              </div>
            )}
          </div>

          {(globalWarning || (riskAcknowledged && hasHighRiskSellWarning)) && (
            <div className="pf-modal-callout pf-modal-callout--warning">
              {globalWarning?.message || t('transactions.warnings.riskySellConfirmation')}
            </div>
          )}

          {formError && (
            <div className="pf-modal-callout pf-modal-callout--danger">
              {formError}
            </div>
          )}

          <div className="pf-modal-footer -mx-5 -mb-5 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="pf-modal-button pf-modal-button--secondary"
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
              className="pf-modal-button pf-modal-button--primary"
            >
              {getSubmitLabel(requiresRiskConfirmation, hasHighRiskSellWarning)}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
