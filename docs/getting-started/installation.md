# Installation

Get Portfolium running with Docker Compose.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (version 20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (version 2.0+)
- Git

## Quick Installation

### 1. Clone the Repository

```bash
git clone https://github.com/ArthurMTX/Portfolium.git
cd Portfolium
```

### 2. Configure Environment

```bash
cp .env.example .env
```

At minimum, review and change:

```env
POSTGRES_PASSWORD=change-me
SECRET_KEY=generate-a-real-32+-char-secret   # openssl rand -hex 32
ADMIN_EMAIL=you@example.com
ADMIN_USERNAME=your-username
ADMIN_PASSWORD=change-me
```

See [Configuration](configuration.md) for the full list of environment variables.

### 3. Start the Stack

```bash
docker compose up -d
```

This starts seven services:

| Service | Role |
|---|---|
| `db` | PostgreSQL database |
| `redis` | Cache, Celery broker/result backend |
| `bootstrap` | One-shot: runs database migrations, ensures admin user and email config, then exits |
| `api` | FastAPI backend |
| `celery-worker` | Executes background tasks (pricing, insights, reports, notifications) |
| `celery-beat` | Schedules background tasks — see [Background Jobs](../technical/background-jobs.md) |
| `web` | nginx serving the frontend, proxying `/api` to the API, and serving these docs at `/docs` |

Only the `web` service exposes a port to the host — everything else communicates over an internal Docker network.

### 4. Access Portfolium

Open [http://localhost](http://localhost) (port $80$). The frontend, API (under `/api`), and this documentation (under `/docs`) are all served through the same `web` container.

### 5. Log In

Use the admin credentials you set in `.env` (`ADMIN_USERNAME` / `ADMIN_PASSWORD`).

!!! warning "Change the default admin password"
    If you didn't override `ADMIN_PASSWORD` before first startup, log in and change it immediately — the example value in `.env.example` is public.

## Verify Installation

```bash
docker compose ps
```

All seven services should show as running/healthy, except `bootstrap`, which is expected to **exit after completing successfully** — that's a one-shot job, not a long-running service.

If something looks wrong, check [Troubleshooting](../operations/troubleshooting.md).

## Next Steps

- [Quick Start Guide](quick-start.md)
- [Configuration](configuration.md)
- [User Guide: Portfolios](../user-guide/portfolios.md)
- [Operations: Backup & Restore](../operations/backup-restore.md)
- [Operations: Reverse Proxy & HTTPS](../operations/reverse-proxy-https.md)

## Development Setup

For local development with hot-reload instead of production images, see [Contributing](../development/contributing.md).
