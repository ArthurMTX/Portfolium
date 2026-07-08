import { useMemo, useState, useEffect } from 'react'
import { Pizza } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BaseWidgetProps } from '@/features/boards/components/types'
import api from '@/api'
import { BaseWidget } from '@/features/boards/components/widgets/base/BaseWidget'
import { WidgetMetric } from '@/features/boards/components/widgets/base/WidgetMetric'

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
    <BaseWidget
      title={title}
      icon={Pizza}
      iconColor="text-orange-600 dark:text-orange-400"
      iconBgColor="bg-orange-50 dark:bg-orange-900/20"
      description={subtitle ? t(subtitle) : undefined}
      isLoading={loading}
      contentClassName="pf-card--content"
    >
      <WidgetMetric
        value={pizzaValue}
        valueColor="text-orange-600 dark:text-orange-400"
        size="md"
        secondaryLine={
          btcPriceDisplay && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">
              {btcPriceDisplay}
            </p>
          )
        }
      />
    </BaseWidget>
  )
}
