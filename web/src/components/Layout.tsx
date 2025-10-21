            import { Outlet, Link, useLocation } from 'react-router-dom'
import { Home, Briefcase, ArrowLeftRight, Package, Settings, Moon, Sun, LineChart, User, LogOut, ChevronDown, ShieldCheck, Eye } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import NotificationBell from './NotificationBell'

export default function Layout() {
  const location = useLocation()
  const [darkMode, setDarkMode] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { user, logout } = useAuth()

  useEffect(() => {
    // Check system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  useEffect(() => {
    // Close menu on click outside
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    document.documentElement.classList.toggle('dark')
  }

  const handleLogout = () => {
    logout()
    setUserMenuOpen(false)
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-pink-600 rounded-lg" />
            <h1 className="text-xl font-bold">Portfolium</h1>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/dashboard"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isActive('/dashboard')
                  ? 'bg-pink-50 dark:bg-pink-950 text-pink-600 dark:text-pink-400'
                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Home size={18} />
              <span>Dashboard</span>
            </Link>
            <Link
              to="/portfolios"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isActive('/portfolios')
                  ? 'bg-pink-50 dark:bg-pink-950 text-pink-600 dark:text-pink-400'
                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Briefcase size={18} />
              <span>Portfolios</span>
            </Link>
            <Link
              to="/charts"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isActive('/charts')
                  ? 'bg-pink-50 dark:bg-pink-950 text-pink-600 dark:text-pink-400'
                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <LineChart size={18} />
              <span>Charts</span>
            </Link>
            <Link
              to="/transactions"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isActive('/transactions')
                  ? 'bg-pink-50 dark:bg-pink-950 text-pink-600 dark:text-pink-400'
                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <ArrowLeftRight size={18} />
              <span>Transactions</span>
            </Link>
            <Link
              to="/assets"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isActive('/assets')
                  ? 'bg-pink-50 dark:bg-pink-950 text-pink-600 dark:text-pink-400'
                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Package size={18} />
              <span>Assets</span>
            </Link>
            <Link
              to="/watchlist"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isActive('/watchlist')
                  ? 'bg-pink-50 dark:bg-pink-950 text-pink-600 dark:text-pink-400'
                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Eye size={18} />
              <span>Watchlist</span>
            </Link>
            {(user?.is_admin || user?.is_superuser) && (
              <Link
                to="/admin"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  isActive('/admin')
                    ? 'bg-pink-50 dark:bg-pink-950 text-pink-600 dark:text-pink-400'
                    : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <ShieldCheck size={18} />
                <span>Admin</span>
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Notification Bell */}
            {user && <NotificationBell />}

            {/* User Menu */}
            {user && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <User size={18} />
                  <span className="hidden sm:inline text-sm font-medium">{user.username}</span>
                  <ChevronDown size={16} className={`transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 z-50">
                    <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">{user.username}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{user.email}</p>
                      {!user.is_verified && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Email not verified</p>
                      )}
                    </div>
                    <div className="py-1">
                      <Link
                        to="/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <User size={16} />
                        Profile
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <Settings size={16} />
                        Settings
                      </Link>
                      <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />
                    {(user?.is_admin || user?.is_superuser) && (
                        <Link
                          to="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover-bg-neutral-700 transition-colors"
                        >
                          <ShieldCheck size={16} />
                          Admin Dashboard
                        </Link>
                    )}
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <LogOut size={16} />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="relative bg-gradient-to-br from-pink-50 via-white to-blue-50 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-900 border-t border-neutral-200 dark:border-neutral-800 py-3 mt-8 shadow-inner">
        <div className="container mx-auto px-4 flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 text-base font-semibold text-pink-600 dark:text-pink-400">
            Portfolium
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            © 2025 — Built with <span className="animate-pulse inline-block">💖</span>
          </p>
          <a
            href="https://github.com/ArthurMTX/Portfolium"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400 hover:text-pink-600 dark:hover:text-pink-400 transition-colors underline underline-offset-2"
          >
            <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24" className="inline-block"><path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.184 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.004.07 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.34-2.221-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.987 1.029-2.687-.103-.254-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.025A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.295 2.748-1.025 2.748-1.025.546 1.378.202 2.396.1 2.65.64.7 1.028 1.594 1.028 2.687 0 3.847-2.337 4.695-4.566 4.944.36.31.68.921.68 1.857 0 1.34-.012 2.422-.012 2.753 0 .268.18.579.688.481C19.138 20.203 22 16.447 22 12.021 22 6.484 17.523 2 12 2z"/></svg>
            <span>GitHub</span>
          </a>
        </div>
      </footer>
    </div>
  )
}
