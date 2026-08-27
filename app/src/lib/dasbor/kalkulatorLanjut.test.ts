import { describe, it, expect } from 'vitest'
import { hitungPiramida, hitungBlender, hitungBunga } from './kalkulatorLanjut'

describe('hitungPiramida', () => {
  it('jumlah lot lapis = total lot dasar, termasuk saat porsi tak bulat', () => {
    // risiko 1.000.000, beda harga 50 → lotDasar = floor(1000000/50/100) = 200 (pas)
    const a = hitungPiramida(100_000_000, 1, 1000, 950, 2)
    expect(a?.lotDasar).toBe(200)
    expect(a?.lapis.reduce((s, l) => s + l.lot, 0)).toBe(200)
    expect(a?.lapis.map((l) => l.lot)).toEqual([100, 50, 30, 20])

    // lotDasar=7 (ganjil) → 0.5*7=3.5, 0.25*7=1.75, 0.15*7=1.05, 0.1*7=0.7
    // floor: [3,1,1,0]=5, sisa 2 ke sisa pecahan terbesar (idx1 .75, idx3 .7) → [3,2,1,1]
    const b = hitungPiramida(100_000_000, 0.035, 1000, 950, 2)
    expect(b?.lotDasar).toBe(7)
    expect(b?.lapis.map((l) => l.lot)).toEqual([3, 2, 1, 1])
    expect(b?.lapis.reduce((s, l) => s + l.lot, 0)).toBe(7)
  })

  it('harga lapis naik berjenjang & dibulatkan ke tick, avg kumulatif konsisten', () => {
    const h = hitungPiramida(100_000_000, 1, 1000, 950, 2)!
    // fraksi di 500-2000 = 5. lapis0=1000, lapis1=1000*1.02=1020, lapis2=1000*1.04=1040, lapis3=1000*1.06=1060
    expect(h.lapis.map((l) => l.harga)).toEqual([1000, 1020, 1040, 1060])
    // avg kumulatif tahap 1 = harga lapis pertama
    expect(h.lapis[0].avgKumulatif).toBe(1000)
    // tahap 2: (100*1000 + 50*1020) / 150
    expect(h.lapis[1].avgKumulatif).toBeCloseTo((100 * 1000 + 50 * 1020) / 150, 6)
  })

  it('masuk <= SL atau input nol → null', () => {
    expect(hitungPiramida(1_000_000, 1, 900, 950, 2)).toBeNull()
    expect(hitungPiramida(0, 1, 1000, 950, 2)).toBeNull()
  })
})

describe('hitungBlender', () => {
  it('WAP & break-even 2 posisi dihitung tangan', () => {
    // posisi: 1000×10 lot, 1200×5 lot; fee beli 0.15%, jual 0.25%
    const h = hitungBlender([{ harga: 1000, lot: 10 }, { harga: 1200, lot: 5 }], 0.15, 0.25)!
    expect(h.totalLembar).toBe(1500)
    expect(h.totalModal).toBe(1_600_000) // 1000*10*100 + 1200*5*100
    expect(h.wap).toBeCloseTo(1_600_000 / 1500, 6) // 1066,67

    // modalDenganFee = 1.600.000 * 1,0015 = 1.602.400
    // breakEvenRaw = 1.602.400 / (1500 * 0,9975) = 1.602.400 / 1496,25 = 1071,0577...
    // fraksi di rentang 500-2000 = 5 → ceil(1071,0577/5)=215 → 1075
    expect(h.breakEven).toBe(1075)
  })

  it('preset cut-loss -2/-5/-8% dari WAP, dibulatkan ke tick', () => {
    const h = hitungBlender([{ harga: 1000, lot: 10 }], 0.15, 0.25)!
    expect(h.wap).toBe(1000)
    expect(h.presetCutLoss.map((p) => p.persen)).toEqual([-2, -5, -8])
    // 1000*0.98=980 (kelipatan 5, pas), 1000*0.95=950 (pas), 1000*0.92=920 (pas)
    expect(h.presetCutLoss.map((p) => p.harga)).toEqual([980, 950, 920])
    expect(h.presetCutLoss[0].rugiRupiah).toBeCloseTo((980 - 1000) * 1000, 6)
  })

  it('posisi kosong → null', () => {
    expect(hitungBlender([{ harga: 0, lot: 0 }], 0.15, 0.25)).toBeNull()
  })
})

describe('hitungBunga', () => {
  it('tahun-1 dihitung tangan (tanpa setoran)', () => {
    // modal 1.000.000, imbal 12%/thn, inflasi 6%/thn, horizon 1
    const h = hitungBunga(1_000_000, 0, 12, 6, 1)
    expect(h.rows).toHaveLength(2) // tahun 0 & 1
    // majemuk bulanan pada rate bulanan turunan dari tahunan → balik ke +12% persis setelah 12 bulan
    expect(h.rows[1].saldoNominal).toBeCloseTo(1_120_000, 4)
    expect(h.rows[1].saldoRiil).toBeCloseTo(1_120_000 / 1.06, 4)
    // rumus riil (1+r)/(1+i)-1 tercetak & konsisten dengan baris tahun-1
    expect(h.imbalRiilTahunan).toBeCloseTo(1.12 / 1.06 - 1, 10)
    expect(h.rows[1].saldoRiil).toBeCloseTo(1_000_000 * (1 + h.imbalRiilTahunan), 4)
  })

  it('setoran bulanan menambah saldo dibanding tanpa setoran', () => {
    const tanpa = hitungBunga(1_000_000, 0, 10, 4, 2)
    const dengan = hitungBunga(1_000_000, 500_000, 10, 4, 2)
    expect(dengan.rows[2].saldoNominal).toBeGreaterThan(tanpa.rows[2].saldoNominal)
    expect(dengan.rows).toHaveLength(3)
  })
})
