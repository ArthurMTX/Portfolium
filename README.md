# 🌸 Portfolium

**Production-ready investment tracking application** with multi-asset portfolio management (stocks, ETFs, crypto), P&L calculations, CSV import, real-time price updates, automatic logo fetching, ticker search, and modern UI.

## 🏗️ Architecture

Monorepo with 3 services:

- **db**: PostgreSQL 15
- **api**: FastAPI (Python 3.11) + yfinance
- **web**: React + Vite + TypeScript + TailwindCSS + shadcn/ui

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- (Optional) Node.js 18+ and Python 3.11+ for local development

### Launch

```bash
# Copy environment variables
cp .env.example .env

# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Check API health
curl http://localhost:8000/health

# Access the frontend
# Open http://localhost:5173
```

Services are available at:

- **Frontend**: http://localhost:5173
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **PostgreSQL**: localhost:5432

### Shutdown

```bash
docker compose down

# With volume removal (⚠️ deletes all data)
docker compose down -v
```

## 🎯 Features

### Backend API

- ✅ Multi-portfolio management
- ✅ Support for stocks, ETFs, crypto (via Yahoo Finance tickers)
- ✅ Transactions: BUY, SELL, DIVIDEND, FEE, SPLIT
- ✅ Automatic average cost calculation (weighted average)
- ✅ Realized and unrealized P&L
- ✅ CSV import
- ✅ Price refresh via yfinance (on-demand + scheduler)
- ✅ Price caching (configurable TTL)
- ✅ Sell validation (prevents selling more shares than owned - configurable)
- ✅ Unit tests (pytest)

### Frontend

- ✅ Dashboard with real-time metrics
- ✅ Logos via Brandfetch API
- ✅ Ticker auto-completion & search via Yahoo Finance
- ✅ Positions table (sorting, filters, pagination)
- ✅ Transaction history
- ✅ CSV import with drag & drop
- ✅ Dark mode
- ✅ Price charts (Recharts)
- ✅ Responsive UI

## 📊 Database

### Schema

**4 main tables** in the `portfolio` schema:

1. **assets**: List of assets (unique Yahoo ticker)
2. **portfolios**: User portfolios
3. **transactions**: Operation history
4. **prices**: Latest prices cache

### Sample seed data

The `db/init/02_seed.sql` file creates:

- 1 "CTO" portfolio
- 5 assets (AAPL, NVDA, MSFT, BTC-USD, ETH-USD)
- 6 sample transactions

## 🔧 API Endpoints

### Health

- `GET /health` → API status

### Assets

- `GET /assets?query=AAPL` → Auto-completion
- `POST /assets` → Create an asset

### Portfolios

- `GET /portfolios` → List all
- `POST /portfolios` → Create new
- `GET /portfolios/{id}/positions` → Positions with P&L
- `GET /portfolios/{id}/metrics` → Aggregated metrics
- `GET /portfolios/{id}/transactions` → Transaction history

### Transactions

- `POST /portfolios/{id}/transactions` → New transaction
- `POST /import/csv` → CSV import

### Prices

- `GET /prices?symbols=AAPL,MSFT` → Current prices
- `POST /refresh/prices` → Force refresh

### Settings

- `GET /settings` → Get settings
- `PUT /settings` → Update settings

Interactive documentation: http://localhost:8000/docs

## 📥 CSV Import Format

Supported columns:

```csv
date,symbol,type,quantity,price,fees,currency,notes
2024-01-15,AAPL,BUY,10,150.25,9.99,USD,Initial purchase
2024-02-20,AAPL,BUY,5,165.80,9.99,USD,Adding to position
2024-03-10,AAPL,DIVIDEND,15,0.24,0,USD,Q1 dividend
2024-04-05,AAPL,SELL,5,180.50,9.99,USD,Taking profits
2024-05-15,NVDA,BUY,20,520.30,15.99,USD,AI boom position
2024-06-20,MSFT,BUY,8,375.20,9.99,USD,Cloud diversification
```

Accepted types: `BUY`, `SELL`, `DIVIDEND`, `FEE`, `SPLIT`

For a **split** (e.g., 2:1), add a `split_ratio` column:

```csv
date,symbol,type,split_ratio
2024-06-01,AAPL,SPLIT,2:1
```

## 🧪 Tests

### Backend

```bash
# Inside the container
docker compose exec api pytest

# Locally
cd api
python -m pytest tests/ -v
```

### Coverage

- Tests for average cost and P&L calculations
- Tests for pricing service (with yfinance mocking)
- CSV import tests

## 🛠️ Local Development

### API (without Docker)

```bash
cd api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -e .
uvicorn app.main:app --reload --port 8000
```

### Frontend (without Docker)

```bash
cd web
npm install
npm run dev
```

## 🔒 Security

- CORS configured for `http://localhost:5173`
- Pydantic validation on all inputs
- Optional API Key (header `X-API-Key`)
- Docker healthchecks

## ⚙️ Advanced Configuration

### Environment Variables

See `.env.example` for the complete list.

### Transaction Validation

Automatic validation that prevents selling more shares than owned.

```bash
# In .env
VALIDATE_SELL_QUANTITY=true  # Default: true
```

To disable (useful for importing historical data or short selling):

```bash
VALIDATE_SELL_QUANTITY=false
```

### Price Scheduler

By default, automatic refresh every **15 minutes** for portfolio assets.

Configurable in `api/app/tasks/scheduler.py`.

### Cache TTL

`PRICE_CACHE_TTL_SECONDS=300` (5 minutes by default)

### Brandfetch API (Logo Fetching)

The application can automatically fetch company logos using the Brandfetch API.

```bash
# In .env
BRANDFETCH_API_KEY=your_api_key_here
```

To get an API key:
1. Visit [Brandfetch](https://brandfetch.com/)
2. Sign up for a free account
3. Get your API key from the dashboard

**Note**: Logo fetching is optional. If no API key is provided, the feature will be disabled automatically.

## 🐛 Troubleshooting

### API won't start

```bash
docker compose logs api
# Check that PostgreSQL is ready
docker compose ps
```

### Prices not refreshing

- Check scheduler logs: `docker compose logs api | grep scheduler`
- Yahoo Finance may rate-limit: the service uses a fallback to the last prices in DB

### CORS Error

Verify that `VITE_API_URL` points to `http://localhost:8000` in `.env`.

## 📄 License

MIT

---