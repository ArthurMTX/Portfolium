import type { CSSProperties, ReactNode } from 'react'

type StateTone = 'empty' | 'error' | 'info' | 'warning'

interface StateBlockProps {
  tone?: StateTone
  eyebrow?: string
  title: string
  description?: ReactNode
  detail?: ReactNode
  actionLabel?: string
  onAction?: () => void
  className?: string
  children?: ReactNode
}

interface SkeletonProps {
  label?: string
  className?: string
}

interface CountSkeletonProps extends SkeletonProps {
  count?: number
  rows?: number
}

interface TableSkeletonProps extends SkeletonProps {
  rows?: number
  columns?: number
}

export function StateBlock({
  tone = 'empty',
  eyebrow,
  title,
  description,
  detail,
  actionLabel,
  onAction,
  className = '',
  children,
}: StateBlockProps) {
  return (
    <section className={`pf-state pf-state--${tone} ${className}`.trim()} role={tone === 'error' ? 'alert' : 'status'}>
      {eyebrow && <p className="pf-state__eyebrow">{eyebrow}</p>}
      <h2 className="pf-state__title">{title}</h2>
      {description && <div className="pf-state__description">{description}</div>}
      {detail && <div className="pf-state__detail">{detail}</div>}
      {(actionLabel || children) && (
        <div className="pf-state__actions">
          {actionLabel && onAction && (
            <button type="button" className="pf-button pf-button--secondary" onClick={onAction}>
              {actionLabel}
            </button>
          )}
          {children}
        </div>
      )}
    </section>
  )
}

export function PageStateSkeleton({ label = 'Loading page', className = '' }: SkeletonProps) {
  return (
    <div className={`pf-page pf-page-flow pf-page-skeleton ${className}`.trim()} role="status" aria-label={label}>
      <section className="pf-page-header pf-page-skeleton__hero">
        <div className="pf-page-title-block">
          <span className="pf-skeleton pf-page-skeleton__kicker" />
          <span className="pf-skeleton pf-page-skeleton__title" />
        </div>
        <div className="pf-page-context pf-summary-panel pf-page-skeleton__context">
          <span className="pf-skeleton" />
          <span className="pf-skeleton" />
          <span className="pf-skeleton" />
        </div>
      </section>
      <MetricSkeletonStrip />
      <TableSkeleton rows={4} columns={5} />
    </div>
  )
}

export function MetricSkeletonStrip({ count = 4, label = 'Loading metrics', className = '' }: CountSkeletonProps) {
  return (
    <section className={`pf-metric-strip pf-metric-skeleton ${className}`.trim()} role="status" aria-label={label}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>
          <span className="pf-skeleton" />
          <strong className="pf-skeleton" />
        </div>
      ))}
    </section>
  )
}

export function TableSkeleton({
  rows = 5,
  columns = 5,
  label = 'Loading table',
  className = '',
}: TableSkeletonProps) {
  return (
    <div className={`pf-table-skeleton ${className}`.trim()} role="status" aria-label={label}>
      <div className="pf-table-skeleton__row is-header" style={{ '--pf-skeleton-columns': columns } as CSSProperties}>
        {Array.from({ length: columns }).map((_, index) => (
          <span key={index} className="pf-skeleton" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="pf-table-skeleton__row" style={{ '--pf-skeleton-columns': columns } as CSSProperties}>
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <span key={columnIndex} className="pf-skeleton" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 4, label = 'Loading list', className = '' }: CountSkeletonProps) {
  return (
    <div className={`pf-list-skeleton ${className}`.trim()} role="status" aria-label={label}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="pf-list-skeleton__row">
          <span className="pf-skeleton" />
          <span className="pf-skeleton" />
          <span className="pf-skeleton" />
        </div>
      ))}
    </div>
  )
}

export function ChartSkeleton({ label = 'Loading chart', className = '' }: SkeletonProps) {
  return (
    <div className={`pf-chart-skeleton ${className}`.trim()} role="status" aria-label={label}>
      <span className="pf-skeleton pf-chart-skeleton__title" />
      <div className="pf-chart-skeleton__plot">
        <span className="pf-skeleton" />
        <span className="pf-skeleton" />
        <span className="pf-skeleton" />
        <span className="pf-skeleton" />
      </div>
      <span className="pf-skeleton pf-chart-skeleton__legend" />
    </div>
  )
}

export function InlineLoading({ label = 'Loading', className = '' }: SkeletonProps) {
  return (
    <span className={`pf-inline-loading ${className}`.trim()} role="status">
      <span aria-hidden="true" />
      {label}
    </span>
  )
}
