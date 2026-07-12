import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Moon, Sun, ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import AuthLanguageSwitcher from '@/features/auth/components/AuthLanguageSwitcher'
import useAuthTheme from '@/features/auth/hooks/useAuthTheme'
import '@/shared/design/pages/legal.css'

interface LegalPageShellProps {
  title: ReactNode
  updated: string
  children: ReactNode
}

export default function LegalPageShell({ title, updated, children }: LegalPageShellProps) {
  const { t } = useTranslation()
  const { darkMode, toggleDarkMode } = useAuthTheme()

  return (
    <div className="legal-shell">
      <div className="legal-shell__toolbar">
        <Link to="/login" className="legal-shell__back">
          <ArrowLeft aria-hidden="true" size={16} />
          {t('login.signIn')}
        </Link>
        <div className="legal-shell__toolbar-actions">
          <AuthLanguageSwitcher darkMode={darkMode} />
          <button
            type="button"
            onClick={toggleDarkMode}
            className="pf-icon-action legal-shell__theme"
            aria-label={t('navigation.toggleDarkMode')}
          >
            {darkMode ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </button>
        </div>
      </div>

      <article className="legal-doc">
        <header className="legal-doc__header">
          <p className="pf-page-kicker">Portfolium</p>
          <h1 className="pf-section-title">{title}</h1>
          <p className="legal-doc__updated">{updated}</p>
        </header>

        <div className="legal-doc__body">{children}</div>
      </article>
    </div>
  )
}
