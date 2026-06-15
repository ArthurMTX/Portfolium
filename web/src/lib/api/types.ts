// Auth Types
export interface UserDTO {
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

export interface LoginResponseDTO {
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
export interface PortfolioDTO {
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

export interface AssetThemeClassifyResponseDTO {
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

export interface PortfolioMetricsDTO {
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

export interface TodayBriefResponseDTO {
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

export interface BatchPricesResponseDTO {
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

export type AssetResearchSummaryDTO = Pick<AssetResearchDTO, 'asset' | 'quote' | 'metadata'>
export type AssetResearchFundamentalsDTO = AssetResearchDTO['fundamentals']
export type AssetResearchBusinessDTO = AssetResearchDTO['business']
export type AssetResearchOwnershipDTO = AssetResearchDTO['ownership']
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

export interface ThemeDistributionItemDTO {
  theme: string
  value: number
  percentage: number
  cost_basis: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
  assets: ThemeDistributionAssetDTO[]
  subthemes?: ThemeDistributionSubthemeDTO[]
}

export interface IndustryItemDTO {
  name: string
  count: number
  asset_ids: number[]
}

// Insights Types
export interface TopPerformerDTO {
  symbol: string
  name: string | null
  return_pct: number
  value: number
  unrealized_pnl: number
  period: string
  logo_url?: string | null
  asset_type?: string | null
}

export interface PerformanceMetricsDTO {
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

export interface RiskMetricsDTO {
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

export interface TimeSeriesPointDTO {
  date: string
  value: number
}

export interface BenchmarkComparisonDTO {
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

export interface AverageHoldingPeriodDTO {
  portfolio_id: number
  average_holding_period_days: number | null
}

export interface PortfolioInsightsSummaryDTO {
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

export interface PortfolioMoveSummaryDTO {
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

export interface ConcentrationMetricsDTO {
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

export interface ThemeEvolutionPointDTO {
  date: string
  exposures: Record<string, number>
}

export interface PortfolioDNATraitDTO {
  label: string
  value: string
  score: number
}

export interface PortfolioDNADTO {
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

export interface PerformanceInsightsDTO {
  summary: PortfolioInsightsSummaryDTO
  performance: PerformanceMetricsDTO
  risk: RiskMetricsDTO
}

export interface AttributionInsightsDTO {
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

export interface ExposureInsightsDTO {
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

export interface RiskInsightsDTO {
  risk: RiskMetricsDTO
  benchmark_comparison: BenchmarkComparisonDTO
  scenarios: ScenarioResultDTO[]
  stress_tests: ScenarioResultDTO[]
}

// Price Quote
export interface PriceQuote {
  symbol: string
  current_price: number
  price: number
  asof: string
  currency: string
  daily_change_pct?: number
  percent_change?: number
}

// Market Status
export interface MarketStatusDTO {
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

export interface TransactionDTO {
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

export interface PortfolioGoalDTO {
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

export interface PortfolioGoalCreate {
  title: string
  target_amount: number
  target_date?: string | null
  monthly_contribution?: number
  category?: 'retirement' | 'house' | 'education' | 'vacation' | 'emergency' | 'other'
  description?: string | null
  color?: string | null
  is_active?: boolean
}

export interface PortfolioGoalUpdate {
  title?: string
  target_amount?: number
  target_date?: string | null
  monthly_contribution?: number
  category?: 'retirement' | 'house' | 'education' | 'vacation' | 'emergency' | 'other'
  description?: string | null
  color?: string | null
  is_active?: boolean
}

export interface GoalScenario {
  label: 'Pessimistic' | 'Median' | 'Optimistic'
  return_rate: number
  projected_months: number
  projected_amount: number
  quantile: number
  color: string
}

export interface GoalMilestone {
  percentage: number
  amount: number
  achieved: boolean
  label: string
}

export interface GoalProjectionsDTO {
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

export interface PendingDividendStatsDTO {
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

export interface DailyPerformanceEvent extends CalendarEventBase {
  type: 'daily_performance'
  portfolio_id: number
  portfolio_name: string
  value: number
  daily_change: number
  daily_change_pct: number
  is_positive: boolean
  currency: string
}

export type CalendarEvent = EarningsEvent | DailyPerformanceEvent

export interface CalendarEventsResponse {
  events: CalendarEvent[]
  start_date: string
  end_date: string
  held_symbols: string[]
  today: string
}

export interface EarningsCalendarResponse {
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

export interface DailyPerformanceResponse {
  days: DailyPerformanceDay[]
  start_date: string
  end_date: string
  today: string
}
