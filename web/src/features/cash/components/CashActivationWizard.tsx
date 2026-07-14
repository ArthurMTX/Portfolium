import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '@/api'
import type { CashActivationPreviewDTO, CashMode } from '@/api/types'
import { formatCurrency } from '@/shared/lib/formatUtils'
import { parseCashErrorFromMessage, toAmount } from '@/features/cash/lib/cashDerivedState'

interface CashActivationWizardProps {
  portfolioId: number
  baseCurrency: string
  currentLocale: string
  onClose: () => void
  onActivated: (message: string) => void
}

interface OpeningRow {
  currency: string
  amount: string
}

/**
 * Two-step activation flow. Step 1 picks the starting point (replay scans
 * the whole history automatically — no date to choose) and the validation
 * mode; Continue runs the dry-run preview. Step 2 reviews the projected
 * result and confirms. Apply is idempotent via a client-generated
 * activation id.
 */
export default function CashActivationWizard({
  portfolioId,
  baseCurrency,
  currentLocale,
  onClose,
  onActivated,
}: CashActivationWizardProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<'configure' | 'review'>('configure')
  const [strategy, setStrategy] = useState<'opening_balances' | 'replay'>('replay')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [targetMode, setTargetMode] = useState<Exclude<CashMode, 'untracked'>>('tracked_warn')
  const [openings, setOpenings] = useState<OpeningRow[]>([{ currency: baseCurrency, amount: '' }])
  const [preview, setPreview] = useState<CashActivationPreviewDTO | null>(null)
  const [activationId] = useState(() => crypto.randomUUID())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const payloadOpenings = useMemo(
    () => openings
      .filter((row) => row.currency.trim() && Number(row.amount) > 0)
      .map((row) => ({ currency: row.currency.trim().toUpperCase(), amount: row.amount })),
    [openings]
  )

  const buildPayload = (withProposals: boolean) => {
    const proposalRows = withProposals && preview
      ? preview.proposed_opening_balances.map((entry) => ({
        currency: entry.currency,
        amount: String(entry.amount),
      }))
      : []
    return {
      strategy,
      // Replay scans the whole transaction history: the backend resolves
      // the start date to the earliest transaction automatically
      ...(strategy === 'opening_balances' ? { start_date: startDate } : {}),
      target_mode: targetMode,
      opening_balances: [
        ...(strategy === 'opening_balances' ? payloadOpenings : []),
        ...proposalRows,
      ],
    }
  }

  const runPreview = async () => {
    setError('')
    setLoading(true)
    try {
      setPreview(await api.previewCashActivation(portfolioId, buildPayload(false)))
      setStep('review')
    } catch (err) {
      const detail = err instanceof Error ? parseCashErrorFromMessage(err.message) : null
      setError(detail?.message ?? (err instanceof Error ? err.message : t('cash.errors.generic')))
    } finally {
      setLoading(false)
    }
  }

  const apply = async () => {
    setError('')
    setLoading(true)
    try {
      await api.applyCashActivation(portfolioId, {
        ...buildPayload(true),
        activation_id: activationId,
      })
      onActivated(t('cash.toasts.activated'))
    } catch (err) {
      const detail = err instanceof Error ? parseCashErrorFromMessage(err.message) : null
      if (detail?.code === 'insufficient_cash') {
        setError(t('cash.errors.strictActivationDip', {
          currency: detail.context.currency,
          missing: detail.context.missing,
          date: detail.context.date,
        }))
      } else {
        setError(detail?.message ?? (err instanceof Error ? err.message : t('cash.errors.generic')))
      }
    } finally {
      setLoading(false)
    }
  }

  const updateOpening = (index: number, patch: Partial<OpeningRow>) => {
    setOpenings((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const backToConfigure = () => {
    setPreview(null)
    setError('')
    setStep('configure')
  }

  const canApply = preview !== null && preview.blocking_issues.length === 0
    && !(targetMode === 'tracked_strict' && strategy === 'opening_balances' && preview.negative_dips.length > 0)

  const formatDate = (iso: string) => {
    const day = new Date(`${iso}T00:00:00`)
    try {
      return day.toLocaleDateString(currentLocale, { dateStyle: 'long' })
    } catch {
      // currentLocale can be an invalid BCP-47 tag (e.g. POSIX locales)
      return day.toLocaleDateString(undefined, { dateStyle: 'long' })
    }
  }

  const choiceCard = (
    selected: boolean,
    onSelect: () => void,
    title: string,
    description: string,
    recommended = false,
  ) => (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`cash-choice-card${selected ? ' is-selected' : ''}`}
      onClick={onSelect}
    >
      <span className="cash-choice-card__title">
        {title}
        {recommended && <span className="cash-choice-card__badge">{t('cash.activation.recommended')}</span>}
      </span>
      <span className="cash-choice-card__description">{description}</span>
    </button>
  )

  return (
    <div className="pf-modal-overlay" onClick={onClose}>
      <div className="pf-modal-panel pf-modal-panel--lg" onClick={(event) => event.stopPropagation()}>
        <div className="pf-modal-header">
          <h2 className="pf-modal-title">{t('cash.activation.title')}</h2>
          <button type="button" className="pf-modal-close" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </div>
        <div className="pf-modal-body">
          <p className="pf-modal-help">
            {step === 'configure'
              ? t('cash.activation.stepConfigure')
              : t('cash.activation.stepReview')}
          </p>

          {step === 'configure' && (
            <>
              <div className="pf-modal-field">
                <span className="pf-modal-label">{t('cash.activation.methodLabel')}</span>
                <div className="cash-choice-grid" role="radiogroup" aria-label={t('cash.activation.methodLabel')}>
                  {choiceCard(
                    strategy === 'replay',
                    () => setStrategy('replay'),
                    t('cash.activation.replayTitle'),
                    t('cash.activation.replayDescription'),
                    true,
                  )}
                  {choiceCard(
                    strategy === 'opening_balances',
                    () => setStrategy('opening_balances'),
                    t('cash.activation.openingsTitle'),
                    t('cash.activation.openingsDescription'),
                  )}
                </div>
              </div>

              {strategy === 'opening_balances' && (
                <>
                  <div className="pf-modal-field">
                    <label className="pf-modal-label" htmlFor="cash-activation-start">
                      {t('cash.activation.startDate')}
                    </label>
                    <input
                      id="cash-activation-start"
                      className="pf-modal-input"
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                  </div>
                  <div className="pf-modal-field">
                    <span className="pf-modal-label">{t('cash.activation.openingBalances')}</span>
                    {openings.map((row, index) => (
                      <div className="cash-opening-row" key={index}>
                        <input
                          className="pf-modal-input"
                          value={row.currency}
                          onChange={(event) => updateOpening(index, { currency: event.target.value.toUpperCase() })}
                          maxLength={5}
                          placeholder="EUR"
                          aria-label={t('cash.activation.openingCurrency')}
                        />
                        <input
                          className="pf-modal-input"
                          type="number"
                          min="0"
                          step="any"
                          value={row.amount}
                          onChange={(event) => updateOpening(index, { amount: event.target.value })}
                          aria-label={t('cash.activation.openingAmount')}
                        />
                        <button
                          type="button"
                          className="pf-button pf-button--ghost"
                          onClick={() => setOpenings((rows) => rows.filter((_, i) => i !== index))}
                          aria-label={t('common.delete')}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="pf-button pf-button--ghost"
                      onClick={() => setOpenings((rows) => [...rows, { currency: '', amount: '' }])}
                    >
                      {t('cash.activation.addCurrency')}
                    </button>
                  </div>
                </>
              )}

              <div className="pf-modal-field">
                <span className="pf-modal-label">{t('cash.activation.modeLabel')}</span>
                <div className="cash-choice-grid" role="radiogroup" aria-label={t('cash.activation.modeLabel')}>
                  {choiceCard(
                    targetMode === 'tracked_warn',
                    () => setTargetMode('tracked_warn'),
                    t('cash.activation.warnTitle'),
                    t('cash.activation.warnDescription'),
                    true,
                  )}
                  {choiceCard(
                    targetMode === 'tracked_strict',
                    () => setTargetMode('tracked_strict'),
                    t('cash.activation.strictTitle'),
                    t('cash.activation.strictDescription'),
                  )}
                </div>
              </div>

              <p className="pf-modal-help">{t('cash.activation.nothingWritten')}</p>
            </>
          )}

          {step === 'review' && preview && (
            <div className="cash-preview">
              <p>
                {strategy === 'replay'
                  ? t('cash.activation.reviewReplaySummary', {
                    date: formatDate(preview.start_date),
                    count: preview.derived_movement_count,
                  })
                  : t('cash.activation.reviewOpeningsSummary', {
                    date: formatDate(preview.start_date),
                    count: preview.derived_movement_count,
                  })}
              </p>

              {preview.proposed_opening_balances.length > 0 && (
                <div className="cash-preview__proposals">
                  <p>{t('cash.activation.proposedIntro')}</p>
                  <ul>
                    {preview.proposed_opening_balances.map((entry) => (
                      <li key={entry.currency}>
                        {formatCurrency(toAmount(entry.amount), entry.currency, currentLocale, true)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.negative_dips.length > 0 && (
                <div className="pf-modal-callout pf-modal-callout--warning">
                  <p>{t('cash.activation.dipsIntro')}</p>
                  <ul>
                    {preview.negative_dips.map((dip) => (
                      <li key={dip.currency}>
                        {t('cash.activation.dipLine', {
                          currency: dip.currency,
                          date: dip.date,
                          balance: formatCurrency(toAmount(dip.projected_balance), dip.currency, currentLocale, true),
                        })}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.blocking_issues.length > 0 && (
                <div className="pf-modal-callout pf-modal-callout--danger">
                  <ul>
                    {preview.blocking_issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.projected_balances.length > 0 && (
                <>
                  <h3 className="cash-preview__title">{t('cash.activation.projectedTitle')}</h3>
                  <table className="cash-preview__table">
                    <thead>
                      <tr>
                        <th>{t('cash.activation.currencyColumn')}</th>
                        <th>{t('cash.activation.projectedColumn')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.projected_balances.map((entry) => (
                        <tr key={entry.currency}>
                          <td>{entry.currency}</td>
                          <td className={toAmount(entry.balance) < 0 ? 'is-negative' : ''}>
                            {formatCurrency(toAmount(entry.balance), entry.currency, currentLocale, true)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}

          {error && <div className="pf-modal-callout pf-modal-callout--danger">{error}</div>}
        </div>
        <div className="pf-modal-footer">
          {step === 'configure' ? (
            <>
              <button type="button" className="pf-modal-button pf-modal-button--secondary" onClick={onClose}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="pf-modal-button pf-modal-button--primary"
                onClick={runPreview}
                disabled={loading}
              >
                {loading ? t('common.loading') : t('cash.activation.continueButton')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="pf-modal-button pf-modal-button--secondary"
                onClick={backToConfigure}
                disabled={loading}
              >
                {t('cash.activation.backButton')}
              </button>
              <button
                type="button"
                className="pf-modal-button pf-modal-button--primary"
                onClick={apply}
                disabled={loading || !canApply}
              >
                {loading ? t('common.loading') : t('cash.activation.applyButton')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
