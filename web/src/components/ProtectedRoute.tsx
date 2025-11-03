import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from './LoadingSpinner'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireVerified?: boolean
  requireAdmin?: boolean
}

export default function ProtectedRoute({ children, requireVerified = false, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" variant="icon" color="indigo" className="mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requireAdmin && !user.is_admin) {
    return <Navigate to="/" state={{ from: location }} replace />
  }

  if (requireVerified && !user.is_verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="inline-block p-4 bg-yellow-100 rounded-full mb-4">
            <svg className="w-12 h-12 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Email verification required
          </h2>
          <p className="text-gray-600 mb-6">
            Please verify your email address to access this page. Check your inbox for the verification email.
          </p>
          <button
            onClick={() => window.location.href = '/settings'}
            className="text-indigo-600 hover:text-indigo-500 font-medium"
          >
            Go to Settings
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
