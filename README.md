<div align="center">

#  Portfolium

**Modern investment portfolio tracker**  Manage stocks, ETFs, and crypto with real-time pricing, P&L analytics, and beautiful charts.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.0+-61DAFB.svg)](https://react.dev/)

[Quick Start](#-quick-start)  [Features](#-features)  [Documentation](docs/)  [API Docs](http://localhost:8000/docs)

---

###  Screenshots

<p align="center">
  <img src=".github/assets/dashboard.png" alt="Dashboard" width="100%"/>
  <br/>
  <em>Real-time dashboard with portfolio metrics and performance tracking</em>
</p>

<p align="center">
  <img src=".github/assets/transactions.png" alt="Transactions" width="100%"/>
  <br/>
  <img src=".github/assets/assets.png" alt="Assets" width="100%"/>
  <em>Transaction history & Asset management with logos</em>
</p>

</div>

---

##  Quick Start

**Prerequisites:** Docker & Docker Compose

```bash
# 1. Clone and configure
git clone https://github.com/ArthurMTX/Portfolium.git
cd Portfolium
cp .env.example .env

# 2. Launch
docker compose up -d

# 3. Access
# Frontend: http://localhost:5173
# API Docs: http://localhost:8000/docs
```

That's it!  Default admin credentials are in your `.env` file.

<details>
<summary> <strong>Manual setup without Docker</strong></summary>

```bash
# Backend
cd api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -e .
uvicorn app.main:app --reload

# Frontend
cd web
npm install
npm run dev
```
</details>

---

##  Architecture

Monorepo with 3 services:

- **db**: PostgreSQL 15
- **api**: FastAPI + yfinance
- **web**: React + Vite + TypeScript + TailwindCSS

---

##  Features

<table>
<tr>
<td width="50%">

###  Portfolio Management
- Multi-portfolio support with user isolation
- Stocks, ETFs, crypto (Yahoo Finance)
- Automatic cost basis & P&L calculations
- Realized/unrealized gains tracking
- CSV import with drag & drop

</td>
<td width="50%">

###  Modern UI
- Clean, responsive design
- Dark mode
- Real-time charts & heatmaps
- Company logo integration
- Ticker search & autocomplete
- Price alerts & notifications

</td>
</tr>
<tr>
<td>

###  Developer Experience
- FastAPI with auto-generated docs
- JWT authentication
- Role-based access control
- Comprehensive test coverage
- Hot reload for development

</td>
<td>

###  Production Ready
- Docker containerized
- PostgreSQL backend
- Automatic price updates
- Currency conversion
- Email notifications (optional)
- Admin dashboard

</td>
</tr>
</table>

---

##  Tech Stack

**Backend:** FastAPI  Python 3.11  PostgreSQL 15  SQLAlchemy  yfinance  
**Frontend:** React 18  TypeScript  Vite  TailwindCSS  shadcn/ui  Recharts  
**DevOps:** Docker  Docker Compose

---

##  Documentation

Comprehensive documentation is available in the [`docs/`](docs/) folder:

- **[Quick Start Guide](docs/getting-started/quick-start.md)**  Get up and running
- **[API Reference](docs/api/overview.md)**  Complete endpoint documentation
- **[User Guide](docs/user-guide/dashboard.md)**  Feature walkthrough
- **[Technical Docs](docs/technical/overview.md)**  Architecture & internals
- **[Configuration](docs/getting-started/configuration.md)**  Environment variables & settings

---

##  Common Tasks

```bash
# View logs
docker compose logs -f api

# Run tests
docker compose exec api pytest -v

# Reset database ( deletes all data)
docker compose down -v && docker compose up -d

# Access PostgreSQL
docker compose exec db psql -U portfolium
```

---

##  Security

- JWT-based authentication with bcrypt password hashing
- Role-based authorization (user/admin)
- CORS configuration for trusted origins
- SQL injection prevention via SQLAlchemy ORM
- Input validation with Pydantic
- Optional email verification flow

---

##  Contributing

Contributions welcome! See [`docs/development/contributing.md`](docs/development/contributing.md) for guidelines.

---

##  License

MIT  [Arthur MTX](https://github.com/ArthurMTX)

---

<div align="center">

**Built with  using FastAPI and React**

[Report Bug](https://github.com/ArthurMTX/Portfolium/issues)  [Request Feature](https://github.com/ArthurMTX/Portfolium/issues)

</div>
