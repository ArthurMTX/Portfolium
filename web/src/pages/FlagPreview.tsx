import { useState, useMemo } from 'react';
import { Search, X, Flag, Globe } from 'lucide-react';

// Import the country code mapping from Assets.tsx
const getCountryCodeMapping = (): Record<string, string> => {
  return {
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
};

export default function FlagPreview() {
  const [searchQuery, setSearchQuery] = useState('');
  const [loadedFlags, setLoadedFlags] = useState<Set<string>>(new Set());
  const [failedFlags, setFailedFlags] = useState<Set<string>>(new Set());

  const countryMapping = useMemo(() => getCountryCodeMapping(), []);

  // Get unique countries (remove aliases/duplicates)
  const uniqueCountries = useMemo(() => {
    const seen = new Set<string>();
    const countries: Array<{ name: string; code: string }> = [];

    Object.entries(countryMapping).forEach(([name, code]) => {
      // Skip uppercase codes and prefer full names
      if (name === name.toUpperCase()) return;
      if (!seen.has(code)) {
        seen.add(code);
        countries.push({ name, code });
      }
    });

    return countries.sort((a, b) => a.name.localeCompare(b.name));
  }, [countryMapping]);

  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return uniqueCountries;
    
    const query = searchQuery.toLowerCase();
    return uniqueCountries.filter(
      (country) =>
        country.name.toLowerCase().includes(query) ||
        country.code.toLowerCase().includes(query)
    );
  }, [uniqueCountries, searchQuery]);

  const handleFlagLoad = (code: string) => {
    setLoadedFlags((prev) => new Set([...prev, code]));
    setFailedFlags((prev) => {
      const newSet = new Set(prev);
      newSet.delete(code);
      return newSet;
    });
  };

  const handleFlagError = (code: string) => {
    setFailedFlags((prev) => new Set([...prev, code]));
    setLoadedFlags((prev) => {
      const newSet = new Set(prev);
      newSet.delete(code);
      return newSet;
    });
  };

  const loadedCount = loadedFlags.size;
  const failedCount = failedFlags.size;
  const totalCount = uniqueCountries.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
          <Flag className="text-pink-600" size={28} />
          Country Flag Preview
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
          Preview all country flags displayed on the Assets and Insights pages
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 dark:text-neutral-500" size={18} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by country name or code..."
          className="w-full pl-10 pr-10 py-3 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {totalCount}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">Total Countries</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {loadedCount}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">Flags Loaded</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {failedCount}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">Failed to Load</div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {filteredCountries.length}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">Search Results</div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Globe className="text-blue-600 dark:text-blue-400 flex-shrink-0" size={20} />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">About Flag Display</p>
            <p className="text-blue-700 dark:text-blue-300">
              Flags are loaded from <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">flagcdn.com</code> CDN. 
              If a country doesn't have yfinance data or the flag fails to load, a 🌍 globe emoji is shown as fallback.
              The "Unknown" country also displays the globe emoji in both Assets and Insights pages.
            </p>
          </div>
        </div>
      </div>

      {/* Country Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {searchQuery ? `Found ${filteredCountries.length} country(ies)` : 'All Countries'}
          </h2>
        </div>

        {filteredCountries.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
            <p>No countries match your search</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-pink-600 dark:text-pink-400 hover:underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredCountries.map(({ name, code }) => (
              <div
                key={code}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 hover:shadow-lg transition-shadow"
              >
                <div className="flex flex-col items-center gap-3">
                  {/* Flag Display */}
                  <div className="w-full aspect-[4/3] flex items-center justify-center bg-neutral-50 dark:bg-neutral-800 rounded overflow-hidden">
                    {failedFlags.has(code) ? (
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-4xl">🌍</span>
                        <span className="text-xs text-red-600 dark:text-red-400">Failed</span>
                      </div>
                    ) : (
                      <img
                        src={`https://flagcdn.com/w80/${code}.png`}
                        srcSet={`https://flagcdn.com/w160/${code}.png 2x`}
                        alt={`${name} flag`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onLoad={() => handleFlagLoad(code)}
                        onError={() => handleFlagError(code)}
                      />
                    )}
                  </div>

                  {/* Country Info */}
                  <div className="w-full text-center">
                    <h3 className="font-medium text-sm text-neutral-900 dark:text-neutral-100 truncate" title={name}>
                      {name}
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-mono mt-1">
                      {code}
                    </p>
                    {loadedFlags.has(code) && (
                      <span className="inline-block mt-1 text-xs text-green-600 dark:text-green-400">
                        ✓ Loaded
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Special Cases */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
        <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2">
          <Globe className="text-amber-600 dark:text-amber-400" size={18} />
          Special Cases
        </h3>
        <div className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <span className="text-lg">🌍</span>
            <div>
              <strong>Unknown Country:</strong> Displays globe emoji (🌍) when country is "Unknown" or not available
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-lg">🌍</span>
            <div>
              <strong>Failed Flags:</strong> Falls back to globe emoji if flag image fails to load
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-mono text-xs bg-amber-100 dark:bg-amber-900 px-2 py-0.5 rounded">US</span>
            <div>
              <strong>Common Aliases:</strong> USA → us, UK → gb, UAE → ae, etc.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
