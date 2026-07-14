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
 * Two-step activation flow: configure (strategy, start date, opening
 * balances) -> preview (projected balances, dips, proposed openings) ->
 * confirm. Apply is idempotent via a client-generated activation id.
 */
export default function CashActivationWizard({
  portfolioId,
  baseCurrency,
  currentLocale,
  onClose,
  onActivated,
}: CashActivationWizardProps) {
  const { t } = useTranslation()
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
      start_date: startDate,
      target_mode: targetMode,
      opening_balances: [...payloadOpenings, ...proposalRows],
    }
  }

  const runPreview = async () => {
    setError('')
    setLoading(true)
    try {
      setPreview(await api.previewCashActivation(portfolioId, buildPayload(false)))
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
    setPreview(null)
  }

  const canApply = preview !== null && preview.blocking_issues.length === 0
    && !(targetMode === 'tracked_strict' && strategy === 'opening_balances' && preview.negative_dips.length > 0)

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
          <p className="pf-modal-help">{t('cash.activation.intro')}</p>

          <div className="pf-modal-grid pf-modal-grid--3">
            <div className="pf-modal-field">
              <label className="pf-modal-label" htmlFor="cash-activation-strategy">
                {t('cash.activation.strategy')}
              </label>
              <select
                id="cash-activation-strategy"
                className="pf-modal-select"
                value={strategy}
                onChange={(event) => {
                  setStrategy(event.target.value as 'opening_balances' | 'replay')
                  setPreview(null)
                }}
              >
                <option value="replay">{t('cash.activation.strategyReplay')}</option>
                <option value="opening_balances">{t('cash.activation.strategyOpenings')}</option>
              </select>
            </div>
            <div className="pf-modal-field">
              <label className="pf-modal-label" htmlFor="cash-activation-start">
                {t('cash.activation.startDate')}
              </label>
              <input
                id="cash-activation-start"
                className="pf-modal-input"
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value)
                  setPreview(null)
                }}
              />
            </div>
            <div className="pf-modal-field">
              <label className="pf-modal-label" htmlFor="cash-activation-mode">
                {t('cash.activation.mode')}
              </label>
              <select
                id="cash-activation-mode"
                className="pf-modal-select"
                value={targetMode}
                onChange={(event) => {
                  setTargetMode(event.target.value as Exclude<CashMode, 'untracked'>)
                  setPreview(null)
                }}
              >
                <option value="tracked_warn">{t('cash.modes.tracked_warn')}</option>
                <option value="tracked_strict">{t('cash.modes.tracked_strict')}</option>
              </select>
            </div>
          </div>
          <p className="pf-modal-help">
            {strategy === 'replay'
              ? t('cash.activation.strategyReplayHelp')
              : t('cash.activation.strategyOpeningsHelp')}
          </p>

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
                  onClick={() => {
                    setOpenings((rows) => rows.filter((_, i) => i !== index))
                    setPreview(null)
                  }}
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

          {preview && (
            <div className="cash-preview">
              <h3 className="cash-preview__title">{t('cash.activation.previewTitle')}</h3>
              <p>{t('cash.activation.derivedCount', { count: preview.derived_movement_count })}</p>

              {preview.proposed_opening_balances.length > 0 && (
                <div className="pf-modal-callout pf-modal-callout--warning">
                  <p>{t('cash.activation.proposedIntro')}</p>
                  <ul>
                    {preview.proposed_opening_balances.map((entry) => (
                      <li key={entry.currency}>
                        {formatCurrency(toAmount(entry.amount), entry.currency, currentLocale, true)}
                      </li>
                    ))}
                  </ul>
                  <p>{t('cash.activation.proposedConfirm')}</p>
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
            </div>
          )}

          {error && <div className="pf-modal-callout pf-modal-callout--danger">{error}</div>}
        </div>
        <div className="pf-modal-footer">
          <button type="button" className="pf-modal-button pf-modal-button--secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="pf-modal-button pf-modal-button--secondary"
            onClick={runPreview}
            disabled={loading}
          >
            {loading && !preview ? t('common.loading') : t('cash.activation.previewButton')}
          </button>
          <button
            type="button"
            className="pf-modal-button pf-modal-button--primary"
            onClick={apply}
            disabled={loading || !canApply}
          >
            {t('cash.activation.applyButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
