import { Outlet, Link, useLocation } from 'react-router-dom'
import { Home, Briefcase, ArrowLeftRight, Package, Settings, Moon, Sun, LineChart } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function Layout() {
  const location = useLocation()
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    // Check system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    document.documentElement.classList.toggle('dark')
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
              to="/portfolio"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isActive('/portfolio')
                  ? 'bg-pink-50 dark:bg-pink-950 text-pink-600 dark:text-pink-400'
                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <LineChart size={18} />
              <span>Chart</span>
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
              to="/settings"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isActive('/settings')
                  ? 'bg-pink-50 dark:bg-pink-950 text-pink-600 dark:text-pink-400'
                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Settings size={18} />
              <span>Settings</span>
            </Link>
          </nav>

          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
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
            href="https://github.com/yourusername/portfolium"
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
