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
import api, { PublicPortfolioInsights } from '@/api'
import { useAuth } from '@/app/providers/AuthContext'
import { getFlagUrl } from '@/shared/lib/countryUtils'
import {
    getSectorIcon,
    getSectorColor,
    getIndustryIcon,
    getIndustryColor
} from '@/shared/lib/sectorIndustryUtils'
import AssetLogo from '@/shared/components/AssetLogo'
import '@/shared/design/pages/public-portfolio.css'

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
            <div className="public-portfolio-state">
                <div className="public-portfolio-state-inner">
                    <div className="public-portfolio-spinner">
                        <div className="public-portfolio-spinner-track" />
                        <div className="public-portfolio-spinner-arc" />
                        <div className="public-portfolio-spinner-icon">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                    </div>
                    <p>{t('publicPortfolio.loading')}</p>
                </div>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="public-portfolio-state">
                <div className="public-portfolio-error">
                    <div className="public-portfolio-error-icon">
                        <AlertTriangle className="h-8 w-8" />
                    </div>
                    <h2>{t('publicPortfolio.unavailable')}</h2>
                    <p>
                        {error || t('publicPortfolio.notFoundMessage')}
                    </p>
                    <Link
                        to="/register"
                        className="pf-button pf-button--primary"
                    >
                        <UserPlus size={20} />
                        {t('publicPortfolio.createYourOwn')}
                        <ArrowRight size={18} />
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
        <div className="public-portfolio-page">

            {/* Floating ticker bar */}
            <div className="public-portfolio-ticker">
                <div className="public-portfolio-ticker-track">
                    {[...data.holdings, ...data.holdings, ...data.holdings].map((h, i) => (
                        <span key={i} className="public-portfolio-ticker-item">
                            <span className="public-portfolio-ticker-symbol">{h.symbol}</span>
                            <span className="public-portfolio-ticker-dot">•</span>
                            <span className="public-portfolio-ticker-weight">{formatNumber(h.weight_pct, 1)}%</span>
                        </span>
                    ))}
                </div>
            </div>

            {/* Header */}
            <header className="public-portfolio-header">
                <div className="public-portfolio-header-inner">
                    <div className="public-portfolio-brand">
                        <img src="/favicon.svg" alt="Portfolium" />
                        <span>
                            Portfolium
                        </span>
                    </div>

                    <div className="public-portfolio-header-actions">
                        {/* Language Switcher */}
                        <div className="public-portfolio-lang-menu" ref={langMenuRef}>
                            <button
                                onClick={() => setLangMenuOpen(!langMenuOpen)}
                                className="public-portfolio-icon-button"
                                aria-label={t('navigation.changeLanguage')}
                            >
                                <img
                                    src={getFlagUrl(currentLanguage.country, 'w20') || ''}
                                    alt={currentLanguage.name}
                                    className="w-5 h-4 object-cover rounded-sm"
                                />
                                <ChevronDown size={14} style={{ transform: langMenuOpen ? 'rotate(180deg)' : undefined, transition: 'transform 160ms ease' }} />
                            </button>

                            {langMenuOpen && (
                                <div className="public-portfolio-lang-dropdown">
                                    {LANGUAGES.map((lang) => (
                                        <button
                                            key={lang.code}
                                            onClick={() => changeLanguage(lang.code)}
                                            className={`public-portfolio-lang-option ${i18n.language === lang.code ? 'is-active' : ''}`}
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
                            className="public-portfolio-icon-button"
                            aria-label={t('navigation.toggleDarkMode')}
                        >
                            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        {user ? (
                            <Link
                                to="/"
                                className="public-portfolio-cta-link pf-button pf-button--primary"
                            >
                                <LayoutDashboard size={16} />
                                {t('publicPortfolio.goToDashboard')}
                            </Link>
                        ) : (
                            <Link
                                to="/register"
                                className="public-portfolio-cta-link pf-button pf-button--primary"
                            >
                                <UserPlus size={16} />
                                {t('publicPortfolio.signUp')}
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            <main className="public-portfolio-main">
                {/* Hero Section - Asymmetric layout */}
                <section>
                    <div className="public-portfolio-hero">
                        {/* Left content */}
                        <div className="public-portfolio-hero-content">
                            {/* Badges */}
                            <div className="public-portfolio-badges">
                                <span className="public-portfolio-badge is-accent">
                                    <Eye size={12} />
                                    {t('publicPortfolio.publicSnapshot')}
                                </span>
                                <span className="public-portfolio-badge is-muted">
                                    <Lock size={12} />
                                    {t('publicPortfolio.amountsHidden')}
                                </span>
                            </div>

                            {/* Portfolio name */}
                            <div>
                                <p className="public-portfolio-shared-by">
                                    {t('publicPortfolio.sharedBy')} <strong>{data.owner_username}</strong>
                                </p>
                                <h1 className="public-portfolio-title">
                                    {data.portfolio_name}
                                </h1>
                            </div>

                            {/* Description */}
                            <p className="public-portfolio-description">
                                <Trans
                                    i18nKey="publicPortfolio.description"
                                    values={{ user: data.owner_username }}
                                    components={{ 1: <strong /> }}
                                />
                            </p>

                            {/* Stats row with animated counters */}
                            <div className="public-portfolio-stats">
                                <StatCounter value={holdingsCount} label={t('publicPortfolio.positions')} suffix="" />
                                <StatCounter value={sectorsCount} label={t('insights.sectorAllocation')} suffix="" />
                                <StatCounter value={marketsCount} label={t('insights.geographicAllocation')} suffix="" />
                            </div>

                            {/* CTA buttons */}
                            <div className="public-portfolio-cta-row">
                                {user ? (
                                    <Link
                                        to="/"
                                        className="pf-button pf-button--primary"
                                    >
                                        <LayoutDashboard size={20} />
                                        {t('publicPortfolio.goToDashboard')}
                                        <ArrowRight size={18} />
                                    </Link>
                                ) : (
                                    <Link
                                        to="/register"
                                        className="pf-button pf-button--primary"
                                    >
                                        <Zap size={20} />
                                        {t('publicPortfolio.createYourOwn')}
                                        <ArrowRight size={18} />
                                    </Link>
                                )}
                            </div>
                        </div>

                        {/* Right sidebar - Quick overview card */}
                        <div className="public-portfolio-overview-card">
                            <div className="public-portfolio-overview-header">
                                <h3>{t('publicPortfolio.quickOverview')}</h3>
                                <BarChart3 size={16} />
                            </div>

                            {/* Top sector */}
                            {topSector && (
                                <div className="public-portfolio-overview-block">
                                    <p className="public-portfolio-overview-label">{t('publicPortfolio.topSector')}</p>
                                    <div className="public-portfolio-overview-row">
                                        <div className="public-portfolio-overview-entity">
                                            {(() => {
                                                const Icon = getSectorIcon(topSector.sector)
                                                return <Icon className={`w-5 h-5 ${getSectorColor(topSector.sector)}`} />
                                            })()}
                                            <span>{t(`sectors.${topSector.sector}`, topSector.sector)}</span>
                                        </div>
                                        <span className="public-portfolio-overview-value">{formatNumber(topSector.percentage, 1)}%</span>
                                    </div>
                                    <div className="public-portfolio-meter">
                                        <div
                                            className="public-portfolio-meter-fill"
                                            style={{ width: `${topSector.percentage}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Top country */}
                            {topCountry && (
                                <div className="public-portfolio-overview-block">
                                    <p className="public-portfolio-overview-label">{t('publicPortfolio.mainExposure')}</p>
                                    <div className="public-portfolio-overview-row">
                                        <div className="public-portfolio-overview-entity">
                                            {getFlagUrl(topCountry.country) ? (
                                                <img src={getFlagUrl(topCountry.country) || ''} alt={topCountry.country} />
                                            ) : (
                                                <Globe size={18} />
                                            )}
                                            <span>{topCountry.country}</span>
                                        </div>
                                        <span className="public-portfolio-overview-value">{formatNumber(topCountry.percentage, 1)}%</span>
                                    </div>
                                    <div className="public-portfolio-meter">
                                        <div
                                            className="public-portfolio-meter-fill"
                                            style={{ width: `${topCountry.percentage}%` }}
                                        />
                                    </div>
                                </div>
                            )}
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
                    >
                        <div className="public-portfolio-allocation-rows">
                            {data.sector_allocation.map((item) => {
                                const SectorIcon = getSectorIcon(item.sector)
                                return (
                                    <div
                                        key={item.sector}
                                        className="public-portfolio-allocation-row"
                                    >
                                        <div className="public-portfolio-allocation-line">
                                            <span className="public-portfolio-allocation-label">
                                                <SectorIcon className={`w-4 h-4 ${getSectorColor(item.sector)}`} />
                                                {t(`sectors.${item.sector}`, item.sector)}
                                            </span>
                                            <span className="public-portfolio-allocation-value">
                                                {formatNumber(item.percentage, 1)}%
                                            </span>
                                        </div>
                                        <div className="public-portfolio-meter">
                                            <div
                                                className="public-portfolio-meter-fill"
                                                style={{ width: `${item.percentage}%` }}
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
                    >
                        <div className="public-portfolio-allocation-rows">
                            {data.geographic_allocation.map((item) => {
                                const flagUrl = getFlagUrl(item.country)
                                return (
                                    <div
                                        key={item.country}
                                        className="public-portfolio-allocation-row"
                                    >
                                        <div className="public-portfolio-allocation-line">
                                            <span className="public-portfolio-allocation-label">
                                                {flagUrl ? (
                                                    <img src={flagUrl} alt={item.country} />
                                                ) : (
                                                    <Globe size={16} />
                                                )}
                                                {item.country}
                                            </span>
                                            <span className="public-portfolio-allocation-value">
                                                {formatNumber(item.percentage, 1)}%
                                            </span>
                                        </div>
                                        <div className="public-portfolio-meter">
                                            <div
                                                className="public-portfolio-meter-fill"
                                                style={{ width: `${item.percentage}%` }}
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
                    <div className="public-portfolio-table-card">
                        <div className="public-portfolio-table-header">
                            <div>
                                <h3 className="public-portfolio-table-title">
                                    <div className="public-portfolio-card-icon">
                                        <TrendingUp size={18} />
                                    </div>
                                    {t('publicPortfolio.topHoldings')}
                                </h3>
                            </div>
                            <span className="public-portfolio-card-badge">
                                {data.holdings.length} {t('publicPortfolio.assets')}
                            </span>
                        </div>
                        
                        <div className="public-portfolio-table-scroll">
                            <table className="public-portfolio-table">
                                <thead>
                                    <tr>
                                        <th>{t('publicPortfolio.asset')}</th>
                                        <th className="hidden lg:table-cell">{t('publicPortfolio.country')}</th>
                                        <th className="hidden sm:table-cell">{t('publicPortfolio.sector')}</th>
                                        <th className="hidden md:table-cell">{t('publicPortfolio.industry')}</th>
                                        <th className="is-right">{t('publicPortfolio.weight')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.holdings.map((holding) => {
                                        const SectorIcon = getSectorIcon(holding.sector)
                                        const IndustryIcon = getIndustryIcon(holding.industry)
                                        return (
                                            <tr key={holding.symbol}>
                                                <td>
                                                    <div className="public-portfolio-holding-asset">
                                                        <AssetLogo
                                                            symbol={holding.symbol}
                                                            assetType={holding.asset_type}
                                                            assetName={holding.name}
                                                            alt={holding.symbol}
                                                            className="public-portfolio-holding-logo"
                                                        />
                                                        <div>
                                                            <p className="public-portfolio-holding-symbol">
                                                                {holding.symbol}
                                                            </p>
                                                            <p className="public-portfolio-holding-name">
                                                                {holding.name}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="hidden lg:table-cell">
                                                    {holding.country ? (
                                                        <span className="public-portfolio-holding-meta">
                                                            {getFlagUrl(holding.country) && (
                                                                <img
                                                                    src={getFlagUrl(holding.country, 'w20') || ''}
                                                                    alt={holding.country}
                                                                />
                                                            )}
                                                            <span>{holding.country}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="public-portfolio-holding-dash">—</span>
                                                    )}
                                                </td>
                                                <td className="hidden sm:table-cell">
                                                    {holding.sector ? (
                                                        <span className="public-portfolio-holding-meta">
                                                            <SectorIcon className={`w-4 h-4 ${getSectorColor(holding.sector)}`} />
                                                            <span>{t(`sectors.${holding.sector}`, holding.sector)}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="public-portfolio-holding-dash">—</span>
                                                    )}
                                                </td>
                                                <td className="hidden md:table-cell">
                                                    {holding.industry ? (
                                                        <span className="public-portfolio-holding-meta">
                                                            <IndustryIcon className={`w-4 h-4 ${getIndustryColor(holding.industry)}`} />
                                                            <span>{t(`industries.${holding.industry}`, holding.industry)}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="public-portfolio-holding-dash">—</span>
                                                    )}
                                                </td>
                                                <td className="is-right">
                                                    <div className="public-portfolio-weight-cell">
                                                        <div className="public-portfolio-weight-bar">
                                                            <div
                                                                className="public-portfolio-weight-bar-fill"
                                                                style={{ width: `${Math.min(holding.weight_pct * 2, 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className="public-portfolio-weight-value">
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
                <section>
                    <div className="public-portfolio-promo">
                        {/* Decorative background with floating asset cards */}
                        <div className="public-portfolio-promo-decor">
                            {/* Left side floating cards */}
                            <div className="absolute -left-20 top-1/2 -translate-y-1/2 flex flex-col gap-4 -rotate-12">
                                {data.holdings.slice(0, 5).map((h, i) => {
                                    return (
                                        <div
                                            key={`left-${i}`}
                                            className="public-portfolio-floating-card"
                                            style={{
                                                transform: `translateX(${i % 2 === 0 ? '20px' : '0px'})`,
                                            }}
                                        >
                                            <AssetLogo
                                                symbol={h.symbol}
                                                assetType={h.asset_type}
                                                assetName={h.name}
                                                alt={h.symbol}
                                            />
                                            <div>
                                                <p>{h.symbol}</p>
                                                <p>{h.name}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Right side floating cards */}
                            <div className="absolute -right-20 top-1/2 -translate-y-1/2 flex flex-col gap-4 rotate-12">
                                {data.holdings.slice(5, 10).map((h, i) => {
                                    return (
                                        <div
                                            key={`right-${i}`}
                                            className="public-portfolio-floating-card"
                                            style={{
                                                transform: `translateX(${i % 2 === 0 ? '-20px' : '0px'})`,
                                            }}
                                        >
                                            <AssetLogo
                                                symbol={h.symbol}
                                                assetType={h.asset_type}
                                                assetName={h.name}
                                                alt={h.symbol}
                                            />
                                            <div>
                                                <p>{h.symbol}</p>
                                                <p>{h.name}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Top floating logos row */}
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex gap-6">
                                {data.holdings.slice(0, 8).map((h, i) => {
                                    return (
                                        <div
                                            key={`top-${i}`}
                                            className="public-portfolio-floating-logo"
                                            style={{
                                                transform: `rotate(${(i - 4) * 5}deg) translateY(${Math.abs(i - 3.5) * 8}px)`,
                                            }}
                                        >
                                            <AssetLogo
                                                symbol={h.symbol}
                                                assetType={h.asset_type}
                                                assetName={h.name}
                                                alt={h.symbol}
                                            />
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Bottom floating logos row */}
                            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-6">
                                {data.holdings.slice(3, 11).map((h, i) => {
                                    return (
                                        <div
                                            key={`bottom-${i}`}
                                            className="public-portfolio-floating-logo"
                                            style={{
                                                transform: `rotate(${(i - 4) * -5}deg) translateY(${-Math.abs(i - 3.5) * 8}px)`,
                                            }}
                                        >
                                            <AssetLogo
                                                symbol={h.symbol}
                                                assetType={h.asset_type}
                                                assetName={h.name}
                                                alt={h.symbol}
                                            />
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Subtle radial fade overlay */}
                            <div className="public-portfolio-promo-fade" />
                        </div>

                        <div className="public-portfolio-promo-content">
                            {/* Icon */}
                            <div className="public-portfolio-promo-icon">
                                <Zap size={28} />
                            </div>

                            <h2 className="public-portfolio-promo-title">
                                {t('publicPortfolio.buildYourStory')}
                            </h2>

                            <p className="public-portfolio-promo-description">
                                {t('publicPortfolio.trackInvestments')}
                            </p>

                            {/* Feature grid */}
                            <div className="public-portfolio-feature-grid">
                                <FeatureCard
                                    icon={TrendingUp}
                                    title={t('publicPortfolio.featureRealtime')}
                                    description=""
                                    color="success"
                                />
                                <FeatureCard
                                    icon={Shield}
                                    title={t('publicPortfolio.featureDiversification')}
                                    description=""
                                    color="accent"
                                />
                                <FeatureCard
                                    icon={Eye}
                                    title={t('publicPortfolio.featurePrivacy')}
                                    description=""
                                    color="info"
                                />
                            </div>

                            {/* CTA button */}
                            {user ? (
                                <Link
                                    to="/"
                                    className="pf-button pf-button--primary"
                                >
                                    <LayoutDashboard size={24} />
                                    {t('publicPortfolio.goToDashboard')}
                                    <ChevronRight size={20} />
                                </Link>
                            ) : (
                                <Link
                                    to="/register"
                                    className="pf-button pf-button--primary"
                                >
                                    <UserPlus size={24} />
                                    {t('publicPortfolio.getStarted')}
                                    <ChevronRight size={20} />
                                </Link>
                            )}
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="public-portfolio-footer">
                <div className="public-portfolio-footer-inner">
                    <div className="public-portfolio-footer-brand">
                        <img src="/favicon.svg" alt="Portfolium" />
                        <span>Portfolium</span>
                    </div>
                    <div className="public-portfolio-footer-meta">
                        <a
                            href="https://github.com/ArthurMTX/Portfolium"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="GitHub"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                            </svg>
                        </a>
                        <p>
                            {t('publicPortfolio.disclaimer')} • {t('publicPortfolio.notAdvice')}
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    )
}

// Stat counter component with animation
const StatCounter: React.FC<{ value: number; label: string; suffix: string }> = ({ value, label, suffix }) => {
    const { count, ref } = useAnimatedCounter(value, 1200)
    return (
        <div ref={ref} className="public-portfolio-stat">
            <strong>
                {count}{suffix}
            </strong>
            <span>{label}</span>
        </div>
    )
}

// Allocation card component
const AllocationCard: React.FC<{
    title: string
    subtitle: string
    icon: React.ElementType
    children: React.ReactNode
}> = ({ title, subtitle, icon: Icon, children }) => (
    <div className="public-portfolio-card">
        <div className="public-portfolio-card-header">
            <div className="public-portfolio-card-heading">
                <div className="public-portfolio-card-icon">
                    <Icon size={18} />
                </div>
                <h3>{title}</h3>
            </div>
            <span className="public-portfolio-card-badge">
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
    color: 'success' | 'accent' | 'info'
}> = ({ icon: Icon, title, description, color }) => (
    <div className="public-portfolio-feature-card">
        <div className={`public-portfolio-feature-icon is-${color}`}>
            <Icon size={18} />
        </div>
        <h4>{title}</h4>
        <p>{description}</p>
    </div>
)

export default PublicPortfolio
