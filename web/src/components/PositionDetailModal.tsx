import React from 'react'
import { X, TrendingUp, TrendingDown, Target, Activity, AlertTriangle, Zap, DollarSign, Mountain, ArrowUpCircle, Clock, BarChart3 } from 'lucide-react'
import { PositionDTO, api } from '../lib/api'
import { formatCurrency, formatNumber } from '../lib/formatUtils'
import { useTranslation } from 'react-i18next'
import { getAssetLogoUrl, handleLogoError, validateLogoImage } from '@/lib/logoUtils'

interface PositionDetailModalProps {
  position: PositionDTO | null
  portfolioId: number
  isOpen: boolean
  onClose: () => void
}

interface DetailedMetrics {
  distance_to_ath_pct: number | null
  avg_buy_zone_pct: number | null
  personal_drawdown_pct: number | null
  local_ath_price: number | null
  local_ath_date: string | null
  cost_to_average_down: number | null
  volatility_30d: number | null
  volatility_90d: number | null
  beta: number | null
  beta_benchmark: string | null
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
  risk_score: number | null
}

// Helper function to generate performance conclusion
function getPerformanceConclusion(relativePerf: number, period: string, assetPerf: number | null, t: (key: string, params?: any) => string): string {
  // Exceptional outlier (penny stock or major disruption)
  if (Math.abs(relativePerf) > 500) {
    return assetPerf && assetPerf > 500 
      ? t("dashboard.conclusions.performance.exceptionalOutlierPositive")
      : t("dashboard.conclusions.performance.exceptionalOutlierNegative")
  }
  
  // Very strong performance ranges
  if (relativePerf > 50) {
    return period === '1y' 
      ? t("dashboard.conclusions.performance.veryStrongLongTerm")
      : t("dashboard.conclusions.performance.veryStrongOtherPeriods", { period })
  }
  if (relativePerf < -50) {
    return t("dashboard.conclusions.performance.severeUnderperformance")
  }
  
  // Strong performance ranges
  if (relativePerf > 20) {
    return period === 'ytd' || period === '1y'
      ? t("dashboard.conclusions.performance.strongLongTerm")
      : t("dashboard.conclusions.performance.strongShortTerm")
  }
  if (relativePerf < -20) {
    return t("dashboard.conclusions.performance.significantUnderperformance")
  }
  
  // Moderate ranges
  if (relativePerf > 5) {
    return t("dashboard.conclusions.performance.moderateOutperformance")
  }
  if (relativePerf < -5) {
    return t("dashboard.conclusions.performance.moderateUnderperformance")
  }
  
  // In-line with benchmark
  return t("dashboard.conclusions.performance.inLineWithBenchmark")
}

function getVolatilityConclusion(vol: number, t: (key: string, params?: any) => string): string {
	if (vol > 60) {
		return t("dashboard.conclusions.volatility.veryHigh");
	}
	if (vol > 40) {
		return t("dashboard.conclusions.volatility.high");
	}
	if (vol > 20) {
		return t("dashboard.conclusions.volatility.moderate");
	}
	return t("dashboard.conclusions.volatility.low");
}

function getBetaConclusion(beta: number, t: (key: string, params?: any) => string): string {
  if (beta > 1.5) {
    return t("dashboard.conclusions.beta.high");
  }
  if (beta > 1.2) {
    return t("dashboard.conclusions.beta.aboveAverage");
  }
  if (beta >= 0.8 && beta <= 1.2) {
    return t("dashboard.conclusions.beta.marketLike");
  }
  if (beta >= 0.5 && beta < 0.8) {
    return t("dashboard.conclusions.beta.defensive");
  }
  if (beta >= 0) {
    return t("dashboard.conclusions.beta.low");
  }
  return t("dashboard.conclusions.beta.negative");
}

function getRiskScoreConclusion(score: number, t: (key: string, params?: any) => string): string {
  if (score >= 80) {
    return t("dashboard.conclusions.risk.extreme");
  }
  if (score >= 60) {
    return t("dashboard.conclusions.risk.high");
  }
  if (score >= 40) {
    return t("dashboard.conclusions.risk.moderate");
  }
  if (score >= 20) {
    return t("dashboard.conclusions.risk.low");
  }
  return t("dashboard.conclusions.risk.veryLow");
}

export default function PositionDetailModal({ position, portfolioId, isOpen, onClose }: PositionDetailModalProps) {
  const { t } = useTranslation()
  const [detailedMetrics, setDetailedMetrics] = React.useState<DetailedMetrics | null>(null)
  const [loadingMetrics, setLoadingMetrics] = React.useState(false)

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Fetch detailed metrics when modal opens
  React.useEffect(() => {
    if (isOpen && position) {
      setLoadingMetrics(true)
      api.getPositionDetailedMetrics(portfolioId, position.asset_id)
        .then(data => {
          setDetailedMetrics(data)
          setLoadingMetrics(false)
        })
        .catch(err => {
          console.error('Failed to load detailed metrics:', err)
          setLoadingMetrics(false)
        })
    } else {
      setDetailedMetrics(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, position?.asset_id, portfolioId])

  if (!isOpen || !position) return null

  const pnlValue = position.unrealized_pnl !== null ? Number(position.unrealized_pnl) : 0
  const isPositive = pnlValue >= 0
  const pnlColor = isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="card max-w-5xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-8 py-6 flex items-center justify-between z-10">
						<div className="flex items-center gap-3">
						<img 
							src={getAssetLogoUrl(position.symbol, position.asset_type, position.name)}
							alt={`${position.symbol} logo`}
							className="w-14 h-14 flex-shrink-0 object-cover rounded-lg"
							style={{ borderRadius: 0 }}
								onLoad={(e) => {
									const img = e.currentTarget as HTMLImageElement
									if (!validateLogoImage(img)) {
										img.dispatchEvent(new Event('error'))
									}
								}}
								onError={(e) => handleLogoError(e, position.symbol, position.name, position.asset_type)}
							/>

							<div className="flex flex-col">
								<h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
									{position.symbol}
								</h2>
								<p className="text-base text-neutral-500 dark:text-neutral-400">
									{position.name}
								</p>
							</div>
						</div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <X size={20} className="text-neutral-500 dark:text-neutral-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-8 space-y-8">
            {/* Performance Metrics */}
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                  <Activity size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('dashboard.positionDetail.performance')}
                </h3>
              </div>
              
              {loadingMetrics ? (
                <div className="grid grid-cols-2 gap-5">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="p-5 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 animate-pulse">
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-24 mb-2"></div>
                      <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-32 mb-1"></div>
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-28"></div>
                    </div>
                  ))}
                </div>
              ) : (
              <div className="grid grid-cols-2 gap-5">
                <MetricCard
                  label={t('dashboard.unrealizedPnL')}
                  value={formatCurrency(position.unrealized_pnl, position.currency)}
                  percentage={position.unrealized_pnl_pct ? `${formatNumber(position.unrealized_pnl_pct, 2)}%` : undefined}
                  color={pnlColor}
                  icon={isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                />
                
                {position.breakeven_gain_pct && !isPositive && (
                  <MetricCard
                    label={t('dashboard.breakeven.gainNeeded')}
                    value={`+${formatNumber(position.breakeven_gain_pct, 2)}%`}
                    color="text-amber-600 dark:text-amber-400"
                    icon={<ArrowUpCircle size={16} />}
                  />
                )}
                
                {detailedMetrics && detailedMetrics.personal_drawdown_pct !== null && detailedMetrics.personal_drawdown_pct !== undefined && (
                  <MetricCard
                    label={t('dashboard.positionDetail.personalDrawdown')}
                    value={`${formatNumber(detailedMetrics.personal_drawdown_pct, 2)}%`}
                    color={detailedMetrics.personal_drawdown_pct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
                    subtitle={detailedMetrics.local_ath_price ? `${formatCurrency(detailedMetrics.local_ath_price, position.currency)}${detailedMetrics.local_ath_date ? ` (${new Date(detailedMetrics.local_ath_date).toLocaleDateString()})` : ''}` : undefined}
                    icon={detailedMetrics.personal_drawdown_pct >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  />
                )}
                
                {position.daily_change_pct !== null && position.daily_change_pct !== undefined && (
                  <MetricCard
                    label={t('dashboard.dailyChange')}
                    value={`${formatNumber(position.daily_change_pct, 2)}%`}
                    color={position.daily_change_pct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
                    icon={<Clock size={16} />}
                  />
                )}
              </div>
              )}
            </section>

            {/* Trading Zones */}
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                  <Target size={20} className="text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('dashboard.positionDetail.tradingZones')}
                </h3>
              </div>
              
              {loadingMetrics ? (
                <div className="grid grid-cols-2 gap-5">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="p-5 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 animate-pulse">
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-24 mb-2"></div>
                      <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-32 mb-1"></div>
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-28"></div>
                    </div>
                  ))}
                </div>
              ) : (
              <div className="grid grid-cols-2 gap-5">
                {detailedMetrics && detailedMetrics.avg_buy_zone_pct !== null && detailedMetrics.avg_buy_zone_pct !== undefined && (
                  <MetricCard
                    label={t('dashboard.positionDetail.avgBuyZone')}
                    value={`${formatNumber(detailedMetrics.avg_buy_zone_pct, 2)}%`}
                    color={detailedMetrics.avg_buy_zone_pct > 0 ? 'text-green-600 dark:text-green-400' : 'text-neutral-600 dark:text-neutral-400'}
                    subtitle={detailedMetrics.avg_buy_zone_pct > 0 ? t('dashboard.positionDetail.opportunityToBuy') : t('dashboard.positionDetail.priceAboveAvg')}
                    icon={<Target size={16} />}
                  />
                )}
                
                {!isPositive && detailedMetrics && detailedMetrics.cost_to_average_down !== null && detailedMetrics.cost_to_average_down !== undefined && (
                  <MetricCard
                    label={t('dashboard.positionDetail.costToAvgDown')}
                    value={formatCurrency(detailedMetrics.cost_to_average_down, position.currency)}
                    color="text-neutral-900 dark:text-neutral-100"
                    subtitle={t('dashboard.positionDetail.targetPRU5Pct')}
                    icon={<DollarSign size={16} />}
                  />
                )}
                
                {loadingMetrics ? (
                  <div className="p-5 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 animate-pulse">
                    <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">{t('dashboard.positionDetail.distanceToATH')}</div>
                    <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-24 mb-1"></div>
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-32"></div>
                  </div>
                ) : detailedMetrics && detailedMetrics.distance_to_ath_pct !== null && detailedMetrics.distance_to_ath_pct !== undefined ? (
                  <MetricCard
                    label={t('dashboard.positionDetail.distanceToATH')}
                    value={`${formatNumber(detailedMetrics.distance_to_ath_pct, 2)}%`}
                    color={detailedMetrics.distance_to_ath_pct >= -10 ? 'text-green-600 dark:text-green-400' : detailedMetrics.distance_to_ath_pct >= -30 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}
                    subtitle={(() => {
                      const athPrice = position.ath_price || detailedMetrics.local_ath_price;
                      const athDate = position.ath_date || detailedMetrics.local_ath_date;
                      if (!athPrice) return undefined;
                      return `ATH: ${formatCurrency(athPrice, position.currency)}${athDate ? ` • ${new Date(athDate).toLocaleDateString()}` : ''}`;
                    })()}
                    icon={<Mountain size={16} />}
                  />
                ) : (
                  <div className="p-5 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 opacity-60">
                    <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">{t('dashboard.positionDetail.distanceToATH')}</div>
                    <div className="text-base text-neutral-400 dark:text-neutral-500 italic">No data available</div>
                  </div>
                )}
              </div>
              )}
            </section>

            {/* Relative Performance vs Sector */}
            {(loadingMetrics || (detailedMetrics && (position.sector || detailedMetrics.sector_etf) && (detailedMetrics.relative_perf_30d !== null || 
              detailedMetrics.relative_perf_90d !== null || detailedMetrics.relative_perf_ytd !== null || 
              detailedMetrics.relative_perf_1y !== null))) && (
              <section>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center">
                    <BarChart3 size={20} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                    Relative Performance vs {detailedMetrics?.sector_etf || position.sector || 'Sector'}
                  </h3>
                </div>
                
                {loadingMetrics ? (
                  <div className="grid grid-cols-2 gap-5">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="p-5 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 animate-pulse">
                        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-24 mb-2"></div>
                        <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-32 mb-1"></div>
                        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-40"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-5">
                    {detailedMetrics.relative_perf_30d !== null && detailedMetrics.relative_perf_30d !== undefined && (
                      <MetricCard
                        label={t('charts.periods.1M')}
                        value={`${detailedMetrics.relative_perf_30d >= 0 ? '+' : ''}${formatNumber(detailedMetrics.relative_perf_30d, 2)}%`}
                        color={detailedMetrics.relative_perf_30d >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
                        icon={detailedMetrics.relative_perf_30d >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        subtitle={`${position.symbol}: ${detailedMetrics.asset_perf_30d !== null && detailedMetrics.asset_perf_30d !== undefined ? (detailedMetrics.asset_perf_30d >= 0 ? '+' : '') + formatNumber(detailedMetrics.asset_perf_30d, 2) + '%' : 'N/A'} | ${detailedMetrics.sector_etf}: ${detailedMetrics.etf_perf_30d !== null && detailedMetrics.etf_perf_30d !== undefined ? (detailedMetrics.etf_perf_30d >= 0 ? '+' : '') + formatNumber(detailedMetrics.etf_perf_30d, 2) + '%' : 'N/A'}`}
                        conclusion={getPerformanceConclusion(detailedMetrics.relative_perf_30d, '30d', detailedMetrics.asset_perf_30d, t)}
                      />
                    )}
                    
                    {detailedMetrics.relative_perf_90d !== null && detailedMetrics.relative_perf_90d !== undefined && (
                      <MetricCard
                        label={t('charts.periods.3M')}
                        value={`${detailedMetrics.relative_perf_90d >= 0 ? '+' : ''}${formatNumber(detailedMetrics.relative_perf_90d, 2)}%`}
                        color={detailedMetrics.relative_perf_90d >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
                        icon={detailedMetrics.relative_perf_90d >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        subtitle={`${position.symbol}: ${detailedMetrics.asset_perf_90d !== null && detailedMetrics.asset_perf_90d !== undefined ? (detailedMetrics.asset_perf_90d >= 0 ? '+' : '') + formatNumber(detailedMetrics.asset_perf_90d, 2) + '%' : 'N/A'} | ${detailedMetrics.sector_etf}: ${detailedMetrics.etf_perf_90d !== null && detailedMetrics.etf_perf_90d !== undefined ? (detailedMetrics.etf_perf_90d >= 0 ? '+' : '') + formatNumber(detailedMetrics.etf_perf_90d, 2) + '%' : 'N/A'}`}
                        conclusion={getPerformanceConclusion(detailedMetrics.relative_perf_90d, '90d', detailedMetrics.asset_perf_90d, t)}
                      />
                    )}
                    
                    {detailedMetrics.relative_perf_ytd !== null && detailedMetrics.relative_perf_ytd !== undefined && (
                      <MetricCard
                        label={t('charts.periods.YTD')}
                        value={`${detailedMetrics.relative_perf_ytd >= 0 ? '+' : ''}${formatNumber(detailedMetrics.relative_perf_ytd, 2)}%`}
                        color={detailedMetrics.relative_perf_ytd >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
                        icon={detailedMetrics.relative_perf_ytd >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        subtitle={`${position.symbol}: ${detailedMetrics.asset_perf_ytd !== null && detailedMetrics.asset_perf_ytd !== undefined ? (detailedMetrics.asset_perf_ytd >= 0 ? '+' : '') + formatNumber(detailedMetrics.asset_perf_ytd, 2) + '%' : 'N/A'} | ${detailedMetrics.sector_etf}: ${detailedMetrics.etf_perf_ytd !== null && detailedMetrics.etf_perf_ytd !== undefined ? (detailedMetrics.etf_perf_ytd >= 0 ? '+' : '') + formatNumber(detailedMetrics.etf_perf_ytd, 2) + '%' : 'N/A'}`}
                        conclusion={getPerformanceConclusion(detailedMetrics.relative_perf_ytd, 'ytd', detailedMetrics.asset_perf_ytd, t)}
                      />
                    )}
                    
                    {detailedMetrics.relative_perf_1y !== null && detailedMetrics.relative_perf_1y !== undefined && (
                      <MetricCard
                        label={t('charts.periods.1Y')}
                        value={`${detailedMetrics.relative_perf_1y >= 0 ? '+' : ''}${formatNumber(detailedMetrics.relative_perf_1y, 2)}%`}
                        color={detailedMetrics.relative_perf_1y >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
                        icon={detailedMetrics.relative_perf_1y >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        subtitle={`${position.symbol}: ${detailedMetrics.asset_perf_1y !== null && detailedMetrics.asset_perf_1y !== undefined ? (detailedMetrics.asset_perf_1y >= 0 ? '+' : '') + formatNumber(detailedMetrics.asset_perf_1y, 2) + '%' : 'N/A'} | ${detailedMetrics.sector_etf}: ${detailedMetrics.etf_perf_1y !== null && detailedMetrics.etf_perf_1y !== undefined ? (detailedMetrics.etf_perf_1y >= 0 ? '+' : '') + formatNumber(detailedMetrics.etf_perf_1y, 2) + '%' : 'N/A'}`}
                        conclusion={getPerformanceConclusion(detailedMetrics.relative_perf_1y, '1y', detailedMetrics.asset_perf_1y, t)}
                      />
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Risk Metrics */}
            {(loadingMetrics || (position.vol_contribution_pct !== null && position.vol_contribution_pct !== undefined) || 
             (detailedMetrics && (detailedMetrics.volatility_30d !== null || detailedMetrics.volatility_90d !== null))) ? (
              <section>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                    <AlertTriangle size={20} className="text-orange-600 dark:text-orange-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                    {t('dashboard.positionDetail.riskMetrics')}
                  </h3>
                </div>
                
                {loadingMetrics ? (
                  <div className="grid grid-cols-2 gap-5">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="p-5 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 animate-pulse">
                        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-24 mb-2"></div>
                        <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-32 mb-1"></div>
                        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-36"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                <div className="grid grid-cols-2 gap-5">
                  {position.vol_contribution_pct !== null && position.vol_contribution_pct !== undefined && (
                    <MetricCard
                      label={t('dashboard.positionDetail.volContribution')}
                      value={`${formatNumber(position.vol_contribution_pct, 2)}%`}
                      color="text-orange-600 dark:text-orange-400"
                      subtitle={t('dashboard.positionDetail.portfolioVolatility')}
                      icon={<Zap size={16} />}
                    />
                  )}
                  
                  {detailedMetrics && detailedMetrics.volatility_30d !== null && detailedMetrics.volatility_30d !== undefined && (
                    <MetricCard
                      label={t('dashboard.positionDetail.30DayVolatility')}
                      value={`${formatNumber(detailedMetrics.volatility_30d, 2)}%`}
                      color="text-orange-600 dark:text-orange-400"
                      subtitle={t('dashboard.positionDetail.30DayVolatilitySubtitle')}
                      icon={<Activity size={16} />}
											conclusion={getVolatilityConclusion(detailedMetrics.volatility_30d, t)}
                    />
                  )}
                  
                  {detailedMetrics && detailedMetrics.volatility_90d !== null && detailedMetrics.volatility_90d !== undefined && (
                    <MetricCard
                      label={t('dashboard.positionDetail.90DayVolatility')}
                      value={`${formatNumber(detailedMetrics.volatility_90d, 2)}%`}
                      color="text-orange-600 dark:text-orange-400"
                      subtitle={t('dashboard.positionDetail.90DayVolatilitySubtitle')}
                      icon={<Activity size={16} />}
											conclusion={getVolatilityConclusion(detailedMetrics.volatility_90d, t)}
                    />
                  )}
                  
                  {detailedMetrics && detailedMetrics.beta !== null && detailedMetrics.beta !== undefined && (
                    <MetricCard
                      label={t('dashboard.positionDetail.beta')}
                      value={formatNumber(detailedMetrics.beta, 2)}
                      color="text-orange-600 dark:text-orange-400"
                      subtitle={detailedMetrics.beta_benchmark ? `vs ${detailedMetrics.beta_benchmark}` : t('dashboard.positionDetail.marketCorrelation')}
                      icon={<TrendingUp size={16} />}
                      conclusion={getBetaConclusion(detailedMetrics.beta, t)}
                    />
                  )}
                  
                  {detailedMetrics && detailedMetrics.risk_score !== null && detailedMetrics.risk_score !== undefined && (
                    <MetricCard
                      label={t('dashboard.positionDetail.riskScore')}
                      value={formatNumber(detailedMetrics.risk_score, 1)}
                      color="text-orange-600 dark:text-orange-400"
                      subtitle={t('dashboard.positionDetail.riskScoreSubtitle')}
                      icon={<AlertTriangle size={16} />}
                      conclusion={getRiskScoreConclusion(detailedMetrics.risk_score, t)}
                    />
                  )}
                </div>
                )}
              </section>
            ) : null}

            {/* Position Details */}
            <section>
              <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-5">
                {t('dashboard.positionDetail.basicInfo')}
              </h3>
              
              <div className="grid grid-cols-2 gap-5">
                <InfoRow label={t('fields.quantity')} value={formatNumber(position.quantity, 4)} />
                <InfoRow label={t('dashboard.avgCost')} value={formatCurrency(position.avg_cost, position.currency)} />
                <InfoRow label={t('dashboard.currentPrice')} value={formatCurrency(position.current_price, position.currency)} />
                <InfoRow label={t('dashboard.marketValue')} value={formatCurrency(position.market_value, position.currency)} />
                <InfoRow label={t('dashboard.positionDetail.costBasis')} value={formatCurrency(position.cost_basis, position.currency)} />
                <InfoRow label={t('dashboard.positionDetail.assetType')} value={position.asset_type || '-'} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}

// Helper Components
function MetricCard({
  label,
  value,
  percentage,
  color,
  icon,
  subtitle,
  conclusion
}: {
  label: string
  value: string
  percentage?: string
  color?: string
  icon?: React.ReactNode
  subtitle?: string
  conclusion?: string
}) {
  return (
    <div className="card p-5 bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800/70 transition-colors">
      <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">{label}</div>
      <div className={`text-2xl font-bold ${color || 'text-neutral-900 dark:text-neutral-100'} flex items-center gap-2`}>
        {icon}
        {value}
      </div>
      {percentage && (
        <div className={`text-base font-medium mt-1 ${color}`}>{percentage}</div>
      )}
      {subtitle && (
        <div className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">{subtitle}</div>
      )}
      {conclusion && (
        <div className="text-sm text-neutral-600 dark:text-neutral-300 mt-3 italic border-t border-neutral-200 dark:border-neutral-700 pt-3">
          {conclusion}
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
      <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">{label}</div>
      <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{value}</div>
    </div>
  )
}
