import { PositionDTO } from '@/api'
import { formatCurrency, formatNumber, formatQuantity } from '@/shared/lib/formatUtils'

export interface TradingPerformanceMetric {
  key: string
  label: string
  value: string
  color?: string
}

const pnlColor = (value: number) => (
  value >= 0
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400'
)

export function buildTradingPerformanceMetrics(position: PositionDTO): TradingPerformanceMetric[] {
  const metrics: TradingPerformanceMetric[] = []

  if (position.quantity > 0 && position.unrealized_pnl !== null) {
    metrics.push({
      key: 'unrealized-pnl',
      label: 'Unrealized P&L',
      value: formatCurrency(position.unrealized_pnl, position.currency),
      color: pnlColor(position.unrealized_pnl),
    })
  }

  if (position.realized_quantity > 0) {
    metrics.push({
      key: 'realized-pnl',
      label: 'Realized P&L',
      value: formatCurrency(position.realized_pnl, position.currency),
      color: pnlColor(position.realized_pnl),
    })

    if (position.lifetime_pnl !== null) {
      metrics.push({
        key: 'lifetime-pnl',
        label: 'Lifetime P&L',
        value: formatCurrency(position.lifetime_pnl, position.currency),
        color: pnlColor(position.lifetime_pnl),
      })
    }
  }

  metrics.push(
    {
      key: 'total-bought',
      label: 'Total Quantity Bought',
      value: formatQuantity(position.total_quantity_bought),
    },
    {
      key: 'total-sold',
      label: 'Total Quantity Sold',
      value: formatQuantity(position.realized_quantity),
    },
    {
      key: 'remaining',
      label: 'Remaining Quantity',
      value: formatQuantity(position.quantity),
    },
    {
      key: 'average-cost',
      label: 'Average Cost',
      value: formatCurrency(position.avg_cost, position.currency),
    },
  )

  if (position.average_sell_price !== null) {
    metrics.push({
      key: 'average-exit',
      label: 'Average Exit Price',
      value: formatCurrency(position.average_sell_price, position.currency),
    })
  }

  if (position.realized_cost_basis > 0) {
    metrics.push({
      key: 'cost-basis-sold',
      label: 'Cost Basis Sold',
      value: formatCurrency(position.realized_cost_basis, position.currency),
    })
  }

  if (position.realized_sale_proceeds > 0) {
    metrics.push({
      key: 'sale-proceeds',
      label: 'Sale Proceeds',
      value: formatCurrency(position.realized_sale_proceeds, position.currency),
    })
  }

  if (position.realized_fees > 0) {
    metrics.push({
      key: 'fees',
      label: 'Fees',
      value: formatCurrency(position.realized_fees, position.currency),
      color: 'text-red-600 dark:text-red-400',
    })
  }

  if (position.realized_sell_count > 0) {
    metrics.push({
      key: 'sell-count',
      label: 'Completed Sales',
      value: formatNumber(position.realized_sell_count, 0),
    })
  }

  return metrics
}
