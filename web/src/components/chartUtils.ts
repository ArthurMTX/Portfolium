import type { Dispatch, SetStateAction } from 'react'

export type ChartPeriodOption = '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL'

export const CHART_PERIOD_OPTIONS: ChartPeriodOption[] = ['1W', '1M', '3M', '6M', 'YTD', '1Y', 'ALL']

export function getChartPeriodLabel(period: ChartPeriodOption, t: (key: string) => string): string {
  const labelMap: Record<ChartPeriodOption, string> = {
    '1W': t('charts.periods.1W'),
    '1M': t('charts.periods.1M'),
    '3M': t('charts.periods.3M'),
    '6M': t('charts.periods.6M'),
    'YTD': t('charts.periods.YTD'),
    '1Y': t('charts.periods.1Y'),
    'ALL': t('charts.periods.ALL'),
  }

  return labelMap[period]
}

export function formatChartDateLabel(date: Date, period: ChartPeriodOption, locale: string): string {
  if (period === '1W') {
    return date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })
  }
  if (period === '1M' || period === '3M') {
    return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  }
  if (period === '6M' || period === 'YTD' || period === '1Y') {
    return date.toLocaleDateString(locale, { month: 'short', year: '2-digit' })
  }

  return date.toLocaleDateString(locale, { month: 'short', year: 'numeric' })
}

export function formatChartTooltipDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    HKD: 'HK$',
    CAD: 'C$',
    AUD: 'A$',
    CHF: 'CHF',
    SGD: 'S$',
    INR: '₹',
    KRW: '₩',
  }

  return symbols[currency] || currency + ' '
}

export function getSignedColorClass(value: number): string {
  if (value === 0) return 'text-neutral-500 dark:text-neutral-400'
  return value > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
}

export function createChartHoverHandler(setHoveredIndex: Dispatch<SetStateAction<number | null>>) {
  return (_event: unknown, activeElements: { index: number }[]) => {
    if (activeElements && activeElements.length > 0) {
      setHoveredIndex(activeElements[0].index)
    } else {
      setHoveredIndex(null)
    }
  }
}
