import { request } from './client'
import type { PendingDividendDTO, PendingDividendStatsDTO, PortfolioPendingDividendStatsDTO, TransactionDTO } from './types'

// ============================================================================
// Pending Dividends (Auto-fetched from yfinance)
// ============================================================================

export async function getPendingDividends(
  status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED',
  portfolioId?: number
) {
  const params = new URLSearchParams()
  if (status) params.append('status', status)
  if (portfolioId) params.append('portfolio_id', portfolioId.toString())
  const queryString = params.toString()
  return request<PendingDividendDTO[]>(
    `/dividends/pending${queryString ? `?${queryString}` : ''}`
  )
}

export async function getPendingDividendStats() {
  return request<PendingDividendStatsDTO>('/dividends/pending/stats')
}

export async function getPortfolioPendingDividends(
  portfolioId: number,
  status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'
) {
  const params = status ? `?status=${status}` : ''
  return request<PendingDividendDTO[]>(
    `/dividends/${portfolioId}/pending${params}`
  )
}

export async function getPortfolioPendingDividendStats(portfolioId: number) {
  return request<PortfolioPendingDividendStatsDTO>(
    `/dividends/${portfolioId}/pending/stats`
  )
}

export async function fetchDividendsForPortfolio(
  portfolioId: number,
  lookbackDays?: number,
  lookaheadDays?: number
) {
  const params = new URLSearchParams()
  if (lookbackDays) params.append('lookback_days', lookbackDays.toString())
  if (lookaheadDays) params.append('lookahead_days', lookaheadDays.toString())
  const queryString = params.toString()
  return request<PendingDividendDTO[]>(
    `/dividends/${portfolioId}/fetch${queryString ? `?${queryString}` : ''}`,
    { method: 'POST' }
  )
}

export async function acceptPendingDividend(
  dividendId: number,
  data: {
    tax_amount?: number
    notes?: string
    override_gross_amount?: number
    override_shares?: number
  } = {}
) {
  return request<TransactionDTO>(
    `/dividends/pending/${dividendId}/accept`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  )
}

export async function rejectPendingDividend(dividendId: number) {
  return request<void>(`/dividends/pending/${dividendId}/reject`, {
    method: 'POST',
  })
}

export async function bulkAcceptPendingDividends(
  dividendIds: number[],
  taxRate?: number
) {
  return request<TransactionDTO[]>('/dividends/pending/bulk-accept', {
    method: 'POST',
    body: JSON.stringify({
      dividend_ids: dividendIds,
      tax_rate: taxRate,
    }),
  })
}

export async function bulkRejectPendingDividends(dividendIds: number[]) {
  return request<void>('/dividends/pending/bulk-reject', {
    method: 'POST',
    body: JSON.stringify({ dividend_ids: dividendIds }),
  })
}

export async function deletePendingDividend(dividendId: number) {
  return request<void>(`/dividends/pending/${dividendId}`, {
    method: 'DELETE',
  })
}
