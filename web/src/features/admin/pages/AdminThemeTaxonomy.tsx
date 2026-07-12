import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Clipboard,
  EyeOff,
  Loader,
  Play,
  RefreshCw,
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
} from '@/api'
import {
  PageControls,
  PageHeader,
  PageMainColumn,
  PageMainGrid,
  PageMetric,
  PageMetricStrip,
  PageSection,
  PageSectionHeader,
  PageShell,
  PageSummaryPanel,
  PageTabs,
  PageTitleBlock,
} from '@/shared/components/PageLayout'
import { getThemeHexColor, getThemeIcon } from '@/shared/lib/themeUtils'
import '@/shared/design/pages/admin.css'

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
                  message: `Running ${index + 1}/${symbols.length}: Yahoo info + classifier`,
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

  const activeTabLabel = activeTab === 'suggestions' ? 'Taxonomy Suggestions' : 'Classify Assets'

  return (
    <PageShell className="admin-page admin-page--taxonomy">
      <PageHeader>
        <PageTitleBlock
          kicker="Admin"
          title="Theme Taxonomy"
          description="Review AI-proposed taxonomy gaps and run controlled theme classification jobs."
        />
        <PageSummaryPanel
          lead={activeTabLabel}
          description={`${count('pending')} pending suggestions · ${suggestions.length} loaded`}
        />
      </PageHeader>

      <PageMetricStrip label="Theme taxonomy review status">
        <PageMetric label="Pending" value={count('pending')} detail="Needs review" detailTone="neutral" />
        <PageMetric label="Accepted" value={count('accepted')} tone="positive" />
        <PageMetric label="Rejected" value={count('rejected')} tone="negative" />
        <PageMetric label="Ignored" value={count('ignored')} />
      </PageMetricStrip>

      <PageControls
        label="Theme taxonomy controls"
        start={
          <PageTabs label="Theme taxonomy tools">
            <button
              type="button"
              onClick={() => setActiveTab('suggestions')}
              className={activeTab === 'suggestions' ? 'is-active' : undefined}
            >
              <Tags aria-hidden="true" />
              Taxonomy Suggestions
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('classify')}
              className={activeTab === 'classify' ? 'is-active' : undefined}
            >
              <Play aria-hidden="true" />
              Classify Assets
            </button>
          </PageTabs>
        }
        end={
          activeTab === 'suggestions' ? (
            <>
              <label className="pf-search admin-page__taxonomy-search">
                <Search aria-hidden="true" size={18} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') loadSuggestions()
                  }}
                  placeholder="Search"
                />
              </label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as AssetThemeTaxonomySuggestionStatus | 'all')}
                className="pf-select admin-page__taxonomy-status-select"
              >
                {statuses.map((item) => (
                  <option key={item} value={item}>
                    {statusLabel(item)}
                  </option>
                ))}
              </select>
              <button type="button" onClick={loadSuggestions} className="pf-button pf-button--primary">
                <RefreshCw aria-hidden="true" size={16} />
                Refresh
              </button>
            </>
          ) : null
        }
      />

      <PageMainGrid single>
        <PageMainColumn>
          {activeTab === 'suggestions' ? (
            <PageSection className="admin-page__section">
              <PageSectionHeader
                title="Suggested taxonomy gaps"
                description="Curate new parent themes and subthemes before they enter the production taxonomy."
                aside={`${filteredSuggestions.length} suggestions`}
              />

              {loading ? (
                <div className="admin-page__loading">
                  <Loader className="animate-spin" size={18} />
                  Loading
                </div>
              ) : (
                <div className="admin-page__taxonomy-list">
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
                    <div className="pf-empty-state">
                      No suggestions found.
                    </div>
                  )}
                </div>
              )}
            </PageSection>
          ) : (
            <PageSection className="admin-page__section">
              <PageSectionHeader
                title="Classification run"
                description="Queue one or more tickers and keep each request visible while it runs."
                aside={classifying ? `${classifyProgress.completed}/${classifyProgress.total} complete` : undefined}
              />

              <div className="admin-page__taxonomy-classify-panel">
                <div className="pf-field">
                  <label className="pf-field-label">Ticker</label>
                  <input
                    value={singleSymbol}
                    onChange={(event) => setSingleSymbol(event.target.value)}
                    className="pf-input"
                    placeholder="HZO"
                  />
                </div>
                <div className="pf-field admin-page__taxonomy-bulk-field">
                  <label className="pf-field-label">Bulk Tickers</label>
                  <textarea
                    value={bulkSymbols}
                    onChange={(event) => setBulkSymbols(event.target.value)}
                    rows={4}
                    className="pf-textarea"
                    placeholder="FMCC, MC.PA"
                  />
                </div>
                <label className="pf-switch admin-page__taxonomy-switch">
                  <input type="checkbox" checked={force} onChange={(event) => setForce(event.target.checked)} />
                  <span className="pf-switch-track" aria-hidden="true" />
                  <span>Force refresh</span>
                </label>
                <label className="pf-switch admin-page__taxonomy-switch">
                  <input
                    type="checkbox"
                    checked={missingOnly}
                    onChange={(event) => setMissingOnly(event.target.checked)}
                  />
                  <span className="pf-switch-track" aria-hidden="true" />
                  <span>Classify missing only</span>
                </label>
                <div className="admin-page__taxonomy-actions">
                  <button type="button" onClick={() => classify()} disabled={classifying} className="pf-button pf-button--primary">
                    {classifying ? <Loader className="animate-spin" size={16} /> : <Play size={16} />}
                    {classifying ? `Classifying ${classifyProgress.completed}/${classifyProgress.total}` : 'Classify'}
                  </button>
                  <button
                    type="button"
                    onClick={() => classify({ force: false, missing_only: true })}
                    disabled={classifying}
                    className="pf-button pf-button--secondary"
                  >
                    Classify Missing
                  </button>
                  <button
                    type="button"
                    onClick={() => classify({ force: true, missing_only: false })}
                    disabled={classifying}
                    className="pf-button pf-button--secondary"
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

              <div className="admin-page__taxonomy-list">
                {classifyResults.map((result) => (
                  <ClassifyResult key={result.symbol} result={result} />
                ))}
              </div>
            </PageSection>
          )}
        </PageMainColumn>
      </PageMainGrid>
    </PageShell>
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
    <section className="admin-page__taxonomy-run-panel">
      <div className="admin-page__taxonomy-run-header">
        <div>
          <div className="admin-page__taxonomy-run-title">
            {classifying ? 'Classification running' : 'Classification finished'}
          </div>
          <div className="admin-page__taxonomy-run-meta">
            {progress.completed}/{progress.total} complete
            {activeSymbol && activeElapsedMs !== null ? ` · ${activeSymbol} ${formatDuration(activeElapsedMs)}` : ''}
            {runElapsedMs !== null ? ` · run ${formatDuration(runElapsedMs)}` : ''}
          </div>
        </div>
        <div className="admin-page__taxonomy-run-counts">
          <RunCount label="Classified" value={progress.classified} tone="success" />
          <RunCount label="Skipped" value={progress.skipped} tone="neutral" />
          <RunCount label="Failed" value={progress.failed} tone="danger" />
        </div>
      </div>

      <div className="admin-page__taxonomy-progress" aria-label={`${progressPercent}% complete`}>
        <div
          className="admin-page__taxonomy-progress-bar"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="admin-page__taxonomy-log">
        {log.map((entry) => (
          <div
            key={entry.symbol}
            className="admin-page__taxonomy-log-row"
          >
            <span className="admin-page__taxonomy-symbol">{entry.symbol}</span>
            <span className={`admin-page__taxonomy-status ${logStatusClass(entry.status)}`}>
              {entry.status}
            </span>
            <span className="admin-page__taxonomy-log-message">{entry.message}</span>
            <span className="admin-page__taxonomy-duration">
              {entry.durationMs !== undefined ? formatDuration(entry.durationMs) : ''}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

function RunCount({ label, value, tone }: { label: string; value: number; tone: 'success' | 'danger' | 'neutral' }) {
  return (
    <div className={`admin-page__taxonomy-run-count is-${tone}`}>
      <div>{value}</div>
      <span>{label}</span>
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
    <article className="admin-page__taxonomy-card">
      <div className="admin-page__taxonomy-card-grid">
        <div className="admin-page__taxonomy-card-main">
          <div className="admin-page__taxonomy-title-row">
            <span className="admin-page__taxonomy-title">{suggestion.suggested_theme}</span>
            <span className="admin-page__taxonomy-badge is-warning">
              {Math.round(suggestion.confidence * 100)}%
            </span>
            <span className={`admin-page__taxonomy-badge ${statusBadgeClass(suggestion.status)}`}>
              {statusLabel(suggestion.status)}
            </span>
          </div>
          <div className="admin-page__taxonomy-chip-row">
            {suggestion.suggested_subthemes.map((subtheme) => (
              <span key={subtheme} className="admin-page__taxonomy-chip">
                {subtheme}
              </span>
            ))}
          </div>
          <p className="admin-page__taxonomy-reason">{suggestion.reason}</p>
          <div className="admin-page__taxonomy-meta-grid">
            <span>{suggestion.symbol}</span>
            <span>{suggestion.company_name || '-'}</span>
            <span>{suggestion.sector || '-'}</span>
            <span>{suggestion.industry || '-'}</span>
          </div>
          {suggestion.summary_excerpt && (
            <p className="admin-page__taxonomy-excerpt">{suggestion.summary_excerpt}</p>
          )}
          <ThemePills themes={suggestion.current_themes} />
          <div className="admin-page__taxonomy-date">{new Date(suggestion.created_at).toLocaleString()}</div>
        </div>
        <div className="admin-page__taxonomy-review">
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={2}
            className="pf-textarea"
            placeholder="Reviewer note"
          />
          <div className="admin-page__taxonomy-button-grid">
            <button type="button" onClick={() => onUpdate('accepted')} className="pf-button pf-button--secondary">
              <Check size={16} />
              Accept
            </button>
            <button type="button" onClick={() => onUpdate('rejected')} className="pf-button pf-button--secondary">
              <X size={16} />
              Reject
            </button>
            <button type="button" onClick={() => onUpdate('ignored')} className="pf-button pf-button--secondary">
              <EyeOff size={16} />
              Ignore
            </button>
            <button type="button" onClick={onCopy} className="pf-button pf-button--secondary">
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
    <article className="admin-page__taxonomy-card">
      <div className="admin-page__taxonomy-title-row">
        <span className="admin-page__taxonomy-symbol">{result.symbol}</span>
        <span className="admin-page__taxonomy-muted">{result.company_name || '-'}</span>
        <span className={`admin-page__taxonomy-badge ${failed ? 'is-danger' : 'is-muted'}`}>
          {result.status}
        </span>
        {result.taxonomy_gap?.hasGap && (
          <span className="admin-page__taxonomy-badge is-warning">
            <AlertTriangle size={13} />
            Taxonomy gap
          </span>
        )}
        {result.duration_ms !== undefined && (
          <span className="admin-page__taxonomy-badge is-muted">
            {formatDuration(result.duration_ms)}
          </span>
        )}
      </div>
      <ThemePills themes={result.themes} />
      {result.taxonomy_gap?.hasGap && (
        <div className="admin-page__taxonomy-warning">
          <strong>{result.taxonomy_gap.suggestedTheme}</strong>
          <div>{result.taxonomy_gap.reason}</div>
        </div>
      )}
      {(result.failure_reason || result.skipped_reason) && (
        <div className="admin-page__taxonomy-muted admin-page__taxonomy-message">
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
  if (status === 'running') return 'is-accent'
  if (status === 'classified') return 'is-success'
  if (status === 'failed') return 'is-danger'
  return 'is-muted'
}

function statusLabel(status: AssetThemeTaxonomySuggestionStatus | 'all') {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function statusBadgeClass(status: AssetThemeTaxonomySuggestionStatus) {
  if (status === 'pending') return 'is-warning'
  if (status === 'accepted') return 'is-success'
  if (status === 'rejected') return 'is-danger'
  return 'is-muted'
}

function ThemePills({ themes }: { themes?: AssetThemeDTO[] }) {
  if (!themes?.length) {
    return <div className="admin-page__taxonomy-muted">No stored themes</div>
  }

  return (
    <div className="admin-page__taxonomy-theme-row">
      {themes.map((theme) => {
        const Icon = getThemeIcon(theme.label)
        const color = getThemeHexColor(theme.label)
        return (
          <span
            key={theme.label}
            className="admin-page__taxonomy-theme-pill"
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
