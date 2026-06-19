import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/app/providers/AuthContext'
import { LanguageProvider } from '@/app/providers/LanguageContext'
import ProtectedRoute from '@/app/routing/ProtectedRoute'
import Settings from '@/features/settings/pages/Settings'
import Profile from '@/features/settings/pages/Profile'
import Login from '@/features/auth/pages/Login'
import Register from '@/features/auth/pages/Register'
import ForgotPassword from '@/features/auth/pages/ForgotPassword'
import ResetPassword from '@/features/auth/pages/ResetPassword'
import VerifyEmail from '@/features/auth/pages/VerifyEmail'
import Layout from '@/app/layout/Layout'
import NotFound from '@/app/routing/NotFound'
import LoadingSpinner from '@/shared/components/LoadingSpinner'

const Dashboard = lazy(() => import('@/features/dashboard/pages/Dashboard'))
const Portfolios = lazy(() => import('@/features/portfolios/pages/Portfolios'))
const Charts = lazy(() => import('@/features/charts/pages/Charts'))
const Transactions = lazy(() => import('@/features/transactions/pages/Transactions'))
const TransactionMetrics = lazy(() => import('@/features/transactions/pages/TransactionMetrics'))
const Assets = lazy(() => import('@/features/assets/pages/Assets'))
const AssetResearch = lazy(() => import('@/features/assets/pages/AssetResearch'))
const Watchlist = lazy(() => import('@/features/watchlist/pages/Watchlist'))
const Notifications = lazy(() => import('@/features/notifications/pages/Notifications'))
const Admin = lazy(() => import('@/features/admin/pages/Admin'))
const DevTools = lazy(() => import('@/features/devtools/pages/DevTools'))
const IconPreview = lazy(() => import('@/features/devtools/pages/IconPreview'))
const FlagPreview = lazy(() => import('@/features/devtools/pages/FlagPreview'))
const Insights = lazy(() => import('@/features/insights/pages/Insights'))
const AssetDebug = lazy(() => import('@/features/assets/pages/AssetDebug'))
const AssetsList = lazy(() => import('@/features/assets/pages/AssetsList'))
const WidgetDebug = lazy(() => import('@/features/devtools/pages/WidgetDebug'))
const PublicPortfolio = lazy(() => import('@/features/portfolios/pages/PublicPortfolio'))
const Calendar = lazy(() => import('@/features/calendar/pages/Calendar'))
const AdminThemeTaxonomy = lazy(() => import('@/features/admin/pages/AdminThemeTaxonomy'))
const AdminClassificationBenchmark = lazy(
  () => import('@/features/admin/pages/AdminClassificationBenchmark'),
)

function RouteFallback() {
  return (
    <div className="flex min-h-64 items-center justify-center" role="status" aria-label="Loading page">
      <LoadingSpinner size="lg" variant="icon" color="indigo" />
    </div>
  )
}

// Configure React Query for optimal performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale-while-revalidate strategy
      staleTime: 30 * 1000, // Consider data fresh for 30 seconds
      gcTime: 5 * 60 * 1000, // Keep unused data in cache for 5 minutes (formerly cacheTime)

      // Refetch behavior
      refetchOnWindowFocus: true, // Refresh when user returns to tab
      refetchOnReconnect: true, // Refresh when internet reconnects
      refetchOnMount: true, // Refresh when component mounts if data is stale

      // Retry logic for failed requests
      retry: 1, // Only retry once for failed requests
      retryDelay: 1000, // Wait 1s before retrying

      // Network mode
      networkMode: 'online', // Only fetch when online
    },
    mutations: {
      // Mutations (create, update, delete) retry logic
      retry: 0, // Don't retry mutations by default
      networkMode: 'online',
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/p/:shareToken" element={<PublicPortfolio />} />

              {/* Protected routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="portfolios" element={<Portfolios />} />
                <Route path="charts" element={<Charts />} />
                <Route path="calendar" element={<Calendar />} />
                <Route path="insights" element={<Insights />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="transactions/metrics" element={<TransactionMetrics />} />
                <Route path="assets" element={<Assets />} />
                <Route path="assets/research" element={<AssetResearch />} />
                <Route path="assets/:symbol" element={<AssetResearch />} />
                <Route path="watchlist" element={<Watchlist />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="settings" element={<Settings />} />
                <Route path="profile" element={<Profile />} />
                <Route
                  path="admin"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Admin />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/theme-taxonomy"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminThemeTaxonomy />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/classification-benchmark"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminClassificationBenchmark />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="dev"
                  element={
                    <ProtectedRoute requireAdmin>
                      <DevTools />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="dev/assets"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AssetDebug />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="dev/assets-list"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AssetsList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="dev/widgets"
                  element={
                    <ProtectedRoute requireAdmin>
                      <WidgetDebug />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="icon-preview"
                  element={
                    <ProtectedRoute requireAdmin>
                      <IconPreview />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="flag-preview"
                  element={
                    <ProtectedRoute requireAdmin>
                      <FlagPreview />
                    </ProtectedRoute>
                  }
                />
                {/* 404 catch-all route */}
                <Route path="*" element={<NotFound />} />
              </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  )
}

export default App
