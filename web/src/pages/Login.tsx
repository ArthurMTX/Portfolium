import { useState, FormEvent, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogIn, Mail, Lock, AlertCircle, Moon, Sun } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import { useTranslation } from 'react-i18next'
import AuthLanguageSwitcher from '../components/AuthLanguageSwitcher'
import { translateApiError } from '../lib/errorUtils'

export default function Login() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'

  useEffect(() => {
    // Check system preference or localStorage
    const savedTheme = localStorage.getItem('auth-theme')
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDarkMode(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    if (!darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('auth-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('auth-theme', 'light')
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid email or password'
      setError(translateApiError(message, t))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors ${
      darkMode 
        ? 'bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900' 
        : 'bg-gradient-to-br from-indigo-100 via-white to-pink-100'
    }`}>
      <div className="max-w-md w-full">
        {/* Theme and Language controls */}
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

        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className={`inline-block p-3 rounded-2xl mb-4 ${
            darkMode ? 'bg-pink-600' : 'bg-indigo-600'
          }`}>
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <h1 className={`text-2xl sm:text-3xl font-bold ${
            darkMode ? 'text-white' : 'text-gray-900'
          }`}>{t('login.title')}</h1>
          <p className={`mt-2 text-sm sm:text-base ${
            darkMode ? 'text-neutral-400' : 'text-gray-600'
          }`}>{t('login.description')}</p>
        </div>

        {/* Login Form */}
        <div className={`rounded-2xl shadow-xl p-8 ${
          darkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white'
        }`}>
          {error && (
            <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
              darkMode 
                ? 'bg-red-900/20 border border-red-800' 
                : 'bg-red-50 border border-red-200'
            }`}>
              <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                darkMode ? 'text-red-400' : 'text-red-600'
              }`} />
              <p className={`text-sm ${
                darkMode ? 'text-red-300' : 'text-red-800'
              }`}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className={`block text-sm font-medium mb-2 ${
                darkMode ? 'text-neutral-200' : 'text-gray-700'
              }`}>
                {t('login.emailLabel')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className={`h-5 w-5 ${
                    darkMode ? 'text-neutral-500' : 'text-gray-400'
                  }`} />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`block w-full pl-10 pr-3 py-3 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${
                    darkMode
                      ? 'bg-neutral-900 border border-neutral-600 text-white placeholder-neutral-500'
                      : 'border border-gray-300 text-gray-900 placeholder-gray-400'
                  }`}
                  placeholder={t('login.emailPlaceholder')}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className={`block text-sm font-medium mb-2 ${
                darkMode ? 'text-neutral-200' : 'text-gray-700'
              }`}>
                {t('login.passwordLabel')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className={`h-5 w-5 ${
                    darkMode ? 'text-neutral-500' : 'text-gray-400'
                  }`} />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`block w-full pl-10 pr-3 py-3 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${
                    darkMode
                      ? 'bg-neutral-900 border border-neutral-600 text-white placeholder-neutral-500'
                      : 'border border-gray-300 text-gray-900 placeholder-gray-400'
                  }`}
                  placeholder="••••••••"
                  disabled={loading}
                  minLength={8}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <Link
                  to="/forgot-password"
                  className={`font-medium transition-colors ${
                    darkMode
                      ? 'text-pink-400 hover:text-pink-300'
                      : 'text-indigo-600 hover:text-indigo-500'
                  }`}
                >
                  {t('login.forgotPassword')}
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                darkMode
                  ? 'bg-pink-600 hover:bg-pink-700 focus:ring-pink-500'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
              }`}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" color="white" />
                  {t('login.signingIn')}
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  {t('login.signIn')}
                </>
              )}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className={`w-full border-t ${
                  darkMode ? 'border-neutral-700' : 'border-gray-300'
                }`} />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className={`px-2 ${
                  darkMode ? 'bg-neutral-800 text-neutral-400' : 'bg-white text-gray-500'
                }`}>{t('login.newToPortfolium')}</span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Link
                to="/register"
                className={`font-medium transition-colors ${
                  darkMode
                    ? 'text-pink-400 hover:text-pink-300'
                    : 'text-indigo-600 hover:text-indigo-500'
                }`}
              >
                {t('login.createAccount')}
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className={`mt-8 text-center text-sm ${
          darkMode ? 'text-neutral-400' : 'text-gray-600'
        }`}>
          {t('login.termsPrefix')}{' '}
          <a href="#" className={`transition-colors ${
            darkMode
              ? 'text-pink-400 hover:text-pink-300'
              : 'text-indigo-600 hover:text-indigo-500'
          }`}>
            {t('login.termsOfService')}
          </a>{' '}
          {t('login.and')}{' '}
          <a href="#" className={`transition-colors ${
            darkMode
              ? 'text-pink-400 hover:text-pink-300'
              : 'text-indigo-600 hover:text-indigo-500'
          }`}>
            {t('login.privacyPolicy')}
          </a>
        </p>
      </div>
    </div>
  )
}
