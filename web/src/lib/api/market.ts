import { request } from './client'
import type { MarketStatusDTO, PriceQuote } from './types'

// Prices
export async function getPrices(symbols: string[]) {
  const symbolsParam = symbols.join(',')
  return request<Record<string, unknown>>(`/prices?symbols=${symbolsParam}`)
}

export async function refreshPrices(portfolioId: number) {
  return request<{ refreshed_count: number }>(
    `/prices/refresh?portfolio_id=${portfolioId}`,
    { method: 'POST' }
  )
}

// Market Status
export async function getMarketStatus(signal?: AbortSignal) {
  return request<MarketStatusDTO>('/health', { signal })
}

// Market Indices
export async function getMarketIndices(signal?: AbortSignal) {
  const symbols = [
    '^GSPC', '^DJI', '^IXIC', '^GSPTSE',
    '^FTSE', '^GDAXI', '^FCHI', 'FTSEMIB.MI',
    '^N225', '^HSI', '000001.SS', '^AXJO'
  ].join(',')

  const response = await request<Record<string, PriceQuote>>(`/prices/indices?symbols=${symbols}`, { signal })

  // Normalize the response to include percent_change
  const normalized: Record<string, PriceQuote> = {}
  for (const [symbol, data] of Object.entries(response)) {
    normalized[symbol] = {
      ...data,
      current_price: data.price,
      percent_change: data.daily_change_pct
    }
  }

  return normalized
}

// ============================================================================
// Market Data
// ============================================================================

export async function getStockMarketSentiment() {
  return request<{
    score: number
    rating: string
    previous_close: number
    timestamp: string
  }>('/market/sentiment/stock')
}

export async function getCryptoMarketSentiment() {
  return request<{
    score: number
    rating: string
    previous_value: number | null
    timestamp: string
  }>('/market/sentiment/crypto')
}

export async function getMarketSentiment(marketType: 'stock' | 'crypto') {
  return request<{
    score: number
    rating: string
    previous_close?: number
    previous_value?: number | null
    timestamp: string
  }>(`/market/sentiment/${marketType}`)
}

export async function getVIXIndex() {
  return request<{
    price: number
    change: number | null
    change_pct: number | null
    previous_close: number | null
    timestamp: string
  }>('/market/vix')
}

export async function getTNXIndex() {
  return request<{
    price: number
    change: number | null
    change_pct: number | null
    previous_close: number | null
    timestamp: string
  }>('/market/tnx')
}

export async function getDXYIndex() {
  return request<{
    price: number
    change: number | null
    change_pct: number | null
    previous_close: number | null
    timestamp: string
  }>('/market/dxy')
}
