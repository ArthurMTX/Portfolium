/* eslint-disable @typescript-eslint/no-explicit-any */
import { request, API_BASE_URL, getAuthHeaders } from './client'
import type { CsvImportPreviewResultDTO } from './types'

// Transactions
export async function getTransactions(
  portfolioId: number,
  filters?: {
    asset_id?: number
    tx_type?: string
    date_from?: string
    date_to?: string
  }
) {
  const params = new URLSearchParams()
  if (filters?.asset_id) params.append('asset_id', filters.asset_id.toString())
  if (filters?.tx_type) params.append('tx_type', filters.tx_type)
  if (filters?.date_from) params.append('date_from', filters.date_from)
  if (filters?.date_to) params.append('date_to', filters.date_to)

  const queryString = params.toString()
  return request<any[]>(
    `/portfolios/${portfolioId}/transactions${queryString ? `?${queryString}` : ''}`
  )
}

export async function addPositionTransaction(
  portfolioId: number,
  ticker: string,
  txDate: string,
  txType: string,
  quantity: number
) {
  const params = new URLSearchParams({
    ticker,
    tx_date: txDate,
    tx_type: txType,
    quantity: quantity.toString(),
  })
  return request<any>(
    `/portfolios/${portfolioId}/add_position_transaction?${params.toString()}`,
    { method: 'POST' }
  )
}

export async function fetchPriceForDate(
  portfolioId: number,
  ticker: string,
  txDate: string
): Promise<{
  price: number
  original_price: number
  asset_currency: string
  portfolio_currency: string
  converted: boolean
}> {
  const params = new URLSearchParams({
    ticker,
    tx_date: txDate,
  })
  return request(
    `/portfolios/${portfolioId}/fetch_price?${params.toString()}`
  )
}

export async function getFxRateForDate(
  portfolioId: number,
  fromCurrency: string,
  toCurrency: string,
  asOfDate: string
): Promise<{
  portfolio_id: number
  from_currency: string
  to_currency: string
  as_of_date: string
  rate: number
  converted: boolean
}> {
  const params = new URLSearchParams({
    from_currency: fromCurrency,
    to_currency: toCurrency,
    as_of_date: asOfDate,
  })
  return request(`/portfolios/${portfolioId}/fx_rate?${params.toString()}`)
}

export async function getPositionQuantityAtDate(
  portfolioId: number,
  assetId: number,
  asOfDate: string
): Promise<{
  portfolio_id: number
  asset_id: number
  as_of_date: string
  quantity: number
  asset_currency: string
}> {
  const params = new URLSearchParams({
    as_of_date: asOfDate,
  })
  return request(
    `/portfolios/${portfolioId}/positions/${assetId}/quantity_at_date?${params.toString()}`
  )
}

export async function createTransaction(portfolioId: number, transaction: any) {
  return request<any>(`/portfolios/${portfolioId}/transactions`, {
    method: 'POST',
    body: JSON.stringify(transaction),
  })
}

export async function updateTransaction(portfolioId: number, transactionId: number, transaction: any) {
  return request<any>(`/portfolios/${portfolioId}/transactions/${transactionId}`, {
    method: 'PUT',
    body: JSON.stringify(transaction),
  })
}

export async function deleteTransaction(portfolioId: number, transactionId: number) {
  return request<void>(`/portfolios/${portfolioId}/transactions/${transactionId}`, {
    method: 'DELETE',
  })
}

export async function createConversion(portfolioId: number, conversion: {
  tx_date: string
  from_asset_id: number
  from_quantity: number
  from_price: number
  to_asset_id: number
  to_quantity: number
  to_price: number
  fees?: number
  currency?: string
  notes?: string | null
}) {
  return request<{
    conversion_id: string
    conversion_rate: string
    from_transaction: any
    to_transaction: any
  }>(`/portfolios/${portfolioId}/conversions`, {
    method: 'POST',
    body: JSON.stringify(conversion),
  })
}

export async function getTransactionMetrics(portfolioId: number, grouping: 'monthly' | 'yearly' = 'monthly') {
  return request<{
    grouping: string
    currency: string
    metrics: Array<{
      month?: number
      year: number
      buy_sum_total_price: number
      buy_count: number
      buy_max_total_price: number
      buy_min_total_price: number
      buy_avg_total_price: number
      buy_sum_fees: number
      sell_sum_total_price: number
      sell_count: number
      sell_max_total_price: number
      sell_min_total_price: number
      sell_avg_total_price: number
      sell_sum_fees: number
      diff_buy_sell: number
    }>
  }>(`/portfolios/${portfolioId}/transactions/metrics?grouping=${grouping}`)
}

export async function importCsv(portfolioId: number, file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(
    `${API_BASE_URL}/portfolios/import/csv?portfolio_id=${portfolioId}`,
    {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
      },
      body: formData,
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(JSON.stringify(error))
  }

  return response.json()
}

export async function previewImportCsv(portfolioId: number, file: File): Promise<CsvImportPreviewResultDTO> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(
    `${API_BASE_URL}/portfolios/import/csv/preview?portfolio_id=${portfolioId}`,
    {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
      },
      body: formData,
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(JSON.stringify(error))
  }

  return response.json()
}
