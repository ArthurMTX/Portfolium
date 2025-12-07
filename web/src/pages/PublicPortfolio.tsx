import React, { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import {
    AlertTriangle,
    Globe,
    PieChart,
    Sun,
    Moon,
    TrendingUp,
    Shield,
    Eye,
    Zap,
    UserPlus,
    ArrowRight,
    BarChart3,
    Lock,
    ChevronRight,
    ChevronDown,
    LayoutDashboard
} from 'lucide-react'
import api, { PublicPortfolioInsights } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { getFlagUrl } from '../lib/countryUtils'
import {
    getSectorIcon,
    getSectorColor,
    getIndustryIcon,
    getIndustryColor
} from '../lib/sectorIndustryUtils'
import { getAssetLogoUrl, handleLogoError } from '../lib/logoUtils'

const LANGUAGES = [
    { code: 'en', name: 'English', country: 'GB' },
    { code: 'fr', name: 'Français', country: 'FR' },
]

// Animated counter hook for number animations
const useAnimatedCounter = (end: number, duration: number = 1500, start: number = 0) => {
    const [count, setCount] = useState(start)
    const [hasAnimated, setHasAnimated] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasAnimated) {
                    setHasAnimated(true)
                    let startTime: number
                    const animate = (currentTime: number) => {
                        if (!startTime) startTime = currentTime
                        const progress = Math.min((currentTime - startTime) / duration, 1)
                        const easeOutQuart = 1 - Math.pow(1 - progress, 4)
                        setCount(Math.floor(easeOutQuart * (end - start) + start))
                        if (progress < 1) {
                            requestAnimationFrame(animate)
                        }
                    }
                    requestAnimationFrame(animate)
                }
            },
            { threshold: 0.1 }
        )
        if (ref.current) observer.observe(ref.current)
        return () => observer.disconnect()
    }, [end, duration, start, hasAnimated])

    return { count, ref }
}

const PublicPortfolio: React.FC = () => {
    const { shareToken } = useParams<{ shareToken: string }>()
    const { t, i18n } = useTranslation()
    const { user } = useAuth()
    const [data, setData] = useState<PublicPortfolioInsights | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [darkMode, setDarkMode] = useState(false)
    const [langMenuOpen, setLangMenuOpen] = useState(false)
    const langMenuRef = useRef<HTMLDivElement>(null)

    const currentLanguage = LANGUAGES.find(lang => lang.code === i18n.language) || LANGUAGES[0]

    const changeLanguage = (code: string) => {
        i18n.changeLanguage(code)
        setLangMenuOpen(false)
    }

    // Close language menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
                setLangMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Theme management
    useEffect(() => {
        const savedTheme = localStorage.getItem('public-theme')
        if (
            savedTheme === 'dark' ||
            (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
        ) {
            setDarkMode(true)
            document.documentElement.classList.add('dark')
        }
    }, [])

    const toggleDarkMode = () => {
        setDarkMode(!darkMode)
        if (!darkMode) {
            document.documentElement.classList.add('dark')
            localStorage.setItem('public-theme', 'dark')
        } else {
            document.documentElement.classList.remove('dark')
            localStorage.setItem('public-theme', 'light')
        }
    }

    useEffect(() => {
        const fetchData = async () => {
            if (!shareToken) return
            try {
                const response = await api.getPublicPortfolio(shareToken)
                setData(response)
            } catch (err) {
                console.error(err)
                setError(
                    'This portfolio is not publicly shared or does not exist.'
                )
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [shareToken])

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-6">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-2 border-neutral-200 dark:border-neutral-800" />
                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-pink-500 animate-spin" />
                        <div className="absolute inset-3 rounded-full bg-pink-500 flex items-center justify-center">
                            <BarChart3 className="w-5 h-5 text-white" />
                        </div>
                    </div>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm">{t('publicPortfolio.loading')}</p>
                </div>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
                <div className="text-center px-6 max-w-lg">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-xl bg-amber-100 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 flex items-center justify-center">
                        <AlertTriangle className="h-8 w-8 text-amber-500 dark:text-amber-400" />
                    </div>
                    <h2 className="text-2xl font-bold mb-4 text-neutral-900 dark:text-white">{t('publicPortfolio.unavailable')}</h2>
                    <p className="text-neutral-600 dark:text-neutral-400 mb-8 leading-relaxed">
                        {error || t('publicPortfolio.notFoundMessage')}
                    </p>
                    <Link
                        to="/register"
                        className="group inline-flex items-center gap-3 px-6 py-3 bg-pink-600 hover:bg-pink-500 text-white font-semibold rounded-lg transition-colors"
                    >
                        <UserPlus size={20} />
                        {t('publicPortfolio.createYourOwn')}
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </div>
        )
    }

    const formatNumber = (
        val: number | string | null | undefined,
        decimals = 2
    ) => {
        if (val === null || val === undefined) return '-'
        const num = typeof val === 'string' ? parseFloat(val) : val
        return num.toFixed(decimals)
    }

    const topSector =
        data.sector_allocation && data.sector_allocation.length > 0
            ? [...data.sector_allocation].sort(
                (a, b) => b.percentage - a.percentage
            )[0]
            : null

    const topCountry =
        data.geographic_allocation && data.geographic_allocation.length > 0
            ? [...data.geographic_allocation].sort(
                (a, b) => b.percentage - a.percentage
            )[0]
            : null

    // Stats for animated counters
    const holdingsCount = data.holdings?.length || 0
    const sectorsCount = data.sector_allocation?.length || 0
    const marketsCount = data.geographic_allocation?.length || 0

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white overflow-x-hidden">

            {/* Floating ticker bar */}
            <div className="relative bg-white dark:bg-neutral-900/80 border-b border-neutral-200 dark:border-neutral-800 overflow-hidden">
                <div className="animate-ticker flex whitespace-nowrap py-2">
                    {[...data.holdings, ...data.holdings, ...data.holdings].map((h, i) => (
                        <span key={i} className="inline-flex items-center gap-2 mx-6 text-sm">
                            <span className="text-pink-600 dark:text-pink-400 font-mono font-semibold">{h.symbol}</span>
                            <span className="text-neutral-400 dark:text-neutral-500">•</span>
                            <span className="text-neutral-600 dark:text-neutral-400">{formatNumber(h.weight_pct, 1)}%</span>
                        </span>
                    ))}
                </div>
            </div>

            {/* Header */}
            <header className="relative sticky top-0 z-50">
                <div className="absolute inset-0 bg-white/80 dark:bg-neutral-950/70 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-800/50" />
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src="/favicon.svg" alt="Portfolium" className="w-9 h-9" />
                        <span className="text-xl font-bold tracking-tight">
                            Portfolium
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Language Switcher */}
                        <div className="relative" ref={langMenuRef}>
                            <button
                                onClick={() => setLangMenuOpen(!langMenuOpen)}
                                className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800/50 dark:hover:bg-neutral-700/50 border border-neutral-200 dark:border-neutral-700/50 transition-all duration-200"
                                aria-label="Change language"
                            >
                                <img
                                    src={getFlagUrl(currentLanguage.country, 'w20') || ''}
                                    alt={currentLanguage.name}
                                    className="w-5 h-4 object-cover rounded-sm"
                                />
                                <ChevronDown size={14} className={`text-neutral-500 transition-transform ${langMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {langMenuOpen && (
                                <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg overflow-hidden z-50">
                                    {LANGUAGES.map((lang) => (
                                        <button
                                            key={lang.code}
                                            onClick={() => changeLanguage(lang.code)}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                                                i18n.language === lang.code
                                                    ? 'bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400'
                                                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                                            }`}
                                        >
                                            <img
                                                src={getFlagUrl(lang.country, 'w20') || ''}
                                                alt={lang.name}
                                                className="w-5 h-4 object-cover rounded-sm"
                                            />
                                            <span>{lang.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Theme Toggle */}
                        <button
                            onClick={toggleDarkMode}
                            className="p-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800/50 dark:hover:bg-neutral-700/50 border border-neutral-200 dark:border-neutral-700/50 transition-all duration-200"
                            aria-label="Toggle theme"
                        >
                            {darkMode ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} className="text-neutral-600" />}
                        </button>
                        {user ? (
                            <Link
                                to="/"
                                className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-semibold rounded-lg transition-colors text-sm"
                            >
                                <LayoutDashboard size={16} />
                                {t('publicPortfolio.goToDashboard')}
                            </Link>
                        ) : (
                            <Link
                                to="/register"
                                className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-semibold rounded-lg transition-colors text-sm"
                            >
                                <UserPlus size={16} />
                                {t('publicPortfolio.signUp')}
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
                {/* Hero Section - Asymmetric layout */}
                <section>
                    <div className="grid lg:grid-cols-5 gap-8 items-start">
                        {/* Left content - takes 3 cols */}
                        <div className="lg:col-span-3 space-y-8">
                            {/* Badges */}
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-pink-100 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-500/20">
                                    <Eye size={12} />
                                    {t('publicPortfolio.publicSnapshot')}
                                </span>
                                <span className="inline-flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                                    <Lock size={12} />
                                    {t('publicPortfolio.amountsHidden')}
                                </span>
                            </div>

                            {/* Portfolio name with gradient */}
                            <div>
                                <p className="text-neutral-500 text-sm mb-2 flex items-center gap-2">
                                    {t('publicPortfolio.sharedBy')} <span className="text-pink-600 dark:text-pink-400 font-medium">{data.owner_username}</span>
                                </p>
                                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                                    <span className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-500 dark:from-white dark:via-white dark:to-neutral-400 bg-clip-text text-transparent">
                                        {data.portfolio_name}
                                    </span>
                                </h1>
                            </div>

                            {/* Description */}
                            <p className="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-xl">
                                <Trans
                                    i18nKey="publicPortfolio.description"
                                    values={{ user: data.owner_username }}
                                    components={{ 1: <span className="text-neutral-900 dark:text-white" /> }}
                                />
                            </p>

                            {/* Stats row with animated counters */}
                            <div className="flex flex-wrap gap-6">
                                <StatCounter value={holdingsCount} label={t('publicPortfolio.positions')} suffix="" />
                                <StatCounter value={sectorsCount} label={t('insights.sectorAllocation')} suffix="" />
                                <StatCounter value={marketsCount} label={t('insights.geographicAllocation')} suffix="" />
                            </div>

                            {/* CTA buttons */}
                            <div className="flex flex-wrap items-center gap-4 pt-4">
                                {user ? (
                                    <Link
                                        to="/"
                                        className="group inline-flex items-center gap-3 px-7 py-4 bg-pink-600 hover:bg-pink-500 text-white font-semibold rounded-lg transition-colors"
                                    >
                                        <LayoutDashboard size={20} />
                                        {t('publicPortfolio.goToDashboard')}
                                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </Link>
                                ) : (
                                    <Link
                                        to="/register"
                                        className="group inline-flex items-center gap-3 px-7 py-4 bg-pink-600 hover:bg-pink-500 text-white font-semibold rounded-lg transition-colors"
                                    >
                                        <Zap size={20} />
                                        {t('publicPortfolio.createYourOwn')}
                                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </Link>
                                )}
                            </div>
                        </div>

                        {/* Right sidebar - Quick overview card */}
                        <div className="lg:col-span-2">
                            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('publicPortfolio.quickOverview')}</h3>
                                        <BarChart3 size={16} className="text-pink-500 dark:text-pink-400" />
                                    </div>

                                    {/* Top sector */}
                                    {topSector && (
                                        <div className="space-y-3">
                                            <p className="text-xs text-neutral-500 uppercase tracking-wider">{t('publicPortfolio.topSector')}</p>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {(() => {
                                                        const Icon = getSectorIcon(topSector.sector)
                                                        return <Icon className={`w-5 h-5 ${getSectorColor(topSector.sector)}`} />
                                                    })()}
                                                    <span className="font-medium">{t(`sectors.${topSector.sector}`, topSector.sector)}</span>
                                                </div>
                                                <span className="text-pink-600 dark:text-pink-400 font-mono font-bold">{formatNumber(topSector.percentage, 1)}%</span>
                                            </div>
                                            <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                                                <div 
                                                    className="h-full rounded-full bg-gradient-to-r from-pink-500 to-pink-400 transition-all duration-1000 ease-out"
                                                    style={{ width: `${topSector.percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Top country */}
                                    {topCountry && (
                                        <div className="space-y-3">
                                            <p className="text-xs text-neutral-500 uppercase tracking-wider">{t('publicPortfolio.mainExposure')}</p>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {getFlagUrl(topCountry.country) ? (
                                                        <img src={getFlagUrl(topCountry.country) || ''} className="w-6 h-4 rounded object-cover" alt={topCountry.country} />
                                                    ) : (
                                                        <Globe size={18} className="text-neutral-400" />
                                                    )}
                                                    <span className="font-medium">{topCountry.country}</span>
                                                </div>
                                                <span className="text-pink-600 dark:text-pink-400 font-mono font-bold">{formatNumber(topCountry.percentage, 1)}%</span>
                                            </div>
                                            <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                                                <div 
                                                    className="h-full rounded-full bg-gradient-to-r from-pink-500 to-pink-400 transition-all duration-1000 ease-out"
                                                    style={{ width: `${topCountry.percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Allocation Sections */}
                <section className="grid gap-6 lg:grid-cols-2">
                    {/* Sector Allocation */}
                    <AllocationCard
                        title={t('publicPortfolio.sectorAllocation')}
                        subtitle={`${data.sector_allocation.length} ${t('insights.assets')}`}
                        icon={PieChart}
                        iconBg="from-blue-500/20 to-blue-600/10"
                        iconColor="text-blue-400"
                    >
                        <div className="space-y-5">
                            {data.sector_allocation.map((item, index) => {
                                const SectorIcon = getSectorIcon(item.sector)
                                return (
                                    <div 
                                        key={item.sector} 
                                        className="group space-y-2"
                                        style={{ animationDelay: `${index * 100}ms` }}
                                    >
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
                                                <SectorIcon className={`w-4 h-4 ${getSectorColor(item.sector)}`} />
                                                {t(`sectors.${item.sector}`, item.sector)}
                                            </span>
                                            <span className="font-mono font-semibold text-neutral-900 dark:text-white">
                                                {formatNumber(item.percentage, 1)}%
                                            </span>
                                        </div>
                                        <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-pink-600 to-pink-400 group-hover:from-pink-500 group-hover:to-pink-300 transition-all duration-500"
                                                style={{ 
                                                    width: `${item.percentage}%`,
                                                    transition: 'width 1s ease-out'
                                                }}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </AllocationCard>

                    {/* Geographic Allocation */}
                    <AllocationCard
                        title={t('publicPortfolio.geographicAllocation')}
                        subtitle={`${data.geographic_allocation.length} ${t('insights.assets')}`}
                        icon={Globe}
                        iconBg="from-emerald-500/20 to-emerald-600/10"
                        iconColor="text-emerald-400"
                    >
                        <div className="space-y-5">
                            {data.geographic_allocation.map((item, index) => {
                                const flagUrl = getFlagUrl(item.country)
                                return (
                                    <div 
                                        key={item.country} 
                                        className="group space-y-2"
                                        style={{ animationDelay: `${index * 100}ms` }}
                                    >
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
                                                {flagUrl ? (
                                                    <img src={flagUrl} alt={item.country} className="w-5 h-4 object-cover rounded" />
                                                ) : (
                                                    <Globe size={16} className="text-neutral-500" />
                                                )}
                                                {item.country}
                                            </span>
                                            <span className="font-mono font-semibold text-neutral-900 dark:text-white">
                                                {formatNumber(item.percentage, 1)}%
                                            </span>
                                        </div>
                                        <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-pink-600 to-pink-400 group-hover:from-pink-500 group-hover:to-pink-300 transition-all duration-500"
                                                style={{ 
                                                    width: `${item.percentage}%`,
                                                    transition: 'width 1s ease-out'
                                                }}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </AllocationCard>
                </section>

                {/* Holdings Table */}
                <section>
                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
                        <div className="px-6 py-5 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-pink-600/10 flex items-center justify-center border border-pink-200 dark:border-pink-500/20">
                                        <TrendingUp size={18} className="text-pink-500 dark:text-pink-400" />
                                    </div>
                                    {t('publicPortfolio.topHoldings')}
                                </h3>
                                <p className="mt-1 text-sm text-neutral-500">
                                    {t('publicPortfolio.amountsHidden')}
                                </p>
                            </div>
                            <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                                {data.holdings.length} {t('publicPortfolio.assets')}
                            </span>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-neutral-50 dark:bg-neutral-900/80 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">{t('publicPortfolio.asset')}</th>
                                        <th className="px-6 py-4 font-medium hidden lg:table-cell">{t('publicPortfolio.country')}</th>
                                        <th className="px-6 py-4 font-medium hidden sm:table-cell">{t('publicPortfolio.sector')}</th>
                                        <th className="px-6 py-4 font-medium hidden md:table-cell">{t('publicPortfolio.industry')}</th>
                                        <th className="px-6 py-4 font-medium text-right">{t('publicPortfolio.weight')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                                    {data.holdings.map((holding, index) => {
                                        const SectorIcon = getSectorIcon(holding.sector)
                                        const IndustryIcon = getIndustryIcon(holding.industry)
                                        const logoUrl = getAssetLogoUrl(holding.symbol, holding.asset_type, holding.name)
                                        return (
                                            <tr
                                                key={holding.symbol}
                                                className="group hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors"
                                                style={{ animationDelay: `${index * 50}ms` }}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="relative">
                                                            <img
                                                                src={logoUrl}
                                                                alt={holding.symbol}
                                                                className="w-10 h-10 object-cover"
                                                                onError={e => handleLogoError(e, holding.symbol, holding.name, holding.asset_type)}
                                                            />
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-neutral-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                                                                {holding.symbol}
                                                            </p>
                                                            <p className="text-xs text-neutral-500">
                                                                {holding.name}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 hidden lg:table-cell">
                                                    {holding.country ? (
                                                        <span className="inline-flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                                                            {getFlagUrl(holding.country) && (
                                                                <img
                                                                    src={getFlagUrl(holding.country, 'w20') || ''}
                                                                    alt={holding.country}
                                                                    className="w-5 h-auto rounded-sm"
                                                                />
                                                            )}
                                                            <span>{holding.country}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-neutral-400 dark:text-neutral-600">—</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 hidden sm:table-cell">
                                                    {holding.sector ? (
                                                        <span className="inline-flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                                                            <SectorIcon className={`w-4 h-4 ${getSectorColor(holding.sector)}`} />
                                                            <span>{t(`sectors.${holding.sector}`, holding.sector)}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-neutral-400 dark:text-neutral-600">—</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 hidden md:table-cell">
                                                    {holding.industry ? (
                                                        <span className="inline-flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                                                            <IndustryIcon className={`w-4 h-4 ${getIndustryColor(holding.industry)}`} />
                                                            <span>{t(`industries.${holding.industry}`, holding.industry)}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-neutral-400 dark:text-neutral-600">—</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="inline-flex items-center gap-3">
                                                        <div className="w-16 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden hidden sm:block">
                                                            <div
                                                                className="h-full rounded-full bg-gradient-to-r from-pink-500 to-pink-400"
                                                                style={{ width: `${Math.min(holding.weight_pct * 2, 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className="font-mono font-bold text-neutral-900 dark:text-white min-w-[60px] text-right">
                                                            {formatNumber(holding.weight_pct, 2)}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* Bottom CTA Section */}
                <section className="py-12">
                    <div className="relative bg-gradient-to-br from-neutral-50 via-white to-neutral-100 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 sm:p-12 lg:p-16 overflow-hidden">
                        {/* Decorative background with floating asset cards */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
                            {/* Left side floating cards */}
                            <div className="absolute -left-20 top-1/2 -translate-y-1/2 flex flex-col gap-4 -rotate-12">
                                {data.holdings.slice(0, 5).map((h, i) => {
                                    const logoUrl = getAssetLogoUrl(h.symbol, h.asset_type, h.name)
                                    return (
                                        <div
                                            key={`left-${i}`}
                                            className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 opacity-60"
                                            style={{
                                                transform: `translateX(${i % 2 === 0 ? '20px' : '0px'})`,
                                            }}
                                        >
                                            <img
                                                src={logoUrl}
                                                alt={h.symbol}
                                                className="w-10 h-10 rounded-lg object-cover bg-neutral-100 dark:bg-neutral-700"
                                                onError={e => handleLogoError(e, h.symbol, h.name, h.asset_type)}
                                            />
                                            <div className="text-left">
                                                <p className="font-bold text-neutral-900 dark:text-white text-sm">{h.symbol}</p>
                                                <p className="text-xs text-neutral-500 truncate max-w-[100px]">{h.name}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Right side floating cards */}
                            <div className="absolute -right-20 top-1/2 -translate-y-1/2 flex flex-col gap-4 rotate-12">
                                {data.holdings.slice(5, 10).map((h, i) => {
                                    const logoUrl = getAssetLogoUrl(h.symbol, h.asset_type, h.name)
                                    return (
                                        <div
                                            key={`right-${i}`}
                                            className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 opacity-60"
                                            style={{
                                                transform: `translateX(${i % 2 === 0 ? '-20px' : '0px'})`,
                                            }}
                                        >
                                            <img
                                                src={logoUrl}
                                                alt={h.symbol}
                                                className="w-10 h-10 rounded-lg object-cover bg-neutral-100 dark:bg-neutral-700"
                                                onError={e => handleLogoError(e, h.symbol, h.name, h.asset_type)}
                                            />
                                            <div className="text-left">
                                                <p className="font-bold text-neutral-900 dark:text-white text-sm">{h.symbol}</p>
                                                <p className="text-xs text-neutral-500 truncate max-w-[100px]">{h.name}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Top floating logos row */}
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex gap-6">
                                {data.holdings.slice(0, 8).map((h, i) => {
                                    const logoUrl = getAssetLogoUrl(h.symbol, h.asset_type, h.name)
                                    return (
                                        <div
                                            key={`top-${i}`}
                                            className="w-12 h-12 rounded-xl bg-white dark:bg-neutral-800 shadow-lg border border-neutral-200 dark:border-neutral-700 flex items-center justify-center opacity-40"
                                            style={{
                                                transform: `rotate(${(i - 4) * 5}deg) translateY(${Math.abs(i - 3.5) * 8}px)`,
                                            }}
                                        >
                                            <img
                                                src={logoUrl}
                                                alt={h.symbol}
                                                className="w-8 h-8 rounded-lg object-cover"
                                                onError={e => handleLogoError(e, h.symbol, h.name, h.asset_type)}
                                            />
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Bottom floating logos row */}
                            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-6">
                                {data.holdings.slice(3, 11).map((h, i) => {
                                    const logoUrl = getAssetLogoUrl(h.symbol, h.asset_type, h.name)
                                    return (
                                        <div
                                            key={`bottom-${i}`}
                                            className="w-12 h-12 rounded-xl bg-white dark:bg-neutral-800 shadow-lg border border-neutral-200 dark:border-neutral-700 flex items-center justify-center opacity-40"
                                            style={{
                                                transform: `rotate(${(i - 4) * -5}deg) translateY(${-Math.abs(i - 3.5) * 8}px)`,
                                            }}
                                        >
                                            <img
                                                src={logoUrl}
                                                alt={h.symbol}
                                                className="w-8 h-8 rounded-lg object-cover"
                                                onError={e => handleLogoError(e, h.symbol, h.name, h.asset_type)}
                                            />
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Subtle radial gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-white/80 dark:to-neutral-900/80" />
                        </div>

                        <div className="relative max-w-3xl mx-auto text-center">
                            {/* Icon */}
                            <div className="w-16 h-16 mx-auto mb-8 bg-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/25">
                                <Zap className="text-white" size={28} />
                            </div>
                            
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
                                <span className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-500 dark:from-white dark:via-white dark:to-neutral-400 bg-clip-text text-transparent">
                                    {t('publicPortfolio.buildYourStory')}
                                </span>
                            </h2>
                            
                            <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                                {t('publicPortfolio.trackInvestments')}
                            </p>
                            
                            {/* Feature grid */}
                            <div className="grid sm:grid-cols-3 gap-6 mb-12">
                                <FeatureCard 
                                    icon={TrendingUp}
                                    title={t('publicPortfolio.featureRealtime')}
                                    description=""
                                    color="emerald"
                                />
                                <FeatureCard 
                                    icon={Shield}
                                    title={t('publicPortfolio.featureDiversification')}
                                    description=""
                                    color="purple"
                                />
                                <FeatureCard 
                                    icon={Eye}
                                    title={t('publicPortfolio.featurePrivacy')}
                                    description=""
                                    color="blue"
                                />
                            </div>
                            
                            {/* CTA button */}
                            {user ? (
                                <Link
                                    to="/"
                                    className="group inline-flex items-center gap-3 px-8 py-4 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-lg transition-colors text-lg"
                                >
                                    <LayoutDashboard size={24} />
                                    {t('publicPortfolio.goToDashboard')}
                                    <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </Link>
                            ) : (
                                <Link
                                    to="/register"
                                    className="group inline-flex items-center gap-3 px-8 py-4 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-lg transition-colors text-lg"
                                >
                                    <UserPlus size={24} />
                                    {t('publicPortfolio.getStarted')}
                                    <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </Link>
                            )}
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="relative border-t border-neutral-200 dark:border-neutral-800 py-8 mt-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <img src="/favicon.svg" alt="Portfolium" className="w-7 h-7" />
                            <span className="font-bold">Portfolium</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <a
                                href="https://github.com/ArthurMTX/Portfolium"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                                aria-label="GitHub"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                                </svg>
                            </a>
                            <p className="text-sm text-neutral-500">
                                {t('publicPortfolio.disclaimer')} • {t('publicPortfolio.notAdvice')}
                            </p>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Custom CSS for animations */}
            <style>{`
                @keyframes ticker {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-33.33%); }
                }
                .animate-ticker {
                    animation: ticker 30s linear infinite;
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-20px) rotate(5deg); }
                }
            `}</style>
        </div>
    )
}

// Stat counter component with animation
const StatCounter: React.FC<{ value: number; label: string; suffix: string }> = ({ value, label, suffix }) => {
    const { count, ref } = useAnimatedCounter(value, 1200)
    return (
        <div ref={ref} className="text-center">
            <p className="text-3xl font-bold text-neutral-900 dark:text-white font-mono">
                {count}{suffix}
            </p>
            <p className="text-sm text-neutral-500 mt-1">{label}</p>
        </div>
    )
}

// Allocation card component
const AllocationCard: React.FC<{
    title: string
    subtitle: string
    icon: React.ElementType
    iconBg: string
    iconColor: string
    children: React.ReactNode
}> = ({ title, subtitle, icon: Icon, iconBg, iconColor, children }) => (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${iconBg} flex items-center justify-center border border-neutral-200 dark:border-neutral-700/50`}>
                    <Icon size={18} className={iconColor} />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">{title}</h3>
            </div>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                {subtitle}
            </span>
        </div>
        {children}
    </div>
)

// Feature card component
const FeatureCard: React.FC<{
    icon: React.ElementType
    title: string
    description: string
    color: 'emerald' | 'purple' | 'blue'
}> = ({ icon: Icon, title, description, color }) => {
    const colorClasses = {
        emerald: 'from-emerald-500/20 to-emerald-600/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
        purple: 'from-purple-500/20 to-purple-600/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
        blue: 'from-blue-500/20 to-blue-600/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
    }
    const classes = colorClasses[color]
    
    return (
        <div className="text-left p-5 rounded-xl bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50 hover:border-neutral-300 dark:hover:border-neutral-600/50 transition-colors">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${classes} flex items-center justify-center mb-3 border`}>
                <Icon size={18} />
            </div>
            <h4 className="font-semibold text-neutral-900 dark:text-white mb-1">{title}</h4>
            <p className="text-sm text-neutral-500">{description}</p>
        </div>
    )
}

export default PublicPortfolio
