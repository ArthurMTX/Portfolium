import type { CashBalanceDTO, CashErrorDetail, CashMovementDTO, CashWarningDTO } from '@/api/types'

/** Parse a backend decimal (string or number) into a finite number, else 0 */
export function toAmount(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Movement types that credit cash when created manually */
export const CREDIT_MOVEMENT_TYPES = new Set(['deposit', 'interest', 'opening_balance', 'sell', 'dividend', 'fx_credit'])

/** Manual operation types the movement form offers (opening_balance is activation-only) */
export const MANUAL_MOVEMENT_TYPES = ['deposit', 'withdrawal', 'adjustment', 'interest', 'fee', 'tax'] as const
export type ManualMovementType = (typeof MANUAL_MOVEMENT_TYPES)[number]

/** Visual tone of a signed movement amount */
export function movementTone(movement: Pick<CashMovementDTO, 'amount'>): 'positive' | 'negative' {
  return toAmount(movement.amount) >= 0 ? 'positive' : 'negative'
}

/** True when the movement was derived from a transaction/conversion/activation */
export function isDerivedMovement(movement: CashMovementDTO): boolean {
  return (
    movement.transaction_id != null
    || movement.conversion_id != null
    || movement.type === 'opening_balance'
  )
}

/**
 * Extract the structured cash business error from an API error payload.
 * Cash endpoints return {"detail": {code, message, context}} while the rest
 * of the API uses string details.
 */
export function parseCashErrorDetail(raw: unknown): CashErrorDetail | null {
  if (!raw || typeof raw !== 'object') return null
  const detail = (raw as { detail?: unknown }).detail ?? raw
  if (!detail || typeof detail !== 'object') return null
  const candidate = detail as Partial<CashErrorDetail>
  if (typeof candidate.code !== 'string' || typeof candidate.message !== 'string') return null
  return {
    code: candidate.code,
    message: candidate.message,
    context: (candidate.context && typeof candidate.context === 'object' ? candidate.context : {}) as CashErrorDetail['context'],
  }
}

/** Try to parse a structured cash error out of a thrown ApiRequestError message */
export function parseCashErrorFromMessage(message: string): CashErrorDetail | null {
  try {
    return parseCashErrorDetail(JSON.parse(message))
  } catch {
    return null
  }
}

/**
 * Projected balance after a proposed cash delta (positive = credit).
 * Returns null when the available balance is unknown.
 */
export function projectedBalance(
  available: number | null | undefined,
  delta: number
): number | null {
  if (available === null || available === undefined || !Number.isFinite(available)) return null
  return available + delta
}

/** Find the balance entry for a currency (case-insensitive) */
export function findBalance(
  balances: CashBalanceDTO[] | undefined,
  currency: string
): CashBalanceDTO | null {
  if (!balances) return null
  const wanted = currency.trim().toUpperCase()
  return balances.find((balance) => balance.currency.toUpperCase() === wanted) ?? null
}

/** True when any convertible balance relied on a stale FX rate */
export function hasStaleRates(balances: CashBalanceDTO[] | undefined): boolean {
  return (balances ?? []).some((balance) => balance.rate_stale)
}

/** Effective FX conversion rate of a form (target units per 1 source unit) */
export function conversionRate(sourceAmount: string, targetAmount: string): number | null {
  const source = Number(sourceAmount)
  const target = Number(targetAmount)
  if (!Number.isFinite(source) || !Number.isFinite(target) || source <= 0 || target <= 0) {
    return null
  }
  return target / source
}

export interface CashFormIssue {
  key: string
  level: 'warning' | 'danger'
  currency: string
  projected: number
}

/**
 * Warning for a manual cash form: does the proposed debit push the currency
 * negative? danger in strict mode (the API will reject), warning otherwise.
 */
export function manualMovementIssue(
  available: number | null,
  signedDelta: number,
  strict: boolean
): CashFormIssue | null {
  const projected = projectedBalance(available, signedDelta)
  if (projected === null || projected >= 0 || signedDelta >= 0) return null
  return {
    key: 'cash-projected-negative',
    level: strict ? 'danger' : 'warning',
    currency: '',
    projected,
  }
}

/** Group warnings by currency for display */
export function summarizeWarnings(warnings: CashWarningDTO[] | undefined): CashWarningDTO[] {
  if (!warnings) return []
  const seen = new Map<string, CashWarningDTO>()
  for (const warning of warnings) {
    const existing = seen.get(warning.currency)
    if (!existing || warning.date < existing.date) {
      seen.set(warning.currency, warning)
    }
  }
  return [...seen.values()].sort((a, b) => a.currency.localeCompare(b.currency))
}
