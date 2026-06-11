import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Clipboard,
  EyeOff,
  Loader,
  Play,
  Search,
  Tags,
  X,
} from 'lucide-react'
import api, {
  type AssetThemeClassifyResultDTO,
  type AssetThemeDTO,
  type AssetThemeTaxonomySuggestionDTO,
  type AssetThemeTaxonomySuggestionStatsDTO,
  type AssetThemeTaxonomySuggestionStatus,
} from '../lib/api'
import { getThemeHexColor, getThemeIcon } from '../lib/themeUtils'

type Tab = 'suggestions' | 'classify'
type ClassifyLogStatus = 'queued' | 'running' | 'classified' | 'skipped' | 'failed'

type ClassifyLogEntry = {
  symbol: string
  status: ClassifyLogStatus
  message: string
  startedAt?: number
  completedAt?: number
  durationMs?: number
}

type ClassifyProgress = {
  total: number
  completed: number
  classified: number
  skipped: number
  failed: number
}

const statuses: Array<AssetThemeTaxonomySuggestionStatus | 'all'> = [
  'pending',
  'accepted',
  'rejected',
  'ignored',
  'all',
]

export default function AdminThemeTaxonomy() {
  const [activeTab, setActiveTab] = useState<Tab>('suggestions')
  const [status, setStatus] = useState<AssetThemeTaxonomySuggestionStatus | 'all'>('pending')
  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState<AssetThemeTaxonomySuggestionDTO[]>([])
  const [stats, setStats] = useState<AssetThemeTaxonomySuggestionStatsDTO | null>(null)
  const [loading, setLoading] = useState(false)
  const [noteById, setNoteById] = useState<Record<number, string>>({})
  const [singleSymbol, setSingleSymbol] = useState('')
  const [bulkSymbols, setBulkSymbols] = useState('')
  const [force, setForce] = useState(false)
  const [missingOnly, setMissingOnly] = useState(true)
  const [classifying, setClassifying] = useState(false)
  const [classifyResults, setClassifyResults] = useState<AssetThemeClassifyResultDTO[]>([])
  const [classifyLog, setClassifyLog] = useState<ClassifyLogEntry[]>([])
  const [classifyProgress, setClassifyProgress] = useState<ClassifyProgress>({
    total: 0,
    completed: 0,
    classified: 0,
    skipped: 0,
    failed: 0,
  })
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null)
  const [activeStartedAt, setActiveStartedAt] = useState<number | null>(null)
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!classifying) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [classifying])

  useEffect(() => {
    loadSuggestions()
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const filteredSuggestions = useMemo(() => suggestions, [suggestions])

  const loadSuggestions = async () => {
    setLoading(true)
    try {
      const data = await api.getThemeTaxonomySuggestions({ status, search, limit: 100 })
      setSuggestions(data)
      setNoteById(Object.fromEntries(data.map((item) => [item.id, item.reviewer_note || ''])))
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    const data = await api.getThemeTaxonomySuggestionStats()
    setStats(data)
  }

  const updateSuggestion = async (id: number, nextStatus: AssetThemeTaxonomySuggestionStatus) => {
    const updated = await api.updateThemeTaxonomySuggestion(id, {
      status: nextStatus,
      reviewer_note: noteById[id] || null,
    })
    setSuggestions((items) => items.map((item) => (item.id === id ? updated : item)))
    loadStats()
  }

  const copySnippet = async (suggestion: AssetThemeTaxonomySuggestionDTO) => {
    const subthemes = suggestion.suggested_subthemes.map((item) => `    "${item}",`).join('\n')
    await navigator.clipboard.writeText(`"${suggestion.suggested_theme}": (\n${subthemes}\n),`)
  }

  const parsedSymbols = useMemo(() => {
    return [singleSymbol, bulkSymbols]
      .join('\n')
      .split(/[\s,]+/)
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean)
      .filter((item, index, array) => array.indexOf(item) === index)
  }, [singleSymbol, bulkSymbols])

  const classify = async (override?: { force?: boolean; missing_only?: boolean }) => {
    const symbols = parsedSymbols
    if (!symbols.length || classifying) return

    const runForce = override?.force ?? force
    const runMissingOnly = override?.missing_only ?? missingOnly
    const startedAt = Date.now()

    setClassifying(true)
    setRunStartedAt(startedAt)
    setActiveSymbol(null)
    setActiveStartedAt(null)
    setClassifyResults([])
    setClassifyProgress({
      total: symbols.length,
      completed: 0,
      classified: 0,
      skipped: 0,
      failed: 0,
    })
    setClassifyLog(
      symbols.map((symbol) => ({
        symbol,
        status: 'queued',
        message: 'Queued',
      }))
    )

    const results: AssetThemeClassifyResultDTO[] = []
    let classified = 0
    let skipped = 0
    let failed = 0

    try {
      for (let index = 0; index < symbols.length; index += 1) {
        const symbol = symbols[index]
        const symbolStartedAt = Date.now()
        setActiveSymbol(symbol)
        setActiveStartedAt(symbolStartedAt)
        setClassifyLog((items) =>
          items.map((item) =>
            item.symbol === symbol
              ? {
                  ...item,
                  status: 'running',
                  message: `Running ${index + 1}/${symbols.length}: Yahoo info + Gemini`,
                  startedAt: symbolStartedAt,
                }
              : item
          )
        )

        try {
          const response = await api.classifyAssetThemes({
            symbols: [symbol],
            force: runForce,
            missing_only: runMissingOnly,
          })
          const completedAt = Date.now()
          const durationMs = completedAt - symbolStartedAt
          const result = response.results[0] || {
            symbol,
            status: 'failed',
            company_name: null,
            themes: [],
            taxonomy_gap: null,
            failure_reason: 'Classification returned no result',
          }
          const resultWithDuration: AssetThemeClassifyResultDTO = { ...result, duration_ms: durationMs }

          if (result.status === 'classified') classified += 1
          else if (result.status === 'skipped') skipped += 1
          else failed += 1

          results.push(resultWithDuration)
          setClassifyResults([...results])
          setClassifyProgress({
            total: symbols.length,
            completed: results.length,
            classified,
            skipped,
            failed,
          })
          setClassifyLog((items) =>
            items.map((item) =>
              item.symbol === symbol
                ? {
                    ...item,
                    status: classifyLogStatus(result.status),
                    message: classifyResultMessage(resultWithDuration),
                    completedAt,
                    durationMs,
                  }
                : item
            )
          )
        } catch (error) {
          const completedAt = Date.now()
          const durationMs = completedAt - symbolStartedAt
          const result: AssetThemeClassifyResultDTO = {
            symbol,
            status: 'failed',
            company_name: null,
            themes: [],
            taxonomy_gap: null,
            duration_ms: durationMs,
            failure_reason: errorMessage(error),
          }

          failed += 1
          results.push(result)
          setClassifyResults([...results])
          setClassifyProgress({
            total: symbols.length,
            completed: results.length,
            classified,
            skipped,
            failed,
          })
          setClassifyLog((items) =>
            items.map((item) =>
              item.symbol === symbol
                ? {
                    ...item,
                    status: 'failed',
                    message: errorMessage(error),
                    completedAt,
                    durationMs,
                  }
                : item
            )
          )
        }
      }

      setActiveSymbol(null)
      setActiveStartedAt(null)
      try {
        await Promise.all([loadSuggestions(), loadStats()])
      } catch (error) {
        setClassifyLog((items) => [
          ...items,
          {
            symbol: 'REFRESH',
            status: 'failed',
            message: `Suggestions refresh failed: ${errorMessage(error)}`,
            completedAt: Date.now(),
          },
        ])
      }
    } finally {
      setNow(Date.now())
      setClassifying(false)
      setActiveSymbol(null)
      setActiveStartedAt(null)
    }
  }

  const count = (key: AssetThemeTaxonomySuggestionStatus) => stats?.counts_by_status?.[key] || 0
  const progressPercent = classifyProgress.total
    ? Math.round((classifyProgress.completed / classifyProgress.total) * 100)
    : 0
  const activeElapsedMs = activeStartedAt ? now - activeStartedAt : null
  const runElapsedMs = runStartedAt ? now - runStartedAt : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            <Tags className="text-blue-600" size={28} />
            Theme Taxonomy
          </h1>
        </div>
        <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900">
          <button
            type="button"
            onClick={() => setActiveTab('suggestions')}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              activeTab === 'suggestions'
                ? 'bg-blue-600 text-white'
                : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
            }`}
          >
            Taxonomy Suggestions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('classify')}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              activeTab === 'classify'
                ? 'bg-blue-600 text-white'
                : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
            }`}
          >
            Classify Assets
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Pending Suggestions" value={count('pending')} tone="amber" />
        <SummaryCard label="Accepted Suggestions" value={count('accepted')} tone="green" />
        <SummaryCard label="Rejected Suggestions" value={count('rejected')} tone="red" />
        <SummaryCard label="Ignored Suggestions" value={count('ignored')} tone="neutral" />
      </div>

      {activeTab === 'suggestions' ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') loadSuggestions()
                }}
                className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-10 pr-3 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                placeholder="Search"
              />
            </div>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as AssetThemeTaxonomySuggestionStatus | 'all')}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            >
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button type="button" onClick={loadSuggestions} className="btn-primary">
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
              <Loader className="animate-spin" size={18} />
              Loading
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSuggestions.map((suggestion) => (
                <SuggestionRow
                  key={suggestion.id}
                  suggestion={suggestion}
                  note={noteById[suggestion.id] || ''}
                  onNoteChange={(note) => setNoteById((notes) => ({ ...notes, [suggestion.id]: note }))}
                  onUpdate={(nextStatus) => updateSuggestion(suggestion.id, nextStatus)}
                  onCopy={() => copySnippet(suggestion)}
                />
              ))}
              {!filteredSuggestions.length && (
                <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
                  No suggestions found.
                </div>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <div className="grid gap-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900 lg:grid-cols-[280px_1fr]">
            <div>
              <label className="mb-2 block text-sm font-medium">Ticker</label>
              <input
                value={singleSymbol}
                onChange={(event) => setSingleSymbol(event.target.value)}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                placeholder="HZO"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Bulk Tickers</label>
              <textarea
                value={bulkSymbols}
                onChange={(event) => setBulkSymbols(event.target.value)}
                rows={4}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                placeholder="FMCC, MC.PA"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={force} onChange={(event) => setForce(event.target.checked)} />
              Force refresh
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={missingOnly}
                onChange={(event) => setMissingOnly(event.target.checked)}
              />
              Classify missing only
            </label>
            <div className="flex flex-wrap gap-2 lg:col-span-2">
              <button type="button" onClick={() => classify()} disabled={classifying} className="btn-primary inline-flex items-center gap-2">
                {classifying ? <Loader className="animate-spin" size={16} /> : <Play size={16} />}
                {classifying ? `Classifying ${classifyProgress.completed}/${classifyProgress.total}` : 'Classify'}
              </button>
              <button
                type="button"
                onClick={() => classify({ force: false, missing_only: true })}
                disabled={classifying}
                className="btn-secondary"
              >
                Classify Missing
              </button>
              <button
                type="button"
                onClick={() => classify({ force: true, missing_only: false })}
                disabled={classifying}
                className="btn-secondary"
              >
                Force Refresh
              </button>
            </div>
          </div>

          {!!classifyLog.length && (
            <ClassifyRunPanel
              classifying={classifying}
              progress={classifyProgress}
              progressPercent={progressPercent}
              activeSymbol={activeSymbol}
              activeElapsedMs={activeElapsedMs}
              runElapsedMs={runElapsedMs}
              log={classifyLog}
            />
          )}

          <div className="space-y-3">
            {classifyResults.map((result) => (
              <ClassifyResult key={result.symbol} result={result} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function ClassifyRunPanel({
  classifying,
  progress,
  progressPercent,
  activeSymbol,
  activeElapsedMs,
  runElapsedMs,
  log,
}: {
  classifying: boolean
  progress: ClassifyProgress
  progressPercent: number
  activeSymbol: string | null
  activeElapsedMs: number | null
  runElapsedMs: number | null
  log: ClassifyLogEntry[]
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {classifying ? 'Classification running' : 'Classification finished'}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {progress.completed}/{progress.total} complete
            {activeSymbol && activeElapsedMs !== null ? ` · ${activeSymbol} ${formatDuration(activeElapsedMs)}` : ''}
            {runElapsedMs !== null ? ` · run ${formatDuration(runElapsedMs)}` : ''}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <RunCount label="Classified" value={progress.classified} tone="green" />
          <RunCount label="Skipped" value={progress.skipped} tone="neutral" />
          <RunCount label="Failed" value={progress.failed} tone="red" />
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800">
        <div
          className="h-full rounded bg-pink-500 transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-4 max-h-72 overflow-y-auto rounded border border-neutral-200 dark:border-neutral-800">
        {log.map((entry) => (
          <div
            key={entry.symbol}
            className="grid gap-2 border-b border-neutral-100 px-3 py-2 text-sm last:border-b-0 dark:border-neutral-800 sm:grid-cols-[92px_120px_1fr_72px]"
          >
            <span className="font-mono font-semibold">{entry.symbol}</span>
            <span className={`w-fit rounded px-2 py-0.5 text-xs ${logStatusClass(entry.status)}`}>
              {entry.status}
            </span>
            <span className="min-w-0 text-neutral-600 dark:text-neutral-300">{entry.message}</span>
            <span className="text-right text-xs text-neutral-500 dark:text-neutral-400">
              {entry.durationMs !== undefined ? formatDuration(entry.durationMs) : ''}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

function RunCount({ label, value, tone }: { label: string; value: number; tone: 'green' | 'red' | 'neutral' }) {
  const color =
    tone === 'green'
      ? 'text-green-700 dark:text-green-300'
      : tone === 'red'
        ? 'text-red-700 dark:text-red-300'
        : 'text-neutral-700 dark:text-neutral-300'

  return (
    <div className="rounded border border-neutral-200 px-3 py-1 dark:border-neutral-800">
      <div className={`font-semibold ${color}`}>{value}</div>
      <div className="text-neutral-500 dark:text-neutral-400">{label}</div>
    </div>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  const color =
    tone === 'amber'
      ? 'text-amber-700 dark:text-amber-300'
      : tone === 'green'
        ? 'text-green-700 dark:text-green-300'
        : tone === 'red'
          ? 'text-red-700 dark:text-red-300'
          : 'text-neutral-700 dark:text-neutral-300'

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-neutral-500 dark:text-neutral-400">{label}</div>
    </div>
  )
}

function SuggestionRow({
  suggestion,
  note,
  onNoteChange,
  onUpdate,
  onCopy,
}: {
  suggestion: AssetThemeTaxonomySuggestionDTO
  note: string
  onNoteChange: (note: string) => void
  onUpdate: (status: AssetThemeTaxonomySuggestionStatus) => void
  onCopy: () => void
}) {
  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">{suggestion.suggested_theme}</span>
            <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              {Math.round(suggestion.confidence * 100)}%
            </span>
            <span className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              {suggestion.status}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestion.suggested_subthemes.map((subtheme) => (
              <span key={subtheme} className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {subtheme}
              </span>
            ))}
          </div>
          <p className="text-sm text-neutral-700 dark:text-neutral-300">{suggestion.reason}</p>
          <div className="grid gap-2 text-xs text-neutral-500 dark:text-neutral-400 md:grid-cols-2 xl:grid-cols-4">
            <span>{suggestion.symbol}</span>
            <span>{suggestion.company_name || '-'}</span>
            <span>{suggestion.sector || '-'}</span>
            <span>{suggestion.industry || '-'}</span>
          </div>
          {suggestion.summary_excerpt && (
            <p className="line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">{suggestion.summary_excerpt}</p>
          )}
          <ThemePills themes={suggestion.current_themes} />
          <div className="text-xs text-neutral-400">{new Date(suggestion.created_at).toLocaleString()}</div>
        </div>
        <div className="flex min-w-64 flex-col gap-2">
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={2}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            placeholder="Reviewer note"
          />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onUpdate('accepted')} className="btn-secondary inline-flex items-center justify-center gap-2">
              <Check size={16} />
              Accept
            </button>
            <button type="button" onClick={() => onUpdate('rejected')} className="btn-secondary inline-flex items-center justify-center gap-2">
              <X size={16} />
              Reject
            </button>
            <button type="button" onClick={() => onUpdate('ignored')} className="btn-secondary inline-flex items-center justify-center gap-2">
              <EyeOff size={16} />
              Ignore
            </button>
            <button type="button" onClick={onCopy} className="btn-secondary inline-flex items-center justify-center gap-2">
              <Clipboard size={16} />
              Copy
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

function ClassifyResult({ result }: { result: AssetThemeClassifyResultDTO }) {
  const failed = result.status === 'failed'
  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{result.symbol}</span>
        <span className="text-neutral-500">{result.company_name || '-'}</span>
        <span className={`rounded px-2 py-1 text-xs ${failed ? 'bg-red-100 text-red-700' : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'}`}>
          {result.status}
        </span>
        {result.taxonomy_gap?.hasGap && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-1 text-xs text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <AlertTriangle size={13} />
            Taxonomy gap
          </span>
        )}
        {result.duration_ms !== undefined && (
          <span className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {formatDuration(result.duration_ms)}
          </span>
        )}
      </div>
      <ThemePills themes={result.themes} />
      {result.taxonomy_gap?.hasGap && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="font-medium">{result.taxonomy_gap.suggestedTheme}</div>
          <div>{result.taxonomy_gap.reason}</div>
        </div>
      )}
      {(result.failure_reason || result.skipped_reason) && (
        <div className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          {result.failure_reason || result.skipped_reason}
        </div>
      )}
    </article>
  )
}

function classifyResultMessage(result: AssetThemeClassifyResultDTO) {
  if (result.status === 'classified') {
    const labels = result.themes.map((theme) => theme.label).join(', ')
    return labels ? `Classified: ${labels}` : 'Classified with no stored themes'
  }
  if (result.status === 'skipped') {
    return result.skipped_reason || 'Skipped'
  }
  return result.failure_reason || 'Failed'
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Classification failed'
}

function classifyLogStatus(status: string): ClassifyLogStatus {
  if (status === 'classified' || status === 'skipped') return status
  return 'failed'
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return `${minutes}m ${remainingSeconds}s`
}

function logStatusClass(status: ClassifyLogStatus) {
  if (status === 'running') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
  if (status === 'classified') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
  if (status === 'skipped') return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
  if (status === 'failed') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
  return 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
}

function ThemePills({ themes }: { themes?: AssetThemeDTO[] }) {
  if (!themes?.length) {
    return <div className="mt-2 text-xs text-neutral-400">No stored themes</div>
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {themes.map((theme) => {
        const Icon = getThemeIcon(theme.label)
        const color = getThemeHexColor(theme.label)
        return (
          <span
            key={theme.label}
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium"
            style={{ color, borderColor: `${color}66`, backgroundColor: `${color}14` }}
          >
            <Icon size={13} />
            {theme.label}
          </span>
        )
      })}
    </div>
  )
}
