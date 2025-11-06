import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { AlertCircle, CheckCircle, Moon, Sun } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import { translateApiError } from '../lib/errorUtils'
import { useTranslation } from 'react-i18next'
import AuthLanguageSwitcher from '../components/AuthLanguageSwitcher'

export default function VerifyEmail() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
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
    const verifyEmail = async () => {
      if (!token) return

      try {
        await api.verifyEmail(token)
        setSuccess(true)
        setTimeout(() => {
          navigate('/login')
        }, 5000)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to verify email'
        setError(translateApiError(message, t))
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      verifyEmail()
    } else {
      setError(translateApiError('Invalid or missing verification token', t))
      setLoading(false)
    }
  }, [token, t, navigate])

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-colors ${
        darkMode 
          ? 'bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900'
          : 'bg-gradient-to-br from-blue-100 via-white to-indigo-100'
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

          <div className={`rounded-2xl shadow-xl p-8 text-center ${
            darkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white'
          }`}>
            <div className={`inline-block p-4 rounded-full mb-4 ${
              darkMode ? 'bg-blue-900/30' : 'bg-blue-100'
            }`}>
              <LoadingSpinner size="lg" variant="icon" color={darkMode ? "pink" : "blue"} />
            </div>
            <h2 className={`text-2xl font-bold mb-4 ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {t('verifyEmail.verifying')}
            </h2>
            <p className={darkMode ? 'text-neutral-300' : 'text-gray-600'}>
              {t('verifyEmail.verifyingMessage')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-colors ${
        darkMode 
          ? 'bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900'
          : 'bg-gradient-to-br from-green-100 via-white to-blue-100'
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
              {t('verifyEmail.successTitle')}
            </h2>
            <p className={`mb-6 ${
              darkMode ? 'text-neutral-300' : 'text-gray-600'
            }`}>
              {t('verifyEmail.successMessage')}
            </p>
            <p className={`text-sm mb-6 ${
              darkMode ? 'text-neutral-500' : 'text-gray-500'
            }`}>
              {t('verifyEmail.redirecting')}
            </p>
            <Link
              to="/login"
              className={`inline-block px-6 py-3 rounded-lg font-medium transition-colors ${
                darkMode
                  ? 'bg-pink-600 hover:bg-pink-700 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {t('verifyEmail.signInNow')}
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
        : 'bg-gradient-to-br from-red-100 via-white to-pink-100'
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

        <div className={`rounded-2xl shadow-xl p-8 text-center ${
          darkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white'
        }`}>
          <div className={`inline-block p-4 rounded-full mb-4 ${
            darkMode ? 'bg-red-900/30' : 'bg-red-100'
          }`}>
            <AlertCircle className={`w-12 h-12 ${
              darkMode ? 'text-red-400' : 'text-red-600'
            }`} />
          </div>
          <h2 className={`text-2xl font-bold mb-4 ${
            darkMode ? 'text-white' : 'text-gray-900'
          }`}>
            {t('verifyEmail.errorTitle')}
          </h2>
          <p className={`mb-6 ${
            darkMode ? 'text-neutral-300' : 'text-gray-600'
          }`}>
            {error || t('verifyEmail.errorMessageDefault')}
          </p>
          <div className="space-y-3">
            <Link
              to="/login"
              className={`block px-6 py-3 rounded-lg font-medium transition-colors ${
                darkMode
                  ? 'bg-pink-600 hover:bg-pink-700 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {t('verifyEmail.goToLogin')}
            </Link>
            <Link
              to="/register"
              className={`block font-medium transition-colors ${
                darkMode
                  ? 'text-pink-400 hover:text-pink-300'
                  : 'text-indigo-600 hover:text-indigo-500'
              }`}
            >
              {t('verifyEmail.createNewAccount')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
