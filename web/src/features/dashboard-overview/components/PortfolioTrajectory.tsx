import { useMemo } from 'react'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { PortfolioHistoryPointDTO } from '@/api'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

interface PortfolioTrajectoryProps {
  points: PortfolioHistoryPointDTO[]
  currency: string
  locale: string
}

export default function PortfolioTrajectory({
  points,
  currency,
  locale,
}: PortfolioTrajectoryProps) {
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }),
    [currency, locale],
  )

  const data = useMemo(
    () => ({
      labels: points.map((point) =>
        new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
          new Date(point.date),
        ),
      ),
      datasets: [
        {
          label: 'Portfolio value',
          data: points.map((point) => Number(point.value)),
          borderColor: '#b51f5e',
          backgroundColor: 'rgba(181, 31, 94, 0.07)',
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHitRadius: 16,
          tension: 0.24,
          fill: true,
        },
        {
          label: 'Net invested',
          data: points.map((point) =>
            point.invested === undefined ? null : Number(point.invested),
          ),
          borderColor: '#8b858e',
          borderWidth: 1.5,
          borderDash: [7, 6],
          pointRadius: 0,
          pointHoverRadius: 3,
          tension: 0.12,
          spanGaps: true,
        },
      ],
    }),
    [locale, points],
  )

  const options = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 420,
        easing: 'easeOutQuart',
      },
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          displayColors: false,
          padding: 12,
          callbacks: {
            title: (items) => items[0]?.label ?? '',
            label: (context) =>
              `${context.dataset.label}: ${formatter.format(Number(context.parsed.y))}`,
          },
        },
      },
      scales: {
        x: {
          border: { display: false },
          grid: { display: false },
          ticks: {
            color: '#78716c',
            maxTicksLimit: 5,
            maxRotation: 0,
            font: { size: 11 },
          },
        },
        y: {
          position: 'right',
          border: { display: false },
          grid: {
            color: 'rgba(120, 113, 108, 0.14)',
          },
          ticks: {
            color: '#78716c',
            maxTicksLimit: 4,
            callback: (value) => formatter.format(Number(value)),
            font: { size: 11 },
          },
        },
      },
    }),
    [formatter],
  )

  if (points.length < 2) {
    return (
      <div className="dashboard-overview__chart-empty">
        A trajectory will appear after Portfolium has enough dated valuations.
      </div>
    )
  }

  return (
    <div
      className="dashboard-overview__chart"
      role="img"
      aria-label="Portfolio value and net invested trajectory"
    >
      <Line data={data} options={options} />
    </div>
  )
}
