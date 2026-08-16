import { describe, expect, it } from 'vitest'
import { gabungkanBaris, gabungkanPeriode, labelAsal } from './fundamentalGabungan'
import type { PeriodeKeuangan, StockFundamental } from './stockDetailData'

const fd = {
  ticker: 'BBCA', name: 'BCA', sector: 'Finansial',
  q_revenue: { '2026': { Q2: 28891999000000, Q1: 28660037000000 } },
  q_ocf: { '2026': { Q2: -15658754000000, Q1: 47920728000000 } },
  hist_revenue: { 2025: 114319648000000, 2024: 108796625000000 },
  hist_gross_profit: {},
  ttm_ocf: 49578646000000,
  ttm_revenue: 113460300000000,
  eps: 468.39,
  lq_assets: 1586828536000000,
  lq_tot_liab: 1305362058000000,
} as unknown as StockFundamental

describe('gabungkanBaris — aturan menang keuangan, tambal fundamental', () => {
  it.each([
    // [judul, nilaiKeuangan, field, iso, mode, terbaru, nilaiHarapan, asalHarapan]
    ['keuangan menang walau fundamental juga punya', 28000000000000, 'revenue', '2026-06-30', 'kuartal', true, 28000000000000, 'keuangan'],
    ['kuartal null → ditambal q_ocf periode sama persis', null, 'operating_cf', '2026-06-30', 'kuartal', false, -15658754000000, 'fundamental-kuartal'],
    ['kuartal null, bukan periode terbaru, tanpa padanan q_ → tetap null', null, 'operating_cf', '2025-03-31', 'kuartal', false, null, null],
    ['tahunan null → ditambal hist_revenue tahun sama', null, 'revenue', '2025-12-31', 'tahunan', false, 114319648000000, 'fundamental-tahunan'],
    ['field tanpa padanan (cogs) tetap null meski terbaru', null, 'cogs', '2026-06-30', 'kuartal', true, null, null],
  ] as const)('%s', (_judul, nilaiKeuangan, field, iso, mode, terbaru, nilaiHarapan, asalHarapan) => {
    const hasil = gabungkanBaris(field, nilaiKeuangan, iso, mode, fd, terbaru)
    expect(hasil.nilai).toBe(nilaiHarapan)
    expect(hasil.asal).toBe(asalHarapan)
  })

  it('periode TERBARU tanpa padanan periode-sama → jatuh ke TTM, ditandai jelas', () => {
    // 2026-06-30 (Q2) tidak null di q_ocf sample ini, jadi paksa null lewat field tanpa q_-map: pakai investing_cf
    const hasil = gabungkanBaris('investing_cf', null, '2026-06-30', 'kuartal', { ...fd, ttm_icf: -1000 } as StockFundamental, true)
    expect(hasil).toEqual({ nilai: -1000, asal: 'fundamental-ttm' })
  })

  it('periode BUKAN terbaru tidak boleh jatuh ke TTM — dibiarkan null, bukan disamarkan', () => {
    const hasil = gabungkanBaris('investing_cf', null, '2025-03-31', 'kuartal', { ...fd, ttm_icf: -1000 } as StockFundamental, false)
    expect(hasil).toEqual({ nilai: null, asal: null })
  })

  it('baris neraca di periode terbaru jatuh ke snapshot "kini", bukan TTM', () => {
    const hasil = gabungkanBaris('total_liabilities', null, '2026-06-30', 'kuartal', fd, true)
    expect(hasil).toEqual({ nilai: 1305362058000000, asal: 'fundamental-kini' })
  })

  it('tanpa berkas fundamental sama sekali → null, tidak melempar', () => {
    expect(gabungkanBaris('operating_cf', null, '2026-06-30', 'kuartal', null, true)).toEqual({ nilai: null, asal: null })
    expect(gabungkanBaris('operating_cf', null, '2026-06-30', 'kuartal', undefined, true)).toEqual({ nilai: null, asal: null })
  })

  it('eps kuartal null ditambal q_eps periode sama, bukan angka trailing fundamental', () => {
    const fdEps = { ...fd, q_eps: { '2026': { Q2: 120.89 } } } as StockFundamental
    const hasil = gabungkanBaris('eps', null, '2026-06-30', 'kuartal', fdEps, false)
    expect(hasil).toEqual({ nilai: 120.89, asal: 'fundamental-kuartal' })
  })
})

describe('gabungkanPeriode — seluruh baris sekaligus', () => {
  it('null keuangan + fundamental kosong → seluruh field null/asal null', () => {
    const kosong: PeriodeKeuangan = {
      revenue: null, cogs: null, gross_profit: null, operating_income: null, net_income: null, eps: null,
      total_assets: null, total_liabilities: null, equity: null, cash: null, total_debt: null,
      operating_cf: null, investing_cf: null, financing_cf: null, free_cf: null,
    }
    const hasil = gabungkanPeriode(kosong, '2025-03-31', 'kuartal', null, false)
    for (const field of Object.keys(kosong) as (keyof PeriodeKeuangan)[]) {
      expect(hasil[field]).toEqual({ nilai: null, asal: null })
    }
  })

  it('field tanpa padanan (asal null) tidak diberi label', () => {
    // labelAsal cuma dipanggil untuk asal non-null di UI — pastikan tiap AsalAngka non-null punya label tak kosong
    const asalNonNull = ['keuangan', 'fundamental-kuartal', 'fundamental-tahunan', 'fundamental-ttm', 'fundamental-kini'] as const
    for (const asal of asalNonNull) {
      expect(labelAsal(asal).length).toBeGreaterThan(0)
    }
  })
})
