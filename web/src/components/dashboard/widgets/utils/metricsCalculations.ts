/**
 * Financial metrics calculation utilities
 * These functions calculate advanced portfolio metrics from available data
 */

import { PositionDTO } from '@/lib/api'

/**
 * Calculate Hit Ratio (percentage of profitable positions)
 */
export function calculateHitRatio(positions: PositionDTO[]): number | null {
  if (!positions || positions.length === 0) return null
  
  const profitablePositions = positions.filter(pos => {
    const unrealizedPnl = pos.unrealized_pnl !== null && pos.unrealized_pnl !== undefined
      ? Number(pos.unrealized_pnl)
      : 0
    return unrealizedPnl > 0
  })
  
  return (profitablePositions.length / positions.length) * 100
}

/**
 * Calculate average holding period for sold positions
 * Returns the average number of days positions were held
 */
export function calculateAvgHoldingPeriod(soldPositions: PositionDTO[]): number | null {
  if (!soldPositions || soldPositions.length === 0) return null
  
  // This would require transaction dates from the backend
  // For now, return null as we need more data
  return null
}

/**
 * Calculate diversification score based on position concentration
 * Score from 0-100, higher is better
 */
export function calculateDiversificationScore(positions: PositionDTO[]): number | null {
  if (!positions || positions.length === 0) return null
  
  // Calculate total portfolio value
  const totalValue = positions.reduce((sum, pos) => {
    const value = pos.market_value !== null && pos.market_value !== undefined
      ? Number(pos.market_value)
      : 0
    return sum + value
  }, 0)
  
  if (totalValue === 0) return null
  
  // Calculate concentration (Herfindahl-Hirschman Index)
  const hhi = positions.reduce((sum, pos) => {
    const value = pos.market_value !== null && pos.market_value !== undefined
      ? Number(pos.market_value)
      : 0
    const weight = value / totalValue
    return sum + (weight * weight)
  }, 0)
  
  // Convert HHI to diversification score (0-100)
  // HHI ranges from 1/n (perfectly diversified) to 1 (concentrated)
  // We invert and scale it to a 0-100 score
  const maxHHI = 1 // Maximum concentration (single asset)
  const minHHI = 1 / positions.length // Perfect diversification
  
  // Normalize HHI to 0-100 scale (inverted so higher = more diversified)
  const score = ((maxHHI - hhi) / (maxHHI - minHHI)) * 100
  
  return Math.max(0, Math.min(100, score))
}

/**
 * Format days to a human-readable string
 */
export function formatHoldingPeriod(days: number): string {
  if (days < 30) {
    return `${Math.round(days)} days`
  } else if (days < 365) {
    const months = Math.round(days / 30)
    return `${months} month${months !== 1 ? 's' : ''}`
  } else {
    const years = (days / 365).toFixed(1)
    return `${years} year${years !== '1.0' ? 's' : ''}`
  }
}

/**
 * Format percentage with appropriate color class
 */
export function getPercentageColorClass(value: number | null): string {
  if (value === null) return 'text-neutral-600 dark:text-neutral-400'
  if (value > 0) return 'text-emerald-600 dark:text-emerald-400'
  if (value < 0) return 'text-red-600 dark:text-red-400'
  return 'text-neutral-600 dark:text-neutral-400'
}
