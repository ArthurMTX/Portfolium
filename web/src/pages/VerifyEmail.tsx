import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { AlertCircle, CheckCircle } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (token) {
      verifyEmail()
    } else {
      setError('Invalid or missing verification token')
      setLoading(false)
    }
  }, [token])

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
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-white to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="inline-block p-4 bg-blue-100 rounded-full mb-4">
              <LoadingSpinner size="lg" variant="icon" color="blue" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Verifying your email...
            </h2>
            <p className="text-gray-600">
              Please wait while we verify your email address.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-100 via-white to-blue-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="inline-block p-4 bg-green-100 rounded-full mb-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Email verified successfully!
            </h2>
            <p className="text-gray-600 mb-6">
              Your email has been verified. You can now sign in to your account and start tracking your investments.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Redirecting to login page in 5 seconds...
            </p>
            <Link
              to="/login"
              className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Sign in now →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-100 via-white to-pink-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="inline-block p-4 bg-red-100 rounded-full mb-4">
            <AlertCircle className="w-12 h-12 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Verification failed
          </h2>
          <p className="text-gray-600 mb-6">
            {error || 'Invalid or expired verification link.'}
          </p>
          <div className="space-y-3">
            <Link
              to="/login"
              className="block bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Go to login
            </Link>
            <Link
              to="/register"
              className="block text-indigo-600 hover:text-indigo-500 font-medium"
            >
              Create new account
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
