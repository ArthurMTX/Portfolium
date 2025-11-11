import { useMemo, useState, useEffect } from 'react'
import { Pizza } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BaseWidgetProps } from '../../types'
import api from '@/lib/api'

interface BitcoinPizzaWidgetProps extends BaseWidgetProps {
  title: string
  subtitle?: string
}

export default function BitcoinPizzaWidget({
  title,
  subtitle,
  isPreview = false,
}: BitcoinPizzaWidgetProps) {
  const { t } = useTranslation()
  const [btcPrice, setBtcPrice] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isPreview) {
      setBtcPrice(100000) // Mock price for preview
      return
    }

    const fetchBtcPrice = async () => {
      setLoading(true)
      try {
        // Try to get BTC-USD price from the API
        const response = await api.getPrices(['BTC-USD'])
        const btcData = response['BTC-USD'] as { price?: string | number }
        if (btcData && btcData.price) {
          const price = typeof btcData.price === 'string' ? parseFloat(btcData.price) : btcData.price
          setBtcPrice(price)
        } else {
          setBtcPrice(null)
        }
      } catch (error) {
        console.error('Failed to fetch BTC price:', error)
        setBtcPrice(null)
      } finally {
        setLoading(false)
      }
    }

    fetchBtcPrice()
  }, [isPreview])

  const pizzaValue = useMemo(() => {
    if (!btcPrice) return 'N/A'
    
    const totalValue = btcPrice * 10000 // 10,000 BTC
    
    // Format with full number and commas
    return `$${totalValue.toLocaleString(undefined, { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    })}`
  }, [btcPrice])

  const btcPriceDisplay = useMemo(() => {
    if (!btcPrice) return ''
    return `BTC @ $${btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  }, [btcPrice])

  return (
    <div className="card h-full flex flex-col p-5">
      <div className="flex items-start gap-2.5 mb-4">
        <div className="w-9 h-9 bg-orange-50 dark:bg-orange-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <Pizza className="text-orange-600 dark:text-orange-400" size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t(title)}
          </h3>
          {subtitle && (
            <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 truncate">
              {subtitle}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center -mt-2">
        {loading ? (
          <div className="flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-neutral-300 dark:border-neutral-600 border-t-orange-500 rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <p className="text-xl font-semibold break-words leading-tight text-orange-600 dark:text-orange-400">
              {pizzaValue}
            </p>
            {btcPriceDisplay && (
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">
                {btcPriceDisplay}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
