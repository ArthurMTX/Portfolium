import { PlusCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { StateBlock } from '@/shared/components/StatePrimitives'
import { PageShell } from '@/shared/components/PageLayout'

interface EmptyTransactionsPromptProps {
  pageType?: 'insights' | 'assets' | 'charts' | 'metrics'
  portfolioName?: string
}

export default function EmptyTransactionsPrompt({ pageType = 'assets', portfolioName }: EmptyTransactionsPromptProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const portfolio = portfolioName ? `"${portfolioName}"` : t('common.portfolio')

  return (
    <PageShell>
      <StateBlock
        eyebrow={t('emptyTransactions.quickStartTitle')}
        title={t(`emptyTransactions.${pageType}.title`)}
        description={
          <>
            <p>{t(`emptyTransactions.${pageType}.message`, { portfolio })}</p>
            <p>{t(`emptyTransactions.${pageType}.secondaryMessage`)}</p>
          </>
        }
        detail={
          <>
            <p>
              1. {t('emptyTransactions.step1')} · 2. {t('emptyTransactions.step2')} · 3.{' '}
              {t('emptyTransactions.step3')} · 4. {t('emptyTransactions.step4')}
            </p>
            <p>
              <strong>{t('emptyTransactions.proTipTitle')}</strong> {t('emptyTransactions.proTipMessage')}
            </p>
          </>
        }
      >
        <button
          type="button"
          onClick={() => navigate('/transactions')}
          className="pf-button pf-button--primary"
        >
          <PlusCircle size={16} />
          {t('emptyTransactions.addButton')}
        </button>
      </StateBlock>
    </PageShell>
  )
}
