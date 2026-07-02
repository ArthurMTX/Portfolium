import { PlusCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { StateBlock } from '@/shared/components/StatePrimitives'
import { PageShell } from '@/shared/components/PageLayout'

interface EmptyPortfolioPromptProps {
  pageType?: 'dashboard' | 'insights' | 'transactions' | 'assets' | 'watchlist' | 'charts' | 'calendar'
}

export default function EmptyPortfolioPrompt({ pageType = 'dashboard' }: EmptyPortfolioPromptProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <PageShell>
      <StateBlock
        eyebrow={t('emptyPortfolio.gettingStartedLabel')}
        title={t(`emptyPortfolio.${pageType}.title`)}
        description={t(`emptyPortfolio.${pageType}.message`)}
        detail={t('emptyPortfolio.gettingStartedMessage')}
      >
        <button
          type="button"
          onClick={() => navigate('/portfolios')}
          className="pf-button pf-button--primary"
        >
          <PlusCircle size={16} />
          {t('emptyPortfolio.createButton')}
        </button>
      </StateBlock>
    </PageShell>
  )
}
