import type { ReactNode } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import AuthLanguageSwitcher from '@/features/auth/components/AuthLanguageSwitcher'
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
      <div className="auth-shell__inner">
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

        {children}
      </div>
    </div>
  )
}
