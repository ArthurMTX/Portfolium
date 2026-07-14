import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeftRight, Clock, Plus, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '@/api'
import type { CashMovementDTO } from '@/api/types'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import EmptyPortfolioPrompt from '@/features/portfolios/components/EmptyPortfolioPrompt'
import Toast from '@/shared/components/Toast'
import ConfirmModal from '@/shared/components/ConfirmModal'
import { PageStateSkeleton, StateBlock } from '@/shared/components/StatePrimitives'
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
  PageTitleBlock,
} from '@/shared/components/PageLayout'
import { formatCurrency } from '@/shared/lib/formatUtils'
import { invalidatePortfolioQueries } from '@/features/portfolios/lib/invalidatePortfolioQueries'
import CashActivationWizard from '@/features/cash/components/CashActivationWizard'
import CashMovementModal from '@/features/cash/components/CashMovementModal'
import FxConversionModal from '@/features/cash/components/FxConversionModal'
import {
  hasStaleRates,
  isDerivedMovement,
  parseCashErrorFromMessage,
  toAmount,
} from '@/features/cash/lib/cashDerivedState'
import '@/shared/design/pages/cash.css'

const PAGE_SIZE = 25

type ActiveModal =
  | { kind: 'movement'; movement?: CashMovementDTO }
  | { kind: 'fx' }
  | { kind: 'activation' }
  | null

export default function Cash() {
  const { t, i18n } = useTranslation()
  const currentLocale = i18n.language || navigator.language
  const queryClient = useQueryClient()
  const { portfolios, activePortfolioId } = usePortfolioStore()
  const activePortfolio = portfolios.find((portfolio) => portfolio.id === activePortfolioId)
  const portfolioId = activePortfolio?.id ?? null
  const cashMode = activePortfolio?.cash_mode ?? 'untracked'
  const tracked = cashMode !== 'untracked'
  const strict = cashMode === 'tracked_strict'
  const baseCurrency = activePortfolio?.base_currency || 'EUR'

  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  const [deleteTarget, setDeleteTarget] = useState<CashMovementDTO | null>(null)
  const [currencyFilter, setCurrencyFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(0)

  const balancesQuery = useQuery({
    queryKey: ['cash-balances', portfolioId],
    queryFn: () => api.getCashBalances(portfolioId!),
    enabled: portfolioId != null && tracked,
  })
  const summaryQuery = useQuery({
    queryKey: ['cash-summary', portfolioId],
    queryFn: () => api.getCashSummary(portfolioId!),
    enabled: portfolioId != null && tracked,
  })
  const movementsQuery = useQuery({
    queryKey: ['cash-movements', portfolioId, currencyFilter, typeFilter, page],
    queryFn: () => api.getCashMovements(portfolioId!, {
      currency: currencyFilter || undefined,
      type: typeFilter || undefined,
      skip: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
    enabled: portfolioId != null && tracked,
  })

  const refreshCash = async () => {
    if (portfolioId != null) {
      await invalidatePortfolioQueries(queryClient, portfolioId)
    }
  }

  const refreshPortfolios = async () => {
    // cash_mode lives on the portfolio definition held in the Zustand store
    const fresh = await api.getPortfolios()
    usePortfolioStore.getState().setPortfolios(fresh)
  }

  const deleteMutation = useMutation({
    mutationFn: async (movement: CashMovementDTO) => {
      if (movement.conversion_id) {
        return api.deleteFxConversion(portfolioId!, movement.conversion_id)
      }
      return api.deleteCashMovement(portfolioId!, movement.id)
    },
    onSuccess: async () => {
      setDeleteTarget(null)
      setToast({ type: 'success', message: t('cash.toasts.movementDeleted') })
      await refreshCash()
    },
    onError: (error: Error) => {
      const detail = parseCashErrorFromMessage(error.message)
      setDeleteTarget(null)
      setToast({
        type: 'error',
        message: detail?.code === 'insufficient_cash'
          ? t('cash.errors.deleteWouldStrand', { currency: detail.context.currency ?? '' })
          : detail?.message ?? error.message,
      })
    },
  })

  const modeMutation = useMutation({
    mutationFn: (mode: 'untracked' | 'tracked_warn' | 'tracked_strict') =>
      api.setCashMode(portfolioId!, mode),
    onSuccess: async () => {
      setToast({ type: 'success', message: t('cash.toasts.modeChanged') })
      await refreshPortfolios()
      await refreshCash()
    },
    onError: (error: Error) => {
      const detail = parseCashErrorFromMessage(error.message)
      setToast({
        type: 'error',
        message: detail?.code === 'insufficient_cash'
          ? t('cash.errors.strictNeedsNonNegative')
          : detail?.code === 'cash_ledger_stale'
            ? t('cash.errors.ledgerStale')
            : detail?.message ?? error.message,
      })
    },
  })

  const balances = useMemo(() => balancesQuery.data?.balances ?? [], [balancesQuery.data])
  const totalBase = balancesQuery.data?.total_base
  const fxStatus = balancesQuery.data?.fx_status ?? 'ok'
  const staleRates = hasStaleRates(balances)
  const movements = movementsQuery.data?.items ?? []
  const movementTotal = movementsQuery.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(movementTotal / PAGE_SIZE))
  const pnl = summaryQuery.data?.pnl

  const negativeBalances = useMemo(
    () => balances.filter((balance) => toAmount(balance.balance) < 0),
    [balances]
  )

  if (!activePortfolio) {
    return (
      <PageShell>
        <PageHeader>
          <PageTitleBlock kicker={t('cash.kicker')} title={t('cash.title')} description={t('cash.description')} />
        </PageHeader>
        <EmptyPortfolioPrompt />
      </PageShell>
    )
  }

  // Untracked portfolio: the page is a single enable call-to-action.
  // The existing transaction workflow stays exactly as it is.
  if (!tracked) {
    return (
      <PageShell>
        <PageHeader>
          <PageTitleBlock kicker={t('cash.kicker')} title={t('cash.title')} description={t('cash.description')} />
        </PageHeader>
        <PageSection>
          <StateBlock
            tone="info"
            title={t('cash.enable.title')}
            description={t('cash.enable.description')}
          >
            <button
              type="button"
              className="pf-button pf-button--primary"
              onClick={() => setActiveModal({ kind: 'activation' })}
            >
              <Wallet size={16} /> {t('cash.enable.button')}
            </button>
          </StateBlock>
        </PageSection>
        {activeModal?.kind === 'activation' && (
          <CashActivationWizard
            portfolioId={activePortfolio.id}
            baseCurrency={baseCurrency}
            currentLocale={currentLocale}
            onClose={() => setActiveModal(null)}
            onActivated={async (message) => {
              setActiveModal(null)
              setToast({ type: 'success', message })
              await refreshPortfolios()
              await refreshCash()
            }}
          />
        )}
        {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      </PageShell>
    )
  }

  if (balancesQuery.isLoading) {
    return <PageStateSkeleton />
  }

  if (balancesQuery.isError) {
    return (
      <PageShell>
        <PageHeader>
          <PageTitleBlock kicker={t('cash.kicker')} title={t('cash.title')} description={t('cash.description')} />
        </PageHeader>
        <StateBlock tone="error" title={t('cash.errors.loadFailed')} description={String(balancesQuery.error)} />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader>
        <PageTitleBlock
          kicker={t('cash.kicker')}
          title={t('cash.title')}
          description={t('cash.description')}
        />
        <PageSummaryPanel
          lead={totalBase != null
            ? formatCurrency(toAmount(totalBase), baseCurrency, currentLocale, true)
            : t('cash.fx.unavailableTotal')}
          description={t(`cash.modes.${cashMode}`)}
          actions={(
            <>
              <button
                type="button"
                className="pf-button pf-button--primary"
                onClick={() => setActiveModal({ kind: 'movement' })}
              >
                <Plus size={16} /> {t('cash.actions.addMovement')}
              </button>
              <button
                type="button"
                className="pf-button pf-button--secondary"
                onClick={() => setActiveModal({ kind: 'fx' })}
              >
                <ArrowLeftRight size={16} /> {t('cash.actions.convert')}
              </button>
            </>
          )}
        />
      </PageHeader>

      <PageMetricStrip>
        <PageMetric
          label={t('cash.metrics.totalBase', { currency: baseCurrency })}
          value={totalBase != null
            ? formatCurrency(toAmount(totalBase), baseCurrency, currentLocale, true)
            : '-'}
          tone={totalBase != null && toAmount(totalBase) < 0 ? 'negative' : 'neutral'}
        />
        <PageMetric label={t('cash.metrics.currencies')} value={String(balances.length)} />
        {pnl && (
          <PageMetric
            label={t('cash.metrics.interestIncome')}
            value={formatCurrency(toAmount(pnl.interest_income), baseCurrency, currentLocale, true)}
            tone={toAmount(pnl.interest_income) > 0 ? 'positive' : 'neutral'}
          />
        )}
        {pnl && (
          <PageMetric
            label={t('cash.metrics.fxPnl')}
            value={pnl.fx_pnl == null ? t('cash.fx.pnlUnavailable') : String(pnl.fx_pnl)}
            detail={pnl.fx_pnl == null ? t('cash.fx.pnlDeferred') : undefined}
          />
        )}
      </PageMetricStrip>

      {(fxStatus !== 'ok' || staleRates) && (
        <StateBlock
          tone="warning"
          title={t('cash.fx.stateTitle')}
          description={fxStatus !== 'ok' ? t('cash.fx.partialRates') : t('cash.fx.staleRates')}
        />
      )}
      {negativeBalances.length > 0 && (
        <StateBlock
          tone="warning"
          title={t('cash.warnings.negativeTitle')}
          description={t('cash.warnings.negativeDescription', {
            currencies: negativeBalances.map((balance) => balance.currency).join(', '),
          })}
        />
      )}

      <PageSection>
        <PageSectionHeader kicker={t('cash.kicker')} title={t('cash.balancesTitle')} />
        <div className="cash-balance-grid">
          {balances.length === 0 && (
            <StateBlock tone="empty" title={t('cash.empty.balancesTitle')} description={t('cash.empty.balancesDescription')} />
          )}
          {balances.map((balance) => {
            const native = toAmount(balance.balance)
            return (
              <article
                key={balance.currency}
                className={`pf-card cash-balance-card${native < 0 ? ' is-negative' : ''}`}
              >
                <header className="cash-balance-card__header">
                  <span className="cash-balance-card__currency">{balance.currency}</span>
                  {balance.rate_stale && (
                    <span className="pf-badge pf-badge--accent" title={t('cash.fx.staleRates')}>
                      <Clock size={12} /> {t('cash.fx.staleBadge')}
                    </span>
                  )}
                  {balance.rate_unavailable && (
                    <span className="pf-badge pf-badge--danger" title={t('cash.fx.partialRates')}>
                      <AlertTriangle size={12} /> {t('cash.fx.noRateBadge')}
                    </span>
                  )}
                </header>
                <strong className="cash-balance-card__amount">
                  {formatCurrency(native, balance.currency, currentLocale, true)}
                </strong>
                <span className="cash-balance-card__converted">
                  {balance.balance_base != null && balance.currency !== baseCurrency
                    ? `≈ ${formatCurrency(toAmount(balance.balance_base), baseCurrency, currentLocale, true)}`
                    : balance.rate_unavailable
                      ? t('cash.fx.noConversion')
                      : ''}
                </span>
              </article>
            )
          })}
        </div>
      </PageSection>

      <PageSection>
        <PageSectionHeader
          kicker={t('cash.kicker')}
          title={t('cash.movementsTitle')}
          description={t('cash.movementsDescription')}
        />
        <PageControls
          start={(
            <>
              <input
                className="pf-modal-input cash-filter-input"
                value={currencyFilter}
                onChange={(event) => {
                  setCurrencyFilter(event.target.value.toUpperCase())
                  setPage(0)
                }}
                placeholder={t('cash.filters.currency')}
                maxLength={5}
                aria-label={t('cash.filters.currency')}
              />
              <select
                className="pf-modal-select cash-filter-input"
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value)
                  setPage(0)
                }}
                aria-label={t('cash.filters.type')}
              >
                <option value="">{t('cash.filters.allTypes')}</option>
                {['opening_balance', 'deposit', 'withdrawal', 'buy', 'sell', 'dividend', 'interest', 'fee', 'tax', 'fx_debit', 'fx_credit', 'adjustment'].map((movementType) => (
                  <option key={movementType} value={movementType}>
                    {t(`cash.movementTypes.${movementType}`)}
                  </option>
                ))}
              </select>
            </>
          )}
          end={(
            <span className="cash-pagination">
              <button
                type="button"
                className="pf-button pf-button--ghost"
                disabled={page === 0}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
              >
                {t('common.previous')}
              </button>
              <span>{t('cash.pagination', { page: page + 1, pages: pageCount })}</span>
              <button
                type="button"
                className="pf-button pf-button--ghost"
                disabled={page + 1 >= pageCount}
                onClick={() => setPage((value) => value + 1)}
              >
                {t('common.next')}
              </button>
            </span>
          )}
        />

        <PageMainGrid single>
          <PageMainColumn>
            {movementsQuery.isLoading ? (
              <PageStateSkeleton />
            ) : movements.length === 0 ? (
              <StateBlock tone="empty" title={t('cash.empty.movementsTitle')} description={t('cash.empty.movementsDescription')} />
            ) : (
              <div className="pf-table-wrap">
                <table className="pf-table cash-movements-table">
                  <thead>
                    <tr>
                      <th>{t('cash.table.date')}</th>
                      <th>{t('cash.table.type')}</th>
                      <th>{t('cash.table.amount')}</th>
                      <th>{t('cash.table.details')}</th>
                      <th aria-label={t('cash.table.actions')} />
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((movement) => {
                      const amount = toAmount(movement.amount)
                      const derived = isDerivedMovement(movement)
                      return (
                        <tr key={movement.id}>
                          <td>{movement.occurred_on}</td>
                          <td>
                            <span className="pf-badge">{t(`cash.movementTypes.${movement.type}`)}</span>
                            {derived && (
                              <span className="pf-badge pf-badge--accent cash-derived-badge" title={t('cash.table.derivedHint')}>
                                {t('cash.table.derived')}
                              </span>
                            )}
                          </td>
                          <td className={amount < 0 ? 'is-negative' : 'is-positive'}>
                            {`${amount > 0 ? '+' : ''}${formatCurrency(amount, movement.currency, currentLocale, true)}`}
                          </td>
                          <td className="cash-movement-notes">
                            {movement.reason || movement.notes || ''}
                          </td>
                          <td className="cash-movement-actions">
                            {!derived && (
                              <>
                                <button
                                  type="button"
                                  className="pf-button pf-button--ghost"
                                  onClick={() => setActiveModal({ kind: 'movement', movement })}
                                >
                                  {t('common.edit')}
                                </button>
                                <button
                                  type="button"
                                  className="pf-button pf-button--ghost"
                                  onClick={() => setDeleteTarget(movement)}
                                >
                                  {t('common.delete')}
                                </button>
                              </>
                            )}
                            {movement.conversion_id && (
                              <button
                                type="button"
                                className="pf-button pf-button--ghost"
                                onClick={() => setDeleteTarget(movement)}
                              >
                                {t('cash.table.deleteConversion')}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </PageMainColumn>
        </PageMainGrid>
      </PageSection>

      <PageSection>
        <PageSectionHeader
          kicker={t('cash.kicker')}
          title={t('cash.settings.title')}
          description={t('cash.settings.description')}
        />
        <div className="cash-mode-controls">
          <button
            type="button"
            className={`pf-button ${cashMode === 'tracked_warn' ? 'pf-button--primary' : 'pf-button--secondary'}`}
            disabled={cashMode === 'tracked_warn' || modeMutation.isPending}
            onClick={() => modeMutation.mutate('tracked_warn')}
          >
            {t('cash.modes.tracked_warn')}
          </button>
          <button
            type="button"
            className={`pf-button ${strict ? 'pf-button--primary' : 'pf-button--secondary'}`}
            disabled={strict || modeMutation.isPending}
            onClick={() => modeMutation.mutate('tracked_strict')}
          >
            {t('cash.modes.tracked_strict')}
          </button>
          <button
            type="button"
            className="pf-button pf-button--danger"
            disabled={modeMutation.isPending}
            onClick={() => modeMutation.mutate('untracked')}
          >
            {t('cash.settings.disable')}
          </button>
        </div>
        <p className="pf-modal-help">{t('cash.settings.disableHint')}</p>
      </PageSection>

      {activeModal?.kind === 'movement' && (
        <CashMovementModal
          portfolioId={activePortfolio.id}
          strict={strict}
          balances={balances}
          baseCurrency={baseCurrency}
          currentLocale={currentLocale}
          movement={activeModal.movement ?? null}
          onClose={() => setActiveModal(null)}
          onSaved={async (message) => {
            setActiveModal(null)
            setToast({ type: 'success', message })
            await refreshCash()
          }}
        />
      )}
      {activeModal?.kind === 'fx' && (
        <FxConversionModal
          portfolioId={activePortfolio.id}
          strict={strict}
          balances={balances}
          baseCurrency={baseCurrency}
          currentLocale={currentLocale}
          onClose={() => setActiveModal(null)}
          onSaved={async (message) => {
            setActiveModal(null)
            setToast({ type: 'success', message })
            await refreshCash()
          }}
        />
      )}

      <ConfirmModal
        isOpen={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        title={deleteTarget?.conversion_id
          ? t('cash.deleteConversionTitle')
          : t('cash.deleteMovementTitle')}
        message={deleteTarget?.conversion_id
          ? t('cash.deleteConversionMessage')
          : t('cash.deleteMovementMessage')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        loading={deleteMutation.isPending}
      />

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </PageShell>
  )
}
