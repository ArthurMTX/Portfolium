
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * API client for Portfolium backend
 */

import type {
  DashboardLayoutDTO,
  DashboardLayoutCreate,
  DashboardLayoutUpdate,
  DashboardLayoutExport
} from '../types/dashboard'

// Use /api prefix so requests go through proxy (both dev and production)
// Vite dev proxy and nginx will forward /api/* to the backend
const API_BASE_URL = '/api'

interface ApiError {
  detail: string | { errors: string[]; imported: number }
}

// Auth Types
interface UserDTO {
  id: number
  email: string
  username: string
  full_name: string | null
  is_active: boolean
  is_verified: boolean
  is_superuser: boolean
  is_admin: boolean
  created_at: string
  last_login: string | null
  preferred_language: string
  daily_change_notifications_enabled: boolean
  transaction_notifications_enabled: boolean
  daily_report_enabled: boolean
  ath_atl_notifications_enabled: boolean
  push_notifications_enabled: boolean
  totp_enabled: boolean
}

interface LoginResponseDTO {
  access_token: string
  token_type: string
  user: UserDTO
}

// Two-Factor Authentication Types
export interface TwoFactorSetupResponse {
  secret: string
  qr_code: string
  backup_codes: string[]
}

export interface TwoFactorStatusResponse {
  enabled: boolean
  backup_codes_remaining: number
}

// Types aligning with store shapes
interface PortfolioDTO {
  id: number
  name: string
  base_currency: string
  description: string | null
  is_public: boolean
  share_token: string
  created_at: string
}

export interface CsvImportPreviewIssueDTO {
  row_num: number | null
  message: string
}

export interface CsvImportPreviewDuplicateDTO {
  row_num: number
  message: string
  scope: 'csv' | 'database' | string
}

export interface CsvImportPreviewResultDTO {
  total_rows: number
  valid_count: number
  error_count: number
  warning_count: number
  duplicate_count: number
  summary_by_type: Record<string, number>
  errors: CsvImportPreviewIssueDTO[]
  warnings: CsvImportPreviewIssueDTO[]
  duplicates: CsvImportPreviewDuplicateDTO[]
}

export interface PositionDTO {
  asset_id: number
  symbol: string
  name: string | null
  asset_type?: string | null
  quantity: number
  avg_cost: number
  current_price: number | null
  market_value: number | null
  cost_basis: number
  unrealized_pnl: number | null
  unrealized_pnl_pct: number | null
  daily_change_pct: number | null
  breakeven_gain_pct?: number | null
  breakeven_target_price?: number | null
  // Advanced metrics
  distance_to_ath_pct?: number | null
  avg_buy_zone_pct?: number | null
  personal_drawdown_pct?: number | null
  local_ath_price?: number | null
  local_ath_date?: string | null
  vol_contribution_pct?: number | null
  cost_to_average_down?: number | null
  ath_price?: number | null // ATH in portfolio currency
  ath_price_native?: number | null // ATH in native currency
  ath_currency?: string | null // Native currency of the ATH
  ath_date?: string | null
  // Relative performance vs sector
  relative_perf_30d?: number | null
  relative_perf_90d?: number | null
  relative_perf_ytd?: number | null
  relative_perf_1y?: number | null
  sector?: string | null
  sector_etf?: string | null
  currency: string
  last_updated: string | null
  themes?: AssetThemeDTO[]
}

export interface AssetThemeDTO {
  label: string
  confidence: number
  weight?: number | null
  evidence: string[]
  tier?: 'primary' | 'secondary' | null
  children?: AssetSubthemeDTO[]
}

export interface AssetSubthemeDTO {
  label: string
  confidence: number
  evidence?: string[]
}

export interface AssetThemeClassificationDTO {
  id: number | null
  asset_id: number
  themes: AssetThemeDTO[]
  method: 'keyword' | 'gpt' | 'manual'
  model: string | null
  source?: 'minilm' | 'gemini' | 'manual' | null
  model_name?: string | null
  source_hash: string | null
  generated_at: string | null
  updated_at: string | null
}

export interface AssetThemeTaxonomyGapDTO {
  hasGap: boolean
  reason?: string | null
  suggestedTheme?: string | null
  suggestedSubthemes: string[]
  confidence?: number | null
}

export type AssetThemeTaxonomySuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'ignored'

export interface AssetThemeTaxonomySuggestionDTO {
  id: number
  asset_id: number
  symbol: string
  company_name: string | null
  sector: string | null
  industry: string | null
  summary_hash: string
  summary_excerpt: string | null
  suggested_theme: string
  suggested_subthemes: string[]
  reason: string
  confidence: number
  status: AssetThemeTaxonomySuggestionStatus
  reviewer_note: string | null
  current_themes: AssetThemeDTO[]
  created_at: string
  updated_at: string
  reviewed_at: string | null
}

export interface AssetThemeTaxonomySuggestionStatsDTO {
  counts_by_status: Record<AssetThemeTaxonomySuggestionStatus, number>
  top_suggested_themes: { label: string; count: number }[]
  top_suggested_subthemes: { label: string; count: number }[]
}

export interface ThemeRegistryEntryDTO {
  definition: string
  subthemes: Record<string, string>
}

export type ThemeRegistryDTO = Record<string, ThemeRegistryEntryDTO>

export interface MiniLMBenchmarkCandidateDTO {
  label: string
  parent_label: string
  level: string
  score: number
}

export interface MiniLMBenchmarkDefinitionDTO {
  theme: string
  definition: string | null
  subthemes: Array<{
    subtheme: string
    definition: string | null
  }>
}

export interface MiniLMBenchmarkRowDTO {
  asset_id: number
  symbol: string
  company_name: string | null
  sector: string | null
  industry: string | null
  summary_excerpt: string
  gemini_themes: AssetThemeDTO[]
  minilm_themes: AssetThemeDTO[]
  retrieved_candidates: MiniLMBenchmarkCandidateDTO[]
  parent_top1_match: boolean
  parent_top3_match: boolean
  parent_top5_match: boolean
  subtheme_top1_match: boolean | null
  subtheme_top3_match: boolean | null
  parent_agreement_rank: number | null
  subtheme_agreement_rank: number | null
  gemini_top_confidence: number | null
  minilm_top_confidence: number | null
  confidence_delta: number | null
  runtime_ms: number
  definitions_used: MiniLMBenchmarkDefinitionDTO[]
}

export interface MiniLMBenchmarkReportDTO {
  generated_at: string
  metrics: {
    sample_size_requested: number
    sample_size_used: number
    skipped: Record<string, number>
    failed: number
    top1_parent_agreement: number
    top3_parent_agreement: number
    top5_parent_agreement: number
    top1_subtheme_agreement: number | null
    top3_subtheme_agreement: number | null
    theme_confidence_distribution: Array<{ bucket: string; count: number }>
    candidate_score_distribution: Array<{ bucket: string; count: number }>
    average_runtime_ms: number
    p95_runtime_ms: number
    embedding_document_count: number
    model_load_ms: number
    estimated_model_disk_mb: number | null
    estimated_memory_mb: number | null
  }
  rows: MiniLMBenchmarkRowDTO[]
}

export interface ThemeGapAnalysisDTO {
  generated_at: string
  classified_asset_count: number
  themes_never_assigned: Array<{ theme: string; asset_count: number }>
  subthemes_never_assigned: Array<{ theme: string; subtheme: string; asset_count: number }>
  themes_under_3_assets: Array<{ theme: string; asset_count: number }>
  themes_over_50_assets: Array<{ theme: string; asset_count: number }>
  most_frequent_taxonomy_suggestions: Array<{ theme: string; count: number }>
  most_frequent_subtheme_suggestions: Array<{ subtheme: string; count: number }>
}

export interface AssetThemeClassifyResultDTO {
  symbol: string
  status: 'classified' | 'skipped' | 'failed' | string
  company_name: string | null
  themes: AssetThemeDTO[]
  taxonomy_gap: AssetThemeTaxonomyGapDTO | null
  duration_ms?: number
  failure_reason?: string | null
  skipped_reason?: string | null
}

interface AssetThemeClassifyResponseDTO {
  total: number
  classified: number
  skipped: number
  failed: number
  results: AssetThemeClassifyResultDTO[]
}

export interface AssetCleanupCandidateDTO {
  id: number
  symbol: string
  name: string | null
  asset_type: string | null
  created_at: string | null
  reason?: string
  transaction_count?: number
  watchlist_count?: number
  pending_dividend_count?: number
  investment_note_count?: number
  metadata_override_count?: number
}

export interface DeleteInvalidProviderAssetsResponseDTO {
  dry_run: boolean
  scanned: number
  valid: number
  invalid: number
  deleted: number
  candidates: AssetCleanupCandidateDTO[]
  blocked: AssetCleanupCandidateDTO[]
  unresolved: AssetCleanupCandidateDTO[]
}

interface PortfolioMetricsDTO {
  portfolio_id: number
  portfolio_name: string
  total_value: number
  total_cost: number
  total_unrealized_pnl: number
  total_unrealized_pnl_pct: number
  total_realized_pnl: number
  total_dividends: number
  total_fees: number
  positions_count: number
  daily_change_value?: number | null
  daily_change_pct?: number | null
  last_updated: string
}

export interface TodayBriefItemDTO {
  id: string
  type: string
  severity: 'positive' | 'negative' | 'neutral' | 'warning'
  title: string
  description?: string | null
  symbol?: string | null
  value?: string | null
  timestamp?: string | null
  action_url?: string | null
}

interface TodayBriefResponseDTO {
  portfolio_id: number
  generated_at: string
  cached: boolean
  items: TodayBriefItemDTO[]
}

export interface PortfolioHistoryPointDTO {
  date: string
  value: number
  invested?: number  // Total amount invested (deposits - withdrawals)
  gain_pct?: number  // Percentage gain/loss vs. total invested (includes sold positions)
  cost_basis?: number  // Cost basis of current holdings only
  unrealized_pnl_pct?: number  // Unrealized P&L % of current holdings (matches Dashboard)
}

// Batch Price Response
export interface BatchPriceDTO {
  symbol: string
  asset_id: number
  name: string
  current_price: number | null  // Price converted to portfolio base currency
  original_price: number  // Original price in asset's native currency
  original_currency: string  // Asset's native currency (e.g., "USD")
  daily_change_pct: number | null
  last_updated: string | null
  asset_type: string | null
}

interface BatchPricesResponseDTO {
  portfolio_id: number
  base_currency: string  // Portfolio's base currency for all converted prices
  prices: BatchPriceDTO[]
  updated_at: string
  count: number
}

export interface AssetResearchDTO {
  asset: {
    id: number
    symbol: string
    name: string | null
    currency: string
    class: string
    sector: string | null
    industry: string | null
    asset_type: string | null
    country: string | null
    market_cap: number | null
    market_cap_currency: string | null
    market_cap_usd: number | null
    market_cap_fetched_at: string | null
    themes: AssetThemeDTO[]
    created_at: string
    updated_at: string
  }
  quote: {
    symbol: string
    price: number | string
    asof: string
    currency: string
    daily_change_pct: number | string | null
  } | null
  fundamentals: {
    market_cap: number | null
    volume: number | null
    avg_volume: number | null
    pe_ratio: number | null
    eps: number | null
    price: number | null
    liquidity_score: number | null
    revenue_growth: number | null
    earnings_growth: number | null
    profit_margins: number | null
    operating_margins: number | null
    return_on_equity: number | null
    net_cash: number | null
    debt_to_equity: number | null
    current_ratio: number | null
    quick_ratio: number | null
    recommendation_key: string | null
    recommendation_mean: number | null
    num_analysts: number | null
    target_mean: number | null
    target_high: number | null
    target_low: number | null
    implied_upside_pct: number | null
  }
  business: {
    founded: number | null
    employees: number | null
    headquarters: string | null
    country: string | null
    sector: string | null
    industry: string | null
    description: string | null
  }
  ownership: {
    institutional_ownership: number | null
    insider_ownership: number | null
    short_interest: number | null
  }
  risk: {
    volatility_30d: number | null
    volatility_90d: number | null
    beta: number | null
    beta_benchmark: string | null
    risk_score: number | null
    distance_to_ath_pct: number | null
  }
  relative_performance: {
    relative_perf_30d: number | null
    relative_perf_90d: number | null
    relative_perf_ytd: number | null
    relative_perf_1y: number | null
    asset_perf_30d: number | null
    asset_perf_90d: number | null
    asset_perf_ytd: number | null
    asset_perf_1y: number | null
    etf_perf_30d: number | null
    etf_perf_90d: number | null
    etf_perf_ytd: number | null
    etf_perf_1y: number | null
    sector_etf: string | null
  }
  metadata: {
    ath_price: number | string | null
    ath_date: string | null
    atl_price: number | string | null
    atl_date: string | null
    asset_currency: string | null
  }
}

export interface AssetEtfCompositionHoldingDTO {
  symbol: string
  name: string
  weight: number
}

export interface AssetEtfThemeExposureDTO {
  theme: string
  weight: number
}

export interface AssetEtfPortfolioOverlapHoldingDTO {
  symbol: string
  name: string
  weight: number
}

export interface AssetEtfPortfolioOverlapDTO {
  portfolio_id?: number | null
  overlap_weight: number
  overlapping_holdings_count: number
  largest_overlapping_holding?: AssetEtfPortfolioOverlapHoldingDTO | null
  holdings: AssetEtfPortfolioOverlapHoldingDTO[]
}

export interface AssetEtfCompositionSectorWeightingDTO {
  sector: string
  weight: number
}

export interface AssetEtfCompositionAssetClassDTO {
  name: string
  weight: number
}

export interface AssetEtfCompositionDTO {
  available: boolean
  holdings_available?: boolean
  sector_weightings_available?: boolean
  asset_classes_available?: boolean
  theme_exposure_available?: boolean
  theme_coverage?: number
  portfolio_overlap_available?: boolean
  total_top10_weight?: number | null
  largest_holding?: AssetEtfCompositionHoldingDTO | null
  holdings?: AssetEtfCompositionHoldingDTO[]
  theme_exposure?: AssetEtfThemeExposureDTO[]
  portfolio_overlap?: AssetEtfPortfolioOverlapDTO | null
  sector_weightings?: AssetEtfCompositionSectorWeightingDTO[]
  asset_classes?: AssetEtfCompositionAssetClassDTO[]
}

type AssetResearchSummaryDTO = Pick<AssetResearchDTO, 'asset' | 'quote' | 'metadata'>
export type AssetResearchFundamentalsDTO = AssetResearchDTO['fundamentals']
type AssetResearchBusinessDTO = AssetResearchDTO['business']
type AssetResearchOwnershipDTO = AssetResearchDTO['ownership']
export type AssetResearchRiskDTO = AssetResearchDTO['risk']
export type AssetResearchRelativePerformanceDTO = AssetResearchDTO['relative_performance']
export type AssetResearchMetadataDTO = AssetResearchDTO['metadata']

export type AssetInvestmentConviction = 'low' | 'medium' | 'high'
export type AssetInvestmentHorizon = 'short' | 'medium' | 'long'

export interface AssetInvestmentNoteDTO {
  id: number
  user_id: number
  asset_id: number
  thesis: string | null
  conviction: AssetInvestmentConviction | null
  risks: string | null
  target_price: number | string | null
  target_text: string | null
  invalidation_thesis: string | null
  horizon: AssetInvestmentHorizon | null
  horizon_date: string | null
  created_at: string
  updated_at: string
}

export interface AssetInvestmentNoteUpdate {
  thesis?: string | null
  conviction?: AssetInvestmentConviction | null
  risks?: string | null
  target_price?: number | null
  target_text?: string | null
  invalidation_thesis?: string | null
  horizon?: AssetInvestmentHorizon | null
  horizon_date?: string | null
}

// Asset Distribution Types
export interface AssetPositionDTO {
  asset_id: number
  total_value: number
  unrealized_pnl: number
  unrealized_pnl_pct?: number
  percentage: number
}

export interface DistributionItemDTO {
  name: string
  count: number
  percentage: number
  total_value: number
  cost_basis: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
  asset_ids: number[]
  asset_positions?: AssetPositionDTO[]
  subthemes?: DistributionItemDTO[]
}

export interface ThemeDistributionAssetDTO {
  symbol: string
  name: string
  contribution_value: number
  contribution_cost_basis: number
  contribution_unrealized_pnl: number
  contribution_unrealized_pnl_pct: number
}

export interface ThemeDistributionSubthemeDTO {
  name: string
  value: number
  percentage: number
  cost_basis: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
  assets: ThemeDistributionAssetDTO[]
}

interface ThemeDistributionItemDTO {
  theme: string
  value: number
  percentage: number
  cost_basis: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
  assets: ThemeDistributionAssetDTO[]
  subthemes?: ThemeDistributionSubthemeDTO[]
}

interface IndustryItemDTO {
  name: string
  count: number
  asset_ids: number[]
}

// Insights Types
interface TopPerformerDTO {
  symbol: string
  name: string | null
  return_pct: number
  value: number
  unrealized_pnl: number
  period: string
  logo_url?: string | null
  asset_type?: string | null
}

interface PerformanceMetricsDTO {
  period: string
  total_return: number
  total_return_pct: number
  annualized_return: number
  start_value: number
  end_value: number
  total_invested: number
  total_withdrawn: number
  best_day: number | null
  best_day_date: string | null
  worst_day: number | null
  worst_day_date: string | null
  positive_days: number
  negative_days: number
  win_rate: number
}

interface RiskMetricsDTO {
  period: string
  volatility: number
  sharpe_ratio: number | null
  max_drawdown: number
  max_drawdown_date: string | null
  beta: number | null
  var_95: number | null
  var_99: number | null
  cvar_95: number | null
  cvar_99: number | null
  var_95_1w: number | null
  var_95_1m: number | null
  tail_exposure: number | null
  downside_deviation: number
}

interface TimeSeriesPointDTO {
  date: string
  value: number
}

interface BenchmarkComparisonDTO {
  benchmark_symbol: string
  benchmark_name: string
  period: string
  portfolio_return: number
  benchmark_return: number
  alpha: number
  portfolio_series: TimeSeriesPointDTO[]
  benchmark_series: TimeSeriesPointDTO[]
  correlation: number | null
}

interface AverageHoldingPeriodDTO {
  portfolio_id: number
  average_holding_period_days: number | null
}

interface PortfolioInsightsSummaryDTO {
  portfolio_id: number
  portfolio_name: string
  as_of_date: string
  period: string
  total_value: number
  total_cost: number
  total_return: number
  total_return_pct: number
  positions_count: number
  diversification_score: number | null
}

export interface ContributionItemDTO {
  name: string
  value: number
  cost_basis: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
  portfolio_weight: number
  contribution_to_return: number
  count: number
  symbol?: string | null
  asset_type?: string | null
}

interface PortfolioMoveSummaryDTO {
  portfolio_id: number
  total_value: number
  daily_change_value: number | null
  daily_change_pct: number | null
  explained_value: number
  unexplained_value: number
  movers: ContributionItemDTO[]
  best_movers: ContributionItemDTO[]
  worst_movers: ContributionItemDTO[]
}

interface ConcentrationMetricsDTO {
  portfolio_id: number
  positions_count: number
  largest_position_weight: number
  top_3_weight: number
  top_5_weight: number
  herfindahl_index: number
  effective_positions: number
  diversification_score: number
  largest_position: ContributionItemDTO | null
}

interface ThemeEvolutionPointDTO {
  date: string
  exposures: Record<string, number>
}

interface PortfolioDNATraitDTO {
  label: string
  value: string
  score: number
}

interface PortfolioDNADTO {
  portfolio_id: number
  traits: PortfolioDNATraitDTO[]
}

export interface DuplicateExposureItemDTO {
  label: string
  exposure_type: string
  portfolio_weight: number
  count: number
  assets: string[]
}

export interface HiddenConcentrationItemDTO {
  label: string
  exposure_type: string
  portfolio_weight: number
  count: number
}

export interface ScenarioResultDTO {
  name: string
  description: string
  estimated_impact_pct: number
  estimated_impact_value: number
}

interface PerformanceInsightsDTO {
  summary: PortfolioInsightsSummaryDTO
  performance: PerformanceMetricsDTO
  risk: RiskMetricsDTO
}

interface AttributionInsightsDTO {
  move: PortfolioMoveSummaryDTO
  top_contributors: ContributionItemDTO[]
  top_detractors: ContributionItemDTO[]
  asset_contribution: ContributionItemDTO[]
  theme_contribution: ContributionItemDTO[]
  sector_contribution: ContributionItemDTO[]
  country_contribution: ContributionItemDTO[]
  currency_contribution: ContributionItemDTO[]
  concentration: ConcentrationMetricsDTO
}

interface ExposureInsightsDTO {
  theme_exposure: ContributionItemDTO[]
  sector_exposure: ContributionItemDTO[]
  country_exposure: ContributionItemDTO[]
  currency_exposure: ContributionItemDTO[]
  market_cap_exposure: ContributionItemDTO[]
  duplicate_exposure: DuplicateExposureItemDTO[]
  hidden_concentration: HiddenConcentrationItemDTO[]
  portfolio_dna: PortfolioDNADTO
  theme_evolution: ThemeEvolutionPointDTO[]
}

interface RiskInsightsDTO {
  risk: RiskMetricsDTO
  benchmark_comparison: BenchmarkComparisonDTO
  scenarios: ScenarioResultDTO[]
  stress_tests: ScenarioResultDTO[]
}

// Price Quote
interface PriceQuote {
  symbol: string
  current_price: number
  price: number
  asof: string
  currency: string
  daily_change_pct?: number
  percent_change?: number
}

// Market Status
interface MarketStatusDTO {
  status: string
  timestamp: string
  database: string
  version: string
  market_status: string
  market_statuses?: {
    us: string
    europe: string
    asia: string
    oceania: string
  }
  email_enabled: boolean
  is_open?: boolean
  next_open?: string
  current_time?: string
}

interface TransactionDTO {
  id: number
  portfolio_id: number
  asset_id: number
  transaction_type: string
  transaction_date: string
  quantity: number
  price: number
  fees: number
  notes: string | null
  symbol: string
  asset_name: string | null
  created_at: string
}

interface PortfolioGoalDTO {
  id: number
  portfolio_id: number
  title: string
  target_amount: number
  target_date: string | null
  monthly_contribution: number
  category: 'retirement' | 'house' | 'education' | 'vacation' | 'emergency' | 'other'
  description: string | null
  color: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface PortfolioGoalCreate {
  title: string
  target_amount: number
  target_date?: string | null
  monthly_contribution?: number
  category?: 'retirement' | 'house' | 'education' | 'vacation' | 'emergency' | 'other'
  description?: string | null
  color?: string | null
  is_active?: boolean
}

interface PortfolioGoalUpdate {
  title?: string
  target_amount?: number
  target_date?: string | null
  monthly_contribution?: number
  category?: 'retirement' | 'house' | 'education' | 'vacation' | 'emergency' | 'other'
  description?: string | null
  color?: string | null
  is_active?: boolean
}

interface GoalScenario {
  label: 'Pessimistic' | 'Median' | 'Optimistic'
  return_rate: number
  projected_months: number
  projected_amount: number
  quantile: number
  color: string
}

interface GoalMilestone {
  percentage: number
  amount: number
  achieved: boolean
  label: string
}

interface GoalProjectionsDTO {
  scenarios: GoalScenario[]
  milestones: GoalMilestone[]
  probability: number
  historical_performance: {
    annual_return: number
    annual_volatility: number
  }
  is_past_target_date?: boolean
  warning?: string
}

export interface PublicSectorAllocation {
  sector: string
  percentage: number
}

export interface PublicGeographicAllocation {
  country: string
  percentage: number
}

export interface PublicHolding {
  symbol: string
  name: string | null
  sector: string | null
  industry: string | null
  country: string | null
  weight_pct: number
  asset_type: string | null
}

export interface PublicPortfolioInsights {
  portfolio_id: number
  portfolio_name: string
  owner_username: string
  as_of_date: string
  period: string
  sector_allocation: PublicSectorAllocation[]
  geographic_allocation: PublicGeographicAllocation[]
  holdings: PublicHolding[]
}

class ApiClient {
  // Admin
  async getAdminUsers() {
    return this.request<UserDTO[]>(`/admin/users`)
  }

  async createAdminUser(payload: { email: string; username: string; password: string; full_name?: string | null; is_admin?: boolean; is_active?: boolean; is_verified?: boolean }) {
    return this.request<UserDTO>(`/admin/users`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateAdminUser(userId: number, data: Partial<Pick<UserDTO, 'email' | 'username' | 'full_name' | 'is_admin' | 'is_active' | 'is_verified'>> & { password?: string }) {
    return this.request<UserDTO>(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteAdminUser(userId: number) {
    return this.request<void>(`/admin/users/${userId}`, { method: 'DELETE' })
  }

  async createTestNotifications(payload: { notification_types?: string[] }) {
    return this.request<{
      success: boolean
      message: string
      notifications: Array<{
        id: number
        type: string
        title: string
      }>
    }>(`/admin/notifications/test`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('auth_token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit & { timeout?: number } = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders(),
      ...options.headers,
    }

    const { timeout, signal: externalSignal, ...fetchOptions } = options
    const controller = new AbortController()
    let didTimeout = false
    const timeoutId = timeout
      ? setTimeout(() => {
          didTimeout = true
          controller.abort()
        }, timeout)
      : null
    const handleExternalAbort = () => controller.abort()

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort()
      } else {
        externalSignal.addEventListener('abort', handleExternalAbort, { once: true })
      }
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      })

      if (timeoutId) clearTimeout(timeoutId)

      if (!response.ok) {
        const error: ApiError = await response.json().catch(() => ({
          detail: 'An error occurred',
        }))
        throw new Error(
          typeof error.detail === 'string'
            ? error.detail
            : JSON.stringify(error.detail)
        )
      }

      // Handle 204 No Content responses (like DELETE operations)
      if (response.status === 204) {
        return undefined as T
      }

      return response.json()
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId)
      if (err instanceof Error && err.name === 'AbortError') {
        if (didTimeout) {
          throw new Error('Request timeout - the operation took too long')
        }
        throw err
      }
      throw err
    } finally {
      externalSignal?.removeEventListener('abort', handleExternalAbort)
    }
  }

  // Health
  async healthCheck() {
    return this.request<{
      status: string
      timestamp: string
      database: string
      version: string
      market_status: string  // 'premarket', 'open', 'afterhours', or 'closed'
      email_enabled: boolean
    }>('/health')
  }

  // Version
  async getVersion() {
    return this.request<{
      version: string
      build_date: string
      git_commit: string
    }>('/version')
  }

  // Authentication
  async login(email: string, password: string) {
    const formData = new URLSearchParams()
    formData.append('username', email) // API expects 'username' field but we use email
    formData.append('password', password)

    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Login failed')
    }

    return response.json()
  }

  async register(email: string, username: string, password: string, fullName?: string, preferredLanguage?: string) {
    return this.request<UserDTO>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        username,
        password,
        full_name: fullName,
        preferred_language: preferredLanguage || 'en',
      }),
    })
  }

  async getCurrentUser() {
    return this.request<UserDTO>('/auth/me')
  }

  async updateCurrentUser(update: Partial<Pick<UserDTO, 'full_name' | 'email' | 'username' | 'preferred_language' | 'daily_change_notifications_enabled' | 'transaction_notifications_enabled' | 'daily_report_enabled' | 'ath_atl_notifications_enabled' | 'push_notifications_enabled'>>) {
    return this.request<UserDTO>('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(update),
    })
  }

  async verifyEmail(token: string) {
    return this.request<{ message: string }>(`/auth/verify-email?token=${token}`, {
      method: 'POST',
    })
  }

  async resendVerification(email: string) {
    return this.request<{ message: string }>(`/auth/resend-verification?email=${email}`, {
      method: 'POST',
    })
  }

  async forgotPassword(email: string) {
    return this.request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  }

  // Two-Factor Authentication
  async loginWith2FA(email: string, password: string, token: string) {
    return this.request<LoginResponseDTO>('/auth/2fa/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, token }),
    })
  }

  async get2FAStatus() {
    return this.request<TwoFactorStatusResponse>('/auth/2fa/status')
  }

  async setup2FA() {
    return this.request<TwoFactorSetupResponse>('/auth/2fa/setup', {
      method: 'POST',
    })
  }

  async verify2FA(token: string) {
    return this.request<{ message: string }>('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
  }

  async disable2FA(password: string, token?: string) {
    return this.request<{ message: string }>('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ password, token }),
    })
  }

  async regenerateBackupCodes() {
    return this.request<TwoFactorSetupResponse>('/auth/2fa/regenerate-backup-codes', {
      method: 'POST',
    })
  }

  async resetPassword(token: string, newPassword: string) {
    return this.request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        token,
        new_password: newPassword,
      }),
    })
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    })
  }

  async deleteAccount() {
    return this.request<{ message: string }>('/auth/account', {
      method: 'DELETE',
    })
  }

  // Assets
  async getAssets(query?: string) {
    const params = query ? `?query=${encodeURIComponent(query)}` : ''
    return this.request<any[]>(`/assets${params}`)
  }

  async getAssetThemes(assetId: number) {
    return this.request<AssetThemeClassificationDTO>(`/assets/${assetId}/themes`)
  }

  async refreshAssetThemes(assetId: number) {
    return this.request<AssetThemeClassificationDTO>(`/assets/${assetId}/themes/refresh`, {
      method: 'POST',
    })
  }

  async getThemeRegistry() {
    return this.request<ThemeRegistryDTO>('/assets/themes/registry')
  }

  async getClassificationBenchmark(params?: {
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
    return this.request<MiniLMBenchmarkReportDTO>(
      `/assets/themes/classification-benchmark${queryString ? `?${queryString}` : ''}`,
      { timeout: 120000 }
    )
  }

  async getThemeGapAnalysis() {
    return this.request<ThemeGapAnalysisDTO>('/assets/themes/gap-analysis')
  }

  async getThemeTaxonomySuggestions(params?: {
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
    return this.request<AssetThemeTaxonomySuggestionDTO[]>(
      `/assets/themes/taxonomy-suggestions?${query.toString()}`
    )
  }

  async getThemeTaxonomySuggestionStats() {
    return this.request<AssetThemeTaxonomySuggestionStatsDTO>('/assets/themes/taxonomy-suggestions/stats')
  }

  async updateThemeTaxonomySuggestion(
    suggestionId: number,
    payload: { status: AssetThemeTaxonomySuggestionStatus; reviewer_note?: string | null }
  ) {
    return this.request<AssetThemeTaxonomySuggestionDTO>(`/assets/themes/taxonomy-suggestions/${suggestionId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async classifyAssetThemes(payload: { symbols: string[]; force: boolean; missing_only: boolean }) {
    return this.request<AssetThemeClassifyResponseDTO>('/assets/themes/classify', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async getHeldAssets(portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
    return this.request<any[]>(`/assets/held/all${params}`)
  }

  async getSoldAssets(portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
    return this.request<any[]>(`/assets/sold/all${params}`)
  }

  async getAssetDatabaseList() {
    return this.request<any[]>('/assets/database/list')
  }

  async deleteInvalidProviderAssets(payload?: { dryRun?: boolean; symbols?: string[] }) {
    return this.request<DeleteInvalidProviderAssetsResponseDTO>(
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

  async enrichAsset(assetId: number) {
    return this.request<any>(`/assets/enrich/${assetId}`, {
      method: 'POST',
    })
  }

  async enrichAllAssets() {
    return this.request<any>('/assets/enrich/all', {
      method: 'POST',
    })
  }

  async setAssetMetadataOverrides(assetId: number, overrides: {
    sector_override?: string | null
    industry_override?: string | null
    country_override?: string | null
  }) {
    return this.request<any>(`/assets/${assetId}/metadata-overrides`, {
      method: 'PATCH',
      body: JSON.stringify(overrides),
    })
  }

  async searchTicker(query: string) {
    return this.request<Array<{ symbol: string; name: string; type?: string; exchange?: string }>>(`/assets/search_ticker?query=${encodeURIComponent(query)}`)
  }

  async searchAssets(query: string, cryptoOnly: boolean = false) {
    const params = new URLSearchParams({ query })
    if (cryptoOnly) params.append('crypto_only', 'true')
    return this.request<Array<{ symbol: string; name: string; type?: string }>>(`/assets/search?${params.toString()}`)
  }

  async getAssetBySymbol(symbol: string) {
    return this.request<{ id: number; symbol: string; name: string; currency: string }>(`/assets/by-symbol/${encodeURIComponent(symbol)}`)
  }

  async getAssetResearchSummary(symbol: string) {
    return this.request<AssetResearchSummaryDTO>(`/assets/research/${encodeURIComponent(symbol)}/summary`)
  }

  async getAssetResearchFundamentals(symbol: string) {
    return this.request<AssetResearchFundamentalsDTO>(`/assets/research/${encodeURIComponent(symbol)}/fundamentals`)
  }

  async getAssetResearchBusiness(symbol: string) {
    return this.request<AssetResearchBusinessDTO>(`/assets/research/${encodeURIComponent(symbol)}/business`)
  }

  async getAssetResearchOwnership(symbol: string) {
    return this.request<AssetResearchOwnershipDTO>(`/assets/research/${encodeURIComponent(symbol)}/ownership`)
  }

  async getAssetResearchThemes(symbol: string) {
    return this.request<AssetThemeClassificationDTO>(`/assets/research/${encodeURIComponent(symbol)}/themes`)
  }

  async getAssetResearchRisk(symbol: string) {
    return this.request<AssetResearchRiskDTO>(`/assets/research/${encodeURIComponent(symbol)}/risk`)
  }

  async getAssetResearchPerformance(symbol: string) {
    return this.request<AssetResearchRelativePerformanceDTO>(`/assets/research/${encodeURIComponent(symbol)}/performance`)
  }

  async getAssetResearchMetadata(symbol: string) {
    return this.request<AssetResearchMetadataDTO>(`/assets/research/${encodeURIComponent(symbol)}/metadata`)
  }

  async getAssetEtfComposition(symbol: string, portfolioId?: number | null) {
    const params = new URLSearchParams()
    if (portfolioId) params.set('portfolio_id', String(portfolioId))
    const query = params.toString()
    return this.request<AssetEtfCompositionDTO>(`/assets/${encodeURIComponent(symbol)}/etf-composition${query ? `?${query}` : ''}`)
  }

  async getAssetInvestmentNote(assetId: number) {
    return this.request<AssetInvestmentNoteDTO | null>(`/assets/${assetId}/investment-note`)
  }

  async saveAssetInvestmentNote(assetId: number, data: AssetInvestmentNoteUpdate) {
    return this.request<AssetInvestmentNoteDTO>(`/assets/${assetId}/investment-note`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteAssetInvestmentNote(assetId: number) {
    return this.request<void>(`/assets/${assetId}/investment-note`, {
      method: 'DELETE',
    })
  }

  async getPriceQuote(symbol: string, targetCurrency?: string) {
    const params = targetCurrency ? `?target_currency=${encodeURIComponent(targetCurrency)}` : ''
    return this.request<{ symbol: string; price: number; currency: string }>(`/prices/quote/${encodeURIComponent(symbol)}${params}`)
  }

  async createAsset(asset: {
    symbol: string
    name?: string
    currency?: string
    class?: string
    asset_type?: string
  }) {
    return this.request<any>('/assets', {
      method: 'POST',
      body: JSON.stringify(asset),
    })
  }

  async getAssetSplitHistory(assetId: number, portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
    return this.request<Array<{
      id: number
      tx_date: string
      metadata: { split?: string;[key: string]: unknown }
      notes: string | null
    }>>(`/assets/${assetId}/splits${params}`)
  }

  async getAssetTransactionHistory(assetId: number, portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
    return this.request<Array<{
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

  async getAssetPriceHistory(assetId: number, period: string = '1M') {
    return this.request<{
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

  async backfillAssetPrices(assetId: number, options?: { days?: number; allTime?: boolean }) {
    const params = new URLSearchParams()
    if (options?.days !== undefined) params.set('days', String(options.days))
    if (options?.allTime) params.set('all_time', 'true')
    const query = params.toString()
    return this.request<{
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
  async getSectorsDistribution(portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
    return this.request<DistributionItemDTO[]>(`/assets/distribution/sectors${params}`)
  }

  async getCountriesDistribution(portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
    return this.request<DistributionItemDTO[]>(`/assets/distribution/countries${params}`)
  }

  async getTypesDistribution(portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
    return this.request<DistributionItemDTO[]>(`/assets/distribution/types${params}`)
  }

  async getMarketCapsDistribution(portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
    return this.request<DistributionItemDTO[]>(`/assets/distribution/market-caps${params}`)
  }

  async getThemesDistribution(portfolioId: number) {
    return this.request<ThemeDistributionItemDTO[]>(`/assets/themes/distribution?portfolio_id=${portfolioId}`)
  }

  async getSectorIndustriesDistribution(sectorName: string, portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
    return this.request<DistributionItemDTO[]>(`/assets/distribution/sectors/${encodeURIComponent(sectorName)}/industries${params}`)
  }

  async getIndustriesList(portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
    return this.request<IndustryItemDTO[]>(`/assets/distribution/industries${params}`)
  }

  async getAssetHealth(assetId: number) {
    return this.request<{
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

  async getYFinanceData(assetId: number) {
    return this.request<{
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

  async getYFinanceDataBySymbol(symbol: string) {
    return this.request<{
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

  // Portfolios
  async getPortfolios() {
    return this.request<PortfolioDTO[]>('/portfolios')
  }

  async createPortfolio(portfolio: {
    name: string
    base_currency?: string
    description?: string
    is_public?: boolean
  }) {
    return this.request<PortfolioDTO>('/portfolios', {
      method: 'POST',
      body: JSON.stringify(portfolio),
    })
  }

  async updatePortfolio(portfolioId: number, portfolio: {
    name: string
    base_currency?: string
    description?: string
    is_public?: boolean
  }) {
    return this.request<PortfolioDTO>(`/portfolios/${portfolioId}`, {
      method: 'PUT',
      body: JSON.stringify(portfolio),
    })
  }

  async deletePortfolio(portfolioId: number) {
    return this.request<void>(`/portfolios/${portfolioId}`, {
      method: 'DELETE',
    })
  }

  async getPortfolioPositions(portfolioId: number) {
    return this.request<PositionDTO[]>(`/portfolios/${portfolioId}/positions`)
  }

  async getSoldPositions(portfolioId: number) {
    return this.request<PositionDTO[]>(`/portfolios/${portfolioId}/sold-positions`)
  }

  async getPortfolioHistory(portfolioId: number, period: string = "1M") {
    return this.request<PortfolioHistoryPointDTO[]>(`/portfolios/${portfolioId}/history?period=${period}`)
  }


  async getPortfolioMetrics(portfolioId: number) {
    return this.request<PortfolioMetricsDTO>(`/portfolios/${portfolioId}/metrics`)
  }

  async getTodayBrief(portfolioId: number) {
    return this.request<TodayBriefResponseDTO>(`/portfolios/${portfolioId}/today-brief`)
  }

  /**
   * Get batch prices for all assets in a portfolio (ultra-fast, price-only updates)
   * 
   * This endpoint is optimized for auto-refresh scenarios where you need to update
   * prices without recalculating full positions. Returns only current prices and
   * daily changes, skipping heavy P&L calculations.
   * 
   * **Performance:** ~10x faster than getPortfolioPositions()
   * 
   * @param portfolioId Portfolio ID
   * @returns Batch price data for all portfolio assets
   */
  async getBatchPrices(portfolioId: number, forceRefresh: boolean = false) {
    const params = forceRefresh ? '?force_refresh=true' : ''
    return this.request<BatchPricesResponseDTO>(`/portfolios/${portfolioId}/prices/batch${params}`)
  }

  // Portfolio Goals
  async getPortfolioGoals(portfolioId: number, activeOnly: boolean = false) {
    const params = activeOnly ? '?active_only=true' : ''
    return this.request<PortfolioGoalDTO[]>(`/portfolios/${portfolioId}/goals${params}`)
  }

  async getPortfolioGoal(portfolioId: number, goalId: number) {
    return this.request<PortfolioGoalDTO>(`/portfolios/${portfolioId}/goals/${goalId}`)
  }

  async createPortfolioGoal(portfolioId: number, goal: PortfolioGoalCreate) {
    return this.request<PortfolioGoalDTO>(`/portfolios/${portfolioId}/goals`, {
      method: 'POST',
      body: JSON.stringify(goal),
    })
  }

  async updatePortfolioGoal(portfolioId: number, goalId: number, goal: PortfolioGoalUpdate) {
    return this.request<PortfolioGoalDTO>(`/portfolios/${portfolioId}/goals/${goalId}`, {
      method: 'PUT',
      body: JSON.stringify(goal),
    })
  }

  async deletePortfolioGoal(portfolioId: number, goalId: number) {
    return this.request<void>(`/portfolios/${portfolioId}/goals/${goalId}`, {
      method: 'DELETE',
    })
  }

  async getGoalProjections(portfolioId: number, goalId: number) {
    return this.request<GoalProjectionsDTO>(`/portfolios/${portfolioId}/goals/${goalId}/projections`, {
      method: 'POST',
    })
  }

  // Transactions
  async getTransactions(
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
    return this.request<any[]>(
      `/portfolios/${portfolioId}/transactions${queryString ? `?${queryString}` : ''}`
    )
  }

  async addPositionTransaction(
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
    return this.request<any>(
      `/portfolios/${portfolioId}/add_position_transaction?${params.toString()}`,
      { method: 'POST' }
    )
  }

  async fetchPriceForDate(
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
    return this.request(
      `/portfolios/${portfolioId}/fetch_price?${params.toString()}`
    )
  }

  async getFxRateForDate(
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
    return this.request(`/portfolios/${portfolioId}/fx_rate?${params.toString()}`)
  }

  async getPositionQuantityAtDate(
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
    return this.request(
      `/portfolios/${portfolioId}/positions/${assetId}/quantity_at_date?${params.toString()}`
    )
  }

  async createTransaction(portfolioId: number, transaction: any) {
    return this.request<any>(`/portfolios/${portfolioId}/transactions`, {
      method: 'POST',
      body: JSON.stringify(transaction),
    })
  }

  async updateTransaction(portfolioId: number, transactionId: number, transaction: any) {
    return this.request<any>(`/portfolios/${portfolioId}/transactions/${transactionId}`, {
      method: 'PUT',
      body: JSON.stringify(transaction),
    })
  }

  async deleteTransaction(portfolioId: number, transactionId: number) {
    return this.request<void>(`/portfolios/${portfolioId}/transactions/${transactionId}`, {
      method: 'DELETE',
    })
  }

  async createConversion(portfolioId: number, conversion: {
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
    return this.request<{
      conversion_id: string
      conversion_rate: string
      from_transaction: any
      to_transaction: any
    }>(`/portfolios/${portfolioId}/conversions`, {
      method: 'POST',
      body: JSON.stringify(conversion),
    })
  }

  async getTransactionMetrics(portfolioId: number, grouping: 'monthly' | 'yearly' = 'monthly') {
    return this.request<{
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

  async importCsv(portfolioId: number, file: File) {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(
      `${this.baseUrl}/portfolios/import/csv?portfolio_id=${portfolioId}`,
      {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
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

  async previewImportCsv(portfolioId: number, file: File): Promise<CsvImportPreviewResultDTO> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(
      `${this.baseUrl}/portfolios/import/csv/preview?portfolio_id=${portfolioId}`,
      {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
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

  // Prices
  async getPrices(symbols: string[]) {
    const symbolsParam = symbols.join(',')
    return this.request<Record<string, unknown>>(`/prices?symbols=${symbolsParam}`)
  }

  async refreshPrices(portfolioId: number) {
    return this.request<{ refreshed_count: number }>(
      `/prices/refresh?portfolio_id=${portfolioId}`,
      { method: 'POST' }
    )
  }

  // Admin
  async deleteAllData() {
    return this.request<{ success: boolean; deleted: Record<string, number>; message: string }>(
      `/admin/data`,
      { method: 'DELETE' }
    )
  }

  async checkAllAssetsHealth(minCoveragePct: number = 90) {
    return this.request<{
      total_assets: number
      assets_needing_backfill: number
      min_coverage_threshold: number
      assets: Array<{
        asset_id: number
        symbol: string
        name: string | null
        currency: string
        asset_type: string | null
        first_transaction_date: string | null
        price_count: number
        expected_trading_days: number
        coverage_pct: number
        missing_days: number
        needs_backfill: boolean
      }>
      summary: {
        excellent: number
        good: number
        fair: number
        poor: number
      }
    }>(`/admin/assets/health-check?min_coverage_pct=${minCoveragePct}`)
  }

  async backfillAllAssets(minCoveragePct: number = 90, days: number = 365) {
    return this.request<{
      success: boolean
      message: string
      backfilled: Array<{
        asset_id: number
        symbol: string
        prices_added: number
        previous_coverage: number
      }>
      skipped_count: number
      errors: Array<{
        symbol: string
        error: string
      }>
      total_prices_added: number
    }>(`/admin/assets/backfill-all?min_coverage_pct=${minCoveragePct}&days=${days}`, {
      method: 'POST'
    })
  }

  // Settings
  async getSettings() {
    return this.request<{
      validate_sell_quantity: boolean
      price_cache_ttl_seconds: number
    }>('/settings')
  }

  async updateSettings(settings: { validate_sell_quantity: boolean }) {
    return this.request<{
      validate_sell_quantity: boolean
      price_cache_ttl_seconds: number
    }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
  }

  // Watchlist Tags
  async getWatchlistTags() {
    return this.request<Array<{
      id: number
      user_id: number
      name: string
      icon: string
      color: string
      created_at: string
      updated_at: string
    }>>('/watchlist/tags')
  }

  async createWatchlistTag(data: {
    name: string
    icon?: string
    color?: string
  }) {
    return this.request<{
      id: number
      user_id: number
      name: string
      icon: string
      color: string
      created_at: string
      updated_at: string
    }>('/watchlist/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateWatchlistTag(tagId: number, data: {
    name?: string
    icon?: string
    color?: string
  }) {
    return this.request<{
      id: number
      user_id: number
      name: string
      icon: string
      color: string
      created_at: string
      updated_at: string
    }>(`/watchlist/tags/${tagId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteWatchlistTag(tagId: number) {
    return this.request<void>(`/watchlist/tags/${tagId}`, {
      method: 'DELETE',
    })
  }

  async updateWatchlistItemTags(itemId: number, tagIds: number[]) {
    return this.request<any>(`/watchlist/${itemId}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tag_ids: tagIds }),
    })
  }

  // Watchlist
  async getWatchlist(tagIds?: number[], filterMode?: 'any' | 'all') {
    const params = new URLSearchParams()
    if (tagIds && tagIds.length > 0) {
      params.append('tag_ids', tagIds.join(','))
    }
    if (filterMode) {
      params.append('tag_mode', filterMode)
    }
    const queryString = params.toString() ? `?${params.toString()}` : ''
    return this.request<Array<{
      id: number
      user_id: number
      asset_id: number
      symbol: string
      name: string | null
      notes: string | null
      alert_target_price: number | string | null
      alert_enabled: boolean
      current_price: number | string | null
      daily_change_pct: number | string | null
      currency: string
      asset_type: string | null
      themes: AssetThemeDTO[]
      last_updated: string | null
      created_at: string
      tags: Array<{
        id: number
        user_id: number
        name: string
        icon: string
        color: string
        created_at: string
        updated_at: string
      }>
    }>>(`/watchlist${queryString}`)
  }

  async addToWatchlist(data: {
    symbol: string
    notes?: string
    alert_target_price?: number
    alert_enabled?: boolean
    tag_ids?: number[]
  }) {
    const { symbol, ...rest } = data;
    const params = new URLSearchParams({ symbol });
    return this.request<{
      id: number
      user_id: number
      asset_id: number
      notes: string | null
      alert_target_price: number | string | null
      alert_enabled: boolean
      created_at: string
      updated_at: string
    }>(`/watchlist/by-symbol?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify(rest),
    });
  }

  async getWatchlistItemByAsset(assetId: number) {
    return this.request<{
      id: number
      user_id: number
      asset_id: number
      notes: string | null
      alert_target_price: number | string | null
      alert_enabled: boolean
      created_at: string
      updated_at: string
    } | null>(`/watchlist/by-asset/${assetId}`)
  }

  async updateWatchlistItem(itemId: number, data: {
    notes?: string | null
    alert_target_price?: number | null
    alert_enabled?: boolean
  }) {
    return this.request<any>(`/watchlist/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteWatchlistItem(itemId: number) {
    return this.request<void>(`/watchlist/${itemId}`, {
      method: 'DELETE',
    })
  }

  async convertWatchlistToBuy(itemId: number, data: {
    portfolio_id: number
    quantity: number
    price: number
    fees?: number
    tx_date?: string
    currency?: string
  }) {
    return this.request<{ success: boolean; transaction_id: number; message: string }>(
      `/watchlist/${itemId}/convert-to-buy`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  async importWatchlistCSV(file: File) {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${this.baseUrl}/watchlist/import/csv`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(JSON.stringify(error))
    }

    return response.json()
  }

  async exportWatchlistCSV() {
    const response = await fetch(`${this.baseUrl}/watchlist/export/csv`, {
      headers: {
        ...this.getAuthHeaders(),
      },
    })

    if (!response.ok) {
      throw new Error('Export failed')
    }

    return response.blob()
  }

  async refreshWatchlistPrices() {
    return this.request<{ refreshed_count: number }>(
      '/watchlist/refresh-prices',
      { method: 'POST' }
    )
  }

  // Notifications
  async getNotifications(skip: number = 0, limit: number = 50, unreadOnly: boolean = false) {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
      unread_only: unreadOnly.toString()
    })
    return this.request<Array<{
      id: number
      user_id: number
      type: string
      title: string
      message: string
      metadata: Record<string, any>
      is_read: boolean
      created_at: string
    }>>(`/notifications?${params.toString()}`)
  }

  async getUnreadCount() {
    return this.request<{ unread_count: number }>('/notifications/unread-count')
  }

  async markNotificationAsRead(notificationId: number) {
    return this.request<any>(`/notifications/${notificationId}/read`, {
      method: 'PUT'
    })
  }

  async markAllNotificationsAsRead() {
    return this.request<{ marked_read: number }>('/notifications/mark-all-read', {
      method: 'PUT'
    })
  }

  async deleteNotification(notificationId: number) {
    return this.request<void>(`/notifications/${notificationId}`, {
      method: 'DELETE'
    })
  }

  // Insights
  async getPortfolioInsights(portfolioId: number, period: string = '1y', benchmark: string = 'SPY', signal?: AbortSignal) {
    return this.request<any>(`/insights/${portfolioId}?period=${period}&benchmark=${benchmark}`, { signal })
  }

  async getPortfolioInsightsSummary(portfolioId: number, period: string = '1y', signal?: AbortSignal) {
    return this.request<PortfolioInsightsSummaryDTO>(`/insights/${portfolioId}/summary?period=${period}`, { signal })
  }

  async getPerformanceInsights(portfolioId: number, period: string = '1y', signal?: AbortSignal) {
    return this.request<PerformanceInsightsDTO>(`/insights/${portfolioId}/performance/overview?period=${period}`, { signal })
  }

  async getAttributionInsights(portfolioId: number, signal?: AbortSignal) {
    return this.request<AttributionInsightsDTO>(`/insights/${portfolioId}/attribution`, { signal })
  }

  async getExposureInsights(portfolioId: number, period: string = '1y', signal?: AbortSignal) {
    return this.request<ExposureInsightsDTO>(`/insights/${portfolioId}/exposure?period=${period}`, { signal })
  }

  async getRiskInsights(portfolioId: number, benchmark: string = 'SPY', period: string = '1y', signal?: AbortSignal) {
    return this.request<RiskInsightsDTO>(`/insights/${portfolioId}/risk/overview?benchmark=${benchmark}&period=${period}`, { signal })
  }

  async getTopPerformers(portfolioId: number, period: string = '1y', limit: number = 5, signal?: AbortSignal) {
    return this.request<TopPerformerDTO[]>(`/insights/${portfolioId}/top-performers?period=${period}&limit=${limit}`, { signal })
  }

  async getPerformanceMetrics(portfolioId: number, period: string = '1y', signal?: AbortSignal) {
    return this.request<PerformanceMetricsDTO>(`/insights/${portfolioId}/performance?period=${period}`, { signal })
  }

  async getRiskMetrics(portfolioId: number, period: string = '1y', signal?: AbortSignal) {
    return this.request<RiskMetricsDTO>(`/insights/${portfolioId}/risk?period=${period}`, { signal })
  }

  async getBenchmarkComparison(portfolioId: number, benchmark: string = 'SPY', period: string = '1y', signal?: AbortSignal) {
    return this.request<BenchmarkComparisonDTO>(`/insights/${portfolioId}/benchmark?benchmark=${benchmark}&period=${period}`, { signal })
  }

  async getAverageHoldingPeriod(portfolioId: number, signal?: AbortSignal) {
    return this.request<AverageHoldingPeriodDTO>(`/insights/${portfolioId}/average-holding-period`, { signal })
  }

  async getPortfolioMoveSummary(portfolioId: number, limit: number = 8, signal?: AbortSignal) {
    return this.request<PortfolioMoveSummaryDTO>(`/insights/${portfolioId}/attribution/move?limit=${limit}`, { signal })
  }

  async getAssetContributions(portfolioId: number, limit: number = 10, ascending: boolean = false, signal?: AbortSignal) {
    return this.request<ContributionItemDTO[]>(
      `/insights/${portfolioId}/attribution/assets?limit=${limit}&ascending=${ascending}`,
      { signal }
    )
  }

  async getThemeContribution(portfolioId: number, signal?: AbortSignal) {
    return this.request<ContributionItemDTO[]>(`/insights/${portfolioId}/attribution/themes`, { signal })
  }

  async getSectorContribution(portfolioId: number, signal?: AbortSignal) {
    return this.request<ContributionItemDTO[]>(`/insights/${portfolioId}/attribution/sectors`, { signal })
  }

  async getCountryContribution(portfolioId: number, signal?: AbortSignal) {
    return this.request<ContributionItemDTO[]>(`/insights/${portfolioId}/attribution/countries`, { signal })
  }

  async getCurrencyContribution(portfolioId: number, signal?: AbortSignal) {
    return this.request<ContributionItemDTO[]>(`/insights/${portfolioId}/attribution/currencies`, { signal })
  }

  async getConcentrationMetrics(portfolioId: number, signal?: AbortSignal) {
    return this.request<ConcentrationMetricsDTO>(`/insights/${portfolioId}/attribution/concentration`, { signal })
  }

  async getThemeExposure(portfolioId: number, signal?: AbortSignal) {
    return this.request<ContributionItemDTO[]>(`/insights/${portfolioId}/exposure/themes`, { signal })
  }

  async getSectorExposure(portfolioId: number, signal?: AbortSignal) {
    return this.request<ContributionItemDTO[]>(`/insights/${portfolioId}/exposure/sectors`, { signal })
  }

  async getCountryExposure(portfolioId: number, signal?: AbortSignal) {
    return this.request<ContributionItemDTO[]>(`/insights/${portfolioId}/exposure/countries`, { signal })
  }

  async getCurrencyExposure(portfolioId: number, signal?: AbortSignal) {
    return this.request<ContributionItemDTO[]>(`/insights/${portfolioId}/exposure/currencies`, { signal })
  }

  async getMarketCapExposure(portfolioId: number, signal?: AbortSignal) {
    return this.request<ContributionItemDTO[]>(`/insights/${portfolioId}/exposure/market-caps`, { signal })
  }

  async getDuplicateExposure(portfolioId: number, signal?: AbortSignal) {
    return this.request<DuplicateExposureItemDTO[]>(`/insights/${portfolioId}/exposure/duplicates`, { signal })
  }

  async getHiddenConcentration(portfolioId: number, signal?: AbortSignal) {
    return this.request<HiddenConcentrationItemDTO[]>(`/insights/${portfolioId}/exposure/hidden-concentration`, { signal })
  }

  async getThemeEvolution(portfolioId: number, period: string = '1y', signal?: AbortSignal) {
    return this.request<ThemeEvolutionPointDTO[]>(`/insights/${portfolioId}/exposure/theme-evolution?period=${period}`, { signal })
  }

  async getPortfolioDNA(portfolioId: number, signal?: AbortSignal) {
    return this.request<PortfolioDNADTO>(`/insights/${portfolioId}/exposure/dna`, { signal })
  }

  async getScenarioAnalysis(portfolioId: number, signal?: AbortSignal) {
    return this.request<ScenarioResultDTO[]>(`/insights/${portfolioId}/risk/scenarios`, { signal })
  }

  async getStressTests(portfolioId: number, signal?: AbortSignal) {
    return this.request<ScenarioResultDTO[]>(`/insights/${portfolioId}/risk/stress-tests`, { signal })
  }

  async getRecentTransactions(portfolioId: number, limit: number = 5, signal?: AbortSignal) {
    return this.request<TransactionDTO[]>(`/portfolios/${portfolioId}/transactions?limit=${limit}`, { signal })
  }

  // Market Status
  async getMarketStatus(signal?: AbortSignal) {
    return this.request<MarketStatusDTO>('/health', { signal })
  }

  // Market Indices
  async getMarketIndices(signal?: AbortSignal) {
    const symbols = [
      '^GSPC', '^DJI', '^IXIC', '^GSPTSE',
      '^FTSE', '^GDAXI', '^FCHI', 'FTSEMIB.MI',
      '^N225', '^HSI', '000001.SS', '^AXJO'
    ].join(',')

    const response = await this.request<Record<string, PriceQuote>>(`/prices/indices?symbols=${symbols}`, { signal })

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

  // Admin Email Configuration
  async getEmailConfig() {
    return this.request<{
      enable_email: boolean
      smtp_host: string
      smtp_port: number
      smtp_user: string
      smtp_password: string | null
      smtp_tls: boolean
      from_email: string
      from_name: string
      frontend_url: string
    }>('/admin/email/config')
  }

  async updateEmailConfig(config: {
    enable_email?: boolean
    smtp_host?: string
    smtp_port?: number
    smtp_user?: string
    smtp_password?: string | null
    smtp_tls?: boolean
    from_email?: string
    from_name?: string
    frontend_url?: string
  }) {
    return this.request<{
      enable_email: boolean
      smtp_host: string
      smtp_port: number
      smtp_user: string
      smtp_password: string | null
      smtp_tls: boolean
      from_email: string
      from_name: string
      frontend_url: string
    }>('/admin/email/config', {
      method: 'PATCH',
      body: JSON.stringify(config)
    })
  }

  async testEmail(toEmail: string, testType: 'simple' | 'verification' | 'password_reset' | 'daily_report' | 'welcome') {
    // Daily reports can take longer to generate with many portfolios/transactions
    const timeout = testType === 'daily_report' ? 300000 : 30000 // 5 minutes for daily report, 30s for others
    return this.request<{
      success: boolean
      message: string
      test_type: string
      smtp_host: string
      smtp_port: number
      from_email: string
    }>('/admin/email/test', {
      method: 'POST',
      body: JSON.stringify({ to_email: toEmail, test_type: testType }),
      timeout
    })
  }

  async getEmailStats() {
    return this.request<{
      total_active_users: number
      verified_users: number
      email_enabled: boolean
      notifications: {
        daily_reports_enabled: number
        daily_changes_enabled: number
        transaction_notifications_enabled: number
      }
      smtp_configured: boolean
    }>('/admin/email/stats')
  }

  // ============================================================================
  // Market Data
  // ============================================================================

  async getStockMarketSentiment() {
    return this.request<{
      score: number
      rating: string
      previous_close: number
      timestamp: string
    }>('/market/sentiment/stock')
  }

  async getCryptoMarketSentiment() {
    return this.request<{
      score: number
      rating: string
      previous_value: number | null
      timestamp: string
    }>('/market/sentiment/crypto')
  }

  async getMarketSentiment(marketType: 'stock' | 'crypto') {
    return this.request<{
      score: number
      rating: string
      previous_close?: number
      previous_value?: number | null
      timestamp: string
    }>(`/market/sentiment/${marketType}`)
  }

  async getVIXIndex() {
    return this.request<{
      price: number
      change: number | null
      change_pct: number | null
      previous_close: number | null
      timestamp: string
    }>('/market/vix')
  }

  async getTNXIndex() {
    return this.request<{
      price: number
      change: number | null
      change_pct: number | null
      previous_close: number | null
      timestamp: string
    }>('/market/tnx')
  }

  async getDXYIndex() {
    return this.request<{
      price: number
      change: number | null
      change_pct: number | null
      previous_close: number | null
      timestamp: string
    }>('/market/dxy')
  }

  // ============================================================================
  // Dashboard Layouts
  // ============================================================================

  async getDashboardLayouts(portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : ''
    return this.request<DashboardLayoutDTO[]>(`/dashboard-layouts/${params}`)
  }

  async getDefaultDashboardLayout(portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : ''
    try {
      return await this.request<DashboardLayoutDTO>(`/dashboard-layouts/default${params}`)
    } catch (error) {
      // Return null if no default layout exists (404)
      return null
    }
  }

  async getDashboardLayout(layoutId: number) {
    return this.request<DashboardLayoutDTO>(`/dashboard-layouts/${layoutId}`)
  }

  async createDashboardLayout(layout: DashboardLayoutCreate) {
    return this.request<DashboardLayoutDTO>('/dashboard-layouts/', {
      method: 'POST',
      body: JSON.stringify(layout),
    })
  }

  async updateDashboardLayout(layoutId: number, update: DashboardLayoutUpdate) {
    return this.request<DashboardLayoutDTO>(`/dashboard-layouts/${layoutId}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    })
  }

  async deleteDashboardLayout(layoutId: number) {
    return this.request<void>(`/dashboard-layouts/${layoutId}`, {
      method: 'DELETE',
    })
  }

  async duplicateDashboardLayout(layoutId: number, newName: string) {
    return this.request<DashboardLayoutDTO>(
      `/dashboard-layouts/${layoutId}/duplicate?new_name=${encodeURIComponent(newName)}`,
      { method: 'POST' }
    )
  }

  async exportDashboardLayout(layoutId: number) {
    return this.request<DashboardLayoutExport>(`/dashboard-layouts/${layoutId}/export`)
  }

  async importDashboardLayout(layout: DashboardLayoutExport, portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : ''
    return this.request<DashboardLayoutDTO>(`/dashboard-layouts/import${params}`, {
      method: 'POST',
      body: JSON.stringify(layout),
    })
  }

  async getPositionDetailedMetrics(portfolioId: number, assetId: number) {
    return this.request<{
      relative_perf_30d: number | null
      relative_perf_90d: number | null
      relative_perf_ytd: number | null
      relative_perf_1y: number | null
      sector_etf: string | null
      market_cap: number | null
      volume: number | null
      avg_volume: number | null
      pe_ratio: number | null
      eps: number | null
      asset_currency: string | null
      revenue_growth: number | null
      earnings_growth: number | null
      profit_margins: number | null
      operating_margins: number | null
      return_on_equity: number | null
      net_cash: number | null
      debt_to_equity: number | null
      current_ratio: number | null
      quick_ratio: number | null
      recommendation_key: string | null
      recommendation_mean: number | null
      num_analysts: number | null
      target_mean: number | null
      target_high: number | null
      target_low: number | null
      implied_upside_pct: number | null
      themes: AssetThemeDTO[]
    }>(`/portfolios/${portfolioId}/positions/${assetId}/detailed-metrics`)
  }
  
  async getPublicPortfolio(shareToken: string) {
    return this.request<PublicPortfolioInsights>(`/public/portfolio/${shareToken}`)
  }

  // ============================================================================
  // Pending Dividends (Auto-fetched from yfinance)
  // ============================================================================

  async getPendingDividends(
    status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED',
    portfolioId?: number
  ) {
    const params = new URLSearchParams()
    if (status) params.append('status', status)
    if (portfolioId) params.append('portfolio_id', portfolioId.toString())
    const queryString = params.toString()
    return this.request<PendingDividendDTO[]>(
      `/dividends/pending${queryString ? `?${queryString}` : ''}`
    )
  }

  async getPendingDividendStats() {
    return this.request<PendingDividendStatsDTO>('/dividends/pending/stats')
  }

  async getPortfolioPendingDividends(
    portfolioId: number,
    status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'
  ) {
    const params = status ? `?status=${status}` : ''
    return this.request<PendingDividendDTO[]>(
      `/dividends/${portfolioId}/pending${params}`
    )
  }

  async getPortfolioPendingDividendStats(portfolioId: number) {
    return this.request<PortfolioPendingDividendStatsDTO>(
      `/dividends/${portfolioId}/pending/stats`
    )
  }

  async fetchDividendsForPortfolio(
    portfolioId: number,
    lookbackDays?: number,
    lookaheadDays?: number
  ) {
    const params = new URLSearchParams()
    if (lookbackDays) params.append('lookback_days', lookbackDays.toString())
    if (lookaheadDays) params.append('lookahead_days', lookaheadDays.toString())
    const queryString = params.toString()
    return this.request<PendingDividendDTO[]>(
      `/dividends/${portfolioId}/fetch${queryString ? `?${queryString}` : ''}`,
      { method: 'POST' }
    )
  }

  async acceptPendingDividend(
    dividendId: number,
    data: {
      tax_amount?: number
      notes?: string
      override_gross_amount?: number
      override_shares?: number
    } = {}
  ) {
    return this.request<TransactionDTO>(
      `/dividends/pending/${dividendId}/accept`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  async rejectPendingDividend(dividendId: number) {
    return this.request<void>(`/dividends/pending/${dividendId}/reject`, {
      method: 'POST',
    })
  }

  async bulkAcceptPendingDividends(
    dividendIds: number[],
    taxRate?: number
  ) {
    return this.request<TransactionDTO[]>('/dividends/pending/bulk-accept', {
      method: 'POST',
      body: JSON.stringify({
        dividend_ids: dividendIds,
        tax_rate: taxRate,
      }),
    })
  }

  async bulkRejectPendingDividends(dividendIds: number[]) {
    return this.request<void>('/dividends/pending/bulk-reject', {
      method: 'POST',
      body: JSON.stringify({ dividend_ids: dividendIds }),
    })
  }

  async deletePendingDividend(dividendId: number) {
    return this.request<void>(`/dividends/pending/${dividendId}`, {
      method: 'DELETE',
    })
  }

  // Calendar
  async getCalendarEvents(params?: {
    portfolio_id?: number
    days_back?: number
    days_forward?: number
  }) {
    const queryParams = new URLSearchParams()
    if (params?.portfolio_id) queryParams.append('portfolio_id', params.portfolio_id.toString())
    if (params?.days_back) queryParams.append('days_back', params.days_back.toString())
    if (params?.days_forward) queryParams.append('days_forward', params.days_forward.toString())
    
    const queryString = queryParams.toString()
    return this.request<CalendarEventsResponse>(`/calendar/events${queryString ? `?${queryString}` : ''}`)
  }

  async getEarningsCalendar(params?: {
    portfolio_id?: number
    days_back?: number
    days_forward?: number
    include_watchlist?: boolean
  }) {
    const queryParams = new URLSearchParams()
    if (params?.portfolio_id) queryParams.append('portfolio_id', params.portfolio_id.toString())
    if (params?.days_back) queryParams.append('days_back', params.days_back.toString())
    if (params?.days_forward) queryParams.append('days_forward', params.days_forward.toString())
    if (params?.include_watchlist !== undefined) queryParams.append('include_watchlist', params.include_watchlist.toString())
    
    const queryString = queryParams.toString()
    return this.request<EarningsCalendarResponse>(`/calendar/earnings${queryString ? `?${queryString}` : ''}`)
  }

  async getDailyPerformance(params?: {
    portfolio_id?: number
    days?: number
  }) {
    const queryParams = new URLSearchParams()
    if (params?.portfolio_id) queryParams.append('portfolio_id', params.portfolio_id.toString())
    if (params?.days) queryParams.append('days', params.days.toString())
    
    const queryString = queryParams.toString()
    return this.request<DailyPerformanceResponse>(`/calendar/daily-performance${queryString ? `?${queryString}` : ''}`)
  }

  async refreshEarningsCache(params?: { include_watchlist?: boolean }) {
    const queryParams = new URLSearchParams()
    if (params?.include_watchlist !== undefined) queryParams.append('include_watchlist', params.include_watchlist.toString())
    const queryString = queryParams.toString()
    
    return this.request<{
      status: string
      symbols_checked: number
      symbols_updated: number
      symbols_failed: number
      portfolio_symbols: number
      watchlist_symbols: number
    }>(`/calendar/refresh-earnings${queryString ? `?${queryString}` : ''}`, {
      method: 'POST'
    })
  }

  async getMarketHolidays(params?: {
    portfolio_id?: number
    start_date?: string
    end_date?: string
    currency?: string
    exchange?: string
  }) {
    const queryParams = new URLSearchParams()
    if (params?.portfolio_id) queryParams.append('portfolio_id', params.portfolio_id.toString())
    if (params?.start_date) queryParams.append('start_date', params.start_date)
    if (params?.end_date) queryParams.append('end_date', params.end_date)
    if (params?.currency) queryParams.append('currency', params.currency)
    if (params?.exchange) queryParams.append('exchange', params.exchange)
    
    const queryString = queryParams.toString()
    return this.request<MarketHolidaysResponse>(`/calendar/market-holidays${queryString ? `?${queryString}` : ''}`)
  }
}

// Market holidays response type
export interface MarketHolidaysResponse {
  holidays: Array<{
    date: string
    name: string
    exchanges: string[]
    exchange_names: string[]
  }>
  closed_dates: string[]
  exchanges: string[]
  exchange_display_names: Record<string, string>
  total_exchanges: number
  start_date: string
  end_date: string
}

// Types for Pending Dividends
export interface PendingDividendDTO {
  id: number
  portfolio_id: number
  asset_id: number
  user_id: number
  ex_dividend_date: string
  payment_date: string | null
  dividend_per_share: number | string
  shares_held: number | string
  gross_amount: number | string
  currency: string | null
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'
  fetched_at: string
  processed_at: string | null
  transaction_id: number | null
  asset_symbol: string | null
  asset_name: string | null
}

interface PendingDividendStatsDTO {
  pending_count: number
  pending_total_amount: number | string
  accepted_count: number
  rejected_count: number
  oldest_pending_date: string | null
}

export interface PortfolioPendingDividendStatsDTO {
  pending_count: number
  pending_total_amount: number | string
  converted_total_amount: number | string  // Total converted to portfolio base currency
  target_currency: string  // Portfolio's base currency
  accepted_count: number
  rejected_count: number
  oldest_pending_date: string | null
}

// Calendar Types
export interface CalendarEventBase {
  date: string
  type: 'earnings' | 'daily_performance' | 'dividend'
}

export interface EarningsEvent extends CalendarEventBase {
  type: 'earnings'
  symbol: string
  name: string | null
  portfolios: Array<{ id: number; name: string }>
  is_future: boolean
  eps_estimate?: number | null
  eps_actual?: number | null
  revenue_estimate?: number | null
  surprise_pct?: number | null
  source?: 'portfolio' | 'watchlist'
}

interface DailyPerformanceEvent extends CalendarEventBase {
  type: 'daily_performance'
  portfolio_id: number
  portfolio_name: string
  value: number
  daily_change: number
  daily_change_pct: number
  is_positive: boolean
  currency: string
}

type CalendarEvent = EarningsEvent | DailyPerformanceEvent

interface CalendarEventsResponse {
  events: CalendarEvent[]
  start_date: string
  end_date: string
  held_symbols: string[]
  today: string
}

interface EarningsCalendarResponse {
  earnings: EarningsEvent[]
  start_date: string
  end_date: string
  symbols_checked: string[]
  today: string
}

export interface DailyPerformanceDay {
  date: string
  total_change: number
  total_change_pct: number
  is_positive: boolean
  portfolios: Array<{
    portfolio_id: number
    portfolio_name: string
    value: number
    change: number
    change_pct: number
    currency: string
  }>
}

interface DailyPerformanceResponse {
  days: DailyPerformanceDay[]
  start_date: string
  end_date: string
  today: string
}

export const api = new ApiClient(API_BASE_URL)
export default api

// Export convenience functions
export const getTopPerformers = (portfolioId: number, period?: string, limit?: number, signal?: AbortSignal) =>
  api.getTopPerformers(portfolioId, period, limit, signal)

export const getRecentTransactions = (portfolioId: number, limit?: number, signal?: AbortSignal) =>
  api.getRecentTransactions(portfolioId, limit, signal)

export const getMarketStatus = (signal?: AbortSignal) =>
  api.getMarketStatus(signal)

export const getMarketIndices = (signal?: AbortSignal) =>
  api.getMarketIndices(signal)
