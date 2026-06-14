import { useEffect, useState } from 'react'
import api, { PortfolioHistoryPointDTO } from '../lib/api'
import usePortfolioStore from '../store/usePortfolioStore'
import type { ChartPeriodOption } from './chartUtils'

export function usePortfolioHistoryChart(portfolioId: number, locale: string) {
  const { portfolios } = usePortfolioStore()
  const [period, setPeriod] = useState<ChartPeriodOption>('1M')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<PortfolioHistoryPointDTO[]>([])
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const portfolio = portfolios.find(p => p.id === portfolioId)
  const currency = portfolio?.base_currency || 'USD'
  const currentLocale = locale || 'en-US'

  useEffect(() => {
    let canceled = false
    const load = async () => {
      setLoading(true)
      setHoveredIndex(null)
      try {
        const data = await api.getPortfolioHistory(portfolioId, period)
        if (!canceled) setHistory(data)
      } finally {
        if (!canceled) setLoading(false)
      }
    }
    load()
    return () => {
      canceled = true
    }
  }, [portfolioId, period])

  return {
    period,
    setPeriod,
    loading,
    history,
    hoveredIndex,
    setHoveredIndex,
    currentLocale,
    currency,
  }
}
