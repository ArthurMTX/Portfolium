/* eslint-disable @typescript-eslint/no-explicit-any */
import { request } from './client'
import type { AssetThemeClassificationDTO, AssetThemeClassifyResponseDTO, AssetThemeTaxonomySuggestionDTO, AssetThemeTaxonomySuggestionStatsDTO, AssetThemeTaxonomySuggestionStatus, DeleteInvalidProviderAssetsResponseDTO, DistributionItemDTO, IndustryItemDTO, MiniLMBenchmarkReportDTO, ThemeDistributionItemDTO, ThemeGapAnalysisDTO, ThemeRegistryDTO } from './types'

// Assets
export async function getAssets(query?: string) {
  const params = query ? `?query=${encodeURIComponent(query)}` : ''
  return request<any[]>(`/assets${params}`)
}

export async function getAssetThemes(assetId: number) {
  return request<AssetThemeClassificationDTO>(`/assets/${assetId}/themes`)
}

export async function refreshAssetThemes(assetId: number) {
  return request<AssetThemeClassificationDTO>(`/assets/${assetId}/themes/refresh`, {
    method: 'POST',
  })
}

export async function getThemeRegistry() {
  return request<ThemeRegistryDTO>('/assets/themes/registry')
}

export async function getClassificationBenchmark(params?: {
  limit?: number
  offset?: number
  symbols?: string
  retrieved_candidate_limit?: number
}) {
  const query = new URLSearchParams()
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.offset) query.set('offset', String(params.offset))
  if (params?.symbols) query.set('symbols', params.symbols)
  if (params?.retrieved_candidate_limit) {
    query.set('retrieved_candidate_limit', String(params.retrieved_candidate_limit))
  }
  const queryString = query.toString()
  return request<MiniLMBenchmarkReportDTO>(
    `/assets/themes/classification-benchmark${queryString ? `?${queryString}` : ''}`,
    { timeout: 120000 }
  )
}

export async function getThemeGapAnalysis() {
  return request<ThemeGapAnalysisDTO>('/assets/themes/gap-analysis')
}

export async function getThemeTaxonomySuggestions(params?: {
  status?: AssetThemeTaxonomySuggestionStatus | 'all'
  limit?: number
  offset?: number
  search?: string
}) {
  const query = new URLSearchParams()
  query.set('status', params?.status || 'pending')
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.offset) query.set('offset', String(params.offset))
  if (params?.search) query.set('search', params.search)
  return request<AssetThemeTaxonomySuggestionDTO[]>(
    `/assets/themes/taxonomy-suggestions?${query.toString()}`
  )
}

export async function getThemeTaxonomySuggestionStats() {
  return request<AssetThemeTaxonomySuggestionStatsDTO>('/assets/themes/taxonomy-suggestions/stats')
}

export async function updateThemeTaxonomySuggestion(
  suggestionId: number,
  payload: { status: AssetThemeTaxonomySuggestionStatus; reviewer_note?: string | null }
) {
  return request<AssetThemeTaxonomySuggestionDTO>(`/assets/themes/taxonomy-suggestions/${suggestionId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function classifyAssetThemes(payload: { symbols: string[]; force: boolean; missing_only: boolean }) {
  return request<AssetThemeClassifyResponseDTO>('/assets/themes/classify', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getHeldAssets(portfolioId?: number) {
  const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
  return request<any[]>(`/assets/held/all${params}`)
}

export async function getSoldAssets(portfolioId?: number) {
  const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
  return request<any[]>(`/assets/sold/all${params}`)
}

export async function getAssetDatabaseList() {
  return request<any[]>('/assets/database/list')
}

export async function deleteInvalidProviderAssets(payload?: { dryRun?: boolean; symbols?: string[] }) {
  return request<DeleteInvalidProviderAssetsResponseDTO>(
    '/assets/database/invalid-provider',
    {
      method: 'POST',
      body: JSON.stringify({
        dry_run: payload?.dryRun !== false,
        symbols: payload?.symbols,
      }),
    }
  )
}

export async function enrichAsset(assetId: number) {
  return request<any>(`/assets/enrich/${assetId}`, {
    method: 'POST',
  })
}

export async function enrichAllAssets() {
  return request<any>('/assets/enrich/all', {
    method: 'POST',
  })
}

export async function setAssetMetadataOverrides(assetId: number, overrides: {
  sector_override?: string | null
  industry_override?: string | null
  country_override?: string | null
}) {
  return request<any>(`/assets/${assetId}/metadata-overrides`, {
    method: 'PATCH',
    body: JSON.stringify(overrides),
  })
}

export async function searchTicker(query: string) {
  return request<Array<{ symbol: string; name: string; type?: string; exchange?: string }>>(`/assets/search_ticker?query=${encodeURIComponent(query)}`)
}

export async function searchAssets(query: string, cryptoOnly: boolean = false) {
  const params = new URLSearchParams({ query })
  if (cryptoOnly) params.append('crypto_only', 'true')
  return request<Array<{ symbol: string; name: string; type?: string }>>(`/assets/search?${params.toString()}`)
}

export async function getAssetBySymbol(symbol: string) {
  return request<{ id: number; symbol: string; name: string; currency: string }>(`/assets/by-symbol/${encodeURIComponent(symbol)}`)
}

export async function getPriceQuote(symbol: string, targetCurrency?: string) {
  const params = targetCurrency ? `?target_currency=${encodeURIComponent(targetCurrency)}` : ''
  return request<{ symbol: string; price: number; currency: string }>(`/prices/quote/${encodeURIComponent(symbol)}${params}`)
}

export async function createAsset(asset: {
  symbol: string
  name?: string
  currency?: string
  class?: string
  asset_type?: string
}) {
  return request<any>('/assets', {
    method: 'POST',
    body: JSON.stringify(asset),
  })
}

export async function getAssetSplitHistory(assetId: number, portfolioId?: number) {
  const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
  return request<Array<{
    id: number
    tx_date: string
    metadata: { split?: string;[key: string]: unknown }
    notes: string | null
  }>>(`/assets/${assetId}/splits${params}`)
}

export async function getAssetTransactionHistory(assetId: number, portfolioId?: number) {
  const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
  return request<Array<{
    id: number
    tx_date: string
    type: string
    quantity: number
    adjusted_quantity: number
    price: number | null
    fees: number | null
    portfolio_name: string
    notes: string | null
  }>>(`/assets/${assetId}/transactions${params}`)
}

export async function getAssetPriceHistory(assetId: number, period: string = '1M') {
  return request<{
    asset_id: number
    symbol: string
    name: string | null
    currency: string
    period: string
    start_date: string
    end_date: string
    data_points: number
    prices: Array<{
      date: string
      price: number
      volume: number | null
      source: string
    }>
  }>(`/assets/${assetId}/prices?period=${encodeURIComponent(period)}`)
}

export async function backfillAssetPrices(assetId: number, options?: { days?: number; allTime?: boolean }) {
  const params = new URLSearchParams()
  if (options?.days !== undefined) params.set('days', String(options.days))
  if (options?.allTime) params.set('all_time', 'true')
  const query = params.toString()
  return request<{
    asset_id: number
    symbol: string
    start_date: string
    end_date: string
    prices_added: number
    message: string
  }>(`/assets/${assetId}/backfill-prices${query ? `?${query}` : ''}`, {
    method: 'POST',
  })
}

// Asset Distribution endpoints
export async function getSectorsDistribution(portfolioId?: number) {
  const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
  return request<DistributionItemDTO[]>(`/assets/distribution/sectors${params}`)
}

export async function getCountriesDistribution(portfolioId?: number) {
  const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
  return request<DistributionItemDTO[]>(`/assets/distribution/countries${params}`)
}

export async function getTypesDistribution(portfolioId?: number) {
  const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
  return request<DistributionItemDTO[]>(`/assets/distribution/types${params}`)
}

export async function getMarketCapsDistribution(portfolioId?: number) {
  const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
  return request<DistributionItemDTO[]>(`/assets/distribution/market-caps${params}`)
}

export async function getThemesDistribution(portfolioId: number) {
  return request<ThemeDistributionItemDTO[]>(`/assets/themes/distribution?portfolio_id=${portfolioId}`)
}

export async function getSectorIndustriesDistribution(sectorName: string, portfolioId?: number) {
  const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
  return request<DistributionItemDTO[]>(`/assets/distribution/sectors/${encodeURIComponent(sectorName)}/industries${params}`)
}

export async function getIndustriesList(portfolioId?: number) {
  const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
  return request<IndustryItemDTO[]>(`/assets/distribution/industries${params}`)
}

export async function getAssetHealth(assetId: number) {
  return request<{
    asset_id: number
    symbol: string
    name: string | null
    status: string
    total_price_records: number
    first_transaction_date: string | null
    first_transaction_actual: string | null
    data_range: {
      start: string
      end: string
      days: number
    } | null
    coverage: {
      expected_trading_days: number
      actual_data_points: number
      coverage_pct: number
      missing_days: number
      gap_count: number
    }
    sources: Record<string, number>
    gaps: string[] | { total: number; sample: string[]; message: string }
    recommendations: string[]
  }>(`/assets/${assetId}/health`)
}

export async function getYFinanceData(assetId: number) {
  return request<{
    asset_id: number
    symbol: string
    name: string | null
    fetched_at: string
    info: Record<string, unknown>
    recent_history: unknown
    calendar: unknown
    recommendations: unknown
    institutional_holders: unknown
    major_holders: unknown
    dividends: unknown
    splits: unknown
    actions: unknown
  }>(`/assets/${assetId}/yfinance`)
}

export async function getYFinanceDataBySymbol(symbol: string) {
  return request<{
    asset_id: number | null
    symbol: string
    name: string | null
    in_database: boolean
    fetched_at: string
    info: Record<string, unknown>
    recent_history: unknown
    calendar: unknown
    recommendations: unknown
    institutional_holders: unknown
    major_holders: unknown
    dividends: unknown
    splits: unknown
    actions: unknown
  }>(`/assets/0/yfinance?symbol=${encodeURIComponent(symbol)}`)
}
