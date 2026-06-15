import type { Dispatch, SetStateAction } from 'react'

export type ChartPeriodOption = '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL'

export const CHART_PERIOD_OPTIONS: ChartPeriodOption[] = ['1W', '1M', '3M', '6M', 'YTD', '1Y', 'ALL']
export const CHART_ACCENT_COLOR = 'rgb(236,72,153)'
export const CHART_TICK_COLOR = '#64748b'
export const CHART_GRID_COLOR = 'rgba(100,116,139,0.08)'
export const CHART_ZERO_GRID_COLOR = 'rgba(100,116,139,0.3)'

export const CHART_TOOLTIP_BASE = {
  mode: 'index' as const,
  intersect: false,
  backgroundColor: 'rgba(30,41,59,0.95)',
  titleColor: '#fff',
  bodyColor: '#fff',
  borderColor: CHART_ACCENT_COLOR,
  borderWidth: 1,
  padding: 12,
  caretSize: 8,
}

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

export function getChartMaxTicksLimit(period: ChartPeriodOption): number {
  if (period === 'ALL') return 12
  if (period === '1Y') return 10
  return 8
}

export function createCategoryXAxis(period: ChartPeriodOption) {
  return {
    type: 'category' as const,
    title: { display: false },
    grid: { display: false },
    ticks: {
      color: CHART_TICK_COLOR,
      font: { size: 11 },
      maxRotation: 0,
      autoSkip: true,
      maxTicksLimit: getChartMaxTicksLimit(period),
      autoSkipPadding: 10,
    },
  }
}

export function createTooltipTitleCallback<T extends { date: string }>(history: T[], locale: string) {
  return (context: { dataIndex: number }[]) => {
    if (context.length > 0) {
      const date = new Date(history[context[0].dataIndex].date)
      return formatChartTooltipDate(date, locale)
    }
    return ''
  }
}
