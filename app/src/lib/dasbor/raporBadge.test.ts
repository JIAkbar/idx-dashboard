import { describe, expect, it } from 'vitest'
import {
  bolehLihatRapor,
  capSampelKecil,
  dariBarOhlcvStockbit,
  hitungForm,
  perluPeringatanBasi,
  warnaBadge,
} from './raporBadge'

describe('hitungForm', () => {
  // h0 cuma pembanding awal utk close-close (tak masuk seri close-open).
  // Dirancang supaya kedua mode BEDA: hari-3 gap-down (open turun dari close
  // h2) memberi turun di close-open tapi naik di close-close, dan sebaliknya
  // di hari-5 — hasil akhirnya label berbeda (2-3 vs 3-2).
  const h0 = { open: 100, close: 100 }
  const bars = [
    { open: 100, close: 90 }, // h1: close<open turun; vs close h0(100) turun
    { open: 85, close: 95 }, // h2: close>open naik; vs close h1(90) naik
    { open: 100, close: 98 }, // h3: close<open turun; vs close h2(95) naik
    { open: 90, close: 105 }, // h4: close>open naik; vs close h3(98) naik
    { open: 100, close: 97 }, // h5: close<open turun; vs close h4(105) turun
  ]

  it('close-open: bawaan, close vs open hari itu', () => {
    const r = hitungForm(bars, 5, 'close-open')
    expect(r.seri).toEqual(['turun', 'naik', 'turun', 'naik', 'turun'])
    expect(r.menang).toBe(2)
    expect(r.kalah).toBe(3)
    expect(r.label).toBe('2-3')
  })

  it('close-close: beda hasil dari close-open pada deret yang sama (regresi wajib spek)', () => {
    const bars6 = [h0, ...bars] // bar ke-6 dibutuhkan sebagai pembanding h1
    const r = hitungForm(bars6, 5, 'close-close')
    expect(r.seri).toEqual(['turun', 'naik', 'naik', 'naik', 'turun'])
    expect(r.label).toBe('3-2')
    expect(r).not.toEqual(hitungForm(bars, 5, 'close-open'))
  })

  it('jendela 5 atas 4 bar (data kurang) tidak melempar', () => {
    const empat = bars.slice(0, 4)
    expect(() => hitungForm(empat, 5, 'close-open')).not.toThrow()
    expect(() => hitungForm(empat, 5, 'close-close')).not.toThrow()
    const r = hitungForm(empat, 5, 'close-open')
    expect(r.seri.length).toBe(4)
  })

  it('label format menang-kalah', () => {
    expect(hitungForm(bars, 5, 'close-open').label).toBe('2-3')
  })
})

describe('dariBarOhlcvStockbit', () => {
  it('mengambil open idx2, close idx5 dari larik posisi', () => {
    const bar = [['2026-08-25', 1234, 100, 110, 99, 105, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]
    expect(dariBarOhlcvStockbit(bar)).toEqual([{ open: 100, close: 105 }])
  })
})

describe('warnaBadge', () => {
  it('hijau >=0.55', () => {
    expect(warnaBadge(0.55)).toBe('hijau')
    expect(warnaBadge(0.7)).toBe('hijau')
  })
  it('abu 0.45-0.55 (tepat di ambang)', () => {
    expect(warnaBadge(0.45)).toBe('abu')
    expect(warnaBadge(0.5)).toBe('abu')
    expect(warnaBadge(0.5499999)).toBe('abu')
  })
  it('merah <0.45', () => {
    expect(warnaBadge(0.4499999)).toBe('merah')
    expect(warnaBadge(0.1)).toBe('merah')
  })
})

describe('capSampelKecil', () => {
  it('99 -> true, 100 -> false', () => {
    expect(capSampelKecil(99)).toBe(true)
    expect(capSampelKecil(100)).toBe(false)
  })
})

describe('perluPeringatanBasi', () => {
  it('selisih tepat 0.10 -> belum (bukan lebih dari)', () => {
    expect(perluPeringatanBasi(0.55, 0.45)).toBe(false)
  })
  it('selisih lebih dari 0.10 -> true', () => {
    expect(perluPeringatanBasi(0.55, 0.44)).toBe(true)
  })
  it('salah satu null -> false', () => {
    expect(perluPeringatanBasi(0.55, null)).toBe(false)
    expect(perluPeringatanBasi(undefined, 0.4)).toBe(false)
  })
})

describe('bolehLihatRapor', () => {
  // Keputusan Johan 28 Agu 2026 ("dibuka saja gpp"): bawaan TERBUKA untuk
  // semua — termasuk tanpa login. Mode Diamond-only tinggal sebagai opsi
  // eksplisit untuk rollback.
  it('bawaan terbuka: semua tier & tanpa login lolos', () => {
    expect(bolehLihatRapor(0)).toBe(true)
    expect(bolehLihatRapor(4)).toBe(true)
    expect(bolehLihatRapor(null)).toBe(true)
    expect(bolehLihatRapor(undefined)).toBe(true)
  })
  it('opsi raporDiamondOnly=true masih menggerbang di tier 5', () => {
    expect(bolehLihatRapor(4, { raporDiamondOnly: true })).toBe(false)
    expect(bolehLihatRapor(null, { raporDiamondOnly: true })).toBe(false)
    expect(bolehLihatRapor(5, { raporDiamondOnly: true })).toBe(true)
  })
})

describe('hitungForm — bar tanpa harga pembukaan', () => {
  it('tidak menghitung bar berpembukaan nol sebagai kemenangan', () => {
    // Arsip bursa tak selalu melaporkan pembukaan; tanpa penjagaan,
    // `close - 0` selalu positif dan bar itu terbaca "naik" tanpa dasar.
    const h = hitungForm([
      { open: 100, close: 110 },
      { open: 0, close: 105 },
      { open: 100, close: 90 },
    ])
    expect(h.seri).toEqual(['naik', 'datar', 'turun'])
    expect(h.label).toBe('1-1')
  })
})
