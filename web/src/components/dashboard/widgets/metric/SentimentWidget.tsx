import { useMemo, useState, useEffect } from 'react'
import { TrendingUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import GaugeComponent from 'react-gauge-component'
import { BaseWidgetProps } from '../../types'
import api from '@/lib/api'

interface SentimentWidgetProps extends BaseWidgetProps {
  title: string
  market?: 'stock' | 'crypto'
}

export default function SentimentWidget({
  title,
  market = 'stock',
  isPreview = false,
}: SentimentWidgetProps) {
  const { t } = useTranslation()
  const [score, setScore] = useState<number | null>(null)
  const [rating, setRating] = useState<string>('')
  const [previousScore, setPreviousScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isPreview) {
      // Mock data for preview
      setScore(30)
      setRating('fear')
      setPreviousScore(32)
      return
    }

    const fetchSentimentData = async () => {
      setLoading(true)
      try {
        const data = await api.getMarketSentiment(market)
        
        setScore(data.score)
        setRating(data.rating)
        setPreviousScore(data.previous_close || data.previous_value || null)
      } catch (error) {
        console.error('Failed to fetch sentiment data:', error)
        setScore(null)
        setRating('')
      } finally {
        setLoading(false)
      }
    }

    fetchSentimentData()
  }, [isPreview, market])

  const { displayRating } = useMemo(() => {
    const ratingLower = rating.toLowerCase()
    
    let displayRating = 'Unknown'

    if (ratingLower.includes('extreme fear')) {
      displayRating = 'Extreme Fear'
    } else if (ratingLower.includes('fear')) {
      displayRating = 'Fear'
    } else if (ratingLower.includes('neutral')) {
      displayRating = 'Neutral'
    } else if (ratingLower.includes('extreme greed')) {
      displayRating = 'Extreme Greed'
    } else if (ratingLower.includes('greed')) {
      displayRating = 'Greed'
    }

    return { displayRating }
  }, [rating])

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
                    { limit: 25, tooltip: { text: 'Extreme Fear'} },
                    { limit: 45, tooltip: { text: 'Fear'} },
                    { limit: 55, tooltip: { text: 'Neutral'} },
                    { limit: 75, tooltip: { text: 'Greed'} },
                    { limit: 100, tooltip: { text: 'Extreme Greed'} },
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
