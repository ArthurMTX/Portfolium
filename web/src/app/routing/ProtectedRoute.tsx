import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/app/providers/AuthContext'
import { PageStateSkeleton, StateBlock } from '@/shared/components/StatePrimitives'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireVerified?: boolean
  requireAdmin?: boolean
}

export default function ProtectedRoute({ children, requireVerified = false, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <PageStateSkeleton label="Checking session" />
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requireAdmin && !user.is_admin) {
    return <Navigate to="/" state={{ from: location }} replace />
  }

  if (requireVerified && !user.is_verified) {
    return (
      <div className="pf-page pf-page-flow">
        <StateBlock
          tone="warning"
          eyebrow="Account access"
          title="Email verification required"
          description="Please verify your email address to access this page. Check your inbox for the verification email."
          actionLabel="Go to Settings"
          onAction={() => { window.location.href = '/settings' }}
        />
      </div>
    )
  }

  return <>{children}</>
}
