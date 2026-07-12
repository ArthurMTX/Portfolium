import type { ReactNode } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import AuthLanguageSwitcher from '@/features/auth/components/AuthLanguageSwitcher'
import AuthBrandCollage from '@/features/auth/components/AuthBrandCollage'
import '@/shared/design/pages/auth.css'

interface AuthPageShellProps {
  darkMode: boolean
  toggleDarkMode: () => void
  children: ReactNode
}

export default function AuthPageShell({
  darkMode,
  toggleDarkMode,
  children,
}: AuthPageShellProps) {
  const { t } = useTranslation()

  return (
    <div className="auth-shell">
      <aside className="auth-brand" aria-hidden="true">
        <div className="auth-brand__glow auth-brand__glow--1" />
        <div className="auth-brand__glow auth-brand__glow--2" />
        <div className="auth-brand__mesh" />

        <AuthBrandCollage />
      </aside>

      <div className="auth-shell__panel">
        <div className="auth-shell__toolbar">
          <AuthLanguageSwitcher darkMode={darkMode} />
          <button
            type="button"
            onClick={toggleDarkMode}
            className="pf-icon-action auth-shell__theme"
            aria-label={t('navigation.toggleDarkMode')}
          >
            {darkMode ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </button>
        </div>

        <div className="auth-shell__inner">
          {children}
        </div>
      </div>
    </div>
  )
}
