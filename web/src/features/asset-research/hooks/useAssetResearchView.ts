import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api, {
  type AssetResearchBusinessDTO,
  type AssetResearchFundamentalsDTO,
  type AssetResearchMetadataDTO,
  type AssetResearchRelativePerformanceDTO,
  type AssetResearchRiskDTO,
  type AssetThemeClassificationDTO,
} from '@/api'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import { isEquityAsset, isEtfAsset } from '@/features/assets/lib/assetResearchMetricBuilders'
import type { AssetResearchViewTransaction } from '@/features/asset-research/types'

export function useAssetResearchView(symbol: string) {
  const normalizedSymbol = symbol.trim().toUpperCase()
  const {
    portfolios,
    activePortfolioId,
    setPortfolios,
    setActivePortfolio,
    dataVersion,
  } = usePortfolioStore()

  const portfoliosQuery = useQuery({
    queryKey: ['portfolios'],
    queryFn: () => api.getPortfolios(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  useEffect(() => {
    if (!portfoliosQuery.data) return
    setPortfolios(portfoliosQuery.data)
    if (portfoliosQuery.data.length > 0 && !activePortfolioId) {
      setActivePortfolio(portfoliosQuery.data[0].id)
    }
  }, [
    activePortfolioId,
    portfoliosQuery.data,
    setActivePortfolio,
    setPortfolios,
  ])

  const summaryQuery = useQuery({
    queryKey: ['asset-research-summary', normalizedSymbol],
    queryFn: () => api.getAssetResearchSummary(normalizedSymbol),
    enabled: Boolean(normalizedSymbol),
    staleTime: 60 * 1000,
  })

  const asset = summaryQuery.data?.asset
  const assetId = asset?.id
  const isEquity = asset ? isEquityAsset(asset) : false
  const isEtf = asset ? isEtfAsset(asset) : false

  const fundamentalsQuery = useQuery<AssetResearchFundamentalsDTO>({
    queryKey: ['asset-research-fundamentals', normalizedSymbol],
    queryFn: () => api.getAssetResearchFundamentals(normalizedSymbol),
    enabled: Boolean(assetId),
    staleTime: 5 * 60 * 1000,
  })

  const businessQuery = useQuery<AssetResearchBusinessDTO>({
    queryKey: ['asset-research-business', normalizedSymbol],
    queryFn: () => api.getAssetResearchBusiness(normalizedSymbol),
    enabled: Boolean(assetId && !isEtf),
    staleTime: 24 * 60 * 60 * 1000,
  })

  const themesQuery = useQuery<AssetThemeClassificationDTO>({
    queryKey: ['asset-research-themes', normalizedSymbol],
    queryFn: () => api.getAssetResearchThemes(normalizedSymbol),
    enabled: Boolean(assetId && isEquity),
    staleTime: 24 * 60 * 60 * 1000,
  })

  const riskQuery = useQuery<AssetResearchRiskDTO>({
    queryKey: ['asset-research-risk', normalizedSymbol],
    queryFn: () => api.getAssetResearchRisk(normalizedSymbol),
    enabled: Boolean(assetId),
    staleTime: 5 * 60 * 1000,
  })

  const performanceQuery = useQuery<AssetResearchRelativePerformanceDTO>({
    queryKey: ['asset-research-performance', normalizedSymbol],
    queryFn: () => api.getAssetResearchPerformance(normalizedSymbol),
    enabled: Boolean(assetId),
    staleTime: 5 * 60 * 1000,
  })

  const metadataQuery = useQuery<AssetResearchMetadataDTO>({
    queryKey: ['asset-research-metadata', normalizedSymbol],
    queryFn: () => api.getAssetResearchMetadata(normalizedSymbol),
    enabled: Boolean(assetId),
    staleTime: 5 * 60 * 1000,
  })

  const positionQuery = useQuery({
    queryKey: ['portfolio-position', activePortfolioId, assetId, dataVersion],
    queryFn: () => api.getPortfolioPosition(activePortfolioId!, assetId!),
    enabled: Boolean(activePortfolioId && assetId),
    staleTime: 60 * 1000,
  })

  const portfolioMetricsQuery = useQuery({
    queryKey: ['portfolio-metrics', activePortfolioId, dataVersion],
    queryFn: () => api.getPortfolioMetrics(activePortfolioId!),
    enabled: Boolean(activePortfolioId),
    staleTime: 60 * 1000,
  })

  const transactionsQuery = useQuery<AssetResearchViewTransaction[]>({
    queryKey: ['asset-position-transactions', activePortfolioId, assetId, dataVersion],
    queryFn: async () =>
      (await api.getTransactions(activePortfolioId!, { asset_id: assetId })) as AssetResearchViewTransaction[],
    enabled: Boolean(activePortfolioId && assetId),
    staleTime: 60 * 1000,
  })

  const noteQuery = useQuery({
    queryKey: ['asset-investment-note', assetId],
    queryFn: () => api.getAssetInvestmentNote(assetId!),
    enabled: Boolean(assetId),
    staleTime: 5 * 60 * 1000,
  })

  const watchlistQuery = useQuery({
    queryKey: ['watchlist-item-by-asset', assetId],
    queryFn: () => api.getWatchlistItemByAsset(assetId!),
    enabled: Boolean(assetId),
    staleTime: 60 * 1000,
  })

  const marketStatusQuery = useQuery({
    queryKey: ['market-status'],
    queryFn: ({ signal }) => api.getMarketStatus(signal),
    staleTime: 60 * 1000,
  })

  return {
    normalizedSymbol,
    portfolios,
    activePortfolioId,
    activePortfolio: portfolios.find((portfolio) => portfolio.id === activePortfolioId),
    summaryQuery,
    fundamentalsQuery,
    businessQuery,
    themesQuery,
    riskQuery,
    performanceQuery,
    metadataQuery,
    positionQuery,
    portfolioMetricsQuery,
    transactionsQuery,
    noteQuery,
    watchlistQuery,
    marketStatusQuery,
    isEquity,
    isEtf,
  }
}
