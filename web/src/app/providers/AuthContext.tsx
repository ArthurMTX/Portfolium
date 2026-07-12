/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api } from '@/api'
import { ApiRequestError } from '@/api/client'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'

export interface User {
  id: number
  email: string
  username: string
  full_name: string | null
  is_active: boolean
  is_verified: boolean
  is_superuser: boolean
  is_admin: boolean
  created_at: string
  last_login: string | null
  preferred_language: string
  daily_change_notifications_enabled: boolean
  transaction_notifications_enabled: boolean
  daily_report_enabled: boolean
  ath_atl_notifications_enabled: boolean
  push_notifications_enabled: boolean
  totp_enabled: boolean
}

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string, fullName?: string, preferredLanguage?: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('auth_token')
  )
  const [loading, setLoading] = useState(true)

  // Get portfolio store reset function
  const resetPortfolioStore = usePortfolioStore((state) => state.reset)
  const setPortfolios = usePortfolioStore((state) => state.setPortfolios)
  const setActivePortfolio = usePortfolioStore((state) => state.setActivePortfolio)

  // Fetch current user on mount or token change
  useEffect(() => {
    if (token) {
      fetchUser()
    } else {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const fetchUser = async () => {
    try {
      setLoading(true)
      const userData = await api.getCurrentUser()
      setUser(userData)
    } catch (error) {
      console.error('Failed to fetch user:', error)
      // Only drop the stored session when the API explicitly rejected the
      // token. Aborted or failed requests (page navigation while /auth/me is
      // in flight, brief network loss) must not log the user out — the next
      // load retries with the same token.
      if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
        logout()
      }
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    const data = await api.login(email, password)
    setToken(data.access_token)
    setUser(data.user)
    localStorage.setItem('auth_token', data.access_token)
    
    // Clear portfolio store to prevent accessing portfolios from previous user
    resetPortfolioStore()
    setPortfolios([])
    setActivePortfolio(null)
  }

  const register = async (
    email: string,
    username: string,
    password: string,
    fullName?: string,
    preferredLanguage?: string
  ) => {
    await api.register(email, username, password, fullName, preferredLanguage)
    // Don't auto-login after registration - require email verification
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('auth_token')
    
    // Clear portfolio store on logout
    resetPortfolioStore()
    setPortfolios([])
    setActivePortfolio(null)
  }

  const refreshUser = async () => {
    if (token) {
      await fetchUser()
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
