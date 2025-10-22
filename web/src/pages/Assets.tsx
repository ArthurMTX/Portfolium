import { useEffect, useState, useMemo, useCallback } from 'react';
import { Package, Building2, Briefcase, RefreshCw, ArrowUpDown, Archive, ChevronUp, ChevronDown, Shuffle, TrendingUp } from 'lucide-react';
import api from '../lib/api';
import AssetsCharts from '../components/AssetsCharts';
import SplitHistory from '../components/SplitHistory';
import TransactionHistory from '../components/TransactionHistory';
import EmptyPortfolioPrompt from '../components/EmptyPortfolioPrompt';
import EmptyTransactionsPrompt from '../components/EmptyTransactionsPrompt';
import usePortfolioStore from '../store/usePortfolioStore';

interface HeldAsset {
  id: number;
  symbol: string;
  name: string;
  currency: string;
  class: string;
  sector: string | null;
  industry: string | null;
  asset_type: string | null;
  total_quantity: number;
  portfolio_count: number;
  split_count?: number;
  transaction_count?: number;
  country?: string | null;
  created_at: string;
  updated_at: string;
}

const sortableColumns = [
  'symbol',
  'name',
  'class',
  'country',
  'asset_type',
  'sector',
  'industry',
  'total_quantity',
  'portfolio_count',
] as const
type SortKey = typeof sortableColumns[number]
type SortDir = 'asc' | 'desc';

export default function Assets() {

  const { portfolios } = usePortfolioStore()
  const [heldAssets, setHeldAssets] = useState<HeldAsset[]>([]);
  const [soldAssets, setSoldAssets] = useState<HeldAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('symbol');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showSold, setShowSold] = useState(true);
  const [splitHistoryAsset, setSplitHistoryAsset] = useState<{ id: number; symbol: string } | null>(null);
  const [transactionHistoryAsset, setTransactionHistoryAsset] = useState<{ id: number; symbol: string } | null>(null);

  const loadAssets = useCallback(async () => {
    try {
      setLoading(true);
      const [held, sold] = await Promise.all([
        api.getHeldAssets(),
        api.getSoldAssets()
      ]);
      setHeldAssets(held);
      setSoldAssets(sold);
      setError(null);
    } catch (err) {
      setError('Failed to load assets');
      console.error('Error loading assets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedAssets = useMemo(() => {
    let combined = [...heldAssets];
    if (showSold) {
      combined = [...heldAssets, ...soldAssets];
    }
    const keyTypes = {
      symbol: 'string',
      name: 'string',
      class: 'string',
      country: 'string',
      asset_type: 'string',
      sector: 'string',
      industry: 'string',
      total_quantity: 'number',
      portfolio_count: 'number',
    } as const satisfies Record<SortKey, 'string' | 'number'>

    const dir = sortDir === 'asc' ? 1 : -1

    return combined.sort((a, b) => {
      const aVal = a[sortKey as keyof HeldAsset] as string | number | null | undefined
      const bVal = b[sortKey as keyof HeldAsset] as string | number | null | undefined

      const aNull = aVal === null || aVal === undefined
      const bNull = bVal === null || bVal === undefined
      if (aNull && bNull) return 0
      if (aNull) return 1
      if (bNull) return -1

      if (keyTypes[sortKey] === 'string') {
        const sa = String(aVal).toLowerCase()
        const sb = String(bVal).toLowerCase()
        return sa.localeCompare(sb) * dir
      }

      const na = Number(aVal)
      const nb = Number(bVal)
      if (isNaN(na) && isNaN(nb)) return 0
      if (isNaN(na)) return 1
      if (isNaN(nb)) return -1
      return (na - nb) * dir
    });
  }, [heldAssets, soldAssets, showSold, sortKey, sortDir]);

  const handleEnrichAll = async () => {
    try {
      setEnriching(true);
      await api.enrichAllAssets();
      await loadAssets();
    } catch (err) {
      console.error('Error enriching assets:', err);
    } finally {
      setEnriching(false);
    }
  };

  // Normalize ticker by removing currency suffixes like -USD, -EUR, -USDT
  const normalizeTickerForLogo = (symbol: string): string => {
    return symbol.replace(/-(USD|EUR|GBP|USDT|BUSD|JPY|CAD|AUD|CHF|CNY)$/i, '')
  }

  const getAssetLogoUrl = (asset: HeldAsset) => {
    const normalizedSymbol = normalizeTickerForLogo(asset.symbol)
    const params = asset.asset_type?.toUpperCase() === 'ETF' ? '?asset_type=ETF' : ''
    return `/logos/${normalizedSymbol}${params}`
  };

  const getAssetClassColor = (assetClass: string) => {
    const colors: Record<string, string> = {
      'equity': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      'stock': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      'etf': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
      'bond': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
      'crypto': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
      'cryptocurrency': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
      'commodity': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
      'forex': 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
      'cash': 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300',
    };
    return colors[assetClass.toLowerCase()] || 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300';
  };

  const getAssetTypeColor = (assetType: string) => {
    const type = assetType ? assetType.trim().toLowerCase() : '';
    const colors: Record<string, string> = {
      'equity': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      'cryptocurrency': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
      'etf': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
      'common stock': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
      'stock': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
      'preferred stock': 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
      'adr': 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
      'fund': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
      'mutual fund': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
      'index fund': 'bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300',
      'reit': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
      'trust': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
      'derivative': 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
      'warrant': 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300',
      'unit': 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
    };
    return colors[type] || 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300';
  };

  const formatAssetType = (type: string | null) => {
    if (!type) return '-';
    if (type.trim().toLowerCase() === 'etf') return 'ETF';
    // Convert to title case and clean up
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const formatQuantity = (value: number) => {
    // Format with up to 8 decimals, then remove trailing zeros
    const formatted = value.toFixed(8);
    return formatted.replace(/\.?0+$/, '');
  };

  const getCountryCode = (country: string | null | undefined): string | null => {
    if (!country) return null;
    // ISO 3166-1 alpha-2 country codes, with common aliases
    const countryCodeMap: Record<string, string> = {
      'Afghanistan': 'af', 'AF': 'af',
      'Albania': 'al', 'AL': 'al',
      'Algeria': 'dz', 'DZ': 'dz',
      'Andorra': 'ad', 'AD': 'ad',
      'Angola': 'ao', 'AO': 'ao',
      'Antigua and Barbuda': 'ag', 'Antigua & Barbuda': 'ag', 'AG': 'ag',
      'Argentina': 'ar', 'AR': 'ar',
      'Armenia': 'am', 'AM': 'am',
      'Australia': 'au', 'AU': 'au',
      'Austria': 'at', 'AT': 'at',
      'Azerbaijan': 'az', 'AZ': 'az',
      'Bahamas': 'bs', 'BS': 'bs',
      'Bahrain': 'bh', 'BH': 'bh',
      'Bangladesh': 'bd', 'BD': 'bd',
      'Barbados': 'bb', 'BB': 'bb',
      'Belarus': 'by', 'BY': 'by',
      'Belgium': 'be', 'BE': 'be',
      'Belize': 'bz', 'BZ': 'bz',
      'Benin': 'bj', 'BJ': 'bj',
      'Bhutan': 'bt', 'BT': 'bt',
      'Bolivia': 'bo', 'BO': 'bo',
      'Bosnia and Herzegovina': 'ba', 'Bosnia & Herzegovina': 'ba', 'BA': 'ba',
      'Botswana': 'bw', 'BW': 'bw',
      'Brazil': 'br', 'BR': 'br',
      'Brunei': 'bn', 'BN': 'bn',
      'Bulgaria': 'bg', 'BG': 'bg',
      'Burkina Faso': 'bf', 'BF': 'bf',
      'Burundi': 'bi', 'BI': 'bi',
      'Cabo Verde': 'cv', 'Cape Verde': 'cv', 'CV': 'cv',
      'Cambodia': 'kh', 'KH': 'kh',
      'Cameroon': 'cm', 'CM': 'cm',
      'Canada': 'ca', 'CA': 'ca',
      'Central African Republic': 'cf', 'CF': 'cf',
      'Chad': 'td', 'TD': 'td',
      'Chile': 'cl', 'CL': 'cl',
      'China': 'cn', 'CN': 'cn',
      'Colombia': 'co', 'CO': 'co',
      'Comoros': 'km', 'KM': 'km',
      'Congo': 'cg', 'CG': 'cg',
      'Congo (Democratic Republic)': 'cd', 'Congo, Democratic Republic of the': 'cd', 'CD': 'cd',
      'Costa Rica': 'cr', 'CR': 'cr',
      'Cote d\'Ivoire': 'ci', 'Ivory Coast': 'ci', 'CI': 'ci',
      'Croatia': 'hr', 'HR': 'hr',
      'Cuba': 'cu', 'CU': 'cu',
      'Cyprus': 'cy', 'CY': 'cy',
      'Czech Republic': 'cz', 'Czechia': 'cz', 'CZ': 'cz',
      'Denmark': 'dk', 'DK': 'dk',
      'Djibouti': 'dj', 'DJ': 'dj',
      'Dominica': 'dm', 'DM': 'dm',
      'Dominican Republic': 'do', 'DO': 'do',
      'Ecuador': 'ec', 'EC': 'ec',
      'Egypt': 'eg', 'EG': 'eg',
      'El Salvador': 'sv', 'SV': 'sv',
      'Equatorial Guinea': 'gq', 'GQ': 'gq',
      'Eritrea': 'er', 'ER': 'er',
      'Estonia': 'ee', 'EE': 'ee',
      'Eswatini': 'sz', 'Swaziland': 'sz', 'SZ': 'sz',
      'Ethiopia': 'et', 'ET': 'et',
      'Fiji': 'fj', 'FJ': 'fj',
      'Finland': 'fi', 'FI': 'fi',
      'France': 'fr', 'FR': 'fr',
      'Gabon': 'ga', 'GA': 'ga',
      'Gambia': 'gm', 'GM': 'gm',
      'Georgia': 'ge', 'GE': 'ge',
      'Germany': 'de', 'DE': 'de',
      'Ghana': 'gh', 'GH': 'gh',
      'Greece': 'gr', 'GR': 'gr',
      'Grenada': 'gd', 'GD': 'gd',
      'Guatemala': 'gt', 'GT': 'gt',
      'Guinea': 'gn', 'GN': 'gn',
      'Guinea-Bissau': 'gw', 'GW': 'gw',
      'Guyana': 'gy', 'GY': 'gy',
      'Haiti': 'ht', 'HT': 'ht',
      'Honduras': 'hn', 'HN': 'hn',
      'Hungary': 'hu', 'HU': 'hu',
      'Iceland': 'is', 'IS': 'is',
      'India': 'in', 'IN': 'in',
      'Indonesia': 'id', 'ID': 'id',
      'Iran': 'ir', 'IR': 'ir',
      'Iraq': 'iq', 'IQ': 'iq',
      'Ireland': 'ie', 'IE': 'ie',
      'Israel': 'il', 'IL': 'il',
      'Italy': 'it', 'IT': 'it',
      'Jamaica': 'jm', 'JM': 'jm',
      'Japan': 'jp', 'JP': 'jp',
      'Jordan': 'jo', 'JO': 'jo',
      'Kazakhstan': 'kz', 'KZ': 'kz',
      'Kenya': 'ke', 'KE': 'ke',
      'Kiribati': 'ki', 'KI': 'ki',
      'Korea': 'kr', 'South Korea': 'kr', 'KR': 'kr',
      'North Korea': 'kp', 'KP': 'kp',
      'Kuwait': 'kw', 'KW': 'kw',
      'Kyrgyzstan': 'kg', 'KG': 'kg',
      'Laos': 'la', 'LA': 'la',
      'Latvia': 'lv', 'LV': 'lv',
      'Lebanon': 'lb', 'LB': 'lb',
      'Lesotho': 'ls', 'LS': 'ls',
      'Liberia': 'lr', 'LR': 'lr',
      'Libya': 'ly', 'LY': 'ly',
      'Liechtenstein': 'li', 'LI': 'li',
      'Lithuania': 'lt', 'LT': 'lt',
      'Luxembourg': 'lu', 'LU': 'lu',
      'Madagascar': 'mg', 'MG': 'mg',
      'Malawi': 'mw', 'MW': 'mw',
      'Malaysia': 'my', 'MY': 'my',
      'Maldives': 'mv', 'MV': 'mv',
      'Mali': 'ml', 'ML': 'ml',
      'Malta': 'mt', 'MT': 'mt',
      'Marshall Islands': 'mh', 'MH': 'mh',
      'Mauritania': 'mr', 'MR': 'mr',
      'Mauritius': 'mu', 'MU': 'mu',
      'Mexico': 'mx', 'MX': 'mx',
      'Micronesia': 'fm', 'FM': 'fm',
      'Moldova': 'md', 'MD': 'md',
      'Monaco': 'mc', 'MC': 'mc',
      'Mongolia': 'mn', 'MN': 'mn',
      'Montenegro': 'me', 'ME': 'me',
      'Morocco': 'ma', 'MA': 'ma',
      'Mozambique': 'mz', 'MZ': 'mz',
      'Myanmar': 'mm', 'Burma': 'mm', 'MM': 'mm',
      'Namibia': 'na', 'NA': 'na',
      'Nauru': 'nr', 'NR': 'nr',
      'Nepal': 'np', 'NP': 'np',
      'Netherlands': 'nl', 'NL': 'nl',
      'New Zealand': 'nz', 'NZ': 'nz',
      'Nicaragua': 'ni', 'NI': 'ni',
      'Niger': 'ne', 'NE': 'ne',
      'Nigeria': 'ng', 'NG': 'ng',
      'North Macedonia': 'mk', 'MK': 'mk',
      'Norway': 'no', 'NO': 'no',
      'Oman': 'om', 'OM': 'om',
      'Pakistan': 'pk', 'PK': 'pk',
      'Palau': 'pw', 'PW': 'pw',
      'Palestine': 'ps', 'PS': 'ps',
      'Panama': 'pa', 'PA': 'pa',
      'Papua New Guinea': 'pg', 'PG': 'pg',
      'Paraguay': 'py', 'PY': 'py',
      'Peru': 'pe', 'PE': 'pe',
      'Philippines': 'ph', 'PH': 'ph',
      'Poland': 'pl', 'PL': 'pl',
      'Portugal': 'pt', 'PT': 'pt',
      'Qatar': 'qa', 'QA': 'qa',
      'Romania': 'ro', 'RO': 'ro',
      'Russia': 'ru', 'Russian Federation': 'ru', 'RU': 'ru',
      'Rwanda': 'rw', 'RW': 'rw',
      'Saint Kitts and Nevis': 'kn', 'Saint Kitts & Nevis': 'kn', 'KN': 'kn',
      'Saint Lucia': 'lc', 'LC': 'lc',
      'Saint Vincent and the Grenadines': 'vc', 'Saint Vincent & the Grenadines': 'vc', 'VC': 'vc',
      'Samoa': 'ws', 'WS': 'ws',
      'San Marino': 'sm', 'SM': 'sm',
      'Sao Tome and Principe': 'st', 'Sao Tome & Principe': 'st', 'ST': 'st',
      'Saudi Arabia': 'sa', 'SA': 'sa',
      'Senegal': 'sn', 'SN': 'sn',
      'Serbia': 'rs', 'RS': 'rs',
      'Seychelles': 'sc', 'SC': 'sc',
      'Sierra Leone': 'sl', 'SL': 'sl',
      'Singapore': 'sg', 'SG': 'sg',
      'Slovakia': 'sk', 'SK': 'sk',
      'Slovenia': 'si', 'SI': 'si',
      'Solomon Islands': 'sb', 'SB': 'sb',
      'Somalia': 'so', 'SO': 'so',
      'South Africa': 'za', 'ZA': 'za',
      'South Sudan': 'ss', 'SS': 'ss',
      'Spain': 'es', 'ES': 'es',
      'Sri Lanka': 'lk', 'LK': 'lk',
      'Sudan': 'sd', 'SD': 'sd',
      'Suriname': 'sr', 'SR': 'sr',
      'Sweden': 'se', 'SE': 'se',
      'Switzerland': 'ch', 'CH': 'ch',
      'Syria': 'sy', 'SY': 'sy',
      'Tajikistan': 'tj', 'TJ': 'tj',
      'Tanzania': 'tz', 'TZ': 'tz',
      'Thailand': 'th', 'TH': 'th',
      'Timor-Leste': 'tl', 'East Timor': 'tl', 'TL': 'tl',
      'Togo': 'tg', 'TG': 'tg',
      'Tonga': 'to', 'TO': 'to',
      'Trinidad and Tobago': 'tt', 'Trinidad & Tobago': 'tt', 'TT': 'tt',
      'Tunisia': 'tn', 'TN': 'tn',
      'Turkey': 'tr', 'TR': 'tr',
      'Turkmenistan': 'tm', 'TM': 'tm',
      'Tuvalu': 'tv', 'TV': 'tv',
      'Uganda': 'ug', 'UG': 'ug',
      'Ukraine': 'ua', 'UA': 'ua',
      'United Arab Emirates': 'ae', 'UAE': 'ae', 'AE': 'ae',
      'United Kingdom': 'gb', 'UK': 'gb', 'GB': 'gb',
      'United States': 'us', 'USA': 'us', 'US': 'us',
      'Uruguay': 'uy', 'UY': 'uy',
      'Uzbekistan': 'uz', 'UZ': 'uz',
      'Vanuatu': 'vu', 'VU': 'vu',
      'Vatican City': 'va', 'Holy See': 'va', 'VA': 'va',
      'Venezuela': 've', 'VE': 've',
      'Vietnam': 'vn', 'VN': 'vn',
      'Yemen': 'ye', 'YE': 'ye',
      'Zambia': 'zm', 'ZM': 'zm',
      'Zimbabwe': 'zw', 'ZW': 'zw',
      'Hong Kong': 'hk', 'HK': 'hk',
      'Macau': 'mo', 'MO': 'mo',
      'Taiwan': 'tw', 'TW': 'tw',
      'Puerto Rico': 'pr', 'PR': 'pr',
      'Greenland': 'gl', 'GL': 'gl',
      'Gibraltar': 'gi', 'GI': 'gi',
      'Isle of Man': 'im', 'IM': 'im',
      'Jersey': 'je', 'JE': 'je',
      'Guernsey': 'gg', 'GG': 'gg',
      'Bermuda': 'bm', 'BM': 'bm',
      'Cayman Islands': 'ky', 'KY': 'ky',
      'British Virgin Islands': 'vg', 'Virgin Islands, British': 'vg', 'VG': 'vg',
      'US Virgin Islands': 'vi', 'Virgin Islands, U.S.': 'vi', 'VI': 'vi',
      'Anguilla': 'ai', 'AI': 'ai',
      'Aruba': 'aw', 'AW': 'aw',
      'Montserrat': 'ms', 'MS': 'ms',
      'Turks and Caicos Islands': 'tc', 'TC': 'tc',
      'Falkland Islands': 'fk', 'FK': 'fk',
      'Saint Pierre and Miquelon': 'pm', 'PM': 'pm',
      'Saint Helena': 'sh', 'SH': 'sh',
      'Saint Barthélemy': 'bl', 'BL': 'bl',
      'Saint Martin': 'mf', 'MF': 'mf',
      'Sint Maarten': 'sx', 'SX': 'sx',
      'Bonaire': 'bq', 'BQ': 'bq',
      'Curacao': 'cw', 'CW': 'cw',
      'Svalbard and Jan Mayen': 'sj', 'SJ': 'sj',
      'Faroe Islands': 'fo', 'FO': 'fo',
      'French Guiana': 'gf', 'GF': 'gf',
      'French Polynesia': 'pf', 'PF': 'pf',
      'French Southern Territories': 'tf', 'TF': 'tf',
      'Guadeloupe': 'gp', 'GP': 'gp',
      'Martinique': 'mq', 'MQ': 'mq',
      'Mayotte': 'yt', 'YT': 'yt',
      'New Caledonia': 'nc', 'NC': 'nc',
      'Reunion': 're', 'RE': 're',
      'Saint Martin (French part)': 'mf',
      'Saint Pierre & Miquelon': 'pm',
      'Wallis and Futuna': 'wf', 'WF': 'wf',
      'French Antilles': 'gp',
      'Caribbean Netherlands': 'bq',
      'Kosovo': 'xk', 'XK': 'xk',
      'Palestinian Territories': 'ps',
      'Western Sahara': 'eh', 'EH': 'eh',
      'Antarctica': 'aq', 'AQ': 'aq',
      'Heard Island and McDonald Islands': 'hm', 'HM': 'hm',
      'South Georgia and the South Sandwich Islands': 'gs', 'GS': 'gs',
      'Bouvet Island': 'bv', 'BV': 'bv',
      'Pitcairn Islands': 'pn', 'PN': 'pn',
      'Norfolk Island': 'nf', 'NF': 'nf',
      'Niue': 'nu', 'NU': 'nu',
      'Cook Islands': 'ck', 'CK': 'ck',
      'Tokelau': 'tk', 'TK': 'tk',
      'American Samoa': 'as', 'AS': 'as',
      'Guam': 'gu', 'GU': 'gu',
      'Northern Mariana Islands': 'mp', 'MP': 'mp',
      'Micronesia (Federated States of)': 'fm',
      'Wallis and Futuna Islands': 'wf',
    };
    return countryCodeMap[country] || null;
  };

  const isActive = (key: SortKey) => sortKey === key;
  const SortIcon = ({ col }: { col: SortKey }) => {
    const active = isActive(col);
    if (!active) return <ArrowUpDown size={14} className="inline ml-1 opacity-40" />;
    return sortDir === 'asc' 
      ? <ChevronUp size={14} className="inline ml-1 opacity-80" />
      : <ChevronDown size={14} className="inline ml-1 opacity-80" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
      </div>
    );
  }

  if (portfolios.length === 0) {
    return <EmptyPortfolioPrompt pageType="assets" />
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">{error}</p>
        <button
          onClick={loadAssets}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Check for empty state before rendering anything */}
      {heldAssets.length === 0 && (!showSold || soldAssets.length === 0) ? (
        <EmptyTransactionsPrompt pageType="assets" />
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Package className="text-pink-600" size={32} />
                Assets
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 mt-1">
                {showSold
                  ? 'Held and sold assets across all portfolios'
                  : 'Currently held assets across all portfolios'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSold(!showSold)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  showSold 
                    ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 hover:bg-pink-200 dark:hover:bg-pink-800' 
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                <Archive size={18} />
                {showSold ? 'Hide Sold' : 'Show Sold'}
              </button>
              <button
                onClick={handleEnrichAll}
                disabled={enriching}
                className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw size={18} className={enriching ? 'animate-spin' : ''} />
                {enriching ? 'Enriching...' : 'Enrich Metadata'}
              </button>
            </div>
          </div>

          {/* Assets Table */}
          <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <tr>
                  <th 
                    onClick={() => handleSort('symbol')}
                    aria-sort={isActive('symbol') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Symbol <SortIcon col="symbol" />
                  </th>
                  <th 
                    onClick={() => handleSort('name')}
                    aria-sort={isActive('name') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Name <SortIcon col="name" />
                  </th>
                  <th 
                    onClick={() => handleSort('class')}
                    aria-sort={isActive('class') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Class <SortIcon col={"class"} />
                  </th>
                  <th 
                    onClick={() => handleSort('asset_type')}
                    aria-sort={isActive('asset_type') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Type <SortIcon col="asset_type" />
                  </th>
                  <th 
                    onClick={() => handleSort('country')}
                    aria-sort={isActive('country') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Country <SortIcon col="country" />
                  </th>
                  <th 
                    onClick={() => handleSort('sector')}
                    aria-sort={isActive('sector') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Sector <SortIcon col="sector" />
                  </th>
                  <th 
                    onClick={() => handleSort('industry')}
                    aria-sort={isActive('industry') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Industry <SortIcon col="industry" />
                  </th>
                  <th 
                    onClick={() => handleSort('total_quantity')}
                    aria-sort={isActive('total_quantity') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Quantity <SortIcon col="total_quantity" />
                  </th>
                  <th 
                    onClick={() => handleSort('portfolio_count')}
                    aria-sort={isActive('portfolio_count') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Portfolios <SortIcon col="portfolio_count" />
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {sortedAssets.map((asset) => (
                  <tr key={asset.id} className={`hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors ${asset.total_quantity === 0 ? 'opacity-60 bg-neutral-50 dark:bg-neutral-900' : ''}`}> 
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                          <img
                            src={getAssetLogoUrl(asset)}
                            alt={asset.symbol}
                            loading="lazy"
                            className="w-8 h-8 object-contain"
                            onError={(e) => {
                              const img = e.currentTarget as HTMLImageElement
                              if (!img.dataset.resolverTried) {
                                // Final fallback: ask backend to resolve best brand logo
                                img.dataset.resolverTried = 'true'
                                const params = new URLSearchParams()
                                if (asset.name) params.set('name', asset.name)
                                if (asset.asset_type) params.set('asset_type', asset.asset_type)
                                fetch(`/api/assets/logo/${asset.symbol}?${params.toString()}`, { redirect: 'follow' })
                                  .then((res) => {
                                    if (res.redirected) {
                                      img.src = res.url
                                    } else if (res.ok) {
                                      // Some environments may not expose redirected flag; try blob
                                      return res.blob().then((blob) => {
                                        img.src = URL.createObjectURL(blob)
                                      })
                                    } else {
                                      img.style.display = 'none'
                                    }
                                  })
                                  .catch(() => {
                                    img.style.display = 'none'
                                  })
                              } else {
                                img.style.display = 'none'
                              }
                            }}
                          />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                            {asset.symbol}
                          </div>
                          <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            {asset.currency}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-neutral-700 dark:text-neutral-300 max-w-xs">
                        {asset.name || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${asset.class ? getAssetClassColor(asset.class) : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'}`}>
                        {asset.class ? asset.class.charAt(0).toUpperCase() + asset.class.slice(1).toLowerCase() : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${asset.asset_type ? getAssetTypeColor(asset.asset_type) : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'}`}>
                        {formatAssetType(asset.asset_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {asset.country ? (
                        <div className="flex items-center gap-2">
                          {getCountryCode(asset.country) ? (
                            <img
                              src={`https://flagcdn.com/w40/${getCountryCode(asset.country)}.png`}
                              alt={`${asset.country} flag`}
                              loading="lazy"
                              className="w-6 h-4 object-cover rounded shadow-sm"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="text-lg">🌍</span>
                          )}
                          <span className="text-sm text-neutral-700 dark:text-neutral-300">
                            {asset.country}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-neutral-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm flex items-center gap-2">
                        {asset.sector ? (
                          <>
                            <Building2 size={14} className="text-neutral-400" />
                            {asset.sector}
                          </>
                        ) : (
                          '-'
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm flex items-center gap-2">
                        {asset.industry ? (
                          <>
                            <Briefcase size={14} className="text-neutral-400" />
                            {asset.industry}
                          </>
                        ) : (
                          '-'
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium">
                        {formatQuantity(asset.total_quantity)}
                        {asset.total_quantity === 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 ml-2">
                            Sold
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm">{asset.portfolio_count}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(asset.transaction_count ?? 0) > 0 && (
                          <button
                            onClick={() => setTransactionHistoryAsset({ id: asset.id, symbol: asset.symbol })}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded transition-colors inline-flex items-center gap-1"
                            title={`View Transaction History (${asset.transaction_count} transaction${asset.transaction_count! > 1 ? 's' : ''})`}
                          >
                            <TrendingUp size={16} />
                            <span className="text-xs">{asset.transaction_count}</span>
                          </button>
                        )}
                        {(asset.split_count ?? 0) > 0 && (
                          <button
                            onClick={() => setSplitHistoryAsset({ id: asset.id, symbol: asset.symbol })}
                            className="p-2 text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20 rounded transition-colors inline-flex items-center gap-1"
                            title={`View Split History (${asset.split_count} split${asset.split_count! > 1 ? 's' : ''})`}
                          >
                            <Shuffle size={16} />
                            <span className="text-xs">{asset.split_count}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>

          {/* Charts - Bottom Section - Only show for held assets */}
          <div className="pt-4">
            <h2 className="text-xl font-semibold mb-4 text-neutral-900 dark:text-neutral-100">
              Asset Distribution
            </h2>
            <AssetsCharts assets={sortedAssets} />
          </div>
        </>
      )}

      {/* Split History Modal */}
      {splitHistoryAsset && (
        <SplitHistory
          assetId={splitHistoryAsset.id}
          assetSymbol={splitHistoryAsset.symbol}
          onClose={() => setSplitHistoryAsset(null)}
        />
      )}

      {/* Transaction History Modal */}
      {transactionHistoryAsset && (
        <TransactionHistory
          assetId={transactionHistoryAsset.id}
          assetSymbol={transactionHistoryAsset.symbol}
          onClose={() => setTransactionHistoryAsset(null)}
        />
      )}
    </div>
  );
}