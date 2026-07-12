import { useMemo } from 'react'
import { Activity, BarChart3, Shield, Target, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import {
  BarsSkeleton,
  InsightBlock,
  type InsightsTabProps,
  MetricCard,
  MetricCardSkeleton,
  formatCurrencyValue,
  formatPercent,
  periodLabel,
  toNumber,
  valueColor,
  valueTone,
} from '@/features/insights/components/InsightsShared'
import { ChartSkeleton } from '@/shared/components/StatePrimitives'
import { useBenchmarkInsights, usePerformanceInsights } from '@/features/insights/components/useInsightQueries'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

export default function PerformanceTab({ portfolioId, period, benchmark, currency, locale }: InsightsTabProps) {
  const { t } = useTranslation()
  const performanceDomainQuery = usePerformanceInsights(portfolioId, period)
  const benchmarkQuery = useBenchmarkInsights(portfolioId, benchmark, period)

  const summaryData = performanceDomainQuery.data?.summary
  const performanceData = performanceDomainQuery.data?.performance
  const riskData = performanceDomainQuery.data?.risk
  const benchmarkData = benchmarkQuery.data
  const chartData = useMemo(() => {
    const portfolioSeries = benchmarkData?.portfolio_series || []
    const benchmarkSeries = benchmarkData?.benchmark_series || []

    return {
      labels: portfolioSeries.map((point) =>
        new Date(point.date).toLocaleDateString(locale, { month: 'short', year: 'numeric' }),
      ),
      datasets: [
        {
          label: t('insights.performance.vsBenchmarkChart.portfolio'),
          data: portfolioSeries.map((point) => toNumber(point.value)),
          borderColor: 'rgb(236, 72, 153)',
          backgroundColor: 'rgba(236, 72, 153, 0.1)',
          fill: true,
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        },
        {
          label: benchmarkData?.benchmark_name || benchmark,
          data: benchmarkSeries.map((point) => toNumber(point.value)),
          borderColor: 'rgb(37, 99, 235)',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: true,
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        },
      ],
    }
  }, [benchmark, benchmarkData, locale, t])

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          callbacks: {
            label: (context: { dataset: { label?: string }; parsed: { y: number | null } }) => {
              const label = context.dataset.label ? `${context.dataset.label}: ` : ''
              return context.parsed.y === null ? label : `${label}${formatPercent(context.parsed.y, 2, true)}`
            },
          },
        },
      },
      scales: {
        y: {
          title: {
            display: true,
            text: t('insights.performance.vsBenchmarkChart.yAxisLabel'),
          },
          ticks: {
            callback: (value: string | number) => formatPercent(value, 0, true),
          },
        },
      },
    }),
    [t],
  )

  return (
    <div className="space-y-6">
      <div className="pf-metric-strip">
        {performanceDomainQuery.isLoading && <MetricCardSkeleton />}
        {!performanceDomainQuery.isLoading && summaryData && (
          <MetricCard
            label={t('insights.performance.totalReturn')}
            value={formatPercent(summaryData.total_return_pct, 2, true)}
            subtitle={formatCurrencyValue(summaryData.total_return, currency)}
            icon={<Activity size={22} />}
            tone={valueTone(summaryData.total_return_pct)}
            tooltip={t('insights.performance.totalReturnTooltip')}
          />
        )}
        {!performanceDomainQuery.isLoading && performanceDomainQuery.error && (
          <MetricCard label={t('insights.performance.totalReturn')} value={t('insights.performance.error')} subtitle={t('insights.performance.failedToLoad')} icon={<Activity size={22} />} tone="negative" />
        )}

        {performanceDomainQuery.isLoading && <MetricCardSkeleton />}
        {!performanceDomainQuery.isLoading && performanceData && (
          <MetricCard
            label={t('insights.performance.annualizedReturn')}
            value={formatPercent(performanceData.annualized_return, 2, true)}
            subtitle={t('insights.performance.annualizedReturnSubtitle', { period: period.toUpperCase() })}
            icon={<TrendingUp size={22} />}
            tone={valueTone(performanceData.annualized_return)}
            tooltip={t('insights.performance.annualizedReturnTooltip')}
          />
        )}
        {!performanceDomainQuery.isLoading && performanceDomainQuery.error && (
          <MetricCard label={t('insights.performance.annualizedReturn')} value={t('insights.performance.error')} subtitle={t('insights.performance.failedToLoad')} icon={<TrendingUp size={22} />} tone="negative" />
        )}

        {performanceDomainQuery.isLoading && <MetricCardSkeleton />}
        {!performanceDomainQuery.isLoading && riskData && (
          <MetricCard
            label={t('insights.performance.sharpeRatio')}
            value={riskData.sharpe_ratio === null ? t('insights.risk.notAvailable') : toNumber(riskData.sharpe_ratio).toFixed(2)}
            subtitle={t('insights.performance.sharpeRatioSubtitle')}
            icon={<Shield size={22} />}
            tone="accent"
            tooltip={t('insights.performance.sharpeRatioTooltip')}
          />
        )}
        {!performanceDomainQuery.isLoading && performanceDomainQuery.error && (
          <MetricCard label={t('insights.performance.sharpeRatio')} value={t('insights.performance.error')} subtitle={t('insights.performance.failedToLoad')} icon={<Shield size={22} />} tone="negative" />
        )}

        {benchmarkQuery.isLoading && <MetricCardSkeleton />}
        {!benchmarkQuery.isLoading && benchmarkQuery.data && (
          <MetricCard
            label={t('insights.performance.vsBenchmark', { benchmark: benchmarkQuery.data.benchmark_name })}
            value={formatPercent(benchmarkQuery.data.alpha, 2, true)}
            subtitle={t('insights.performance.alpha')}
            icon={<Target size={22} />}
            tone={valueTone(benchmarkQuery.data.alpha)}
            tooltip={t('insights.performance.alphaTooltip')}
          />
        )}
        {!benchmarkQuery.isLoading && benchmarkQuery.error && (
          <MetricCard label={t('insights.performance.alpha')} value={t('insights.performance.error')} subtitle={t('insights.performance.failedToLoad')} icon={<Target size={22} />} tone="negative" />
        )}
      </div>

      <InsightBlock
        title={t('insights.performance.vsBenchmarkChart.title')}
        icon={<BarChart3 className="h-5 w-5 text-pink-600" />}
        scope={t('insights.shared.selectedPeriod', { period: periodLabel(period) })}
        description={t('insights.performance.vsBenchmarkChart.description')}
        formula={t('insights.performance.vsBenchmarkChart.formula')}
        isLoading={benchmarkQuery.isLoading}
        error={benchmarkQuery.error}
        isEmpty={!benchmarkData || benchmarkData.portfolio_series.length === 0}
        emptyMessage={t('insights.performance.vsBenchmarkChart.empty')}
        onRetry={() => void benchmarkQuery.refetch()}
        skeleton={<ChartSkeleton label={t('insights.performance.vsBenchmarkChart.loading')} />}
      >
        <div className="h-80">
          <Line key={`${period}-${benchmark}`} data={chartData} options={chartOptions} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <Stat label={t('insights.performance.portfolioReturn')} value={formatPercent(benchmarkData?.portfolio_return, 2, true)} tone={valueColor(benchmarkData?.portfolio_return)} />
          <Stat label={t('insights.performance.benchmarkReturn')} value={formatPercent(benchmarkData?.benchmark_return, 2, true)} tone={valueColor(benchmarkData?.benchmark_return)} />
          <Stat label={t('insights.performance.alpha')} value={formatPercent(benchmarkData?.alpha, 2, true)} tone={valueColor(benchmarkData?.alpha)} />
          <Stat label={t('insights.performance.correlation')} value={benchmarkData?.correlation === null ? t('insights.risk.notAvailable') : toNumber(benchmarkData?.correlation).toFixed(2)} />
        </div>
      </InsightBlock>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <InsightBlock
          title={t('insights.performance.statistics.title')}
          icon={<Activity className="h-5 w-5 text-pink-600" />}
          scope={t('insights.shared.selectedPeriod', { period: periodLabel(period) })}
          description={t('insights.performance.statistics.description')}
          formula={t('insights.performance.statistics.formula')}
          isLoading={performanceDomainQuery.isLoading}
          error={performanceDomainQuery.error}
          isEmpty={!performanceData}
          onRetry={() => void performanceDomainQuery.refetch()}
          skeleton={<BarsSkeleton rows={4} />}
        >
          <div className="grid grid-cols-2 gap-5">
            <Stat
              label={t('insights.performance.statistics.bestDay')}
              value={performanceData?.best_day === null ? t('insights.risk.notAvailable') : formatPercent(performanceData?.best_day, 2, true)}
              subtitle={formatDate(performanceData?.best_day_date, locale, t)}
              tone={valueColor(performanceData?.best_day)}
            />
            <Stat
              label={t('insights.performance.statistics.worstDay')}
              value={performanceData?.worst_day === null ? t('insights.risk.notAvailable') : formatPercent(performanceData?.worst_day, 2, true)}
              subtitle={formatDate(performanceData?.worst_day_date, locale, t)}
              tone={valueColor(performanceData?.worst_day)}
            />
            <Stat label={t('insights.performance.statistics.positiveDays')} value={String(performanceData?.positive_days ?? 0)} subtitle={t('insights.performance.statistics.negativeDaysSubtitle', { count: performanceData?.negative_days ?? 0 })} />
            <Stat label={t('insights.performance.statistics.winRate')} value={formatPercent(performanceData?.win_rate, 1)} subtitle={t('insights.performance.statistics.winRateSubtitle')} tone={valueColor(performanceData?.win_rate)} />
          </div>
        </InsightBlock>

        <InsightBlock
          title={t('insights.performance.riskSummary.title')}
          icon={<Shield className="h-5 w-5 text-pink-600" />}
          scope={t('insights.shared.selectedPeriod', { period: periodLabel(period) })}
          description={t('insights.performance.riskSummary.description')}
          formula={t('insights.performance.riskSummary.formula')}
          isLoading={performanceDomainQuery.isLoading}
          error={performanceDomainQuery.error}
          isEmpty={!riskData}
          onRetry={() => void performanceDomainQuery.refetch()}
          skeleton={<BarsSkeleton rows={4} />}
        >
          <div className="grid grid-cols-2 gap-5">
            <Stat label={t('insights.performance.riskSummary.volatility')} value={formatPercent(riskData?.volatility)} tone={valueColor(riskData?.volatility)} />
            <Stat label={t('insights.performance.riskSummary.beta')} value={riskData?.beta === null ? t('insights.risk.notAvailable') : toNumber(riskData?.beta).toFixed(2)} />
            <Stat label={t('insights.performance.riskSummary.maxDrawdown')} value={`-${formatPercent(riskData?.max_drawdown).replace('-', '')}`} tone={valueColor(-Math.abs(toNumber(riskData?.max_drawdown)))} />
            <Stat label={t('insights.performance.riskSummary.var95')} value={riskData?.var_95 === null ? t('insights.risk.notAvailable') : formatPercent(riskData?.var_95)} tone={valueColor(riskData?.var_95)} />
          </div>
        </InsightBlock>
      </div>
    </div>
  )
}

function Stat({ label, value, subtitle, tone }: { label: string; value: string; subtitle?: string; tone?: string }) {
  return (
    <div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone ?? ''}`}>{value}</p>
      {subtitle && <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{subtitle}</p>}
    </div>
  )
}

function formatDate(value: string | null | undefined, locale: string, t: (key: string) => string): string {
  if (!value) return t('insights.performance.statistics.noDateAvailable')
  return new Date(value).toLocaleDateString(locale, { dateStyle: 'medium' })
}
