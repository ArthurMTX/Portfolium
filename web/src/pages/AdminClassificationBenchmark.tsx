import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Database,
  Filter,
  GitCompare,
  Loader,
  Play,
  Search,
  Tags,
} from 'lucide-react'
import api, {
  type AssetThemeDTO,
  type MiniLMBenchmarkCandidateDTO,
  type MiniLMBenchmarkDefinitionDTO,
  type MiniLMBenchmarkReportDTO,
  type MiniLMBenchmarkRowDTO,
  type ThemeGapAnalysisDTO,
  type ThemeRegistryDTO,
} from '../lib/api'
import { getThemeHexColor, getThemeIcon } from '../lib/themeUtils'

type MatchFilter = 'all' | 'matches' | 'mismatches'
type SortMode = 'delta-desc' | 'delta-asc' | 'minilm-confidence' | 'candidate-score' | 'symbol'

export default function AdminClassificationBenchmark() {
  const [limit, setLimit] = useState(50)
  const [symbols, setSymbols] = useState('')
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('delta-desc')
  const [report, setReport] = useState<MiniLMBenchmarkReportDTO | null>(null)
  const [gapAnalysis, setGapAnalysis] = useState<ThemeGapAnalysisDTO | null>(null)
  const [registry, setRegistry] = useState<ThemeRegistryDTO>({})
  const [loading, setLoading] = useState(false)
  const [metadataLoading, setMetadataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setMetadataLoading(true)
    Promise.all([api.getThemeRegistry(), api.getThemeGapAnalysis()])
      .then(([registryData, gapData]) => {
        if (!mounted) return
        setRegistry(registryData)
        setGapAnalysis(gapData)
      })
      .catch((err) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Failed to load taxonomy reports')
      })
      .finally(() => {
        if (mounted) setMetadataLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const runBenchmark = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getClassificationBenchmark({
        limit,
        symbols: symbols.trim() || undefined,
        retrieved_candidate_limit: 12,
      })
      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Benchmark failed')
    } finally {
      setLoading(false)
    }
  }

  const filteredRows = useMemo(() => {
    const rows = [...(report?.rows || [])]
    const filtered = rows.filter((row) => {
      if (matchFilter === 'matches') return row.parent_top5_match
      if (matchFilter === 'mismatches') return !row.parent_top5_match
      return true
    })
    filtered.sort((left, right) => {
      if (sortMode === 'symbol') return left.symbol.localeCompare(right.symbol)
      if (sortMode === 'minilm-confidence') {
        return (right.minilm_top_confidence ?? -1) - (left.minilm_top_confidence ?? -1)
      }
      if (sortMode === 'candidate-score') {
        return topCandidateScore(right) - topCandidateScore(left)
      }
      const leftDelta = left.confidence_delta ?? 0
      const rightDelta = right.confidence_delta ?? 0
      return sortMode === 'delta-asc' ? leftDelta - rightDelta : rightDelta - leftDelta
    })
    return filtered
  }, [matchFilter, report?.rows, sortMode])

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-6 dark:bg-neutral-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
              <GitCompare size={18} />
              Classification Benchmark
            </div>
            <h1 className="text-2xl font-semibold text-neutral-950 dark:text-neutral-50">
              Gemini vs MiniLM Evaluation
            </h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
              <Search size={16} className="text-neutral-500" />
              <input
                value={symbols}
                onChange={(event) => setSymbols(event.target.value)}
                placeholder="Symbols"
                className="w-44 bg-transparent outline-none placeholder:text-neutral-400"
              />
            </label>
            <label className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
              <Database size={16} className="text-neutral-500" />
              <input
                value={limit}
                onChange={(event) => setLimit(Math.max(1, Number(event.target.value) || 1))}
                type="number"
                min={1}
                max={200}
                className="w-20 bg-transparent outline-none"
              />
            </label>
            <button
              type="button"
              onClick={runBenchmark}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white"
            >
              {loading ? <Loader size={16} className="animate-spin" /> : <Play size={16} />}
              Run
            </button>
          </div>
        </header>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<GitCompare size={18} />}
            label="Top1 Parent"
            value={formatRate(report?.metrics.top1_parent_agreement)}
          />
          <MetricCard
            icon={<GitCompare size={18} />}
            label="Top3 Parent"
            value={formatRate(report?.metrics.top3_parent_agreement)}
          />
          <MetricCard
            icon={<Tags size={18} />}
            label="Top1 Subtheme"
            value={formatRate(report?.metrics.top1_subtheme_agreement)}
          />
          <MetricCard
            icon={<Activity size={18} />}
            label="Avg Runtime"
            value={report ? `${report.metrics.average_runtime_ms} ms` : '-'}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <DistributionPanel
            title="Theme Confidence"
            items={report?.metrics.theme_confidence_distribution || []}
          />
          <DistributionPanel
            title="Candidate Scores"
            items={report?.metrics.candidate_score_distribution || []}
          />
        </section>

        <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              <Filter size={17} />
              Results
              {report && (
                <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  {filteredRows.length}/{report.rows.length}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={matchFilter}
                onChange={(event) => setMatchFilter(event.target.value as MatchFilter)}
                className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              >
                <option value="all">All</option>
                <option value="matches">Matches</option>
                <option value="mismatches">Mismatches</option>
              </select>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              >
                <option value="delta-desc">Delta high to low</option>
                <option value="delta-asc">Delta low to high</option>
                <option value="minilm-confidence">MiniLM confidence</option>
                <option value="candidate-score">Candidate score</option>
                <option value="symbol">Symbol</option>
              </select>
            </div>
          </div>

          {!report && (
            <div className="rounded-md border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
              {loading ? 'Running benchmark...' : 'No benchmark report loaded'}
            </div>
          )}

          {report && (
            <div className="flex flex-col gap-3">
              {filteredRows.map((row) => (
                <BenchmarkRow key={row.symbol} row={row} registry={registry} />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            <BarChart3 size={17} />
            Gap Analysis
            {metadataLoading && <Loader size={14} className="animate-spin text-neutral-500" />}
          </div>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <GapList title="Themes Never Assigned" rows={gapAnalysis?.themes_never_assigned || []} />
            <GapList title="Subthemes Never Assigned" rows={gapAnalysis?.subthemes_never_assigned || []} />
            <GapList title="Themes Under 3 Assets" rows={gapAnalysis?.themes_under_3_assets || []} />
            <GapList title="Themes Over 50 Assets" rows={gapAnalysis?.themes_over_50_assets || []} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <SuggestionList
              title="Frequent Theme Suggestions"
              rows={gapAnalysis?.most_frequent_taxonomy_suggestions || []}
              labelKey="theme"
            />
            <SuggestionList
              title="Frequent Subtheme Suggestions"
              rows={gapAnalysis?.most_frequent_subtheme_suggestions || []}
              labelKey="subtheme"
            />
          </div>
        </section>
      </div>
    </div>
  )
}

function BenchmarkRow({ row, registry }: { row: MiniLMBenchmarkRowDTO; registry: ThemeRegistryDTO }) {
  const topCandidate = row.retrieved_candidates[0]
  return (
    <article className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-neutral-950 dark:text-neutral-50">{row.symbol}</span>
            <span className="truncate text-sm text-neutral-600 dark:text-neutral-300">{row.company_name}</span>
            <MatchBadge matched={row.parent_top5_match} />
          </div>
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {[row.sector, row.industry].filter(Boolean).join(' / ') || 'Unclassified sector'}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right text-xs sm:grid-cols-4">
          <Stat label="Gemini" value={formatPercent(row.gemini_top_confidence)} />
          <Stat label="MiniLM" value={formatPercent(row.minilm_top_confidence)} />
          <Stat label="Delta" value={formatDelta(row.confidence_delta)} />
          <Stat label="Score" value={topCandidate ? topCandidate.score.toFixed(3) : '-'} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Gemini</div>
          <ThemePills themes={row.gemini_themes} />
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">MiniLM</div>
          <ThemePills themes={row.minilm_themes} />
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{row.summary_excerpt}</p>

      <details className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <summary className="cursor-pointer text-sm font-medium text-neutral-800 dark:text-neutral-200">
          Candidates and definitions
        </summary>
        <div className="mt-3 grid gap-4 xl:grid-cols-2">
          <CandidateList candidates={row.retrieved_candidates} />
          <DefinitionsList definitions={row.definitions_used} registry={registry} />
        </div>
      </details>
    </article>
  )
}

function ThemePills({ themes }: { themes: AssetThemeDTO[] }) {
  if (!themes?.length) return <span className="text-sm text-neutral-400">None</span>
  return (
    <div className="flex flex-wrap gap-2">
      {themes.map((theme) => {
        const Icon = getThemeIcon(theme.label)
        const color = getThemeHexColor(theme.label)
        return (
          <div
            key={theme.label}
            className="flex max-w-full flex-col gap-1 rounded-md border px-2.5 py-2"
            style={{ borderColor: `${color}55`, backgroundColor: `${color}10` }}
          >
            <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color }}>
              <Icon size={14} className="shrink-0" />
              <span className="truncate">{theme.label}</span>
              <span className="text-xs opacity-80">{formatPercent(theme.confidence)}</span>
            </div>
            {!!theme.children?.length && (
              <div className="flex flex-wrap gap-1">
                {theme.children.map((child) => (
                  <span
                    key={child.label}
                    className="rounded border border-neutral-200 bg-white/70 px-1.5 py-0.5 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950/60 dark:text-neutral-200"
                  >
                    {child.label} {formatPercent(child.confidence)}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function CandidateList({ candidates }: { candidates: MiniLMBenchmarkCandidateDTO[] }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Retrieved Candidates</div>
      <div className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
        {candidates.map((candidate) => (
          <div
            key={`${candidate.parent_label}-${candidate.label}`}
            className="grid grid-cols-[1fr_auto] gap-3 border-b border-neutral-100 px-3 py-2 text-sm last:border-b-0 dark:border-neutral-800"
          >
            <div className="min-w-0">
              <div className="truncate font-medium text-neutral-900 dark:text-neutral-100">{candidate.label}</div>
              <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">{candidate.parent_label}</div>
            </div>
            <div className="font-mono text-xs text-neutral-600 dark:text-neutral-300">{candidate.score.toFixed(4)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DefinitionsList({
  definitions,
  registry,
}: {
  definitions: MiniLMBenchmarkDefinitionDTO[]
  registry: ThemeRegistryDTO
}) {
  const rows = definitions.length
    ? definitions
    : Object.entries(registry).slice(0, 5).map(([theme, payload]) => ({
        theme,
        definition: payload.definition,
        subthemes: Object.entries(payload.subthemes).map(([subtheme, definition]) => ({ subtheme, definition })),
      }))

  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Definitions Used</div>
      <div className="max-h-96 overflow-auto rounded-md border border-neutral-200 dark:border-neutral-800">
        {rows.map((item) => (
          <div key={item.theme} className="border-b border-neutral-100 px-3 py-3 last:border-b-0 dark:border-neutral-800">
            <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{item.theme}</div>
            <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{item.definition}</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {item.subthemes.map((subtheme) => (
                <div key={`${item.theme}-${subtheme.subtheme}`} className="text-xs text-neutral-600 dark:text-neutral-300">
                  <span className="font-medium text-neutral-800 dark:text-neutral-100">{subtheme.subtheme}:</span>{' '}
                  {subtheme.definition}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold text-neutral-950 dark:text-neutral-50">{value}</div>
    </div>
  )
}

function DistributionPanel({ title, items }: { title: string; items: Array<{ bucket: string; count: number }> }) {
  const max = Math.max(1, ...items.map((item) => item.count))
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</div>
      <div className="flex h-32 items-end gap-1">
        {items.map((item) => (
          <div key={item.bucket} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-blue-500/70 dark:bg-blue-400/70"
              style={{ height: `${Math.max(4, (item.count / max) * 100)}%` }}
              title={`${item.bucket}: ${item.count}`}
            />
            <span className="hidden text-[10px] text-neutral-500 sm:block">{item.bucket.slice(0, 3)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function GapList({ title, rows }: { title: string; rows: Array<Record<string, string | number>> }) {
  return (
    <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</div>
      <div className="max-h-56 overflow-auto">
        {rows.slice(0, 30).map((row, index) => (
          <div key={`${title}-${index}`} className="flex justify-between gap-3 py-1 text-xs text-neutral-600 dark:text-neutral-300">
            <span className="min-w-0 truncate">{String(row.theme || row.subtheme)}</span>
            <span className="font-mono">{row.asset_count}</span>
          </div>
        ))}
        {!rows.length && <div className="text-xs text-neutral-400">None</div>}
      </div>
    </div>
  )
}

function SuggestionList({
  title,
  rows,
  labelKey,
}: {
  title: string
  rows: Array<Record<string, string | number>>
  labelKey: 'theme' | 'subtheme'
}) {
  return (
    <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</div>
      <div className="grid gap-1 sm:grid-cols-2">
        {rows.slice(0, 20).map((row) => (
          <div key={`${labelKey}-${row[labelKey]}`} className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-neutral-700 dark:text-neutral-300">{String(row[labelKey])}</span>
            <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              {row.count}
            </span>
          </div>
        ))}
        {!rows.length && <div className="text-xs text-neutral-400">None</div>}
      </div>
    </div>
  )
}

function MatchBadge({ matched }: { matched: boolean }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${
        matched
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
          : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
      }`}
    >
      {matched ? 'Match' : 'Mismatch'}
    </span>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className="font-mono text-neutral-900 dark:text-neutral-100">{value}</div>
    </div>
  )
}

function topCandidateScore(row: MiniLMBenchmarkRowDTO) {
  return row.retrieved_candidates[0]?.score ?? -1
}

function formatRate(value?: number | null) {
  if (value == null) return '-'
  return `${Math.round(value * 100)}%`
}

function formatPercent(value?: number | null) {
  if (value == null) return '-'
  return `${Math.round(value * 100)}%`
}

function formatDelta(value?: number | null) {
  if (value == null) return '-'
  const sign = value > 0 ? '+' : ''
  return `${sign}${Math.round(value * 100)}%`
}
