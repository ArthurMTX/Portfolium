import type { ReactNode } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import AuthLanguageSwitcher from './AuthLanguageSwitcher'

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
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors ${
      darkMode
        ? 'bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900'
        : 'bg-gradient-to-br from-indigo-100 via-white to-pink-100'
    }`}>
      <div className="max-w-md w-full">
        <div className="flex justify-end gap-2 mb-4">
          <AuthLanguageSwitcher darkMode={darkMode} />
          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-lg transition-colors ${
              darkMode
                ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-100'
                : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
            }`}
            aria-label={t('navigation.toggleDarkMode')}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}
