import type { HTMLAttributes, ReactNode } from 'react'

/**
 * Canonical Portfolium page contract.
 *
 * Every major page composes the same skeleton, in this order:
 *
 *   <PageShell>
 *     <PageHeader>                      — title block left, summary panel right
 *       <PageTitleBlock kicker title description />
 *       <PageSummaryPanel lead actions />
 *     </PageHeader>
 *     <PageMetricStrip>                 — optional, directly under the header
 *       <PageMetric label value detail />
 *     </PageMetricStrip>
 *     <PageControls start end />        — tabs/filters/search left, sort/actions right
 *     <PageMainGrid>                    — main content left, contextual aside right
 *       <PageMainColumn />
 *       <PageAsideColumn />
 *     </PageMainGrid>
 *     <PageSection>                     — further full-width sections
 *       <PageSectionHeader kicker title description aside />
 *     </PageSection>
 *   </PageShell>
 *
 * Pages without metrics, controls, or aside content simply omit those pieces;
 * the spacing rhythm stays identical. No page defines its own shell, hero,
 * toolbar placement, or main grid.
 */

type DivProps = HTMLAttributes<HTMLElement>

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function PageShell({ className, children, ...rest }: DivProps) {
  return (
    <div className={cx('pf-page', 'pf-page-flow', className)} {...rest}>
      {children}
    </div>
  )
}

export function PageHeader({ className, children, ...rest }: DivProps) {
  return (
    <header className={cx('pf-page-header', className)} {...rest}>
      {children}
    </header>
  )
}

interface PageTitleBlockProps extends Omit<DivProps, 'title'> {
  kicker?: ReactNode
  title?: ReactNode
  description?: ReactNode
}

export function PageTitleBlock({ kicker, title, description, className, children, ...rest }: PageTitleBlockProps) {
  return (
    <div className={cx('pf-page-title-block', className)} {...rest}>
      {kicker !== undefined && <PageKicker>{kicker}</PageKicker>}
      {title !== undefined && <PageTitle>{title}</PageTitle>}
      {description !== undefined && description !== null && <PageDescription>{description}</PageDescription>}
      {children}
    </div>
  )
}

export function PageKicker({ className, children, ...rest }: DivProps) {
  return (
    <p className={cx('pf-page-kicker', className)} {...rest}>
      {children}
    </p>
  )
}

export function PageTitle({ className, children, ...rest }: DivProps) {
  return (
    <h1 className={cx('pf-page-title', 'pf-page-title--hero', className)} {...rest}>
      {children}
    </h1>
  )
}

export function PageDescription({ className, children, ...rest }: DivProps) {
  return (
    <div className={cx('pf-page-description', className)} {...rest}>
      {children}
    </div>
  )
}

interface PageSummaryPanelProps extends DivProps {
  lead?: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

export function PageSummaryPanel({ lead, description, actions, className, children, ...rest }: PageSummaryPanelProps) {
  return (
    <div className={cx('pf-page-context', 'pf-summary-panel', className)} {...rest}>
      {lead !== undefined && lead !== null && <strong className="pf-page-summary">{lead}</strong>}
      {description !== undefined && description !== null && <PageDescription>{description}</PageDescription>}
      {children}
      {actions !== undefined && actions !== null && <PageActions>{actions}</PageActions>}
    </div>
  )
}

export function PageActions({ className, children, ...rest }: DivProps) {
  return (
    <div className={cx('pf-page-actions', className)} {...rest}>
      {children}
    </div>
  )
}

interface PageMetricStripProps extends DivProps {
  label?: string
}

export function PageMetricStrip({ label, className, children, ...rest }: PageMetricStripProps) {
  return (
    <section className={cx('pf-metric-strip', className)} aria-label={label} {...rest}>
      {children}
    </section>
  )
}

interface PageMetricProps extends DivProps {
  label: ReactNode
  value: ReactNode
  detail?: ReactNode
  tone?: 'positive' | 'negative' | 'neutral'
  detailTone?: 'positive' | 'negative' | 'neutral'
}

export function PageMetric({ label, value, detail, tone, detailTone, className, ...rest }: PageMetricProps) {
  return (
    <div className={className} {...rest}>
      <span>{label}</span>
      <strong className={tone && tone !== 'neutral' ? `is-${tone}` : undefined}>{value}</strong>
      {detail !== undefined && detail !== null && (
        <em className={detailTone && detailTone !== 'neutral' ? `is-${detailTone}` : undefined}>{detail}</em>
      )}
    </div>
  )
}

interface PageControlsProps extends DivProps {
  start?: ReactNode
  end?: ReactNode
  label?: string
}

export function PageControls({ start, end, label, className, children, ...rest }: PageControlsProps) {
  return (
    <section className={cx('pf-page-controls', className)} aria-label={label} {...rest}>
      {(start !== undefined && start !== null) || children ? (
        <div className="pf-page-controls__start">
          {start}
          {children}
        </div>
      ) : (
        <div className="pf-page-controls__start" />
      )}
      {end !== undefined && end !== null && <div className="pf-page-controls__end">{end}</div>}
    </section>
  )
}

interface PageTabsProps extends DivProps {
  label?: string
}

export function PageTabs({ label, className, children, ...rest }: PageTabsProps) {
  return (
    <nav className={cx('pf-tabs', className)} aria-label={label} {...rest}>
      {children}
    </nav>
  )
}

interface PageMainGridProps extends DivProps {
  /** No aside column: main content spans the full grid width. */
  single?: boolean
}

export function PageMainGrid({ single = false, className, children, ...rest }: PageMainGridProps) {
  return (
    <div className={cx('pf-main-grid', single && 'pf-main-grid--single', className)} {...rest}>
      {children}
    </div>
  )
}

export function PageMainColumn({ className, children, ...rest }: DivProps) {
  return (
    <div className={cx('pf-main-col', className)} {...rest}>
      {children}
    </div>
  )
}

export function PageAsideColumn({ className, children, ...rest }: DivProps) {
  return (
    <aside className={cx('pf-aside-col', className)} {...rest}>
      {children}
    </aside>
  )
}

interface PageSectionProps extends DivProps {
  spacious?: boolean
}

export function PageSection({ spacious = true, className, children, ...rest }: PageSectionProps) {
  return (
    <section className={cx('pf-section', spacious && 'pf-section--spacious', className)} {...rest}>
      {children}
    </section>
  )
}

interface PageSectionHeaderProps extends Omit<DivProps, 'title'> {
  kicker?: ReactNode
  title?: ReactNode
  titleId?: string
  description?: ReactNode
  /** Right-aligned contextual meta or actions. */
  aside?: ReactNode
}

export function PageSectionHeader({
  kicker,
  title,
  titleId,
  description,
  aside,
  className,
  children,
  ...rest
}: PageSectionHeaderProps) {
  return (
    <div
      className={cx('pf-section-header', 'pf-section-header--grid', 'pf-section-header--spacious', className)}
      {...rest}
    >
      <div>
        {kicker !== undefined && kicker !== null && <p className="pf-section-kicker">{kicker}</p>}
        {title !== undefined && title !== null && (
          <h2 className="pf-section-title" id={titleId}>
            {title}
          </h2>
        )}
        {description !== undefined && description !== null && (
          <p className="pf-section-description">{description}</p>
        )}
        {children}
      </div>
      {aside !== undefined && aside !== null && <div className="pf-section-header__aside">{aside}</div>}
    </div>
  )
}

export function PageContentPanel({ className, children, ...rest }: DivProps) {
  return (
    <div className={cx('pf-panel', className)} {...rest}>
      {children}
    </div>
  )
}
