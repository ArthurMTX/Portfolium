import type {
  DistributionItemDTO,
  PortfolioHistoryPointDTO,
  PositionDTO,
  ThemeDistributionItemDTO,
} from '@/api'

export type DashboardPeriod = '1W' | '1M' | '3M' | 'YTD' | '1Y' | 'ALL'
export type ExposureDimension = 'sector' | 'theme' | 'type' | 'country'

export interface DashboardOverviewMetrics {
  total_value: number
  daily_change_value?: number | null
  daily_change_pct?: number | null
  total_unrealized_pnl: number
  total_unrealized_pnl_pct: number
  total_realized_pnl: number
  total_dividends: number
  total_fees: number
}

export interface DashboardOverviewTransaction {
  id: number
  type: string
  tx_date: string
  quantity: number
  price: number
  fees: number
  notes?: string | null
  asset?: {
    id: number
    symbol: string
    name: string | null
    asset_type?: string | null
    currency?: string | null
  } | null
}

export interface DashboardOverviewBatchData {
  metrics?: DashboardOverviewMetrics
  positions?: PositionDTO[]
  transactions?: DashboardOverviewTransaction[]
  asset_allocation?: DistributionItemDTO[]
  sector_allocation?: DistributionItemDTO[]
  country_allocation?: DistributionItemDTO[]
  theme_allocation?: ThemeDistributionItemDTO[]
  performance_history?: Partial<Record<DashboardPeriod, PortfolioHistoryPointDTO[] | null>>
}

export interface AttributionItem {
  key: string
  label: string
  value: number
  estimated: boolean
  assetType?: string | null
  assetName?: string | null
}

export interface ExposureItem {
  key: string
  label: string
  value: number
  percentage: number
  count?: number
}

export interface ExposureResult {
  items: ExposureItem[]
  isCompleteWhole: boolean
  totalPercentage: number
}
