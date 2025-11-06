import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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

function App() {
  return (
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
  )
}

export default App
