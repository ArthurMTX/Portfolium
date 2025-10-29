# Installation

Get Portfolium up and running in minutes with Docker.

## Prerequisites

Before you begin, ensure you have the following installed:

- [Docker](https://docs.docker.com/get-docker/) (version 20.10 or higher)
- [Docker Compose](https://docs.docker.com/compose/install/) (version 2.0 or higher)
- Git

## Quick Installation

### 1. Clone the Repository

```bash
git clone https://github.com/ArthurMTX/Portfolium.git
cd Portfolium
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit the `.env` file with your preferred settings:

```env
# Database Configuration
POSTGRES_DB=portfolium
POSTGRES_USER=portfolium
POSTGRES_PASSWORD=portfolium
POSTGRES_HOST=db
POSTGRES_PORT=5432

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
API_KEY=dev-key-12345
VITE_API_URL=http://localhost:8000

# Administrator bootstrap (created at API startup when enabled)
# Set ADMIN_AUTO_CREATE=true to create or update the admin account from these values
ADMIN_AUTO_CREATE=true
ADMIN_EMAIL=admin@portfolium.local
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_FULL_NAME=Administrator
ADMIN_IS_ACTIVE=true
ADMIN_IS_VERIFIED=true

# JWT Authentication
# IMPORTANT: Generate a strong secret key for production!
# You can generate one with: openssl rand -hex 32
SECRET_KEY=your-secret-key-change-this-in-production-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080  # 7 days

# Email Configuration (SMTP)
# Set to true to enable email sending
ENABLE_EMAIL=false

# For Gmail, use smtp.gmail.com:587 and an App Password
# For other providers, adjust accordingly
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_TLS=true
FROM_EMAIL=noreply@portfolium.local
FROM_NAME=Portfolium

# Frontend URL (for email verification and password reset links)
FRONTEND_URL=http://localhost:5173

# Price Caching
PRICE_CACHE_TTL_SECONDS=300

# Transaction Validation
VALIDATE_SELL_QUANTITY=true

# Brandfetch API (optional - for company logos)
BRANDFETCH_API_KEY=replace-with-your-brandfetch-api-key

# CORS Origins (comma-separated list of allowed origins)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:8080
```

### 3. Start the Services

```bash
docker compose up -d
```

This will start:

- **PostgreSQL** database on port `5432`
- **FastAPI** backend on port `8000`
- **React** frontend on port `5173`

### 4. Access Portfolium

Open your browser and navigate to:

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Documentation**: [http://localhost:5173/docs](http://localhost:5173/docs)

### 5. Login

Use the admin credentials you configured:

- **Username**: `admin` (or your configured username)
- **Password**: `admin123` (or your configured password)

## Verify Installation

Check that all services are running:

```bash
docker compose ps
```

You should see three containers running:

- `portfolium-db`
- `portfolium-api`
- `portfolium-web`

## Next Steps

- [Quick Start Guide](quick-start.md) - Learn the basics
- [Configuration](configuration.md) - Customize your installation
- [User Guide](../user-guide/portfolios.md) - Start managing your portfolio

## Troubleshooting

### Services Won't Start

Check the logs:

```bash
docker compose logs
```

### Database Connection Issues

Ensure PostgreSQL is healthy:

```bash
docker compose ps db
```

Restart the database:

```bash
docker compose restart db
```

### Port Conflicts

If ports 5173, 8000, or 5432 are already in use, modify the port mappings in `docker-compose.yml`.

## Manual Installation (Development)

For development without Docker, see the [Development Guide](../development/architecture.md).
