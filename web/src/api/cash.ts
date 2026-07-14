import { request } from '@/api/client'
import type {
  CashActivationPayload,
  CashActivationPreviewDTO,
  CashActivationResultDTO,
  CashBalancesResponseDTO,
  CashMode,
  CashMovementCreatePayload,
  CashMovementListDTO,
  CashMovementResponseDTO,
  CashMovementUpdatePayload,
  CashSummaryDTO,
  CashWarningDTO,
  FxConversionPayload,
  FxConversionResponseDTO,
  PortfolioDTO,
} from '@/api/types'

// Cash tracking (optional per-portfolio ledger)

export async function getCashBalances(portfolioId: number) {
  return request<CashBalancesResponseDTO>(`/portfolios/${portfolioId}/cash/balances`)
}

export async function getCashSummary(portfolioId: number) {
  return request<CashSummaryDTO>(`/portfolios/${portfolioId}/cash/summary`)
}

export async function getCashMovements(
  portfolioId: number,
  filters?: {
    currency?: string
    type?: string
    date_from?: string
    date_to?: string
    skip?: number
    limit?: number
  }
) {
  const params = new URLSearchParams()
  if (filters?.currency) params.append('currency', filters.currency)
  if (filters?.type) params.append('type', filters.type)
  if (filters?.date_from) params.append('date_from', filters.date_from)
  if (filters?.date_to) params.append('date_to', filters.date_to)
  if (filters?.skip) params.append('skip', filters.skip.toString())
  if (filters?.limit) params.append('limit', filters.limit.toString())
  const queryString = params.toString()
  return request<CashMovementListDTO>(
    `/portfolios/${portfolioId}/cash/movements${queryString ? `?${queryString}` : ''}`
  )
}

export async function createCashMovement(
  portfolioId: number,
  payload: CashMovementCreatePayload
) {
  return request<CashMovementResponseDTO>(`/portfolios/${portfolioId}/cash/movements`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateCashMovement(
  portfolioId: number,
  movementId: number,
  payload: CashMovementUpdatePayload
) {
  return request<CashMovementResponseDTO>(
    `/portfolios/${portfolioId}/cash/movements/${movementId}`,
    { method: 'PUT', body: JSON.stringify(payload) }
  )
}

export async function deleteCashMovement(portfolioId: number, movementId: number) {
  return request<{ deleted: number; warnings: CashWarningDTO[] }>(
    `/portfolios/${portfolioId}/cash/movements/${movementId}`,
    { method: 'DELETE' }
  )
}

export async function createFxConversion(portfolioId: number, payload: FxConversionPayload) {
  return request<FxConversionResponseDTO>(`/portfolios/${portfolioId}/cash/fx-conversions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateFxConversion(
  portfolioId: number,
  conversionId: string,
  payload: FxConversionPayload
) {
  return request<FxConversionResponseDTO>(
    `/portfolios/${portfolioId}/cash/fx-conversions/${conversionId}`,
    { method: 'PUT', body: JSON.stringify(payload) }
  )
}

export async function deleteFxConversion(portfolioId: number, conversionId: string) {
  return request<{ deleted: string; warnings: CashWarningDTO[] }>(
    `/portfolios/${portfolioId}/cash/fx-conversions/${conversionId}`,
    { method: 'DELETE' }
  )
}

export async function previewCashActivation(
  portfolioId: number,
  payload: CashActivationPayload
) {
  return request<CashActivationPreviewDTO>(
    `/portfolios/${portfolioId}/cash/activation/preview`,
    { method: 'POST', body: JSON.stringify(payload) }
  )
}

export async function applyCashActivation(
  portfolioId: number,
  payload: CashActivationPayload
) {
  return request<CashActivationResultDTO>(`/portfolios/${portfolioId}/cash/activation`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function setCashMode(portfolioId: number, mode: CashMode) {
  return request<PortfolioDTO>(`/portfolios/${portfolioId}/cash/mode`, {
    method: 'PUT',
    body: JSON.stringify({ mode }),
  })
}

export async function wipeCashLedger(portfolioId: number) {
  return request<void>(`/portfolios/${portfolioId}/cash/ledger`, {
    method: 'DELETE',
    body: JSON.stringify({ confirm: 'DELETE' }),
  })
}
