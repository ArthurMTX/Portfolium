"""Semantic registry definitions for local MiniLM theme retrieval."""
from __future__ import annotations

from typing import Any, Dict, Mapping, Optional, Sequence

from app.services.asset_intelligence.asset_themes import ALLOWED_THEME_HIERARCHY

ThemeDefinition = Dict[str, Any]
ThemeRegistry = Mapping[str, ThemeDefinition]

_LABEL_EXPANSIONS = {
    "&": "and",
    "/": "or",
    "5G": "fifth generation wireless",
    "AI": "artificial intelligence",
    "CDN": "content delivery network",
    "CRM": "customer relationship management",
    "ERP": "enterprise resource planning",
    "EV": "electric vehicle",
    "HPC": "high performance computing",
    "HR": "human resources",
    "iGaming": "online gambling",
    "ISR": "intelligence surveillance and reconnaissance",
    "LNG": "liquefied natural gas",
    "OTC": "over the counter",
    "P&C": "property and casualty",
    "REITs": "real estate investment trusts",
    "SMR": "small modular reactor",
    "UAV": "unmanned aerial vehicle",
}


_PARENT_THEME_DEFINITIONS: Dict[str, str] = {
    "AI Infrastructure": "Accelerator chips, AI server racks, high-bandwidth memory, networking fabrics and edge inference hardware used to train and run machine-learning models.",
    "AI Applications": "Applied AI products that automate knowledge work, decisions, content generation or user workflows; distinct from raw compute, generic SaaS records or industrial design software.",
    "Data Center Infrastructure": "Power distribution, thermal management, backup generation, modular buildings and electrical systems required by hyperscale computing campuses.",
    "Networking Infrastructure": "Ethernet switches, routers, optical transport, carrier access gear and network operating systems moving traffic across enterprise, telecom and cloud environments.",
    "Semiconductor Value Chain": "Chip architecture, wafer fabrication, lithography tools, test equipment, packaging, memory and storage components tied to integrated-circuit production.",
    "Photonics & Optical Computing": "Optical transceivers, photonic interconnects, co-packaged optics and silicon photonics used for high-speed data movement and compute acceleration.",
    "Quantum Technology": "Quantum processors, cryogenic control systems, quantum networking, post-quantum security and specialized software for quantum computing workloads.",
    "Cybersecurity Platforms": "Identity protection, endpoint defense, cloud workload security, network controls, threat intelligence and security operations software for digital risk reduction.",
    "Cloud Platforms": "Hyperscale compute, storage, databases, developer tooling, content delivery and edge networks monetized through cloud consumption or platform subscriptions.",
    "Enterprise SaaS": "Horizontal business applications and systems of record for CRM, ERP, HR, productivity, finance and support workflows; not primarily AI model products or engineering simulation tools.",
    "Data Analytics Platforms": "Data warehouses, lakehouses, streaming analytics, transformation pipelines and business intelligence layers used to query operational and financial data.",
    "Robotics & Automation": "Physical robots, factory cells, warehouse automation, machine vision, LiDAR, sensors, PLCs and motion controls that automate material handling or manufacturing tasks.",
    "Electric Mobility": "Battery-electric vehicles, charging networks, electric drivetrains, fleet charging depots and vehicle electrification components.",
    "Autonomous Mobility": "Vehicle autonomy, robotaxi fleets, ADAS perception, driving policy, fleet routing and mobility dispatch for cars, trucks or passenger transport.",
    "Battery Value Chain": "Battery cells, cathode and anode materials, lithium supply, stationary storage, recycling and battery management technology.",
    "Defense Tech": "Military software, surveillance sensors, drones, electronic warfare, secure communications, missile systems and munitions sold to defense customers.",
    "Space Infrastructure": "Launch vehicles, satellites, ground stations, orbital systems, space communications and earth-observation capabilities for commercial or civil missions.",
    "Geospatial Technology": "GNSS receivers, surveying instruments, mapping software, spatial databases and location analytics used to measure or interpret physical places.",
    "Nuclear Energy": "Nuclear reactors, small modular reactor designs, uranium supply, fuel-cycle activities and maintenance work for nuclear generation fleets.",
    "Grid Modernization": "Transmission hardware, grid-control software, substations, power electronics, smart meters and equipment that increases electricity reliability and capacity.",
    "Renewable Power": "Solar and wind generation owners, renewable project developers and component makers tied to utility-scale or distributed clean electricity.",
    "Clean Fuels": "Hydrogen, renewable natural gas, biofuel and sustainable aviation fuel production, upgrading, distribution and feedstock conversion.",
    "Carbon Management": "Carbon capture, emissions measurement, carbon accounting and compliance or voluntary carbon-credit trading.",
    "Oil & Gas": "Exploration, production and integrated operations for crude oil, natural gas and natural-gas liquids.",
    "Energy Transport": "Pipelines, LNG terminals, storage tanks, compression stations and midstream networks moving hydrocarbons between producers and end users.",
    "Energy Services": "Drilling rigs, pressure pumping, completion tools, downhole equipment and field crews supporting oil and gas development.",
    "Digital Finance": "Payments, card networks, merchant acquiring, checkout, digital wallets, online banking, embedded finance, fintech workflows and software-led lending.",
    "Investment Platforms": "Asset management, ETFs, mutual funds, wealth accounts, robo-advice, brokerage, portfolio management, investor custody and advisor technology.",
    "Market Infrastructure": "Exchange operators, trading venues, clearing houses, settlement rails, financial indices, benchmarks, market data terminals and credit ratings.",
    "Insurance": "Underwriting, brokerage and reinsurance for property, casualty, life, annuity and specialty risk pools.",
    "Crypto Infrastructure": "Blockchain networks, crypto tokens, digital-asset exchanges, wallets, miners, validators, staking, stablecoins, nodes and token custody.",
    "Biotechnology Platforms": "Drug-development platforms for novel therapeutics, biologics, gene editing, cell therapy, clinical pipelines and regulated medicines.",
    "Precision Medicine": "Molecular diagnostics, sequencing, companion tests, tumor profiling, biomarkers and targeted treatment selection for specific patient biology.",
    "Medical Technology": "Regulated clinical hardware such as implants, surgical systems, imaging equipment, instruments, disposables and patient-monitoring devices.",
    "Healthcare Delivery": "Managed care, pharmacies, hospitals, outpatient clinics and care-coordination businesses serving patients, payers and clinicians.",
    "Digital Commerce": "Online retail transactions, marketplaces, app stores, merchant storefront tools, checkout, fulfillment links and commerce take rates.",
    "Gaming & Interactive Media": "Video games, game engines, esports, interactive entertainment franchises and developer ecosystems for playable digital content.",
    "Digital Media": "Streaming libraries, social feeds, creator platforms, digital audiences, subscriptions and publisher-owned advertising inventory.",
    "Luxury Automobiles": "Premium performance cars, luxury electric vehicles, high-end brand distribution and motorsport-linked automotive revenue.",
    "Luxury Goods": "Premium fashion, watches, jewelry, beauty, fragrance and licensed lifestyle brands sold through luxury retail channels.",
    "Travel & Leisure": "Hotels, resorts, airlines, cruise ships, booking flows and leisure experiences driven by consumer travel spending.",
    "Logistics Networks": "Parcel delivery, freight forwarding, supply-chain coordination, cold-chain handling and logistics networks moving physical goods.",
    "Air Freight & Logistics": "Express parcel delivery, air cargo capacity and time-sensitive shipping networks using aircraft and hub operations.",
    "Marine Transportation": "Tankers, barges, container ships, dry bulk carriers and offshore vessels moving cargo or energy commodities by water.",
    "Rail Transportation": "Freight railroads, intermodal terminals, locomotives, railcars and track networks for land-based cargo movement.",
    "Aerospace Systems": "Commercial aircraft, jet engines, avionics, flight controls and cabin systems sold into civil aviation programs.",
    "Observability Platforms": "Logs, metrics, traces, telemetry, application performance monitoring and incident workflows for software reliability teams.",
    "National Security Space": "Defense satellites, classified payloads, space-based surveillance and military communications for national-security missions.",
    "AI Drug Discovery": "Machine learning, computational biology, protein modeling, molecule generation and simulation used before or during therapeutic discovery.",
    "Electrification": "Electrical distribution gear, switchgear, transformers, inverters, power conversion and efficiency systems enabling higher electricity use.",
    "Industrial Digitalization": "Digital twins, CAD, PLM, simulation, engineering software, industrial data models and factory or plant optimization workflows.",
    "Construction & Industrial Equipment": "Heavy machinery, rental fleets, construction technology, industrial tools and equipment used at job sites or factories.",
    "Precision Agriculture": "Farm machinery, crop analytics, planting technology, agronomy software and inputs used to improve yields and farm economics.",
    "Construction Materials": "Roofing, flooring, concrete additives, waterproofing, sealants and coatings used in buildings, repair and construction projects.",
    "Water Infrastructure": "Water treatment, utility networks, pumps, metering, desalination and pool systems tied to water movement, quality and use.",
    "Environmental Services": "Waste collection, hazardous cleanup, recycling, remediation, industrial cleaning and pest-control routes with recurring municipal or commercial demand.",
    "Agricultural Chemicals": "Fertilizer, ammonia, urea, nitrogen blends and crop chemical inputs used by growers and agribusiness distributors.",
    "Industrial Gases": "Oxygen, nitrogen, argon, hydrogen, medical gases and electronic specialty gases supplied to industrial, healthcare, energy and semiconductor customers.",
    "Specialty Chemicals": "Formulated chemicals such as lubricants, surface treatments, cleaning compounds and maintenance fluids sold into industrial or consumer channels.",
    "Critical Minerals": "Rare earths, lithium, nickel, graphite and mineral-processing capacity used in batteries, magnets, electronics and strategic supply chains.",
    "Copper Electrification": "Copper mining, smelting, wire, cable and conductive materials used in power grids, buildings and electrified equipment.",
    "Precious Metals": "Gold, silver, streaming royalties, mine finance and mining support activities tied to precious-metal reserves and production.",
    "Telecom Infrastructure": "Fiber, wireless towers, broadband networks, radio access equipment and 5G systems connecting households, enterprises and mobile users.",
    "Data Center Real Estate": "REITs and landlords leasing colocation or hyperscale data-center capacity to cloud, enterprise and AI tenants.",
    "Real Estate Income": "Recurring rental income from industrial, residential, healthcare, net-lease and self-storage properties.",
    "Real Estate Services": "Property management, leasing, brokerage, facilities management and advisory work for commercial real estate owners and occupiers.",
    "AdTech": "Programmatic ad buying, DSPs, SSPs, mobile attribution, campaign measurement, bidding systems and performance marketing tools.",
    "Sports Betting": "Online sportsbooks, fantasy sports, odds-making, iGaming wallets and regulated wagering operations.",
    "Gaming & Gambling": "Casinos, online casino games, lottery systems and wagering operations not limited to sports betting.",
    "EdTech": "Learning management software, online courses, professional certification, tutoring and education platforms delivered through digital channels.",
    "Human Capital": "Staffing agencies, payroll systems, recruiting platforms, HR administration and workforce-management software.",
    "Testing & Certification": "Inspection, certification, laboratory analysis and compliance testing used to verify industrial processes, facilities or goods.",
    "Professional Services": "Consulting, outsourcing, engineering, implementation and knowledge-based project work for corporate or government clients.",
    "Correctional Services": "Private prison operations, detention facilities, offender monitoring and correctional contracts with government agencies.",
    "Funeral Services": "Funeral homes, cemeteries, cremation locations and pre-need death-care arrangements.",
    "Forestry": "Timberlands, lumber, engineered wood, pulp, paper and forest-resource harvesting or processing.",
    "Packaging": "Paperboard, cans, plastic containers, labels and protective packaging sold to consumer, industrial or beverage customers.",
    "Education Services": "Universities, schools, training centers, student-support operations and credential programs delivered through physical or hybrid campuses.",
    "Music Industry": "Music streaming, publishing rights, recorded-music catalogs, labels and royalty monetization.",
    "GovTech": "Software and IT programs for government agencies, public-sector operations, civic workflows and defense administration.",
    "Marine Recreation": "Boat and yacht retail, financing, maintenance, marina operations and marine leisure dealerships.",
    "Restaurant Franchises": "Quick-service restaurant brands, franchise royalties, store development and standardized food-service operations.",
    "Beverage Brands": "Soft drinks, bottled water, beer, spirits, wine and branded beverage distribution.",
    "Pet Care": "Pet food, veterinary clinics, animal health drugs, livestock medicines and diagnostics for companion or production animals.",
    "Food & Beverage": "Packaged food, food delivery, restaurant supply, plant-based protein and alternative-meat categories sold through grocery or foodservice channels.",
    "Household & Personal Care": "Home cleaning, laundry, grooming, beauty, oral care, family care and paper categories sold to households.",
    "Consumer Health": "Non-prescription medicines, vitamins, supplements, digestive remedies, cold and allergy treatments, sleep aids and sexual wellness brands sold directly to consumers.",
    "Retail & Distribution": "Specialty retail, beauty retail, department stores, travel retail and direct-to-consumer distribution through stores or online channels.",
    "Automotive Retail": "Auto dealerships, vehicle distribution, parts sales, financing and used-car retail networks.",
    "Mortgage Finance": "Mortgage guarantees, securitization, secondary-market liquidity and agency-style funding for single-family or multifamily housing loans.",
    "Physical Security": "Alarm monitoring, access control, fire safety, emergency response and smart-home security systems protecting buildings and people.",
}

_PARENT_THEME_CONTRASTS: Dict[str, Dict[str, str]] = {
    "Investment Platforms": {
        "Crypto Infrastructure": "Traditional securities, funds and wealth accounts rather than blockchain tokens, validators or crypto networks.",
        "Market Infrastructure": "Manages investor assets and portfolios rather than operating exchanges, indices, ratings or market data utilities.",
        "Digital Finance": "Investing, advisory and custody workflows rather than payments, merchant acquiring, banking or lending workflows.",
    },
    "Digital Finance": {
        "Investment Platforms": "Payments, wallets, banking and lending workflows rather than portfolio management, ETFs or advisor platforms.",
        "Crypto Infrastructure": "Fiat payment and banking workflows rather than blockchain-native tokens, mining, staking or validator networks.",
        "Market Infrastructure": "Consumer or merchant financial workflows rather than exchanges, clearing, indices, benchmarks or ratings.",
    },
    "Market Infrastructure": {
        "Investment Platforms": "Capital-market utilities, data and benchmarks rather than managing client portfolios or wealth accounts.",
        "Crypto Infrastructure": "Regulated market data, exchanges, clearing, indices and ratings rather than token networks or crypto custody.",
        "Digital Finance": "Trading venues and market utilities rather than payments, wallets, merchant finance or online banking.",
    },
    "Crypto Infrastructure": {
        "Investment Platforms": "Blockchain tokens, wallets, mining, staking and validators rather than traditional securities accounts or ETFs.",
        "Digital Finance": "Crypto-native rails and token custody rather than fiat payments, merchant acquiring or online banking.",
        "Market Infrastructure": "Decentralized or crypto trading infrastructure rather than conventional indices, ratings or clearing utilities.",
    },
    "Enterprise SaaS": {
        "AI Applications": "Systems of record and recurring business applications rather than AI-native copilots, agents or model products.",
        "Industrial Digitalization": "Horizontal office and back-office workflows rather than CAD, PLM, simulation or factory data models.",
    },
    "AI Applications": {
        "Enterprise SaaS": "AI-native automation, prediction or generation rather than generic subscription systems of record.",
        "Industrial Digitalization": "Knowledge-work AI products rather than engineering simulation, CAD or industrial digital twins.",
    },
    "Industrial Digitalization": {
        "Enterprise SaaS": "Engineering, plant, asset and factory workflows rather than horizontal CRM, HR, finance or productivity apps.",
        "Robotics & Automation": "Software models and simulation rather than physical robots, sensors, PLCs or motion control hardware.",
        "Autonomous Mobility": "Industrial design and operations software rather than self-driving vehicle stacks or robotaxi fleets.",
    },
    "Biotechnology Platforms": {
        "Precision Medicine": "Therapeutic creation and clinical pipelines rather than diagnostics or treatment selection tests.",
        "AI Drug Discovery": "Broad therapeutic platform and clinical development exposure, not only computational discovery tools.",
        "Consumer Health": "Regulated drug development rather than non-prescription wellness or supplement brands.",
    },
    "Precision Medicine": {
        "Biotechnology Platforms": "Diagnostics, sequencing and biomarker-guided treatment selection rather than broad drug-development platforms.",
        "AI Drug Discovery": "Patient testing and molecular stratification rather than molecule generation or target discovery software.",
        "Consumer Health": "Clinical diagnostics and targeted therapy decisions rather than OTC remedies or vitamins.",
    },
    "AI Drug Discovery": {
        "Biotechnology Platforms": "Computational discovery and simulation rather than full clinical-stage biotech platform exposure.",
        "Precision Medicine": "Drug-design models rather than diagnostic tests, sequencing or companion diagnostics.",
    },
    "Consumer Health": {
        "Biotechnology Platforms": "OTC remedies and wellness brands rather than clinical-stage therapeutics or gene and cell therapy.",
        "Precision Medicine": "Consumer products rather than molecular diagnostics, sequencing or companion tests.",
        "Medical Technology": "Consumable health brands rather than regulated clinical devices, implants or surgical equipment.",
    },
    "Medical Technology": {
        "Consumer Health": "Regulated devices and clinical hardware rather than OTC medicines, supplements or wellness brands.",
        "Biotechnology Platforms": "Physical clinical equipment rather than drug discovery or therapeutic pipelines.",
    },
    "Digital Commerce": {
        "Digital Media": "Buyer-seller transactions, storefronts and marketplace take rates rather than audience content or social feeds.",
        "AdTech": "Commerce platforms and retail media attached to transactions rather than standalone ad-buying software.",
    },
    "Digital Media": {
        "Digital Commerce": "Content, audiences, streaming and social engagement rather than storefront checkout or merchant transactions.",
        "AdTech": "Owned media inventory and audiences rather than ad-buying tools, attribution or campaign workflow software.",
    },
    "AdTech": {
        "Digital Commerce": "Advertising workflow and measurement software rather than operating marketplaces or storefront transactions.",
        "Digital Media": "Tools for advertisers and publishers rather than owning content libraries, social feeds or creator audiences.",
    },
    "Robotics & Automation": {
        "Industrial Digitalization": "Physical machines, controls and automation hardware rather than CAD, PLM, simulation or digital twins.",
        "Autonomous Mobility": "Factory and warehouse automation rather than self-driving cars, robotaxis or passenger mobility platforms.",
    },
    "Autonomous Mobility": {
        "Robotics & Automation": "Vehicle autonomy and mobility networks rather than factory robots or warehouse automation.",
        "Industrial Digitalization": "Driving stacks and fleet dispatch rather than engineering simulation or industrial software.",
    },
}


_SUBTHEME_DEFINITIONS: Dict[str, Dict[str, str]] = {
    "AI Infrastructure": {
        "GPU Computing": "Graphics processors and accelerator cards for neural-network training, inference, parallel computing, CUDA ecosystems and high-performance workloads.",
        "Accelerated Computing": "Specialized processors, DPUs, TPUs, ASICs and heterogeneous compute architectures that offload intensive mathematical workloads.",
        "AI Servers": "Rack servers, HGX-style systems, liquid-cooled trays and clustered hardware sold for AI model training or inference.",
        "AI Networking": "InfiniBand, high-speed Ethernet, switches, network adapters and fabrics connecting accelerator clusters with low latency.",
        "Edge AI": "On-device inference chips, embedded accelerators and compact modules for cameras, vehicles, phones, factories and robotics.",
    },
    "AI Applications": {
        "Generative AI": "Text, image, code, audio or video generation tools built on large language models and foundation models.",
        "AI Agents": "Autonomous software agents that plan tasks, call tools, execute workflows and interact with enterprise systems.",
        "AI Software": "Machine-learning platforms, model deployment tools, AI development environments and inference applications sold as software.",
        "Enterprise AI": "Corporate AI deployments for sales, support, compliance, analytics, knowledge management and internal productivity workflows.",
        "Sovereign AI": "National or regulated AI programs using local data, domestic compute, government procurement and jurisdiction-specific model control.",
    },
    "Data Center Infrastructure": {
        "Hyperscale Data Centers": "Large cloud campuses, server halls, colocation shells and construction programs for hyperscale computing tenants.",
        "Data Center Power": "Switchgear, substations, UPS systems, generators, power distribution units and electrical gear for compute facilities.",
        "Data Center Cooling": "Liquid cooling, chillers, heat exchangers, thermal management and airflow systems for high-density server racks.",
    },
    "Networking Infrastructure": {
        "Ethernet Switching": "Data-center and enterprise Ethernet switches, switch silicon, network operating systems and spine-leaf architectures.",
        "Optical Networking": "Wavelength-division multiplexing, coherent optics, fiber transport and metro or long-haul optical network equipment.",
        "Routing": "Carrier and enterprise routers directing packet traffic across internet backbones, campuses and service-provider networks.",
        "Network Equipment": "Access points, controllers, firewalls, gateways, modems and network appliances sold to enterprises or carriers.",
    },
    "Semiconductor Value Chain": {
        "Chip Design": "Fabless chip architecture, processor IP, custom silicon, integrated circuits and electronic design automation workflows.",
        "Semiconductor Equipment": "Lithography, etch, deposition, metrology, inspection and wafer-processing tools used by chip manufacturers.",
        "Foundry Ecosystem": "Contract wafer fabrication, process nodes, mask sets and manufacturing capacity for fabless semiconductor designers.",
        "Advanced Packaging": "Chiplets, interposers, 2.5D and 3D packaging, substrate technology and heterogeneous integration.",
        "Memory & Storage": "DRAM, NAND flash, high-bandwidth memory, SSD controllers and storage semiconductors.",
    },
    "Photonics & Optical Computing": {
        "Optical Interconnects": "High-speed optical links connecting racks, accelerators and switches in data centers.",
        "Silicon Photonics": "Photonic integrated circuits, modulators and light-based data movement built on silicon manufacturing processes.",
        "Optical Transceivers": "Pluggable modules, coherent transceivers and fiber-optic components converting electrical signals to light.",
        "Co-Packaged Optics": "Optical engines integrated near switch ASICs or processors to reduce power and latency in data centers.",
    },
    "Quantum Technology": {
        "Quantum Computing": "Qubit hardware, cryogenic systems, quantum processors and software stacks for quantum algorithms.",
        "Quantum Networking": "Entanglement distribution, quantum repeaters, quantum communication links and secure quantum network equipment.",
        "Quantum Security": "Post-quantum cryptography, quantum key distribution and encryption tools designed for quantum-era threats.",
    },
    "Cybersecurity Platforms": {
        "Identity Security": "Identity governance, privileged access, authentication, single sign-on and access controls for users and machines.",
        "Zero Trust": "Policy engines, network segmentation, conditional access and continuous verification across users, devices and applications.",
        "Threat Intelligence": "Malware analysis, attacker telemetry, vulnerability feeds and research used by security teams.",
        "Network Security": "Firewalls, secure web gateways, intrusion prevention and traffic inspection across corporate networks.",
        "Cloud Security": "Cloud posture management, workload protection, container security and controls for public-cloud environments.",
        "Security Operations": "SIEM, SOAR, detection engineering, incident response and analyst workflows in security operations centers.",
        "Endpoint Security": "Endpoint detection, antivirus, device telemetry and response agents installed on laptops, servers and mobile devices.",
        "Application Security": "Code scanning, software composition analysis, API security and vulnerability testing for application development.",
    },
    "Cloud Platforms": {
        "Cloud Infrastructure": "Compute instances, storage, networking, virtualization and consumption billing for public or private cloud workloads.",
        "Hyperscale Cloud": "Large-scale cloud providers monetizing global regions, data centers and enterprise compute demand.",
        "Developer Platforms": "APIs, SDKs, code repositories, CI/CD, app deployment and developer workflow environments.",
        "Observability": "Cloud logs, metrics, traces and monitoring tools for infrastructure and application reliability.",
        "Database Platforms": "Relational, NoSQL, vector, document and analytical databases delivered through managed cloud offerings.",
        "CDN": "Content delivery networks, edge caching, traffic acceleration and distributed points of presence.",
        "Edge Network": "Distributed compute, edge routing and low-latency nodes close to users, devices or applications.",
    },
    "Enterprise SaaS": {
        "CRM Software": "Sales pipelines, customer records, marketing automation and account-management systems for revenue teams.",
        "ERP Software": "Financials, procurement, inventory, manufacturing planning and back-office systems of record.",
        "Workflow Automation": "No-code workflows, robotic process automation, task routing and business-process orchestration.",
        "Digital Transformation": "Enterprise platforms replacing manual processes with cloud workflows, integrations and modern software stacks.",
        "Customer Experience Software": "Contact centers, support tickets, chatbots, surveys and customer engagement workflows.",
        "Productivity Software": "Collaboration, documents, messaging, meetings, spreadsheets and workplace communication suites.",
    },
    "Data Analytics Platforms": {
        "Business Intelligence": "Dashboards, reporting, visualization and self-service analytics used by business users.",
        "Data Warehousing": "Cloud warehouses, lakehouses and analytical storage for structured enterprise data.",
        "Data Engineering": "Pipelines, ETL, orchestration, data quality and transformation tools for analytics teams.",
        "Real-Time Analytics": "Streaming data, event processing, low-latency queries and operational analytics.",
    },
    "Robotics & Automation": {
        "Humanoid Robotics": "Bipedal or human-form robots using actuators, perception and AI to perform physical tasks.",
        "Industrial Robotics": "Robot arms, cobots, welding, painting, assembly and factory automation cells.",
        "Warehouse Automation": "Autonomous mobile robots, conveyors, sortation, picking systems and fulfillment automation.",
        "Machine Vision": "Cameras, image sensors, optical inspection and computer vision for manufacturing or logistics.",
        "Industrial Automation": "PLCs, motion control, drives, factory controls and process automation systems.",
        "Sensors & LiDAR": "LiDAR, radar, 3D sensing, encoders and perception sensors for machines, vehicles or robots.",
    },
    "Electric Mobility": {
        "Electric Vehicles": "Battery-electric cars, trucks, buses and vehicle platforms powered by traction batteries.",
        "Charging Infrastructure": "Charging stations, fast chargers, charging software, connectors and fleet charging depots.",
        "Powertrains": "Electric motors, inverters, e-axles, power electronics and drivetrain components.",
        "Fleet Electrification": "Commercial fleet charging, depot planning, telematics and electric vans or trucks.",
    },
    "Autonomous Mobility": {
        "Autonomous Vehicles": "Self-driving systems, perception stacks, planning software and sensor suites for automated vehicles.",
        "Robotaxis": "Autonomous ride-hailing networks, dispatch systems and driverless passenger fleets.",
        "Driver Assistance": "ADAS cameras, radar, lane keeping, adaptive cruise and automated safety features.",
        "Mobility Platforms": "Ride-hailing, fleet dispatch, routing and transportation networks connecting riders or drivers.",
    },
    "Battery Value Chain": {
        "Battery Technology": "Cell chemistry, battery management systems, solid-state designs and performance improvements.",
        "Battery Storage": "Grid-scale storage, residential batteries, energy storage systems and power management.",
        "Lithium Batteries": "Lithium-ion cells, modules, packs and manufacturing lines for vehicles or electronics.",
        "Battery Materials": "Cathodes, anodes, separators, electrolytes, lithium, nickel and precursor materials.",
        "Battery Recycling": "Collection, black mass processing, hydrometallurgy and recovered battery metals.",
    },
    "Defense Tech": {
        "Military AI": "AI for targeting, autonomy, battlefield analytics, mission planning and defense decision support.",
        "ISR & Surveillance": "Intelligence, surveillance and reconnaissance sensors, imagery, radar and signal collection.",
        "Drones / UAV": "Unmanned aircraft, loitering munitions, drone autonomy and ground-control systems.",
        "Electronic Warfare": "Jamming, spectrum sensing, signals intelligence and electronic attack or protection systems.",
        "Missile Defense": "Interceptors, radar, command systems and air or missile defense architectures.",
        "Secure Communications": "Encrypted radios, tactical networks, satellite communications and military data links.",
        "Ammunition & Ordnance": "Munitions, explosives, shells, rockets and ordnance production for defense agencies.",
    },
    "Space Infrastructure": {
        "Launch Services": "Rockets, launch vehicles, payload integration and orbital delivery for satellites.",
        "Satellites": "Satellite buses, payloads, constellations and spacecraft manufacturing.",
        "Space Communications": "Satellite broadband, ground terminals, telemetry links and space-based connectivity.",
        "Earth Observation": "Remote sensing, imagery, synthetic aperture radar and environmental monitoring from orbit.",
        "Space Systems": "Spacecraft components, mission software, ground systems and orbital operations.",
    },
    "Geospatial Technology": {
        "GNSS Positioning": "GPS, GNSS receivers, correction signals and precision positioning for vehicles, surveying or agriculture.",
        "Surveying Technology": "Total stations, laser scanners, field controllers and measurement tools for land surveying.",
        "Geospatial Software": "GIS, spatial databases, map layers and analytics for location-based decision making.",
        "Mapping Systems": "Digital maps, cartography, mobile mapping vehicles and 3D mapping workflows.",
        "Location Intelligence": "Geofencing, traffic analytics, site selection and spatial insights from location data.",
    },
    "Nuclear Energy": {
        "Nuclear": "Conventional nuclear power plants, reactors, fuel assemblies and baseload generation.",
        "SMR": "Small modular reactor designs, factory-built reactor modules and advanced nuclear deployments.",
        "Uranium": "Uranium mining, conversion, enrichment and fuel supply for nuclear reactors.",
        "Nuclear Services": "Refueling, maintenance, decommissioning, engineering and safety work for nuclear fleets.",
    },
    "Grid Modernization": {
        "Grid Infrastructure": "Substations, transformers, grid controls and equipment expanding electricity transmission or distribution capacity.",
        "Power Generation": "Generators, turbines and equipment converting fuel or renewable sources into electricity.",
        "Transmission Equipment": "High-voltage lines, transformers, breakers and grid hardware for long-distance power movement.",
        "Power Electronics": "Inverters, converters, rectifiers and controls managing electrical power flows.",
        "Smart Grid": "Smart meters, distribution automation, demand response and grid software using digital telemetry.",
    },
    "Renewable Power": {
        "Solar": "Solar modules, inverters, trackers, project development and photovoltaic generation.",
        "Wind": "Wind turbines, blades, towers, offshore wind farms and wind project development.",
        "Renewable Developers": "Owners or developers of solar, wind and hybrid renewable generation portfolios.",
        "Renewable Equipment": "Components, balance-of-plant equipment and controls used in renewable generation.",
    },
    "Clean Fuels": {
        "Hydrogen": "Electrolyzers, hydrogen production, storage, distribution and fuel-cell supply chains.",
        "Renewable Natural Gas": "Biogas upgrading, landfill gas, anaerobic digestion and pipeline-quality methane.",
        "Sustainable Aviation Fuel": "Low-carbon jet fuel from biofeedstocks, waste oils or synthetic fuel pathways.",
        "Biofuels": "Ethanol, biodiesel, renewable diesel and feedstock conversion for transportation fuels.",
    },
    "Carbon Management": {
        "Carbon Capture": "CO2 capture, compression, transport, utilization and sequestration systems.",
        "Carbon Markets": "Carbon credits, offsets, registries, trading venues and emissions compliance schemes.",
        "Emissions Monitoring": "Methane detection, carbon accounting, sensors and software measuring greenhouse gas output.",
    },
    "Oil & Gas": {
        "Crude Oil Production": "Oil exploration, drilling, reservoir development and upstream crude extraction.",
        "Natural Gas Production": "Gas wells, shale production, gathering and upstream natural gas volumes.",
        "Natural Gas Liquids": "Ethane, propane, butane, fractionation and liquids-rich hydrocarbon production.",
        "Integrated Energy": "Companies combining upstream production, refining, trading, fuels and downstream energy operations.",
    },
    "Energy Transport": {
        "Pipelines": "Oil, gas and liquids pipelines with tariff revenue and long-distance commodity movement.",
        "LNG Infrastructure": "Liquefaction plants, regasification terminals, LNG storage and export capacity.",
        "Storage Terminals": "Tank farms, terminals and storage caverns for oil, gas, fuels or chemicals.",
        "Midstream Infrastructure": "Gathering, processing, compression, fractionation and transportation networks between wells and customers.",
    },
    "Energy Services": {
        "Oilfield Services": "Well construction, pressure pumping, seismic, downhole tools and technical support for producers.",
        "Drilling Services": "Land or offshore drilling rigs, drillships, crews and rig contracting.",
        "Completion Services": "Hydraulic fracturing, cementing, wireline, perforating and well-completion equipment.",
    },
    "Digital Finance": {
        "Fintech": "Software-led financial workflows, embedded finance, neobanks, wallet apps and consumer or merchant finance.",
        "Digital Banking": "Online accounts, mobile banking, deposits, debit cards and branchless banking models.",
        "Payments": "Card networks, merchant acquiring, payment gateways, wallets, checkout and transaction processing.",
        "Lending Platforms": "Online underwriting, personal loans, merchant credit, buy-now-pay-later and loan marketplaces.",
    },
    "Investment Platforms": {
        "Asset Management": "Investment funds, ETFs, portfolio management fees and institutional asset-management mandates.",
        "Wealth Technology": "Robo-advice, brokerage platforms, custody tools and advisor software for wealth accounts.",
    },
    "Market Infrastructure": {
        "Exchange Operators": "Equity, futures, options, commodity and crypto exchanges earning transaction and listing fees.",
        "Trading Infrastructure": "Order routing, clearing, settlement, execution technology and trading connectivity.",
        "Market Data": "Price feeds, reference data, analytics and financial information terminals.",
        "Index Providers": "Equity, bond and thematic indices licensed to ETFs, asset managers and benchmarks.",
        "Credit Ratings": "Issuer ratings, structured-finance ratings and credit research used by debt markets.",
    },
    "Insurance": {
        "P&C Insurance": "Auto, homeowners, commercial property, liability and casualty underwriting.",
        "Life Insurance": "Life policies, annuities, mortality risk and retirement savings contracts.",
        "Reinsurance": "Risk transfer for insurers, catastrophe exposure and excess underwriting capacity.",
        "Insurance Brokers": "Policy placement, benefits consulting and commission-based insurance distribution.",
    },
    "Crypto Infrastructure": {
        "Digital Assets": "Tokenized assets, custody, staking, settlement and digital-asset investment workflows.",
        "Crypto Exchanges": "Spot or derivatives crypto trading venues, wallets, custody and transaction fees.",
        "Blockchain Infrastructure": "Validators, nodes, smart-contract platforms, wallets and blockchain developer tooling.",
        "Bitcoin Mining": "Mining rigs, hash rate, power procurement and bitcoin block rewards.",
        "Stablecoin": "Dollar-backed tokens, reserve management, issuance, redemption and blockchain payment rails.",
        "Cryptocurrency": "Crypto tokens, trading, custody and financial activity centered on blockchain-native currencies.",
    },
    "Biotechnology Platforms": {
        "Drug Discovery": "Target identification, screening, medicinal chemistry and preclinical discovery of therapeutic candidates.",
        "Biologics": "Antibodies, recombinant proteins, biologic manufacturing and large-molecule therapeutics.",
        "Gene Therapy": "Viral vectors, gene editing, genetic payload delivery and treatments correcting inherited disease.",
        "Cell Therapy": "Stem cells, immune cells, CAR-T, regenerative medicine and advanced cellular therapeutics.",
        "Clinical Platforms": "Clinical trial operations, patient recruitment, biomarker tracking and development-stage biotechnology pipelines.",
    },
    "Precision Medicine": {
        "Diagnostics": "Laboratory tests, companion diagnostics, pathology and disease detection assays.",
        "Genomics": "DNA sequencing, genetic testing, genomic databases and molecular analysis.",
        "Targeted Therapies": "Drugs matched to biomarkers, mutations or molecular pathways in specific patient groups.",
        "Personalized Oncology": "Cancer diagnostics, tumor profiling and oncology treatments tailored to patient biology.",
    },
    "Medical Technology": {
        "Medical Devices": "Implants, instruments, disposables and regulated hardware used by clinicians.",
        "Robotic Surgery": "Surgical robots, instruments, procedure software and minimally invasive operating-room systems.",
        "Imaging Systems": "MRI, CT, ultrasound, X-ray and diagnostic imaging equipment.",
        "Monitoring Devices": "Patient monitors, wearables, sensors and connected devices tracking vital signs or chronic conditions.",
    },
    "Healthcare Delivery": {
        "Healthcare Services": "Clinics, physician groups, outpatient care, home health and patient-care operations.",
        "Managed Care": "Health insurance plans, provider networks, medical cost management and payer administration.",
        "Hospitals": "Acute-care facilities, inpatient beds, surgical departments and hospital systems.",
        "Pharmacy Services": "Pharmacy benefit management, drug dispensing, specialty pharmacy and prescription fulfillment.",
    },
    "Digital Commerce": {
        "E-commerce": "Online storefronts, checkout flows, merchant tools, fulfillment links and retail transactions over the internet.",
        "Marketplaces": "Platforms connecting buyers and sellers, merchant onboarding, app stores, transaction fees and third-party commerce.",
        "Omnichannel Retail": "Integrated store, website, inventory, pickup and delivery experiences across retail channels.",
        "Digital Advertising": "Search, retail media, performance ads, sponsored listings and merchant advertising tied to online commerce.",
    },
    "Gaming & Interactive Media": {
        "Gaming": "Video game publishing, consoles, in-game spending, downloadable content and game franchises.",
        "Game Engines": "Tools for game development, 3D rendering, physics, animation and interactive content creation.",
        "Esports": "Competitive gaming leagues, tournaments, teams, sponsorships and streaming audiences.",
        "Interactive Entertainment": "Immersive digital experiences, virtual worlds and playable media beyond traditional video.",
    },
    "Digital Media": {
        "Streaming": "Subscription or ad-supported video and audio streaming platforms with digital content libraries.",
        "Social Media": "User-generated content networks, feeds, messaging, engagement data and advertising monetization.",
        "Creator Platforms": "Tools for creators to publish, monetize, livestream and manage audiences.",
        "Online Advertising": "Digital ad inventory, targeting, measurement and monetization across websites or apps.",
    },
    "Luxury Automobiles": {
        "Performance Vehicles": "High-performance sports cars, premium engines, racing heritage and luxury vehicle pricing.",
        "Luxury EVs": "Premium electric cars, advanced cabins, high-end brand positioning and battery-electric drivetrains.",
        "Motorsport": "Racing teams, motorsport engineering, sponsorships and performance-vehicle brand halo.",
    },
    "Luxury Goods": {
        "Luxury": "High-price heritage brands, exclusivity, craftsmanship and premium retail distribution.",
        "Premium Apparel": "Designer clothing, leather goods, footwear and fashion collections sold at luxury price points.",
        "Jewelry & Watches": "Fine jewelry, watches, precious stones, horology and high-value accessories.",
        "Beauty & Fragrance": "Prestige cosmetics, skincare, perfume and selective beauty retail.",
        "Branded Merchandise": "Licensed or owned branded goods extending luxury labels into accessories or lifestyle categories.",
        "Lifestyle Licensing": "Royalty revenue from brand licensing across apparel, hotels, eyewear or consumer categories.",
    },
    "Travel & Leisure": {
        "Hotels & Resorts": "Lodging properties, management fees, room nights, resorts and hospitality brands.",
        "Cruise Lines": "Passenger cruise ships, itineraries, onboard spending and vacation bookings.",
        "Airlines": "Passenger flights, route networks, aircraft fleets, ticket sales and loyalty programs.",
        "Experiences": "Theme parks, tours, attractions, destination activities and leisure bookings.",
    },
    "Logistics Networks": {
        "Logistics": "Warehousing, transportation management, fulfillment and supply-chain coordination.",
        "Supply Chain": "Inventory planning, procurement links, distribution networks and shipment visibility.",
        "Parcel Delivery": "Small-package pickup, sorting, last-mile delivery and residential or business parcels.",
        "Freight Forwarding": "Air, ocean and truck freight brokerage, customs handling and shipment consolidation.",
        "Cold Chain": "Temperature-controlled storage, refrigerated transport and logistics for food or pharmaceuticals.",
    },
    "Air Freight & Logistics": {
        "Express Delivery": "Time-definite parcel networks, courier routes, air hubs and premium delivery fees.",
        "Air Cargo": "Freighter aircraft, cargo belly capacity, air freight handling and global cargo lanes.",
        "Logistics Solutions": "Contract logistics, fulfillment, transportation management and integrated shipping solutions.",
    },
    "Marine Transportation": {
        "Tank Barges": "Inland barges moving petroleum, chemicals or bulk liquids through waterways.",
        "Petrochemical Transport": "Marine transport of refined fuels, chemicals, LPG and petrochemical cargoes.",
        "Container Shipping": "Container vessels, liner routes, port calls and ocean freight rates.",
        "Dry Bulk Shipping": "Bulk carriers moving iron ore, coal, grains and other unpackaged cargo.",
        "Offshore Vessels": "Platform supply vessels, anchor handlers and marine support for offshore energy operations.",
    },
    "Rail Transportation": {
        "Freight Rail": "Rail networks hauling coal, intermodal containers, autos, grain, chemicals and industrial freight.",
        "Intermodal Rail": "Container transfers between truck and rail, intermodal terminals and long-haul freight corridors.",
        "Rail Equipment": "Locomotives, railcars, braking systems, signaling and maintenance equipment.",
    },
    "Aerospace Systems": {
        "Commercial Aircraft": "Airframes, narrowbody and widebody programs, aircraft deliveries and airline fleet demand.",
        "Aircraft Engines": "Jet engines, propulsion systems, spare parts and long-term engine maintenance.",
        "Avionics": "Flight controls, cockpit electronics, navigation, communication and aircraft sensor systems.",
    },
    "Observability Platforms": {
        "Infrastructure Monitoring": "Server, container, network and cloud resource monitoring for IT operations.",
        "Application Monitoring": "Application performance management, tracing, latency, errors and user-experience telemetry.",
        "Log Analytics": "Log collection, indexing, search, retention and incident investigation workflows.",
        "Telemetry": "Metrics, traces, events and instrumentation data emitted by software and systems.",
    },
    "National Security Space": {
        "Defense Satellites": "Military satellite constellations, secure payloads and classified spacecraft programs.",
        "Space ISR": "Space-based intelligence, surveillance, reconnaissance, imagery and signals collection.",
        "Military Communications": "Protected satellite communications, tactical terminals and resilient military connectivity.",
    },
    "AI Drug Discovery": {
        "Computational Biology": "Algorithms modeling proteins, pathways, genomics and biological systems for medicine discovery.",
        "AI Drug Discovery": "Machine learning for target discovery, molecule generation, screening and lead optimization.",
        "Drug Simulation": "Molecular dynamics, physics-based models and in silico testing of drug candidates.",
    },
    "Electrification": {
        "Power Distribution": "Switchgear, breakers, transformers and distribution equipment delivering electricity to buildings or plants.",
        "Electrical Equipment": "Motors, relays, panels, controls and industrial electrical hardware.",
        "Energy Efficiency": "Building controls, efficient motors, lighting, HVAC optimization and energy-saving systems.",
        "Power Conversion": "Inverters, converters, drives and rectifiers converting electrical current or voltage.",
    },
    "Industrial Digitalization": {
        "Digital Twins": "Virtual models of factories, machines, buildings or grids used for simulation and operations.",
        "Industrial Software": "Manufacturing execution, plant data, asset management and automation software.",
        "Simulation Software": "Engineering simulation, physics models, finite element analysis and virtual testing.",
        "Engineering Software": "CAD, product lifecycle management, design collaboration and technical documentation tools.",
    },
    "Construction & Industrial Equipment": {
        "Construction Equipment": "Excavators, loaders, dozers, cranes and machines used at construction job sites.",
        "Industrial Machinery": "Factory equipment, compressors, pumps, tools and machinery for industrial production.",
        "Construction Technology": "Job-site software, measurement tools, machine control and digital workflows for contractors.",
        "Rental Equipment": "Equipment rental fleets, utilization rates, tool rental and contractor customer bases.",
    },
    "Precision Agriculture": {
        "Agricultural Equipment": "Tractors, combines, planters, sprayers and farm machinery used by growers.",
        "Smart Farming": "Precision guidance, yield maps, agronomy analytics, sensors and farm-management software.",
        "Crop Inputs": "Seeds, crop protection, fertilizer and agronomic inputs affecting crop yield.",
    },
    "Construction Materials": {
        "Roofing Systems": "Shingles, membranes, insulation and roofing components for residential or commercial buildings.",
        "Flooring Systems": "Floor coverings, tiles, underlayment and installation systems for buildings.",
        "Concrete Admixtures": "Chemical additives changing concrete strength, curing, flow, durability or waterproofing.",
        "Sealants & Coatings": "Waterproofing, adhesives, caulks, protective coatings and building-envelope chemicals.",
    },
    "Water Infrastructure": {
        "Water Treatment": "Filtration, disinfection, membranes and treatment chemicals improving water quality.",
        "Smart Water Networks": "Meters, leak detection, pressure monitoring and software for water utilities.",
        "Water Utilities": "Regulated water distribution, wastewater collection and utility customer billing.",
        "Pumping Systems": "Pumps, valves, controls and flow equipment moving water through buildings or utilities.",
        "Desalination": "Membranes, reverse osmosis and systems converting seawater or brackish water to fresh water.",
        "Pool Equipment": "Pool pumps, filters, heaters, cleaners, automation controls and residential pool systems.",
    },
    "Environmental Services": {
        "Waste Management": "Solid-waste collection routes, transfer stations, landfills and municipal waste contracts.",
        "Hazardous Waste": "Handling, treatment and disposal of regulated chemicals, medical waste or industrial waste.",
        "Industrial Cleanup": "Tank cleaning, spill response, site cleanup and industrial maintenance crews.",
        "Recycling": "Material recovery facilities, sorting, scrap processing and recycled commodity streams.",
        "Environmental Remediation": "Soil, groundwater and contamination cleanup for industrial or government sites.",
        "Pest Control Services": "Route-based termite, rodent, insect and structural pest-control subscriptions.",
    },
    "Agricultural Chemicals": {
        "Fertilizer Production": "Potash, phosphate, nitrogen fertilizer, blending and crop nutrient manufacturing.",
        "Ammonia Production": "Ammonia synthesis, hydrogen feedstock, nitrogen fertilizer precursor and industrial ammonia sales.",
        "Nitrogen Products": "Urea, UAN, ammonium nitrate and nitrogen nutrient products used by farmers.",
    },
    "Industrial Gases": {
        "Industrial Oxygen": "Bulk or packaged oxygen used in steelmaking, chemicals, refining, welding, combustion, wastewater treatment and industrial processes.",
        "Industrial Nitrogen": "Nitrogen generation, liquefaction, distribution and on-site supply for inerting, blanketing, freezing, purging and manufacturing processes.",
        "Argon & Noble Gases": "Argon, helium, neon, krypton, xenon or other noble gases sold for welding, lighting, electronics, research or specialty industrial uses.",
        "Hydrogen Supply": "Merchant hydrogen production, purification, liquefaction, storage, distribution and fueling supply for industrial or energy customers.",
        "Medical Gases": "Medical oxygen, nitrous oxide, respiratory gases and hospital or home-healthcare gas supply and equipment services.",
        "Electronic Specialty Gases": "Ultra-high-purity carrier gases, dopant gases, etchants and specialty gases supplied to semiconductor, display or photovoltaic manufacturing.",
    },
    "Specialty Chemicals": {
        "Industrial Maintenance Chemicals": "Formulated maintenance fluids, degreasers, corrosion inhibitors and repair chemicals for industrial facilities.",
        "Lubricants": "Oils, greases, additives and lubrication systems for engines, machines and industrial equipment.",
        "Surface Treatments": "Coatings, plating, sealers and chemical treatments modifying material surfaces.",
        "Cleaning Chemicals": "Detergents, disinfectants, solvents and sanitation chemicals sold to households or institutions.",
    },
    "Critical Minerals": {
        "Rare Earths": "Neodymium, praseodymium, dysprosium and rare-earth processing for magnets and electronics.",
        "Lithium": "Lithium brine, spodumene, conversion and battery-grade lithium chemicals.",
        "Nickel": "Nickel mining, refining and battery or stainless-steel feedstocks.",
        "Graphite": "Natural or synthetic graphite anodes and processing for lithium-ion batteries.",
        "Mineral Processing": "Crushing, flotation, refining, beneficiation and separation of strategic minerals.",
    },
    "Copper Electrification": {
        "Copper": "Copper cathodes, smelting, refining and conductive metal supply.",
        "Copper Mining": "Copper mines, ore grades, concentrate production and reserve development.",
        "Electrical Wiring": "Building wire, magnet wire and conductors used in electrical systems.",
        "Power Cables": "Transmission cables, distribution cables, subsea cables and high-voltage conductors.",
    },
    "Precious Metals": {
        "Gold": "Gold mining, reserves, bullion exposure and mine production.",
        "Silver": "Silver mining, precious-metal byproduct streams and industrial silver demand.",
        "Royalty & Streaming": "Mine royalties, metal streams and financing agreements tied to future production.",
        "Mining Services": "Drilling, engineering, equipment and technical work for mining operators.",
    },
    "Telecom Infrastructure": {
        "Telecommunications": "Carrier networks, wireless service, fixed-line connectivity and telecom subscriber revenue.",
        "5G Infrastructure": "Radio access networks, small cells, antennas and 5G network upgrades.",
        "Fiber Networks": "Fiber-optic cables, metro fiber, last-mile fiber and broadband backbones.",
        "Tower Infrastructure": "Cell towers, rooftop sites, leases and colocated wireless equipment.",
        "Broadband Networks": "Cable, fiber and fixed-wireless broadband connections for homes or businesses.",
        "Cell Towers": "Macro towers, tower leasing, site acquisition and mobile-network tenancy.",
        "Wireless Infrastructure": "Antennas, radios, spectrum, base stations and wireless network equipment.",
    },
    "Data Center Real Estate": {
        "Data Center REITs": "Public real estate owners leasing data-center space, power and cooling capacity.",
        "Colocation": "Multi-tenant data centers renting cabinets, cages, interconnection and managed capacity.",
        "Hyperscale Leasing": "Large data-center leases with cloud or AI tenants requiring massive power commitments.",
    },
    "Real Estate Income": {
        "Industrial REITs": "Warehouses, logistics properties, distribution centers and industrial rental income.",
        "Residential REITs": "Apartments, single-family rentals, manufactured housing and residential rent collections.",
        "Healthcare REITs": "Medical office, senior housing, skilled nursing and hospital real estate rents.",
        "Net Lease": "Single-tenant properties with long leases, tenant-paid expenses and predictable rent.",
        "Self Storage": "Storage facilities, rental units and consumer or small-business storage demand.",
    },
    "Real Estate Services": {
        "Property Management": "Building operations, tenant services, maintenance coordination and rent administration.",
        "Commercial Brokerage": "Leasing, investment sales and transaction commissions for commercial properties.",
        "Facilities Management": "Workplace operations, maintenance, cleaning and building support for occupiers.",
        "Real Estate Advisory": "Valuation, consulting, capital markets and advisory work for property investors.",
    },
    "AdTech": {
        "Mobile Advertising": "In-app ads, mobile attribution, app-install campaigns and smartphone advertising inventory.",
        "Programmatic Advertising": "Automated ad buying, real-time bidding, DSPs, SSPs and exchange-based media trading.",
        "Performance Marketing": "Conversion tracking, affiliate campaigns, lead generation and return-on-ad-spend optimization.",
    },
    "Sports Betting": {
        "Online Sportsbooks": "Mobile sports wagering, odds, betting slips and regulated sportsbook operations.",
        "iGaming": "Online casino games, digital wagering wallets and regulated internet gambling.",
        "Fantasy Sports": "Daily fantasy contests, player drafts, entry fees and sports-data-driven competitions.",
    },
    "Gaming & Gambling": {
        "Casinos": "Physical casino floors, slot machines, table games, resorts and gaming licenses.",
        "Online Casinos": "Digital slots, table games, live dealer games and regulated casino apps.",
        "Lottery Operators": "Lottery terminals, instant games, draw games and government lottery contracts.",
    },
    "EdTech": {
        "Online Learning": "Digital courses, learning management systems, tutoring platforms and remote education.",
        "Professional Training": "Credentialing, compliance training, certification courses and workforce upskilling.",
        "Educational Software": "Curriculum tools, classroom software, student information systems and assessment platforms.",
    },
    "Human Capital": {
        "Staffing": "Temporary staffing, professional placement, billable worker hours and employer recruiting demand.",
        "HR Software": "Human resource information systems, benefits administration and employee record platforms.",
        "Payroll": "Payroll processing, tax filing, wage payments and employer compliance workflows.",
        "Recruiting Platforms": "Job boards, applicant tracking, talent marketplaces and hiring software.",
    },
    "Testing & Certification": {
        "Industrial Inspection": "Asset inspection, nondestructive testing, safety checks and industrial compliance visits.",
        "Product Certification": "Standards testing, certification marks, regulatory approvals and quality verification.",
        "Laboratory Testing": "Analytical labs, materials testing, environmental samples and scientific test reports.",
    },
    "Professional Services": {
        "Consulting": "Management, strategy, technology and implementation consulting for enterprise clients.",
        "Outsourcing": "Business process outsourcing, managed operations, customer support and back-office contracts.",
        "Engineering Services": "Design engineering, project management, infrastructure planning and technical consulting.",
    },
    "Correctional Services": {
        "Private Prisons": "Privately operated correctional facilities, detention centers and government inmate contracts.",
        "Electronic Monitoring": "Ankle monitors, offender tracking, supervision software and community-corrections technology.",
    },
    "Funeral Services": {
        "Funeral Homes": "Funeral arrangements, memorial ceremonies, embalming and family death-care locations.",
        "Cemeteries": "Burial plots, mausoleums, perpetual care and cemetery property sales.",
        "Cremation Services": "Crematories, urns, cremation packages and memorialization after cremation.",
    },
    "Forestry": {
        "Timberlands": "Owned forest acreage, timber harvesting rights and logs sold into wood supply chains.",
        "Wood Products": "Lumber, engineered wood, panels and building materials from timber.",
        "Pulp & Paper": "Pulp mills, paper, tissue, containerboard and forest-fiber processing.",
    },
    "Packaging": {
        "Consumer Packaging": "Cartons, flexible packaging, labels and containers for retail consumer goods.",
        "Industrial Packaging": "Bulk containers, drums, protective packaging and shipping materials for industrial customers.",
        "Beverage Packaging": "Aluminum cans, glass bottles, closures and containers for drinks.",
    },
    "Education Services": {
        "Universities": "Degree programs, campuses, tuition, enrollment and higher-education operations.",
        "Training Providers": "Vocational training, test preparation, career courses and skills instruction.",
        "Student Services": "Student support, enrollment management, tutoring, housing and education administration.",
    },
    "Music Industry": {
        "Music Streaming": "Subscription or ad-supported music platforms, listening data and digital royalty payments.",
        "Music Rights": "Publishing catalogs, copyrights, licensing, royalties and song ownership.",
        "Record Labels": "Recorded music, artist contracts, distribution, promotion and catalog monetization.",
    },
    "GovTech": {
        "Government Software": "Permit systems, case management, public records and agency workflow software.",
        "Public Sector IT": "IT modernization, systems integration, cloud migration and support for government agencies.",
        "Defense Software": "Mission software, command systems, logistics applications and defense program software.",
    },
    "Marine Recreation": {
        "Boat Retail": "Dealer sales of recreational boats, parts, accessories and marine warranties.",
        "Yacht Retail": "Luxury yacht brokerage, new yacht sales and high-end marine distribution.",
        "Yacht Services": "Maintenance, repair, storage, marina work and management for yachts.",
        "Boat Financing": "Loans, leases and financing programs for recreational boat purchases.",
    },
    "Restaurant Franchises": {
        "Quick Service Restaurants": "Fast-food restaurants, standardized menus, franchise royalties and drive-through traffic.",
        "Restaurant Franchising": "Franchise fees, royalty streams, store development and brand licensing for restaurant operators.",
    },
    "Beverage Brands": {
        "Soft Drinks": "Carbonated drinks, bottled water, sports drinks, juice and nonalcoholic beverage brands.",
        "Alcoholic Beverages": "Beer, wine, spirits, ready-to-drink cocktails and alcohol distribution.",
    },
    "Pet Care": {
        "Pet Food": "Dog food, cat food, treats, premium nutrition and pet consumables.",
        "Veterinary Services": "Animal hospitals, veterinary clinics, diagnostics and recurring pet healthcare visits.",
        "Veterinary Pharma": "Animal medicines, vaccines, parasiticides and therapeutics for pets or livestock.",
        "Livestock Health": "Medicines, vaccines, diagnostics and herd-health management for cattle, swine or poultry.",
        "Pet Diagnostics": "Veterinary lab tests, imaging, genetic tests and diagnostic tools for companion animals.",
    },
    "Food & Beverage": {
        "Packaged Foods": "Shelf-stable groceries, snacks, frozen foods, cereals and branded food sold through retailers.",
        "Plant-Based Foods": "Plant-derived meat, dairy alternatives and vegetarian food categories.",
        "Alternative Proteins": "Cultivated, fermented, insect or plant protein technologies replacing conventional animal protein.",
        "Meat Alternatives": "Burgers, nuggets, sausages and prepared foods designed to substitute for meat.",
        "Foodservice": "Ingredients, prepared foods, distribution and supply to restaurants, cafeterias and institutions.",
        "Food Delivery": "Online ordering, delivery networks, restaurant marketplaces and courier logistics for meals.",
    },
    "Household & Personal Care": {
        "Home Care": "Cleaning sprays, dish soap, disinfectants and household surface-care brands.",
        "Fabric Care": "Laundry detergent, fabric softener, stain removers and textile cleaning brands.",
        "Personal Care": "Skin care, deodorant, shampoo, grooming and everyday hygiene categories.",
        "Beauty & Grooming": "Cosmetics, razors, hair care, skincare and grooming routines.",
        "Baby & Family Care": "Diapers, wipes, family hygiene and infant-care consumables.",
        "Oral Care": "Toothpaste, toothbrushes, mouthwash and dental hygiene brands.",
        "Paper Products": "Tissue, paper towels, toilet paper and disposable household paper goods.",
    },
    "Consumer Health": {
        "OTC Health Products": "Non-prescription medicines, pain relief, cold remedies and consumer pharmacy brands.",
        "Vitamins & Supplements": "Vitamins, minerals, protein powders, nutraceuticals and wellness supplement brands.",
        "Digestive Health": "Antacids, probiotics, laxatives, fiber supplements and gastrointestinal remedies.",
        "Respiratory Health": "Cough, cold, allergy, decongestant and respiratory symptom treatments.",
        "Sleep & Relaxation": "Melatonin, sleep aids, calming supplements and relaxation-oriented wellness brands.",
        "Sexual Wellness": "Contraceptives, lubricants, fertility aids and sexual health consumer categories.",
    },
    "Retail & Distribution": {
        "Luxury Retail": "Stores and online channels selling premium fashion, jewelry, watches or luxury accessories.",
        "Beauty Retail": "Cosmetics, skincare, fragrance and salon retail chains or ecommerce.",
        "Department Stores": "Multi-category retail stores selling apparel, home goods, beauty and accessories.",
        "Travel Retail": "Airport, cruise and duty-free retail selling to travelers.",
        "Specialty Retail": "Focused retail chains serving categories such as apparel, electronics, hobbies or home improvement.",
        "Direct-to-Consumer": "Brand-owned online sales, subscriptions and customer acquisition outside wholesale channels.",
    },
    "Automotive Retail": {
        "Auto Dealerships": "New and used vehicle dealerships, service bays, parts sales and auto financing.",
        "Vehicle Distribution": "Wholesale distribution, importer networks and logistics moving vehicles to dealers.",
    },
    "Mortgage Finance": {
        "Secondary Mortgage Market": "Purchasing, pooling and funding mortgages after loan origination.",
        "Mortgage Securitization": "Mortgage-backed securities, securitization pools and structured housing finance.",
        "Mortgage Guarantees": "Credit guarantees, agency guarantees and insurance-like protection on mortgage pools.",
        "Single-Family Mortgages": "Home loans for individual residential properties and owner-occupied housing.",
        "Multifamily Mortgages": "Apartment-property loans, multifamily guarantees and rental-housing finance.",
    },
    "Physical Security": {
        "Alarm Monitoring": "Recurring monitoring of intrusion alarms, dispatch calls and residential or commercial security accounts.",
        "Security Systems": "Installed cameras, panels, sensors and intrusion detection equipment.",
        "Smart Home Security": "Connected cameras, doorbells, locks and app-controlled residential security.",
        "Fire & Life Safety": "Fire alarms, sprinklers, suppression systems, inspections and code compliance.",
        "Emergency Response": "Dispatch coordination, medical alert systems and rapid response workflows.",
        "Access Control": "Badges, locks, biometrics, entry systems and identity-based building access.",
    },
}


def build_theme_registry(
    hierarchy: Mapping[str, Sequence[str]] = ALLOWED_THEME_HIERARCHY,
) -> Dict[str, ThemeDefinition]:
    """Create semantic definition records without changing the production taxonomy."""

    registry: Dict[str, ThemeDefinition] = {}
    for parent, subthemes in hierarchy.items():
        explicit_subthemes = _SUBTHEME_DEFINITIONS.get(parent, {})
        subtheme_definitions = {
            subtheme: explicit_subthemes.get(
                subtheme,
                _default_subtheme_definition(parent, subtheme),
            )
            for subtheme in subthemes
        }
        registry[parent] = {
            "definition": _PARENT_THEME_DEFINITIONS.get(
                parent,
                _default_theme_definition(parent),
            ),
            "contrasts_with": dict(_PARENT_THEME_CONTRASTS.get(parent, {})),
            "subthemes": subtheme_definitions,
        }
    return registry



_GENERIC_DEFINITION_PATTERNS = (
    "Business exposure to",
    "products, services, assets, or infrastructure",
    "products, services, infrastructure",
)


def audit_theme_registry_definitions(
    registry: Optional[ThemeRegistry] = None,
    hierarchy: Mapping[str, Sequence[str]] = ALLOWED_THEME_HIERARCHY,
) -> Dict[str, Any]:
    """Return read-only quality signals for semantic retrieval definitions."""

    registry = registry or THEME_REGISTRY
    missing_parent_definitions: list[str] = []
    missing_subtheme_definitions: list[str] = []
    generic_definitions: list[str] = []

    for parent, subthemes in hierarchy.items():
        definition_record = registry.get(parent) or {}
        parent_definition = definition_record.get("definition")
        if not parent_definition:
            missing_parent_definitions.append(parent)
        elif isinstance(parent_definition, str) and _definition_looks_generic(parent_definition):
            generic_definitions.append(parent)

        subtheme_records = definition_record.get("subthemes") or {}
        for subtheme in subthemes:
            subtheme_definition = (
                subtheme_records.get(subtheme)
                if isinstance(subtheme_records, dict)
                else None
            )
            if not subtheme_definition:
                missing_subtheme_definitions.append(f"{parent} > {subtheme}")
            elif _definition_looks_generic(subtheme_definition):
                generic_definitions.append(f"{parent} > {subtheme}")

    return {
        "parent_count": len(hierarchy),
        "subtheme_count": sum(len(subthemes) for subthemes in hierarchy.values()),
        "missing_parent_definitions": missing_parent_definitions,
        "missing_subtheme_definitions": missing_subtheme_definitions,
        "generic_definitions": generic_definitions,
    }


def _definition_looks_generic(definition: str) -> bool:
    normalized = " ".join(definition.split())
    return any(pattern in normalized for pattern in _GENERIC_DEFINITION_PATTERNS)


def get_theme_definition(theme: str) -> Optional[str]:
    definition = THEME_REGISTRY.get(theme)
    if not definition:
        return None
    value = definition.get("definition")
    return value if isinstance(value, str) else None


def get_subtheme_definition(theme: str, subtheme: str) -> Optional[str]:
    definition = THEME_REGISTRY.get(theme)
    if not definition:
        return None
    subthemes = definition.get("subthemes") or {}
    return subthemes.get(subtheme) if isinstance(subthemes, dict) else None


def validate_theme_registry(
    registry: Optional[ThemeRegistry] = None,
    hierarchy: Mapping[str, Sequence[str]] = ALLOWED_THEME_HIERARCHY,
) -> None:
    registry = registry or THEME_REGISTRY
    missing: list[str] = []
    for parent, subthemes in hierarchy.items():
        definition = registry.get(parent)
        theme_definition = definition.get("definition") if definition else None
        if not isinstance(theme_definition, str) or not theme_definition.strip():
            missing.append(parent)
            continue
        subtheme_definitions = definition.get("subthemes") or {}
        if not isinstance(subtheme_definitions, dict):
            missing.append(parent)
            continue
        for subtheme in subthemes:
            subtheme_definition = subtheme_definitions.get(subtheme)
            if not subtheme_definition or not subtheme_definition.strip():
                missing.append(f"{parent} > {subtheme}")

    extra_parents = set(registry) - set(hierarchy)
    if missing or extra_parents:
        details = []
        if missing:
            details.append(f"missing definitions: {', '.join(missing)}")
        if extra_parents:
            details.append(f"unknown themes: {', '.join(sorted(extra_parents))}")
        raise ValueError("; ".join(details))


def _humanize_label(label: str) -> str:
    text = f" {label} "
    for source, replacement in _LABEL_EXPANSIONS.items():
        text = text.replace(source, replacement)
    return " ".join(text.lower().split())


def _default_theme_definition(theme: str) -> str:
    phrase = _humanize_label(theme)
    return (
        f"Companies with material business exposure to {phrase} products, services, "
        "infrastructure, platforms, or assets."
    )


def _default_subtheme_definition(parent: str, subtheme: str) -> str:
    parent_phrase = _humanize_label(parent)
    subtheme_phrase = _humanize_label(subtheme)
    return (
        f"Business exposure to {subtheme_phrase} products, services, assets, or infrastructure "
        f"within {parent_phrase} markets."
    )


THEME_REGISTRY = build_theme_registry()
