import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/app/providers/AuthContext'
import { LanguageProvider } from '@/app/providers/LanguageContext'
import ProtectedRoute from '@/app/routing/ProtectedRoute'
import Dashboard from '@/features/dashboard/pages/Dashboard'
import Portfolios from '@/features/portfolios/pages/Portfolios'
import Charts from '@/features/charts/pages/Charts'
import Transactions from '@/features/transactions/pages/Transactions'
import TransactionMetrics from '@/features/transactions/pages/TransactionMetrics'
import Assets from '@/features/assets/pages/Assets'
import AssetResearch from '@/features/assets/pages/AssetResearch'
import Watchlist from '@/features/watchlist/pages/Watchlist'
import Notifications from '@/features/notifications/pages/Notifications'
import Settings from '@/features/settings/pages/Settings'
import Profile from '@/features/settings/pages/Profile'
import Login from '@/features/auth/pages/Login'
import Register from '@/features/auth/pages/Register'
import ForgotPassword from '@/features/auth/pages/ForgotPassword'
import ResetPassword from '@/features/auth/pages/ResetPassword'
import VerifyEmail from '@/features/auth/pages/VerifyEmail'
import Layout from '@/app/layout/Layout'
import Admin from '@/features/admin/pages/Admin'
import DevTools from '@/features/devtools/pages/DevTools'
import IconPreview from '@/features/devtools/pages/IconPreview'
import FlagPreview from '@/features/devtools/pages/FlagPreview'
import Insights from '@/features/insights/pages/Insights'
import NotFound from '@/app/routing/NotFound'
import AssetDebug from '@/features/assets/pages/AssetDebug'
import AssetsList from '@/features/assets/pages/AssetsList'
import WidgetDebug from '@/features/devtools/pages/WidgetDebug'
import PublicPortfolio from '@/features/portfolios/pages/PublicPortfolio'
import Calendar from '@/features/calendar/pages/Calendar'
import AdminThemeTaxonomy from '@/features/admin/pages/AdminThemeTaxonomy'
import AdminClassificationBenchmark from '@/features/admin/pages/AdminClassificationBenchmark'

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
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  )
}

export default App
