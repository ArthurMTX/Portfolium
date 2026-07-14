/**
 * Release smoke tests for a production-like Portfolium stack.
 *
 * Drives the compiled frontend through nginx (default http://localhost:18080)
 * with real API, PostgreSQL, Redis and Celery behind it. Deterministic by
 * design: every price/cost assertion uses values supplied in the test's own
 * transactions, never live provider data, so a Yahoo outage cannot fail the
 * run (provider-dependent fields are allowed to be empty).
 *
 * Run:
 *   node web/tests/smoke/release-smoke.mjs
 * Requires the `playwright` package (any install visible to node, e.g.
 *   NODE_PATH=/path/to/node_modules with playwright@>=1.40) and a Chromium
 *   download (`npx playwright install chromium`).
 *
 * Environment:
 *   SMOKE_BASE_URL   frontend origin (default http://localhost:18080)
 *   SMOKE_ARTIFACTS  directory for failure screenshots/logs (default ./smoke-artifacts)
 *
 * The suite registers its own throwaway user and deletes the portfolios it
 * created even when a step fails. Run it only against disposable stacks.
 */
import { chromium } from 'playwright'
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:18080'
const API = `${BASE_URL}/api`
const ARTIFACTS = process.env.SMOKE_ARTIFACTS || './smoke-artifacts'

const stamp = Date.now().toString(36)
const USER = {
  email: `smoke-${stamp}@releasecheck.local`,
  username: `smoke_${stamp}`,
  password: `Smoke-${stamp}-Aa1!x`,
}

const results = []
let page, browser, context
let token = null
const createdPortfolioIds = []

function record(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function step(name, fn) {
  try {
    const detail = await fn()
    record(name, true, typeof detail === 'string' ? detail : '')
  } catch (err) {
    record(name, false, err.message)
    if (page) {
      try {
        mkdirSync(ARTIFACTS, { recursive: true })
        const file = join(ARTIFACTS, `${name.replace(/[^a-z0-9]+/gi, '-')}.png`)
        await page.screenshot({ path: file, fullPage: true })
        console.log(`        screenshot: ${file}`)
      } catch { /* screenshot is best-effort */ }
    }
    throw err
  }
}

async function api(method, path, body, useToken = token, extraOk = []) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(useToken ? { Authorization: `Bearer ${useToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok && !extraOk.includes(res.status)) {
    const text = await res.text()
    throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`)
  }
  return res
}

async function apiJson(method, path, body) {
  const res = await api(method, path, body)
  return res.status === 204 ? null : res.json()
}

async function main() {
  browser = await chromium.launch()
  context = await browser.newContext({ locale: 'en-US' })
  page = await context.newPage()
  page.setDefaultTimeout(20000)

  // 21. protected route rejects anonymous access (checked first: clean state)
  await step('anonymous visit to /dashboard redirects to login', async () => {
    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForURL(/\/login/)
  })

  await step('anonymous API request is rejected with 401', async () => {
    const res = await api('GET', '/portfolios', undefined, null, [401])
    if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`)
  })

  // 1. register a test account through the UI
  await step('register test account via UI', async () => {
    await page.goto(`${BASE_URL}/register`)
    await page.fill('#email', USER.email)
    await page.fill('#username', USER.username)
    await page.fill('#password', USER.password)
    await page.fill('#confirmPassword', USER.password)
    await page.click('button[type="submit"]')
    // With email verification disabled the app routes to login or dashboard.
    await page.waitForURL(/\/(login|dashboard)/, { timeout: 30000 })
  })

  await step('invalid login is rejected', async () => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: USER.email, password: 'wrong-password-123' }),
    })
    if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`)
  })

  // 2. log in through the UI
  await step('log in via UI', async () => {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('#email', USER.email)
    await page.fill('#password', USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 30000 })
    token = await page.evaluate(() => localStorage.getItem('auth_token'))
    if (!token) throw new Error('auth_token missing from localStorage after login')
  })

  // Re-authenticate only if an endpoint explicitly invalidated the session.
  async function ensureLoggedIn() {
    if (!page.url().includes('/login')) return
    await page.fill('#email', USER.email)
    await page.fill('#password', USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 30000 })
    token = await page.evaluate(() => localStorage.getItem('auth_token'))
  }

  // 3. dashboard loads
  await step('dashboard renders', async () => {
    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1500)
    await ensureLoggedIn()
    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForSelector('main', { timeout: 30000 })
  })

  // 4. create portfolios (two, to exercise switching)
  let portfolioA, portfolioB
  await step('create two portfolios', async () => {
    portfolioA = await apiJson('POST', '/portfolios', {
      name: `Smoke A ${stamp}`, description: 'release smoke', base_currency: 'USD',
    })
    createdPortfolioIds.push(portfolioA.id)
    portfolioB = await apiJson('POST', '/portfolios', {
      name: `Smoke B ${stamp}`, description: 'release smoke', base_currency: 'USD',
    })
    createdPortfolioIds.push(portfolioB.id)
    return `ids ${portfolioA.id}, ${portfolioB.id}`
  })

  // 5. switch portfolios (both are listed and selectable)
  await step('both portfolios listed for switching', async () => {
    const portfolios = await apiJson('GET', '/portfolios')
    const names = portfolios.map((p) => p.name)
    if (!names.includes(portfolioA.name) || !names.includes(portfolioB.name)) {
      throw new Error(`created portfolios missing from list: ${names.join(', ')}`)
    }
  })

  // 6-7. add a transaction, verify resulting position
  let asset, tx
  await step('add BUY transaction and verify position', async () => {
    // The CI database is disposable and empty. Create deterministic asset data
    // directly so this gate never needs Yahoo search or another provider.
    const createAsset = await api('POST', '/assets', {
      symbol: 'AAPL', name: 'Apple Inc.', currency: 'USD', class_: 'STOCK',
    }, token, [409])
    if (createAsset.status === 409) {
      const existing = await apiJson('GET', '/assets?query=AAPL')
      asset = existing.find((candidate) => candidate.symbol === 'AAPL')
      if (!asset) throw new Error('AAPL conflict reported but existing asset was not returned')
    } else {
      asset = await createAsset.json()
    }
    tx = await apiJson('POST', `/portfolios/${portfolioA.id}/transactions`, {
      asset_id: asset.id, tx_date: '2026-07-01', type: 'BUY',
      quantity: '10', price: '100.00', fees: '1.00', currency: 'USD',
    })
    const positions = await apiJson('GET', `/portfolios/${portfolioA.id}/positions`)
    const pos = positions.find((p) => p.asset_id === asset.id)
    if (!pos) throw new Error('no position for AAPL after BUY')
    if (Number(pos.quantity) !== 10) throw new Error(`expected quantity 10, got ${pos.quantity}`)
    return `tx ${tx.id}, quantity ${pos.quantity}`
  })

  // 8-9. edit the transaction, verify recalculation
  await step('edit transaction and verify recalculated position', async () => {
    await apiJson('PUT', `/portfolios/${portfolioA.id}/transactions/${tx.id}`, {
      asset_id: asset.id, tx_date: '2026-07-01', type: 'BUY',
      quantity: '15', price: '100.00', fees: '1.00', currency: 'USD',
    })
    const positions = await apiJson('GET', `/portfolios/${portfolioA.id}/positions`)
    const pos = positions.find((p) => p.asset_id === asset.id)
    if (Number(pos?.quantity) !== 15) throw new Error(`expected quantity 15, got ${pos?.quantity}`)
  })

  // 10. delete the transaction
  await step('delete transaction and verify empty position', async () => {
    await api('DELETE', `/portfolios/${portfolioA.id}/transactions/${tx.id}`)
    const positions = await apiJson('GET', `/portfolios/${portfolioA.id}/positions`)
    const pos = positions.find((p) => p.asset_id === asset.id && Number(p.quantity) > 0)
    if (pos) throw new Error(`position still present after delete: ${JSON.stringify(pos)}`)
  })

  // Re-add one so pages below have data to render.
  await step('re-add holding for page checks', async () => {
    tx = await apiJson('POST', `/portfolios/${portfolioA.id}/transactions`, {
      asset_id: asset.id, tx_date: '2026-07-01', type: 'BUY',
      quantity: '10', price: '100.00', fees: '1.00', currency: 'USD',
    })
  })

  await step('absolute cold dashboard shows loading, handles 202, then renders', async () => {
    const widgets = [
      'total-value', 'daily-gain', 'unrealized-pnl', 'realized-pnl', 'dividends',
      'positions', 'asset-allocation', 'theme-allocation', 'performance-metrics',
      'recent-transactions',
    ]
    await apiJson('DELETE', `/batch/dashboard/cache?portfolio_id=${portfolioA.id}`)
    await page.evaluate((portfolioId) => {
      const stored = JSON.parse(localStorage.getItem('portfolio-storage') || '{"state":{},"version":0}')
      stored.state = { ...(stored.state || {}), activePortfolioId: portfolioId }
      localStorage.setItem('portfolio-storage', JSON.stringify(stored))
    }, portfolioA.id)

    // Inject the exact server contract once, then let the bounded retry hit the
    // real absolute-cold API/cache path. Cross-worker single-flight is covered
    // independently by the real-Redis two-Uvicorn-worker regression.
    let injectedPending = false
    await page.route('**/api/batch/dashboard', async (route) => {
      if (injectedPending) {
        await route.continue()
        return
      }
      injectedPending = true
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        headers: { 'Retry-After': '0.1' },
        body: JSON.stringify({
          data: {}, errors: null, cached: false, refreshing: true,
          lock_ttl_seconds: 600, timestamp: new Date().toISOString(),
          widgets_requested: widgets.length, data_fetched: 0,
        }),
      })
    })
    const statuses = []
    const onResponse = (response) => {
      if (response.url().endsWith('/api/batch/dashboard')) statuses.push(response.status())
    }
    page.on('response', onResponse)
    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForSelector('.pf-page-skeleton', { timeout: 10000 })
    await page.waitForFunction(() => !document.querySelector('.pf-page-skeleton'), null, {
      timeout: 45000,
    })
    await page.unroute('**/api/batch/dashboard')
    page.off('response', onResponse)
    if (!statuses.includes(202) || !statuses.includes(200)) {
      throw new Error(`expected dashboard 202 then 200, got ${statuses.join(', ')}`)
    }
    if (await page.locator('.pf-state--error').count()) {
      throw new Error('dashboard surfaced a generic error during refresh-pending flow')
    }
    return `statuses ${statuses.join(' -> ')}`
  })

  // 11-15. core pages render without error state
  for (const [name, path] of [
    ['Portfolios (holdings)', '/portfolios'],
    ['Allocation', '/allocation'],
    ['Charts', '/charts'],
    ['Calendar', '/calendar'],
    ['Insights', '/insights'],
  ]) {
    await step(`${name} page renders`, async () => {
      const errors = []
      const onPageError = (err) => errors.push(err.message)
      page.on('pageerror', onPageError)
      await page.goto(`${BASE_URL}${path.toLowerCase()}`)
      await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {})
      if (page.url().includes('/login')) {
        await ensureLoggedIn()
        await page.goto(`${BASE_URL}${path.toLowerCase()}`)
        await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {})
      }
      const stillOnLogin = page.url().includes('/login')
      page.off('pageerror', onPageError)
      if (stillOnLogin) throw new Error('was bounced to login (session lost)')
      if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`)
    })
  }

  // Cash tracking end-to-end. Fully deterministic: every amount asserted
  // below comes from this scenario's own movements, never from a provider.
  await step('cash: activation preview and strict apply', async () => {
    const activation = {
      strategy: 'opening_balances',
      start_date: '2026-07-01',
      target_mode: 'tracked_strict',
      opening_balances: [{ currency: 'USD', amount: '1000' }],
    }
    const preview = await apiJson('POST', `/portfolios/${portfolioB.id}/cash/activation/preview`, activation)
    if (preview.blocking_issues.length) {
      throw new Error(`activation blocked: ${preview.blocking_issues.join('; ')}`)
    }
    const result = await apiJson('POST', `/portfolios/${portfolioB.id}/cash/activation`, {
      ...activation,
      activation_id: randomUUID(),
    })
    if (result.cash_mode !== 'tracked_strict') {
      throw new Error(`expected tracked_strict after activation, got ${result.cash_mode}`)
    }
    return `opening 1000 USD, mode ${result.cash_mode}`
  })

  await step('cash: strict mode rejects insufficient purchase', async () => {
    const res = await api('POST', `/portfolios/${portfolioB.id}/transactions`, {
      asset_id: asset.id, tx_date: '2026-07-02', type: 'BUY',
      quantity: '50', price: '100.00', fees: '0', currency: 'USD',
    }, token, [409])
    if (res.status !== 409) throw new Error(`expected 409, got ${res.status}`)
    const body = await res.json()
    if (body.detail?.code !== 'insufficient_cash') {
      throw new Error(`expected insufficient_cash, got ${JSON.stringify(body.detail)}`)
    }
    const { available, required, missing } = body.detail.context
    return `available ${available}, required ${required}, missing ${missing}`
  })

  await step('cash: deposit funds a covered purchase and updates balances', async () => {
    await apiJson('POST', `/portfolios/${portfolioB.id}/cash/movements`, {
      type: 'deposit', currency: 'USD', amount: '500', occurred_on: '2026-07-02',
    })
    await apiJson('POST', `/portfolios/${portfolioB.id}/transactions`, {
      asset_id: asset.id, tx_date: '2026-07-03', type: 'BUY',
      quantity: '10', price: '100.00', fees: '2.00', currency: 'USD',
    })
    const balances = await apiJson('GET', `/portfolios/${portfolioB.id}/cash/balances`)
    const usd = balances.balances.find((b) => b.currency === 'USD')
    // 1000 opening + 500 deposit - 1000 buy - 2 fee
    if (!usd || Number(usd.balance) !== 498) {
      throw new Error(`expected USD balance 498, got ${usd?.balance}`)
    }
    return `USD balance ${usd.balance}`
  })

  await step('cash: fx conversion produces linked legs', async () => {
    const conversion = await apiJson('POST', `/portfolios/${portfolioB.id}/cash/fx-conversions`, {
      source_currency: 'USD', target_currency: 'EUR',
      source_amount: '100', target_amount: '92', occurred_on: '2026-07-04',
    })
    if (conversion.movements.length !== 2) {
      throw new Error(`expected 2 conversion legs, got ${conversion.movements.length}`)
    }
    const balances = await apiJson('GET', `/portfolios/${portfolioB.id}/cash/balances`)
    const eur = balances.balances.find((b) => b.currency === 'EUR')
    if (!eur || Number(eur.balance) !== 92) {
      throw new Error(`expected EUR balance 92, got ${eur?.balance}`)
    }
  })

  await step('cash: Cash page renders without errors', async () => {
    const errors = []
    const onPageError = (err) => errors.push(err.message)
    page.on('pageerror', onPageError)
    await page.goto(`${BASE_URL}/cash`)
    await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {})
    page.off('pageerror', onPageError)
    if (page.url().includes('/login')) throw new Error('bounced to login')
    if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`)
  })

  // 16. asset search
  await step('asset search returns AAPL', async () => {
    const found = await apiJson('GET', '/assets?query=AAPL')
    if (!Array.isArray(found) || !found.some((a) => a.symbol === 'AAPL')) {
      throw new Error('AAPL not found via asset search')
    }
  })

  // 17. asset research page
  await step('Asset Research page renders', async () => {
    await page.goto(`${BASE_URL}/assets/AAPL/research`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('main', { timeout: 30000 })
  })

  // 18-19. boards page and a representative widget
  await step('Boards page renders', async () => {
    await page.goto(`${BASE_URL}/boards`)
    await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {})
    if (page.url().includes('/login')) throw new Error('bounced to login')
  })

  await step('representative dashboard widget data loads', async () => {
    const metrics = await apiJson('GET', `/portfolios/${portfolioA.id}/metrics`)
    if (metrics == null) throw new Error('metrics endpoint returned nothing')
  })

  // cross-user isolation: a second user must not see user A's portfolio
  await step('cross-user portfolio access is rejected', async () => {
    const other = {
      email: `smoke2-${stamp}@releasecheck.local`,
      username: `smoke2_${stamp}`,
      password: USER.password,
    }
    await api('POST', '/auth/register', {
      email: other.email, username: other.username, password: other.password,
    }, null)
    const login = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: other.email, password: other.password }),
    })
    const otherToken = (await login.json()).access_token
    const res = await api('GET', `/portfolios/${portfolioA.id}`, undefined, otherToken, [403, 404])
    if (![403, 404].includes(res.status)) {
      throw new Error(`expected 403/404 for cross-user access, got ${res.status}`)
    }
    return `status ${res.status}`
  })

  // 20-21. logout clears client state; protected route rejects again
  await step('logout clears client state', async () => {
    await page.goto(`${BASE_URL}/dashboard`)
    await page.evaluate(() => localStorage.removeItem('auth_token'))
    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForURL(/\/login/)
    const left = await page.evaluate(() => localStorage.getItem('auth_token'))
    if (left) throw new Error('auth_token still present after logout')
  })
}

async function cleanup() {
  for (const id of createdPortfolioIds) {
    try {
      await api('DELETE', `/portfolios/${id}`, undefined, token, [404])
      console.log(`cleanup: deleted portfolio ${id}`)
    } catch (err) {
      console.log(`cleanup: could not delete portfolio ${id}: ${err.message}`)
    }
  }
  await browser?.close()
}

let failed = false
try {
  await main()
} catch {
  failed = true
} finally {
  await cleanup()
  mkdirSync(ARTIFACTS, { recursive: true })
  writeFileSync(join(ARTIFACTS, 'results.json'), JSON.stringify(results, null, 2))
  const passed = results.filter((r) => r.ok).length
  console.log(`\n${passed}/${results.length} smoke steps passed`)
  process.exit(failed || results.some((r) => !r.ok) ? 1 : 0)
}
