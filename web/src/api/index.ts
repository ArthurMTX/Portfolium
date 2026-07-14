import * as admin from './admin'
import * as assetResearch from './assetResearch'
import * as assets from './assets'
import * as auth from './auth'
import * as calendar from './calendar'
import * as cash from './cash'
import * as dashboard from './dashboard'
import * as dividends from './dividends'
import * as insights from './insights'
import * as market from './market'
import * as notifications from './notifications'
import * as portfolios from './portfolios'
import * as system from './system'
import * as transactions from './transactions'
import * as watchlist from './watchlist'

export * from './types'
export * from './admin'
export * from './auth'
export * from './assets'
export * from './assetResearch'
export * from './portfolios'
export * from './transactions'
export * from './market'
export * from './system'
export * from './watchlist'
export * from './notifications'
export * from './insights'
export * from './dashboard'
export * from './dividends'
export * from './calendar'
export * from './cash'

export const api = {
  ...admin,
  ...system,
  ...auth,
  ...assets,
  ...assetResearch,
  ...portfolios,
  ...transactions,
  ...market,
  ...watchlist,
  ...notifications,
  ...insights,
  ...dashboard,
  ...dividends,
  ...calendar,
  ...cash,
}

export default api
