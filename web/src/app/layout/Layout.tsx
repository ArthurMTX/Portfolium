import { Suspense, useEffect, useRef, useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  ArrowLeftRight,
  BarChart3,
  BookText,
  Briefcase,
  Calendar,
  ChevronDown,
  Eye,
  Folder,
  GitCompare,
  Home,
  LayoutGrid,
  LineChart,
  LogOut,
  Menu,
  Moon,
  Package,
  PlusCircle,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Tags,
  TrendingUp,
  User,
  Wallet,
  Wrench,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/app/providers/AuthContext'
import { useTranslation } from 'react-i18next'
import NotificationBell from '@/features/notifications/components/NotificationBell'
import LanguageSwitcher from '@/app/layout/LanguageSwitcher'
import { VERSION } from '@/app/version'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import { PageStateSkeleton } from '@/shared/components/StatePrimitives'
import api from '@/api'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  isActive: (pathname: string) => boolean
}

function isAssetResearchPath(pathname: string) {
  return pathname === '/assets/research' || /^\/assets\/[^/]+\/research$/.test(pathname)
}

function isBoardsPath(pathname: string) {
  return pathname === '/boards' || pathname.startsWith('/boards/')
}

export default function Layout() {
  const location = useLocation()
  const [darkMode, setDarkMode] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [portfolioMenuOpen, setPortfolioMenuOpen] = useState(false)
  const [analyzeMenuOpen, setAnalyzeMenuOpen] = useState(false)
  const [pendingThemeSuggestions, setPendingThemeSuggestions] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const portfolioMenuRef = useRef<HTMLDivElement>(null)
  const analyzeMenuRef = useRef<HTMLDivElement>(null)
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const { portfolios, activePortfolioId, setActivePortfolio } = usePortfolioStore()
  const activePortfolio = portfolios.find((portfolio) => portfolio.id === activePortfolioId) ?? portfolios[0]

  useEffect(() => {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement

      if (menuRef.current && !menuRef.current.contains(target)) {
        setUserMenuOpen(false)
      }

      if (portfolioMenuRef.current && !portfolioMenuRef.current.contains(target)) {
        setPortfolioMenuOpen(false)
      }

      if (analyzeMenuRef.current && !analyzeMenuRef.current.contains(target)) {
        setAnalyzeMenuOpen(false)
      }

      if (mobileMenuRef.current && !mobileMenuRef.current.contains(target)) {
        if (!target.closest('[data-mobile-menu-button]')) {
          setMobileMenuOpen(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!(user?.is_admin || user?.is_superuser)) return

    api
      .getThemeTaxonomySuggestionStats()
      .then((stats) => setPendingThemeSuggestions(stats.counts_by_status.pending || 0))
      .catch(() => setPendingThemeSuggestions(0))
  }, [user?.is_admin, user?.is_superuser])

  useEffect(() => {
    setMobileMenuOpen(false)
    setPortfolioMenuOpen(false)
    setUserMenuOpen(false)
    setAnalyzeMenuOpen(false)
  }, [location.pathname])

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    document.documentElement.classList.toggle('dark')
  }

  const handleLogout = () => {
    logout()
    setUserMenuOpen(false)
  }

  const navigationItems: NavItem[] = [
    {
      to: '/dashboard',
      label: t('navigation.dashboard'),
      icon: Home,
      isActive: (pathname) => pathname === '/dashboard',
    },
    {
      to: '/boards',
      label: t('boards.nav'),
      icon: LayoutGrid,
      isActive: isBoardsPath,
    },
    {
      to: '/assets',
      label: t('navigation.assets'),
      icon: Package,
      isActive: (pathname) => (pathname === '/assets' || pathname.startsWith('/assets/')) && !isAssetResearchPath(pathname),
    },
    {
      to: '/transactions',
      label: t('navigation.transactions'),
      icon: ArrowLeftRight,
      isActive: (pathname) => pathname.startsWith('/transactions'),
    },
    {
      to: '/cash',
      label: t('cash.nav'),
      icon: Wallet,
      isActive: (pathname) => pathname === '/cash',
    },
    {
      to: '/allocation',
      label: t('navigation.allocation'),
      icon: Tags,
      isActive: (pathname) => pathname === '/allocation',
    },
    {
      to: '/assets/research',
      label: t('navigation.research'),
      icon: Search,
      isActive: isAssetResearchPath,
    },
  ]

  const analyzeItems: NavItem[] = [
    {
      to: '/insights',
      label: t('navigation.insights'),
      icon: TrendingUp,
      isActive: (pathname) => pathname === '/insights',
    },
    {
      to: '/charts',
      label: t('navigation.charts'),
      icon: LineChart,
      isActive: (pathname) => pathname === '/charts',
    },
    {
      to: '/calendar',
      label: t('navigation.calendar'),
      icon: Calendar,
      isActive: (pathname) => pathname === '/calendar',
    },
    {
      to: '/analysis/transactions',
      label: t('navigation.transactionAnalysis'),
      icon: BarChart3,
      isActive: (pathname) => pathname === '/analysis/transactions',
    },
    {
      to: '/watchlist',
      label: t('navigation.watchlist'),
      icon: Eye,
      isActive: (pathname) => pathname === '/watchlist',
    },
  ]

  const isAnalyzeActive = analyzeItems.some((item) => item.isActive(location.pathname))

  const mobileNavigationItems: NavItem[] = [
    navigationItems[0],
    navigationItems[1],
    analyzeItems[2],
    analyzeItems[0],
    analyzeItems[1],
    analyzeItems[3],
    navigationItems[2],
    navigationItems[3],
    navigationItems[4],
    analyzeItems[4],
    navigationItems[5],
  ]

  const renderNavLink = ({ to, label, icon: Icon, isActive: itemIsActive }: NavItem, mobile = false) => {
    const active = itemIsActive(location.pathname)
    const className = mobile
      ? `pf-mobile-nav-link ${active ? 'is-active' : ''}`
      : `pf-nav-link ${active ? 'is-active' : ''}`

    return (
      <Link key={to} to={to} className={className} title={label} aria-current={active ? 'page' : undefined}>
        <Icon aria-hidden="true" />
        <span className={mobile ? '' : 'pf-nav-label'}>{label}</span>
      </Link>
    )
  }

  const selectPortfolio = (portfolioId: number) => {
    setActivePortfolio(portfolioId)
    setPortfolioMenuOpen(false)
    setMobileMenuOpen(false)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="pf-topbar">
        <div className="pf-topbar__inner">
          <Link to="/dashboard" className="pf-brand" aria-label="Portfolium">
            <img src="/favicon.svg" alt="" className="pf-brand__logo" />
            <span className="pf-brand__name">Portfolium</span>
          </Link>

          <nav className="pf-nav" aria-label={t('navigation.main', 'Main navigation')}>
            {navigationItems.map((item) => renderNavLink(item))}

            <div className="pf-nav-dropdown" ref={analyzeMenuRef}>
              <button
                type="button"
                className={`pf-nav-link pf-nav-link--dropdown ${isAnalyzeActive ? 'is-active' : ''}`}
                onClick={() => setAnalyzeMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={analyzeMenuOpen}
              >
                <TrendingUp aria-hidden="true" />
                <span className="pf-nav-label">{t('navigation.analyze', 'Analyze')}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`pf-nav-dropdown__chevron transition-transform ${analyzeMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {analyzeMenuOpen && (
                <div className="pf-menu pf-nav-dropdown__menu" role="menu" aria-label={t('navigation.analyze', 'Analyze')}>
                  <div className="pf-menu-section">
                    {analyzeItems.map(({ to, label, icon: Icon, isActive: itemIsActive }) => {
                      const active = itemIsActive(location.pathname)
                      return (
                        <Link
                          key={to}
                          to={to}
                          className={`pf-menu-item ${active ? 'is-active' : ''}`}
                          onClick={() => setAnalyzeMenuOpen(false)}
                          role="menuitem"
                        >
                          <Icon aria-hidden="true" />
                          <span>{label}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </nav>

          <div className="pf-topbar-actions">
            {portfolios.length > 0 && (
              <div className="pf-workspace" ref={portfolioMenuRef}>
                <button
                  type="button"
                  className="pf-workspace-trigger"
                  onClick={() => {
                    setPortfolioMenuOpen((open) => !open)
                    setUserMenuOpen(false)
                  }}
                  aria-haspopup="menu"
                  aria-expanded={portfolioMenuOpen}
                  title={activePortfolio?.name}
                >
                  <Folder aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="pf-workspace-trigger__label">{t('navigation.workspace', 'Workspace')}</span>
                    <span className="pf-workspace-trigger__name">
                      {activePortfolio?.name ?? t('portfolios.title', 'Portfolios')}
                    </span>
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`transition-transform ${portfolioMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {portfolioMenuOpen && (
                  <div className="pf-workspace-menu" role="menu" aria-label={t('navigation.workspace', 'Workspace')}>
                    <div className="pf-menu-header">
                      <p className="pf-menu-title">{t('navigation.workspace', 'Workspace')}</p>
                      <p className="pf-menu-subtitle">{activePortfolio?.name}</p>
                    </div>
                    <div className="pf-menu-section">
                      {portfolios.map((portfolio) => {
                        const active = portfolio.id === activePortfolio?.id
                        return (
                          <button
                            key={portfolio.id}
                            type="button"
                            className={`pf-menu-item ${active ? 'is-active' : ''}`}
                            onClick={() => selectPortfolio(portfolio.id)}
                            role="menuitemradio"
                            aria-checked={active}
                          >
                            <Folder aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate">{portfolio.name}</span>
                            {active && <span className="pf-menu-item__check" aria-hidden="true" />}
                          </button>
                        )
                      })}
                    </div>
                    <div className="pf-menu-divider" />
                    <Link
                      to="/portfolios"
                      className="pf-menu-item"
                      onClick={() => setPortfolioMenuOpen(false)}
                      role="menuitem"
                    >
                      <Briefcase aria-hidden="true" />
                      <span>{t('navigation.managePortfolios', 'Manage portfolios')}</span>
                    </Link>
                    <Link
                      to="/portfolios"
                      className="pf-menu-item"
                      onClick={() => setPortfolioMenuOpen(false)}
                      role="menuitem"
                    >
                      <PlusCircle aria-hidden="true" />
                      <span>{t('navigation.createPortfolio', 'Create portfolio')}</span>
                    </Link>
                  </div>
                )}
              </div>
            )}

            <button
              data-mobile-menu-button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="pf-icon-button lg:hidden"
              aria-label={t('navigation.toggleMenu')}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>

            <button
              type="button"
              onClick={toggleDarkMode}
              className="pf-icon-button"
              aria-label={t('navigation.toggleDarkMode')}
            >
              {darkMode ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </button>

            {user && <NotificationBell />}

            {user && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen((open) => !open)
                    setPortfolioMenuOpen(false)
                  }}
                  className="pf-nav-button gap-1.5 px-2"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  aria-label={t('navigation.profile')}
                >
                  <User aria-hidden="true" />
                  <span className="hidden max-w-[8rem] truncate text-xs sm:inline">{user.username}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {userMenuOpen && (
                  <div className="pf-menu" role="menu" aria-label={t('navigation.profile')}>
                    <div className="pf-menu-header">
                      <p className="pf-menu-title">{user.username}</p>
                      <p className="pf-menu-subtitle">{user.email}</p>
                      {!user.is_verified && (
                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{t('auth.emailNotVerified')}</p>
                      )}
                    </div>

                    <div className="pf-menu-section">
                      <Link to="/profile" onClick={() => setUserMenuOpen(false)} className="pf-menu-item" role="menuitem">
                        <User aria-hidden="true" />
                        {t('navigation.profile')}
                      </Link>
                      <Link to="/settings" onClick={() => setUserMenuOpen(false)} className="pf-menu-item" role="menuitem">
                        <Settings aria-hidden="true" />
                        {t('navigation.settings')}
                      </Link>
                    </div>

                    {(user?.is_admin || user?.is_superuser) && (
                      <>
                        <div className="pf-menu-divider" />
                        <div className="pf-menu-section">
                          <Link to="/admin" onClick={() => setUserMenuOpen(false)} className="pf-menu-item" role="menuitem">
                            <ShieldCheck aria-hidden="true" />
                            {t('navigation.adminDashboard')}
                          </Link>
                          <Link
                            to="/admin/theme-taxonomy"
                            onClick={() => setUserMenuOpen(false)}
                            className="pf-menu-item"
                            role="menuitem"
                          >
                            <Tags aria-hidden="true" />
                            <span className="flex-1">Theme Suggestions</span>
                            {pendingThemeSuggestions > 0 && (
                              <span className="pf-badge pf-badge--accent">{pendingThemeSuggestions}</span>
                            )}
                          </Link>
                          <Link
                            to="/admin/classification-benchmark"
                            onClick={() => setUserMenuOpen(false)}
                            className="pf-menu-item"
                            role="menuitem"
                          >
                            <GitCompare aria-hidden="true" />
                            <span className="flex-1">Classification Benchmark</span>
                          </Link>
                          <Link to="/dev" onClick={() => setUserMenuOpen(false)} className="pf-menu-item" role="menuitem">
                            <Wrench aria-hidden="true" />
                            {t('navigation.devTools')}
                          </Link>
                        </div>
                      </>
                    )}

                    <div className="pf-menu-divider" />
                    <LanguageSwitcher />
                    <a
                      href="/docs/"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setUserMenuOpen(false)}
                      className="pf-menu-item"
                      role="menuitem"
                    >
                      <BookText aria-hidden="true" />
                      {t('navigation.documentation')}
                    </a>
                    <button type="button" onClick={handleLogout} className="pf-menu-item" role="menuitem">
                      <LogOut aria-hidden="true" />
                      {t('navigation.logout')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {mobileMenuOpen && (
          <div ref={mobileMenuRef} className="pf-mobile-panel lg:hidden">
            <nav className="pf-mobile-nav" aria-label={t('navigation.main', 'Main navigation')}>
              {portfolios.length > 0 && (
                <div className="pf-mobile-workspace">
                  <p className="pf-workspace-trigger__label mb-2">{t('navigation.workspace', 'Workspace')}</p>
                  <div className="grid gap-1">
                    {portfolios.map((portfolio) => {
                      const active = portfolio.id === activePortfolio?.id
                      return (
                        <button
                          key={portfolio.id}
                          type="button"
                          className={`pf-menu-item rounded-lg px-3 ${active ? 'is-active' : ''}`}
                          onClick={() => selectPortfolio(portfolio.id)}
                          aria-pressed={active}
                        >
                          <Folder aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">{portfolio.name}</span>
                          {active && <span className="pf-menu-item__check" aria-hidden="true" />}
                        </button>
                      )
                    })}
                    <Link to="/portfolios" className="pf-menu-item rounded-lg px-3">
                      <Briefcase aria-hidden="true" />
                      <span>{t('navigation.managePortfolios', 'Manage portfolios')}</span>
                    </Link>
                    <Link to="/portfolios" className="pf-menu-item rounded-lg px-3">
                      <PlusCircle aria-hidden="true" />
                      <span>{t('navigation.createPortfolio', 'Create portfolio')}</span>
                    </Link>
                  </div>
                </div>
              )}

              {mobileNavigationItems.map((item) => renderNavLink(item, true))}
            </nav>
          </div>
        )}
      </header>

      <main className="pf-app-main">
        <Suspense fallback={<PageStateSkeleton label={t('common.loading')} />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="mt-8 border-t border-neutral-200 bg-white py-3 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="container mx-auto flex flex-col items-center justify-between gap-2 px-4 sm:flex-row">
          <div className="flex flex-col items-center gap-2 sm:flex-row">
            <div className="text-sm font-semibold tracking-tight text-pink-600 dark:text-pink-400">Portfolium</div>
            <span className="hidden text-neutral-300 dark:text-neutral-700 sm:inline">•</span>
            <a
              href="https://github.com/ArthurMTX/Portfolium"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-neutral-500 underline underline-offset-2 transition-colors hover:text-pink-600 dark:text-neutral-400 dark:hover:text-pink-400"
            >
              <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24" className="inline-block" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.184 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.004.07 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.34-2.221-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.987 1.029-2.687-.103-.254-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.025A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.295 2.748-1.025 2.748-1.025.546 1.378.202 2.396.1 2.65.64.7 1.028 1.594 1.028 2.687 0 3.847-2.337 4.695-4.566 4.944.36.31.68.921.68 1.857 0 1.34-.012 2.422-.012 2.753 0 .268.18.579.688.481C19.138 20.203 22 16.447 22 12.021 22 6.484 17.523 2 12 2z" />
              </svg>
              <span>GitHub</span>
            </a>
          </div>
          <div className="font-mono text-[10px] text-neutral-400 dark:text-neutral-600">v{VERSION}</div>
        </div>
      </footer>
    </div>
  )
}
