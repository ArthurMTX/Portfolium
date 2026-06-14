import { BookOpen, Calendar, Edit3, ShieldCheck, Target } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AssetInvestmentNoteDTO } from '../lib/api'
import { formatCurrency } from '../lib/formatUtils'

interface AssetInvestmentNoteSummaryProps {
  note: AssetInvestmentNoteDTO | null
  currency?: string | null
  onEdit: () => void
  loading?: boolean
}

function hasNoteContent(note: AssetInvestmentNoteDTO | null): boolean {
  if (!note) return false
  return Boolean(
    note.thesis ||
    note.conviction ||
    note.risks ||
    note.target_price ||
    note.target_text ||
    note.invalidation_thesis ||
    note.horizon ||
    note.horizon_date,
  )
}

export default function AssetInvestmentNoteSummary({
  note,
  currency = 'USD',
  onEdit,
  loading = false,
}: AssetInvestmentNoteSummaryProps) {
  const { t } = useTranslation()
  const hasContent = hasNoteContent(note)
  const targetPrice = note?.target_price
  const formattedTargetPrice =
    targetPrice != null && !Number.isNaN(targetPrice)
      ? formatCurrency(targetPrice, currency || 'USD')
      : null

  return (
    <section className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center flex-shrink-0">
            <BookOpen size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {t('assetInvestmentNotes.title')}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {hasContent
                ? t('assetInvestmentNotes.updatedAt', {
                    date: note?.updated_at ? new Date(note.updated_at).toLocaleDateString() : '-',
                  })
                : t('assetInvestmentNotes.emptyDescription')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="btn-secondary inline-flex items-center justify-center gap-2"
          disabled={loading}
        >
          <Edit3 size={16} />
          {hasContent ? t('common.edit') : t('assetInvestmentNotes.addThesis')}
        </button>
      </div>

      {loading ? (
        <div className="mt-5 space-y-3 animate-pulse">
          <div className="h-4 w-3/4 rounded bg-neutral-100 dark:bg-neutral-800" />
          <div className="h-4 w-1/2 rounded bg-neutral-100 dark:bg-neutral-800" />
        </div>
      ) : hasContent ? (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            {note?.conviction && (
              <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                <ShieldCheck size={13} />
                {t(`assetInvestmentNotes.convictionOptions.${note.conviction}`)}
              </span>
            )}
            {note?.horizon && (
              <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                <Calendar size={13} />
                {t(`assetInvestmentNotes.horizonOptions.${note.horizon}`)}
              </span>
            )}
            {(formattedTargetPrice || note?.target_text) && (
              <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                <Target size={13} />
                {[formattedTargetPrice, note?.target_text].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>

          <div className="space-y-4">
            {note?.thesis && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">
                  {t('assetInvestmentNotes.whyIBought')}
                </h4>
                <p className="text-sm leading-6 text-neutral-700 dark:text-neutral-300 whitespace-pre-line">
                  {note.thesis}
                </p>
              </div>
            )}

            {note?.risks && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">
                  {t('assetInvestmentNotes.risks')}
                </h4>
                <p className="text-sm leading-6 text-neutral-700 dark:text-neutral-300 whitespace-pre-line">
                  {note.risks}
                </p>
              </div>
            )}

            {note?.invalidation_thesis && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">
                  {t('assetInvestmentNotes.invalidationThesis')}
                </h4>
                <p className="text-sm leading-6 text-neutral-700 dark:text-neutral-300 whitespace-pre-line">
                  {note.invalidation_thesis}
                </p>
              </div>
            )}

            {note?.horizon_date && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">
                  {t('assetInvestmentNotes.horizonDate')}
                </h4>
                <p className="text-sm text-neutral-700 dark:text-neutral-300">
                  {new Date(note.horizon_date).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-4 text-sm text-neutral-500 dark:text-neutral-400">
          {t('assetInvestmentNotes.emptyState')}
        </div>
      )}
    </section>
  )
}
