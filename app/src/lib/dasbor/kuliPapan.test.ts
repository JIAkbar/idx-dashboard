import { describe, it, expect } from 'vitest'
import { hitungTarget, hitungPbv, avgBeli } from './kuliPapan'

/**
 * Angka acuan diambil dari contoh DEWA di `data ide/Kuli Papan.pdf` — bukan
 * dari hasil kode ini sendiri. Uji yang menyalin keluarannya sendiri tak
 * membuktikan apa pun; yang ini gagal kalau rumusnya bergeser.
 */
describe('Target Realistis — contoh DEWA', () => {
  const dewa = {
    buyAvg: 527,
    buyLot: 931170,
    bid: 525,
    offer: 725,
    totalBidLot: 2727000,
    totalOfferLot: 2727000,
    tick: 5,
    baselinePersen: 5,
  }

  it('menghasilkan angka yang beredar di luar produk', () => {
    const h = hitungTarget(dewa)!
    expect(h.papan).toBe(41)
    expect(h.rataPerPapan).toBeCloseTo(133024.39, 1)
    expect(h.dorongHigh).toBeCloseTo(7, 1)
    expect(h.dorongLow).toBeCloseTo(3.5, 1)
    expect(h.baselinePoin).toBeCloseTo(26.35, 2)
    expect(h.targetLow).toBeCloseTo(570.85, 1)
    expect(h.targetHigh).toBeCloseTo(588.35, 1)
  })

  it('menolak masukan yang belum lengkap alih-alih membagi nol', () => {
    expect(hitungTarget({ ...dewa, buyAvg: 0 })).toBeNull()
    expect(hitungTarget({ ...dewa, tick: 0 })).toBeNull()
  })

  it('bertahan saat antrean kosong — dorong 0, bukan Infinity', () => {
    const h = hitungTarget({ ...dewa, totalBidLot: 0, totalOfferLot: 0 })!
    expect(h.dorongHigh).toBe(0)
    expect(Number.isFinite(h.targetHigh)).toBe(true)
    // Tanpa antrean, target jatuh ke avg + baseline saja.
    expect(h.targetHigh).toBeCloseTo(527 + 26.35, 2)
  })
})

describe('PBV Band', () => {
  it('menghitung harga wajar, upside, dan status', () => {
    const h = hitungPbv(100, 80, 1.5)!
    expect(h.hargaWajar).toBe(120)
    expect(h.upsidePersen).toBeCloseTo(20, 6)
    expect(h.status).toBe('UNDERVALUED')
    expect(h.mos).toHaveLength(8)
    expect(h.mos[0]).toEqual({ persen: 10, harga: 108 })
  })

  it('memakai ambang ±10% untuk memisahkan tiga status', () => {
    expect(hitungPbv(100, 100, 1.05)!.status).toBe('FAIR')
    expect(hitungPbv(100, 100, 1.11)!.status).toBe('UNDERVALUED')
    expect(hitungPbv(100, 100, 0.89)!.status).toBe('OVERVALUED')
  })

  it('null kalau salah satu masukan kosong', () => {
    expect(hitungPbv(0, 80, 1.5)).toBeNull()
    expect(hitungPbv(100, 0, 1.5)).toBeNull()
  })
})

describe('avgBeli', () => {
  it('membagi nilai dengan lot x 100, bukan lot saja', () => {
    // BUMI TP 21 Agu 2026: 1.578.037 lot senilai Rp 31.584.692.700.
    expect(avgBeli(1578037, 31584692700)).toBeCloseTo(200.15, 2)
  })

  it('nol lot memberi nol, bukan NaN', () => {
    expect(avgBeli(0, 12345)).toBe(0)
  })
})

describe('Mode agresif — varian "Adimology asli"', () => {
  const dasar = {
    buyAvg: 200,
    buyLot: 1380272,
    bid: 195,
    offer: 196,
    totalBidLot: 950732,
    totalOfferLot: 662057,
    tick: 1,
    baselinePersen: 5,
  }

  it('membuang suku baseline sepenuhnya', () => {
    const biasa = hitungTarget(dasar)!
    const agresif = hitungTarget({ ...dasar, agresif: true, barisManual: 2 })!
    expect(biasa.baselinePoin).toBeCloseTo(10, 6)
    expect(agresif.baselinePoin).toBe(0)
    // Selisih keduanya persis sebesar baseline — bukan sekadar "lebih kecil".
    expect(biasa.targetHigh - agresif.targetHigh).toBeCloseTo(10, 6)
  })

  it('memakai jumlah baris yang diisi pengguna, bukan rentang bid-offer', () => {
    const dariRentang = hitungTarget(dasar)!
    expect(dariRentang.papan).toBe(2)
    const manual = hitungTarget({ ...dasar, agresif: true, barisManual: 70 })!
    expect(manual.papan).toBe(70)
    // Baris lebih banyak -> rata per baris lebih kecil -> dorongan lebih besar.
    expect(manual.dorongHigh).toBeGreaterThan(dariRentang.dorongHigh)
  })

  it('baris nol tidak memberi Infinity', () => {
    const h = hitungTarget({ ...dasar, agresif: true, barisManual: 0 })!
    expect(h.dorongHigh).toBe(0)
    expect(h.targetHigh).toBeCloseTo(200, 6)
  })

  it('mode biasa tak berubah saat properti agresif tidak diisi', () => {
    const a = hitungTarget(dasar)!
    const b = hitungTarget({ ...dasar, agresif: false })!
    expect(a).toEqual(b)
  })
})
