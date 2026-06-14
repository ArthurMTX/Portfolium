import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { BarChart3, Dna, Globe2, Layers, LineChart, Repeat2, Search, Tags } from 'lucide-react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'
import type { ContributionItemDTO, DuplicateExposureItemDTO, HiddenConcentrationItemDTO } from '../../lib/api'
import {
  BarsSkeleton,
  ContributionBars,
  ContributionIdentity,
  ContributionVisual,
  InsightBlock,
  type ContributionVisualKind,
  type InsightsTabProps,
  MiniTableSkeleton,
  formatCurrencyValue,
  formatNumber,
  formatPercent,
  getContributionColor,
  periodLabel,
  toNumber,
} from './InsightsShared'
import { useExposureInsights } from './useInsightQueries'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

type ExposureQuery = ReturnType<typeof useExposureInsights>

export default function ExposureTab({ portfolioId, period, currency, locale }: InsightsTabProps) {
  const query = useExposureInsights(portfolioId, period)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ExposureBlock query={query} currency={currency} type="themes" title="Theme Exposure" icon={<Tags className="h-5 w-5 text-pink-600" />} />
        <ExposureBlock query={query} currency={currency} type="sectors" title="Sector Exposure" icon={<Layers className="h-5 w-5 text-pink-600" />} />
        <ExposureBlock query={query} currency={currency} type="countries" title="Country Exposure" icon={<Globe2 className="h-5 w-5 text-pink-600" />} />
        <ExposureBlock query={query} currency={currency} type="currencies" title="Currency Exposure" icon={<BarChart3 className="h-5 w-5 text-pink-600" />} />
        <ExposureBlock query={query} currency={currency} type="marketCaps" title="Market Cap Exposure" icon={<BarChart3 className="h-5 w-5 text-pink-600" />} />
        <PortfolioDNABlock query={query} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DuplicateExposureBlock query={query} />
        <HiddenConcentrationBlock query={query} />
      </div>

      <ThemeEvolutionBlock query={query} locale={locale} period={period} />
    </div>
  )
}

type ExposureType = 'themes' | 'sectors' | 'countries' | 'currencies' | 'marketCaps'

function ExposureBlock({
  query,
  currency,
  type,
  title,
  icon,
}: {
  query: ExposureQuery
  currency: string
  type: ExposureType
  title: string
  icon: ReactNode
}) {
  const items =
    type === 'themes'
      ? query.data?.theme_exposure
      : type === 'sectors'
        ? query.data?.sector_exposure
        : type === 'countries'
          ? query.data?.country_exposure
          : type === 'currencies'
            ? query.data?.currency_exposure
            : query.data?.market_cap_exposure
  const visualKind: Record<ExposureType, ContributionVisualKind> = {
    themes: 'theme',
    sectors: 'sector',
    countries: 'country',
    currencies: 'currency',
    marketCaps: 'marketCap',
  }
  const copy = exposureCopy(type)

  return (
    <InsightBlock
      title={title}
      icon={icon}
      scope={type === 'marketCaps' ? 'Current holdings / available metadata' : 'Current holdings'}
      description={copy.description}
      formula={copy.formula}
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={!items || items.length === 0}
      onRetry={() => void query.refetch()}
      skeleton={<BarsSkeleton rows={6} />}
    >
      <ContributionBars
        items={items || []}
        valueLabel={(item) => formatCurrencyValue(item.value, currency)}
        maxRows={8}
        kind={visualKind[type]}
      />
    </InsightBlock>
  )
}

function DuplicateExposureBlock({ query }: { query: ExposureQuery }) {
  const items = query.data?.duplicate_exposure

  return (
    <InsightBlock
      title="Duplicate Exposure"
      icon={<Repeat2 className="h-5 w-5 text-pink-600" />}
      scope="Current holdings"
      description="Flags categories where multiple holdings may be exposed to the same underlying driver."
      formula="group weight is the sum of current market values for holdings sharing that exposure / total portfolio value."
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={!items || items.length === 0}
      emptyMessage="No repeated high-weight exposure detected."
      onRetry={() => void query.refetch()}
      skeleton={<MiniTableSkeleton rows={4} />}
    >
      <ExposureFindingRows items={items || []} />
    </InsightBlock>
  )
}

function HiddenConcentrationBlock({ query }: { query: ExposureQuery }) {
  const items = query.data?.hidden_concentration

  return (
    <InsightBlock
      title="Hidden Concentration"
      icon={<Search className="h-5 w-5 text-pink-600" />}
      scope="Current holdings"
      description="Highlights grouped exposure that may be less obvious than looking at individual assets."
      formula="sum grouped market value / total portfolio value; only high-weight grouped exposures are shown."
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={!items || items.length === 0}
      emptyMessage="No grouped exposure above the concentration threshold."
      onRetry={() => void query.refetch()}
      skeleton={<MiniTableSkeleton rows={4} />}
    >
      <ExposureFindingRows items={items || []} />
    </InsightBlock>
  )
}

function ExposureFindingRows({ items }: { items: Array<DuplicateExposureItemDTO | HiddenConcentrationItemDTO> }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={`${item.exposure_type}-${item.label}`} className="flex items-center justify-between rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/70">
          <ContributionIdentity
            item={findingAsContribution(item)}
            kind={exposureKind(item.exposure_type)}
            subtitle={`${item.exposure_type} exposure · ${item.count} holdings${'assets' in item && item.assets.length > 0 ? ` · ${item.assets.join(', ')}` : ''}`}
          />
          <p className="text-lg font-semibold">{formatPercent(item.portfolio_weight, 1)}</p>
        </div>
      ))}
    </div>
  )
}

function ThemeEvolutionBlock({ query, locale, period }: { query: ExposureQuery; locale: string; period: string }) {
  const themeEvolution = query.data?.theme_evolution
  const data = useMemo(() => themeEvolution || [], [themeEvolution])
  const chartData = useMemo(() => {
    const totals = new Map<string, number>()
    data.forEach((point) => {
      Object.entries(point.exposures).forEach(([theme, value]) => {
        totals.set(theme, (totals.get(theme) || 0) + toNumber(value))
      })
    })
    const themes = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([theme]) => theme)

    return {
      labels: data.map((point) => formatThemeAxisDate(point.date, locale, data.length)),
      datasets: themes.map((theme, index) => ({
        label: theme,
        data: data.map((point) => toNumber(point.exposures[theme])),
        borderColor: getContributionColor('theme', theme),
        backgroundColor: `${getContributionColor('theme', theme)}22`,
        pointRadius: index === 0 ? 2 : 1.5,
        pointHoverRadius: 5,
        borderWidth: 2,
        tension: 0,
      })),
    }
  }, [data, locale])

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' as const },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          callbacks: {
            title: (contexts: Array<{ dataIndex: number }>) => {
              const point = data[contexts[0]?.dataIndex]
              return point ? new Date(point.date).toLocaleDateString(locale, { dateStyle: 'medium' }) : ''
            },
            label: (context: { dataset: { label?: string }; parsed: { y: number | null } }) => {
              const label = context.dataset.label ? `${context.dataset.label}: ` : ''
              return context.parsed.y === null ? label : `${label}${formatPercent(context.parsed.y, 1)}`
            },
          },
        },
      },
      interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false,
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
        },
        y: {
          min: 0,
          max: 100,
          ticks: {
            callback: (value: string | number) => formatPercent(value, 0),
          },
        },
      },
    }),
    [data, locale],
  )

  return (
    <InsightBlock
      title="Theme Evolution"
      icon={<LineChart className="h-5 w-5 text-pink-600" />}
      scope={`Selected period: ${periodLabel(period)}`}
      description="Shows how top theme exposure changed over time from transactions and cost basis snapshots."
      formula="theme cost basis at each snapshot / total active cost basis at that snapshot."
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={data.length === 0}
      emptyMessage="Theme history is not available yet."
      onRetry={() => void query.refetch()}
      skeleton={<div className="h-80 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />}
    >
      <div className="h-80">
        <Line data={chartData} options={chartOptions} />
      </div>
    </InsightBlock>
  )
}

function PortfolioDNABlock({ query }: { query: ExposureQuery }) {
  const data = query.data?.portfolio_dna

  return (
    <InsightBlock
      title="Portfolio DNA"
      icon={<Dna className="h-5 w-5 text-pink-600" />}
      scope="Current holdings"
      description="Summarizes the portfolio's style using current concentration, instrument, geography, currency, theme, and breadth metrics."
      formula="each trait is based on the dominant current exposure, except breadth, which uses effective positions."
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={!data || data.traits.length === 0}
      onRetry={() => void query.refetch()}
      skeleton={<MiniTableSkeleton rows={5} />}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(data?.traits || []).map((trait) => (
          <div key={trait.label} className="flex gap-3 rounded-lg bg-neutral-50 p-4 dark:bg-neutral-800/70">
            <DNATraitIcon trait={trait} />
            <div className="min-w-0">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{trait.label}</p>
              <p className="mt-1 truncate font-semibold">{trait.value}</p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{traitContext(trait)}</p>
            </div>
          </div>
        ))}
      </div>
    </InsightBlock>
  )
}

function exposureCopy(type: ExposureType): { description: string; formula: string } {
  if (type === 'marketCaps') {
    return {
      description: 'Groups holdings by company market-cap bucket when market cap metadata is available. Funds, crypto, and missing market caps are shown separately.',
      formula: 'sum current market value in each bucket / total portfolio value.',
    }
  }
  return {
    description: 'Shows the current market-value split for this exposure dimension.',
    formula: 'group current market value / total portfolio value.',
  }
}

function exposureKind(exposureType: string): ContributionVisualKind {
  if (exposureType === 'theme') return 'theme'
  if (exposureType === 'sector') return 'sector'
  if (exposureType === 'country') return 'country'
  if (exposureType === 'currency') return 'currency'
  return 'generic'
}

function findingAsContribution(item: DuplicateExposureItemDTO | HiddenConcentrationItemDTO): ContributionItemDTO {
  return {
    name: item.label,
    value: 0,
    cost_basis: 0,
    unrealized_pnl: 0,
    unrealized_pnl_pct: 0,
    portfolio_weight: item.portfolio_weight,
    contribution_to_return: 0,
    count: item.count,
  }
}

function formatThemeAxisDate(value: string, locale: string, points: number): string {
  const date = new Date(value)
  if (points <= 6) {
    return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
  }
  return date.toLocaleDateString(locale, { month: 'short', year: 'numeric' })
}

function DNATraitIcon({ trait }: { trait: { label: string; value: string } }) {
  if (trait.label === 'Geographic tilt') {
    return <ContributionVisual item={dnaContributionItem(trait.value)} kind="country" />
  }
  if (trait.label === 'Theme profile') {
    return <ContributionVisual item={dnaContributionItem(trait.value)} kind="theme" />
  }
  if (trait.label === 'Currency tilt') {
    return <ContributionVisual item={dnaContributionItem(trait.value)} kind="currency" />
  }
  const Icon = trait.label === 'Concentration' ? Dna : trait.label === 'Instrument tilt' ? Tags : BarChart3
  return (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800">
      <Icon className="h-5 w-5 text-pink-600 dark:text-pink-400" />
    </div>
  )
}

function dnaContributionItem(name: string): ContributionItemDTO {
  return {
    name,
    value: 0,
    cost_basis: 0,
    unrealized_pnl: 0,
    unrealized_pnl_pct: 0,
    portfolio_weight: 0,
    contribution_to_return: 0,
    count: 1,
  }
}

function traitContext(trait: { label: string; score: number }): string {
  if (trait.label === 'Breadth') return `Effective positions: ${formatNumber(trait.score, 1)}`
  if (trait.label === 'Concentration') return `${formatPercent(trait.score, 1)} in largest holding`
  return `${formatPercent(trait.score, 1)} of portfolio`
}
