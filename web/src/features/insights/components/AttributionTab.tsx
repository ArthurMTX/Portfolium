import type { CSSProperties, ReactNode } from 'react'
import { Activity, Award, Coins, Globe2, Layers, PieChart, Target, TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ContributionItemDTO } from '@/api'
import {
  BarsSkeleton,
  ContributionBars,
  ContributionIdentity,
  InsightBlock,
  type ContributionVisualKind,
  type InsightsTabProps,
  MiniTableSkeleton,
  formatCurrencyValue,
  formatNumber,
  formatPercent,
  toNumber,
  valueColor,
} from '@/features/insights/components/InsightsShared'
import { useAttributionInsights } from '@/features/insights/components/useInsightQueries'

type AttributionQuery = ReturnType<typeof useAttributionInsights>

export default function AttributionTab({ portfolioId, currency }: InsightsTabProps) {
  const { t } = useTranslation()
  const query = useAttributionInsights(portfolioId)

  return (
    <div className="space-y-6">
      <PortfolioMoveBlock query={query} currency={currency} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AssetContributionBlock query={query} currency={currency} title={t('insights.attribution.topContributors')} ascending={false} />
        <AssetContributionBlock query={query} currency={currency} title={t('insights.attribution.topDetractors')} ascending />
      </div>

      <GroupContributionBlock query={query} currency={currency} group="assets" title={t('insights.attribution.byAsset')} icon={<Activity className="h-5 w-5 text-pink-600" />} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <GroupContributionBlock query={query} currency={currency} group="themes" title={t('insights.attribution.byTheme')} icon={<Layers className="h-5 w-5 text-pink-600" />} />
        <GroupContributionBlock query={query} currency={currency} group="sectors" title={t('insights.attribution.bySector')} icon={<PieChart className="h-5 w-5 text-pink-600" />} />
        <GroupContributionBlock query={query} currency={currency} group="countries" title={t('insights.attribution.byCountry')} icon={<Globe2 className="h-5 w-5 text-pink-600" />} />
        <GroupContributionBlock query={query} currency={currency} group="currencies" title={t('insights.attribution.byCurrency')} icon={<Coins className="h-5 w-5 text-pink-600" />} />
      </div>

      <ConcentrationBlock query={query} />
    </div>
  )
}

function PortfolioMoveBlock({ query, currency }: { query: AttributionQuery; currency: string }) {
  const { t } = useTranslation()
  const data = query.data?.move

  return (
    <InsightBlock
      title={t('insights.attribution.portfolioMove.title')}
      icon={<TrendingUp className="h-5 w-5 text-pink-600" />}
      scope={t('insights.attribution.portfolioMove.scope')}
      description={t('insights.attribution.portfolioMove.description')}
      formula={t('insights.attribution.portfolioMove.formula')}
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={!data || ((data.best_movers?.length || 0) === 0 && (data.worst_movers?.length || 0) === 0 && data.movers.length === 0)}
      emptyMessage={t('insights.attribution.portfolioMove.empty')}
      onRetry={() => void query.refetch()}
      skeleton={<MiniTableSkeleton rows={4} />}
    >
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryStat
          label={t('insights.attribution.portfolioMove.dailyChange')}
          value={data?.daily_change_pct === null ? t('insights.risk.notAvailable') : formatPercent(data?.daily_change_pct, 2, true)}
          tone={valueColor(data?.daily_change_pct)}
        />
        <SummaryStat label={t('insights.attribution.portfolioMove.estimatedMove')} value={data?.daily_change_value === null ? t('insights.risk.notAvailable') : formatCurrencyValue(data?.daily_change_value, currency)} />
        <SummaryStat label={t('insights.attribution.portfolioMove.explainedByHoldings')} value={formatCurrencyValue(data?.explained_value, currency)} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DailyMoverList
          title={t('insights.attribution.portfolioMove.bestAssets')}
          items={data?.best_movers || []}
          currency={currency}
          emptyMessage={t('insights.attribution.portfolioMove.noPositiveMovers')}
        />
        <DailyMoverList
          title={t('insights.attribution.portfolioMove.worstAssets')}
          items={data?.worst_movers || []}
          currency={currency}
          emptyMessage={t('insights.attribution.portfolioMove.noNegativeMovers')}
        />
      </div>
    </InsightBlock>
  )
}

function AssetContributionBlock({
  query,
  currency,
  title,
  ascending = false,
}: {
  query: AttributionQuery
  currency: string
  title: string
  ascending?: boolean
}) {
  const { t } = useTranslation()
  const items = ascending ? query.data?.top_detractors : query.data?.top_contributors

  return (
    <InsightBlock
      title={title}
      icon={ascending ? <TrendingDown className="h-5 w-5 text-red-600" /> : <Award className="h-5 w-5 text-green-600" />}
      scope={t('insights.shared.currentHoldings')}
      description={t('insights.attribution.contributionDescription')}
      formula={t('insights.attribution.contributionFormula')}
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={!items || items.length === 0}
      onRetry={() => void query.refetch()}
      skeleton={<MiniTableSkeleton rows={5} />}
    >
      <ContributionRows items={items || []} currency={currency} />
    </InsightBlock>
  )
}

type ContributionGroup = 'assets' | 'themes' | 'sectors' | 'countries' | 'currencies'

function GroupContributionBlock({
  query,
  currency,
  group,
  title,
  icon,
}: {
  query: AttributionQuery
  currency: string
  group: ContributionGroup
  title: string
  icon: ReactNode
}) {
  const { t } = useTranslation()
  const items =
    group === 'assets'
      ? query.data?.asset_contribution
      : group === 'themes'
        ? query.data?.theme_contribution
        : group === 'sectors'
          ? query.data?.sector_contribution
          : group === 'countries'
            ? query.data?.country_contribution
            : query.data?.currency_contribution
  const visualKind: Record<ContributionGroup, ContributionVisualKind> = {
    assets: 'asset',
    themes: 'theme',
    sectors: 'sector',
    countries: 'country',
    currencies: 'currency',
  }

  return (
    <InsightBlock
      title={title}
      icon={icon}
      scope={t('insights.shared.currentHoldings')}
      description={t('insights.attribution.groupDescription')}
      formula={t('insights.attribution.groupFormula')}
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={!items || items.length === 0}
      onRetry={() => void query.refetch()}
      skeleton={<BarsSkeleton rows={6} />}
    >
      <ContributionBars
        items={items || []}
        valueLabel={(item) => `${formatPercent(item.contribution_to_return, 2, true)} / ${formatCurrencyValue(item.unrealized_pnl, currency)}`}
        maxRows={8}
        kind={visualKind[group]}
        barTone="value"
      />
    </InsightBlock>
  )
}

function ConcentrationBlock({ query }: { query: AttributionQuery }) {
  const { t } = useTranslation()
  const data = query.data?.concentration
  const largestWeight = toNumber(data?.largest_position?.portfolio_weight ?? data?.largest_position_weight)
  const largestWeightWidth = Math.min(Math.max(largestWeight, 0), 100)

  return (
    <InsightBlock
      title={t('insights.attribution.concentration.title')}
      icon={<Target className="h-5 w-5 text-pink-600" />}
      scope={t('insights.shared.currentHoldings')}
      description={t('insights.attribution.concentration.description')}
      formula={t('insights.attribution.concentration.formula')}
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={!data}
      onRetry={() => void query.refetch()}
      skeleton={<BarsSkeleton rows={5} />}
    >
      <div className="insights-concentration">
        <div className="insights-concentration__metrics">
          <ConcentrationMetric label={t('insights.attribution.concentration.largestPosition')} value={formatPercent(data?.largest_position_weight, 1)} emphasis />
          <ConcentrationMetric label={t('insights.attribution.concentration.top3Weight')} value={formatPercent(data?.top_3_weight, 1)} />
          <ConcentrationMetric label={t('insights.attribution.concentration.top5Weight')} value={formatPercent(data?.top_5_weight, 1)} />
          <ConcentrationMetric label={t('insights.attribution.concentration.effectivePositions')} value={formatNumber(data?.effective_positions, 1)} />
          <ConcentrationMetric label={t('insights.attribution.concentration.diversification')} value={formatNumber(data?.diversification_score, 0)} />
        </div>
        {data?.largest_position && (
          <div className="insights-concentration__holding">
            <div className="insights-concentration__holding-main">
              <div className="insights-concentration__holding-copy">
                <p>{t('insights.attribution.concentration.largestHolding')}</p>
                <ContributionIdentity item={data.largest_position} kind="asset" />
              </div>
              <strong>{formatPercent(data.largest_position.portfolio_weight, 1)}</strong>
            </div>
            <div className="insights-concentration__rail" aria-hidden="true">
              <span style={{ '--insights-concentration-width': `${largestWeightWidth}%` } as CSSProperties} />
            </div>
            <p className="insights-concentration__note">
              {t('insights.attribution.concentration.ofPortfolioValue', { percent: formatPercent(data.largest_position.portfolio_weight, 1) })}
            </p>
          </div>
        )}
      </div>
    </InsightBlock>
  )
}

function ConcentrationMetric({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`insights-concentration__metric ${emphasis ? 'is-emphasis' : ''}`.trim()}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ContributionRows({ items, currency }: { items: ContributionItemDTO[]; currency: string }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={`${item.symbol || item.name}-${item.unrealized_pnl}`} className="flex items-center justify-between gap-4 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/70">
          <ContributionIdentity item={item} kind="asset" />
          <div className="flex-shrink-0 text-right">
            <p className={`font-semibold ${valueColor(item.unrealized_pnl)}`}>{formatCurrencyValue(item.unrealized_pnl, currency)}</p>
            <p className={`text-sm ${valueColor(item.contribution_to_return)}`}>{formatPercent(item.contribution_to_return, 2, true)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function DailyMoverList({
  title,
  items,
  currency,
  emptyMessage,
}: {
  title: string
  items: ContributionItemDTO[]
  currency: string
  emptyMessage: string
}) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800">
      <div className="border-b border-neutral-200 px-3 py-2 text-sm font-semibold dark:border-neutral-800">{title}</div>
      <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {items.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500 dark:text-neutral-400">{emptyMessage}</p>
        ) : (
          items.map((item) => (
            <div key={`${title}-${item.symbol || item.name}`} className="flex items-center justify-between gap-3 p-3">
              <ContributionIdentity item={item} kind="asset" />
              <div className="flex-shrink-0 text-right">
                <p className={`font-semibold ${valueColor(item.unrealized_pnl)}`}>{formatCurrencyValue(item.unrealized_pnl, currency)}</p>
                <p className={`text-sm ${valueColor(item.unrealized_pnl_pct)}`}>{formatPercent(item.unrealized_pnl_pct, 2, true)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone ?? ''}`}>{value}</p>
    </div>
  )
}
