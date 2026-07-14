import { useMemo, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '@/api'
import type { CashBalanceDTO, CashMovementDTO } from '@/api/types'
import { formatCurrency } from '@/shared/lib/formatUtils'
import {
  MANUAL_MOVEMENT_TYPES,
  type ManualMovementType,
  findBalance,
  parseCashErrorFromMessage,
  toAmount,
} from '@/features/cash/lib/cashDerivedState'

interface CashMovementModalProps {
  portfolioId: number
  strict: boolean
  balances: CashBalanceDTO[]
  baseCurrency: string
  currentLocale: string
  movement?: CashMovementDTO | null
  initialType?: ManualMovementType
  onClose: () => void
  onSaved: (message: string) => void
}

export default function CashMovementModal({
  portfolioId,
  strict,
  balances,
  baseCurrency,
  currentLocale,
  movement = null,
  initialType = 'deposit',
  onClose,
  onSaved,
}: CashMovementModalProps) {
  const { t } = useTranslation()
  const isEdit = movement != null
  const [type, setType] = useState<ManualMovementType>(
    (movement?.type as ManualMovementType) ?? initialType
  )
  const [currency, setCurrency] = useState(movement?.currency ?? baseCurrency)
  const [amount, setAmount] = useState(
    movement ? Math.abs(toAmount(movement.amount)).toString() : ''
  )
  const [occurredOn, setOccurredOn] = useState(
    movement?.occurred_on ?? new Date().toISOString().slice(0, 10)
  )
  const [direction, setDirection] = useState<'credit' | 'debit'>(
    movement && toAmount(movement.amount) >= 0 ? 'credit' : 'debit'
  )
  const [reason, setReason] = useState(movement?.reason ?? '')
  const [notes, setNotes] = useState(movement?.notes ?? '')
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  const isDebit = type === 'withdrawal' || type === 'fee' || type === 'tax'
    || (type === 'adjustment' && direction === 'debit')
  const parsedAmount = Number(amount)
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0

  const available = useMemo(() => {
    const balance = findBalance(balances, currency)
    return balance ? toAmount(balance.balance) : 0
  }, [balances, currency])

  const projected = useMemo(() => {
    if (!amountValid) return null
    const delta = isDebit ? -parsedAmount : parsedAmount
    // On edit, the current movement amount is replaced, not added
    const editOffset = movement ? -toAmount(movement.amount) : 0
    return available + editOffset + delta
  }, [amountValid, available, isDebit, movement, parsedAmount])

  const projectedNegative = projected !== null && projected < 0

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')
    if (!amountValid) {
      setFormError(t('cash.errors.invalidAmount'))
      return
    }
    if (type === 'adjustment' && !reason.trim()) {
      setFormError(t('cash.errors.reasonRequired'))
      return
    }
    setLoading(true)
    try {
      if (isEdit && movement) {
        await api.updateCashMovement(portfolioId, movement.id, {
          currency: currency.trim().toUpperCase(),
          amount,
          occurred_on: occurredOn,
          direction: type === 'adjustment' ? direction : undefined,
          reason: reason || null,
          notes: notes || null,
        })
        onSaved(t('cash.toasts.movementUpdated'))
      } else {
        await api.createCashMovement(portfolioId, {
          type,
          currency: currency.trim().toUpperCase(),
          amount,
          occurred_on: occurredOn,
          direction: type === 'adjustment' ? direction : undefined,
          reason: reason || null,
          notes: notes || null,
        })
        onSaved(t('cash.toasts.movementCreated'))
      }
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
      <div className="pf-modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="pf-modal-header">
          <h2 className="pf-modal-title">
            {isEdit ? t('cash.movementModal.editTitle') : t('cash.movementModal.title')}
          </h2>
          <button type="button" className="pf-modal-close" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="pf-modal-body">
            {!isEdit && (
              <div className="pf-modal-field">
                <label className="pf-modal-label" htmlFor="cash-movement-type">
                  {t('cash.movementModal.type')}
                </label>
                <select
                  id="cash-movement-type"
                  className="pf-modal-select"
                  value={type}
                  onChange={(event) => setType(event.target.value as ManualMovementType)}
                >
                  {MANUAL_MOVEMENT_TYPES.map((movementType) => (
                    <option key={movementType} value={movementType}>
                      {t(`cash.movementTypes.${movementType}`)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {type === 'adjustment' && (
              <div className="pf-modal-field">
                <label className="pf-modal-label" htmlFor="cash-movement-direction">
                  {t('cash.movementModal.direction')}
                </label>
                <select
                  id="cash-movement-direction"
                  className="pf-modal-select"
                  value={direction}
                  onChange={(event) => setDirection(event.target.value as 'credit' | 'debit')}
                >
                  <option value="credit">{t('cash.movementModal.directionCredit')}</option>
                  <option value="debit">{t('cash.movementModal.directionDebit')}</option>
                </select>
              </div>
            )}

            <div className="pf-modal-grid">
              <div className="pf-modal-field">
                <label className="pf-modal-label" htmlFor="cash-movement-currency">
                  {t('cash.movementModal.currency')}
                </label>
                <input
                  id="cash-movement-currency"
                  className="pf-modal-input"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                  maxLength={5}
                  placeholder="EUR"
                  required
                />
              </div>
              <div className="pf-modal-field">
                <label className="pf-modal-label" htmlFor="cash-movement-amount">
                  {t('cash.movementModal.amount')}
                </label>
                <input
                  id="cash-movement-amount"
                  className="pf-modal-input"
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
                <p className="pf-modal-help">{t('cash.movementModal.amountHelp')}</p>
              </div>
            </div>

            <div className="pf-modal-field">
              <label className="pf-modal-label" htmlFor="cash-movement-date">
                {t('cash.movementModal.date')}
              </label>
              <input
                id="cash-movement-date"
                className="pf-modal-input"
                type="date"
                value={occurredOn}
                onChange={(event) => setOccurredOn(event.target.value)}
                required
              />
            </div>

            {type === 'adjustment' && (
              <div className="pf-modal-field">
                <label className="pf-modal-label" htmlFor="cash-movement-reason">
                  {t('cash.movementModal.reason')}
                </label>
                <input
                  id="cash-movement-reason"
                  className="pf-modal-input"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={t('cash.movementModal.reasonPlaceholder')}
                  required
                />
              </div>
            )}

            <div className="pf-modal-field">
              <label className="pf-modal-label" htmlFor="cash-movement-notes">
                {t('cash.movementModal.notes')}
              </label>
              <textarea
                id="cash-movement-notes"
                className="pf-modal-textarea"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
              />
            </div>

            <div className="cash-projection">
              <div className="cash-projection__row">
                <span>{t('cash.movementModal.availableBalance', { currency })}</span>
                <span>{formatCurrency(available, currency, currentLocale, true)}</span>
              </div>
              {projected !== null && (
                <div className={`cash-projection__row${projectedNegative ? ' is-negative' : ''}`}>
                  <span>{t('cash.movementModal.projectedBalance')}</span>
                  <span>{formatCurrency(projected, currency, currentLocale, true)}</span>
                </div>
              )}
            </div>

            {projectedNegative && (
              <div className={`pf-modal-callout ${strict && isDebit ? 'pf-modal-callout--danger' : 'pf-modal-callout--warning'}`}>
                {strict && isDebit
                  ? t('cash.warnings.strictWillReject', { currency })
                  : t('cash.warnings.projectedNegative', { currency })}
              </div>
            )}

            {formError && <div className="pf-modal-callout pf-modal-callout--danger">{formError}</div>}
          </div>
          <div className="pf-modal-footer">
            <button type="button" className="pf-modal-button pf-modal-button--secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="pf-modal-button pf-modal-button--primary" disabled={loading}>
              {loading ? t('common.saving') : isEdit ? t('common.save') : t('cash.movementModal.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
