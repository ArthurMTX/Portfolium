export type AssetResearchViewTab =
  | 'overview'
  | 'financials'
  | 'valuation'
  | 'risk'
  | 'position'

export interface AssetResearchViewTransaction {
  id: number
  asset_id: number
  tx_date: string
  type: string
  quantity: number | string
  price: number | string
  fees: number | string
  currency: string
  notes: string | null
  metadata?: {
    split?: string
    [key: string]: unknown
  }
}
