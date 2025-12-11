# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.1] - 2025-12-11

### Features

* implement Two-Factor Authentication (2FA) functionality ([c736a50](https://github.com/ArthurMTX/Portfolium/commit/c736a50))
* add 2FA support to user admin pages and translations ([8638d53](https://github.com/ArthurMTX/Portfolium/commit/8638d53))
* implement Toast component for user notifications and replace alerts with toast messages in Admin, Transactions, and Watchlist pages ([6635993](https://github.com/ArthurMTX/Portfolium/commit/6635993))
* implement asynchronous fetching of major market indices with error handling ([7c768ef](https://github.com/ArthurMTX/Portfolium/commit/7c768ef))
* enhance market indices fetching with additional indices and improved result structure ([f41b244](https://github.com/ArthurMTX/Portfolium/commit/f41b244))
* add dashboard warmup task and increase batch cache TTL to 5 minutes ([5d00583](https://github.com/ArthurMTX/Portfolium/commit/5d00583))
* optimize get_multiple_prices method for true parallel fetching of prices ([515f06d](https://github.com/ArthurMTX/Portfolium/commit/515f06d))
* add support for conversion and transfer transaction types in RecentTransactionsWidget ([5bcf854](https://github.com/ArthurMTX/Portfolium/commit/5bcf854))
* implement caching optimizations for public portfolios and batch prices ([a8ed822](https://github.com/ArthurMTX/Portfolium/commit/a8ed822))
* enhance error handling with custom exceptions for goals and conversions ([4b75dac](https://github.com/ArthurMTX/Portfolium/commit/4b75dac))
* add additional targets to Makefile for improved build and development workflow ([e9d341f](https://github.com/ArthurMTX/Portfolium/commit/e9d341f))
* add dev-up and dev-restart-build targets to Makefile for improved development workflow ([6ba55ce](https://github.com/ArthurMTX/Portfolium/commit/6ba55ce))
* optimize portfolio and transaction handling with caching improvements ([4d8dc92](https://github.com/ArthurMTX/Portfolium/commit/4d8dc92))

### Bug Fixes

* fix daily portfolio report scheduler not sending emails due to missing task routing and translation file access in Celery workers
* add user redirection to dashboard on login, password reset, and registration pages if already logged in ([1ac15c5](https://github.com/ArthurMTX/Portfolium/commit/1ac15c5))
* add handling for asyncio.CancelledError in pricing service fetch methods ([91ae241](https://github.com/ArthurMTX/Portfolium/commit/91ae241))
* reorder import statements for better readability ([fd20a29](https://github.com/ArthurMTX/Portfolium/commit/fd20a29))
* extend transaction types in AssetPriceChart and enhance visualization for conversions and transfers ([4948bf1](https://github.com/ArthurMTX/Portfolium/commit/4948bf1))
* disable background refetching for dashboard and widget components ([048413a](https://github.com/ArthurMTX/Portfolium/commit/048413a))
* correct net cash value formatting in PositionDetailModal ([f61178e](https://github.com/ArthurMTX/Portfolium/commit/f61178e))
* correct Dockerfile path for web build in Makefile ([3f23375](https://github.com/ArthurMTX/Portfolium/commit/3f23375))

### Refactor

* remove unused props and imports in TwoFactorLogin and TwoFactorSettings components ([0721394](https://github.com/ArthurMTX/Portfolium/commit/0721394))

## [0.3.0] - 2025-12-07

### Features

* add conversion transaction types and UI for crypto conversions with CONVERSION_IN and CONVERSION_OUT support ([5d4f80b](https://github.com/ArthurMTX/Portfolium/commit/5d4f80b))
* implement conversion tab and update transaction fetching logic to handle conversion types ([ccd7f7a](https://github.com/ArthurMTX/Portfolium/commit/ccd7f7a))
* add price fetching functionality for transactions with currency conversion and loading state ([6d7bd0f](https://github.com/ArthurMTX/Portfolium/commit/6d7bd0f))
* enhance watchlist conversion functionality with currency handling and fees ([da3fed3](https://github.com/ArthurMTX/Portfolium/commit/da3fed3))
* add watchlist tags feature with management UI and selector component ([be1e343](https://github.com/ArthurMTX/Portfolium/commit/be1e343))
* enhance watchlist functionality with tag filtering and editing capabilities ([5c11da4](https://github.com/ArthurMTX/Portfolium/commit/5c11da4))
* implement localStorage persistence for watchlist tag filters and enhance UI translations ([24c619b](https://github.com/ArthurMTX/Portfolium/commit/24c619b))
* add public sharing functionality for portfolios with unique share tokens and visibility settings ([9ce88e7](https://github.com/ArthurMTX/Portfolium/commit/9ce88e7))
* update PublicPortfolio component to use favicon and enhance email templates with base HTML and PDF templates ([e483423](https://github.com/ArthurMTX/Portfolium/commit/e483423))
* add portfolio goals feature with CRUD operations, projections using Monte Carlo simulation, and goal tracking widget ([62fcef1](https://github.com/ArthurMTX/Portfolium/commit/62fcef1))
* add portfolio insights page, risk analysis, dashboard widgets, and i18n support ([336da3f](https://github.com/ArthurMTX/Portfolium/commit/336da3f))
* enhance GoalTrackerWidget with internationalization support for categories, scenarios, and messages ([3ae19d2](https://github.com/ArthurMTX/Portfolium/commit/3ae19d2))
* add fundamental data service and enhance position metrics calculations with market cap, revenue growth, earnings growth, and liquidity score ([1098374](https://github.com/ArthurMTX/Portfolium/commit/1098374))
* add liquidity and fundamental metrics to PositionDetailModal and API; enhance formatting utilities and translations ([c06eeba](https://github.com/ArthurMTX/Portfolium/commit/c06eeba))
* implement detailed metrics and background tasks for updating and backfilling ATH prices; add PositionDetailModal component ([2aa6504](https://github.com/ArthurMTX/Portfolium/commit/2aa6504))
* add breakeven metrics for negative positions and update translations ([6de8d6b](https://github.com/ArthurMTX/Portfolium/commit/6de8d6b))
* add layout editing functionality and enhance translation strings ([69fdb1b](https://github.com/ArthurMTX/Portfolium/commit/69fdb1b))
* enhance dashboard widget height calculation and adjust widget constraints ([43f0d9a](https://github.com/ArthurMTX/Portfolium/commit/43f0d9a))
* add user registration feature with configuration option ([a438f63](https://github.com/ArthurMTX/Portfolium/commit/a438f63))
* enhance CSV import and export functionality with sequence and conversion ID support ([04858a3](https://github.com/ArthurMTX/Portfolium/commit/04858a3))
* add development commands for Docker management ([03f814d](https://github.com/ArthurMTX/Portfolium/commit/03f814d))
* enhance asset search to include direct cryptocurrency lookups ([2b3d4e7](https://github.com/ArthurMTX/Portfolium/commit/2b3d4e7))
* enhance currency formatting functions for improved precision and usability ([3e0e454](https://github.com/ArthurMTX/Portfolium/commit/3e0e454))
* add country field to public holdings and update related components for enhanced asset metadata display ([3e30b6c](https://github.com/ArthurMTX/Portfolium/commit/3e30b6c))
* update footer to include GitHub link and improve disclaimer presentation ([8a17b7f](https://github.com/ArthurMTX/Portfolium/commit/8a17b7f))
* add "Go to Dashboard" translation and update links in PublicPortfolio component ([b4df528](https://github.com/ArthurMTX/Portfolium/commit/b4df528))

### Bug Fixes

* enhance ConversionModal and WatchlistEditModal for improved search functionality and logo validation ([2e358da](https://github.com/ArthurMTX/Portfolium/commit/2e358da))
* enhance price quote functionality with target currency conversion and asset enrichment ([c1813fd](https://github.com/ArthurMTX/Portfolium/commit/c1813fd))
* correct sign for unrealized PnL formatting in widgetDefinitions ([a9c8c5b](https://github.com/ArthurMTX/Portfolium/commit/a9c8c5b))
* improve logo fetching strategy by prioritizing company name search over ticker search ([def6181](https://github.com/ArthurMTX/Portfolium/commit/def6181))
* implement atomic transaction creation for conversions and enhance validation in ConversionModal ([92fe6d5](https://github.com/ArthurMTX/Portfolium/commit/92fe6d5))
* enhance styling in ConversionModal and Transactions components for improved user experience ([cc6924c](https://github.com/ArthurMTX/Portfolium/commit/cc6924c))
* add modal-overlay class to LayoutManager for improved styling ([f7bca90](https://github.com/ArthurMTX/Portfolium/commit/f7bca90))
* update performance metrics display in TopPerformers and WorstPerformers widgets for improved clarity ([b015c65](https://github.com/ArthurMTX/Portfolium/commit/b015c65))
* enhance TotalReturnWidget to display currency based on active portfolio ([0d0fb38](https://github.com/ArthurMTX/Portfolium/commit/0d0fb38))
* invalidate cache for held and sold assets on metadata override change ([4aeb8a9](https://github.com/ArthurMTX/Portfolium/commit/4aeb8a9))
* update watchlist empty state messages for improved user experience ([b837bfe](https://github.com/ArthurMTX/Portfolium/commit/b837bfe))
* update styling for top holdings section in PublicPortfolio component ([2314b22](https://github.com/ArthurMTX/Portfolium/commit/2314b22))
* update Docker and development configurations for improved performance and error handling ([d0638ce](https://github.com/ArthurMTX/Portfolium/commit/d0638ce))
* add portfolioId prop to AssetPriceChart and pass activePortfolioId from Assets ([c0bad39](https://github.com/ArthurMTX/Portfolium/commit/c0bad39))
* correct translation key for chart period buttons ([1e11b84](https://github.com/ArthurMTX/Portfolium/commit/1e11b84))
* improve handling of /docs requests to ensure proper redirection and file serving ([83bc723](https://github.com/ArthurMTX/Portfolium/commit/83bc723))
* add translation for 'User' in English and French locales ([07642c3](https://github.com/ArthurMTX/Portfolium/commit/07642c3))
* update report date calculation to use current date in EST timezone for accurate daily reports ([9bd86d3](https://github.com/ArthurMTX/Portfolium/commit/9bd86d3))
* update growth and margin metrics to display percentage values in PositionDetailModal ([30cb911](https://github.com/ArthurMTX/Portfolium/commit/30cb911))
* update hover styles for PositionsTable to enhance user experience ([b544ff0](https://github.com/ArthurMTX/Portfolium/commit/b544ff0))
* optimize dashboard data fetching by reducing redundant user queries and removing debug logs ([00fb484](https://github.com/ArthurMTX/Portfolium/commit/00fb484))
* refactor Beta calculation to use yfinance for asset and benchmark data retrieval ([2bd9d5c](https://github.com/ArthurMTX/Portfolium/commit/2bd9d5c))
* enhance PositionDetailModal with internationalization support for performance and risk metrics ([e0d86a2](https://github.com/ArthurMTX/Portfolium/commit/e0d86a2))
* remove unnecessary class from image elements in PortfolioHeatmapWidget and WatchlistWidget ([fedd331](https://github.com/ArthurMTX/Portfolium/commit/fedd331))

### Documentation

* add web app manifest and associated icons for PWA support ([775b6dc](https://github.com/ArthurMTX/Portfolium/commit/775b6dc))
* improving readme and adding medias ([2efe149](https://github.com/ArthurMTX/Portfolium/commit/2efe149))
* add Crypto Conversions section to user guide for enhanced portfolio management ([c2bf99e](https://github.com/ArthurMTX/Portfolium/commit/c2bf99e))
* add detailed metrics navigation and MathJax fix integration for enhanced documentation ([c35d8b3](https://github.com/ArthurMTX/Portfolium/commit/c35d8b3))
* added documentation for metrics ([67ac4c5](https://github.com/ArthurMTX/Portfolium/commit/67ac4c5))
* added documentation for widgets ([caf4c86](https://github.com/ArthurMTX/Portfolium/commit/caf4c86))
* add volume for public documentation in development environment ([650f87e](https://github.com/ArthurMTX/Portfolium/commit/650f87e))

## [0.2.1] - 2025-11-06

### Features

* implement batch price fetching endpoint for portfolios to enhance performance ([a4eac7d](https://github.com/ArthurMTX/Portfolium/commit/a4eac7d))
* add AssetsList component for displaying and filtering asset data ([05c49e8](https://github.com/ArthurMTX/Portfolium/commit/05c49e8))
* Implement dark mode and improve error handling across authentication pages ([f7300d7](https://github.com/ArthurMTX/Portfolium/commit/f7300d7))
* add localized not found messages and error handling in NotFound component ([6c2d660](https://github.com/ArthurMTX/Portfolium/commit/6c2d660))

### Bug Fixes

* update wallet percentage label in PositionsTable component ([9e981bc](https://github.com/ArthurMTX/Portfolium/commit/9e981bc))
* Enhance portfolio management by validating active portfolio and resetting store on user change ([be3dc74](https://github.com/ArthurMTX/Portfolium/commit/be3dc74))
* Refactor French translations to group period labels and enhance empty state messages ([27ad7e6](https://github.com/ArthurMTX/Portfolium/commit/27ad7e6))
* Adjust admin link visibility by moving the separator above the admin menu item ([b5aae4a](https://github.com/ArthurMTX/Portfolium/commit/b5aae4a))
* Refactor asset transaction calculations to improve portfolio-specific views ([82073e7](https://github.com/ArthurMTX/Portfolium/commit/82073e7))
* Update sector filtering to use effective sector and industry for user-specific overrides ([f7ce8f1](https://github.com/ArthurMTX/Portfolium/commit/f7ce8f1))

## [0.2.0] - 2025-11-05

### Features
    
* add asset distribution component with API integration and refactor country/currency utilities ([e71b9ac](https://github.com/ArthurMTX/Portfolium/commit/e71b9ac))
* add transaction metrics page with buy/sell analysis and visual charts ([7d71a2d](https://github.com/ArthurMTX/Portfolium/commit/7d71a2d))
* update version to 0.2.0 and implement language support with i18next integration ([cd83fc3](https://github.com/ArthurMTX/Portfolium/commit/cd83fc3))
* add Asset Metadata Edit component with sector, industry, and country overrides ([c16a634](https://github.com/ArthurMTX/Portfolium/commit/c16a634))
* enhance IconPreview component: implement industry filtering by sector, add example company display, and improve search functionality ([d95d7a1](https://github.com/ArthurMTX/Portfolium/commit/d95d7a1))
* add documentation link to user menu and update translations for navigation ([ed3f10b](https://github.com/ArthurMTX/Portfolium/commit/ed3f10b))
* add French language support ([cc47d9e](https://github.com/ArthurMTX/Portfolium/commit/cc47d9e))
* refactor translation keys in Transactions and Watchlist pages for consistency; add user preferred language to database; implement email translation utilities; enhance notification translation logic; create translation utilities for sectors and industries ([23beacc](https://github.com/ArthurMTX/Portfolium/commit/23beacc))
* enhance asset translation functionality; add asset class and type translation utilities; update AssetDistribution and Assets components to utilize new translations ([01a2df6](https://github.com/ArthurMTX/Portfolium/commit/01a2df6))

### Bug Fixes

* refactor currency formatting functions for improved precision and consistency ([556c271](https://github.com/ArthurMTX/Portfolium/commit/556c271))
* enhance portfolio metrics and performance chart with cost basis and unrealized P&L calculations ([72bba3a](https://github.com/ArthurMTX/Portfolium/commit/72bba3a))
* add zero starting point for "ALL" interval in portfolio history charts and improve hover functionality ([6208498](https://github.com/ArthurMTX/Portfolium/commit/6208498))
* enhance chart interaction by updating hover functionality and display logic ([eb01ddd](https://github.com/ArthurMTX/Portfolium/commit/eb01ddd))
* enhance Transactions and Watchlist pages with sorting and loading indicators ([b122f18](https://github.com/ArthurMTX/Portfolium/commit/b122f18))
* improve memory and fetch lock handling for async operations ([1d44e9c](https://github.com/ArthurMTX/Portfolium/commit/1d44e9c))
* enhance logo fetching logic for cryptocurrencies to avoid incorrect matches ([b55aef1](https://github.com/ArthurMTX/Portfolium/commit/b55aef1))
* implement cleanup of stale tasks in pricing service to prevent event loop errors ([6dbe0d7](https://github.com/ArthurMTX/Portfolium/commit/6dbe0d7))
* update get_sector_industries_distribution to include current user dependency for asset retrieval ([cbd6793](https://github.com/ArthurMTX/Portfolium/commit/cbd6793))

## [0.1.1] - 2025-11-01

### Features

* add search functionality to Assets and Transactions pages ([8152d5f](https://github.com/ArthurMTX/Portfolium/commit/8152d5f99bb63636b97776238e33b23d758b37bd))
* add DevTools page for creating test notifications and managing notification types ([f998809](https://github.com/ArthurMTX/Portfolium/commit/f998809341eca7ae0de80da1782c1ea2c5c09412))
* implement tab navigation for profile settings ([4132fcd](https://github.com/ArthurMTX/Portfolium/commit/4132fcdbf8ed9024f9e608cc722fbaeadaab3835))
* transaction history is now a sortable table ([013c62e](https://github.com/ArthurMTX/Portfolium/commit/013c62efa649b599eaa8a607924fb2948834d7ab))
* enhance performance metrics calculation & various fixes ([1f5d586](https://github.com/ArthurMTX/Portfolium/commit/1f5d5862598a0f6db235d0823292bfbef65e83c3))
* Add FlagPreview and IconPreview components for country flags and icons display ([595ff35](https://github.com/ArthurMTX/Portfolium/commit/595ff353e7b396d4f7824d36735cf89b58456c83))

### Bug Fixes

* remove branch prefix from SHA tag generation in Docker build workflow ([c5d6515](https://github.com/ArthurMTX/Portfolium/commit/c5d6515b317ea456760e88cb173789c01b31e532))
* update color classes and formatting for daily change percentages across components ([2500d4a](https://github.com/ArthurMTX/Portfolium/commit/2500d4a665c9419dce583125b203621787aca797))
* enhance migration scripts with detailed logging and error handling ([ff3808a](https://github.com/ArthurMTX/Portfolium/commit/ff3808af2c6315c62cb266ef4148548325820f8b))
* refactor price refresh and alert check to use async event loop for improved performance ([67ae818](https://github.com/ArthurMTX/Portfolium/commit/67ae81809eeff6587e7fcfb24a61d1833c5208f1))
* optimize asset loading by fetching sold positions concurrently with current positions ([a915e71](https://github.com/ArthurMTX/Portfolium/commit/a915e71901d60597b7f841491e8b58501cd1abc9))
* update position quantity calculation to include transactions on the as_of_date ([4b4c04b](https://github.com/ArthurMTX/Portfolium/commit/4b4c04bbd0c7794c7e365afa5384457d8d985aaa))
* add support for creating and updating watchlist items with optional fields ([0635943](https://github.com/ArthurMTX/Portfolium/commit/0635943268084a1db0c3ea921888658b6af3678e))
* prevent body scroll when modals are open and update modal overlay styles ([a06b1c3](https://github.com/ArthurMTX/Portfolium/commit/a06b1c3ddd3d0ea7cdb29171fe35899a8a1f3ece))
* enhance logo fetching logic for ETFs and improve error handling ([b74743f](https://github.com/ArthurMTX/Portfolium/commit/b74743f4451b782b414e1206919da8d70b7962ba))
* enhance investment performance chart with hover state and improved performance calculations ([23af867](https://github.com/ArthurMTX/Portfolium/commit/23af86752b2d52b2b51ee9a13b2d86f3d92fab96))
* update sector color mapping for Telecommunications and Industrials ([8c89006](https://github.com/ArthurMTX/Portfolium/commit/8c8900606b7dea782790182c7b173bf8d70bb899))

## [0.1.0] - 2025-10-30


### ⚠ BREAKING CHANGES

* **api:** add multi-user JWT auth, admin controls, price caching+scheduler, asset enrichment, logs/settings endpoints, and per-portfolio ACLs

### Features

* add asset price history tracking and visualization ([2558da3](https://github.com/ArthurMTX/Portfolium/commit/2558da3fbe9fe6ca811de1d817aa12306ce0bce0))
* add email configuration and daily report features ([dcb9dff](https://github.com/ArthurMTX/Portfolium/commit/dcb9dff90b346e313a8295bf2f332bca0a1d102f))
* add logos via Brandfetch API and ticker search functionality to frontend features ([d8c11ac](https://github.com/ArthurMTX/Portfolium/commit/d8c11acce524fe97320cdc109d62040e0cb5d427))
* add market status to health check and update dashboard to display it ([650e1c0](https://github.com/ArthurMTX/Portfolium/commit/650e1c05e1a059a9d617a5bb8d5250f8edfa1d15))
* add notifications system and stock split management with price alerts, login tracking, and transaction events ([f6c14a4](https://github.com/ArthurMTX/Portfolium/commit/f6c14a4913ef88522a92bdc5c7bc9153954c3c86))
* add portfolio heatmap with daily performance, rename Portfolio to Charts, swap tab order ([6f00a55](https://github.com/ArthurMTX/Portfolium/commit/6f00a5579eee4f45e9d40b06d6782a1e9e87afb3))
* add Portfolio Insights page with comprehensive analysis and performance metrics ([bf65f8f](https://github.com/ArthurMTX/Portfolium/commit/bf65f8f9e3b39ae05c8f8bfc30ac1db0752ddcab))
* add tabbed interface for positions, optimize sold positions query, and clarify fee-inclusive pricing labels ([1dbae76](https://github.com/ArthurMTX/Portfolium/commit/1dbae76d7e602fb6a99370c287fa2a19d292cfb2))
* add transaction history to assets, improve decimal handling and split ratio display ([c97c556](https://github.com/ArthurMTX/Portfolium/commit/c97c5564a79c3a7853da9202032ddc154ee6f7bc))
* add version management and display across frontend and backend ([6976da8](https://github.com/ArthurMTX/Portfolium/commit/6976da80b548cbfb463b0bcbf62a551a666d8a78))
* add watchlist feature with price tracking, alerts, import/export, and convert-to-buy functionality ([db5a573](https://github.com/ArthurMTX/Portfolium/commit/db5a573a7e3973efc9dda859b649d221fd527182))
* **api:** add multi-user JWT auth, admin controls, price caching+scheduler, asset enrichment, logs/settings endpoints, and per-portfolio ACLs ([268f19b](https://github.com/ArthurMTX/Portfolium/commit/268f19b4c82c823d4f337c4302f4c589dbeb1f36))
* consolidate logo fetching logic with validation and SVG fallback in fetch_logo_with_validation function ([926209f](https://github.com/ArthurMTX/Portfolium/commit/926209f2685f4082faa2250f22679172653c437b))
* display portfolio allocation percentage for each position ([99c3d9f](https://github.com/ArthurMTX/Portfolium/commit/99c3d9ff8b61b80d811b4e08f54957dfa578cda5))
* enhance asset table with country, sector, and industry fields; update seed data accordingly ([ceafb84](https://github.com/ArthurMTX/Portfolium/commit/ceafb84192e3a838013281ca42e1306fdd8e27da))
* enhance asset tracking by adding split and transaction counts to held and sold assets ([f798ccf](https://github.com/ArthurMTX/Portfolium/commit/f798ccfadf45967f30eeeffed94fe4355ffee079))
* enhance loading states with skeleton screens across multiple components for improved user experience ([3f186e1](https://github.com/ArthurMTX/Portfolium/commit/3f186e1f9ea90d444b4ac354bab3472541c1db71))
* enhance notification system by adding DAILY_CHANGE_UP and DAILY_CHANGE_DOWN types and improve SQL query for session notifications ([b66601e](https://github.com/ArthurMTX/Portfolium/commit/b66601e613cfc000fa0bb5b439a9fcfe6dc89fa7))
* enhance price calculation logic to prioritize official previous close and improve historical data handling ([9e069e5](https://github.com/ArthurMTX/Portfolium/commit/9e069e5fa014b89c92967dc71f7f78ec3e827bf9))
* enhance transaction handling by adding split-adjusted quantities and new sold positions endpoint ([7e89bbb](https://github.com/ArthurMTX/Portfolium/commit/7e89bbbf10fa45f124ff4d27f573985d37c5b7e9))
* enhance UI components for better responsiveness and accessibility across various pages ([b1eab5e](https://github.com/ArthurMTX/Portfolium/commit/b1eab5e2e19702f741251fad4d053f7d0d5946ba))
* implement caching for portfolio insights and enhance API call with abort signal support ([4960862](https://github.com/ArthurMTX/Portfolium/commit/496086219b02d4af9f94ef2ee314ed4b1b5320b9))
* implement daily change notifications for user holdings and add settings for notification preferences ([5403813](https://github.com/ArthurMTX/Portfolium/commit/540381369556943681a856f77d46135c8ee13b89))
* implement EmptyPortfolioPrompt and EmptyTransactionsPrompt components for better user guidance across multiple pages ([ce4074d](https://github.com/ArthurMTX/Portfolium/commit/ce4074df6c756c80b7c08b782695eba0a2519c85))
* implement grid-based treemap layout for portfolio heatmap with responsive sizing ([2fa226b](https://github.com/ArthurMTX/Portfolium/commit/2fa226b4935533fc533a70bda319337c57817130))
* implement logo caching functionality with endpoints for retrieving and clearing cached logos ([2e96492](https://github.com/ArthurMTX/Portfolium/commit/2e964924220e3e5b07e6f76bc362fb4be51501b4))
* implement multi-currency support with automatic FX conversion ([cc6c920](https://github.com/ArthurMTX/Portfolium/commit/cc6c92095222037780bf2e7a2dd63a0d88e2c15d))
* improve heatmap layout with enhanced bin-packing algorithm and stricter size mapping ([c2283c2](https://github.com/ArthurMTX/Portfolium/commit/c2283c24d1d538b48cd02bcc0a90e5a6f781203b))
* initialize portfolio store with Zustand for state management ([be288d8](https://github.com/ArthurMTX/Portfolium/commit/be288d84c6708b12e23ded69dcef13b517b1d4c5))
* optimize dashboard loading with multi-level caching and request deduplication ([784cf04](https://github.com/ArthurMTX/Portfolium/commit/784cf0457e62aaad228cdf069ccc35828954793c))
* refactor insights service and router to use async methods for improved performance ([c6c142f](https://github.com/ArthurMTX/Portfolium/commit/c6c142f5f12e8cf66cd4e86c65c4508c491ddbbd))
* refactor portfolio charts and add investment performance tracking ([9785041](https://github.com/ArthurMTX/Portfolium/commit/97850413b5c653de8cca3c814d372bd2f55c1938))
* refactor scheduler to use AsyncIOScheduler for asynchronous task execution and improve price alert checks ([9e9c13c](https://github.com/ArthurMTX/Portfolium/commit/9e9c13ce1bf5c55c2f4af87a9268be3d609afbd3))
* refactor services and routers to use async methods for improved performance and concurrency ([bf7cb92](https://github.com/ArthurMTX/Portfolium/commit/bf7cb925c1cc570767a6a09ba382e113cdf941f1))
* update asset currency handling in create and enrich functions to prioritize yfinance data ([25610c5](https://github.com/ArthurMTX/Portfolium/commit/25610c5a8513cd675097e4fb694a4ed5eb0b6880))
* update logs router and admin dashboard to enhance log management and visibility ([8456f24](https://github.com/ArthurMTX/Portfolium/commit/8456f244c56eae40274286206191aa6b99c4709c))
* update README to include real-time price updates and ticker search functionality ([c9da7a0](https://github.com/ArthurMTX/Portfolium/commit/c9da7a0ec5e6c0d46e16d85413340afd203cb838))


### Bug Fixes

* add auth to CSV import and split_ratio to export ([5f7c433](https://github.com/ArthurMTX/Portfolium/commit/5f7c433de148584fa36ad86a7d5bfb387102002b))
* add full country code mapping for all countries and territories in Assets page ([19e8234](https://github.com/ArthurMTX/Portfolium/commit/19e823453ddcb854529451ed62a297a7cb623ed7))
* add sorting by created_at to get_transactions for consistent ordering ([3fc2fb6](https://github.com/ArthurMTX/Portfolium/commit/3fc2fb63d71ecc0ad588f391fb5951885e628058))
* adjust image widths in README for better layout ([29269f1](https://github.com/ArthurMTX/Portfolium/commit/29269f174f01dc5fc88cf7ef4673db5f67313bd4))
* assets page now correctly applies stock splits to share quantities ([6678173](https://github.com/ArthurMTX/Portfolium/commit/66781732f56f15bb211eb2cad9afb51fad742199))
* correct order of commands in Dockerfile build stage ([81e457c](https://github.com/ArthurMTX/Portfolium/commit/81e457c799dded27fa718f37b40e09db7491a541))
* enforce email verification on login and fix verification URL ([55f50e2](https://github.com/ArthurMTX/Portfolium/commit/55f50e23ca64e4e1a9fbcb6e3eec47c34c75811c))
* enhance price formatting with dynamic decimal places based on price range ([31fc172](https://github.com/ArthurMTX/Portfolium/commit/31fc172d163d0111fbe306a7b90b557504903d27))
* format quantities to remove trailing zeros in dashboard and assets tables ([4ecd55c](https://github.com/ArthurMTX/Portfolium/commit/4ecd55c589d10ae05a1f3b90ab5851278ca883fd))
* match Unrealized P&L background color to negative/positive state ([9f45e90](https://github.com/ArthurMTX/Portfolium/commit/9f45e90156f6877067cdebce80eff7ad7d715ca6))
* refactor position calculation to sequential processing for improved database access handling ([eaa8b18](https://github.com/ArthurMTX/Portfolium/commit/eaa8b18409d0d547cf8cd744ba08ecc1374f9349))
* remove transaction limit and add UI toggle to show first 100 or all transactions ([3f9a87b](https://github.com/ArthurMTX/Portfolium/commit/3f9a87b4e18e71df84cc666c0704f99598960ebd))
* remove unnecessary flex styling from asset total quantity display ([791f50d](https://github.com/ArthurMTX/Portfolium/commit/791f50d2c90bccdbdbd37bcd4746886708d1a174))
* update button styles in Watchlist for improved visual consistency and accessibility ([8beaa44](https://github.com/ArthurMTX/Portfolium/commit/8beaa4427b6048f9bbd4419242a03bf672e78430))
* update Dockerfile to skip redundant documentation build during web app build ([197e702](https://github.com/ArthurMTX/Portfolium/commit/197e7022c614ce0736eec43ac8568f709aab8af4))
* update FROM_EMAIL domain in .env.example to use local domain ([4430683](https://github.com/ArthurMTX/Portfolium/commit/4430683a5acec21c8ac5706cdb5655a30b45eb75))


### Documentation

* add comprehensive user guide and documentation for settings, transactions, and watchlist ([d7e6090](https://github.com/ArthurMTX/Portfolium/commit/d7e6090102e0baf082d016563e7b2d4bfaeb35ce))
* enhance features section with improved formatting and icons ([76d095f](https://github.com/ArthurMTX/Portfolium/commit/76d095fd1c57d27dfce97ddf6a33d6b1a78708de))
* enhance README structure with improved headings and sections ([31ddf1f](https://github.com/ArthurMTX/Portfolium/commit/31ddf1f3ab69fc98474195d8071545d4471d52e8))
* improve README layout with centered header and screenshots ([39c9960](https://github.com/ArthurMTX/Portfolium/commit/39c9960ea64a2f229ff4bc96bd3fc3e9803651a3))
* update features list to include heatmaps in price charts ([341e9fa](https://github.com/ArthurMTX/Portfolium/commit/341e9fa75ed74d886c6dab84ef677adf80bab3ba))
* update README for clarity and improved structure ([c099693](https://github.com/ArthurMTX/Portfolium/commit/c0996930d8558cbee0e35a0cf6ec7c77408e2aae))
* update README to include automatic FX and currencies conversion feature ([c31726d](https://github.com/ArthurMTX/Portfolium/commit/c31726d6d0497a536a16c28df3532edf7fce4aec))
* update README to include watchlist and notifications system features ([e008151](https://github.com/ArthurMTX/Portfolium/commit/e0081514c2fb67d65be1ed7e48e4952e1ab28d31))

[Unreleased]: https://github.com/ArthurMTX/Portfolium/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/ArthurMTX/Portfolium/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/ArthurMTX/Portfolium/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/ArthurMTX/Portfolium/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/ArthurMTX/Portfolium/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/ArthurMTX/Portfolium/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/ArthurMTX/Portfolium/releases/tag/v0.1.0
