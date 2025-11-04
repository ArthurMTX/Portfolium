/**
 * Sector and Industry Utilities
 * 
 * This file provides comprehensive utilities for working with sectors and industries from Yahoo Finance,
 * including icon mappings, color schemes, and hierarchical relationships.
 */

import {
  // Technology & Communication
  Cpu,
  Smartphone,
  Laptop,
  Wifi,
  Radio,
  Monitor,
  Globe,
  Network,
  Server,
  HardDrive,
  Microchip,
  Gamepad,
  MemoryStick,
  
  // Healthcare & Pharmaceuticals
  Heart,
  Pill,
  Stethoscope,
  Syringe,
  Activity,
  Microscope,
  FlaskConical,
  Dna,
  BriefcaseMedical,
  PillBottle,
  HeartPlus,
  Cross,
  Hospital,
  
  // Financial Services
  DollarSign,
  CreditCard,
  Landmark,
  Building2,
  Coins,
  TrendingUp,
  
  // Energy & Utilities
  Zap,
  Flame,
  Droplet,
  Wind,
  Sun,
  Lightbulb,
  Plug,
  
  // Consumer & Retail
  ShoppingCart,
  ShoppingBag,
  Store,
  Home,
  Shirt,
  Wine,
  Pizza,
  Car,
  Sofa,
  Watch,
  
  // Industrial & Manufacturing
  Factory,
  HardHat,
  Boxes,
  Package,
  Wrench,
  Hammer,
  Cog,
  
  // Materials & Mining
  Mountain,
  Diamond,
  Gem,
  
  // Real Estate
  Building,
  Hotel,
  HomeIcon,
  Warehouse,
  
  // Transportation
  Ship,
  Train,
  Truck,
  
  // Agriculture & Food
  Wheat,
  TreePine,
  Leaf,
  
  // Media & Entertainment
  Film,
  Tv,
  Newspaper,
  Camera,
  
  // Defense & Aerospace
  Shield,
  Rocket,
  
  // Miscellaneous
  Briefcase,
  GraduationCap,
  FileText,
  
  // Fallback
  HelpCircle,
  Drill,
  Radiation,
  Fuel,
  CarFront,
  CarTaxiFront,
  ShoppingBasket,
  TicketsPlane,
  Volleyball,
  Apple,
  Container,
  CupSoda,
  Beer,
  Cigarette,
  Lamp,
  ChartCandlestick,
  LandPlot,
  BadgeDollarSign,
  TrendingUpDown,
  ShieldPlus,
  ShieldQuestionMark,
  ShieldEllipsis,
  Rss,
  PlaneTakeoff,
  PlaneLanding,
  Anvil,
  Handshake,
  Cable,
  Users,
  Tractor,
  BrickWallShield,
  WashingMachine,
  PencilRuler,
  Forklift,
  Trash,
  MessageCircleQuestionMark,
  TicketPercent,
  DropletOff,
  BrickWall,
  Atom,
  FlaskRound,
  Pickaxe,
  Cuboid,
  HouseHeart,
  HousePlug,
  HouseWifi,
  HousePlus,
  BadgeQuestionMark
} from 'lucide-react';

import { LucideIcon } from 'lucide-react';

/**
 * Industry configuration with sector, icon, and example ticker
 */
interface IndustryConfig {
  sector: string;
  icon: LucideIcon;
  exampleTicker?: string;
  exampleName?: string;
}

/**
 * Master industry configuration
 * Single source of truth for all industry-to-sector-to-icon mappings
 */
const INDUSTRY_CONFIG: Record<string, IndustryConfig> = {
  // Technology
  'Information Technology Services': { sector: 'Technology', icon: Network, exampleTicker: 'IBM', exampleName: 'International Business Machines Corporation' },
  'Software - Application': { sector: 'Technology', icon: Laptop, exampleTicker: 'MSFT', exampleName: 'Microsoft Corporation' },
  'Software - Infrastructure': { sector: 'Technology', icon: Server, exampleTicker: 'CRM', exampleName: 'Salesforce, Inc.' },
  'Computer Hardware': { sector: 'Technology', icon: Monitor, exampleTicker: 'ANET', exampleName: 'Arista Networks Inc' },
  'Consumer Electronics': { sector: 'Technology', icon: Smartphone, exampleTicker: 'AAPL', exampleName: 'Apple Inc.' },
  'Communication Equipment': { sector: 'Technology', icon: Wifi, exampleTicker: 'CSCO', exampleName: 'Cisco Systems, Inc.' },
  'Electronic Components': { sector: 'Technology', icon: Cpu, exampleTicker: 'APH', exampleName: 'Amphenol Corporation' },
  'Electronics & Computer Distribution': { sector: 'Technology', icon: HardDrive, exampleTicker: 'SNX', exampleName: 'TD SYNNEX Corporation' },
  'Scientific & Technical Instruments': { sector: 'Technology', icon: Microscope, exampleTicker: 'GRMN', exampleName: 'Garmin Ltd.' },
  'Semiconductors': { sector: 'Technology', icon: Microchip, exampleTicker: 'NVDA', exampleName: 'NVIDIA Corporation' },
  'Semiconductor Equipment & Materials': { sector: 'Technology', icon: MemoryStick, exampleTicker: 'LRCX', exampleName: 'Lam Research Corporation' },
  'Solar': { sector: 'Technology', icon: Sun, exampleTicker: 'FSLR', exampleName: 'First Solar, Inc.' },

  // Communication Services
  'Internet Content & Information': { sector: 'Communication Services', icon: Rss, exampleTicker: 'GOOGL', exampleName: 'Alphabet Inc.' },
  'Telecom Services': { sector: 'Communication Services', icon: Radio, exampleTicker: 'TMUS', exampleName: 'T-Mobile US, Inc.' },
  'Entertainment': { sector: 'Communication Services', icon: Tv, exampleTicker: 'NFLX', exampleName: 'Netflix, Inc.' },
  'Broadcasting': { sector: 'Communication Services', icon: Radio, exampleTicker: 'NXST', exampleName: 'Nexstar Media Group, Inc.' },
  'Electronic Gaming & Multimedia': { sector: 'Communication Services', icon: Gamepad, exampleTicker: 'RBLX', exampleName: 'Roblox Corporation' },
  'Publishing': { sector: 'Communication Services', icon: Newspaper, exampleTicker: 'NYT', exampleName: 'The New York Times Company' },
  'Advertising Agencies': { sector: 'Communication Services', icon: Camera, exampleTicker: 'APP', exampleName: 'AppLovin Corporation' },

  // Healthcare
  'Biotechnology': { sector: 'Healthcare', icon: Dna, exampleTicker: 'VRTX', exampleName: 'Vertex Pharmaceuticals Incorporated' },
  'Pharmaceutical Retailers': { sector: 'Healthcare', icon: Cross, exampleTicker: 'CVS', exampleName: 'CVS Health Corporation' },
  'Drug Manufacturers - General': { sector: 'Healthcare', icon: Pill, exampleTicker: 'LLY', exampleName: 'Eli Lilly and Company' },
  'Drug Manufacturers - Specialty & Generic': { sector: 'Healthcare', icon: PillBottle, exampleTicker: 'JDHIY', exampleName: 'JD Health International Inc.' },
  'Medical Devices': { sector: 'Healthcare', icon: Stethoscope, exampleTicker: 'ABT', exampleName: 'Abbott Laboratories' },
  'Medical Instruments & Supplies': { sector: 'Healthcare', icon: Syringe, exampleTicker: 'ISRG', exampleName: 'Intuitive Surgical, Inc.' },
  'Medical Care Facilities': { sector: 'Healthcare', icon: Hospital, exampleTicker: 'HCA', exampleName: 'HCA Healthcare, Inc.' },
  'Medical Distribution': { sector: 'Healthcare', icon: BriefcaseMedical, exampleTicker: 'MCK', exampleName: 'McKesson Corporation' },
  'Diagnostics & Research': { sector: 'Healthcare', icon: FlaskConical, exampleTicker: 'TMO', exampleName: 'Thermo Fisher Scientific Inc.' },
  'Health Information Services': { sector: 'Healthcare', icon: Activity, exampleTicker: 'VEEV', exampleName: 'Veeva Systems Inc.' },
  'Healthcare Plans': { sector: 'Healthcare', icon: HeartPlus, exampleTicker: 'UNH', exampleName: 'UnitedHealth Group Incorporated' },
  
  // Financial Services
  'Banks - Diversified': { sector: 'Financial Services', icon: Landmark, exampleTicker: 'JPM', exampleName: 'JPMorgan Chase & Co.' },
  'Banks - Regional': { sector: 'Financial Services', icon: Building2, exampleTicker: 'NU', exampleName: 'NuBank' },
  'Asset Management': { sector: 'Financial Services', icon: TrendingUp, exampleTicker: 'BX', exampleName: 'Blackstone Inc.' },
  'Capital Markets': { sector: 'Financial Services', icon: ChartCandlestick, exampleTicker: 'GS', exampleName: 'Goldman Sachs Group, Inc.' },
  'Financial Data & Stock Exchanges': { sector: 'Financial Services', icon: Coins, exampleTicker: 'SPGI', exampleName: 'S&P Global Inc.' },
  'Credit Services': { sector: 'Financial Services', icon: CreditCard, exampleTicker: 'V', exampleName: 'Visa Inc.' },
  'Insurance - Diversified': { sector: 'Financial Services', icon: Shield, exampleTicker: 'BRK-B', exampleName: 'Berkshire Hathaway Inc.' },
  'Insurance - Life': { sector: 'Financial Services', icon: ShieldPlus, exampleTicker: 'AFL', exampleName: 'Aflac Incorporated' },
  'Insurance - Property & Casualty': { sector: 'Financial Services', icon: LandPlot, exampleTicker: 'PGR', exampleName: 'The Progressive Corporation' },
  'Insurance - Specialty': { sector: 'Financial Services', icon: ShieldQuestionMark, exampleTicker: 'FNF', exampleName: 'Fidelity National Financial, Inc.' },
  'Insurance - Reinsurance': { sector: 'Financial Services', icon: ShieldEllipsis, exampleTicker: 'EG', exampleName: 'Everest Group, Ltd.' },
  'Mortgage Finance': { sector: 'Financial Services', icon: HomeIcon, exampleTicker: 'FNMA', exampleName: 'Federal National Mortgage Association' },
  'Insurance Brokers': { sector: 'Financial Services', icon: BadgeDollarSign, exampleTicker: 'MMC', exampleName: 'Marsh & McLennan Companies, Inc.' },
  'Financial Conglomerates': { sector: 'Financial Services', icon: DollarSign, exampleTicker: 'FRHC', exampleName: 'Freedom Holding Corp.' },
  'Shell Companies': { sector: 'Financial Services', icon: TrendingUpDown, exampleTicker: 'CCCX', exampleName: 'Churchill Capital Corp X' },

  // Energy
  'Oil & Gas E&P': { sector: 'Energy', icon: Fuel, exampleTicker: 'COP', exampleName: 'ConocoPhillips' },
  'Oil & Gas Integrated': { sector: 'Energy', icon: Zap, exampleTicker: 'XOM', exampleName: 'Exxon Mobil Corporation' },
  'Oil & Gas Midstream': { sector: 'Energy', icon: Droplet, exampleTicker: 'WMB', exampleName: 'Williams Companies, Inc.' },
  'Oil & Gas Refining & Marketing': { sector: 'Energy', icon: Flame, exampleTicker: 'MPC', exampleName: 'Marathon Petroleum Corporation' },
  'Oil & Gas Drilling': { sector: 'Energy', icon: Drill, exampleTicker: 'NE', exampleName: 'Noble Corporation' },
  'Oil & Gas Equipment & Services': { sector: 'Energy', icon: Wrench, exampleTicker: 'SLB', exampleName: 'SLB N.V.' },
  'Thermal Coal': { sector: 'Energy', icon: Mountain, exampleTicker: 'CNR', exampleName: 'Core Natural Resources, Inc.' },
  'Uranium': { sector: 'Energy', icon: Radiation, exampleTicker: 'UEC', exampleName: 'Uranium Energy Corp.' },

  // Utilities
  'Utilities - Diversified': { sector: 'Utilities', icon: Lightbulb, exampleTicker: 'SRE', exampleName: 'Sempra Energy' },
  'Utilities - Independent Power Producers': { sector: 'Utilities', icon: Zap, exampleTicker: 'CEG', exampleName: 'Constellation Energy Corporation' },
  'Utilities - Regulated Electric': { sector: 'Utilities', icon: Plug, exampleTicker: 'NEE', exampleName: 'NextEra Energy, Inc.' },
  'Utilities - Regulated Gas': { sector: 'Utilities', icon: Flame, exampleTicker: 'ATO', exampleName: 'Atmos Energy Corporation' },
  'Utilities - Regulated Water': { sector: 'Utilities', icon: Droplet, exampleTicker: 'AWK', exampleName: 'American Water Works Company, Inc.' },
  'Utilities - Renewable': { sector: 'Utilities', icon: Wind, exampleTicker: 'ORA', exampleName: 'Ormat Technologies, Inc.' },
  
  // Consumer Cyclical
  'Auto Manufacturers': { sector: 'Consumer Cyclical', icon: Car, exampleTicker: 'TSLA', exampleName: 'Tesla, Inc.' },
  'Auto Parts': { sector: 'Consumer Cyclical', icon: Cog, exampleTicker: 'ORLY', exampleName: 'O\'Reilly Automotive, Inc.' },
  'Recreational Vehicles': { sector: 'Consumer Cyclical', icon: CarFront, exampleTicker: 'THO', exampleName: 'Thor Industries, Inc.' },
  'Auto & Truck Dealerships': { sector: 'Consumer Cyclical', icon: CarTaxiFront, exampleTicker: 'CVNA', exampleName: 'Carvana Co.' },
  'Department Stores': { sector: 'Consumer Cyclical', icon: ShoppingBasket, exampleTicker: 'DDS', exampleName: 'Dillard\'s, Inc.' },
  'Apparel Manufacturing': { sector: 'Consumer Cyclical', icon: Shirt, exampleTicker: 'RL', exampleName: 'Ralph Lauren Corporation' },
  'Apparel Retail': { sector: 'Consumer Cyclical', icon: ShoppingBag, exampleTicker: 'TJX', exampleName: 'TJX Companies, Inc.' },
  'Footwear & Accessories': { sector: 'Consumer Cyclical', icon: Watch, exampleTicker: 'NKE', exampleName: 'Nike, Inc.' },
  'Home Improvement Retail': { sector: 'Consumer Cyclical', icon: Home, exampleTicker: 'HD', exampleName: 'Home Depot, Inc.' },
  'Specialty Retail': { sector: 'Consumer Cyclical', icon: Store, exampleTicker: 'TSCO', exampleName: 'Tractor Supply Company' },
  'Internet Retail': { sector: 'Consumer Cyclical', icon: Globe, exampleTicker: 'AMZN', exampleName: 'Amazon.com, Inc.' },
  'Luxury Goods': { sector: 'Consumer Cyclical', icon: Diamond, exampleTicker: 'TPR', exampleName: 'Tapestry, Inc.' },
  'Furnishings, Fixtures & Appliances': { sector: 'Consumer Cyclical', icon: Sofa, exampleTicker: 'SGI', exampleName: 'Somnigroup International Inc.' },
  'Residential Construction': { sector: 'Consumer Cyclical', icon: Building, exampleTicker: 'DHI', exampleName: 'D.R. Horton, Inc.' },
  'Restaurants': { sector: 'Consumer Cyclical', icon: Pizza, exampleTicker: 'MCD', exampleName: 'McDonald\'s Corporation' },
  'Lodging': { sector: 'Consumer Cyclical', icon: Hotel, exampleTicker: 'MAR', exampleName: 'Marriott International, Inc.' },
  'Resorts & Casinos': { sector: 'Consumer Cyclical', icon: Building2, exampleTicker: 'LVS', exampleName: 'Las Vegas Sands Corp.' },
  'Travel Services': { sector: 'Consumer Cyclical', icon: TicketsPlane, exampleTicker: 'BKNG', exampleName: 'Booking Holdings Inc.' },
  'Leisure': { sector: 'Consumer Cyclical', icon: Film, exampleTicker: 'AS', exampleName: 'Amer Sports, Inc.' },
  'Gambling': { sector: 'Consumer Cyclical', icon: Coins, exampleTicker: 'FLUT', exampleName: 'Flutter Entertainment plc' },
  'Textile Manufacturing': { sector: 'Consumer Cyclical', icon: Volleyball, exampleTicker: 'AIN', exampleName: 'Albany International Corp.' },
  'Packaging & Containers': { sector: 'Consumer Cyclical', icon: Boxes, exampleTicker: 'IP', exampleName: 'International Paper Company' },
  'Personal Services': { sector: 'Consumer Cyclical', icon: Briefcase, exampleTicker: 'ROL', exampleName: 'Rollins, Inc.' },
  
  // Consumer Defensive
  'Discount Stores': { sector: 'Consumer Cyclical', icon: ShoppingCart, exampleTicker: 'WMT', exampleName: 'Walmart Inc.' },
  'Beverages - Non-Alcoholic': { sector: 'Consumer Defensive', icon: CupSoda, exampleTicker: 'KO', exampleName: 'The Coca-Cola Company' },
  'Beverages - Brewers': { sector: 'Consumer Defensive', icon: Beer, exampleTicker: 'STZ', exampleName: 'Constellation Brands, Inc.' },
  'Beverages - Wineries & Distilleries': { sector: 'Consumer Defensive', icon: Wine, exampleTicker: 'BF-B', exampleName: 'Brown-Forman Corporation' },
  'Confectioners': { sector: 'Consumer Defensive', icon: Container, exampleTicker: 'MDLZ', exampleName: 'Mondelez International, Inc.' },
  'Farm Products': { sector: 'Consumer Defensive', icon: Wheat, exampleTicker: 'ADM', exampleName: 'Archer-Daniels-Midland Company' },
  'Food Distribution': { sector: 'Consumer Defensive', icon: Truck, exampleTicker: 'SYY', exampleName: 'Sysco Corporation' },
  'Grocery Stores': { sector: 'Consumer Defensive', icon: Apple, exampleTicker: 'KR', exampleName: 'The Kroger Co.' },
  'Packaged Foods': { sector: 'Consumer Defensive', icon: Package, exampleTicker: 'K', exampleName: 'Kellanova' },
  'Education & Training Services': { sector: 'Consumer Defensive', icon: GraduationCap, exampleTicker: 'LOPE', exampleName: 'Grand Canyon Education, Inc.' },
  'Household & Personal Products': { sector: 'Consumer Defensive', icon: Lamp, exampleTicker: 'PG', exampleName: 'The Procter & Gamble Company' },
  'Tobacco': { sector: 'Consumer Defensive', icon: Cigarette, exampleTicker: 'PM', exampleName: 'Philip Morris International Inc.' },

  // Industrials
  'Aerospace & Defense': { sector: 'Industrials', icon: Rocket, exampleTicker: 'GE', exampleName: 'GE Aerospace' },
  'Airlines': { sector: 'Industrials', icon: PlaneLanding, exampleTicker: 'DAL', exampleName: 'Delta Air Lines, Inc.' },
  'Airports & Air Services': { sector: 'Industrials', icon: PlaneTakeoff, exampleTicker: 'JOBY', exampleName: 'Joby Aviation, Inc.' },
  'Building Products & Equipment': { sector: 'Industrials', icon: Hammer, exampleTicker: 'TT', exampleName: 'Trane Technologies plc' },
  'Business Equipment & Supplies': { sector: 'Industrials', icon: Cable, exampleTicker: 'EBF', exampleName: 'Ennis, Inc.' },
  'Conglomerates': { sector: 'Industrials', icon: Users, exampleTicker: 'HON', exampleName: 'Honeywell International Inc.' },
  'Consulting Services': { sector: 'Industrials', icon: MessageCircleQuestionMark, exampleTicker: 'VRSK', exampleName: 'Verisk Analytics, Inc.' },
  'Electrical Equipment & Parts': { sector: 'Industrials', icon: Plug, exampleTicker: 'VRT', exampleName: 'Vertiv Holdings Co.' },
  'Engineering & Construction': { sector: 'Industrials', icon: HardHat, exampleTicker: 'PWR', exampleName: 'Quanta Services, Inc.' },
  'Farm & Heavy Construction Machinery': { sector: 'Industrials', icon: Tractor, exampleTicker: 'CAT', exampleName: 'Caterpillar Inc.' },
  'Industrial Distribution': { sector: 'Industrials', icon: Boxes, exampleTicker: 'FERG', exampleName: 'Ferguson plc' },
  'Infrastructure Operations': { sector: 'Industrials', icon: Factory, exampleTicker: 'TRAUF', exampleName: 'Trane Technologies plc' },
  'Integrated Freight & Logistics': { sector: 'Industrials', icon: Forklift, exampleTicker: 'UPS', exampleName: 'United Parcel Service, Inc.' },
  'Marine Shipping': { sector: 'Industrials', icon: Ship, exampleTicker: 'KEX', exampleName: 'Kirby Corporation' },
  'Metal Fabrication': { sector: 'Industrials', icon: Anvil, exampleTicker: 'CRS', exampleName: 'Carpenter Technology Corporation' },
  'Pollution & Treatment Controls': { sector: 'Industrials', icon: DropletOff, exampleTicker: 'VLTO', exampleName: 'Veralto Corporation' },
  'Railroads': { sector: 'Industrials', icon: Train, exampleTicker: 'UNP', exampleName: 'Union Pacific Corporation' },
  'Rental & Leasing Services': { sector: 'Industrials', icon: TicketPercent, exampleTicker: 'URI', exampleName: 'United Rentals, Inc.' },
  'Security & Protection Services': { sector: 'Industrials', icon: BrickWallShield, exampleTicker: 'ALLE', exampleName: 'Allegion plc' },
  'Specialty Business Services': { sector: 'Industrials', icon: Briefcase, exampleTicker: 'CTAS', exampleName: 'Cintas Corporation' },
  'Specialty Industrial Machinery': { sector: 'Industrials', icon: WashingMachine, exampleTicker: 'GEV', exampleName: 'GE Vernova Inc.' },
  'Staffing & Employment Services': { sector: 'Industrials', icon: Handshake, exampleTicker: 'KFY', exampleName: 'Korn Ferry' },
  'Tools & Accessories': { sector: 'Industrials', icon: PencilRuler, exampleTicker: 'SNA', exampleName: 'Snap-on Incorporated' },
  'Trucking': { sector: 'Industrials', icon: Truck, exampleTicker: 'ODFL', exampleName: 'Old Dominion Freight Line, Inc.' },
  'Waste Management': { sector: 'Industrials', icon: Trash, exampleTicker: 'WM', exampleName: 'Waste Management, Inc.' },

  // Basic Materials
  'Agricultural Inputs': { sector: 'Basic Materials', icon: Leaf, exampleTicker: 'CTVA', exampleName: 'Corteva, Inc.' },
  'Aluminum': { sector: 'Basic Materials', icon: Mountain, exampleTicker: 'AA', exampleName: 'Alcoa Corporation' },
  'Building Materials': { sector: 'Basic Materials', icon: BrickWall, exampleTicker: 'CRH', exampleName: 'CRH plc' },
  'Chemicals': { sector: 'Basic Materials', icon: Atom, exampleTicker: 'DOW', exampleName: 'Dow Inc.' },
  'Coking Coal': { sector: 'Basic Materials', icon: Mountain, exampleTicker: 'HCC', exampleName: 'Warrior Met Coal, Inc.' },
  'Copper': { sector: 'Basic Materials', icon: Mountain, exampleTicker: 'SCCO', exampleName: 'Southern Copper Corporation' },
  'Gold': { sector: 'Basic Materials', icon: Cuboid, exampleTicker: 'NEM', exampleName: 'Newmont Corporation' },
  'Lumber & Wood Production': { sector: 'Basic Materials', icon: TreePine, exampleTicker: 'SSD', exampleName: 'Simpson Manufacturing Co., Inc.' },
  'Other Industrial Metals & Mining': { sector: 'Basic Materials', icon: Pickaxe, exampleTicker: 'MP', exampleName: 'MP Materials Corp.' },
  'Other Precious Metals & Mining': { sector: 'Basic Materials', icon: Gem, exampleTicker: 'HL', exampleName: 'Hecla Mining Company' },
  'Paper & Paper Products': { sector: 'Basic Materials', icon: FileText, exampleTicker: 'SLVM', exampleName: 'Sylvamo Corporation' },
  'Silver': { sector: 'Basic Materials', icon: Gem, exampleTicker: 'EXK', exampleName: 'Endeavour Silver Corp.' },
  'Specialty Chemicals': { sector: 'Basic Materials', icon: FlaskRound, exampleTicker: 'LIN', exampleName: 'Linde plc' },
  'Steel': { sector: 'Basic Materials', icon: Factory, exampleTicker: 'NUE', exampleName: 'Nucor Corporation' },
  
  // Real Estate
  'Real Estate - Development': { sector: 'Real Estate', icon: Building, exampleTicker: 'HHH', exampleName: 'Howard Hughes Holdings Inc.' },
  'Real Estate - Diversified': { sector: 'Real Estate', icon: Building2, exampleTicker: 'JOE', exampleName: 'St. Joe Company' },
  'Real Estate Services': { sector: 'Real Estate', icon: Home, exampleTicker: 'CBRE', exampleName: 'CBRE Group, Inc.' },
  'REIT - Diversified': { sector: 'Real Estate', icon: Building2, exampleTicker: 'VICI', exampleName: 'VICI Properties Inc.' },
  'REIT - Healthcare Facilities': { sector: 'Real Estate', icon: HouseHeart, exampleTicker: 'WELL', exampleName: 'Welltower Inc.' },
  'REIT - Hotel & Motel': { sector: 'Real Estate', icon: Hotel, exampleTicker: 'HST', exampleName: 'Host Hotels & Resorts, Inc.' },
  'REIT - Industrial': { sector: 'Real Estate', icon: Warehouse, exampleTicker: 'PLD', exampleName: 'Prologis, Inc.' },
  'REIT - Mortgage': { sector: 'Real Estate', icon: Landmark, exampleTicker: 'NLY', exampleName: 'Annaly Capital Management, Inc.' },
  'REIT - Office': { sector: 'Real Estate', icon: HouseWifi, exampleTicker: 'BXP', exampleName: 'BXP, Inc.' },
  'REIT - Residential': { sector: 'Real Estate', icon: HousePlus, exampleTicker: 'AVB', exampleName: 'AvalonBay Communities, Inc.' },
  'REIT - Retail': { sector: 'Real Estate', icon: Store, exampleTicker: 'SPG', exampleName: 'Simon Property Group, Inc.' },
  'REIT - Specialty': { sector: 'Real Estate', icon: HousePlug, exampleTicker: 'AMT', exampleName: 'American Tower Corporation' },

  // Miscellaneous
  'Other': { sector: 'Other', icon: Briefcase, exampleName: 'Other' },
  'Unknown': { sector: 'Unknown', icon: HelpCircle, exampleName: 'Unknown' },
};

/**
 * Sector icon configuration
 */
const SECTOR_ICON_MAP: Record<string, LucideIcon> = {
  'Technology': Cpu,
  'Communication Services': Radio,
  'Healthcare': Heart,
  'Financial Services': Landmark,
  'Energy': Zap,
  'Utilities': Lightbulb,
  'Consumer Cyclical': ShoppingCart,
  'Consumer Defensive': ShoppingBag,
  'Industrials': Factory,
  'Basic Materials': Mountain,
  'Real Estate': Building2,
  'Unknown': HelpCircle,
  'Other': BadgeQuestionMark,
};

/**
 * Derived: Industry to Icon mapping
 * Automatically generated from INDUSTRY_CONFIG
 */
export const INDUSTRY_ICONS: Record<string, LucideIcon> = Object.fromEntries(
  Object.entries(INDUSTRY_CONFIG).map(([industry, config]) => [industry, config.icon])
);

/**
 * Derived: Sector to Icon mapping
 */
export const SECTOR_ICONS: Record<string, LucideIcon> = SECTOR_ICON_MAP;

/**
 * Derived: Mapping of sectors to their valid industries
 * Automatically generated from INDUSTRY_CONFIG
 */
export const SECTOR_TO_INDUSTRIES: Record<string, string[]> = Object.entries(INDUSTRY_CONFIG)
  .reduce((acc, [industry, config]) => {
    const sector = config.sector;
    if (!acc[sector]) {
      acc[sector] = [];
    }
    acc[sector].push(industry);
    return acc;
  }, {} as Record<string, string[]>);

/**
 * Get icon for a sector
 * @param sector - Sector name from yfinance
 * @returns Lucide icon component
 */
export function getSectorIcon(sector: string | null | undefined): LucideIcon {
  if (!sector) return HelpCircle;
  return SECTOR_ICONS[sector] || Briefcase;
}

/**
 * Get icon for an industry
 * @param industry - Industry name from yfinance
 * @returns Lucide icon component
 */
export function getIndustryIcon(industry: string | null | undefined): LucideIcon {
  if (!industry) return HelpCircle;
  return INDUSTRY_ICONS[industry] || Briefcase;
}

/**
 * Get color class for a sector (for styling purposes)
 * @param sector - Sector name
 * @returns Tailwind color class
 */
export function getSectorColor(sector: string | null | undefined): string {
  if (!sector) return 'text-neutral-400';
  
  const colorMap: Record<string, string> = {
    'Technology': 'text-blue-600 dark:text-blue-400',
    'Communication Services': 'text-purple-600 dark:text-purple-400',
    'Healthcare': 'text-red-600 dark:text-red-400',
    'Financial Services': 'text-green-600 dark:text-green-400',
    'Energy': 'text-yellow-600 dark:text-yellow-400',
    'Utilities': 'text-amber-600 dark:text-amber-400',
    'Consumer Cyclical': 'text-pink-600 dark:text-pink-400',
    'Consumer Defensive': 'text-emerald-600 dark:text-emerald-400',
    'Industrials': 'text-slate-600 dark:text-slate-400',
    'Basic Materials': 'text-orange-600 dark:text-orange-400',
    'Materials': 'text-orange-600 dark:text-orange-400',
    'Real Estate': 'text-indigo-600 dark:text-indigo-400',
  };
  
  return colorMap[sector] || 'text-neutral-600 dark:text-neutral-400';
}

/**
 * Get hex color for a sector (for charts and visualizations)
 * @param sector - Sector name
 * @returns Hex color code
 */
export function getSectorHexColor(sector: string | null | undefined): string {
  if (!sector) return '#9ca3af'; // gray-400
  
  const hexColorMap: Record<string, string> = {
    'Technology': '#3b82f6', // blue-500
    'Communication Services': '#a855f7', // purple-500
    'Healthcare': '#ef4444', // red-500
    'Financial Services': '#10b981', // green-500
    'Energy': '#eab308', // yellow-500
    'Utilities': '#f59e0b', // amber-500
    'Consumer Cyclical': '#ec4899', // pink-500
    'Consumer Defensive': '#10b981', // emerald-500
    'Industrials': '#64748b', // slate-500
    'Basic Materials': '#f97316', // orange-500
    'Real Estate': '#6366f1', // indigo-500
    'Unknown': '#9ca3af', // gray-400
  };
  
  return hexColorMap[sector] || '#9ca3af'; // gray-400 as fallback
}

/**
 * Get color class for an industry (for styling purposes)
 * @param industry - Industry name
 * @returns Tailwind color class
 */
export function getIndustryColor(industry: string | null | undefined): string {
  if (!industry) return 'text-neutral-400';
  
  // Use the sector color if we can determine the parent sector
  // Otherwise use a neutral color
  return 'text-neutral-600 dark:text-neutral-400';
}

/**
 * Get valid industries for a given sector
 * @param sector - Sector name
 * @returns Array of valid industry names for that sector
 */
export function getIndustriesForSector(sector: string | null | undefined): string[] {
  if (!sector) return Object.keys(INDUSTRY_ICONS).sort();
  return SECTOR_TO_INDUSTRIES[sector] || Object.keys(INDUSTRY_ICONS).sort();
}

/**
 * Get all available sectors
 * @returns Array of all sector names
 */
export function getAllSectors(): string[] {
  return Object.keys(SECTOR_ICONS).filter(s => s !== 'Unknown' && s !== 'Other').sort();
}

/**
 * Get all available industries
 * @returns Array of all industry names
 */
export function getAllIndustries(): string[] {
  return Object.keys(INDUSTRY_ICONS).filter(i => i !== 'Unknown' && i !== 'Other').sort();
}

/**
 * Check if a sector is valid
 * @param sector - Sector name to validate
 * @returns True if the sector exists in our mappings
 */
export function isValidSector(sector: string | null | undefined): boolean {
  if (!sector) return false;
  return sector in SECTOR_ICONS;
}

/**
 * Check if an industry is valid
 * @param industry - Industry name to validate
 * @returns True if the industry exists in our mappings
 */
export function isValidIndustry(industry: string | null | undefined): boolean {
  if (!industry) return false;
  return industry in INDUSTRY_ICONS;
}

/**
 * Get the parent sector for a given industry
 * @param industry - Industry name
 * @returns The parent sector name, or null if not found
 */
export function getSectorForIndustry(industry: string | null | undefined): string | null {
  if (!industry) return null;
  return INDUSTRY_CONFIG[industry]?.sector || null;
}

/**
 * Get the example ticker for a given industry
 * @param industry - Industry name
 * @returns The example ticker symbol, or null if not found
 */
export function getExampleTickerForIndustry(industry: string | null | undefined): string | null {
  if (!industry) return null;
  return INDUSTRY_CONFIG[industry]?.exampleTicker || null;
}

/**
 * Get the example company name for a given industry
 * @param industry - Industry name
 * @returns The example company name, or null if not found
 */
export function getExampleNameForIndustry(industry: string | null | undefined): string | null {
  if (!industry) return null;
  return INDUSTRY_CONFIG[industry]?.exampleName || null;
}