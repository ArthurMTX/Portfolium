import { AlertTriangle, CheckCircle, FileText, Info, ShieldAlert, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CsvImportPreviewResultDTO } from '@/api'
import LoadingSpinner from '@/shared/components/LoadingSpinner'

interface ImportReviewModalProps {
  isOpen: boolean
  file: File | null
  preview: CsvImportPreviewResultDTO | null
  loading: boolean
  error: string
  onCancel: () => void
  onConfirm: () => void
}

const typeLabelKeys: Record<string, string> = {
  BUY: 'transaction.types.buy',
  SELL: 'transaction.types.sell',
  DIVIDEND: 'transaction.types.dividend',
  FEE: 'transaction.types.fee',
  SPLIT: 'transaction.types.split',
  TRANSFER_IN: 'transaction.types.transferIn',
  TRANSFER_OUT: 'transaction.types.transferOut',
  CONVERSION_IN: 'transaction.types.conversionIn',
  CONVERSION_OUT: 'transaction.types.conversionOut',
}

export default function ImportReviewModal({
  isOpen,
  file,
  preview,
  loading,
  error,
  onCancel,
  onConfirm,
}: ImportReviewModalProps) {
  const { t } = useTranslation()

  if (!isOpen) return null

  const canConfirm = !!preview && preview.error_count === 0 && !loading
  const summaryEntries = preview ? Object.entries(preview.summary_by_type) : []

  return (
    <div className="pf-modal-overlay">
      <div className="pf-modal-panel pf-modal-panel--xl flex flex-col" role="dialog" aria-modal="true">
        <div className="pf-modal-header flex-shrink-0">
          <div className="min-w-0">
            <h2 className="pf-modal-title flex items-center gap-2">
              <FileText className="text-neutral-400" size={18} />
              {t('importReviewModal.title')}
            </h2>
            {file && (
              <p className="pf-modal-description truncate">
                {file.name}
              </p>
            )}
          </div>
          <button
            onClick={onCancel}
            className="pf-modal-close"
            aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
        </div>

        <div className="pf-modal-body flex-1 min-h-0 space-y-4">
          {loading && (
            <div className="flex items-center justify-center gap-3 py-12 text-neutral-600 dark:text-neutral-300">
              <LoadingSpinner variant="icon" size="sm" />
              <span>{t('importReviewModal.loading')}</span>
            </div>
          )}

          {!loading && error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm flex items-start gap-2">
              <ShieldAlert size={18} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!loading && preview && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Metric label={t('importReviewModal.rowsDetected')} value={preview.total_rows} />
                <Metric label={t('importReviewModal.validTransactions')} value={preview.valid_count} tone="success" />
                <Metric label={t('importReviewModal.errors')} value={preview.error_count} tone={preview.error_count > 0 ? 'danger' : 'default'} />
                <Metric label={t('importReviewModal.warnings')} value={preview.warning_count} tone={preview.warning_count > 0 ? 'warning' : 'default'} />
                <Metric label={t('importReviewModal.duplicates')} value={preview.duplicate_count} tone={preview.duplicate_count > 0 ? 'warning' : 'default'} />
              </div>

              {summaryEntries.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                    {t('importReviewModal.summaryByType')}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {summaryEntries.map(([type, count]) => (
                      <span
                        key={type}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-sm"
                      >
                        <span className="font-medium">{t(typeLabelKeys[type] || type)}</span>
                        <span className="text-neutral-500 dark:text-neutral-400">{count}</span>
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {preview.error_count === 0 ? (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 text-sm flex items-start gap-2">
                  <CheckCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <span>{t('importReviewModal.readyToImport')}</span>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm flex items-start gap-2">
                  <ShieldAlert size={18} className="flex-shrink-0 mt-0.5" />
                  <span>{t('importReviewModal.fixErrors')}</span>
                </div>
              )}

              <IssueList
                title={t('importReviewModal.errors')}
                items={preview.errors}
                tone="danger"
                emptyText={t('importReviewModal.noErrors')}
              />
              <IssueList
                title={t('importReviewModal.warnings')}
                items={preview.warnings}
                tone="warning"
                emptyText={t('importReviewModal.noWarnings')}
              />
              <DuplicateList
                title={t('importReviewModal.duplicates')}
                items={preview.duplicates}
                emptyText={t('importReviewModal.noDuplicates')}
              />
            </>
          )}
        </div>

        <div className="pf-modal-footer flex-shrink-0">
          <div />
          <div className="pf-modal-footer-actions">
          <button onClick={onCancel} className="pf-modal-button pf-modal-button--secondary">
            {t('common.cancel')}
          </button>
          <button onClick={onConfirm} disabled={!canConfirm} className="pf-modal-button pf-modal-button--primary">
            {t('importReviewModal.confirmImport')}
          </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'success' | 'warning' | 'danger'
}) {
  const toneClass = {
    default: 'text-neutral-900 dark:text-neutral-100',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    danger: 'text-red-600 dark:text-red-400',
  }[tone]

  return (
    <div className="pf-modal-muted-box min-h-[82px]">
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-snug">{label}</div>
    </div>
  )
}

function IssueList({
  title,
  items,
  tone,
  emptyText,
}: {
  title: string
  items: Array<{ row_num: number | null; message: string }>
  tone: 'warning' | 'danger'
  emptyText: string
}) {
  const { t } = useTranslation()
  const icon = tone === 'danger' ? ShieldAlert : AlertTriangle
  const Icon = icon
  const titleClass = tone === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
  const bodyClass = tone === 'danger'
    ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
    : 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300'

  return (
    <section>
      <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${titleClass}`}>
        <Icon size={16} />
        {title}
      </h3>
      <div className={`rounded-lg p-3 text-sm space-y-1 ${bodyClass}`}>
        {items.length === 0 ? (
          <div>{emptyText}</div>
        ) : (
          items.slice(0, 20).map((item, index) => (
            <div key={`${item.row_num ?? 'global'}-${index}`}>
              {item.row_num ? t('importReviewModal.rowPrefix', { row: item.row_num }) : t('importReviewModal.filePrefix')}: {item.message}
            </div>
          ))
        )}
        {items.length > 20 && (
          <div className="text-xs opacity-80">
            {t('importReviewModal.moreItems', { count: items.length - 20 })}
          </div>
        )}
      </div>
    </section>
  )
}

function DuplicateList({
  title,
  items,
  emptyText,
}: {
  title: string
  items: Array<{ row_num: number; message: string; scope: string }>
  emptyText: string
}) {
  const { t } = useTranslation()

  return (
    <section>
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
        <Info size={16} />
        {title}
      </h3>
      <div className="rounded-lg p-3 text-sm space-y-1 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300">
        {items.length === 0 ? (
          <div>{emptyText}</div>
        ) : (
          items.slice(0, 20).map((item, index) => (
            <div key={`${item.scope}-${item.row_num}-${index}`}>
              {t('importReviewModal.rowPrefix', { row: item.row_num })}: {item.message}
            </div>
          ))
        )}
        {items.length > 20 && (
          <div className="text-xs opacity-80">
            {t('importReviewModal.moreItems', { count: items.length - 20 })}
          </div>
        )}
      </div>
    </section>
  )
}
