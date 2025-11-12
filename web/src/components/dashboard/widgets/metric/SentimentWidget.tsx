import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import GaugeComponent from 'react-gauge-component'
import { BaseWidgetProps } from '../../types'
import api from '@/lib/api'
import { useWidgetVisibility } from '@/contexts/DashboardContext'

interface SentimentWidgetProps extends BaseWidgetProps {
  title: string
  market?: 'stock' | 'crypto'
  batchData?: { sentiment_stock?: unknown; sentiment_crypto?: unknown }
}

export default function SentimentWidget({
  title,
  market = 'stock',
  isPreview = false,
  batchData,
}: SentimentWidgetProps) {
  const { t } = useTranslation()
  const shouldLoad = useWidgetVisibility(`sentiment-${market}`)

  // Get data from batch if available, otherwise fall back to individual query
  const batchSentiment = market === 'stock' ? batchData?.sentiment_stock : batchData?.sentiment_crypto
  const hasBatchData = !!batchSentiment

  // React Query with caching and deduplication (only fetch if no batch data)
  const { data: queryData, isLoading: queryLoading } = useQuery({
    queryKey: ['market-sentiment', market],
    queryFn: () => api.getMarketSentiment(market),
    enabled: !isPreview && shouldLoad && !hasBatchData,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 2,
  })

  // Use batch data if available, otherwise use query data
  const data = (hasBatchData ? batchSentiment : queryData) as { score?: number; rating?: string; previous_close?: number; previous_value?: number } | undefined

  // Use mock data for preview, real data otherwise
  const score = isPreview ? 30 : data?.score ?? null
  const rating = isPreview ? 'fear' : data?.rating ?? ''
  const previousScore = isPreview ? 32 : data?.previous_close ?? data?.previous_value ?? null
  const loading = queryLoading && !isPreview && !hasBatchData

  const { displayRating } = useMemo(() => {
    const ratingLower = rating.toLowerCase()
    
    let displayRating = 'Unknown'

    if (ratingLower.includes('extreme fear')) {
      displayRating = t('market.sentiments.extremeFear')
    } else if (ratingLower.includes('fear')) {
      displayRating = t('market.sentiments.fear')
    } else if (ratingLower.includes('neutral')) {
      displayRating = t('market.sentiments.neutral')
    } else if (ratingLower.includes('extreme greed')) {
      displayRating = t('market.sentiments.extremeGreed')
    } else if (ratingLower.includes('greed')) {
      displayRating = t('market.sentiments.greed')
    }

    return { displayRating }
  }, [rating, t])

  const change = useMemo(() => {
    if (score === null || previousScore === null) return null
    const diff = score - previousScore
    return {
      value: Math.abs(diff),
      isPositive: diff >= 0,
    }
  }, [score, previousScore])

  return (
    <div className="card h-full flex flex-col p-5">
      <div className="flex items-start gap-2.5 mb-2">
        <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <TrendingUpDown className="text-blue-600 dark:text-blue-400" size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t(title)}
          </h3>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col justify-center items-center">
        {loading ? (
          <div className="flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-neutral-300 dark:border-neutral-600 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* Gauge */}
            <div className="w-full max-w-[240px] -my-3">
              <GaugeComponent
                type="semicircle"
                arc={{
                  colorArray: ['#ef4444', '#f97316', '#eab308', '#a3e635', '#22c55e'],
                  padding: 0.02,
                  subArcs: [
                    { limit: 25, tooltip: { text: t('market.sentiments.extremeFear') } },
                    { limit: 45, tooltip: { text: t('market.sentiments.fear') } },
                    { limit: 55, tooltip: { text: t('market.sentiments.neutral') } },
                    { limit: 75, tooltip: { text: t('market.sentiments.greed') } },
                    { limit: 100, tooltip: { text: t('market.sentiments.extremeGreed') } },
                  ],
                }}
                pointer={{
                  elastic: true,
                  animationDelay: 0,
                }}
                value={score || 0}
                minValue={0}
                maxValue={100}
                labels={{
                  valueLabel: {
                    style: {
                      fontSize: '40px',
                      fill: '#374151',
                      textShadow: 'none',
                    },
                    matchColorWithArc: true,
                  },
                  tickLabels: {
                    hideMinMax: true,
                    defaultTickValueConfig: {
                      hide: true,
                    },
                  },
                }}
              />
            </div>

            {/* Rating and Change */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  {displayRating}
                </p>
                {change && (
                  <span
                    className={`text-xs font-medium ${
                      change.isPositive
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {change.isPositive ? '+' : '-'}{change.value}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
