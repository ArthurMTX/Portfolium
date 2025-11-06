import { useState, useEffect, FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { Lock, AlertCircle, CheckCircle, Moon, Sun } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import { translateApiError } from '../lib/errorUtils'
import { useTranslation } from 'react-i18next'
import AuthLanguageSwitcher from '../components/AuthLanguageSwitcher'

export default function ResetPassword() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

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

  useEffect(() => {
    if (!token) {
      setError(translateApiError('Invalid or missing reset token', t))
    }
  }, [token, t])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!token) {
      setError(translateApiError('Invalid or missing reset token', t))
      return
    }

    if (password !== confirmPassword) {
      setError(translateApiError('Passwords do not match', t))
      return
    }

    if (password.length < 8) {
      setError(translateApiError('Password must be at least 8 characters', t))
      return
    }

    setLoading(true)

    try {
      await api.resetPassword(token, password)
      setSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reset password'
      setError(translateApiError(message, t))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-colors ${
        darkMode 
          ? 'bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900'
          : 'bg-gradient-to-br from-green-100 via-white to-blue-100'
      }`}>
        <div className="max-w-md w-full">
          <div className={`rounded-2xl shadow-xl p-8 text-center ${
            darkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white'
          }`}>
            <div className={`inline-block p-4 rounded-full mb-4 ${
              darkMode ? 'bg-green-900/30' : 'bg-green-100'
            }`}>
              <CheckCircle className={`w-12 h-12 ${
                darkMode ? 'text-green-400' : 'text-green-600'
              }`} />
            </div>
            <h2 className={`text-2xl font-bold mb-4 ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {t('resetPassword.successTitle')}
            </h2>
            <p className={`mb-6 ${
              darkMode ? 'text-neutral-300' : 'text-gray-600'
            }`}>
              {t('resetPassword.successMessage')}
            </p>
            <p className={`text-sm mb-6 ${
              darkMode ? 'text-neutral-500' : 'text-gray-500'
            }`}>
              {t('resetPassword.redirecting')}
            </p>
            <Link
              to="/login"
              className={`font-medium transition-colors ${
                darkMode
                  ? 'text-pink-400 hover:text-pink-300'
                  : 'text-indigo-600 hover:text-indigo-500'
              }`}
            >
              {t('resetPassword.goToLogin')}
            </Link>
          </div>
        </div>
      </div>
    )
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
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className={`text-3xl font-bold ${
            darkMode ? 'text-white' : 'text-gray-900'
          }`}>{t('resetPassword.title')}</h1>
          <p className={`mt-2 ${
            darkMode ? 'text-neutral-400' : 'text-gray-600'
          }`}>{t('resetPassword.subtitle')}</p>
        </div>

        {/* Form */}
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
              <label htmlFor="password" className={`block text-sm font-medium mb-2 ${
                darkMode ? 'text-neutral-200' : 'text-gray-700'
              }`}>
                {t('resetPassword.newPasswordLabel')}
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
              <p className={`mt-1 text-xs ${
                darkMode ? 'text-neutral-500' : 'text-gray-500'
              }`}>{t('resetPassword.passwordHint')}</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className={`block text-sm font-medium mb-2 ${
                darkMode ? 'text-neutral-200' : 'text-gray-700'
              }`}>
                {t('resetPassword.confirmPasswordLabel')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className={`h-5 w-5 ${
                    darkMode ? 'text-neutral-500' : 'text-gray-400'
                  }`} />
                </div>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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

            <button
              type="submit"
              disabled={loading || !token}
              className={`w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                darkMode
                  ? 'bg-pink-600 hover:bg-pink-700 focus:ring-pink-500'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
              }`}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" color="white" />
                  {t('resetPassword.resetting')}
                </>
              ) : (
                t('resetPassword.resetPassword')
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className={`text-sm transition-colors ${
                darkMode
                  ? 'text-neutral-400 hover:text-neutral-100'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('resetPassword.backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
