/**
 * Mapping of yfinance sectors and industries to Lucide React icons
 * 
 * This file provides icon mappings for all known sectors and industries from Yahoo Finance,
 * used throughout the application to provide visual representation of different sectors and industries.
 */

import {
  // Technology & Communication
  Cpu,
  Smartphone,
  Laptop,
  Wifi,
  Radio,
  Satellite,
  Monitor,
  Globe,
  Network,
  Server,
  HardDrive,
  
  // Healthcare & Pharmaceuticals
  Heart,
  Pill,
  Stethoscope,
  Syringe,
  Activity,
  Microscope,
  FlaskConical,
  Dna,
  
  // Financial Services
  DollarSign,
  CreditCard,
  Landmark,
  Building2,
  Coins,
  TrendingUp,
  Wallet,
  
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
  Coffee,
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
  Plane,
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
} from 'lucide-react';

import { LucideIcon } from 'lucide-react';

/**
 * Sector to Icon mapping
 * Based on GICS (Global Industry Classification Standard) sectors used by Yahoo Finance
 */
export const SECTOR_ICONS: Record<string, LucideIcon> = {
  // Technology
  'Technology': Cpu,
  'Communication Services': Radio,
  'Telecommunications': Smartphone,
  
  // Healthcare
  'Healthcare': Heart,
  'Health Care': Heart,
  
  // Financial
  'Financial Services': Landmark,
  'Financial': Landmark,
  'Financials': Landmark,
  
  // Energy
  'Energy': Zap,
  
  // Utilities
  'Utilities': Lightbulb,
  
  // Consumer
  'Consumer Cyclical': ShoppingCart,
  'Consumer Defensive': ShoppingBag,
  'Consumer Discretionary': ShoppingCart,
  'Consumer Staples': ShoppingBag,
  
  // Industrial
  'Industrials': Factory,
  'Industrial': Factory,
  
  // Basic Materials
  'Basic Materials': Mountain,
  'Materials': Mountain,
  
  // Real Estate
  'Real Estate': Building,
  
  // Other
  'Unknown': HelpCircle,
  'Other': Briefcase,
};

/**
 * Industry to Icon mapping
 * Comprehensive mapping of Yahoo Finance industries to appropriate Lucide icons
 */
export const INDUSTRY_ICONS: Record<string, LucideIcon> = {
  // Technology - Software & IT Services
  'Software—Application': Laptop,
  'Software—Infrastructure': Server,
  'Software': Monitor,
  'Information Technology Services': Network,
  'Internet Content & Information': Globe,
  'Electronic Gaming & Multimedia': Film,
  'Software - Application': Laptop,
  'Software - Infrastructure': Server,
  
  // Technology - Hardware
  'Computer Hardware': Monitor,
  'Consumer Electronics': Smartphone,
  'Electronic Components': Cpu,
  'Electronics & Computer Distribution': HardDrive,
  'Scientific & Technical Instruments': Microscope,
  'Semiconductors': Cpu,
  'Semiconductor Equipment & Materials': Cpu,
  
  // Communication Services
  'Telecom Services': Radio,
  'Wireless Telecommunication Services': Wifi,
  'Diversified Telecommunication Services': Satellite,
  'Entertainment': Tv,
  'Broadcasting': Radio,
  'Interactive Media & Services': Globe,
  'Publishing': Newspaper,
  'Advertising Agencies': Camera,
  
  // Healthcare - Pharma & Biotech
  'Biotechnology': Dna,
  'Drug Manufacturers—General': Pill,
  'Drug Manufacturers—Specialty & Generic': Pill,
  'Pharmaceutical Retailers': Pill,
  'Drug Manufacturers - General': Pill,
  'Drug Manufacturers - Specialty & Generic': Pill,
  
  // Healthcare - Medical
  'Medical Devices': Stethoscope,
  'Medical Instruments & Supplies': Syringe,
  'Medical Care Facilities': Heart,
  'Medical Distribution': Activity,
  'Health Care Equipment & Supplies': Stethoscope,
  'Health Care Providers & Services': Heart,
  'Diagnostics & Research': FlaskConical,
  'Medical Diagnostics & Research': Microscope,
  'Health Information Services': Activity,
  
  // Financial Services - Banking
  'Banks—Diversified': Landmark,
  'Banks—Regional': Building2,
  'Banks - Diversified': Landmark,
  'Banks - Regional': Building2,
  'Diversified Banks': Landmark,
  'Regional Banks': Building2,
  
  // Financial Services - Investment
  'Asset Management': TrendingUp,
  'Investment Banking & Brokerage': DollarSign,
  'Capital Markets': TrendingUp,
  'Financial Data & Stock Exchanges': Coins,
  'Credit Services': CreditCard,
  'Insurance—Diversified': Shield,
  'Insurance—Life': Heart,
  'Insurance—Property & Casualty': Building2,
  'Insurance—Reinsurance': Shield,
  'Insurance—Specialty': FileText,
  'Insurance - Diversified': Shield,
  'Insurance - Life': Heart,
  'Insurance - Property & Casualty': Building2,
  'Diversified Financial Services': Wallet,
  'Consumer Finance': CreditCard,
  'Mortgage Finance': HomeIcon,
  
  // Energy
  'Oil & Gas E&P': Flame,
  'Oil & Gas Integrated': Zap,
  'Oil & Gas Midstream': Droplet,
  'Oil & Gas Refining & Marketing': Flame,
  'Oil & Gas Drilling': Wrench,
  'Oil & Gas Equipment & Services': Wrench,
  'Thermal Coal': Mountain,
  'Uranium': Zap,
  'Solar': Sun,
  
  // Utilities
  'Utilities—Diversified': Lightbulb,
  'Utilities—Independent Power Producers': Zap,
  'Utilities—Regulated Electric': Plug,
  'Utilities—Regulated Gas': Flame,
  'Utilities—Regulated Water': Droplet,
  'Utilities—Renewable': Wind,
  'Utilities - Diversified': Lightbulb,
  'Utilities - Independent Power Producers': Zap,
  'Utilities - Regulated Electric': Plug,
  'Utilities - Regulated Gas': Flame,
  'Utilities - Regulated Water': Droplet,
  'Utilities - Renewable': Wind,
  'Electric Utilities': Zap,
  'Gas Utilities': Flame,
  'Water Utilities': Droplet,
  'Multi-Utilities': Lightbulb,
  'Independent Power and Renewable Electricity Producers': Wind,
  
  // Consumer Cyclical
  'Auto Manufacturers': Car,
  'Auto Parts': Cog,
  'Recreational Vehicles': Car,
  'Auto & Truck Dealerships': Car,
  'Department Stores': Store,
  'Discount Stores': ShoppingBag,
  'Apparel Manufacturing': Shirt,
  'Apparel Retail': ShoppingCart,
  'Footwear & Accessories': Watch,
  'Home Improvement Retail': Home,
  'Specialty Retail': Store,
  'Internet Retail': Globe,
  'Luxury Goods': Diamond,
  'Furnishings, Fixtures & Appliances': Sofa,
  'Residential Construction': Building,
  'Restaurants': Pizza,
  'Lodging': Hotel,
  'Resorts & Casinos': Building2,
  'Travel Services': Plane,
  'Leisure': Film,
  'Gambling': Coins,
  'Textile Manufacturing': Shirt,
  'Packaging & Containers': Boxes,
  'Personal Services': Briefcase,
  
  // Consumer Defensive
  'Beverages—Alcoholic': Wine,
  'Beverages—Non-Alcoholic': Coffee,
  'Beverages - Alcoholic': Wine,
  'Beverages - Non-Alcoholic': Coffee,
  'Beverages—Brewers': Wine,
  'Beverages—Wineries & Distilleries': Wine,
  'Confectioners': ShoppingBag,
  'Farm Products': Wheat,
  'Food Distribution': Truck,
  'Grocery Stores': ShoppingBag,
  'Packaged Foods': Package,
  'Education & Training Services': GraduationCap,
  'Household & Personal Products': Home,
  'Tobacco': Leaf,
  
  // Industrial
  'Aerospace & Defense': Rocket,
  'Airlines': Plane,
  'Airports & Air Services': Plane,
  'Building Products & Equipment': Hammer,
  'Business Equipment & Supplies': Briefcase,
  'Conglomerates': Building2,
  'Construction & Engineering': HardHat,
  'Consulting Services': Briefcase,
  'Electrical Equipment & Parts': Plug,
  'Engineering & Construction': Factory,
  'Farm & Heavy Construction Machinery': Cog,
  'Industrial Distribution': Boxes,
  'Infrastructure Operations': Factory,
  'Integrated Freight & Logistics': Truck,
  'Machinery': Cog,
  'Marine Shipping': Ship,
  'Metal Fabrication': Hammer,
  'Pollution & Treatment Controls': Leaf,
  'Railroads': Train,
  'Rental & Leasing Services': Briefcase,
  'Security & Protection Services': Shield,
  'Specialty Business Services': Briefcase,
  'Specialty Industrial Machinery': Cog,
  'Staffing & Employment Services': Briefcase,
  'Tools & Accessories': Wrench,
  'Trucking': Truck,
  'Waste Management': Boxes,
  
  // Basic Materials
  'Aluminum': Mountain,
  'Building Materials': HardHat,
  'Chemicals': FlaskConical,
  'Coking Coal': Mountain,
  'Copper': Mountain,
  'Gold': Diamond,
  'Lumber & Wood Production': TreePine,
  'Other Industrial Metals & Mining': Mountain,
  'Other Precious Metals & Mining': Gem,
  'Paper & Paper Products': FileText,
  'Silver': Gem,
  'Specialty Chemicals': FlaskConical,
  'Steel': Factory,
  
  // Real Estate
  'Real Estate—Development': Building,
  'Real Estate—Diversified': Building2,
  'Real Estate Services': HomeIcon,
  'REIT—Diversified': Building,
  'REIT—Healthcare Facilities': Heart,
  'REIT—Hotel & Motel': Hotel,
  'REIT—Industrial': Warehouse,
  'REIT—Mortgage': Landmark,
  'REIT—Office': Building2,
  'REIT—Residential': Home,
  'REIT—Retail': Store,
  'REIT—Specialty': Building,
  'Real Estate - Development': Building,
  'Real Estate - Diversified': Building2,
  
  // Miscellaneous
  'Shell Companies': HelpCircle,
  'Conglomerate': Building2,
  'Other': Briefcase,
  'Unknown': HelpCircle,
};

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
    'Health Care': 'text-red-600 dark:text-red-400',
    'Financial Services': 'text-green-600 dark:text-green-400',
    'Financial': 'text-green-600 dark:text-green-400',
    'Financials': 'text-green-600 dark:text-green-400',
    'Energy': 'text-yellow-600 dark:text-yellow-400',
    'Utilities': 'text-amber-600 dark:text-amber-400',
    'Consumer Cyclical': 'text-pink-600 dark:text-pink-400',
    'Consumer Defensive': 'text-emerald-600 dark:text-emerald-400',
    'Consumer Discretionary': 'text-pink-600 dark:text-pink-400',
    'Consumer Staples': 'text-emerald-600 dark:text-emerald-400',
    'Industrials': 'text-gray-600 dark:text-gray-400',
    'Industrial': 'text-gray-600 dark:text-gray-400',
    'Basic Materials': 'text-orange-600 dark:text-orange-400',
    'Materials': 'text-orange-600 dark:text-orange-400',
    'Real Estate': 'text-indigo-600 dark:text-indigo-400',
  };
  
  return colorMap[sector] || 'text-neutral-600 dark:text-neutral-400';
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
