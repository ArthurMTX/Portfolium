import { useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '@/api'
import type { CashBalanceDTO } from '@/api/types'
import { formatCurrency, formatNumber } from '@/shared/lib/formatUtils'
import {
  conversionRate,
  findBalance,
  parseCashErrorFromMessage,
  toAmount,
} from '@/features/cash/lib/cashDerivedState'

interface FxConversionModalProps {
  portfolioId: number
  strict: boolean
  balances: CashBalanceDTO[]
  baseCurrency: string
  currentLocale: string
  onClose: () => void
  onSaved: (message: string) => void
}

export default function FxConversionModal({
  portfolioId,
  strict,
  balances,
  baseCurrency,
  currentLocale,
  onClose,
  onSaved,
}: FxConversionModalProps) {
  const { t } = useTranslation()
  const [sourceCurrency, setSourceCurrency] = useState(
    balances[0]?.currency ?? baseCurrency
  )
  const [targetCurrency, setTargetCurrency] = useState('')
  const [sourceAmount, setSourceAmount] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [feeAmount, setFeeAmount] = useState('')
  const [feeCurrency, setFeeCurrency] = useState('')
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  const rate = conversionRate(sourceAmount, targetAmount)

  const sourceAvailable = useMemo(() => {
    const balance = findBalance(balances, sourceCurrency)
    return balance ? toAmount(balance.balance) : 0
  }, [balances, sourceCurrency])

  const parsedSource = Number(sourceAmount)
  const parsedFee = feeAmount ? Number(feeAmount) : 0
  const effectiveFeeCurrency = (feeCurrency || sourceCurrency).toUpperCase()
  const sourceDebit = (Number.isFinite(parsedSource) ? parsedSource : 0)
    + (effectiveFeeCurrency === sourceCurrency.toUpperCase() && Number.isFinite(parsedFee) ? parsedFee : 0)
  const projectedSource = sourceAvailable - sourceDebit
  const projectedNegative = sourceDebit > 0 && projectedSource < 0

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')
    if (!sourceCurrency.trim() || !targetCurrency.trim()) {
      setFormError(t('cash.errors.currenciesRequired'))
      return
    }
    if (sourceCurrency.trim().toUpperCase() === targetCurrency.trim().toUpperCase()) {
      setFormError(t('cash.errors.sameCurrency'))
      return
    }
    if (!rate) {
      setFormError(t('cash.errors.invalidAmount'))
      return
    }
    setLoading(true)
    try {
      await api.createFxConversion(portfolioId, {
        source_currency: sourceCurrency.trim().toUpperCase(),
        target_currency: targetCurrency.trim().toUpperCase(),
        source_amount: sourceAmount,
        target_amount: targetAmount,
        occurred_on: occurredOn,
        fee_amount: feeAmount || null,
        fee_currency: feeCurrency ? feeCurrency.trim().toUpperCase() : null,
        notes: notes || null,
      })
      onSaved(t('cash.toasts.conversionCreated'))
    } catch (error) {
      const detail = error instanceof Error ? parseCashErrorFromMessage(error.message) : null
      if (detail?.code === 'insufficient_cash') {
        setFormError(t('cash.errors.insufficientCash', {
          currency: detail.context.currency,
          available: detail.context.available,
          required: detail.context.required,
          missing: detail.context.missing,
        }))
      } else if (detail) {
        setFormError(detail.message)
      } else {
        setFormError(error instanceof Error ? error.message : t('cash.errors.generic'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pf-modal-overlay" onClick={onClose}>
      <div className="pf-modal-panel pf-modal-panel--lg" onClick={(event) => event.stopPropagation()}>
        <div className="pf-modal-header">
          <h2 className="pf-modal-title">{t('cash.fxModal.title')}</h2>
          <button type="button" className="pf-modal-close" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="pf-modal-body">
            <div className="cash-fx-grid">
              <fieldset className="cash-fx-leg">
                <legend className="pf-modal-label">{t('cash.fxModal.youSend')}</legend>
                <input
                  className="pf-modal-input"
                  value={sourceCurrency}
                  onChange={(event) => setSourceCurrency(event.target.value.toUpperCase())}
                  maxLength={5}
                  placeholder="EUR"
                  aria-label={t('cash.fxModal.sourceCurrency')}
                  required
                />
                <input
                  className="pf-modal-input"
                  type="number"
                  min="0"
                  step="any"
                  value={sourceAmount}
                  onChange={(event) => setSourceAmount(event.target.value)}
                  aria-label={t('cash.fxModal.sourceAmount')}
                  required
                />
                <p className="pf-modal-help">
                  {t('cash.fxModal.available')}{' '}
                  {formatCurrency(sourceAvailable, sourceCurrency || baseCurrency, currentLocale, true)}
                </p>
              </fieldset>
              <div className="cash-fx-arrow" aria-hidden="true">
                <ArrowRight size={20} />
              </div>
              <fieldset className="cash-fx-leg">
                <legend className="pf-modal-label">{t('cash.fxModal.youReceive')}</legend>
                <input
                  className="pf-modal-input"
                  value={targetCurrency}
                  onChange={(event) => setTargetCurrency(event.target.value.toUpperCase())}
                  maxLength={5}
                  placeholder="USD"
                  aria-label={t('cash.fxModal.targetCurrency')}
                  required
                />
                <input
                  className="pf-modal-input"
                  type="number"
                  min="0"
                  step="any"
                  value={targetAmount}
                  onChange={(event) => setTargetAmount(event.target.value)}
                  aria-label={t('cash.fxModal.targetAmount')}
                  required
                />
              </fieldset>
            </div>

            {rate !== null && (
              <p className="cash-fx-rate">
                {t('cash.fxModal.rate', {
                  rate: formatNumber(rate, 6),
                  source: sourceCurrency || '?',
                  target: targetCurrency || '?',
                })}
              </p>
            )}

            <div className="pf-modal-grid pf-modal-grid--3">
              <div className="pf-modal-field">
                <label className="pf-modal-label" htmlFor="cash-fx-date">
                  {t('cash.fxModal.date')}
                </label>
                <input
                  id="cash-fx-date"
                  className="pf-modal-input"
                  type="date"
                  value={occurredOn}
                  onChange={(event) => setOccurredOn(event.target.value)}
                  required
                />
              </div>
              <div className="pf-modal-field">
                <label className="pf-modal-label" htmlFor="cash-fx-fee">
                  {t('cash.fxModal.fee')}
                </label>
                <input
                  id="cash-fx-fee"
                  className="pf-modal-input"
                  type="number"
                  min="0"
                  step="any"
                  value={feeAmount}
                  onChange={(event) => setFeeAmount(event.target.value)}
                />
              </div>
              <div className="pf-modal-field">
                <label className="pf-modal-label" htmlFor="cash-fx-fee-currency">
                  {t('cash.fxModal.feeCurrency')}
                </label>
                <input
                  id="cash-fx-fee-currency"
                  className="pf-modal-input"
                  value={feeCurrency}
                  onChange={(event) => setFeeCurrency(event.target.value.toUpperCase())}
                  maxLength={5}
                  placeholder={sourceCurrency || 'EUR'}
                />
              </div>
            </div>

            <div className="pf-modal-field">
              <label className="pf-modal-label" htmlFor="cash-fx-notes">
                {t('cash.fxModal.notes')}
              </label>
              <textarea
                id="cash-fx-notes"
                className="pf-modal-textarea"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
              />
            </div>

            {projectedNegative && (
              <div className={`pf-modal-callout ${strict ? 'pf-modal-callout--danger' : 'pf-modal-callout--warning'}`}>
                {strict
                  ? t('cash.warnings.strictWillReject', { currency: sourceCurrency })
                  : t('cash.warnings.projectedNegative', { currency: sourceCurrency })}
              </div>
            )}

            {formError && <div className="pf-modal-callout pf-modal-callout--danger">{formError}</div>}
          </div>
          <div className="pf-modal-footer">
            <button type="button" className="pf-modal-button pf-modal-button--secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="pf-modal-button pf-modal-button--primary" disabled={loading}>
              {loading ? t('common.saving') : t('cash.fxModal.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
