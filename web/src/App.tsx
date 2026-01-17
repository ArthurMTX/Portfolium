import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { LanguageProvider } from './contexts/LanguageContext'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Portfolios from './pages/Portfolios'
import Charts from './pages/Charts'
import Transactions from './pages/Transactions'
import TransactionMetrics from './pages/TransactionMetrics'
import Assets from './pages/Assets'
import Watchlist from './pages/Watchlist'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import Layout from './components/Layout'
import Admin from './pages/Admin'
import DevTools from './pages/DevTools'
import IconPreview from './pages/IconPreview'
import FlagPreview from './pages/FlagPreview'
import Insights from './pages/Insights'
import NotFound from './pages/NotFound'
import AssetDebug from './pages/AssetDebug'
import AssetsList from './pages/AssetsList'
import WidgetDebug from './pages/WidgetDebug'
import PublicPortfolio from './pages/PublicPortfolio'
import Calendar from './pages/Calendar'

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
