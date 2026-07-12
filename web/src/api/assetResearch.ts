import { request } from '@/api/client'
import type { AssetEtfCompositionDTO, AssetInvestmentNoteDTO, AssetInvestmentNoteUpdate, AssetResearchBusinessDTO, AssetResearchFundamentalsDTO, AssetResearchMetadataDTO, AssetResearchOwnershipDTO, AssetResearchRelativePerformanceDTO, AssetResearchRiskDTO, AssetResearchSummaryDTO, AssetThemeClassificationDTO } from '@/api/types'

export async function getAssetResearchSummary(symbol: string) {
  return request<AssetResearchSummaryDTO>(`/assets/research/${encodeURIComponent(symbol)}/summary`)
}

export async function getAssetResearchFundamentals(symbol: string) {
  return request<AssetResearchFundamentalsDTO>(`/assets/research/${encodeURIComponent(symbol)}/fundamentals`)
}

export async function getAssetResearchBusiness(symbol: string) {
  return request<AssetResearchBusinessDTO>(`/assets/research/${encodeURIComponent(symbol)}/business`)
}

export async function getAssetResearchOwnership(symbol: string) {
  return request<AssetResearchOwnershipDTO>(`/assets/research/${encodeURIComponent(symbol)}/ownership`)
}

export async function getAssetResearchThemes(symbol: string) {
  return request<AssetThemeClassificationDTO>(`/assets/research/${encodeURIComponent(symbol)}/themes`)
}

export async function getAssetResearchRisk(symbol: string) {
  return request<AssetResearchRiskDTO>(`/assets/research/${encodeURIComponent(symbol)}/risk`)
}

export async function getAssetResearchPerformance(symbol: string) {
  return request<AssetResearchRelativePerformanceDTO>(`/assets/research/${encodeURIComponent(symbol)}/performance`)
}

export async function getAssetResearchMetadata(symbol: string) {
  return request<AssetResearchMetadataDTO>(`/assets/research/${encodeURIComponent(symbol)}/metadata`)
}

export async function getAssetEtfComposition(symbol: string, portfolioId?: number | null) {
  const params = new URLSearchParams()
  if (portfolioId) params.set('portfolio_id', String(portfolioId))
  const query = params.toString()
  return request<AssetEtfCompositionDTO>(`/assets/${encodeURIComponent(symbol)}/etf-composition${query ? `?${query}` : ''}`)
}

export async function getAssetInvestmentNote(assetId: number) {
  return request<AssetInvestmentNoteDTO | null>(`/assets/${assetId}/investment-note`)
}

export async function saveAssetInvestmentNote(assetId: number, data: AssetInvestmentNoteUpdate) {
  return request<AssetInvestmentNoteDTO>(`/assets/${assetId}/investment-note`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteAssetInvestmentNote(assetId: number) {
  return request<void>(`/assets/${assetId}/investment-note`, {
    method: 'DELETE',
  })
}
