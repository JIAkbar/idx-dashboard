import { describe, expect, it } from 'vitest'
import { bacaKuartalIdx, gabungkanBaris, gabungkanBarisKeuangan, gabungkanPeriode, labelAsal } from './fundamentalGabungan'
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
    const asalNonNull = [
      'keuangan', 'fundamental-kuartal', 'fundamental-tahunan', 'fundamental-ttm', 'fundamental-kini',
      'idx', 'idx-kumulatif', 'yahoo',
    ] as const
    for (const asal of asalNonNull) {
      expect(labelAsal(asal).length).toBeGreaterThan(0)
    }
  })
})

// B1: gabung keuangan_idx (XBRL resmi bursa) dengan keuangan (yfinance) —
// lihat komentar bacaKuartalIdx/gabungkanBarisKeuangan di fundamentalGabungan.ts.
describe('bacaKuartalIdx — kumulatif IDX dikonversi jadi diskret', () => {
  const kuartalDenganTw1 = {
    '2026-03-31': { revenue: 100, total_assets: 500 } as unknown as PeriodeKeuangan,
    '2026-06-30': { revenue: 250, total_assets: 520 } as unknown as PeriodeKeuangan,
  }

  it('TW2 dengan TW1 tersedia → dikurangi jadi diskret', () => {
    expect(bacaKuartalIdx(kuartalDenganTw1, 'revenue', '2026-06-30')).toEqual({ nilai: 150, asal: 'idx' })
  })

  it('TW2 TANPA TW1 → TIDAK diam-diam dianggap diskret; disimpan kumulatif bertanda eksplisit', () => {
    const kuartalTanpaTw1 = { '2026-06-30': { revenue: 250 } as unknown as PeriodeKeuangan }
    expect(bacaKuartalIdx(kuartalTanpaTw1, 'revenue', '2026-06-30')).toEqual({ nilai: 250, asal: 'idx-kumulatif' })
  })

  it('ruas neraca (total_assets) TIDAK dikurangi meski TW1 tersedia — itu snapshot, bukan arus', () => {
    expect(bacaKuartalIdx(kuartalDenganTw1, 'total_assets', '2026-06-30')).toEqual({ nilai: 520, asal: 'idx' })
  })

  it('TW1 (Q1) tak butuh pengurang — kumulatif == diskret sejak awal tahun', () => {
    expect(bacaKuartalIdx(kuartalDenganTw1, 'revenue', '2026-03-31')).toEqual({ nilai: 100, asal: 'idx' })
  })

  it('ruas tak tersedia di IDX untuk periode ini → null, bukan 0', () => {
    expect(bacaKuartalIdx(kuartalDenganTw1, 'operating_income', '2026-06-30')).toEqual({ nilai: null, asal: null })
  })
})

describe('gabungkanBarisKeuangan — prioritas IDX > Yahoo > fundamental (tambalan lama)', () => {
  it('tahunan: IDX non-null menang, tak ada konversi', () => {
    const idx = { kuartal: {}, tahunan: { '2025-12-31': { revenue: 900 } as unknown as PeriodeKeuangan } }
    const yf = { revenue: 800 } as unknown as PeriodeKeuangan
    expect(gabungkanBarisKeuangan('revenue', '2025-12-31', 'tahunan', yf, idx, null, false))
      .toEqual({ nilai: 900, asal: 'idx' })
  })

  it('tahunan: IDX null untuk ruas ini → Yahoo menambal', () => {
    const idx = { kuartal: {}, tahunan: { '2025-12-31': { revenue: null } as unknown as PeriodeKeuangan } }
    const yf = { revenue: 800 } as unknown as PeriodeKeuangan
    expect(gabungkanBarisKeuangan('revenue', '2025-12-31', 'tahunan', yf, idx, null, false))
      .toEqual({ nilai: 800, asal: 'yahoo' })
  })

  it('kuartal: BBCA nyata — revenue kosong di IDX tapi ada di Yahoo, saling menambal per-ruas', () => {
    const idx = {
      kuartal: { '2026-06-30': { revenue: null, operating_income: 36451829000000 } as unknown as PeriodeKeuangan },
      tahunan: {},
    }
    const yf = { revenue: 28891999000000, operating_income: null } as unknown as PeriodeKeuangan
    expect(gabungkanBarisKeuangan('revenue', '2026-06-30', 'kuartal', yf, idx, null, true))
      .toEqual({ nilai: 28891999000000, asal: 'yahoo' })
    // Fixture ini tak punya TW1 — sesuai data nyata sekarang (panen baru punya TW2 2026),
    // jadi operating_income tetap kumulatif bertanda, bukan idx polos.
    expect(gabungkanBarisKeuangan('operating_income', '2026-06-30', 'kuartal', yf, idx, null, true))
      .toEqual({ nilai: 36451829000000, asal: 'idx-kumulatif' })
  })

  it('kedua sumber presisi kosong → jatuh ke tambalan fundamental lama (tak diubah perilakunya)', () => {
    const fd = { q_ocf: { '2026': { Q2: -15658754000000 } } } as unknown as StockFundamental
    expect(gabungkanBarisKeuangan('operating_cf', '2026-06-30', 'kuartal', null, null, fd, false))
      .toEqual({ nilai: -15658754000000, asal: 'fundamental-kuartal' })
  })
})
