import { isFutureDate, parseDateOnly } from './transactionFormUtils'

type ModalMode = 'add' | 'edit' | null
export type TransactionValidationErrorCode =
  | 'portfolio-required'
  | 'ticker-required'
  | 'invalid-date'
  | 'future-date'
  | 'quantity-must-be-positive'
  | 'fees-must-be-positive'
  | 'price-must-be-positive'
  | 'checking-position'
  | 'no-shares-at-date'
  | 'dividend-per-share-must-be-positive'
  | 'tax-cannot-exceed-gross'

export type TransactionValidationResult =
  | { ok: true }
  | { ok: false; action: 'show-error'; code: TransactionValidationErrorCode }
  | { ok: false; action: 'confirm-risk' }

export interface AutoPriceTransactionPayload {
  symbol: string
  txDate: string
  txType: string
  quantity: number
}

export interface TransactionMutationPayload {
  asset_id: number
  tx_date: string
  type: string
  quantity: number
  price: number
  fees: number
  currency: string
  metadata: Record<string, unknown>
  notes: string | null
}

interface BaseValidationParams {
  txDate: string
  txType: string
  quantity: string
  price: string
  fees: string
  modalMode?: ModalMode
}

interface ValidateTransactionSubmitParams extends BaseValidationParams {
  activePortfolioId: number | null | undefined
  hasSelectedTicker: boolean
  modalMode: ModalMode
  sellQuantityLoading: boolean
  riskAcknowledged: boolean
  sellAvailableQuantity: number | null
}

interface BasePayloadParams {
  assetId: number
  txDate: string
  txType: string
  quantity: string
  price: string
  fees: string
  currency: string
  notes: string
}

interface SplitPayloadParams extends BasePayloadParams {
  splitRatio: string
}

interface UpdatePayloadParams extends BasePayloadParams {
  existingMetadata: Record<string, unknown>
  splitRatio: string
}

const parseOptionalFee = (fees: string) => (
  fees && fees.trim() !== '' ? parseFloat(fees) : 0
)

const parseOptionalPrice = (price: string) => (
  price && price.trim() !== '' ? parseFloat(price) : 0
)

export const shouldUseAutoPriceTransaction = (txType: string, price: string) => (
  !price && txType !== 'SPLIT' && txType !== 'DIVIDEND' && txType !== 'FEE'
)

const ok = (): TransactionValidationResult => ({ ok: true })

const validateCommonTransactionFields = ({
  txDate,
  txType,
  quantity,
  price,
  fees,
  modalMode,
}: BaseValidationParams): TransactionValidationResult => {
  if (!txDate || !parseDateOnly(txDate)) {
    return { ok: false, action: 'show-error', code: 'invalid-date' }
  }

  if (isFutureDate(txDate)) {
    return { ok: false, action: 'show-error', code: 'future-date' }
  }

  const parsedQuantity = parseFloat(quantity)
  const parsedFees = parseOptionalFee(fees)
  const parsedPrice = parseOptionalPrice(price)

  if (txType !== 'SPLIT' && txType !== 'FEE' && (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0)) {
    return { ok: false, action: 'show-error', code: 'quantity-must-be-positive' }
  }

  if (fees && fees.trim() !== '' && (!Number.isFinite(parsedFees) || parsedFees < 0)) {
    return { ok: false, action: 'show-error', code: 'fees-must-be-positive' }
  }

  if (
    ['BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT'].includes(txType) &&
    (modalMode === 'edit' || price.trim() !== '') &&
    (!Number.isFinite(parsedPrice) || parsedPrice <= 0)
  ) {
    return { ok: false, action: 'show-error', code: 'price-must-be-positive' }
  }

  return ok()
}

export const validateBuy = (params: BaseValidationParams): TransactionValidationResult => (
  validateCommonTransactionFields({ ...params, txType: 'BUY' })
)

export const validateSell = ({
  sellAvailableQuantity,
  riskAcknowledged,
  sellQuantityLoading,
  ...params
}: BaseValidationParams & {
  sellAvailableQuantity: number | null
  riskAcknowledged: boolean
  sellQuantityLoading: boolean
}): TransactionValidationResult => {
  const common = validateCommonTransactionFields({ ...params, txType: 'SELL' })
  if (!common.ok) return common

  if (sellQuantityLoading) {
    return { ok: false, action: 'show-error', code: 'checking-position' }
  }

  const parsedQuantity = parseFloat(params.quantity)
  if (
    sellAvailableQuantity !== null &&
    Number.isFinite(parsedQuantity) &&
    parsedQuantity > sellAvailableQuantity &&
    !riskAcknowledged
  ) {
    return { ok: false, action: 'confirm-risk' }
  }

  return ok()
}

export const validateDividend = (params: BaseValidationParams): TransactionValidationResult => {
  const common = validateCommonTransactionFields({ ...params, txType: 'DIVIDEND' })
  if (!common.ok) return common

  const shares = parseFloat(params.quantity)
  if (!Number.isFinite(shares) || shares <= 0) {
    return { ok: false, action: 'show-error', code: 'no-shares-at-date' }
  }

  const perShare = parseFloat(params.price)
  if (!Number.isFinite(perShare) || perShare <= 0) {
    return { ok: false, action: 'show-error', code: 'dividend-per-share-must-be-positive' }
  }

  const gross = shares * perShare
  const tax = parseOptionalFee(params.fees)
  if (Number.isFinite(tax) && tax - gross > 1e-9) {
    return { ok: false, action: 'show-error', code: 'tax-cannot-exceed-gross' }
  }

  return ok()
}

export const validateFee = (params: BaseValidationParams): TransactionValidationResult => (
  validateCommonTransactionFields({ ...params, txType: 'FEE' })
)

export const validateSplit = (params: BaseValidationParams): TransactionValidationResult => (
  validateCommonTransactionFields({ ...params, txType: 'SPLIT' })
)

export const validateTransactionSubmit = ({
  activePortfolioId,
  hasSelectedTicker,
  modalMode,
  sellQuantityLoading,
  riskAcknowledged,
  sellAvailableQuantity,
  ...params
}: ValidateTransactionSubmitParams): TransactionValidationResult => {
  if (!activePortfolioId) {
    return { ok: false, action: 'show-error', code: 'portfolio-required' }
  }

  if (!hasSelectedTicker && modalMode === 'add') {
    return { ok: false, action: 'show-error', code: 'ticker-required' }
  }

  const common = validateCommonTransactionFields({ ...params, modalMode })
  if (!common.ok) return common

  if (modalMode === 'add' && params.txType === 'SELL') {
    if (sellQuantityLoading) {
      return { ok: false, action: 'show-error', code: 'checking-position' }
    }

    const parsedQuantity = parseFloat(params.quantity)
    if (
      sellAvailableQuantity !== null &&
      Number.isFinite(parsedQuantity) &&
      parsedQuantity > sellAvailableQuantity &&
      !riskAcknowledged
    ) {
      return { ok: false, action: 'confirm-risk' }
    }
  }

  if (params.txType === 'DIVIDEND') {
    return validateDividend({ ...params, modalMode })
  }

  return ok()
}

export const buildAutoPricePayload = (
  symbol: string,
  txDate: string,
  txType: string,
  quantity: string,
): AutoPriceTransactionPayload => ({
  symbol,
  txDate,
  txType,
  quantity: parseFloat(quantity),
})

const buildStandardPayload = ({
  assetId,
  txDate,
  txType,
  quantity,
  price,
  fees,
  currency,
  notes,
  metadata,
}: BasePayloadParams & { metadata: Record<string, unknown> }): TransactionMutationPayload => ({
  asset_id: assetId,
  tx_date: txDate,
  type: txType,
  quantity: parseFloat(quantity),
  price: parseFloat(price),
  fees: parseFloat(fees),
  currency,
  metadata,
  notes: notes || null,
})

export const buildBuyPayload = (params: BasePayloadParams): TransactionMutationPayload => (
  buildStandardPayload({ ...params, txType: 'BUY', metadata: {} })
)

export const buildSellPayload = (params: BasePayloadParams): TransactionMutationPayload => (
  buildStandardPayload({ ...params, txType: 'SELL', metadata: {} })
)

export const buildDividendPayload = (params: BasePayloadParams): TransactionMutationPayload => (
  buildStandardPayload({ ...params, txType: 'DIVIDEND', metadata: {} })
)

export const buildFeePayload = (params: BasePayloadParams): TransactionMutationPayload => (
  buildStandardPayload({ ...params, txType: 'FEE', metadata: {} })
)

export const buildSplitPayload = (params: SplitPayloadParams): TransactionMutationPayload => ({
  asset_id: params.assetId,
  tx_date: params.txDate,
  type: 'SPLIT',
  quantity: 0,
  price: 0,
  fees: 0,
  currency: params.currency,
  metadata: { split: params.splitRatio },
  notes: params.notes || null,
})

export const buildCreateTransactionPayload = (params: SplitPayloadParams): TransactionMutationPayload => {
  switch (params.txType) {
    case 'BUY':
      return buildBuyPayload(params)
    case 'SELL':
      return buildSellPayload(params)
    case 'DIVIDEND':
      return buildDividendPayload(params)
    case 'FEE':
      return buildFeePayload(params)
    case 'SPLIT':
      return buildSplitPayload(params)
    default:
      return buildStandardPayload({ ...params, metadata: {} })
  }
}

export const buildUpdatePayload = (params: UpdatePayloadParams): TransactionMutationPayload => {
  if (params.txType === 'SPLIT') {
    return buildSplitPayload(params)
  }

  return buildStandardPayload({
    ...params,
    metadata: params.existingMetadata,
  })
}
