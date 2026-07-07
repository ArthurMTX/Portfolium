import { useTranslation } from 'react-i18next'
import AssetLogo from '@/shared/components/AssetLogo'
import FlowerMark from '@/features/auth/components/FlowerMark'

function Sparkline({
  points,
  id,
  className = '',
}: {
  points: string
  id: string
  className?: string
}) {
  return (
    <svg className={`auth-mock-chart ${className}`} viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--pf-accent)" stopOpacity="0.26" />
          <stop offset="100%" stopColor="var(--pf-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,42 ${points} 100,42`} fill={`url(#${id})`} />
      <polyline points={points} fill="none" stroke="var(--pf-accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CardMenu() {
  return <span className="auth-mock-menu" aria-hidden="true">•••</span>
}

const PORTFOLIO_POINTS = '0,34 4,27 8,25 12,15 17,13 22,16 27,10 32,11 37,14 42,13 47,19 52,20 57,13 62,11 67,17 72,16 77,12 82,11 87,4 92,7 96,4 100,0'
const PERFORMANCE_POINTS = '0,34 5,28 10,29 15,22 20,24 25,18 30,14 35,16 40,17 45,23 50,18 55,25 60,17 65,15 70,10 75,12 80,7 85,5 90,0 95,-2 100,-8'
const SP500_POINTS = '0,30 8,24 16,26 24,18 32,20 40,12 48,16 56,10 64,14 72,8 80,5 88,2 100,-6'
const NASDAQ_POINTS = '0,32 9,23 18,27 27,18 36,21 45,12 54,17 63,10 72,14 81,6 90,4 100,-8'
const VIX_POINTS = '0,28 8,19 16,27 24,20 32,24 40,15 48,18 56,12 64,14 72,7 80,12 88,17 100,31'
const NVIDIA_NEWS_IMAGE = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/NVIDIA%20Headquarters.jpg?width=320'
const FED_NEWS_IMAGE = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Marriner%20S.%20Eccles%20Federal%20Reserve%20Board%20Building.jpg?width=320'

export default function AuthBrandCollage() {
  const { t } = useTranslation()
  return (
    <div className="auth-mock" aria-hidden="true">
      <div className="auth-mock-card auth-mock-card--portfolio">
        <CardMenu />
        <div className="auth-mock-card__head">
          <FlowerMark className="auth-flower--brand" />
          <span className="auth-mock-brand">Portfolium</span>
        </div>
        <p className="auth-mock-label">{t('authBrandCollage.portfolioValue')}</p>
        <p className="auth-mock-value">$28,934.12</p>
        <p className="auth-mock-delta auth-mock-delta--up">+12.45%</p>
        <Sparkline id="auth-mock-spark-portfolio" points={PORTFOLIO_POINTS} className="auth-mock-chart--portfolio" />
        <div className="auth-mock-axis">
          <span>Jun 1</span>
          <span>Jun 8</span>
          <span>Jun 15</span>
          <span>Jun 22</span>
          <span>Jun 29</span>
        </div>
      </div>

      <div className="auth-mock-card auth-mock-card--movers">
        <CardMenu />
        <p className="auth-mock-title">{t('authBrandCollage.topMovers')} <strong>({t('authBrandCollage.today')})</strong></p>
        <ul className="auth-mock-list">
          <li>
            <AssetLogo symbol="NVDA" assetType="EQUITY" className="auth-mock-ticker" />
            <span className="auth-mock-ticker-name">NVDA</span>
            <span className="auth-mock-delta auth-mock-delta--up">+4.32%</span>
          </li>
          <li>
            <AssetLogo symbol="TSLA" assetType="EQUITY" className="auth-mock-ticker" />
            <span className="auth-mock-ticker-name">TSLA</span>
            <span className="auth-mock-delta auth-mock-delta--up">+3.21%</span>
          </li>
          <li>
            <AssetLogo symbol="MSTR" assetType="EQUITY" className="auth-mock-ticker" />
            <span className="auth-mock-ticker-name">MSTR</span>
            <span className="auth-mock-delta auth-mock-delta--down">-2.18%</span>
          </li>
        </ul>
      </div>

      <div className="auth-mock-card auth-mock-card--allocation">
        <CardMenu />
        <p className="auth-mock-title">{t('authBrandCollage.assetAllocation')}</p>
        <div className="auth-mock-allocation">
          <div className="auth-mock-donut" />
          <ul className="auth-mock-legend">
            <li><span className="auth-mock-dot auth-mock-dot--stocks" />{t('authBrandCollage.stocks')} <strong>60%</strong></li>
            <li><span className="auth-mock-dot auth-mock-dot--etfs" />{t('authBrandCollage.etfs')} <strong>25%</strong></li>
            <li><span className="auth-mock-dot auth-mock-dot--crypto" />{t('authBrandCollage.crypto')} <strong>10%</strong></li>
            <li><span className="auth-mock-dot auth-mock-dot--cash" />{t('authBrandCollage.cash')} <strong>5%</strong></li>
          </ul>
        </div>
      </div>

      <div className="auth-mock-card auth-mock-card--watchlist">
        <CardMenu />
        <p className="auth-mock-title">{t('authBrandCollage.watchlist')}</p>
        <ul className="auth-mock-list auth-mock-list--two-line">
          <li>
            <AssetLogo symbol="AAPL" assetType="EQUITY" className="auth-mock-ticker" />
            <span><b>AAPL</b><small>Apple Inc.</small></span>
            <strong>$195.72 <em className="auth-mock-delta--up">+1.02%</em></strong>
          </li>
          <li>
            <AssetLogo symbol="MSFT" assetType="EQUITY" className="auth-mock-ticker" />
            <span><b>MSFT</b><small>Microsoft Corp.</small></span>
            <strong>$430.28 <em className="auth-mock-delta--up">+0.65%</em></strong>
          </li>
          <li>
            <AssetLogo symbol="BTC-USD" assetType="CRYPTOCURRENCY" assetName="Bitcoin" className="auth-mock-ticker" />
            <span><b>BTC-USD</b><small>Bitcoin</small></span>
            <strong>$67,892.11 <em className="auth-mock-delta--down">-1.25%</em></strong>
          </li>
        </ul>
      </div>

      <div className="auth-mock-card auth-mock-card--flower">
        <FlowerMark className="auth-flower--large" />
      </div>

      <div className="auth-mock-card auth-mock-card--overview">
        <CardMenu />
        <p className="auth-mock-title">{t('authBrandCollage.marketOverview')}</p>
        <ul className="auth-mock-mini-markets">
          <li>
            <span><b>S&amp;P 500</b><small>5,509.01</small><em className="auth-mock-delta--up">+0.78%</em></span>
            <Sparkline id="auth-mock-spark-sp500" points={SP500_POINTS} />
          </li>
          <li>
            <span><b>NASDAQ 100</b><small>19,123.45</small><em className="auth-mock-delta--up">+1.12%</em></span>
            <Sparkline id="auth-mock-spark-nasdaq" points={NASDAQ_POINTS} />
          </li>
          <li>
            <span><b>VIX</b><small>12.32</small><em className="auth-mock-delta--down">-2.13%</em></span>
            <Sparkline id="auth-mock-spark-vix" points={VIX_POINTS} />
          </li>
        </ul>
      </div>

      <div className="auth-mock-card auth-mock-card--holdings">
        <CardMenu />
        <p className="auth-mock-title">{t('authBrandCollage.holdings')}</p>
        <ul className="auth-mock-list auth-mock-list--two-line">
          <li>
            <AssetLogo symbol="NVDA" assetType="EQUITY" className="auth-mock-ticker" />
            <span><b>NVDA</b><small>NVIDIA Corporation</small></span>
            <strong>$3,862.40 <em className="auth-mock-delta--up">+4.32%</em></strong>
          </li>
          <li>
            <AssetLogo symbol="VOO" assetType="ETF" className="auth-mock-ticker" />
            <span><b>VOO</b><small>Vanguard S&amp;P 500 ETF</small></span>
            <strong>$2,931.63 <em className="auth-mock-delta--up">+0.78%</em></strong>
          </li>
          <li>
            <AssetLogo symbol="TSLA" assetType="EQUITY" className="auth-mock-ticker" />
            <span><b>TSLA</b><small>Tesla, Inc.</small></span>
            <strong>$2,512.40 <em className="auth-mock-delta--up">+3.21%</em></strong>
          </li>
        </ul>
      </div>

      <div className="auth-mock-card auth-mock-card--activity">
        <CardMenu />
        <p className="auth-mock-title">{t('authBrandCollage.recentActivity')}</p>
        <ul className="auth-mock-activity">
          <li>
            <AssetLogo symbol="ASML" assetType="EQUITY" className="auth-mock-ticker" />
            <span><b>{t('authBrandCollage.bought')}</b><strong>ASML</strong><small>{t('authBrandCollage.sharesCount', { count: 10 })}</small></span>
            <time>{t('authBrandCollage.today')}</time>
          </li>
          <li>
            <AssetLogo symbol="VUSA" assetType="ETF" className="auth-mock-ticker" />
            <span><b>{t('authBrandCollage.dividend')}</b><strong>VUSA</strong><small>$12.45</small></span>
            <time>{t('authBrandCollage.daysAgo', { count: 2 })}</time>
          </li>
          <li>
            <AssetLogo symbol="AMD" assetType="EQUITY" className="auth-mock-ticker" />
            <span><b>{t('authBrandCollage.sold')}</b><strong>AMD</strong><small>{t('authBrandCollage.sharesCount', { count: 5 })}</small></span>
            <time>{t('authBrandCollage.daysAgo', { count: 5 })}</time>
          </li>
        </ul>
      </div>

      <div className="auth-mock-card auth-mock-card--performance">
        <CardMenu />
        <p className="auth-mock-title">{t('authBrandCollage.performance')}</p>
        <p className="auth-mock-value auth-mock-value--sm">+12.45%</p>
        <p className="auth-mock-profit">+$3,204.12 (1M)</p>
        <Sparkline id="auth-mock-spark-performance" points={PERFORMANCE_POINTS} className="auth-mock-chart--performance" />
      </div>

      <div className="auth-mock-card auth-mock-card--news">
        <CardMenu />
        <p className="auth-mock-title">{t('authBrandCollage.news')}</p>
        <div className="auth-mock-news-item">
          <span><b>{t('authBrandCollage.nvidiaHeadline')}</b><small>{t('authBrandCollage.hoursAgo', { count: 2 })}</small></span>
          <div className="auth-mock-news-thumb auth-mock-news-thumb--nvidia">
            <img src={NVIDIA_NEWS_IMAGE} alt="" loading="lazy" draggable={false} />
          </div>
        </div>
        <div className="auth-mock-news-item">
          <span><b>{t('authBrandCollage.fedHeadline')}</b><small>{t('authBrandCollage.hoursAgo', { count: 5 })}</small></span>
          <div className="auth-mock-news-thumb auth-mock-news-thumb--fed">
            <img src={FED_NEWS_IMAGE} alt="" loading="lazy" draggable={false} />
          </div>
        </div>
      </div>
    </div>
  )
}
