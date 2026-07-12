export const formatTransactionQuantity = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return '-'
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  const formatted = numValue.toFixed(8)
  return formatted.replace(/\.?0+$/, '')
}

export const parseAmount = (value: string | number | null | undefined, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = typeof value === 'string' ? parseFloat(value) : value
  return Number.isFinite(parsed) ? parsed : fallback
}

export const parseDateOnly = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const isFutureDate = (value: string) => {
  const parsed = parseDateOnly(value)
  if (!parsed) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return parsed > today
}

export const isVeryOldDate = (value: string) => {
  const parsed = parseDateOnly(value)
  return Boolean(parsed && parsed < new Date('1990-01-01T00:00:00'))
}
