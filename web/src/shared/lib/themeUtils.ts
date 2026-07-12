/**
 * Theme utilities.
 *
 * Keep these maps aligned with the backend theme hierarchy.
 * Every top-level theme and subtheme should have an icon, a Tailwind text color,
 * and a chart hex color.
 *
 * Color system:
 * - each top-level theme receives a unique chart color;
 * - each subtheme receives a nearby shade/tint of its parent theme color;
 * - Tailwind text colors use arbitrary hex classes so the chart and text systems stay aligned.
 *
 * Icon system:
 * - parent themes use broad category icons;
 * - subthemes use more specific Lucide icons where available;
 * - duplicates inside the same parent group are avoided when a logical alternative exists.
 */

import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Antenna,
  Atom,
  AudioLines,
  Axe,
  Baby,
  BadgeCheck,
  BadgeDollarSign,
  Banknote,
  Battery,
  BatteryCharging,
  BatteryPlus,
  Bike,
  Binoculars,
  Blocks,
  Bone,
  BookOpen,
  BookOpenCheck,
  Bot,
  Boxes,
  Brain,
  BrainCircuit,
  BrainCog,
  Briefcase,
  BriefcaseBusiness,
  Building,
  Building2,
  Cable,
  Car,
  CarFront,
  ChartCandlestick,
  ChartColumn,
  ChartLine,
  ChartNetwork,
  ChartNoAxesCombined,
  ChefHat,
  ClipboardCheck,
  Cloud,
  Code,
  Coins,
  Cpu,
  CreditCard,
  Cross,
  CupSoda,
  Dam,
  Database,
  Dice5,
  Dna,
  Drone,
  Disc3,
  Droplets,
  Earth,
  Eye,
  Factory,
  FileStack,
  FileText,
  Fingerprint,
  Flag,
  Flame,
  FlaskConical,
  FlaskRound,
  Forklift,
  Fuel,
  Gamepad2,
  Gem,
  Globe,
  GraduationCap,
  Grid3X3,
  Hamburger,
  Handshake,
  Headset,
  Heart,
  HeartHandshake,
  HeartPulse,
  HelpCircle,
  Home,
  Hospital,
  House,
  HouseWifi,
  Landmark,
  Leaf,
  LifeBuoy,
  Lightbulb,
  Lock,
  LockKeyhole,
  Megaphone,
  MemoryStick,
  Microchip,
  Microscope,
  MonitorPlay,
  Moon,
  MousePointerClick,
  Music,
  Network,
  Orbit,
  Package,
  PawPrint,
  PersonStanding,
  Pickaxe,
  Pill,
  PillBottle,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Plug,
  Radar,
  Radiation,
  RadioTower,
  Receipt,
  Recycle,
  RefreshCw,
  Rocket,
  Route,
  Sailboat,
  Satellite,
  SatelliteDish,
  ScanEye,
  School,
  Scissors,
  ScrollText,
  Server,
  Shield,
  ShieldCheck,
  ShieldHalf,
  Ship,
  ShipWheel,
  Shirt,
  ShoppingBag,
  Siren,
  ShoppingCart,
  Smartphone,
  Smile,
  Sparkles,
  Sprout,
  Stethoscope,
  Store,
  Sun,
  Target,
  TentTree,
  TestTube,
  Ticket,
  Tractor,
  TrainFront,
  TrainTrack,
  Trash,
  TreePine,
  Trees,
  Trophy,
  Truck,
  UtensilsCrossed,
  UtilityPole,
  UserSearch,
  Users,
  Video,
  WandSparkles,
  Warehouse,
  Wheat,
  Wind,
  Wine,
  Wrench,
  Zap,
  ShieldAlert,
  UserStar,
  CreativeCommons,
  Columns4,
  Dices,
  Bomb,
  Bitcoin,
  TicketsPlane,
  ScanFace,
  BugOff,
  SoapDispenserDroplet,
  BrickWall,
  Grid2X2Plus,
  WavesLadder,
} from 'lucide-react'
interface ThemeEvidence {
  label: string
  evidence?: string[] | null
  children?: ThemeEvidence[] | null
}

export function getThemeEvidenceTitle(theme: ThemeEvidence): string | undefined {
  const lines = [
    ...(theme.evidence || []).map((item) => `Theme: ${item}`),
    ...((theme.children || []).flatMap((child) =>
      (child.evidence || []).map((item) => `${child.label}: ${item}`)
    )),
  ]
  return lines.length ? lines.join('\n') : undefined
}

const THEME_ICONS: Record<string, LucideIcon> = {
  // AI, compute, software & security
  // AI Infrastructure
  'AI Infrastructure': BrainCircuit,
  'GPU Computing': Cpu,
  'Accelerated Computing': Zap,
  'AI Servers': Server,
  'AI Networking': Network,
  'Edge AI': Cloud,

  // AI Applications
  'AI Applications': BrainCog,
  'Generative AI': WandSparkles,
  'AI Agents': Bot,
  'AI Software': Code,
  'Enterprise AI': Building2,
  'Sovereign AI': Flag,

  // Data Center Infrastructure
  'Data Center Infrastructure': Server,
  'Colocation': Building,
  'Hyperscale Data Centers': Zap,
  'Data Center Power': Wind,
  'Data Center Cooling': Cloud,

  // Networking Infrastructure
  'Networking Infrastructure': Network,
  'Ethernet Switching': Cable,
  'Optical Networking': Route,
  'Routing': RadioTower,
  'Network Equipment': Server,

  // Semiconductor Value Chain
  'Semiconductor Value Chain': Microchip,
  'Chip Design': Factory,
  'Semiconductor Equipment': Blocks,
  'Foundry Ecosystem': Package,
  'Advanced Packaging': MemoryStick,
  'Memory & Storage': MemoryStick,

  // Photonics & Optical Computing
  'Photonics & Optical Computing': Lightbulb,
  'Optical Interconnects': Cable,
  'Silicon Photonics': SatelliteDish,
  'Optical Transceivers': Package,
  'Co-Packaged Optics': Zap,

  // Quantum Technology
  'Quantum Technology': Atom,
  'Quantum Computing': Atom,
  'Quantum Networking': Orbit,
  'Quantum Security': LockKeyhole,

  // Cybersecurity Platforms
  'Cybersecurity Platforms': Shield,
  'Identity Security': Fingerprint,
  'Zero Trust': ShieldCheck,
  'Threat Intelligence': Radar,
  'Network Security': Network,
  'Cloud Security': Cloud,
  'Security Operations': LockKeyhole,
  'Endpoint Security': Lock,
  'Application Security': ShieldCheck,

  // Cloud Platforms
  'Cloud Platforms': Cloud,
  'Cloud Infrastructure': Cloud,
  'Hyperscale Cloud': Cloud,
  'Developer Platforms': Code,
  'Observability': Eye,
  'Database Platforms': Database,
  'CDN': ChartNetwork,
  'Edge Network': Network,

  // Enterprise SaaS
  'Enterprise SaaS': Building2,
  'CRM Software': BriefcaseBusiness,
  'ERP Software': RefreshCw,
  'Workflow Automation': Smile,
  'Digital Transformation': BookOpen,
  'Customer Experience Software': Code,
  'Productivity Software': BookOpen,

  // Data Analytics Platforms
  'Data Analytics Platforms': Database,
  'Business Intelligence': ChartLine,
  'Data Warehousing': Warehouse,
  'Data Engineering': Activity,
  'Real-Time Analytics': ScrollText,

  // Robotics, mobility, defense & space
  // Robotics & Automation
  'Robotics & Automation': Bot,
  'Humanoid Robotics': PersonStanding,
  'Industrial Robotics': Bot,
  'Warehouse Automation': Warehouse,
  'Machine Vision': ScanEye,
  'Industrial Automation': Factory,
  'Sensors & LiDAR': Radar,

  // Electric Mobility
  'Electric Mobility': CarFront,
  'Electric Vehicles': CarFront,
  'Charging Infrastructure': Plug,
  'Powertrains': TrainFront,
  'Fleet Electrification': Truck,

  // Autonomous Mobility
  'Autonomous Mobility': Car,
  'Autonomous Vehicles': Car,
  'Robotaxis': CarFront,
  'Driver Assistance': ScanEye,
  'Mobility Platforms': Route,

  // Battery Value Chain
  'Battery Value Chain': Battery,
  'Battery Technology': BatteryCharging,
  'Battery Storage': FlaskConical,
  'Lithium Batteries': BatteryPlus,
  'Battery Materials': Leaf,
  'Battery Recycling': RefreshCw,

  // Defense Tech
  'Defense Tech': ShieldHalf,
  'Military AI': Brain,
  'ISR & Surveillance': Binoculars,
  'Drones / UAV': Drone,
  'Electronic Warfare': RadioTower,
  'Missile Defense': Target,
  'Secure Communications': LockKeyhole,
  'Ammunition & Ordnance': Bomb,

  // Space Infrastructure
  'Space Infrastructure': SatelliteDish,
  'Launch Services': Rocket,
  'Satellites': Satellite,
  'Space Communications': Orbit,
  'Earth Observation': Earth,
  'Space Systems': SatelliteDish,

  // Geospatial Technology
  'Geospatial Technology': Globe,
  'GNSS Positioning': Satellite,
  'Surveying Technology': ScanEye,
  'Geospatial Software': Code,
  'Mapping Systems': Route,
  'Location Intelligence': Radar,

  // Energy & decarbonization
  // Nuclear Energy
  'Nuclear Energy': Radiation,
  'Nuclear': Radiation,
  'SMR': Atom,
  'Uranium': Fuel,
  'Nuclear Services': Wrench,

  // Grid Modernization
  'Grid Modernization': UtilityPole,
  'Grid Infrastructure': Zap,
  'Power Generation': Cable,
  'Transmission Equipment': Plug,
  'Power Electronics': Network,
  'Smart Grid': Grid3X3,

  // Renewable Power
  'Renewable Power': Wind,
  'Solar': Sun,
  'Wind': Wind,
  'Renewable Developers': Leaf,
  'Renewable Equipment': Factory,

  // Clean Fuels
  'Clean Fuels': FlaskConical,
  'Hydrogen': Flame,
  'Renewable Natural Gas': Plane,
  'Sustainable Aviation Fuel': PlaneLanding,
  'Biofuels': Leaf,

  // Carbon Management
  'Carbon Management': Leaf,
  'Carbon Capture': Leaf,
  'Carbon Markets': ChartLine,
  'Emissions Monitoring': Radar,

  // Oil & Gas & Energy Transport
  'Oil & Gas': Flame,
  'Crude Oil Production': Fuel,
  'Natural Gas Production': Droplets,
  'Natural Gas Liquids': Droplets,
  'Integrated Energy': Factory,
  'LNG': Droplets,

  'Energy Transport': Route,
  'Pipelines': Route,
  'LNG Infrastructure': Ship,
  'Storage Terminals': Warehouse,
  'Midstream Infrastructure': Truck,
  'Refining': Factory,

  'Energy Services': Wrench,
  'Oilfield Services': Wrench,
  'Drilling Services': Pickaxe,
  'Completion Services': Wrench,

  // Finance, crypto & real estate finance
  // Digital Finance
  'Digital Finance': BadgeDollarSign,
  'Fintech': Landmark,
  'Digital Banking': CreditCard,
  'Payments': Banknote,
  'Lending Platforms': Banknote,

  // Investment Platforms
  'Investment Platforms': ChartLine,
  'Asset Management': ChartCandlestick,
  'Wealth Technology': Receipt,

  // Market Infrastructure
  'Market Infrastructure': Landmark,
  'Exchange Operators': Landmark,
  'Trading Infrastructure': ChartColumn,
  'Market Data': Database,
  'Index Providers': ChartNoAxesCombined,
  'Credit Ratings': BadgeCheck,

  // Insurance
  'Insurance': Shield,
  'P&C Insurance': ShieldCheck,
  'Life Insurance': HeartPulse,
  'Reinsurance': RefreshCw,
  'Insurance Brokers': Handshake,

  // Crypto Infrastructure
  'Crypto Infrastructure': Blocks,
  'Digital Assets': Coins,
  'Crypto Exchanges': RefreshCw,
  'Blockchain Infrastructure': Cpu,
  'Bitcoin Mining': Cpu,
  'Stablecoin': BadgeDollarSign,
  'Cryptocurrency': Bitcoin,

  // Mortgage Finance
  'Mortgage Finance': Home,
  'Secondary Mortgage Market': Landmark,
  'Mortgage Securitization': ChartCandlestick,
  'Mortgage Guarantees': ShieldCheck,
  'Single-Family Mortgages': House,
  'Multifamily Mortgages': Building2,

  // Healthcare & biotech
  // Biotechnology Platforms
  'Biotechnology Platforms': Microscope,
  'Drug Discovery': TestTube,
  'Biologics': Dna,
  'Gene Therapy': Activity,
  'Cell Therapy': Hospital,
  'Clinical Platforms': Hospital,

  // Precision Medicine
  'Precision Medicine': Stethoscope,
  'Diagnostics': FlaskRound,
  'Genomics': Dna,
  'Targeted Therapies': Target,
  'Personalized Oncology': HeartPulse,

  // Medical Technology
  'Medical Technology': Activity,
  'Medical Devices': Bot,
  'Robotic Surgery': ScanEye,
  'Imaging Systems': HeartPulse,
  'Monitoring Devices': HeartPulse,

  // Healthcare Delivery
  'Healthcare Delivery': Hospital,
  'Healthcare Services': Heart,
  'Managed Care': PillBottle,
  'Hospitals': Stethoscope,
  'Pharmacy Services': Cross,

  // AI Drug Discovery
  'AI Drug Discovery': Microscope,
  'Computational Biology': Dna,
  'Drug Simulation': BrainCircuit,

  // Consumer, media & leisure
  // Digital Commerce
  'Digital Commerce': ShoppingCart,
  'E-commerce': Store,
  'Marketplaces': ShoppingBag,
  'Omnichannel Retail': Megaphone,
  'Digital Advertising': Megaphone,

  // Gaming & Interactive Media
  'Gaming & Interactive Media': Gamepad2,
  'Gaming': Code,
  'Game Engines': Trophy,
  'Esports': Headset,
  'Interactive Entertainment': MonitorPlay,

  // Digital Media
  'Digital Media': Video,
  'Streaming': Globe,
  'Social Media': Sparkles,
  'Creator Platforms': MousePointerClick,
  'Online Advertising': MousePointerClick,

  // Luxury Automobiles
  'Luxury Automobiles': CarFront,
  'Performance Vehicles': CarFront,
  'Luxury EVs': BatteryCharging,
  'Motorsport': Trophy,

  // Luxury Goods
  'Luxury Goods': Gem,
  'Luxury': Shirt,
  'Premium Apparel': Sparkles,
  'Jewelry & Watches': ShoppingBag,
  'Beauty & Fragrance': BadgeCheck,
  'Branded Merchandise': ShoppingBag,
  'Lifestyle Licensing': BadgeCheck,

  // Travel & Leisure
  'Travel & Leisure': TentTree,
  'Hotels & Resorts': Building2,
  'Cruise Lines': Ship,
  'Airlines': Plane,
  'Experiences': TentTree,

  // Sports Betting
  'Sports Betting': Trophy,
  'Online Sportsbooks': ScrollText,
  'iGaming': Dice5,
  'Fantasy Sports': Trophy,

  // Gaming & Gambling
  'Gaming & Gambling': Coins,
  'Casinos': Dices,
  'Online Casinos': MonitorPlay,
  'Lottery Operators': Ticket,

  // Restaurant Franchises
  'Restaurant Franchises': UtensilsCrossed,
  'Quick Service Restaurants': Hamburger,
  'Restaurant Franchising': Store,

  // Beverage Brands
  'Beverage Brands': CupSoda,
  'Soft Drinks': CupSoda,
  'Alcoholic Beverages': Wine,

  // Pet Care
  'Pet Care': PawPrint,
  'Pet Food': Bone,
  'Veterinary Services': Stethoscope,
  'Veterinary Pharma': Pill,
  'Livestock Health': HeartPulse,
  'Pet Diagnostics': Microscope,

  // Food & Beverage
  'Food & Beverage': UtensilsCrossed,
  'Packaged Foods': Package,
  'Plant-Based Foods': Leaf,
  'Alternative Proteins': Sprout,
  'Meat Alternatives': Wheat,
  'Foodservice': ChefHat,
  'Food Delivery': Bike,

  // Household & Personal Care
  'Household & Personal Care': Home,
  'Home Care': House,
  'Fabric Care': Shirt,
  'Personal Care': Sparkles,
  'Beauty & Grooming': Scissors,
  'Baby & Family Care': Baby,
  'Oral Care': Smile,
  'Paper Products': FileText,

  // Consumer Health
  'Consumer Health': HeartPulse,
  'OTC Health Products': Pill,
  'Vitamins & Supplements': PillBottle,
  'Digestive Health': Activity,
  'Respiratory Health': Wind,
  'Sleep & Relaxation': Moon,
  'Sexual Wellness': Heart,

  // Retail & Distribution
  'Retail & Distribution': Store,
  'Luxury Retail': Gem,
  'Beauty Retail': Sparkles,
  'Department Stores': Building2,
  'Travel Retail': Plane,
  'Specialty Retail': ShoppingBag,
  'Direct-to-Consumer': ShoppingCart,

  // Automotive Retail
  'Automotive Retail': CarFront,
  'Auto Dealerships': Car,
  'Vehicle Distribution': Truck,

  // Industrial, infrastructure & materials
  // Logistics Networks
  'Logistics Networks': Forklift,
  'Logistics': Network,
  'Supply Chain': Package,
  'Parcel Delivery': Warehouse,
  'Freight Forwarding': Truck,
  'Cold Chain': Warehouse,

  // Air Freight & Logistics
  'Air Freight & Logistics': PlaneTakeoff,
  'Express Delivery': TicketsPlane,
  'Air Cargo': Plane,
  'Logistics Solutions': Network,

  // Marine Transportation
  'Marine Transportation': Ship,
  'Tank Barges': Droplets,
  'Petrochemical Transport': Package,
  'Container Shipping': Warehouse,
  'Dry Bulk Shipping': ShipWheel,
  'Offshore Vessels': ShipWheel,

  // Rail Transportation
  'Rail Transportation': TrainTrack,
  'Freight Rail': Route,
  'Intermodal Rail': Route,
  'Rail Equipment': Wrench,

  // Aerospace Systems
  'Aerospace Systems': PlaneTakeoff,
  'Commercial Aircraft': Plane,
  'Aircraft Engines': Zap,
  'Avionics': Radar,

  // Observability Platforms
  'Observability Platforms': Eye,
  'Infrastructure Monitoring': Activity,
  'Application Monitoring': MonitorPlay,
  'Log Analytics': ScrollText,
  'Telemetry': RadioTower,

  // National Security Space
  'National Security Space': SatelliteDish,
  'Defense Satellites': Satellite,
  'Space ISR': Binoculars,
  'Military Communications': RadioTower,

  // Electrification
  'Electrification': Zap,
  'Power Distribution': UtilityPole,
  'Electrical Equipment': Plug,
  'Energy Efficiency': Leaf,
  'Power Conversion': RefreshCw,

  // Industrial Digitalization
  'Industrial Digitalization': Factory,
  'Digital Twins': Blocks,
  'Industrial Software': Code,
  'Simulation Software': Orbit,
  'Engineering Software': Wrench,

  // Construction & Industrial Equipment
  'Construction & Industrial Equipment': Factory,
  'Construction Equipment': Truck,
  'Industrial Machinery': Factory,
  'Construction Technology': Building2,
  'Rental Equipment': Briefcase,

  // Construction Materials
  'Construction Materials': BrickWall,
  'Roofing Systems': House,
  'Flooring Systems': Grid2X2Plus,
  'Concrete Admixtures': FlaskConical,
  'Sealants & Coatings': Sparkles,

  // Precision Agriculture
  'Precision Agriculture': Sprout,
  'Agricultural Equipment': Wheat,
  'Smart Farming': Tractor,
  'Crop Inputs': FlaskConical,

  // Water Infrastructure
  'Water Infrastructure': Droplets,
  'Water Treatment': Dam,
  'Smart Water Networks': UtilityPole,
  'Water Utilities': RefreshCw,
  'Pumping Systems': FlaskRound,
  'Desalination': FlaskRound,
  'Pool Equipment': WavesLadder,

  // Environmental Services
  'Environmental Services': Recycle,
  'Waste Management': Trash,
  'Hazardous Waste': Radiation,
  'Industrial Cleanup': Factory,
  'Recycling': Recycle,
  'Environmental Remediation': Leaf,
  'Pest Control Services': BugOff,

  // Agricultural & Specialty Chemicals
  'Agricultural Chemicals': FlaskConical,
  'Fertilizer Production': Factory,
  'Ammonia Production': FlaskRound,
  'Nitrogen Products': TestTube,

  'Industrial Gases': FlaskRound,
  'Industrial Oxygen': Droplets,
  'Industrial Nitrogen': TestTube,
  'Argon & Noble Gases': Sparkles,
  'Hydrogen Supply': Fuel,
  'Medical Gases': Cross,
  'Electronic Specialty Gases': Microchip,

  'Specialty Chemicals': Factory,
  'Industrial Maintenance Chemicals': Wrench,
  'Lubricants': SoapDispenserDroplet,
  'Surface Treatments': Sparkles,
  'Cleaning Chemicals': Droplets,

  // Critical Minerals
  'Critical Minerals': FlaskConical,
  'Rare Earths': Gem,
  'Lithium': Battery,
  'Nickel': Coins,
  'Graphite': Factory,
  'Mineral Processing': Factory,

  // Copper Electrification
  'Copper Electrification': Cable,
  'Copper': Cable,
  'Copper Mining': Pickaxe,
  'Electrical Wiring': Cable,
  'Power Cables': Antenna,

  // Precious Metals
  'Precious Metals': Coins,
  'Gold': Banknote,
  'Silver': ChartLine,
  'Royalty & Streaming': Wrench,
  'Mining Services': Pickaxe,

  // Telecom Infrastructure
  'Telecom Infrastructure': RadioTower,
  'Telecommunications': RadioTower,
  '5G Infrastructure': Network,
  'Fiber Networks': Cable,
  'Tower Infrastructure': RadioTower,
  'Broadband Networks': Globe,
  'Cell Towers': RadioTower,
  'Wireless Infrastructure': Antenna,

  // Data Center Real Estate
  'Data Center Real Estate': Server,
  'Data Center REITs': Server,
  'Hyperscale Leasing': Landmark,

  // Real Estate Income
  'Real Estate Income': Landmark,
  'Industrial REITs': Warehouse,
  'Residential REITs': House,
  'Healthcare REITs': Hospital,
  'Net Lease': FileText,
  'Self Storage': Warehouse,
  // Real Estate Services
  'Real Estate Services': Landmark,
  'Property Management': Home,
  'Commercial Brokerage': Handshake,
  'Facilities Management': Wrench,
  'Real Estate Advisory': Lightbulb,

  // AdTech
  'AdTech': Megaphone,
  'Mobile Advertising': Smartphone,
  'Programmatic Advertising': Target,
  'Performance Marketing': MousePointerClick,

  // EdTech
  'EdTech': GraduationCap,
  'Online Learning': MonitorPlay,
  'Professional Training': BriefcaseBusiness,
  'Educational Software': BookOpen,

  // Human Capital
  'Human Capital': Users,
  'Staffing': UserStar,
  'HR Software': BriefcaseBusiness,
  'Payroll': Receipt,
  'Recruiting Platforms': UserSearch,

  // Testing & Certification
  'Testing & Certification': ClipboardCheck,
  'Industrial Inspection': ScanEye,
  'Product Certification': BadgeCheck,
  'Laboratory Testing': FlaskConical,

  // Professional Services
  'Professional Services': Briefcase,
  'Consulting': Lightbulb,
  'Outsourcing': Handshake,
  'Engineering Services': Brain,

  // Correctional Services
  'Correctional Services': ShieldHalf,
  'Private Prisons': Columns4,
  'Electronic Monitoring': Radar,

  // Funeral Services
  'Funeral Services': HeartHandshake,
  'Funeral Homes': House,
  'Cemeteries': Landmark,
  'Cremation Services': Flame,

  // Forestry
  'Forestry': Trees,
  'Timberlands': TreePine,
  'Wood Products': Axe,
  'Pulp & Paper': FileStack,

  // Packaging
  'Packaging': Package,
  'Consumer Packaging': ShoppingBag,
  'Industrial Packaging': Boxes,
  'Beverage Packaging': CupSoda,

  // Education Services
  'Education Services': School,
  'Universities': GraduationCap,
  'Training Providers': BookOpenCheck,
  'Student Services': Users,

  // Music Industry
  'Music Industry': Music,
  'Music Streaming': AudioLines,
  'Music Rights': CreativeCommons,
  'Record Labels': Disc3,

  // GovTech
  'GovTech': Landmark,
  'Government Software': Building,
  'Public Sector IT': Building2,
  'Defense Software': ShieldCheck,

  // Marine Recreation
  'Marine Recreation': ShipWheel,
  'Boat Retail': Ship,
  'Yacht Retail': Sailboat,
  'Yacht Services': Wrench,
  'Boat Financing': BadgeDollarSign,

  // Physical Security
  'Physical Security': ShieldAlert,
  'Alarm Monitoring': Siren,
  'Security Systems': ShieldCheck,
  'Smart Home Security': HouseWifi,
  'Fire & Life Safety': Flame,
  'Emergency Response': LifeBuoy,
  'Access Control': ScanFace,

  // Fallbacks
  'Unclassified': HelpCircle,
  'Unknown': HelpCircle,
  'Other': Briefcase,
}

const THEME_TEXT_COLORS: Record<string, string> = {
  // AI, compute, software & security
  // AI Infrastructure
  'AI Infrastructure': 'text-[#3757c6] dark:text-[#5676e7]',
  'GPU Computing': 'text-[#3968b9] dark:text-[#568be7]',
  'Accelerated Computing': 'text-[#355ebf] dark:text-[#507eed]',
  'AI Servers': 'text-[#3051c6] dark:text-[#496ff3]',
  'AI Networking': 'text-[#3f55cc] dark:text-[#5b72f4]',
  'Edge AI': 'text-[#3a46d2] dark:text-[#525ff4]',

  // AI Applications
  'AI Applications': 'text-[#77b733] dark:text-[#96d850]',
  'Generative AI': 'text-[#82aa35] dark:text-[#aad850]',
  'AI Agents': 'text-[#7cb031] dark:text-[#a1de4b]',
  'AI Software': 'text-[#73b72c] dark:text-[#97e445]',
  'Enterprise AI': 'text-[#75bd3b] dark:text-[#99eb57]',
  'Sovereign AI': 'text-[#6ac336] dark:text-[#8df151]',

  // Data Center Infrastructure
  'Data Center Infrastructure': 'text-[#b7339d] dark:text-[#d850bd]',
  'Colocation': 'text-[#aa359f] dark:text-[#d850cc]',
  'Hyperscale Data Centers': 'text-[#b2319d] dark:text-[#e04cc8]',
  'Data Center Power': 'text-[#bb2d9a] dark:text-[#e946c3]',
  'Data Center Cooling': 'text-[#c33d9a] dark:text-[#f15ac3]',

  // Networking Infrastructure
  'Networking Infrastructure': 'text-[#37c6b9] dark:text-[#56e7d9]',
  'Ethernet Switching': 'text-[#39b99f] dark:text-[#56e7ca]',
  'Optical Networking': 'text-[#35c1af] dark:text-[#50efdb]',
  'Routing': 'text-[#31cac1] dark:text-[#4af4eb]',
  'Network Equipment': 'text-[#41d0d2] dark:text-[#5bf2f4]',

  // Semiconductor Value Chain
  'Semiconductor Value Chain': 'text-[#b78433] dark:text-[#d8a350]',
  'Chip Design': 'text-[#aa6c35] dark:text-[#d89050]',
  'Semiconductor Equipment': 'text-[#b07631] dark:text-[#de9b4b]',
  'Foundry Ecosystem': 'text-[#b7812c] dark:text-[#e4a745]',
  'Advanced Packaging': 'text-[#bd943b] dark:text-[#ebbc57]',
  'Memory & Storage': 'text-[#c3a136] dark:text-[#f1ca51]',

  // Photonics & Optical Computing
  'Photonics & Optical Computing': 'text-[#5d33b7] dark:text-[#7b50d8]',
  'Optical Interconnects': 'text-[#4d35aa] dark:text-[#6d50d8]',
  'Silicon Photonics': 'text-[#5631b2] dark:text-[#764ce0]',
  'Optical Transceivers': 'text-[#5f2dbb] dark:text-[#8046e9]',
  'Co-Packaged Optics': 'text-[#763dc3] dark:text-[#9a5af1]',

  // Quantum Technology
  'Quantum Technology': 'text-[#37c63b] dark:text-[#56e75a]',
  'Quantum Computing': 'text-[#3fb939] dark:text-[#5ce756]',
  'Quantum Networking': 'text-[#37c63a] dark:text-[#52f356]',
  'Quantum Security': 'text-[#33d243] dark:text-[#4af45b]',

  // Cybersecurity Platforms
  'Cybersecurity Platforms': 'text-[#b73356] dark:text-[#d85074]',
  'Identity Security': 'text-[#aa3569] dark:text-[#d8508d]',
  'Zero Trust': 'text-[#af3060] dark:text-[#dd4a81]',
  'Threat Intelligence': 'text-[#b42b55] dark:text-[#e24474]',
  'Network Security': 'text-[#b93a57] dark:text-[#e75677]',
  'Cloud Security': 'text-[#be354a] dark:text-[#ec5068]',
  'Security Operations': 'text-[#c32f3c] dark:text-[#f14957]',
  'Endpoint Security': 'text-[#dc2626] dark:text-[#f87171]',
  'Application Security': 'text-[#e11d48] dark:text-[#fb7185]',

  // Cloud Platforms
  'Cloud Platforms': 'text-[#337cb7] dark:text-[#509bd8]',
  'Cloud Infrastructure': 'text-[#3586aa] dark:text-[#50afd8]',
  'Hyperscale Cloud': 'text-[#3180b0] dark:text-[#4ba7de]',
  'Developer Platforms': 'text-[#2c79b7] dark:text-[#459de4]',
  'Observability': 'text-[#3b79bd] dark:text-[#579eeb]',
  'Database Platforms': 'text-[#3670c3] dark:text-[#5193f1]',
  'CDN': 'text-[#2563eb] dark:text-[#60a5fa]',
  'Edge Network': 'text-[#1d4ed8] dark:text-[#93c5fd]',

  // Enterprise SaaS
  'Enterprise SaaS': 'text-[#b0c637] dark:text-[#d0e756]',
  'CRM Software': 'text-[#b9b539] dark:text-[#e7e356]',
  'ERP Software': 'text-[#b8be34] dark:text-[#e5ec4f]',
  'Workflow Automation': 'text-[#b2c32f] dark:text-[#ddf149]',
  'Digital Transformation': 'text-[#aec83e] dark:text-[#d7f45b]',
  'Customer Experience Software': 'text-[#a6cd39] dark:text-[#caf452]',
  'Productivity Software': 'text-[#9dd233] dark:text-[#bbf44a]',

  // Data Analytics Platforms
  'Data Analytics Platforms': 'text-[#a533b7] dark:text-[#c550d8]',
  'Business Intelligence': 'text-[#8d35aa] dark:text-[#b750d8]',
  'Data Warehousing': 'text-[#9c31b2] dark:text-[#c74ce0]',
  'Data Engineering': 'text-[#ad2dbb] dark:text-[#d846e9]',
  'Real-Time Analytics': 'text-[#bf3dc3] dark:text-[#ed5af1]',

  // Robotics, mobility, defense & space
  // Robotics & Automation
  'Robotics & Automation': 'text-[#33b77e] dark:text-[#50d89d]',
  'Humanoid Robotics': 'text-[#35aa62] dark:text-[#50d885]',
  'Industrial Robotics': 'text-[#30af6b] dark:text-[#4add8e]',
  'Warehouse Automation': 'text-[#2bb474] dark:text-[#44e298]',
  'Machine Vision': 'text-[#3ab987] dark:text-[#56e7ae]',
  'Industrial Automation': 'text-[#35be92] dark:text-[#50ecb9]',
  'Sensors & LiDAR': 'text-[#2fc39e] dark:text-[#49f1c7]',

  // Electric Mobility
  'Electric Mobility': 'text-[#c65f37] dark:text-[#e77e56]',
  'Electric Vehicles': 'text-[#b94f39] dark:text-[#e76f56]',
  'Charging Infrastructure': 'text-[#c15735] dark:text-[#ef7750]',
  'Powertrains': 'text-[#ca6131] dark:text-[#f4804a]',
  'Fleet Electrification': 'text-[#d27a41] dark:text-[#f4965b]',

  // Autonomous Mobility
  'Autonomous Mobility': 'text-[#3335b7] dark:text-[#5052d8]',
  'Autonomous Vehicles': 'text-[#3543aa] dark:text-[#5061d8]',
  'Robotaxis': 'text-[#3138b2] dark:text-[#4c53e0]',
  'Driver Assistance': 'text-[#302dbb] dark:text-[#4a46e9]',
  'Mobility Platforms': 'text-[#493dc3] dark:text-[#685af1]',

  // Battery Value Chain
  'Battery Value Chain': 'text-[#5bb733] dark:text-[#79d850]',
  'Battery Technology': 'text-[#69aa35] dark:text-[#8dd850]',
  'Battery Storage': 'text-[#61b031] dark:text-[#82de4b]',
  'Lithium Batteries': 'text-[#56b72c] dark:text-[#75e445]',
  'Battery Materials': 'text-[#59bd3b] dark:text-[#79eb57]',
  'Battery Recycling': 'text-[#4dc336] dark:text-[#6bf151]',

  // Defense Tech
  'Defense Tech': 'text-[#c6378d] dark:text-[#e756ad]',
  'Military AI': 'text-[#b9399d] dark:text-[#e756c7]',
  'ISR & Surveillance': 'text-[#be3496] dark:text-[#ec4fbe]',
  'Drones / UAV': 'text-[#c32f8d] dark:text-[#f149b4]',
  'Electronic Warfare': 'text-[#c83e8c] dark:text-[#f45bb2]',
  'Missile Defense': 'text-[#cd3982] dark:text-[#f452a2]',
  'Secure Communications': 'text-[#d23376] dark:text-[#f44a92]',
  'Ammunition & Ordnance': 'text-[#be123c] dark:text-[#fb7185]',

  // Space Infrastructure
  'Space Infrastructure': 'text-[#33a8b7] dark:text-[#50c8d8]',
  'Launch Services': 'text-[#35aaa6] dark:text-[#50d8d4]',
  'Satellites': 'text-[#31abb0] dark:text-[#4bd8de]',
  'Space Communications': 'text-[#2ca7b7] dark:text-[#45d2e4]',
  'Earth Observation': 'text-[#3ba5bd] dark:text-[#57cfeb]',
  'Space Systems': 'text-[#369fc3] dark:text-[#51c8f1]',

  // Geospatial Technology
  'Geospatial Technology': 'text-[#2f9bb7] dark:text-[#50c8d8]',
  'GNSS Positioning': 'text-[#2c8fb0] dark:text-[#4bb8d8]',
  'Surveying Technology': 'text-[#2fa7b7] dark:text-[#4bd2de]',
  'Geospatial Software': 'text-[#317fb7] dark:text-[#50a8e7]',
  'Mapping Systems': 'text-[#2d94b0] dark:text-[#4bb0d8]',
  'Location Intelligence': 'text-[#2aa1b0] dark:text-[#48c6d8]',

  // Energy & decarbonization
  // Nuclear Energy
  'Nuclear Energy': 'text-[#b79f33] dark:text-[#d8bf50]',
  'Nuclear': 'text-[#aa8835] dark:text-[#d8b050]',
  'SMR': 'text-[#b29631] dark:text-[#e0c04c]',
  'Uranium': 'text-[#bba62d] dark:text-[#e9d146]',
  'Nuclear Services': 'text-[#c3b93d] dark:text-[#f1e65a]',

  // Grid Modernization
  'Grid Modernization': 'text-[#8337c6] dark:text-[#a356e7]',
  'Grid Infrastructure': 'text-[#6b39b9] dark:text-[#8e56e7]',
  'Power Generation': 'text-[#7435bf] dark:text-[#9850ed]',
  'Transmission Equipment': 'text-[#7f30c6] dark:text-[#a449f3]',
  'Power Electronics': 'text-[#943fcc] dark:text-[#b75bf4]',
  'Smart Grid': 'text-[#a13ad2] dark:text-[#c052f4]',

  // Renewable Power
  'Renewable Power': 'text-[#33b752] dark:text-[#50d870]',
  'Solar': 'text-[#35aa44] dark:text-[#50d861]',
  'Wind': 'text-[#31b24b] dark:text-[#4ce069]',
  'Renewable Developers': 'text-[#2dbb53] dark:text-[#46e972]',
  'Renewable Equipment': 'text-[#3dc36b] dark:text-[#5af18e]',

  // Clean Fuels
  'Clean Fuels': 'text-[#b7333a] dark:text-[#d85057]',
  'Hydrogen': 'text-[#aa3548] dark:text-[#d85066]',
  'Renewable Natural Gas': 'text-[#b2313d] dark:text-[#e04c59]',
  'Sustainable Aviation Fuel': 'text-[#bb2d30] dark:text-[#e94649]',
  'Biofuels': 'text-[#c3443d] dark:text-[#f1625a]',

  // Carbon Management
  'Carbon Management': 'text-[#3769c6] dark:text-[#5688e7]',
  'Carbon Capture': 'text-[#396fb9] dark:text-[#5693e7]',
  'Carbon Markets': 'text-[#3769c6] dark:text-[#528af3]',
  'Emissions Monitoring': 'text-[#335fd2] dark:text-[#4a79f4]',

  // Energy Transport
  'Oil & Gas': 'text-[#b75a27] dark:text-[#e89250]',
  'Crude Oil Production': 'text-[#a84f2a] dark:text-[#d87e4a]',
  'Natural Gas Production': 'text-[#7fb031] dark:text-[#b4e44b]',
  'Natural Gas Liquids': 'text-[#86a02f] dark:text-[#c1e04a]',
  'Integrated Energy': 'text-[#8b5f31] dark:text-[#b87e50]',

  'Energy Transport': 'text-[#87b733] dark:text-[#a6d850]',
  'Pipelines': 'text-[#84b72c] dark:text-[#aae445]',
  'LNG Infrastructure': 'text-[#8bb031] dark:text-[#b3de4b]',
  'Storage Terminals': 'text-[#6b5f3a] dark:text-[#a68f50]',
  'Midstream Infrastructure': 'text-[#5f7a3b] dark:text-[#8fb150]',

  'Energy Services': 'text-[#7cc336] dark:text-[#a0f151]',
  'Oilfield Services': 'text-[#6f6f34] dark:text-[#9f9f57]',
  'Drilling Services': 'text-[#8b4f2f] dark:text-[#c77b50]',
  'Completion Services': 'text-[#7a5f3a] dark:text-[#ad8f58]',

  // Finance, crypto & real estate finance
  // Digital Finance
  'Digital Finance': 'text-[#b733ae] dark:text-[#d850ce]',
  'Fintech': 'text-[#a535aa] dark:text-[#d250d8]',
  'Digital Banking': 'text-[#b231ae] dark:text-[#e04cdb]',
  'Payments': 'text-[#bb2dac] dark:text-[#e946d8]',
  'Lending Platforms': 'text-[#c33dac] dark:text-[#f15ad6]',

  // Investment Platforms
  'Investment Platforms': 'text-[#37c6a6] dark:text-[#56e7c6]',
  'Asset Management': 'text-[#39b98f] dark:text-[#56e7b7]',
  'Wealth Technology': 'text-[#31caad] dark:text-[#4af4d4]',

  // Market Infrastructure
  'Market Infrastructure': 'text-[#35c19d] dark:text-[#50efc6]',
  'Exchange Operators': 'text-[#41d2c1] dark:text-[#5bf4e3]',
  'Trading Infrastructure': 'text-[#2fb7a2] dark:text-[#48dfc8]',
  'Market Data': 'text-[#2aa899] dark:text-[#43d0c0]',
  'Index Providers': 'text-[#259b8d] dark:text-[#3ac3b4]',
  'Credit Ratings': 'text-[#238f84] dark:text-[#35b8aa]',

  // Insurance
  'Insurance': 'text-[#2563eb] dark:text-[#60a5fa]',
  'P&C Insurance': 'text-[#1d4ed8] dark:text-[#3b82f6]',
  'Life Insurance': 'text-[#2563d8] dark:text-[#5b9bff]',
  'Reinsurance': 'text-[#1e40af] dark:text-[#4f83f1]',
  'Insurance Brokers': 'text-[#1d4e89] dark:text-[#4ba3d9]',

  // Crypto Infrastructure
  'Crypto Infrastructure': 'text-[#b77333] dark:text-[#d89250]',
  'Digital Assets': 'text-[#aa6135] dark:text-[#d88350]',
  'Crypto Exchanges': 'text-[#b26b31] dark:text-[#e08e4c]',
  'Blockchain Infrastructure': 'text-[#bb772d] dark:text-[#e99b46]',
  'Bitcoin Mining': 'text-[#c38d3d] dark:text-[#f1b45a]',
  'Stablecoin': 'text-[#ca8a04] dark:text-[#facc15]',
  'Cryptocurrency': 'text-[#b45309] dark:text-[#fbbf24]',

  // Mortgage Finance
  'Mortgage Finance': 'text-[#333bb7] dark:text-[#5058d8]',
  'Secondary Mortgage Market': 'text-[#354daa] dark:text-[#506cd8]',
  'Mortgage Securitization': 'text-[#3142b0] dark:text-[#4b5ede]',
  'Mortgage Guarantees': 'text-[#2c34b7] dark:text-[#454fe4]',
  'Single-Family Mortgages': 'text-[#3c3bbd] dark:text-[#5957eb]',
  'Multifamily Mortgages': 'text-[#4236c3] dark:text-[#5f51f1]',

  // Healthcare & biotech
  // Biotechnology Platforms
  'Biotechnology Platforms': 'text-[#4c33b7] dark:text-[#6a50d8]',
  'Drug Discovery': 'text-[#3a35aa] dark:text-[#5650d8]',
  'Biologics': 'text-[#4031b0] dark:text-[#5c4bde]',
  'Gene Therapy': 'text-[#462cb7] dark:text-[#6345e4]',
  'Cell Therapy': 'text-[#5d3bbd] dark:text-[#7e57eb]',
  'Clinical Platforms': 'text-[#6536c3] dark:text-[#8751f1]',

  // Precision Medicine
  'Precision Medicine': 'text-[#45c637] dark:text-[#64e756]',
  'Diagnostics': 'text-[#54b939] dark:text-[#74e756]',
  'Genomics': 'text-[#48c135] dark:text-[#66ef50]',
  'Targeted Therapies': 'text-[#3aca31] dark:text-[#54f44a]',
  'Personalized Oncology': 'text-[#41d243] dark:text-[#5bf45c]',

  // Medical Technology
  'Medical Technology': 'text-[#b73367] dark:text-[#d85086]',
  'Medical Devices': 'text-[#aa3570] dark:text-[#d85094]',
  'Robotic Surgery': 'text-[#b23169] dark:text-[#e04c8b]',
  'Imaging Systems': 'text-[#bb2d60] dark:text-[#e94680]',
  'Monitoring Devices': 'text-[#c33d63] dark:text-[#f15a85]',

  // Healthcare Delivery
  'Healthcare Delivery': 'text-[#338db7] dark:text-[#50add8]',
  'Healthcare Services': 'text-[#3591aa] dark:text-[#50bbd8]',
  'Managed Care': 'text-[#318eb2] dark:text-[#4cb6e0]',
  'Hospitals': 'text-[#2d89bb] dark:text-[#46afe9]',
  'Pharmacy Services': 'text-[#3d8ac3] dark:text-[#5ab1f1]',

  // AI Drug Discovery
  'AI Drug Discovery': 'text-[#377bc6] dark:text-[#569be7]',
  'Computational Biology': 'text-[#397fb9] dark:text-[#56a5e7]',
  'Drug Simulation': 'text-[#3373d2] dark:text-[#4a8ef4]',

  // Consumer, media & leisure
  // Digital Commerce
  'Digital Commerce': 'text-[#c3c637] dark:text-[#e4e756]',
  'E-commerce': 'text-[#b9ae39] dark:text-[#e7da56]',
  'Marketplaces': 'text-[#c1bf35] dark:text-[#efed50]',
  'Omnichannel Retail': 'text-[#c1ca31] dark:text-[#ebf44a]',
  'Digital Advertising': 'text-[#c0d241] dark:text-[#e0f45b]',

  // Gaming & Interactive Media
  'Gaming & Interactive Media': 'text-[#9433b7] dark:text-[#b450d8]',
  'Gaming': 'text-[#7e35aa] dark:text-[#a550d8]',
  'Game Engines': 'text-[#8b31b2] dark:text-[#b34ce0]',
  'Esports': 'text-[#9a2dbb] dark:text-[#c346e9]',
  'Interactive Entertainment': 'text-[#ae3dc3] dark:text-[#d95af1]',

  // Digital Media
  'Digital Media': 'text-[#33b76d] dark:text-[#50d88c]',
  'Streaming': 'text-[#35aa5c] dark:text-[#50d87d]',
  'Social Media': 'text-[#31b265] dark:text-[#4ce088]',
  'Creator Platforms': 'text-[#2dbb70] dark:text-[#46e993]',
  'Online Advertising': 'text-[#3dc386] dark:text-[#5af1ad]',

  // Luxury Automobiles
  'Luxury Automobiles': 'text-[#c64d37] dark:text-[#e76c56]',
  'Performance Vehicles': 'text-[#b94439] dark:text-[#e76256]',
  'Luxury EVs': 'text-[#c64d37] dark:text-[#f36b52]',
  'Motorsport': 'text-[#d25733] dark:text-[#f4704a]',

  // Luxury Goods
  'Luxury Goods': 'text-[#3346b7] dark:text-[#5064d8]',
  'Luxury': 'text-[#355baa] dark:text-[#507cd8]',
  'Premium Apparel': 'text-[#3050af] dark:text-[#4a6fdd]',
  'Jewelry & Watches': 'text-[#2b44b4] dark:text-[#4461e2]',
  'Beauty & Fragrance': 'text-[#3a47b9] dark:text-[#5666e7]',
  'Branded Merchandise': 'text-[#353abe] dark:text-[#5055ec]',
  'Lifestyle Licensing': 'text-[#352fc3] dark:text-[#4f49f1]',

  // Travel & Leisure
  'Travel & Leisure': 'text-[#6cb733] dark:text-[#8bd850]',
  'Hotels & Resorts': 'text-[#74aa35] dark:text-[#99d850]',
  'Cruise Lines': 'text-[#6eb231] dark:text-[#91e04c]',
  'Airlines': 'text-[#65bb2d] dark:text-[#87e946]',
  'Experiences': 'text-[#68c33d] dark:text-[#8bf15a]',

  // Sports Betting
  'Sports Betting': 'text-[#7db733] dark:text-[#9cd850]',
  'Online Sportsbooks': 'text-[#7faa35] dark:text-[#a6d850]',
  'iGaming': 'text-[#7db733] dark:text-[#a2e44d]',
  'Fantasy Sports': 'text-[#78c32f] dark:text-[#9bf149]',

  // Gaming & Gambling
  'Gaming & Gambling': 'text-[#a855f7] dark:text-[#c084fc]',
  'Casinos': 'text-[#9333ea] dark:text-[#d8b4fe]',
  'Online Casinos': 'text-[#7e22ce] dark:text-[#c084fc]',
  'Lottery Operators': 'text-[#6d28d9] dark:text-[#a78bfa]',

  // Restaurant Franchises
  'Restaurant Franchises': 'text-[#5e37c6] dark:text-[#7d56e7]',
  'Quick Service Restaurants': 'text-[#5839b9] dark:text-[#7856e7]',
  'Restaurant Franchising': 'text-[#693ad2] dark:text-[#8452f4]',

  // Beverage Brands
  'Beverage Brands': 'text-[#35b733] dark:text-[#52d850]',
  'Soft Drinks': 'text-[#3baa35] dark:text-[#57d850]',
  'Alcoholic Beverages': 'text-[#36c339] dark:text-[#51f155]',

  // Pet Care
  'Pet Care': 'text-[#b7335c] dark:text-[#d8507a]',
  'Pet Food': 'text-[#aa355d] dark:text-[#d8507f]',
  'Veterinary Services': 'text-[#c3365d] dark:text-[#f1517d]',
  'Veterinary Pharma': 'text-[#b91c5c] dark:text-[#ec4899]',
  'Livestock Health': 'text-[#a21caf] dark:text-[#d946ef]',
  'Pet Diagnostics': 'text-[#9333ea] dark:text-[#c084fc]',

  // Food & Beverage
  'Food & Beverage': 'text-[#378ec6] dark:text-[#56aee7]',
  'Packaged Foods': 'text-[#399eb9] dark:text-[#56c8e7]',
  'Plant-Based Foods': 'text-[#3497be] dark:text-[#4fbfec]',
  'Alternative Proteins': 'text-[#2f8ec3] dark:text-[#49b5f1]',
  'Meat Alternatives': 'text-[#3e8dc8] dark:text-[#5bb3f4]',
  'Foodservice': 'text-[#3983cd] dark:text-[#52a3f4]',
  'Food Delivery': 'text-[#3377d2] dark:text-[#4a93f4]',

  // Household & Personal Care
  'Household & Personal Care': 'text-[#a9b733] dark:text-[#c9d850]',
  'Home Care': 'text-[#aa9d35] dark:text-[#d8c950]',
  'Fabric Care': 'text-[#aea930] dark:text-[#dcd64a]',
  'Personal Care': 'text-[#aeb22b] dark:text-[#dbe044]',
  'Beauty & Grooming': 'text-[#a9b739] dark:text-[#d5e455]',
  'Baby & Family Care': 'text-[#a3bb34] dark:text-[#cde94e]',
  'Oral Care': 'text-[#9bbf2e] dark:text-[#c4ed48]',
  'Paper Products': 'text-[#98c33d] dark:text-[#c0f15a]',

  // Consumer Health
  'Consumer Health': 'text-[#9e33b7] dark:text-[#be50d8]',
  'OTC Health Products': 'text-[#7f35aa] dark:text-[#a650d8]',
  'Vitamins & Supplements': 'text-[#8930af] dark:text-[#b14add]',
  'Digestive Health': 'text-[#952bb4] dark:text-[#be44e2]',
  'Respiratory Health': 'text-[#a63ab9] dark:text-[#d156e7]',
  'Sleep & Relaxation': 'text-[#b335be] dark:text-[#df50ec]',
  'Sexual Wellness': 'text-[#c22fc3] dark:text-[#f049f1]',

  // Retail & Distribution
  'Retail & Distribution': 'text-[#37c682] dark:text-[#56e7a2]',
  'Luxury Retail': 'text-[#39b965] dark:text-[#56e788]',
  'Beauty Retail': 'text-[#34be6e] dark:text-[#4fec90]',
  'Department Stores': 'text-[#2fc377] dark:text-[#49f19b]',
  'Travel Retail': 'text-[#3ec88b] dark:text-[#5bf4b1]',
  'Specialty Retail': 'text-[#39cd97] dark:text-[#52f4b9]',
  'Direct-to-Consumer': 'text-[#33d2a3] dark:text-[#4af4c2]',

  // Automotive Retail
  'Automotive Retail': 'text-[#b75133] dark:text-[#d86f50]',
  'Auto Dealerships': 'text-[#aa4b35] dark:text-[#d86a50]',
  'Vehicle Distribution': 'text-[#c35b36] dark:text-[#f17b51]',

  // Industrial, infrastructure & materials
  // Logistics Networks
  'Logistics Networks': 'text-[#c6379f] dark:text-[#e756bf]',
  'Logistics': 'text-[#b939a8] dark:text-[#e756d4]',
  'Supply Chain': 'text-[#bf35a3] dark:text-[#ed50cd]',
  'Parcel Delivery': 'text-[#c6309d] dark:text-[#f349c5]',
  'Freight Forwarding': 'text-[#cc3f9b] dark:text-[#f45bbf]',
  'Cold Chain': 'text-[#d23a93] dark:text-[#f452b1]',

  // Air Freight & Logistics
  'Air Freight & Logistics': 'text-[#0ea5e9] dark:text-[#7dd3fc]',
  'Express Delivery': 'text-[#0284c7] dark:text-[#38bdf8]',
  'Air Cargo': 'text-[#0369a1] dark:text-[#7dd3fc]',
  'Logistics Solutions': 'text-[#075985] dark:text-[#bae6fd]',

  // Marine Transportation
  'Marine Transportation': 'text-[#33b7b5] dark:text-[#50d8d6]',
  'Tank Barges': 'text-[#35aa97] dark:text-[#50d8c2]',
  'Petrochemical Transport': 'text-[#31b0a5] dark:text-[#4bded1]',
  'Container Shipping': 'text-[#2cb7b4] dark:text-[#45e4e2]',
  'Dry Bulk Shipping': 'text-[#3bb5bd] dark:text-[#57e2eb]',
  'Offshore Vessels': 'text-[#36b1c3] dark:text-[#51ddf1]',

  // Rail Transportation
  'Rail Transportation': 'text-[#b78e33] dark:text-[#d8ae50]',
  'Freight Rail': 'text-[#aa7d35] dark:text-[#d8a450]',
  'Intermodal Rail': 'text-[#b78e33] dark:text-[#e4b54d]',
  'Rail Equipment': 'text-[#c3a02f] dark:text-[#f1c949]',

  // Aerospace Systems
  'Aerospace Systems': 'text-[#7037c6] dark:text-[#8f56e7]',
  'Commercial Aircraft': 'text-[#6339b9] dark:text-[#8556e7]',
  'Aircraft Engines': 'text-[#6f37c6] dark:text-[#9252f3]',
  'Avionics': 'text-[#7e33d2] dark:text-[#9a4af4]',

  // Observability Platforms
  'Observability Platforms': 'text-[#33b741] dark:text-[#50d85f]',
  'Infrastructure Monitoring': 'text-[#35aa35] dark:text-[#51d850]',
  'Application Monitoring': 'text-[#31b23a] dark:text-[#4ce056]',
  'Log Analytics': 'text-[#2dbb41] dark:text-[#46e95d]',
  'Telemetry': 'text-[#3dc35a] dark:text-[#5af17a]',

  // National Security Space
  'National Security Space': 'text-[#b7334b] dark:text-[#d85069]',
  'Defense Satellites': 'text-[#aa3553] dark:text-[#d85073]',
  'Space ISR': 'text-[#b7334a] dark:text-[#e44d69]',
  'Military Communications': 'text-[#c32f3f] dark:text-[#f1495b]',

  // Electrification
  'Electrification': 'text-[#98b733] dark:text-[#b8d850]',
  'Power Distribution': 'text-[#9baa35] dark:text-[#c6d850]',
  'Electrical Equipment': 'text-[#99b231] dark:text-[#c3e04c]',
  'Energy Efficiency': 'text-[#94bb2d] dark:text-[#bde946]',
  'Power Conversion': 'text-[#95c33d] dark:text-[#bdf15a]',

  // Industrial Digitalization
  'Industrial Digitalization': 'text-[#af33b7] dark:text-[#cf50d8]',
  'Digital Twins': 'text-[#9635aa] dark:text-[#c150d8]',
  'Industrial Software': 'text-[#a631b2] dark:text-[#d24ce0]',
  'Simulation Software': 'text-[#b72dbb] dark:text-[#e546e9]',
  'Engineering Software': 'text-[#c33dbd] dark:text-[#f15aea]',

  // Construction & Industrial Equipment
  'Construction & Industrial Equipment': 'text-[#37c694] dark:text-[#56e7b4]',
  'Construction Equipment': 'text-[#39b97e] dark:text-[#56e7a4]',
  'Industrial Machinery': 'text-[#35c18b] dark:text-[#50efb2]',
  'Construction Technology': 'text-[#31ca9a] dark:text-[#4af4bf]',
  'Rental Equipment': 'text-[#41d2af] dark:text-[#5bf4cf]',

  // Construction Materials
  'Construction Materials': 'text-[#b76f33] dark:text-[#d89250]',
  'Roofing Systems': 'text-[#aa6a35] dark:text-[#d88e50]',
  'Flooring Systems': 'text-[#b27335] dark:text-[#e29b50]',
  'Concrete Admixtures': 'text-[#c36f2f] dark:text-[#f19149]',
  'Sealants & Coatings': 'text-[#7a5530] dark:text-[#a37650]',

  // Precision Agriculture
  'Precision Agriculture': 'text-[#b76233] dark:text-[#d88050]',
  'Agricultural Equipment': 'text-[#aa5635] dark:text-[#d87750]',
  'Smart Farming': 'text-[#b76133] dark:text-[#e4834d]',
  'Crop Inputs': 'text-[#c36f2f] dark:text-[#f19149]',

  // Water Infrastructure
  'Water Infrastructure': 'text-[#3c33b7] dark:text-[#5a50d8]',
  'Water Treatment': 'text-[#353eaa] dark:text-[#505bd8]',
  'Smart Water Networks': 'text-[#3131b0] dark:text-[#4b4bde]',
  'Water Utilities': 'text-[#362cb7] dark:text-[#5045e4]',
  'Pumping Systems': 'text-[#4d3bbd] dark:text-[#6c57eb]',
  'Desalination': 'text-[#5436c3] dark:text-[#7351f1]',
  'Pool Equipment': 'text-[#2fa8c8] dark:text-[#50d2ee]',

  // Environmental Services
  'Environmental Services': 'text-[#58c637] dark:text-[#77e756]',
  'Waste Management': 'text-[#69b939] dark:text-[#8ce756]',
  'Hazardous Waste': 'text-[#5fbf35] dark:text-[#7fed50]',
  'Industrial Cleanup': 'text-[#52c630] dark:text-[#71f349]',
  'Recycling': 'text-[#56cc3f] dark:text-[#73f45b]',
  'Environmental Remediation': 'text-[#47d23a] dark:text-[#60f452]',
  'Pest Control Services': 'text-[#67b93a] dark:text-[#89e85a]',

  // Agricultural & Specialty Chemicals
  'Agricultural Chemicals': 'text-[#c07b2e] dark:text-[#e09c50]',
  'Fertilizer Production': 'text-[#b96f2a] dark:text-[#d88f48]',
  'Ammonia Production': 'text-[#c68331] dark:text-[#e2a84f]',
  'Nitrogen Products': 'text-[#d39440] dark:text-[#f1c060]',

  'Industrial Gases': 'text-[#1785a6] dark:text-[#43c1df]',
  'Industrial Oxygen': 'text-[#147999] dark:text-[#3db7d5]',
  'Industrial Nitrogen': 'text-[#1a8daf] dark:text-[#52c7e5]',
  'Argon & Noble Gases': 'text-[#229cb9] dark:text-[#65d4ed]',
  'Hydrogen Supply': 'text-[#0f8f93] dark:text-[#42d1d5]',
  'Medical Gases': 'text-[#2e8fc7] dark:text-[#65c7f1]',
  'Electronic Specialty Gases': 'text-[#336fc2] dark:text-[#6aa4f4]',

  'Specialty Chemicals': 'text-[#6b33b7] dark:text-[#8f50d8]',
  'Industrial Maintenance Chemicals': 'text-[#5d2db0] dark:text-[#7b4bd6]',
  'Lubricants': 'text-[#5530a8] dark:text-[#7a4ad0]',
  'Surface Treatments': 'text-[#7a4ad0] dark:text-[#9a6cf1]',
  'Cleaning Chemicals': 'text-[#8a5ae0] dark:text-[#b08cf8]',

  // Critical Minerals
  'Critical Minerals': 'text-[#b73377] dark:text-[#d85096]',
  'Rare Earths': 'text-[#aa3582] dark:text-[#d850aa]',
  'Lithium': 'text-[#b0317c] dark:text-[#de4ba1]',
  'Nickel': 'text-[#b72c73] dark:text-[#e44597]',
  'Graphite': 'text-[#bd3b75] dark:text-[#eb5799]',
  'Mineral Processing': 'text-[#c3366a] dark:text-[#f1518d]',

  // Copper Electrification
  'Copper Electrification': 'text-[#339eb7] dark:text-[#50bed8]',
  'Copper': 'text-[#35a0aa] dark:text-[#50cdd8]',
  'Copper Mining': 'text-[#319eb2] dark:text-[#4cc9e0]',
  'Electrical Wiring': 'text-[#2d9bbb] dark:text-[#46c4e9]',
  'Power Cables': 'text-[#3d9bc3] dark:text-[#5ac4f1]',

  // Precious Metals
  'Precious Metals': 'text-[#c6b837] dark:text-[#e7d856]',
  'Gold': 'text-[#b99f39] dark:text-[#e7c956]',
  'Silver': 'text-[#c1af35] dark:text-[#efda50]',
  'Royalty & Streaming': 'text-[#cac031] dark:text-[#f4ea4a]',
  'Mining Services': 'text-[#d1d241] dark:text-[#f3f45b]',

  // Telecom Infrastructure
  'Telecom Infrastructure': 'text-[#8333b7] dark:text-[#a250d8]',
  'Telecommunications': 'text-[#6b35aa] dark:text-[#8f50d8]',
  '5G Infrastructure': 'text-[#7531b0] dark:text-[#994bde]',
  'Fiber Networks': 'text-[#802cb7] dark:text-[#a645e4]',
  'Tower Infrastructure': 'text-[#933bbd] dark:text-[#bb57eb]',
  'Broadband Networks': 'text-[#a036c3] dark:text-[#c951f1]',
  'Cell Towers': 'text-[#7c3aed] dark:text-[#a78bfa]',
  'Wireless Infrastructure': 'text-[#6d28d9] dark:text-[#c4b5fd]',

  // Data Center Real Estate
  'Data Center Real Estate': 'text-[#33b75d] dark:text-[#50d87b]',
  'Data Center REITs': 'text-[#35aa52] dark:text-[#50d872]',
  'Hyperscale Leasing': 'text-[#2fc369] dark:text-[#49f18b]',

  // Real Estate Income
  'Real Estate Income': 'text-[#c63a37] dark:text-[#e75956]',
  'Industrial REITs': 'text-[#b93949] dark:text-[#e75668]',
  'Residential REITs': 'text-[#bf353c] dark:text-[#ed5058]',
  'Healthcare REITs': 'text-[#c63330] dark:text-[#f34d49]',
  'Net Lease': 'text-[#cc4c3f] dark:text-[#f4695b]',
  'Self Storage': 'text-[#d2533a] dark:text-[#f46d52]',
  // Real Estate Services
  'Real Estate Services': 'text-[#3356b7] dark:text-[#5074d8]',
  'Property Management': 'text-[#355caa] dark:text-[#507ed8]',
  'Commercial Brokerage': 'text-[#334155] dark:text-[#cbd5e1]',
  'Facilities Management': 'text-[#64748b] dark:text-[#cbd5e1]',
  'Real Estate Advisory': 'text-[#3b82f6] dark:text-[#93c5fd]',

  // AdTech
  'AdTech': 'text-[#3356b7] dark:text-[#5074d8]',
  'Mobile Advertising': 'text-[#355caa] dark:text-[#507ed8]',
  'Programmatic Advertising': 'text-[#3356b7] dark:text-[#4d75e4]',
  'Performance Marketing': 'text-[#2f4cc3] dark:text-[#4969f1]',

  // EdTech
  'EdTech': 'text-[#c637b1] dark:text-[#e756d1]',
  'Online Learning': 'text-[#b939af] dark:text-[#e756dc]',
  'Professional Training': 'text-[#c637b1] dark:text-[#f352dc]',
  'Educational Software': 'text-[#d233af] dark:text-[#f44acf]',

  // Human Capital
  'Human Capital': 'text-[#0f766e] dark:text-[#2dd4bf]',
  'Staffing': 'text-[#0d9488] dark:text-[#5eead4]',
  'HR Software': 'text-[#0891b2] dark:text-[#67e8f9]',
  'Payroll': 'text-[#0284c7] dark:text-[#38bdf8]',
  'Recruiting Platforms': 'text-[#0369a1] dark:text-[#7dd3fc]',

  // Testing & Certification
  'Testing & Certification': 'text-[#7c3aed] dark:text-[#a78bfa]',
  'Industrial Inspection': 'text-[#6d28d9] dark:text-[#8b5cf6]',
  'Product Certification': 'text-[#5b21b6] dark:text-[#a78bfa]',
  'Laboratory Testing': 'text-[#9333ea] dark:text-[#c084fc]',

  // Professional Services
  'Professional Services': 'text-[#475569] dark:text-[#94a3b8]',
  'Consulting': 'text-[#334155] dark:text-[#cbd5e1]',
  'Outsourcing': 'text-[#4b5563] dark:text-[#9ca3af]',
  'Engineering Services': 'text-[#64748b] dark:text-[#cbd5e1]',

  // Correctional Services
  'Correctional Services': 'text-[#7f1d1d] dark:text-[#f87171]',
  'Private Prisons': 'text-[#991b1b] dark:text-[#ef4444]',
  'Electronic Monitoring': 'text-[#b91c1c] dark:text-[#fca5a5]',

  // Funeral Services
  'Funeral Services': 'text-[#52525b] dark:text-[#a1a1aa]',
  'Funeral Homes': 'text-[#3f3f46] dark:text-[#d4d4d8]',
  'Cemeteries': 'text-[#71717a] dark:text-[#a1a1aa]',
  'Cremation Services': 'text-[#a16207] dark:text-[#facc15]',

  // Forestry
  'Forestry': 'text-[#166534] dark:text-[#4ade80]',
  'Timberlands': 'text-[#15803d] dark:text-[#86efac]',
  'Wood Products': 'text-[#854d0e] dark:text-[#fbbf24]',
  'Pulp & Paper': 'text-[#4d7c0f] dark:text-[#a3e635]',

  // Packaging
  'Packaging': 'text-[#be123c] dark:text-[#fb7185]',
  'Consumer Packaging': 'text-[#e11d48] dark:text-[#fda4af]',
  'Industrial Packaging': 'text-[#9f1239] dark:text-[#fb7185]',
  'Beverage Packaging': 'text-[#db2777] dark:text-[#f9a8d4]',

  // Education Services
  'Education Services': 'text-[#1d4ed8] dark:text-[#93c5fd]',
  'Universities': 'text-[#1e40af] dark:text-[#60a5fa]',
  'Training Providers': 'text-[#2563eb] dark:text-[#bfdbfe]',
  'Student Services': 'text-[#3b82f6] dark:text-[#93c5fd]',

  // Music Industry
  'Music Industry': 'text-[#c026d3] dark:text-[#e879f9]',
  'Music Streaming': 'text-[#db2777] dark:text-[#f9a8d4]',
  'Music Rights': 'text-[#a21caf] dark:text-[#f0abfc]',
  'Record Labels': 'text-[#7e22ce] dark:text-[#d8b4fe]',

  // GovTech
  'GovTech': 'text-[#33b7a4] dark:text-[#50d8c4]',
  'Government Software': 'text-[#35aa91] dark:text-[#50d8ba]',
  'Public Sector IT': 'text-[#33b7a3] dark:text-[#4de4cf]',
  'Defense Software': 'text-[#2fc3b9] dark:text-[#49f1e5]',

  // Marine Recreation
  'Marine Recreation': 'text-[#b77d33] dark:text-[#d89c50]',
  'Boat Retail': 'text-[#aa6a35] dark:text-[#d88e50]',
  'Yacht Retail': 'text-[#b27531] dark:text-[#e09a4c]',
  'Yacht Services': 'text-[#bb822d] dark:text-[#e9a746]',
  'Boat Financing': 'text-[#c3973d] dark:text-[#f1bf5a]',

  // Physical Security
  'Physical Security': 'text-[#b91c1c] dark:text-[#b91c1c]',
  'Alarm Monitoring': 'text-[#dc2626] dark:text-[#dc2626]',
  'Security Systems': 'text-[#ab0808] dark:text-[#ab0808]',
  'Smart Home Security': 'text-[#d81d45] dark:text-[#d81d45]',
  'Fire & Life Safety': 'text-[#ea580c] dark:text-[#ea580c]',
  'Emergency Response': 'text-[#e11d48] dark:text-[#e11d48]',
  'Access Control': 'text-[#991b1b] dark:text-[#fca5a5]',

  // Fallbacks
  'Unclassified': 'text-[#9ca3af] dark:text-[#9ca3af]',
  'Unknown': 'text-[#9ca3af] dark:text-[#9ca3af]',
  'Other': 'text-[#737373] dark:text-[#737373]',
}

const THEME_HEX_COLORS: Record<string, string> = {
  // AI, compute, software & security
  // AI Infrastructure
  'AI Infrastructure': '#3757c6',
  'GPU Computing': '#3968b9',
  'Accelerated Computing': '#355ebf',
  'AI Servers': '#3051c6',
  'AI Networking': '#3f55cc',
  'Edge AI': '#3a46d2',

  // AI Applications
  'AI Applications': '#77b733',
  'Generative AI': '#82aa35',
  'AI Agents': '#7cb031',
  'AI Software': '#73b72c',
  'Enterprise AI': '#75bd3b',
  'Sovereign AI': '#6ac336',

  // Data Center Infrastructure
  'Data Center Infrastructure': '#b7339d',
  'Colocation': '#aa359f',
  'Hyperscale Data Centers': '#b2319d',
  'Data Center Power': '#bb2d9a',
  'Data Center Cooling': '#c33d9a',

  // Networking Infrastructure
  'Networking Infrastructure': '#37c6b9',
  'Ethernet Switching': '#39b99f',
  'Optical Networking': '#35c1af',
  'Routing': '#31cac1',
  'Network Equipment': '#41d0d2',

  // Semiconductor Value Chain
  'Semiconductor Value Chain': '#b78433',
  'Chip Design': '#aa6c35',
  'Semiconductor Equipment': '#b07631',
  'Foundry Ecosystem': '#b7812c',
  'Advanced Packaging': '#bd943b',
  'Memory & Storage': '#c3a136',

  // Photonics & Optical Computing
  'Photonics & Optical Computing': '#5d33b7',
  'Optical Interconnects': '#4d35aa',
  'Silicon Photonics': '#5631b2',
  'Optical Transceivers': '#5f2dbb',
  'Co-Packaged Optics': '#763dc3',

  // Quantum Technology
  'Quantum Technology': '#37c63b',
  'Quantum Computing': '#3fb939',
  'Quantum Networking': '#37c63a',
  'Quantum Security': '#33d243',

  // Cybersecurity Platforms
  'Cybersecurity Platforms': '#b73356',
  'Identity Security': '#aa3569',
  'Zero Trust': '#af3060',
  'Threat Intelligence': '#b42b55',
  'Network Security': '#b93a57',
  'Cloud Security': '#be354a',
  'Security Operations': '#c32f3c',
  'Endpoint Security': '#dc2626',
  'Application Security': '#e11d48',

  // Cloud Platforms
  'Cloud Platforms': '#337cb7',
  'Cloud Infrastructure': '#3586aa',
  'Hyperscale Cloud': '#3180b0',
  'Developer Platforms': '#2c79b7',
  'Observability': '#3b79bd',
  'Database Platforms': '#3670c3',
  'CDN': '#2563eb',
  'Edge Network': '#1d4ed8',

  // Enterprise SaaS
  'Enterprise SaaS': '#b0c637',
  'CRM Software': '#b9b539',
  'ERP Software': '#b8be34',
  'Workflow Automation': '#b2c32f',
  'Digital Transformation': '#aec83e',
  'Customer Experience Software': '#a6cd39',
  'Productivity Software': '#9dd233',

  // Data Analytics Platforms
  'Data Analytics Platforms': '#a533b7',
  'Business Intelligence': '#8d35aa',
  'Data Warehousing': '#9c31b2',
  'Data Engineering': '#ad2dbb',
  'Real-Time Analytics': '#bf3dc3',

  // Robotics, mobility, defense & space
  // Robotics & Automation
  'Robotics & Automation': '#33b77e',
  'Humanoid Robotics': '#35aa62',
  'Industrial Robotics': '#30af6b',
  'Warehouse Automation': '#2bb474',
  'Machine Vision': '#3ab987',
  'Industrial Automation': '#35be92',
  'Sensors & LiDAR': '#2fc39e',

  // Electric Mobility
  'Electric Mobility': '#c65f37',
  'Electric Vehicles': '#b94f39',
  'Charging Infrastructure': '#c15735',
  'Powertrains': '#ca6131',
  'Fleet Electrification': '#d27a41',

  // Autonomous Mobility
  'Autonomous Mobility': '#3335b7',
  'Autonomous Vehicles': '#3543aa',
  'Robotaxis': '#3138b2',
  'Driver Assistance': '#302dbb',
  'Mobility Platforms': '#493dc3',

  // Battery Value Chain
  'Battery Value Chain': '#5bb733',
  'Battery Technology': '#69aa35',
  'Battery Storage': '#61b031',
  'Lithium Batteries': '#56b72c',
  'Battery Materials': '#59bd3b',
  'Battery Recycling': '#4dc336',

  // Defense Tech
  'Defense Tech': '#c6378d',
  'Military AI': '#b9399d',
  'ISR & Surveillance': '#be3496',
  'Drones / UAV': '#c32f8d',
  'Electronic Warfare': '#c83e8c',
  'Missile Defense': '#cd3982',
  'Secure Communications': '#d23376',
  'Ammunition & Ordnance': '#be123c',

  // Space Infrastructure
  'Space Infrastructure': '#33a8b7',
  'Launch Services': '#35aaa6',
  'Satellites': '#31abb0',
  'Space Communications': '#2ca7b7',
  'Earth Observation': '#3ba5bd',
  'Space Systems': '#369fc3',

  // Geospatial Technology
  'Geospatial Technology': '#2f9bb7',
  'GNSS Positioning': '#2c8fb0',
  'Surveying Technology': '#2fa7b7',
  'Geospatial Software': '#317fb7',
  'Mapping Systems': '#2d94b0',
  'Location Intelligence': '#2aa1b0',

  // Energy & decarbonization
  // Nuclear Energy
  'Nuclear Energy': '#b79f33',
  'Nuclear': '#aa8835',
  'SMR': '#b29631',
  'Uranium': '#bba62d',
  'Nuclear Services': '#c3b93d',

  // Grid Modernization
  'Grid Modernization': '#8337c6',
  'Grid Infrastructure': '#6b39b9',
  'Power Generation': '#7435bf',
  'Transmission Equipment': '#7f30c6',
  'Power Electronics': '#943fcc',
  'Smart Grid': '#a13ad2',

  // Renewable Power
  'Renewable Power': '#33b752',
  'Solar': '#35aa44',
  'Wind': '#31b24b',
  'Renewable Developers': '#2dbb53',
  'Renewable Equipment': '#3dc36b',

  // Clean Fuels
  'Clean Fuels': '#b7333a',
  'Hydrogen': '#aa3548',
  'Renewable Natural Gas': '#b2313d',
  'Sustainable Aviation Fuel': '#bb2d30',
  'Biofuels': '#c3443d',

  // Carbon Management
  'Carbon Management': '#3769c6',
  'Carbon Capture': '#396fb9',
  'Carbon Markets': '#3769c6',
  'Emissions Monitoring': '#335fd2',

  // Energy Transport
  'Oil & Gas': '#b75a27',
  'Crude Oil Production': '#a84f2a',
  'Natural Gas Production': '#7fb031',
  'Natural Gas Liquids': '#86a02f',
  'Integrated Energy': '#8b5f31',

  'Energy Transport': '#87b733',
  'Pipelines': '#84b72c',
  'LNG Infrastructure': '#8bb031',
  'Storage Terminals': '#6b5f3a',
  'Midstream Infrastructure': '#5f7a3b',

  'Energy Services': '#7cc336',
  'Oilfield Services': '#6f6f34',
  'Drilling Services': '#8b4f2f',
  'Completion Services': '#7a5f3a',

  // Finance, crypto & real estate finance
  // Digital Finance
  'Digital Finance': '#b733ae',
  'Fintech': '#a535aa',
  'Digital Banking': '#b231ae',
  'Payments': '#bb2dac',
  'Lending Platforms': '#c33dac',

  // Investment Platforms
  'Investment Platforms': '#37c6a6',
  'Asset Management': '#39b98f',
  'Wealth Technology': '#31caad',

  // Market Infrastructure
  'Market Infrastructure': '#35c19d',
  'Exchange Operators': '#41d2c1',
  'Trading Infrastructure': '#2fb7a2',
  'Market Data': '#2aa899',
  'Index Providers': '#259b8d',
  'Credit Ratings': '#238f84',

  // Insurance
  'Insurance': '#2563eb',
  'P&C Insurance': '#1d4ed8',
  'Life Insurance': '#2563d8',
  'Reinsurance': '#1e40af',
  'Insurance Brokers': '#1d4e89',

  // Crypto Infrastructure
  'Crypto Infrastructure': '#b77333',
  'Digital Assets': '#aa6135',
  'Crypto Exchanges': '#b26b31',
  'Blockchain Infrastructure': '#bb772d',
  'Bitcoin Mining': '#c38d3d',
  'Stablecoin': '#ca8a04',
  'Cryptocurrency': '#b45309',

  // Mortgage Finance
  'Mortgage Finance': '#333bb7',
  'Secondary Mortgage Market': '#354daa',
  'Mortgage Securitization': '#3142b0',
  'Mortgage Guarantees': '#2c34b7',
  'Single-Family Mortgages': '#3c3bbd',
  'Multifamily Mortgages': '#4236c3',

  // Healthcare & biotech
  // Biotechnology Platforms
  'Biotechnology Platforms': '#4c33b7',
  'Drug Discovery': '#3a35aa',
  'Biologics': '#4031b0',
  'Gene Therapy': '#462cb7',
  'Cell Therapy': '#5d3bbd',
  'Clinical Platforms': '#6536c3',

  // Precision Medicine
  'Precision Medicine': '#45c637',
  'Diagnostics': '#54b939',
  'Genomics': '#48c135',
  'Targeted Therapies': '#3aca31',
  'Personalized Oncology': '#41d243',

  // Medical Technology
  'Medical Technology': '#b73367',
  'Medical Devices': '#aa3570',
  'Robotic Surgery': '#b23169',
  'Imaging Systems': '#bb2d60',
  'Monitoring Devices': '#c33d63',

  // Healthcare Delivery
  'Healthcare Delivery': '#338db7',
  'Healthcare Services': '#3591aa',
  'Managed Care': '#318eb2',
  'Hospitals': '#2d89bb',
  'Pharmacy Services': '#3d8ac3',

  // AI Drug Discovery
  'AI Drug Discovery': '#377bc6',
  'Computational Biology': '#397fb9',
  'Drug Simulation': '#3373d2',

  // Consumer, media & leisure
  // Digital Commerce
  'Digital Commerce': '#c3c637',
  'E-commerce': '#b9ae39',
  'Marketplaces': '#c1bf35',
  'Omnichannel Retail': '#c1ca31',
  'Digital Advertising': '#c0d241',

  // Gaming & Interactive Media
  'Gaming & Interactive Media': '#9433b7',
  'Gaming': '#7e35aa',
  'Game Engines': '#8b31b2',
  'Esports': '#9a2dbb',
  'Interactive Entertainment': '#ae3dc3',

  // Digital Media
  'Digital Media': '#33b76d',
  'Streaming': '#35aa5c',
  'Social Media': '#31b265',
  'Creator Platforms': '#2dbb70',
  'Online Advertising': '#3dc386',

  // Luxury Automobiles
  'Luxury Automobiles': '#c64d37',
  'Performance Vehicles': '#b94439',
  'Luxury EVs': '#c64d37',
  'Motorsport': '#d25733',

  // Luxury Goods
  'Luxury Goods': '#3346b7',
  'Luxury': '#355baa',
  'Premium Apparel': '#3050af',
  'Jewelry & Watches': '#2b44b4',
  'Beauty & Fragrance': '#3a47b9',
  'Branded Merchandise': '#353abe',
  'Lifestyle Licensing': '#352fc3',

  // Travel & Leisure
  'Travel & Leisure': '#6cb733',
  'Hotels & Resorts': '#74aa35',
  'Cruise Lines': '#6eb231',
  'Airlines': '#65bb2d',
  'Experiences': '#68c33d',

  // Sports Betting
  'Sports Betting': '#7db733',
  'Online Sportsbooks': '#7faa35',
  'iGaming': '#7db733',
  'Fantasy Sports': '#78c32f',

  // Gaming & Gambling
  'Gaming & Gambling': '#a855f7',
  'Casinos': '#9333ea',
  'Online Casinos': '#7e22ce',
  'Lottery Operators': '#6d28d9',

  // Restaurant Franchises
  'Restaurant Franchises': '#5e37c6',
  'Quick Service Restaurants': '#5839b9',
  'Restaurant Franchising': '#693ad2',

  // Beverage Brands
  'Beverage Brands': '#35b733',
  'Soft Drinks': '#3baa35',
  'Alcoholic Beverages': '#36c339',

  // Pet Care
  'Pet Care': '#b7335c',
  'Pet Food': '#aa355d',
  'Veterinary Services': '#c3365d',
  'Veterinary Pharma': '#b91c5c',
  'Livestock Health': '#a21caf',
  'Pet Diagnostics': '#9333ea',

  // Food & Beverage
  'Food & Beverage': '#378ec6',
  'Packaged Foods': '#399eb9',
  'Plant-Based Foods': '#3497be',
  'Alternative Proteins': '#2f8ec3',
  'Meat Alternatives': '#3e8dc8',
  'Foodservice': '#3983cd',
  'Food Delivery': '#3377d2',

  // Household & Personal Care
  'Household & Personal Care': '#a9b733',
  'Home Care': '#aa9d35',
  'Fabric Care': '#aea930',
  'Personal Care': '#aeb22b',
  'Beauty & Grooming': '#a9b739',
  'Baby & Family Care': '#a3bb34',
  'Oral Care': '#9bbf2e',
  'Paper Products': '#98c33d',

  // Consumer Health
  'Consumer Health': '#9e33b7',
  'OTC Health Products': '#7f35aa',
  'Vitamins & Supplements': '#8930af',
  'Digestive Health': '#952bb4',
  'Respiratory Health': '#a63ab9',
  'Sleep & Relaxation': '#b335be',
  'Sexual Wellness': '#c22fc3',

  // Retail & Distribution
  'Retail & Distribution': '#37c682',
  'Luxury Retail': '#39b965',
  'Beauty Retail': '#34be6e',
  'Department Stores': '#2fc377',
  'Travel Retail': '#3ec88b',
  'Specialty Retail': '#39cd97',
  'Direct-to-Consumer': '#33d2a3',

  // Automotive Retail
  'Automotive Retail': '#b75133',
  'Auto Dealerships': '#aa4b35',
  'Vehicle Distribution': '#c35b36',

  // Industrial, infrastructure & materials
  // Logistics Networks
  'Logistics Networks': '#c6379f',
  'Logistics': '#b939a8',
  'Supply Chain': '#bf35a3',
  'Parcel Delivery': '#c6309d',
  'Freight Forwarding': '#cc3f9b',
  'Cold Chain': '#d23a93',

  // Air Freight & Logistics
  'Air Freight & Logistics': '#0ea5e9',
  'Express Delivery': '#0284c7',
  'Air Cargo': '#0369a1',
  'Logistics Solutions': '#075985',

  // Marine Transportation
  'Marine Transportation': '#33b7b5',
  'Tank Barges': '#35aa97',
  'Petrochemical Transport': '#31b0a5',
  'Container Shipping': '#2cb7b4',
  'Dry Bulk Shipping': '#3bb5bd',
  'Offshore Vessels': '#36b1c3',

  // Rail Transportation
  'Rail Transportation': '#b78e33',
  'Freight Rail': '#aa7d35',
  'Intermodal Rail': '#b78e33',
  'Rail Equipment': '#c3a02f',

  // Aerospace Systems
  'Aerospace Systems': '#7037c6',
  'Commercial Aircraft': '#6339b9',
  'Aircraft Engines': '#6f37c6',
  'Avionics': '#7e33d2',

  // Observability Platforms
  'Observability Platforms': '#33b741',
  'Infrastructure Monitoring': '#35aa35',
  'Application Monitoring': '#31b23a',
  'Log Analytics': '#2dbb41',
  'Telemetry': '#3dc35a',

  // National Security Space
  'National Security Space': '#b7334b',
  'Defense Satellites': '#aa3553',
  'Space ISR': '#b7334a',
  'Military Communications': '#c32f3f',

  // Electrification
  'Electrification': '#98b733',
  'Power Distribution': '#9baa35',
  'Electrical Equipment': '#99b231',
  'Energy Efficiency': '#94bb2d',
  'Power Conversion': '#95c33d',

  // Industrial Digitalization
  'Industrial Digitalization': '#af33b7',
  'Digital Twins': '#9635aa',
  'Industrial Software': '#a631b2',
  'Simulation Software': '#b72dbb',
  'Engineering Software': '#c33dbd',

  // Construction & Industrial Equipment
  'Construction & Industrial Equipment': '#37c694',
  'Construction Equipment': '#39b97e',
  'Industrial Machinery': '#35c18b',
  'Construction Technology': '#31ca9a',
  'Rental Equipment': '#41d2af',

  // Construction Materials
  'Construction Materials': '#b76f33',
  'Roofing Systems': '#aa6a35',
  'Flooring Systems': '#b27335',
  'Concrete Admixtures': '#c36f2f',
  'Sealants & Coatings': '#7a5530',

  // Precision Agriculture
  'Precision Agriculture': '#b76233',
  'Agricultural Equipment': '#aa5635',
  'Smart Farming': '#b76133',
  'Crop Inputs': '#c36f2f',

  // Water Infrastructure
  'Water Infrastructure': '#3c33b7',
  'Water Treatment': '#353eaa',
  'Smart Water Networks': '#3131b0',
  'Water Utilities': '#362cb7',
  'Pumping Systems': '#4d3bbd',
  'Desalination': '#5436c3',
  'Pool Equipment': '#2fa8c8',

  // Environmental Services
  'Environmental Services': '#58c637',
  'Waste Management': '#69b939',
  'Hazardous Waste': '#5fbf35',
  'Industrial Cleanup': '#52c630',
  'Recycling': '#56cc3f',
  'Environmental Remediation': '#47d23a',
  'Pest Control Services': '#67b93a',

  // Agricultural & Specialty Chemicals
  'Agricultural Chemicals': '#c07b2e',
  'Fertilizer Production': '#b96f2a',
  'Ammonia Production': '#c68331',
  'Nitrogen Products': '#d39440',

  'Industrial Gases': '#1785a6',
  'Industrial Oxygen': '#147999',
  'Industrial Nitrogen': '#1a8daf',
  'Argon & Noble Gases': '#229cb9',
  'Hydrogen Supply': '#0f8f93',
  'Medical Gases': '#2e8fc7',
  'Electronic Specialty Gases': '#336fc2',

  'Specialty Chemicals': '#6b33b7',
  'Industrial Maintenance Chemicals': '#5d2db0',
  'Lubricants': '#5530a8',
  'Surface Treatments': '#7a4ad0',
  'Cleaning Chemicals': '#8a5ae0',

  // Critical Minerals
  'Critical Minerals': '#b73377',
  'Rare Earths': '#aa3582',
  'Lithium': '#b0317c',
  'Nickel': '#b72c73',
  'Graphite': '#bd3b75',
  'Mineral Processing': '#c3366a',

  // Copper Electrification
  'Copper Electrification': '#339eb7',
  'Copper': '#35a0aa',
  'Copper Mining': '#319eb2',
  'Electrical Wiring': '#2d9bbb',
  'Power Cables': '#3d9bc3',

  // Precious Metals
  'Precious Metals': '#c6b837',
  'Gold': '#b99f39',
  'Silver': '#c1af35',
  'Royalty & Streaming': '#cac031',
  'Mining Services': '#d1d241',

  // Telecom Infrastructure
  'Telecom Infrastructure': '#8333b7',
  'Telecommunications': '#6b35aa',
  '5G Infrastructure': '#7531b0',
  'Fiber Networks': '#802cb7',
  'Tower Infrastructure': '#933bbd',
  'Broadband Networks': '#a036c3',
  'Cell Towers': '#7c3aed',
  'Wireless Infrastructure': '#6d28d9',

  // Data Center Real Estate
  'Data Center Real Estate': '#33b75d',
  'Data Center REITs': '#35aa52',
  'Hyperscale Leasing': '#2fc369',

  // Real Estate Income
  'Real Estate Income': '#c63a37',
  'Industrial REITs': '#b93949',
  'Residential REITs': '#bf353c',
  'Healthcare REITs': '#c63330',
  'Net Lease': '#cc4c3f',
  'Self Storage': '#d2533a',
  // Real Estate Services
  'Real Estate Services': '#3356b7',
  'Property Management': '#355caa',
  'Commercial Brokerage': '#334155',
  'Facilities Management': '#64748b',
  'Real Estate Advisory': '#3b82f6',

  // AdTech
  'AdTech': '#3356b7',
  'Mobile Advertising': '#355caa',
  'Programmatic Advertising': '#3356b7',
  'Performance Marketing': '#2f4cc3',

  // EdTech
  'EdTech': '#c637b1',
  'Online Learning': '#b939af',
  'Professional Training': '#c637b1',
  'Educational Software': '#d233af',

  // Human Capital
  'Human Capital': '#0f766e',
  'Staffing': '#0d9488',
  'HR Software': '#0891b2',
  'Payroll': '#0284c7',
  'Recruiting Platforms': '#0369a1',

  // Testing & Certification
  'Testing & Certification': '#7c3aed',
  'Industrial Inspection': '#6d28d9',
  'Product Certification': '#5b21b6',
  'Laboratory Testing': '#9333ea',

  // Professional Services
  'Professional Services': '#475569',
  'Consulting': '#334155',
  'Outsourcing': '#4b5563',
  'Engineering Services': '#64748b',

  // Correctional Services
  'Correctional Services': '#7f1d1d',
  'Private Prisons': '#991b1b',
  'Electronic Monitoring': '#b91c1c',

  // Funeral Services
  'Funeral Services': '#52525b',
  'Funeral Homes': '#3f3f46',
  'Cemeteries': '#71717a',
  'Cremation Services': '#a16207',

  // Forestry
  'Forestry': '#166534',
  'Timberlands': '#15803d',
  'Wood Products': '#854d0e',
  'Pulp & Paper': '#4d7c0f',

  // Packaging
  'Packaging': '#be123c',
  'Consumer Packaging': '#e11d48',
  'Industrial Packaging': '#9f1239',
  'Beverage Packaging': '#db2777',

  // Education Services
  'Education Services': '#1d4ed8',
  'Universities': '#1e40af',
  'Training Providers': '#2563eb',
  'Student Services': '#3b82f6',

  // Music Industry
  'Music Industry': '#c026d3',
  'Music Streaming': '#db2777',
  'Music Rights': '#a21caf',
  'Record Labels': '#7e22ce',

  // GovTech
  'GovTech': '#33b7a4',
  'Government Software': '#35aa91',
  'Public Sector IT': '#33b7a3',
  'Defense Software': '#2fc3b9',

  // Marine Recreation
  'Marine Recreation': '#b77d33',
  'Boat Retail': '#aa6a35',
  'Yacht Retail': '#b27531',
  'Yacht Services': '#bb822d',
  'Boat Financing': '#c3973d',

  // Physical Security
  'Physical Security': '#b91c1c',
  'Alarm Monitoring': '#dc2626',
  'Security Systems': '#ab0808',
  'Smart Home Security': '#d81d45',
  'Fire & Life Safety': '#ea580c',
  'Emergency Response': '#e11d48',
  'Access Control': '#991b1b',

  // Fallbacks
  'Unclassified': '#9ca3af',
  'Unknown': '#9ca3af',
  'Other': '#737373',
}

export function getThemeIcon(theme: string | null | undefined): LucideIcon {
  if (!theme) return HelpCircle
  return THEME_ICONS[theme] || Briefcase
}

export function getThemeColor(theme: string | null | undefined): string {
  if (!theme) return 'text-neutral-500 dark:text-neutral-400'
  return THEME_TEXT_COLORS[theme] || 'text-neutral-600 dark:text-neutral-400'
}

export function getThemeHexColor(theme: string | null | undefined): string {
  if (!theme) return '#9ca3af'
  return THEME_HEX_COLORS[theme] || '#737373'
}
