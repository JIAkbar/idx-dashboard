import { describe, expect, it } from 'vitest'
import { hitungBreadth, susunHistoriBreadth } from './breadth'
import type { DataHarian } from './dataHarian'

function hari(stocks?: { v: number; p: number }[]): DataHarian {
  return {
    date_id: 'Rabu, 19 Agustus 2026',
    trading_day: 147,
    ihsg_value: 6394.13,
    ihsg_pct: -0.86,
    ...(stocks ? { price_movement: { stocks } } : {}),
  } as DataHarian
}

describe('hitungBreadth', () => {
  it('menghitung naik/turun/tetap dari lima keranjang [turun banyak, turun, tetap, naik, naik banyak]', () => {
    // ds_260819 asli — IHSG −0,86%, breadth harus ikut condong turun.
    const b = hitungBreadth(hari([{ v: 135, p: 14 }, { v: 244, p: 25 }, { v: 327, p: 34 }, { v: 158, p: 16 }, { v: 99, p: 10 }]))
    expect(b).not.toBeNull()
    expect(b!.turun).toBe(379) // 135 + 244
    expect(b!.naik).toBe(257) // 158 + 99
    expect(b!.tetap).toBe(327)
    expect(b!.total).toBe(963)
    expect(b!.selisihPp).toBeLessThan(0) // turun dominan, searah IHSG turun
  })

  it('ds_260818 — IHSG +0,75%, breadth harus condong naik', () => {
    const b = hitungBreadth(hari([{ v: 83, p: 9 }, { v: 165, p: 17 }, { v: 296, p: 31 }, { v: 234, p: 24 }, { v: 185, p: 19 }]))
    expect(b!.naik).toBe(419)
    expect(b!.turun).toBe(248)
    expect(b!.selisihPp).toBeGreaterThan(0)
  })

  it('hari tanpa price_movement → null, BUKAN 0 (nol berarti bursa tutup total)', () => {
    expect(hitungBreadth(hari(undefined))).toBeNull()
  })

  it('keranjang rusak (bukan 5 elemen) → null', () => {
    expect(hitungBreadth(hari([{ v: 1, p: 1 }]))).toBeNull()
  })

  it('total nol (data kosong) → null, bukan pembagian dengan nol', () => {
    expect(hitungBreadth(hari([{ v: 0, p: 0 }, { v: 0, p: 0 }, { v: 0, p: 0 }, { v: 0, p: 0 }, { v: 0, p: 0 }]))).toBeNull()
  })
})

describe('susunHistoriBreadth', () => {
  it('memasangkan tanggal dengan breadth-nya, urutan mengikuti input', () => {
    const tanggal = [{ date_iso: '2026-08-18' }, { date_iso: '2026-08-19' }]
    const hariArr = [
      hari([{ v: 83, p: 9 }, { v: 165, p: 17 }, { v: 296, p: 31 }, { v: 234, p: 24 }, { v: 185, p: 19 }]),
      hari([{ v: 135, p: 14 }, { v: 244, p: 25 }, { v: 327, p: 34 }, { v: 158, p: 16 }, { v: 99, p: 10 }]),
    ]
    const h = susunHistoriBreadth(tanggal, hariArr)
    expect(h).toHaveLength(2)
    expect(h[0].tanggal).toBe('2026-08-18')
    expect(h[0].breadth!.selisihPp).toBeGreaterThan(0)
    expect(h[1].tanggal).toBe('2026-08-19')
    expect(h[1].breadth!.selisihPp).toBeLessThan(0)
  })

  it('hari tanpa data tetap muncul dengan breadth null, bukan dilompati', () => {
    const tanggal = [{ date_iso: '2026-08-20' }]
    const h = susunHistoriBreadth(tanggal, [hari(undefined)])
    expect(h).toHaveLength(1)
    expect(h[0].breadth).toBeNull()
  })
})
