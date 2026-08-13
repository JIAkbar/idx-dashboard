import { useEffect, useState } from 'react'

/**
 * Tipe & fetch data fundamental untuk Stock Detail. Port dari
 * index_live.html fdInit()/fdLoad() baris 3767-3867. Field diambil dari
 * bentuk asli data-idx/json/fundamental/{TICKER}.json (contoh: AALI.json, BBCA.json)
 * — bukan tebakan. Semua nilai boleh null/undefined di file mana pun,
 * jadi dibiarkan opsional.
 */

export interface StockIndexEntry {
  ticker: string
  name: string
  sector: string
}

export interface StockIndexData {
  updated: string
  total: number
  stocks: StockIndexEntry[]
}

export interface DivHistoryEntry {
  year: string
  ex_date: string
  amount: number
}

/** Map tahun → nilai (hist_*, a_*). */
export type YearMap = Record<string, number>
/** Map tahun → { Q1..Q4: nilai } (q_*). */
export type QuarterMap = Record<string, Record<string, number>>

/** `pp[k+"_pct"|"_low"|"_high"]` untuk k = 1d/1w/1m/3m/6m/ytd/1y/3y/5y, lihat fdPerfRow. */
export interface PricePerf {
  current?: number
  '1d_pct'?: number; '1d_low'?: number; '1d_high'?: number
  '1w_pct'?: number; '1w_low'?: number; '1w_high'?: number
  '1m_pct'?: number; '1m_low'?: number; '1m_high'?: number
  '3m_pct'?: number; '3m_low'?: number; '3m_high'?: number
  '6m_pct'?: number; '6m_low'?: number; '6m_high'?: number
  ytd_pct?: number; ytd_low?: number; ytd_high?: number
  '1y_pct'?: number; '1y_low'?: number; '1y_high'?: number
  '3y_pct'?: number; '3y_low'?: number; '3y_high'?: number
  '5y_pct'?: number; '5y_low'?: number; '5y_high'?: number
}

export interface StockFundamental {
  ticker: string
  name: string
  sector: string
  industry?: string
  website?: string
  summary?: string
  currency?: string
  updated?: string

  last_price?: number | null
  prev_close?: number | null
  week52_high?: number | null
  week52_low?: number | null
  week52_change_pct?: number | null
  beta?: number | null
  avg_volume?: number | null
  shares?: number | null
  float_shares?: number | null
  float_pct?: number | null

  pe?: number | null
  pe_annualised?: number | null
  forward_pe?: number | null
  earn_yield?: number | null
  pb?: number | null
  ps?: number | null
  price_cf?: number | null
  price_fcf?: number | null
  ev_ebit?: number | null
  ev_ebitda?: number | null
  ev_revenue?: number | null
  peg?: number | null

  eps?: number | null
  eps_fwd?: number | null
  bv?: number | null
  rev_ps?: number | null
  cash_ps?: number | null
  fcf_ps?: number | null

  current_ratio?: number | null
  quick_ratio?: number | null
  der?: number | null
  der_q?: number | null
  lt_der_q?: number | null
  tl_eq_q?: number | null
  td_ta_q?: number | null
  lev_q?: number | null

  gpm?: number | null
  opm?: number | null
  npm?: number | null
  ebitda_margin?: number | null
  roe?: number | null
  roa?: number | null

  rev_yoy?: number | null
  ni_yoy?: number | null
  gp_yoy?: number | null

  dividend?: number | null
  dividend_ttm?: number | null
  dividend_yield?: number | null
  payout_ratio?: number | null
  ex_dividend_date?: string | null
  div_history?: DivHistoryEntry[]

  ttm_revenue?: number | null
  ttm_gross?: number | null
  ttm_ebitda?: number | null
  ttm_net_income?: number | null
  ttm_op_income?: number | null
  ttm_ocf?: number | null
  ttm_icf?: number | null
  ttm_fincf?: number | null
  ttm_capex?: number | null
  ttm_fcf?: number | null

  lq_cash?: number | null
  lq_assets?: number | null
  lq_tot_liab?: number | null
  lq_wc?: number | null
  lq_equity?: number | null
  lq_lt_debt?: number | null
  lq_st_debt?: number | null
  lq_total_debt?: number | null
  lq_net_debt?: number | null

  market_cap?: number | null
  enterprise_value?: number | null

  q_revenue?: QuarterMap
  q_net_income?: QuarterMap
  q_eps?: QuarterMap
  q_gross?: QuarterMap
  q_op_income?: QuarterMap
  q_assets?: QuarterMap
  q_equity?: QuarterMap
  q_debt?: QuarterMap
  q_cash?: QuarterMap
  q_ocf?: QuarterMap
  q_fcf?: QuarterMap

  a_revenue?: YearMap
  a_net_income?: YearMap
  hist_revenue?: YearMap
  hist_gross_profit?: YearMap
  hist_operating_income?: YearMap
  hist_net_income?: YearMap
  hist_total_assets?: YearMap
  hist_total_equity?: YearMap
  hist_total_debt?: YearMap
  hist_eps?: YearMap
  hist_fcf?: YearMap
  hist_bv?: YearMap
  hist_roe?: YearMap
  hist_dps?: YearMap

  price_perf?: PricePerf

  eps_cagr_3y?: number | null
  eps_cagr_2y?: number | null
  ddm_g_rate?: number | null
  div_years?: number | null

  // #93 keystats — field baru ekspansi ±147 field. Nested income_ttm/
  // balance_q/cashflow_ttm/quarterly TIDAK dipetakan: nilainya identik
  // dengan field flat ttm_* / lq_* / q_* yang sudah dipakai panel.
  financial_currency?: string | null
  roic?: number | null
  roce?: number | null
  interest_coverage?: number | null
  receivables_turnover?: number | null
  inventory_turnover?: number | null
  asset_turnover?: number | null
  days_sales_outstanding?: number | null
  days_inventory?: number | null
  days_payables?: number | null
  cash_conversion_cycle?: number | null
  altman_z?: number | null
  f_score?: number | null
  f_score_n?: number | null
  shares_outstanding?: number | null
  free_float_pct?: number | null

  sector_pe_median?: number | null
  sector_pb_median?: number | null
  sector_npm_median?: number | null
  sector_roe_median?: number | null
  sector_ev_ebitda_median?: number | null
  sector_stock_count?: number | null
  pe_vs_sector_pct?: number | null
  pb_vs_sector_pct?: number | null
  ps_vs_sector_pct?: number | null

  [key: string]: unknown
}

let indexCache: StockIndexData | null = null
let indexPromise: Promise<StockIndexData> | null = null

function loadIndex(): Promise<StockIndexData> {
  if (indexCache) return Promise.resolve(indexCache)
  if (!indexPromise) {
    indexPromise = fetch('/data-idx/json/fundamental/index.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<StockIndexData>
      })
      .then((data) => {
        indexCache = data
        return data
      })
      .catch((e: unknown) => {
        indexPromise = null
        throw e
      })
  }
  return indexPromise
}

/** Daftar 955 saham dipakai autocomplete — di-load sekali, dipakai ulang antar kunjungan panel. */
export function useStockIndex() {
  const [index, setIndex] = useState<StockIndexData | null>(indexCache)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (indexCache) return
    loadIndex()
      .then(setIndex)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Gagal memuat daftar saham'))
  }, [])

  return { index, error }
}

const fundamentalCache = new Map<string, StockFundamental>()

/** Data fundamental satu saham, fetch on-demand tiap kode dipilih/dicari. */
export function useStockFundamental(ticker: string | null) {
  const [data, setData] = useState<StockFundamental | null>(ticker ? (fundamentalCache.get(ticker) ?? null) : null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ticker) {
      setData(null)
      setError(null)
      return
    }
    const cached = fundamentalCache.get(ticker)
    if (cached) {
      setData(cached)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/data-idx/json/fundamental/${ticker}.json`)
      .then((r) => {
        if (!r.ok) throw new Error('not found')
        return r.json() as Promise<StockFundamental>
      })
      .then((fd) => {
        if (cancelled) return
        fundamentalCache.set(ticker, fd)
        setData(fd)
      })
      .catch(() => {
        if (cancelled) return
        setData(null)
        setError(`Data ${ticker} tidak ditemukan.`)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ticker])

  return { data, loading, error }
}
