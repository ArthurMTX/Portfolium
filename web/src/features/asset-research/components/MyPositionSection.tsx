import { useTranslation } from 'react-i18next'
import type { AssetInvestmentNoteDTO, AssetResearchSummaryDTO, PositionDTO } from '@/api'
import {
  formatCurrency,
  formatNumber,
  formatQuantity,
  formatWithSeparators,
} from '@/shared/lib/formatUtils'
import { formatResearchPercent } from '@/features/assets/lib/assetResearchMetricBuilders'
import { calculateTransactionAmount } from '@/features/asset-research/lib/assetResearchViewCalculations'
import {
  gainNeededToBreakeven,
  getTransactionVisual,
  hasNoteContent,
  signedCurrency,
  signedPercent,
  valueTone,
} from '@/features/asset-research/lib/assetResearchViewFormatting'
import type { AssetResearchViewTransaction } from '@/features/asset-research/types'
import { EvidenceSkeleton } from '@/features/asset-research/components/EvidencePrimitives'

export function MyPositionSection({
  asset,
  position,
  portfolioName,
  portfolioCurrency,
  portfolioWeight,
  totalReturn,
  dailyContribution,
  transactions,
  dividends,
  dividendCount,
  note,
  loading,
  locale,
  onEditNote,
  onRecordTransaction,
}: {
  asset: AssetResearchSummaryDTO['asset']
  position: PositionDTO | null | undefined
  portfolioName?: string
  portfolioCurrency: string
  portfolioWeight: number | null
  totalReturn: number | null
  dailyContribution: number | null
  transactions: AssetResearchViewTransaction[]
  dividends: number
  dividendCount: number
  note: AssetInvestmentNoteDTO | null
  loading: boolean
  locale: string
  onEditNote: () => void
  onRecordTransaction: () => void
}) {
  const { t } = useTranslation()
  if (loading) return <EvidenceSkeleton rows={10} />

  const hasRelationship = Boolean(position || transactions.length > 0)
  if (!hasRelationship) {
    return (
      <section className="asset-research__position-empty">
        <p className="pf-section-kicker asset-research__section-label">{t('assetResearchView.myPosition')}</p>
        <h2>{t('assetResearchView.doNotOwnTitle')}</h2>
        <p>
          {t('assetResearchView.addToWatchlistOrRecord')}
        </p>
        <button type="button" onClick={onRecordTransaction}>
          {t('assetResearchView.recordATransaction')}
        </button>
      </section>
    )
  }

  const breakevenGain = position ? gainNeededToBreakeven(position) : null
  const dividendCurrenciesMatchPortfolio =
    dividendCount > 0 &&
    transactions
      .filter((transaction) => transaction.type === 'DIVIDEND')
      .every(
        (transaction) =>
          transaction.currency.toUpperCase() === portfolioCurrency.toUpperCase(),
      )
  const hasRealizedHistory = Boolean(
    position &&
      (position.realized_quantity > 0 ||
        position.realized_sell_count > 0 ||
        position.realized_sale_proceeds > 0 ||
        position.realized_cost_basis > 0),
  )

  return (
    <div className="asset-research__position">
      <section className="asset-research__position-hero">
        <p className="pf-section-kicker asset-research__section-label">{t('assetResearchView.personalCapital')}</p>
        <h2>{t('assetResearchView.howHasAffectedMe', { symbol: asset.symbol })}</h2>
        {position?.quantity && position.quantity > 0 ? (
          <>
            <p className="asset-research__position-value">
              {formatCurrency(position.market_value, portfolioCurrency, locale)}
            </p>
            <p>
              {t('assetResearchView.sharesOf', { quantity: formatQuantity(position.quantity) })}
              {portfolioWeight !== null
                ? t('assetResearchView.percentOfPortfolioValue', { percent: portfolioWeight.toFixed(1), portfolio: portfolioName || t('assetResearchView.portfolioValueFallback') })
                : ''}
            </p>
            {position.unrealized_pnl !== null && (
              <p className={`asset-research__financial-sentence ${valueTone(position.unrealized_pnl)}`}>
                {signedCurrency(position.unrealized_pnl, portfolioCurrency, locale)}
                {' · '}
                {t('assetResearchView.unrealizedOnHoldings', { percent: signedPercent(position.unrealized_pnl_pct) })}
              </p>
            )}
          </>
        ) : (
          <p className="asset-research__financial-sentence">
            {t('assetResearchView.positionClosedFinancial')}
          </p>
        )}
      </section>

      {position && (
        <section className="asset-research__position-equation">
          <div>
            <p className="pf-section-kicker asset-research__section-label">{t('assetResearchView.returnEquation')}</p>
            <h2>
              {totalReturn === null
                ? t('assetResearchView.lifetimePnlUnavailable')
                : t('assetResearchView.lifetimePnlSuffix', { amount: signedCurrency(totalReturn, portfolioCurrency, locale) })}
            </h2>
          </div>
          <div className="asset-research__equation">
            {position.quantity > 0 && (
              <span>
                <b>=</b>
                <strong className={valueTone(position.unrealized_pnl)}>
                  {position.unrealized_pnl === null
                    ? '-'
                    : signedCurrency(position.unrealized_pnl, portfolioCurrency, locale)}
                </strong>
                <small>{t('assetResearchView.unrealizedSuffix', { percent: signedPercent(position.unrealized_pnl_pct) })}</small>
              </span>
            )}
            <span>
              <b>{position.quantity > 0 ? '+' : '='}</b>
              <strong className={valueTone(position.realized_pnl)}>
                {signedCurrency(position.realized_pnl, portfolioCurrency, locale)}
              </strong>
              <small>
                {position.realized_pnl_percent !== null
                  ? t('assetResearchView.realizedSuffix', { percent: signedPercent(position.realized_pnl_percent) })
                  : t('assetResearchView.realized')}
              </small>
            </span>
            {dividendCount > 0 && dividendCurrenciesMatchPortfolio && (
              <span>
                <b>+</b>
                <strong>{formatCurrency(dividends, portfolioCurrency, locale)}</strong>
                <small>{t('assetResearchView.dividendTransactions', { count: dividendCount })}</small>
              </span>
            )}
          </div>
          {position.realized_fees > 0 && (
            <p className="asset-research__confidence-note">
              {t('assetResearchView.realizedNetOfFees', { amount: formatCurrency(position.realized_fees, portfolioCurrency, locale) })}
            </p>
          )}
          {dividendCount > 0 && (
            <p className="asset-research__confidence-note">
              {dividendCurrenciesMatchPortfolio
                ? t('assetResearchView.dividendRecordedTotaling', { dividendLine: t('assetResearchView.dividendTransactions', { count: dividendCount }), amount: formatCurrency(dividends, portfolioCurrency, locale) })
                : t('assetResearchView.dividendRecordedDiffer', { dividendLine: t('assetResearchView.dividendTransactions', { count: dividendCount }) })}
            </p>
          )}
        </section>
      )}

      {position && (
        <section className="asset-research__position-anatomy">
          <div>
            <p className="pf-section-kicker asset-research__section-label">{t('assetResearchView.costAndBreakeven')}</p>
            <h2>{t('assetResearchView.whatPriceRelationship')}</h2>
          </div>
          <dl className="asset-research__position-ledger">
            <div>
              <dt>{t('assetResearchView.quantityOwned')}</dt>
              <dd>{formatQuantity(position.quantity)}</dd>
            </div>
            <div>
              <dt>{t('assetResearchView.averageCost')}</dt>
              <dd>{formatCurrency(position.avg_cost, portfolioCurrency, locale)}</dd>
            </div>
            <div>
              <dt>{t('assetResearchView.currentPrice')}</dt>
              <dd>{formatCurrency(position.current_price, portfolioCurrency, locale)}</dd>
            </div>
            <div>
              <dt>{t('assetResearchView.costBasis')}</dt>
              <dd>{formatCurrency(position.cost_basis, portfolioCurrency, locale)}</dd>
            </div>
            <div>
              <dt>{t('assetResearchView.marketValue')}</dt>
              <dd>{formatCurrency(position.market_value, portfolioCurrency, locale)}</dd>
            </div>
            {position.unrealized_pnl !== null && (
              <div>
                <dt>
                  {t('assetResearchView.unrealizedPnl')}
                  <small>{t('assetResearchView.openPositionOnly')}</small>
                </dt>
                <dd className={valueTone(position.unrealized_pnl)}>
                  {signedCurrency(position.unrealized_pnl, portfolioCurrency, locale)}
                  <small>{signedPercent(position.unrealized_pnl_pct)}</small>
                </dd>
              </div>
            )}
            {breakevenGain !== null && (
              <div>
                <dt>
                  {t('assetResearchView.gainNeededBreakeven')}
                  <small>{t('assetResearchView.shownOnlyNegative')}</small>
                </dt>
                <dd className="asset-research__value--warning">
                  +{formatNumber(breakevenGain, 2)}%
                  {position.breakeven_target_price !== null &&
                    position.breakeven_target_price !== undefined && (
                      <small>
                        {t('assetResearchView.atPrice', { price: formatCurrency(position.breakeven_target_price, portfolioCurrency, locale) })}
                      </small>
                    )}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {position && hasRealizedHistory && (
        <section className="asset-research__position-anatomy">
          <div>
            <p className="pf-section-kicker asset-research__section-label">{t('assetResearchView.realizedHistory')}</p>
            <h2>{t('assetResearchView.whatCrystallized')}</h2>
          </div>
          <dl className="asset-research__position-ledger">
            <div>
              <dt>{t('assetResearchView.quantitySold')}</dt>
              <dd>{formatQuantity(position.realized_quantity)}</dd>
            </div>
            {position.average_sell_price !== null && (
              <div>
                <dt>{t('assetResearchView.averageSellPrice')}</dt>
                <dd>{formatCurrency(position.average_sell_price, portfolioCurrency, locale)}</dd>
              </div>
            )}
            {position.realized_sale_proceeds > 0 && (
              <div>
                <dt>{t('assetResearchView.saleProceeds')}</dt>
                <dd>{formatCurrency(position.realized_sale_proceeds, portfolioCurrency, locale)}</dd>
              </div>
            )}
            {position.realized_cost_basis > 0 && (
              <div>
                <dt>{t('assetResearchView.costBasisSold')}</dt>
                <dd>{formatCurrency(position.realized_cost_basis, portfolioCurrency, locale)}</dd>
              </div>
            )}
            <div>
              <dt>{t('assetResearchView.realizedPnl')}</dt>
              <dd className={valueTone(position.realized_pnl)}>
                {signedCurrency(position.realized_pnl, portfolioCurrency, locale)}
                {position.realized_pnl_percent !== null && (
                  <small>{signedPercent(position.realized_pnl_percent)}</small>
                )}
              </dd>
            </div>
            {position.realized_fees > 0 && (
              <div>
                <dt>{t('assetResearchView.realizedFees')}</dt>
                <dd>{formatCurrency(position.realized_fees, portfolioCurrency, locale)}</dd>
              </div>
            )}
            {position.realized_sell_count > 0 && (
              <div>
                <dt>{t('assetResearchView.sellTransactions')}</dt>
                <dd>{formatWithSeparators(position.realized_sell_count)}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      <section className="asset-research__position-consequence">
        <div>
          <p className="pf-section-kicker asset-research__section-label">{t('assetResearchView.portfolioConsequence')}</p>
          <h2>{t('assetResearchView.whatContribute')}</h2>
        </div>
        <dl>
          {position?.market_value !== null && position?.market_value !== undefined && (
            <div>
              <dt>{t('assetResearchView.unknownSectorExposure', { sector: asset.sector || t('assetResearchView.unknownSector') })}</dt>
              <dd>{formatCurrency(position.market_value, portfolioCurrency, locale)}</dd>
            </div>
          )}
          {portfolioWeight !== null && (
            <div>
              <dt>{t('assetResearchView.concentrationContribution')}</dt>
              <dd>{t('assetResearchView.percentOfPortfolioValueDd', { percent: portfolioWeight.toFixed(1) })}</dd>
            </div>
          )}
          {dailyContribution !== null && (
            <div>
              <dt>{t('assetResearchView.estimatedEffectToday')}</dt>
              <dd className={valueTone(dailyContribution)}>
                {signedCurrency(dailyContribution, portfolioCurrency, locale)}
              </dd>
            </div>
          )}
          {position?.vol_contribution_pct !== null &&
            position?.vol_contribution_pct !== undefined && (
              <div>
                <dt>{t('assetResearchView.volatilityContribution')}</dt>
                <dd>{formatResearchPercent(position.vol_contribution_pct)}</dd>
              </div>
            )}
        </dl>
      </section>

      <PositionNote note={note} currency={portfolioCurrency} onEdit={onEditNote} />
      <PositionTransactions
        transactions={transactions}
        locale={locale}
        fallbackCurrency={portfolioCurrency}
        onRecordTransaction={onRecordTransaction}
      />
    </div>
  )
}

function PositionNote({
  note,
  currency,
  onEdit,
}: {
  note: AssetInvestmentNoteDTO | null
  currency: string
  onEdit: () => void
}) {
  const { t } = useTranslation()
  const hasContent = hasNoteContent(note)
  return (
    <section className="asset-research__note">
      <div className="pf-section-header asset-research__section-heading">
        <div>
          <p className="pf-section-kicker asset-research__section-label">{t('assetResearchView.investmentRecord')}</p>
          <h2>{t('assetResearchView.myThesis')}</h2>
          <p>
            {t('assetResearchView.personalReasoningNote')}
          </p>
        </div>
        <button type="button" onClick={onEdit}>
          {hasContent ? t('assetResearchView.editThesis') : t('assetResearchView.addThesis')}
        </button>
      </div>
      {hasContent ? (
        <dl>
          {note?.thesis && (
            <div>
              <dt>{t('assetResearchView.whyIOwnIt')}</dt>
              <dd>{note.thesis}</dd>
            </div>
          )}
          {note?.risks && (
            <div>
              <dt>{t('assetResearchView.risksIAccept')}</dt>
              <dd>{note.risks}</dd>
            </div>
          )}
          {note?.invalidation_thesis && (
            <div>
              <dt>{t('assetResearchView.whatInvalidates')}</dt>
              <dd>{note.invalidation_thesis}</dd>
            </div>
          )}
          {(note?.target_price || note?.target_text) && (
            <div>
              <dt>{t('assetResearchView.target')}</dt>
              <dd>
                {[
                  note.target_price
                    ? formatCurrency(note.target_price, currency)
                    : null,
                  note.target_text,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <div className="asset-research__quiet-state">
          {t('assetResearchView.noThesisRecorded')}
        </div>
      )}
    </section>
  )
}

function PositionTransactions({
  transactions,
  locale,
  fallbackCurrency,
  onRecordTransaction,
}: {
  transactions: AssetResearchViewTransaction[]
  locale: string
  fallbackCurrency: string
  onRecordTransaction: () => void
}) {
  const { t } = useTranslation()
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.tx_date).getTime() - new Date(a.tx_date).getTime(),
  )
  return (
    <section className="asset-research__transactions">
      <div className="pf-section-header asset-research__section-heading">
        <div>
          <p className="pf-section-kicker asset-research__section-label">{t('assetResearchView.ownershipHistory')}</p>
          <h2>{t('assetResearchView.transactions')}</h2>
        </div>
        <button type="button" onClick={onRecordTransaction}>
          {t('assetResearchView.recordTransaction')}
        </button>
      </div>
      {sorted.length > 0 ? (
        <div className="asset-research__ledger-scroll">
          <table>
            <thead>
              <tr>
                <th>{t('assetResearchView.columnDate')}</th>
                <th>{t('assetResearchView.columnEvent')}</th>
                <th>{t('assetResearchView.columnQuantity')}</th>
                <th>{t('assetResearchView.columnPrice')}</th>
                <th>{t('assetResearchView.columnAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((transaction) => {
                const visual = getTransactionVisual(transaction.type, t)
                const currency = transaction.currency || fallbackCurrency
                return (
                  <tr key={transaction.id}>
                    <td>
                      {new Intl.DateTimeFormat(locale, {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      }).format(new Date(transaction.tx_date))}
                    </td>
                    <td>
                      <span className={`asset-research__transaction-type is-${visual.tone}`}>
                        <visual.Icon size={15} strokeWidth={2} aria-hidden="true" />
                        {visual.label}
                      </span>
                    </td>
                    <td>{formatQuantity(transaction.quantity)}</td>
                    <td>{formatCurrency(transaction.price, currency, locale)}</td>
                    <td>
                      <strong>
                        {formatCurrency(
                          calculateTransactionAmount(transaction),
                          currency,
                          locale,
                        )}
                      </strong>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="asset-research__quiet-state">
          {t('assetResearchView.noTransactionsRecorded')}
        </div>
      )}
    </section>
  )
}
