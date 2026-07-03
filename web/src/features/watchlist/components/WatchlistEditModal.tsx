import { useState, useEffect } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { IconComponent } from '@/features/watchlist/components/WatchlistTagManager'
import AssetLogo from '@/shared/components/AssetLogo'
import { useTranslation } from 'react-i18next'

interface WatchlistTag {
  id: number
  user_id: number
  name: string
  icon: string
  color: string
  created_at: string
  updated_at: string
}

interface WatchlistItem {
  id: number
  symbol: string
  name: string | null
  notes: string | null
  alert_target_price: number | null
  alert_enabled: boolean
  current_price: number | null
  daily_change_pct: number | null
  currency: string
  asset_type: string | null
  tags: WatchlistTag[]
}

interface WatchlistEditModalProps {
  isOpen: boolean
  item: WatchlistItem | null
  availableTags: WatchlistTag[]
  onClose: () => void
  onSave: (id: number, data: {
    notes: string | null
    alert_target_price: number | null
    alert_enabled: boolean
    tag_ids: number[]
  }) => Promise<void>
}

export default function WatchlistEditModal({
  isOpen,
  item,
  availableTags,
  onClose,
  onSave,
}: WatchlistEditModalProps) {
  const { t } = useTranslation()
  const [notes, setNotes] = useState('')
  const [alertPrice, setAlertPrice] = useState('')
  const [alertEnabled, setAlertEnabled] = useState(false)
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when item changes
  useEffect(() => {
    if (item) {
      setNotes(item.notes || '')
      setAlertPrice(item.alert_target_price ? String(item.alert_target_price) : '')
      setAlertEnabled(item.alert_enabled)
      setSelectedTagIds(item.tags?.map(t => t.id) || [])
      setError(null)
    }
  }, [item])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!item) return

    setSaving(true)
    setError(null)

    try {
      await onSave(item.id, {
        notes: notes || null,
        alert_target_price: alertPrice ? parseFloat(alertPrice) : null,
        alert_enabled: alertEnabled,
        tag_ids: selectedTagIds,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const toggleTag = (tagId: number) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }

  if (!isOpen || !item) return null

  return (
    <div className="pf-modal-overlay">
      <div
        className="absolute inset-0"
        onClick={onClose}
      />

      <div className="pf-modal-panel" role="dialog" aria-modal="true">
        <div className="pf-modal-header">
          <div className="flex items-start gap-3">
            {/* Logo */}
            <AssetLogo
              symbol={item.symbol}
              assetType={item.asset_type}
              assetName={item.name}
              alt={item.symbol}
              className="w-10 h-10 object-contain p-1 flex-shrink-0"
            />
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                {item.symbol}
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {item.name || t('watchlist.editItem')}
              </p>
              {item.current_price !== null && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-medium text-neutral-900 dark:text-white">
                    {item.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.currency}
                  </span>
                  {item.daily_change_pct !== null && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      item.daily_change_pct > 0 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : item.daily_change_pct < 0
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                    }`}>
                      {item.daily_change_pct > 0 ? '+' : ''}{item.daily_change_pct.toFixed(2)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="pf-modal-close"
            aria-label={t('common.close')}
          >
            <X size={20} className="text-neutral-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="pf-modal-body pf-modal-section">
            {/* Error */}
            {error && (
              <div className="pf-modal-callout pf-modal-callout--danger flex items-center gap-2">
                <AlertTriangle size={16} />
                {error}
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="pf-modal-label">
                {t('fields.notes')}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('placeholders.enterNotes')}
                rows={3}
                className="pf-modal-textarea resize-none"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="pf-modal-label">
                {t('watchlist.tags.title')}
              </label>
              {availableTags.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {t('watchlist.tags.noTags')}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {[...availableTags].sort((a, b) => a.name.localeCompare(b.name)).map(tag => {
                    const isSelected = selectedTagIds.includes(tag.id)
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          isSelected
                            ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900'
                            : 'opacity-60 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: tag.color + (isSelected ? '30' : '15'),
                          color: tag.color,
                          ...(isSelected && { ringColor: tag.color }),
                        }}
                      >
                        <IconComponent name={tag.icon} size={14} />
                        {tag.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Alert Price */}
            <div className="pf-modal-grid items-start">
              <div>
                <label className="pf-modal-label">
                  {t('watchlist.alertTargetPrice')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={alertPrice}
                    onChange={(e) => setAlertPrice(e.target.value)}
                    placeholder="0.00"
                    className="pf-modal-input pr-14 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400 pointer-events-none">
                    {item.currency}
                  </span>
                </div>
                {alertPrice && item.current_price && (
                  <p className="mt-1 text-xs text-neutral-500">
                    {(() => {
                      const target = parseFloat(alertPrice)
                      const current = item.current_price
                      if (isNaN(target) || current === 0) return null
                      const diff = ((target - current) / current) * 100
                      const isPositive = diff > 0
                      return (
                        <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
                          {isPositive ? '+' : ''}{diff.toFixed(2)}% {t('watchlist.fromCurrent')}
                        </span>
                      )
                    })()}
                  </p>
                )}
              </div>
              <div className="pt-7">
                <label className={`flex items-center gap-3 group ${!alertPrice ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                  {/* Toggle Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={alertEnabled}
                    disabled={!alertPrice}
                    onClick={() => alertPrice && setAlertEnabled(!alertEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900 disabled:cursor-not-allowed ${
                      alertEnabled && alertPrice
                        ? 'bg-pink-600' 
                        : 'bg-neutral-300 dark:bg-neutral-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        alertEnabled && alertPrice ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className={`text-sm font-medium transition-colors ${
                    alertEnabled && alertPrice
                      ? 'text-pink-600 dark:text-pink-400' 
                      : 'text-neutral-500 dark:text-neutral-400'
                  }`}>
                    {t('watchlist.alertEnabled')}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pf-modal-footer">
            <div />
            <div className="pf-modal-footer-actions">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="pf-modal-button pf-modal-button--secondary"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="pf-modal-button pf-modal-button--primary"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('common.saving')}
                </>
              ) : (
                t('common.save')
              )}
            </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
