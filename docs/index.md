# Portfolium Documentation

<section class="pf-hero">
  <div class="pf-hero__eyebrow">Self-hosted portfolio management</div>
  <h1 class="pf-hero__title">Track portfolios, market data, analytics, and reports from one private workspace.</h1>
  <p class="pf-hero__body">
    Portfolium is an open source platform for managing stocks, ETFs, crypto positions, dashboards,
    watchlists, notifications, and daily reports. This documentation covers installation, product
    workflows, API usage, and the internal services that keep market data current.
  </p>
  <div class="pf-hero__actions">
    <a class="md-button md-button--primary" href="getting-started/quick-start/">Start quickly</a>
    <a class="md-button" href="getting-started/installation/">Install Portfolium</a>
    <a class="md-button" href="api/overview/">Use the API</a>
  </div>
</section>

## Choose Your Path

<div class="pf-grid">
  <a class="pf-card" href="getting-started/installation/">
    <h3>Install and operate</h3>
    <p>Run Portfolium with Docker, configure environment variables, and expose the web/API services.</p>
  </a>
  <a class="pf-card" href="user-guide/portfolios/">
    <h3>Use the product</h3>
    <p>Create portfolios, add transactions, customize dashboards, review assets, and manage alerts.</p>
  </a>
  <a class="pf-card" href="widgets/">
    <h3>Understand widgets</h3>
    <p>Explore dashboard cards for P&L, allocation, market status, risk metrics, and watchlists.</p>
  </a>
  <a class="pf-card" href="api/overview/">
    <h3>Integrate with the API</h3>
    <p>Authenticate, inspect generated OpenAPI docs, and understand route groups.</p>
  </a>
  <a class="pf-card" href="technical/overview/">
    <h3>Read internals</h3>
    <p>Follow pricing, logo resolution, currency conversion, observability, and data model behavior.</p>
  </a>
  <a class="pf-card" href="operations/backup-restore/">
    <h3>Run it in production</h3>
    <p>Back up your data, put it behind HTTPS, upgrade safely, and troubleshoot common issues.</p>
  </a>
  <a class="pf-card" href="development/architecture/">
    <h3>Contribute safely</h3>
    <p>Learn the architecture, tests, documentation checks, and contribution workflow.</p>
  </a>
</div>

## Platform Overview

<div class="pf-status">
  <div class="pf-status__item">
    <span class="pf-status__label">Frontend</span>
    <span class="pf-status__value">React + Vite</span>
  </div>
  <div class="pf-status__item">
    <span class="pf-status__label">Backend</span>
    <span class="pf-status__value">FastAPI</span>
  </div>
  <div class="pf-status__item">
    <span class="pf-status__label">Storage</span>
    <span class="pf-status__value">PostgreSQL</span>
  </div>
  <div class="pf-status__item">
    <span class="pf-status__label">Async work</span>
    <span class="pf-status__value">Celery + Redis</span>
  </div>
</div>

Portfolium is composed of a web application, an API, a PostgreSQL database, Redis-backed caching/queues,
and Celery workers for market data refreshes, reports, insights, reference data, notifications, and
maintenance tasks.

## Core Features

| Area | What it covers |
| --- | --- |
| Portfolios and transactions | Multiple portfolios, buy/sell/dividend flows, realized and unrealized performance. |
| Market data | Yahoo Finance pricing, market calendars, stock splits, fundamentals, and currency conversion. |
| Dashboards | Persistent grid layouts with widgets for value, P&L, allocation, risk, watchlists, and macro signals. |
| Asset intelligence | Themes, subthemes, notes, logos, metadata overrides, research views, and provider validation. |
| Notifications | Price, daily change, ATH/ATL, reports, web push, email delivery, and retention controls. |
| Operations | Docker deployment, Redis cache, Celery workers, Flower, Prometheus metrics, structured logs, and security headers. |

## Maintenance

The documentation is built with MkDocs Material and is served from the web image at `/docs`.

Use these commands before shipping documentation changes:

```bash
pip install -r docs/requirements.txt -e ./api
make docs-check
```

The docs health checks export the FastAPI OpenAPI schema, fail on placeholder markers, and run
`mkdocs build --strict` so broken links and invalid navigation are caught early.
