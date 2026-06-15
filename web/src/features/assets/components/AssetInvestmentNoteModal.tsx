import { useEffect, useState } from 'react'
import type React from 'react'
import { BookOpen, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api, {
  AssetInvestmentConviction,
  AssetInvestmentHorizon,
  AssetInvestmentNoteDTO,
  AssetInvestmentNoteUpdate,
} from '@/api'

interface AssetInvestmentNoteModalProps {
  assetId: number
  symbol: string
  note: AssetInvestmentNoteDTO | null
  isOpen: boolean
  onClose: () => void
  onSaved: (note: AssetInvestmentNoteDTO | null) => void
}

interface FormState {
  thesis: string
  conviction: '' | AssetInvestmentConviction
  risks: string
  target_price: string
  target_text: string
  invalidation_thesis: string
  horizon: '' | AssetInvestmentHorizon
  horizon_date: string
}

const emptyForm: FormState = {
  thesis: '',
  conviction: '',
  risks: '',
  target_price: '',
  target_text: '',
  invalidation_thesis: '',
  horizon: '',
  horizon_date: '',
}

function formFromNote(note: AssetInvestmentNoteDTO | null): FormState {
  if (!note) return emptyForm
  return {
    thesis: note.thesis || '',
    conviction: note.conviction || '',
    risks: note.risks || '',
    target_price: note.target_price !== null && note.target_price !== undefined ? String(note.target_price) : '',
    target_text: note.target_text || '',
    invalidation_thesis: note.invalidation_thesis || '',
    horizon: note.horizon || '',
    horizon_date: note.horizon_date || '',
  }
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export default function AssetInvestmentNoteModal({
  assetId,
  symbol,
  note,
  isOpen,
  onClose,
  onSaved,
}: AssetInvestmentNoteModalProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setForm(formFromNote(note))
    setError(null)
  }, [isOpen, note])

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  if (!isOpen) return null

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const buildPayload = (): AssetInvestmentNoteUpdate => ({
    thesis: emptyToNull(form.thesis),
    conviction: form.conviction || null,
    risks: emptyToNull(form.risks),
    target_price: form.target_price.trim() ? Number(form.target_price) : null,
    target_text: emptyToNull(form.target_text),
    invalidation_thesis: emptyToNull(form.invalidation_thesis),
    horizon: form.horizon || null,
    horizon_date: form.horizon_date || null,
  })

  const handleSave = async () => {
    const payload = buildPayload()
    if (payload.target_price !== null && Number.isNaN(payload.target_price)) {
      setError(t('assetInvestmentNotes.errors.invalidTargetPrice'))
      return
    }

    try {
      setSaving(true)
      setError(null)
      const saved = await api.saveAssetInvestmentNote(assetId, payload)
      onSaved(saved)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('assetInvestmentNotes.errors.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!note) return
    try {
      setDeleting(true)
      setError(null)
      await api.deleteAssetInvestmentNote(assetId)
      onSaved(null)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('assetInvestmentNotes.errors.deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="modal-overlay fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="card max-w-3xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-6 py-5 flex items-center justify-between z-10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center flex-shrink-0">
                <BookOpen size={20} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('assetInvestmentNotes.title')}
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">{symbol}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <X size={20} className="text-neutral-500 dark:text-neutral-400" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </div>
            )}

            <Field label={t('assetInvestmentNotes.thesis')}>
              <textarea
                value={form.thesis}
                onChange={(event) => updateField('thesis', event.target.value)}
                rows={4}
                className="input w-full"
                placeholder={t('assetInvestmentNotes.thesisPlaceholder')}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('assetInvestmentNotes.conviction')}>
                <select
                  value={form.conviction}
                  onChange={(event) => updateField('conviction', event.target.value)}
                  className="input w-full"
                >
                  <option value="">{t('assetInvestmentNotes.none')}</option>
                  <option value="low">{t('assetInvestmentNotes.convictionOptions.low')}</option>
                  <option value="medium">{t('assetInvestmentNotes.convictionOptions.medium')}</option>
                  <option value="high">{t('assetInvestmentNotes.convictionOptions.high')}</option>
                </select>
              </Field>

              <Field label={t('assetInvestmentNotes.horizon')}>
                <select
                  value={form.horizon}
                  onChange={(event) => updateField('horizon', event.target.value)}
                  className="input w-full"
                >
                  <option value="">{t('assetInvestmentNotes.none')}</option>
                  <option value="short">{t('assetInvestmentNotes.horizonOptions.short')}</option>
                  <option value="medium">{t('assetInvestmentNotes.horizonOptions.medium')}</option>
                  <option value="long">{t('assetInvestmentNotes.horizonOptions.long')}</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('assetInvestmentNotes.targetPrice')}>
                <input
                  type="number"
                  min="0"
                  step="0.00000001"
                  value={form.target_price}
                  onChange={(event) => updateField('target_price', event.target.value)}
                  className="input w-full"
                  placeholder="250.00"
                />
              </Field>

              <Field label={t('assetInvestmentNotes.horizonDate')}>
                <input
                  type="date"
                  value={form.horizon_date}
                  onChange={(event) => updateField('horizon_date', event.target.value)}
                  className="input w-full"
                />
              </Field>
            </div>

            <Field label={t('assetInvestmentNotes.targetText')}>
              <input
                type="text"
                value={form.target_text}
                onChange={(event) => updateField('target_text', event.target.value)}
                className="input w-full"
                placeholder={t('assetInvestmentNotes.targetTextPlaceholder')}
              />
            </Field>

            <Field label={t('assetInvestmentNotes.risks')}>
              <textarea
                value={form.risks}
                onChange={(event) => updateField('risks', event.target.value)}
                rows={3}
                className="input w-full"
                placeholder={t('assetInvestmentNotes.risksPlaceholder')}
              />
            </Field>

            <Field label={t('assetInvestmentNotes.invalidationThesis')}>
              <textarea
                value={form.invalidation_thesis}
                onChange={(event) => updateField('invalidation_thesis', event.target.value)}
                rows={3}
                className="input w-full"
                placeholder={t('assetInvestmentNotes.invalidationPlaceholder')}
              />
            </Field>
          </div>

          <div className="border-t border-neutral-200 dark:border-neutral-700 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              {note && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  className="btn-secondary inline-flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={16} />
                  {deleting ? t('common.deleting') : t('common.delete')}
                </button>
              )}
            </div>
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={onClose} className="btn-secondary" disabled={saving || deleting}>
                {t('common.cancel')}
              </button>
              <button type="button" onClick={handleSave} className="btn-primary" disabled={saving || deleting}>
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
        {label}
      </span>
      {children}
    </label>
  )
}
