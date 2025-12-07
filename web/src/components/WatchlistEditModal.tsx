import { useState, useEffect } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { IconComponent } from './WatchlistTagManager'
import { getAssetLogoUrl, handleLogoError, validateLogoImage } from '../lib/logoUtils'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-neutral-900 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-start gap-3">
            {/* Logo */}
            <img
              src={getAssetLogoUrl(item.symbol, item.asset_type)}
              alt={item.symbol}
              className="w-10 h-10 object-contain p-1 flex-shrink-0"
              onLoad={(e) => validateLogoImage(e.currentTarget)}
              onError={(e) => handleLogoError(e, item.symbol, item.name, item.asset_type)}
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
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X size={20} className="text-neutral-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                <AlertTriangle size={16} />
                {error}
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                {t('fields.notes')}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('placeholders.enterNotes')}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
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
            <div className="grid grid-cols-2 gap-4 items-start">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  {t('watchlist.alertTargetPrice')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={alertPrice}
                    onChange={(e) => setAlertPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 pr-14 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 rounded-b-xl">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
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
        </form>
      </div>
    </div>
  )
}
