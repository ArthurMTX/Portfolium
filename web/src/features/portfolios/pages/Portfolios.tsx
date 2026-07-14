import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Edit2, Globe, GlobeLock, Link2, PlusCircle, Trash2, X } from 'lucide-react'
import api, { type CashMode, type PortfolioMetricsDTO } from '@/api'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import { formatCurrency } from '@/shared/lib/formatUtils'
import { getTranslatedSector } from '@/shared/lib/translationUtils'
import { ListSkeleton, StateBlock } from '@/shared/components/StatePrimitives'
import {
  PageHeader,
  PageMainColumn,
  PageMainGrid,
  PageMetric,
  PageMetricStrip,
  PageShell,
  PageSummaryPanel,
  PageTitleBlock,
} from '@/shared/components/PageLayout'
import { useTranslation } from 'react-i18next'
import '@/shared/design/pages/portfolios.css'

interface Portfolio {
  id: number
  name: string
  base_currency: string
  description: string | null
  is_public: boolean
  share_token: string
  created_at: string
}

type PortfolioMetricMap = Record<number, PortfolioMetricsDTO | null>
type PortfolioAllocationMap = Record<number, { label: string; percentage: number } | null>

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function signedPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
  const number = Number(value)
  const sign = number > 0 ? '+' : number < 0 ? '−' : ''
  return `${sign}${Math.abs(number).toFixed(decimals)}%`
}

function valueTone(value: number | null | undefined): string {
  const number = toNumber(value)
  if (number > 0) return 'is-positive'
  if (number < 0) return 'is-negative'
  return 'is-neutral'
}

function formatDate(dateString: string | null | undefined, locale?: string): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString(locale || undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function calculateTotalReturn(metrics: PortfolioMetricsDTO | null | undefined): number | null {
  if (!metrics) return null
  return toNumber(metrics.total_unrealized_pnl)
    + toNumber(metrics.total_realized_pnl)
    + toNumber(metrics.total_dividends)
    - toNumber(metrics.total_fees)
}

function calculateTotalReturnPct(metrics: PortfolioMetricsDTO | null | undefined): number | null {
  if (!metrics || !metrics.total_cost) return null
  const totalReturn = calculateTotalReturn(metrics)
  if (totalReturn === null) return null
  return (totalReturn / toNumber(metrics.total_cost)) * 100
}

function formatCapitalGroups(
  groups: Array<{ currency: string; value: number }>,
  locale?: string,
): string {
  if (groups.length === 0) return formatCurrency(0, 'EUR', locale)
  return groups
    .map((group) => formatCurrency(group.value, group.currency, locale))
    .join(' + ')
}

export default function Portfolios() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || navigator.language
  const portfolios = usePortfolioStore((state) => state.portfolios)
  const setPortfolios = usePortfolioStore((state) => state.setPortfolios)
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const setActivePortfolio = usePortfolioStore((state) => state.setActivePortfolio)
  const [metricsByPortfolio, setMetricsByPortfolio] = useState<PortfolioMetricMap>({})
  const [largestAllocationByPortfolio, setLargestAllocationByPortfolio] = useState<PortfolioAllocationMap>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingPortfolio, setEditingPortfolio] = useState<Portfolio | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [shareModal, setShareModal] = useState<Portfolio | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  const [name, setName] = useState('')
  const [baseCurrency, setBaseCurrency] = useState('EUR')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [cashMode, setCashMode] = useState<CashMode>('untracked')
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  // True while a fetchPortfolios run is in flight (used by effect dedupe).
  const fetchInFlightRef = useRef(false)

  const fetchPortfolios = useCallback(async (options?: { dedupe?: boolean }) => {
    // Effect-driven loads dedupe against an in-flight load: setActivePortfolio
    // below (and i18n's `t` settling) change this callback's dependencies and
    // re-fire the mount effect mid-fetch, which used to duplicate the
    // portfolios + per-portfolio metrics/sectors requests on cold sessions.
    // Manual refresh/mutation callers skip the guard so they always refetch.
    if (options?.dedupe === true && fetchInFlightRef.current) {
      return
    }
    fetchInFlightRef.current = true
    setLoading(true)
    setLoadError(null)
    try {
      const data = await api.getPortfolios()
      setPortfolios(data)

      const portfolioIds = data.map((portfolio) => portfolio.id)
      const activeIsValid = activePortfolioId && portfolioIds.includes(activePortfolioId)

      if (!activeIsValid && data.length > 0) {
        setActivePortfolio(data[0].id)
      } else if (!activeIsValid && data.length === 0) {
        setActivePortfolio(null)
      }

      const metricEntries = await Promise.all(
        data.map(async (portfolio) => {
          try {
            const metrics = await api.getPortfolioMetrics(portfolio.id)
            return [portfolio.id, metrics] as const
          } catch (error) {
            console.error(`Failed to fetch metrics for portfolio ${portfolio.id}:`, error)
            return [portfolio.id, null] as const
          }
        }),
      )
      const allocationEntries = await Promise.all(
        data.map(async (portfolio) => {
          try {
            const sectors = await api.getSectorsDistribution(portfolio.id)
            const largest = [...sectors].sort((a, b) => toNumber(b.total_value) - toNumber(a.total_value))[0]
            return [
              portfolio.id,
              largest
                ? {
                    label: getTranslatedSector(largest.name, t),
                    percentage: toNumber(largest.percentage),
                  }
                : null,
            ] as const
          } catch (error) {
            console.error(`Failed to fetch allocation for portfolio ${portfolio.id}:`, error)
            return [portfolio.id, null] as const
          }
        }),
      )

      setMetricsByPortfolio(Object.fromEntries(metricEntries))
      setLargestAllocationByPortfolio(Object.fromEntries(allocationEntries))
    } catch (error) {
      console.error('Failed to fetch portfolios:', error)
      setLoadError(error instanceof Error ? error.message : t('portfoliosPage.loadFailedGeneric'))
    } finally {
      fetchInFlightRef.current = false
      setLoading(false)
    }
  }, [activePortfolioId, setActivePortfolio, setPortfolios, t])

  useEffect(() => {
    fetchPortfolios({ dedupe: true })
  }, [fetchPortfolios])

  useEffect(() => {
    if (showModal || deleteConfirm || shareModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showModal, deleteConfirm, shareModal])

  const activePortfolio = portfolios.find((portfolio) => portfolio.id === activePortfolioId) || null
  const capitalByCurrency = useMemo(
    () => Object.entries(
      portfolios.reduce<Record<string, number>>((groups, portfolio) => {
        const currency = portfolio.base_currency || 'EUR'
        groups[currency] = (groups[currency] || 0) + toNumber(metricsByPortfolio[portfolio.id]?.total_value)
        return groups
      }, {}),
    )
      .map(([currency, value]) => ({ currency, value }))
      .filter((group) => group.value > 0)
      .sort((a, b) => b.value - a.value),
    [metricsByPortfolio, portfolios],
  )

  const openAddModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (portfolio: Portfolio) => {
    setEditingPortfolio(portfolio)
    setName(portfolio.name)
    setBaseCurrency(portfolio.base_currency)
    setDescription(portfolio.description || '')
    setIsPublic(portfolio.is_public)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingPortfolio(null)
    resetForm()
  }

  const resetForm = () => {
    setName('')
    setBaseCurrency('EUR')
    setDescription('')
    setIsPublic(false)
    setCashMode('untracked')
    setFormError('')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormLoading(true)
    setFormError('')

    try {
      const portfolioData = {
        name,
        base_currency: baseCurrency,
        description: description || undefined,
        is_public: isPublic,
      }

      if (editingPortfolio) {
        await api.updatePortfolio(editingPortfolio.id, portfolioData)
      } else {
        const created = await api.createPortfolio(portfolioData)
        if (cashMode !== 'untracked') {
          // A new portfolio has no history: an empty replay activation is
          // instant and keeps activation as the single entry point to
          // cash tracking
          try {
            await api.applyCashActivation(created.id, {
              strategy: 'replay',
              target_mode: cashMode,
              opening_balances: [],
              activation_id: crypto.randomUUID(),
            })
          } catch {
            // The portfolio exists but stayed untracked: switch the modal
            // to edit mode so resubmitting can never create a duplicate
            await fetchPortfolios()
            setEditingPortfolio(created as unknown as Portfolio)
            setFormError(t('portfolios.cashActivationFailed'))
            return
          }
        }
      }

      await fetchPortfolios()
      closeModal()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : t('portfoliosPage.operationFailed'))
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (portfolioId: number) => {
    try {
      await api.deletePortfolio(portfolioId)
      await fetchPortfolios()
      setDeleteConfirm(null)

      if (activePortfolioId === portfolioId) {
        const remaining = portfolios.filter((portfolio) => portfolio.id !== portfolioId)
        if (remaining.length > 0) {
          setActivePortfolio(remaining[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to delete portfolio:', err)
    }
  }

  const handleSelectPortfolio = (portfolioId: number) => {
    if (portfolioId === activePortfolioId) return
    setActivePortfolio(portfolioId)
  }

  const getPublicShareUrl = (shareToken: string) => {
    return `${window.location.origin}/p/${shareToken}`
  }

  const handleCopyLink = async (shareToken: string) => {
    try {
      await navigator.clipboard.writeText(getPublicShareUrl(shareToken))
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } catch (err) {
      console.error('Failed to copy link:', err)
    }
  }

  const handleTogglePublic = async (portfolio: Portfolio) => {
    try {
      const updated = await api.updatePortfolio(portfolio.id, {
        name: portfolio.name,
        base_currency: portfolio.base_currency,
        description: portfolio.description || undefined,
        is_public: !portfolio.is_public,
      })
      await fetchPortfolios()
      if (shareModal && shareModal.id === portfolio.id) {
        setShareModal(updated)
      }
    } catch (err) {
      console.error('Failed to toggle public status:', err)
    }
  }

  const activeMetrics = activePortfolioId ? metricsByPortfolio[activePortfolioId] : null
  const lastActivity = formatDate(activeMetrics?.last_updated || activePortfolio?.created_at, locale)

  return (
    <PageShell className="portfolios">
      <PageHeader>
        <PageTitleBlock
          kicker={t('portfoliosPage.kicker')}
          title={t('portfoliosPage.portfoliosCount', { count: portfolios.length })}
        />
        <PageSummaryPanel
          lead={
            <>
              {t('portfoliosPage.deployedAcross', {
                amount: formatCapitalGroups(capitalByCurrency, locale),
                count: portfolios.length,
                plural: portfolios.length === 1 ? '' : 's',
              })}
            </>
          }
          description={
            <>
              {activePortfolio ? t('portfoliosPage.activePortfolioIs', { name: activePortfolio.name }) : ''}
              {t('portfoliosPage.poweredDescription')}
            </>
          }
          actions={
            <button className="pf-button pf-button--secondary" onClick={openAddModal}>
              <PlusCircle size={16} />
              {t('portfolios.create')}
            </button>
          }
        />
      </PageHeader>

      <PageMetricStrip label={t('portfoliosPage.contextLabel')}>
        <PageMetric label={t('portfoliosPage.portfoliosMetric')} value={portfolios.length} />
        <PageMetric label={t('portfoliosPage.totalValue')} value={formatCapitalGroups(capitalByCurrency, locale)} />
        <PageMetric label={t('portfoliosPage.activePortfolioMetric')} value={activePortfolio?.name || '—'} />
        <PageMetric label={t('portfoliosPage.lastActivity')} value={lastActivity} />
      </PageMetricStrip>

      {loading ? (
        <ListSkeleton className="portfolios__loading" rows={3} label={t('portfolios.loading')} />
      ) : loadError ? (
        <StateBlock
          tone="error"
          eyebrow={t('portfoliosPage.errorEyebrow')}
          title={t('portfoliosPage.errorTitle')}
          description={t('portfoliosPage.errorDescription')}
          detail={loadError}
          actionLabel={t('common.retry')}
          onAction={fetchPortfolios}
        />
      ) : portfolios.length === 0 ? (
        <StateBlock
          className="portfolios__empty"
          eyebrow={t('portfoliosPage.noPortfoliosEyebrow')}
          title={t('portfoliosPage.noPortfoliosTitle')}
          description={t('portfoliosPage.noPortfoliosDescription')}
        >
          <button className="pf-button pf-button--primary" onClick={openAddModal}>
            <PlusCircle size={16} />
            {t('emptyStates.noPortfoliosCreate')}
          </button>
        </StateBlock>
      ) : (
        <PageMainGrid single>
        <PageMainColumn className="portfolios__list" aria-label={t('portfoliosPage.portfolioSelectorLabel')}>
          {portfolios.map((portfolio) => {
            const metrics = metricsByPortfolio[portfolio.id]
            const isActive = activePortfolioId === portfolio.id
            const totalReturn = calculateTotalReturn(metrics)
            const totalReturnPct = calculateTotalReturnPct(metrics)
            const largestAllocation = largestAllocationByPortfolio[portfolio.id]

            return (
              <article
                key={portfolio.id}
                className={`portfolios__portfolio ${isActive ? 'is-active' : ''}`}
                aria-current={isActive ? 'true' : undefined}
              >
                <div className="portfolios__portfolio-main">
                  <div className="portfolios__identity">
                    <span>
                      <i />
                      {isActive ? t('portfoliosPage.currentlyActive') : t('portfoliosPage.inactive')}
                    </span>
                    <h2>{portfolio.name}</h2>
                    <p>{portfolio.description || t('portfoliosPage.noStrategyNote')}</p>
                  </div>

                  <div className="portfolios__value">
                    <strong>{metrics ? formatCurrency(metrics.total_value, portfolio.base_currency, locale) : '—'}</strong>
                    <span>{metrics ? t('portfoliosPage.positionsCount', { count: metrics.positions_count }) : t('portfoliosPage.noPositionData')}</span>
                  </div>
                </div>

                <dl className="portfolios__facts">
                  <div>
                    <dt>{t('portfoliosPage.performance')}</dt>
                    <dd className={valueTone(totalReturn)}>
                      {totalReturn === null ? '—' : t('portfoliosPage.sinceInception', { percent: signedPercent(totalReturnPct) })}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('portfoliosPage.largestAllocation')}</dt>
                    <dd>
                      {largestAllocation
                        ? `${largestAllocation.label} · ${largestAllocation.percentage.toFixed(1)}%`
                        : t('portfoliosPage.notClassifiedYet')}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('portfoliosPage.lastActivity')}</dt>
                    <dd>{formatDate(metrics?.last_updated || portfolio.created_at, locale)}</dd>
                  </div>
                </dl>

                <div className="portfolios__metadata">
                  <span>{t('portfoliosPage.baseCurrency', { currency: portfolio.base_currency })}</span>
                  <span>{portfolio.is_public ? t('portfoliosPage.publicSharingEnabled') : t('portfoliosPage.privatePortfolio')}</span>
                  <div>
                    {t('portfoliosPage.created', { date: formatDate(portfolio.created_at, locale) })}
                  </div>
                </div>

                <div className="portfolios__actions">
                  <button
                    className="portfolios__switch"
                    disabled={isActive}
                    onClick={() => handleSelectPortfolio(portfolio.id)}
                  >
                    {isActive ? t('portfoliosPage.currentlyActiveButton') : t('portfoliosPage.switchPortfolio')}
                  </button>
                  <div className="portfolios__tertiary-actions">
                    <button
                      onClick={() => setShareModal(portfolio)}
                      title={portfolio.is_public ? t('portfolios.publicEnabled') : t('portfolios.publicDisabled')}
                    >
                      {portfolio.is_public ? <Globe size={15} /> : <GlobeLock size={15} />}
                      {t('portfoliosPage.share')}
                    </button>
                    <button onClick={() => openEditModal(portfolio)} title={t('common.edit')}>
                      <Edit2 size={15} />
                      {t('portfoliosPage.rename')}
                    </button>
                    <button onClick={() => setDeleteConfirm(portfolio.id)} title={t('common.delete')}>
                      <Trash2 size={15} />
                      {t('portfoliosPage.delete')}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </PageMainColumn>
        </PageMainGrid>
      )}

      {showModal && (
        <div className="pf-modal-overlay">
          <div className="pf-modal-panel pf-modal-panel--sm" role="dialog" aria-modal="true">
            <div className="pf-modal-header">
              <h2 className="pf-modal-title">
                {editingPortfolio ? t('portfolios.edit') : t('portfolios.create')}
              </h2>
              <button
                onClick={closeModal}
                className="pf-modal-close"
                aria-label={t('common.close')}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="pf-modal-body pf-modal-section">
              <div>
                <label className="pf-modal-label">
                  {t('portfolios.nameField')} *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="pf-modal-input"
                  placeholder={t('portfolios.namePlaceholder')}
                  required
                />
              </div>

              <div>
                <label className="pf-modal-label">
                  {t('portfolios.currencyField')} *
                </label>
                <select
                  value={baseCurrency}
                  onChange={(event) => setBaseCurrency(event.target.value)}
                  className="pf-modal-select"
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="CHF">CHF (Fr)</option>
                </select>
              </div>

              <div>
                <label className="pf-modal-label">
                  {t('portfolios.descriptionField')}
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="pf-modal-textarea"
                  rows={3}
                  placeholder={t('portfolios.descriptionPlaceholder')}
                />
              </div>

              {!editingPortfolio && (
                <div>
                  <label className="pf-modal-label">
                    {t('portfolios.cashTracking')}
                  </label>
                  <select
                    value={cashMode}
                    onChange={(event) => setCashMode(event.target.value as CashMode)}
                    className="pf-modal-select"
                  >
                    <option value="untracked">{t('portfolios.cashTrackingOff')}</option>
                    <option value="tracked_warn">{t('portfolios.cashTrackingWarn')}</option>
                    <option value="tracked_strict">{t('portfolios.cashTrackingStrict')}</option>
                  </select>
                  <p className="pf-modal-help">{t('portfolios.cashTrackingHint')}</p>
                </div>
              )}

              <div className="pf-modal-setting-row">
                <div>
                  <p className="text-sm font-medium text-neutral-100">
                    {t('portfolios.publicSharing')}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {t('portfolios.publicSharingHint')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPublic(!isPublic)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    isPublic ? 'bg-pink-600' : 'bg-neutral-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isPublic ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {formError && (
                <div className="pf-modal-callout pf-modal-callout--danger">
                  {formError}
                </div>
              )}

              <div className="pf-modal-footer -mx-5 -mb-5 mt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="pf-modal-button pf-modal-button--secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="pf-modal-button pf-modal-button--primary"
                >
                  {formLoading ? t('common.saving') : editingPortfolio ? t('common.save') : t('portfolios.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="pf-modal-overlay">
          <div className="pf-modal-panel pf-modal-panel--sm" role="dialog" aria-modal="true">
            <div className="pf-modal-header">
            <div>
            <h3 className="pf-modal-title">
              {t('portfolios.delete')}
            </h3>
            <p className="pf-modal-description">
              {t('portfolios.deleteConfirm')}
            </p>
            </div>
            </div>
            <div className="pf-modal-footer">
              <div />
              <div className="pf-modal-footer-actions">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="pf-modal-button pf-modal-button--secondary"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="pf-modal-button pf-modal-button--danger"
              >
                {t('common.delete')}
              </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {shareModal && (
        <div className="pf-modal-overlay">
          <div className="pf-modal-panel" role="dialog" aria-modal="true">
            <div className="pf-modal-header">
              <h3 className="pf-modal-title">
                {t('portfolios.sharePortfolio')}
              </h3>
              <button
                onClick={() => {
                  setShareModal(null)
                  setCopiedLink(false)
                }}
                className="pf-modal-close"
                aria-label={t('common.close')}
              >
                <X size={20} />
              </button>
            </div>

            <div className="pf-modal-body pf-modal-section">
              <div className="flex items-center justify-between py-3 px-4 pf-modal-muted-box">
                <div className="flex items-center gap-3">
                  {shareModal.is_public ? (
                    <Globe size={20} className="text-green-600 dark:text-green-400" />
                  ) : (
                    <GlobeLock size={20} className="text-neutral-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {shareModal.is_public ? t('portfolios.publicEnabled') : t('portfolios.publicDisabled')}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {shareModal.is_public ? t('portfolios.publicEnabledHint') : t('portfolios.publicDisabledHint')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleTogglePublic(shareModal)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    shareModal.is_public ? 'bg-green-600' : 'bg-neutral-300 dark:bg-neutral-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      shareModal.is_public ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {shareModal.is_public && (
                <div className="space-y-2">
                  <label className="pf-modal-label">
                    {t('portfolios.shareLink')}
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                      <Link2 size={16} className="text-neutral-400 flex-shrink-0" />
                      <span className="text-sm text-neutral-600 dark:text-neutral-300 break-all">
                        {getPublicShareUrl(shareModal.share_token)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopyLink(shareModal.share_token)}
                      className={`flex-shrink-0 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                        copiedLink
                          ? 'bg-green-600 text-white'
                          : 'bg-pink-600 hover:bg-pink-700 text-white'
                      }`}
                    >
                      {copiedLink ? (
                        <>
                          <Check size={16} />
                          {t('common.copied')}
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          {t('common.copy')}
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {t('portfolios.shareLinkHint')}
                  </p>
                </div>
              )}

              {shareModal.is_public && (
                <a
                  href={getPublicShareUrl(shareModal.share_token)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  <Globe size={16} />
                  {t('portfolios.previewPublicPage')}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
