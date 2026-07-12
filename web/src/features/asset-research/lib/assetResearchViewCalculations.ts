import type { PositionDTO } from '@/api'
import type { AssetResearchViewTransaction } from '@/features/asset-research/types'

export function researchNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export function calculatePriceChangeAmount(
  price: number | string | null | undefined,
  changePercentage: number | string | null | undefined,
): number | null {
  if (price === null || price === undefined || changePercentage === null || changePercentage === undefined) {
    return null
  }

  const current = researchNumber(price)
  const percentage = researchNumber(changePercentage)
  const denominator = 1 + percentage / 100
  if (current <= 0 || denominator <= 0) return null

  return current - current / denominator
}

export function calculatePortfolioWeight(
  position: PositionDTO | null | undefined,
  portfolioValue: number | string | null | undefined,
): number | null {
  const total = researchNumber(portfolioValue)
  if (!position?.market_value || total <= 0) return null
  return (researchNumber(position.market_value) / total) * 100
}

export function calculatePositionDailyContribution(
  position: PositionDTO | null | undefined,
): number | null {
  if (!position?.market_value || position.daily_change_pct === null) return null
  return researchNumber(position.market_value) * (researchNumber(position.daily_change_pct) / 100)
}

export function calculatePositionTotalReturn(position: PositionDTO | null | undefined): number | null {
  if (!position) return null
  if (position.lifetime_pnl !== null) return researchNumber(position.lifetime_pnl)
  if (position.unrealized_pnl !== null) {
    return researchNumber(position.unrealized_pnl) + researchNumber(position.realized_pnl)
  }
  return null
}

export function calculatePositionTotalReturnPct(position: PositionDTO | null | undefined): number | null {
  if (!position) return null
  const totalReturn = calculatePositionTotalReturn(position)
  if (totalReturn === null) return null
  const totalCostBasis = researchNumber(position.cost_basis) + researchNumber(position.realized_cost_basis)
  if (totalCostBasis <= 0) return null
  return (totalReturn / totalCostBasis) * 100
}

export function calculateTransactionAmount(transaction: AssetResearchViewTransaction): number {
  const gross = researchNumber(transaction.quantity) * researchNumber(transaction.price)
  const fees = researchNumber(transaction.fees)
  return transaction.type === 'SELL' || transaction.type === 'DIVIDEND'
    ? gross - fees
    : gross + fees
}

export function sumTransactionType(
  transactions: AssetResearchViewTransaction[],
  type: string,
): number {
  return transactions
    .filter((transaction) => transaction.type === type)
    .reduce((sum, transaction) => sum + calculateTransactionAmount(transaction), 0)
}
