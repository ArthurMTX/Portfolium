import { X, Calendar, Shuffle, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useTranslation } from 'react-i18next'

interface SplitTransaction {
  id: number
  tx_date: string
  metadata: {
    split?: string
  }
  notes: string | null
}

interface SplitHistoryProps {
  assetId: number
  assetSymbol: string
  portfolioId?: number
  onClose: () => void
}

export default function SplitHistory({ assetId, assetSymbol, portfolioId, onClose }: SplitHistoryProps) {
  const [splits, setSplits] = useState<SplitTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const { t } = useTranslation()

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  useEffect(() => {
    const fetchSplits = async () => {
      try {
        setLoading(true)
        const data = await api.getAssetSplitHistory(assetId, portfolioId)
        setSplits(data)
      } catch (error) {
        console.error('Failed to fetch split history:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSplits()
  }, [assetId, portfolioId])

  const parseSplitRatio = (splitStr: string): { ratio: number; description: string } => {
    const parts = splitStr.split(':')
    if (parts.length === 2) {
      const numerator = parseFloat(parts[0])
      const denominator = parseFloat(parts[1])
      const ratio = numerator / denominator
      
      // Format ratio intelligently based on size
      const formatRatio = (r: number): string => {
        if (r >= 1) {
          // For normal splits (2:1, 3:1, etc.), use 2 decimals
          return r.toFixed(2)
        } else if (r >= 0.01) {
          // For moderate reverse splits, use 2-4 decimals
          return r.toFixed(4).replace(/\.?0+$/, '')
        } else {
          // For extreme reverse splits (1:10000), show in scientific notation or more decimals
          return r < 0.001 ? r.toExponential(2) : r.toFixed(6).replace(/\.?0+$/, '')
        }
      }
      
      if (ratio > 1) {
        return {
          ratio,
          description: t('splitHistory.forwardSplitDescription', {
            numerator: parts[0],
            denominator: parts[1],
            ratio: formatRatio(ratio)
          })
        }
      } else if (ratio < 1) {
        return {
          ratio,
          description: t('splitHistory.reverseSplitDescription', {
            numerator: parts[0],
            denominator: parts[1],
            ratio: formatRatio(ratio)
          })
        }
      }
    }
    return { ratio: 1, description: t('splitHistory.invalidSplitRatio') }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="modal-overlay bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Shuffle className="text-purple-600" size={28} />
              {t('splitHistory.title')}
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              {assetSymbol}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
              {t('splitHistory.loading')}
            </div>
          ) : splits.length === 0 ? (
            <div className="text-center py-12">
              <Shuffle className="mx-auto text-neutral-400 dark:text-neutral-600 mb-4" size={48} />
              <p className="text-neutral-600 dark:text-neutral-400">
                {t('splitHistory.noSplits', { ticker: assetSymbol })}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-2">
                {t('splitHistory.noSplitsInfo')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {splits.map((split, index) => {
                const splitInfo = parseSplitRatio(split.metadata?.split || '1:1')
                const isReverse = splitInfo.ratio < 1
                
                return (
                  <div
                    key={split.id}
                    className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`p-2 rounded-lg ${isReverse ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-purple-100 dark:bg-purple-900/30'}`}>
                            {isReverse ? (
                              <TrendingUp className="text-orange-600 dark:text-orange-400" size={20} />
                            ) : (
                              <Shuffle className="text-purple-600 dark:text-purple-400" size={20} />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                              {split.metadata?.split || 'Unknown'}
                            </div>
                            <div className="text-sm text-neutral-600 dark:text-neutral-400">
                              {splitInfo.description}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mt-3">
                          <Calendar size={14} />
                          <span>{formatDate(split.tx_date)}</span>
                        </div>
                        
                        {split.notes && (
                          <div className="mt-3 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded text-sm text-neutral-700 dark:text-neutral-300">
                            {split.notes}
                          </div>
                        )}
                      </div>
                      
                      <div className="ml-4 text-right">
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                          {t('splitHistory.split')} #{splits.length - index}
                        </div>
                        <div className={`mt-1 px-3 py-1 rounded-full text-xs font-medium ${
                          isReverse 
                            ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                            : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                        }`}>
                          {isReverse ? t('splitHistory.reverse') : t('splitHistory.forward')}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              
              {/* Summary */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="text-sm text-blue-900 dark:text-blue-300">
                  <strong>{t('splitHistory.totalSplitsRecorded')}:</strong> {splits.length}
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                  {t('splitHistory.splitsInfo')}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
