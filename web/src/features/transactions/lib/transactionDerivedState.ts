import { formatTransactionQuantity, isFutureDate, isVeryOldDate, parseAmount } from './transactionFormUtils'

export type PriceSource = 'empty' | 'auto' | 'manual'
export type WarningLevel = 'info' | 'warning' | 'danger'
type ModalMode = 'add' | 'edit' | null

export interface FormWarning {
  key: string
  level: WarningLevel
  message: string
}

export interface TransactionSummary {
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

interface GetTransactionSummaryParams {
  txType: string
  quantity: string
  price: string
  fees: string
  txDate: string
  assetCurrency: string | null
  portfolioCurrency: string
  selectedTickerSymbol?: string
  ticker: string
  editingTransactionSymbol?: string
  unknownAssetLabel: string
  priceSource: PriceSource
  splitRatio: string
  getTranslatedType: (type: string) => string
}

export type CashTrackingMode = 'untracked' | 'tracked_warn' | 'tracked_strict'

interface GetTransactionWarningsParams {
  summary: TransactionSummary
  txType: string
  txDate: string
  priceFetchFailed: boolean
  modalMode: ModalMode
  sellAvailableQuantity: number | null
  priceInfo: { converted: boolean; asset_currency: string } | null
  portfolioCurrency: string
  translate: (key: string, options?: Record<string, unknown>) => string
  /** Cash tracking mode of the portfolio; cash warnings only apply when tracked */
  cashMode?: CashTrackingMode
  /** Available cash in the settlement currency (null when unknown/still loading) */
  availableCash?: number | null
}

/**
 * Signed cash impact of the transaction being edited (settlement currency).
 * Mirrors the backend derivation: buys debit gross+fees, sells credit net
 * proceeds, dividends credit gross minus withholding tax, fees debit.
 */
export const getTransactionCashDelta = (
  summary: TransactionSummary,
  txType: string
): number => {
  switch (txType) {
    case 'BUY':
      return -(summary.grossTotal + summary.fees)
    case 'SELL':
      return summary.grossTotal - summary.fees
    case 'DIVIDEND':
      return summary.grossTotal - summary.fees
    case 'FEE':
      return -(summary.fees || summary.grossTotal)
    default:
      // SPLIT / TRANSFER_IN / TRANSFER_OUT / CONVERSION_* are cash-neutral
      return 0
  }
}

export const getTransactionSummary = ({
  txType,
  quantity,
  price,
  fees,
  txDate,
  assetCurrency,
  portfolioCurrency,
  selectedTickerSymbol,
  ticker,
  editingTransactionSymbol,
  unknownAssetLabel,
  priceSource,
  splitRatio,
  getTranslatedType,
}: GetTransactionSummaryParams): TransactionSummary => {
  const qty = parseAmount(quantity)
  const unitPrice = parseAmount(price)
  const feeAmount = parseAmount(fees)
  const currency = txType === 'DIVIDEND' ? (assetCurrency || portfolioCurrency) : portfolioCurrency
  const asset = selectedTickerSymbol || ticker || editingTransactionSymbol || unknownAssetLabel
  const isSplit = txType === 'SPLIT'

  if (isSplit) {
    return {
      action: getTranslatedType(txType),
      asset,
      date: txDate,
      currency,
      quantity: 0,
      price: 0,
      fees: 0,
      grossTotal: 0,
      netTotal: 0,
      impact: 0,
      priceSource,
      splitRatio,
      isSplit: true,
    }
  }

  let grossTotal = qty * unitPrice
  let netTotal = grossTotal
  let impact = 0

  switch (txType) {
    case 'BUY':
    case 'TRANSFER_IN':
      netTotal = grossTotal + feeAmount
      impact = qty
      break
    case 'SELL':
    case 'TRANSFER_OUT':
      netTotal = grossTotal - feeAmount
      impact = -qty
      break
    case 'DIVIDEND':
      netTotal = grossTotal - feeAmount
      impact = 0
      break
    case 'FEE':
      grossTotal = feeAmount || unitPrice
      netTotal = -grossTotal
      impact = 0
      break
    default:
      netTotal = grossTotal
  }

  return {
    action: getTranslatedType(txType),
    asset,
    date: txDate,
    currency,
    quantity: qty,
    price: unitPrice,
    fees: feeAmount,
    grossTotal,
    netTotal,
    impact,
    priceSource: priceSource === 'empty' && price ? 'manual' : priceSource,
    isSplit: false,
  }
}

export const getTransactionWarnings = ({
  summary,
  txType,
  txDate,
  priceFetchFailed,
  modalMode,
  sellAvailableQuantity,
  priceInfo,
  portfolioCurrency,
  translate,
  cashMode = 'untracked',
  availableCash = null,
}: GetTransactionWarningsParams): FormWarning[] => {
  const warnings: FormWarning[] = []
  const typeNeedsPrice = ['BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT'].includes(txType)
  const typeNeedsQuantity = txType !== 'SPLIT' && txType !== 'FEE'

  if (isFutureDate(txDate)) {
    warnings.push({
      key: 'future-date',
      level: 'danger',
      message: translate('transactions.warnings.futureDate'),
    })
  }

  if (isVeryOldDate(txDate)) {
    warnings.push({
      key: 'old-date',
      level: 'warning',
      message: translate('transactions.warnings.oldDate'),
    })
  }

  if (typeNeedsQuantity && summary.quantity <= 0) {
    warnings.push({
      key: 'quantity',
      level: 'warning',
      message: translate('transactions.warnings.quantityMissing'),
    })
  }

  if (typeNeedsPrice && summary.price <= 0) {
    warnings.push({
      key: 'price',
      level: 'warning',
      message: translate('transactions.warnings.priceMissing'),
    })
  }

  if (priceFetchFailed && typeNeedsPrice) {
    warnings.push({
      key: 'price-fetch',
      level: 'warning',
      message: translate('transactions.warnings.priceAutoUnavailable'),
    })
  }

  if (summary.grossTotal > 0 && summary.fees / summary.grossTotal > 0.05) {
    warnings.push({
      key: 'high-fees',
      level: 'warning',
      message: translate('transactions.warnings.highFees'),
    })
  }

  if (
    modalMode === 'add' &&
    txType === 'SELL' &&
    sellAvailableQuantity !== null &&
    summary.quantity > sellAvailableQuantity
  ) {
    warnings.push({
      key: 'sell-too-large',
      level: 'danger',
      message: translate('transactions.warnings.sellExceedsPosition', {
        available: formatTransactionQuantity(sellAvailableQuantity),
      }),
    })
  }

  if (txType !== 'DIVIDEND' && priceInfo?.converted) {
    warnings.push({
      key: 'converted-price',
      level: 'info',
      message: translate('transactions.warnings.currencyConverted', {
        from: priceInfo.asset_currency,
        to: portfolioCurrency,
      }),
    })
  }

  if (txType === 'DIVIDEND' && summary.currency !== portfolioCurrency) {
    warnings.push({
      key: 'dividend-currency',
      level: 'info',
      message: translate('transactions.warnings.dividendCurrency', {
        currency: summary.currency,
        portfolioCurrency,
      }),
    })
  }

  // Cash tracking: warn when the transaction would push the settlement
  // currency balance negative. Danger in strict mode (the API rejects it),
  // warning otherwise. Untracked portfolios never get cash warnings.
  if (cashMode !== 'untracked' && availableCash !== null) {
    const cashDelta = getTransactionCashDelta(summary, txType)
    const projected = availableCash + cashDelta
    if (cashDelta < 0 && projected < 0) {
      const strict = cashMode === 'tracked_strict'
      warnings.push({
        key: 'cash-insufficient',
        level: strict ? 'danger' : 'warning',
        message: translate(
          strict
            ? 'transactions.warnings.cashInsufficientStrict'
            : 'transactions.warnings.cashProjectedNegative',
          { currency: summary.currency },
        ),
      })
    }
  }

  return warnings
}
