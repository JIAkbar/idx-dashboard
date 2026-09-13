import { describe, expect, it } from 'vitest'
import type { StockFundamental } from './stockDetailData'
import {
  AMBANG_SEKTOR,
  bandFScore,
  cagr,
  deretKuartal,
  deretTahun,
  derPersen,
  keP,
  konflikSumbu,
  kualitasLaba,
  labelSkor,
  langkahMoneyFlow,
  marjin,
  panelKhas,
  ringkasTransaksi,
  sambunganFlow,
  skorPilar,
  skorTotal,
  sumbuSektor,
  yoyDeret,
  zonaAltman,
} from './bedahEmiten'

function fdDasar(over: Partial<StockFundamental> = {}): StockFundamental {
  return { ticker: 'AAAA', name: 'Emiten Uji', sector: 'Uji', ...over } as StockFundamental
}

describe('satuan — dua ruas sekeluarga bisa beda skala 100×', () => {
  it('roe rasio jadi persen, hist_roe SUDAH persen dan tidak dikali lagi', () => {
    // Angka nyata BBCA 20 Agu 2026: roe 0,21818 tapi hist_roe 2024 = 20,88.
    const q = kualitasLaba(fdDasar({ roe: 0.21818, hist_roe: { '2024': 20.88, '2023': 20.07 } }))
    expect(q.roe).toBeCloseTo(21.818, 3)
    expect(q.roeRerata).toBeCloseTo(20.475, 3)
  })

  it('ROE sumber utama sudah persen; cadangan lama tetap dikali 100 (#36 opsi 1)', () => {
    expect(kualitasLaba(fdDasar({ roe: 0.21818 }), { 'Return on Equity (TTM)': 21.47 }).roe).toBe(21.47)
    expect(kualitasLaba(fdDasar({ roe: 0.21818 }), null).roe).toBeCloseTo(21.818, 3)
  })

  it('der persen dipakai apa adanya; der_q rasio dikali 100', () => {
    expect(derPersen(fdDasar({ der: 59.982, der_q: 0.6835 }))).toEqual({ nilai: 59.982, sumber: 'ttm' })
    expect(derPersen(fdDasar({ der_q: 0.6835 }))).toEqual({ nilai: 68.35, sumber: 'kuartal' })
    expect(derPersen(fdDasar())).toEqual({ nilai: null, sumber: null })
  })

  it('marjin tepat 0 dibaca TAK ADA — bank tak melaporkan laba kotor', () => {
    expect(marjin(0)).toBeNull()
    expect(marjin(0.53118)).toBeCloseTo(53.118, 3)
    expect(keP(null)).toBeNull()
  })
})

describe('deret', () => {
  it('tahun diurut naik walau kunci berkasnya acak', () => {
    // hist_roe BBCA benar-benar datang sebagai 2023, 2022, 2024.
    expect(deretTahun({ '2023': 3, '2022': 2, '2024': 4 }).map((t) => t.tahun)).toEqual(['2022', '2023', '2024'])
  })

  it('kuartal diurut naik lintas tahun', () => {
    const d = deretKuartal({ '2026': { Q2: 2, Q1: 1 }, '2025': { Q4: 0 } })
    expect(d.map((t) => t.kunci)).toEqual(['2025-Q4', '2026-Q1', '2026-Q2'])
  })

  it('cagr menolak titik awal/akhir tak positif — pulih dari rugi bukan pertumbuhan', () => {
    // n = jumlah JARAK antar titik, bukan jumlah titik: lima tahun buku = empat
    // tahun pertumbuhan. Memakai panjang larik langsung memberi CAGR yang
    // terlalu rendah dan tak pernah melempar galat.
    const lima = ['2021', '2022', '2023', '2024', '2025'].map((tahun, i) => ({ tahun, nilai: 100 * Math.pow(2, i / 4) }))
    expect(cagr(lima)).toBeCloseTo(18.921, 3)
    expect(cagr([{ tahun: '2021', nilai: -50 }, { tahun: '2025', nilai: 200 }])).toBeNull()
    expect(cagr([{ tahun: '2021', nilai: 100 }])).toBeNull()
  })

  it('yoy dibagi NILAI MUTLAK pembanding — dari rugi ke laba tetap positif', () => {
    expect(yoyDeret([{ tahun: '2024', nilai: -100 }, { tahun: '2025', nilai: 50 }])).toBeCloseTo(150, 6)
    expect(yoyDeret([{ tahun: '2024', nilai: 0 }, { tahun: '2025', nilai: 50 }])).toBeNull()
  })
})

describe('money flow 5 langkah', () => {
  it('lima langkah, urutannya uang berjalan dari penjualan sampai rekening', () => {
    expect(langkahMoneyFlow(fdDasar()).map((l) => l.id)).toEqual(['revenue', 'laba', 'eps', 'cfo', 'dps'])
  })

  it('nilai kosong tetap null, tak pernah 0', () => {
    for (const l of langkahMoneyFlow(fdDasar())) expect(l.nilai).toBeNull()
  })

  it('dividend_ttm menang atas dividend', () => {
    const l = langkahMoneyFlow(fdDasar({ dividend_ttm: 356, dividend: 100 }))
    expect(l.find((x) => x.id === 'dps')!.nilai).toBe(356)
  })

  it('kas/laba tak dihitung saat laba <= 0 — rasio dari penyebut negatif menyesatkan', () => {
    const rugi = sambunganFlow(fdDasar({ ttm_net_income: -100, ttm_ocf: 50 }))
    expect(rugi.find((s) => s.id === 'kas_laba')!.nilai).toBeNull()
    const laba = sambunganFlow(fdDasar({ ttm_net_income: 100, ttm_ocf: 120 }))
    expect(laba.find((s) => s.id === 'kas_laba')!.nilai).toBeCloseTo(120, 6)
  })

  it('payout di atas 100% diberi kalimat yang menyebut itu tak berkelanjutan', () => {
    const s = sambunganFlow(fdDasar({ eps: 100, dividend_ttm: 130 }))
    expect(s.find((x) => x.id === 'payout')!.baca).toMatch(/melebihi laba/)
  })

  it('EPS langkah dan payout memakai sumber utama bila ada; cadangan ditandai (#36 opsi 1)', () => {
    const rasio = { 'Current EPS (TTM)': 200 }
    const utama = langkahMoneyFlow(fdDasar({ eps: 100 }), rasio).find((x) => x.id === 'eps')!
    expect(utama.nilai).toBe(200)
    expect(utama.cadangan).toBe(false)
    expect(langkahMoneyFlow(fdDasar({ eps: 100 })).find((x) => x.id === 'eps')!.cadangan).toBe(true)
    const s = sambunganFlow(fdDasar({ eps: 100, dividend_ttm: 130 }), rasio)
    expect(s.find((x) => x.id === 'payout')!.nilai).toBeCloseTo(65, 6)
  })
})

describe('valuasi dua sumbu', () => {
  it('ambang sektor simetris ±25%', () => {
    expect(sumbuSektor(-48.8)).toBe('murah')
    expect(sumbuSektor(-5.1)).toBe('wajar')
    expect(sumbuSektor(146.6)).toBe('mahal')
    expect(sumbuSektor(-AMBANG_SEKTOR)).toBe('wajar')
    expect(sumbuSektor(null)).toBeNull()
  })

  it('konflik hanya saat benar-benar berlawanan arah', () => {
    expect(konflikSumbu('murah', 'mahal')).toBe(true)
    expect(konflikSumbu('mahal', 'murah')).toBe(true)
    expect(konflikSumbu('murah', 'wajar')).toBe(false)
    expect(konflikSumbu(null, 'mahal')).toBe(false)
  })
})

describe('skor pilar — rule engine', () => {
  it('emiten tanpa data: semua pilar null, total null, bukan 0', () => {
    const p = skorPilar(fdDasar(), null, null)
    expect(p).toHaveLength(5)
    for (const x of p) {
      expect(x.skor).toBeNull()
      expect(x.kurang).not.toBeNull()
    }
    expect(skorTotal(p)).toEqual({ skor: null, n: 0 })
  })

  it('pilar kosong tidak dihitung 0 di total — hanya yang punya skor dirata-rata', () => {
    const p = skorPilar(fdDasar({ roe: 0.25, npm: 0.3, roa: 0.12, opm: 0.25 }), null, null)
    const profit = p.find((x) => x.id === 'profit')!
    expect(profit.skor).toBe(100)
    expect(skorTotal(p)).toEqual({ skor: 100, n: 1 })
  })

  it('DER besar menurunkan pilar kualitas, DER kecil menaikkannya', () => {
    const ringan = skorPilar(fdDasar({ der: 20 }), null, null).find((x) => x.id === 'quality')!
    const berat = skorPilar(fdDasar({ der: 350 }), null, null).find((x) => x.id === 'quality')!
    expect(ringan.skor!).toBeGreaterThan(berat.skor!)
  })

  it('alasan tiap pilar menyebut angkanya — skor tanpa dasar tak bisa dibantah', () => {
    const p = skorPilar(fdDasar({ rev_yoy: 6.39, ni_yoy: 21.57 }), null, null).find((x) => x.id === 'growth')!
    expect(p.alasan.join(' ')).toMatch(/6\.4|6,4/)
    expect(p.alasan.length).toBeGreaterThan(0)
  })

  it('konflik dua sumbu ikut tertulis di alasan pilar valuasi', () => {
    const p = skorPilar(fdDasar(), 'murah', 'mahal').find((x) => x.id === 'valuation')!
    expect(p.alasan.join(' ')).toMatch(/BERLAWANAN/)
  })

  it('labelSkor tak pernah memberi vonis pada skor kosong', () => {
    expect(labelSkor(null)).toBe('Belum tersedia')
    expect(labelSkor(85)).toBe('Kuat')
    expect(labelSkor(20)).toBe('Rapuh')
  })
})

describe('panel khas PAPAN', () => {
  it('ambang Altman model modifikasi 1,1 / 2,6 — model yang dipakai kedua sumber (#185)', () => {
    expect(zonaAltman(2.61)).toBe('aman')
    expect(zonaAltman(2.6)).toBe('abu')
    expect(zonaAltman(1.1)).toBe('abu')
    expect(zonaAltman(1.09)).toBe('tertekan')
    expect(zonaAltman(null)).toBeNull()
  })

  it('Altman: sumber utama menang, cadangan bertanda c, kosong berbunyi kosong (#185)', () => {
    const cari = (b: ReturnType<typeof panelKhas>) => b.find((x) => x.label === 'Altman Z-Score')!
    // Keystats ada: angkanya yang dinilai, ruas lama diabaikan.
    const utama = cari(panelKhas(fdDasar({ altman_z: 3.5 }), { 'Altman Z-Score (Modified)': 1.5 }))
    expect(utama.nilai).toBe('1.50')
    expect(utama.cadangan).toBe(false)
    expect(utama.baca).toMatch(/^Zona abu-abu — model modifikasi/)
    // Keystats kosong, ruas lama ada: tampil bertanda, dinilai dengan ambang yang SAMA.
    // 2,8 berada di atas 2,6 (aman) tapi di bawah 2,99 klasik — kasus yang dulu mendapat dua vonis.
    const cadangan = cari(panelKhas(fdDasar({ altman_z: 2.8 }), {}))
    expect(cadangan.nilai).toBe('2.80')
    expect(cadangan.cadangan).toBe(true)
    expect(cadangan.baca).toMatch(/^Zona aman/)
    // Dua-duanya kosong.
    const kosong = cari(panelKhas(fdDasar(), null))
    expect(kosong.nilai).toBe('Belum bisa dihitung')
    expect(kosong.cadangan).toBe(false)
  })

  it('F-Score dinilai dari PROPORSI, bukan angka mentah — 4/6 bukan 4/9', () => {
    expect(bandFScore(4, 6)).toBe('sedang')
    expect(bandFScore(4, 9)).toBe('lemah')
    expect(bandFScore(7, 9)).toBe('kuat')
    expect(bandFScore(null, 9)).toBeNull()
  })

  it('ruas kosong berbunyi "belum bisa dihitung", tak pernah diisi taksiran', () => {
    const b = panelKhas(fdDasar())
    expect(b.find((x) => x.label === 'Altman Z-Score')!.nilai).toBe('Belum bisa dihitung')
    expect(b.find((x) => x.label === 'Piotroski F-Score')!.nilai).toBe('Belum bisa dihitung')
    expect(b.find((x) => x.label === 'ROIC')!.nilai).toBe('Belum tersedia')
  })

  it('F-Score dengan n < 9 menyebut cakupannya di kalimat', () => {
    const b = panelKhas(fdDasar({ f_score: 4, f_score_n: 6 }))
    expect(b.find((x) => x.label === 'Piotroski F-Score')!.baca).toMatch(/6 dari 9/)
  })
})

describe('aktivitas transaksi', () => {
  const baris = Array.from({ length: 25 }, (_, i) => ({
    tanggal: `2026-08-${String(i + 1).padStart(2, '0')}`,
    volume: 1_000_000,
    value: 5_000_000_000,
    frekuensi: 3_000,
  }))

  it('rerata 20 hari + banding volume hari terakhir', () => {
    const r = ringkasTransaksi([...baris, { tanggal: '2026-08-26', volume: 3_000_000, value: 9e9, frekuensi: 9000 }], 1e9)!
    expect(r.tanggal).toBe('2026-08-26')
    expect(r.volume20).toBeCloseTo(1_100_000, 0)
    expect(r.banding20!).toBeCloseTo(3_000_000 / 1_100_000, 6)
    expect(r.turnover).toBeCloseTo(0.3, 6)
  })

  it('riwayat terlalu pendek: rerata & banding null, bukan angka dari 2 hari', () => {
    const r = ringkasTransaksi(baris.slice(0, 3), 1e9)!
    expect(r.volume20).toBeNull()
    expect(r.banding20).toBeNull()
  })

  it('tanpa jumlah saham, turnover null — bukan 0%', () => {
    expect(ringkasTransaksi(baris, null)!.turnover).toBeNull()
    expect(ringkasTransaksi([], 1e9)).toBeNull()
  })
})
