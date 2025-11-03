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
  
  // Financial
  'Financial Services': Landmark,
  
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
  
  // Industrials
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
 * Mapping of sectors to their valid industries
 * Based on GICS (Global Industry Classification Standard) hierarchy
 */
export const SECTOR_TO_INDUSTRIES: Record<string, string[]> = {
  'Technology': [
    'Software—Application',
    'Software—Infrastructure',
    'Software',
    'Information Technology Services',
    'Internet Content & Information',
    'Electronic Gaming & Multimedia',
    'Software - Application',
    'Software - Infrastructure',
    'Computer Hardware',
    'Consumer Electronics',
    'Electronic Components',
    'Electronics & Computer Distribution',
    'Scientific & Technical Instruments',
    'Semiconductors',
    'Semiconductor Equipment & Materials',
  ],
  
  'Communication Services': [
    'Telecom Services',
    'Wireless Telecommunication Services',
    'Diversified Telecommunication Services',
    'Entertainment',
    'Broadcasting',
    'Interactive Media & Services',
    'Publishing',
    'Advertising Agencies',
  ],
  
  'Telecommunications': [
    'Telecom Services',
    'Wireless Telecommunication Services',
    'Diversified Telecommunication Services',
  ],
  
  'Healthcare': [
    'Biotechnology',
    'Drug Manufacturers—General',
    'Drug Manufacturers—Specialty & Generic',
    'Pharmaceutical Retailers',
    'Drug Manufacturers - General',
    'Drug Manufacturers - Specialty & Generic',
    'Medical Devices',
    'Medical Instruments & Supplies',
    'Medical Care Facilities',
    'Medical Distribution',
    'Health Care Equipment & Supplies',
    'Health Care Providers & Services',
    'Diagnostics & Research',
    'Medical Diagnostics & Research',
    'Health Information Services',
  ],
  
  'Financial Services': [
    'Banks—Diversified',
    'Banks—Regional',
    'Banks - Diversified',
    'Banks - Regional',
    'Diversified Banks',
    'Regional Banks',
    'Asset Management',
    'Investment Banking & Brokerage',
    'Capital Markets',
    'Financial Data & Stock Exchanges',
    'Credit Services',
    'Insurance—Diversified',
    'Insurance—Life',
    'Insurance—Property & Casualty',
    'Insurance—Reinsurance',
    'Insurance—Specialty',
    'Insurance - Diversified',
    'Insurance - Life',
    'Insurance - Property & Casualty',
    'Diversified Financial Services',
    'Consumer Finance',
    'Mortgage Finance',
  ], 
  
  'Energy': [
    'Oil & Gas E&P',
    'Oil & Gas Integrated',
    'Oil & Gas Midstream',
    'Oil & Gas Refining & Marketing',
    'Oil & Gas Drilling',
    'Oil & Gas Equipment & Services',
    'Thermal Coal',
    'Uranium',
    'Solar',
  ],
  
  'Utilities': [
    'Utilities—Diversified',
    'Utilities—Independent Power Producers',
    'Utilities—Regulated Electric',
    'Utilities—Regulated Gas',
    'Utilities—Regulated Water',
    'Utilities—Renewable',
    'Utilities - Diversified',
    'Utilities - Independent Power Producers',
    'Utilities - Regulated Electric',
    'Utilities - Regulated Gas',
    'Utilities - Regulated Water',
    'Utilities - Renewable',
    'Electric Utilities',
    'Gas Utilities',
    'Water Utilities',
    'Multi-Utilities',
    'Independent Power and Renewable Electricity Producers',
  ],
  
  'Consumer Cyclical': [
    'Auto Manufacturers',
    'Auto Parts',
    'Recreational Vehicles',
    'Auto & Truck Dealerships',
    'Department Stores',
    'Discount Stores',
    'Apparel Manufacturing',
    'Apparel Retail',
    'Footwear & Accessories',
    'Home Improvement Retail',
    'Specialty Retail',
    'Internet Retail',
    'Luxury Goods',
    'Furnishings, Fixtures & Appliances',
    'Residential Construction',
    'Restaurants',
    'Lodging',
    'Resorts & Casinos',
    'Travel Services',
    'Leisure',
    'Gambling',
    'Textile Manufacturing',
    'Packaging & Containers',
    'Personal Services',
  ],
  
  'Consumer Defensive': [
    'Beverages—Alcoholic',
    'Beverages—Non-Alcoholic',
    'Beverages - Alcoholic',
    'Beverages - Non-Alcoholic',
    'Beverages—Brewers',
    'Beverages—Wineries & Distilleries',
    'Confectioners',
    'Farm Products',
    'Food Distribution',
    'Grocery Stores',
    'Packaged Foods',
    'Education & Training Services',
    'Household & Personal Products',
    'Tobacco',
  ],
  
  'Consumer Discretionary': [
    'Auto Manufacturers',
    'Auto Parts',
    'Recreational Vehicles',
    'Auto & Truck Dealerships',
    'Department Stores',
    'Discount Stores',
    'Apparel Manufacturing',
    'Apparel Retail',
    'Footwear & Accessories',
    'Home Improvement Retail',
    'Specialty Retail',
    'Internet Retail',
    'Luxury Goods',
    'Furnishings, Fixtures & Appliances',
    'Residential Construction',
    'Restaurants',
    'Lodging',
    'Resorts & Casinos',
    'Travel Services',
    'Leisure',
    'Gambling',
    'Textile Manufacturing',
    'Packaging & Containers',
    'Personal Services',
  ],
  
  'Consumer Staples': [
    'Beverages—Alcoholic',
    'Beverages—Non-Alcoholic',
    'Beverages - Alcoholic',
    'Beverages - Non-Alcoholic',
    'Beverages—Brewers',
    'Beverages—Wineries & Distilleries',
    'Confectioners',
    'Farm Products',
    'Food Distribution',
    'Grocery Stores',
    'Packaged Foods',
    'Education & Training Services',
    'Household & Personal Products',
    'Tobacco',
  ],
  
  'Industrials': [
    'Aerospace & Defense',
    'Airlines',
    'Airports & Air Services',
    'Building Products & Equipment',
    'Business Equipment & Supplies',
    'Conglomerates',
    'Construction & Engineering',
    'Consulting Services',
    'Electrical Equipment & Parts',
    'Engineering & Construction',
    'Farm & Heavy Construction Machinery',
    'Industrial Distribution',
    'Infrastructure Operations',
    'Integrated Freight & Logistics',
    'Machinery',
    'Marine Shipping',
    'Metal Fabrication',
    'Pollution & Treatment Controls',
    'Railroads',
    'Rental & Leasing Services',
    'Security & Protection Services',
    'Specialty Business Services',
    'Specialty Industrial Machinery',
    'Staffing & Employment Services',
    'Tools & Accessories',
    'Trucking',
    'Waste Management',
  ],
  
  'Basic Materials': [
    'Aluminum',
    'Building Materials',
    'Chemicals',
    'Coking Coal',
    'Copper',
    'Gold',
    'Lumber & Wood Production',
    'Other Industrial Metals & Mining',
    'Other Precious Metals & Mining',
    'Paper & Paper Products',
    'Silver',
    'Specialty Chemicals',
    'Steel',
  ],
  
  'Materials': [
    'Aluminum',
    'Building Materials',
    'Chemicals',
    'Coking Coal',
    'Copper',
    'Gold',
    'Lumber & Wood Production',
    'Other Industrial Metals & Mining',
    'Other Precious Metals & Mining',
    'Paper & Paper Products',
    'Silver',
    'Specialty Chemicals',
    'Steel',
  ],
  
  'Real Estate': [
    'Real Estate—Development',
    'Real Estate—Diversified',
    'Real Estate Services',
    'REIT—Diversified',
    'REIT—Healthcare Facilities',
    'REIT—Hotel & Motel',
    'REIT—Industrial',
    'REIT—Mortgage',
    'REIT—Office',
    'REIT—Residential',
    'REIT—Retail',
    'REIT—Specialty',
    'Real Estate - Development',
    'Real Estate - Diversified',
  ],
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
    'Telecommunications': 'text-violet-600 dark:text-violet-400',
    'Healthcare': 'text-red-600 dark:text-red-400',
    'Financial Services': 'text-green-600 dark:text-green-400',
    'Energy': 'text-yellow-600 dark:text-yellow-400',
    'Utilities': 'text-amber-600 dark:text-amber-400',
    'Consumer Cyclical': 'text-pink-600 dark:text-pink-400',
    'Consumer Defensive': 'text-emerald-600 dark:text-emerald-400',
    'Consumer Discretionary': 'text-pink-600 dark:text-pink-400',
    'Consumer Staples': 'text-emerald-600 dark:text-emerald-400',
    'Industrials': 'text-slate-600 dark:text-slate-400',
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
  
  for (const [sector, industries] of Object.entries(SECTOR_TO_INDUSTRIES)) {
    if (industries.includes(industry)) {
      return sector;
    }
  }
  
  return null;
}
