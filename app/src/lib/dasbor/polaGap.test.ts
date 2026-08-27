import { describe, expect, it } from 'vitest'
import { cariGap } from './polaGap'
import type { LilinData } from './grafikEmiten'
// Arsip mentah diimpor sebagai modul JSON — sama pola dengan polaRbs.test.ts:
// regresi terhadap DATA NYATA, bukan fixture yang diketik ulang.
import bbcaRaw from '../../../../data-idx/json/ohlc/BBCA.json'

function tgl(i: number): string {
  const d = new Date(Date.UTC(2020, 0, 1))
  d.setUTCDate(d.getUTCDate() + i)
  return d.toISOString().slice(0, 10)
}

function bar(i: number, o: number, h: number, l: number, c: number): LilinData {
  return { time: tgl(i), open: o, high: h, low: l, close: c }
}

describe('cariGap', () => {
  it('gap naik pada tepat ambang (fraksi 1 di harga 100 -> ambang = 2 tick = Rp2, bukan 1% = Rp1)', () => {
    // fraksi(100) = 1 (jenjang <=200) -> 2 tick = 2; 1% x 100 = 1 -> ambang = max(2,1) = 2.
    const b: LilinData[] = [
      bar(0, 100, 100, 100, 100),
      bar(1, 102, 103, 101, 102), // open 102 = high(0) 100 + ambang 2 -> tepat kena (>=)
      bar(2, 102, 103, 101.5, 102),
    ]
    const hasil = cariGap(b)
    expect(hasil).toHaveLength(1)
    expect(hasil[0].arah).toBe('naik')
    expect(hasil[0].waktuGap).toBe(tgl(1))
    expect(hasil[0].waktuAcuan).toBe(tgl(0))
    expect(hasil[0].hargaAcuan).toBe(100)
    expect(hasil[0].gapPct).toBeCloseTo(2, 5)
  })

  it('open satu tick DI BAWAH ambang -> bukan gap', () => {
    const b: LilinData[] = [
      bar(0, 100, 100, 100, 100),
      bar(1, 101, 102, 100.5, 101), // open 101 < 102 (ambang tepat) -> tak kena
    ]
    expect(cariGap(b)).toHaveLength(0)
  })

  it('gap naik di harga tinggi -> ambang 1% MENANG dari 2 tick (fraksi 3000 = Rp10)', () => {
    // fraksi(3000) = 10 -> 2 tick = 20; 1% x 3000 = 30 -> ambang = max(20,30) = 30.
    const b: LilinData[] = [
      bar(0, 3000, 3000, 3000, 3000),
      bar(1, 3029, 3040, 3020, 3030), // open 3029 < 3030 -> belum kena
    ]
    expect(cariGap(b)).toHaveLength(0)

    const b2: LilinData[] = [
      bar(0, 3000, 3000, 3000, 3000),
      bar(1, 3030, 3040, 3020, 3030), // open 3030 = 3000+30 -> tepat kena
    ]
    const hasil = cariGap(b2)
    expect(hasil).toHaveLength(1)
    expect(hasil[0].gapPct).toBeCloseTo(1, 5)
  })

  it('gap naik belum terisi selamanya kalau low tak pernah turun ke high(t-1)', () => {
    const b: LilinData[] = [
      bar(0, 100, 100, 100, 100),
      bar(1, 105, 108, 103, 106), // gap naik, low 103 > 100 -> belum terisi hari itu
      bar(2, 106, 110, 104, 108),
      bar(3, 108, 112, 105, 110),
    ]
    const hasil = cariGap(b)
    expect(hasil).toHaveLength(1)
    expect(hasil[0].terisi).toBe(false)
    expect(hasil[0].waktuTerisi).toBeUndefined()
    expect(hasil[0].hariTerisi).toBeUndefined()
  })

  it('gap naik terisi DI HARI YANG SAMA (low hari gap sudah turun balik ke high(t-1))', () => {
    const b: LilinData[] = [
      bar(0, 100, 100, 100, 100),
      bar(1, 105, 108, 99, 101), // gap naik, tapi low hari itu 99 <= 100 -> terisi hari ke-0
    ]
    const hasil = cariGap(b)
    expect(hasil).toHaveLength(1)
    expect(hasil[0].terisi).toBe(true)
    expect(hasil[0].waktuTerisi).toBe(tgl(1))
    expect(hasil[0].hariTerisi).toBe(0)
  })

  it('gap naik terisi N hari kemudian', () => {
    const b: LilinData[] = [
      bar(0, 100, 100, 100, 100),
      bar(1, 105, 108, 103, 106), // gap naik, belum terisi
      bar(2, 106, 109, 104, 107), // belum terisi
      bar(3, 105, 106, 100, 101), // low 100 <= 100 -> terisi di sini
    ]
    const hasil = cariGap(b)
    expect(hasil).toHaveLength(1)
    expect(hasil[0].terisi).toBe(true)
    expect(hasil[0].waktuTerisi).toBe(tgl(3))
    expect(hasil[0].hariTerisi).toBe(2)
  })

  it('gap turun (cermin) — ambang dari low(t-1), terisi saat high naik balik ke low(t-1)', () => {
    const b: LilinData[] = [
      bar(0, 100, 100, 100, 100),
      bar(1, 98, 99, 97, 98), // open 98 = low(0) 100 - ambang 2 -> tepat kena
      bar(2, 98, 99.5, 97, 98),
      bar(3, 98, 100.5, 98, 100), // high 100,5 >= 100 -> terisi
    ]
    const hasil = cariGap(b)
    expect(hasil).toHaveLength(1)
    expect(hasil[0].arah).toBe('turun')
    expect(hasil[0].hargaAcuan).toBe(100)
    expect(hasil[0].gapPct).toBeCloseTo(-2, 5)
    expect(hasil[0].terisi).toBe(true)
    expect(hasil[0].hariTerisi).toBe(2)
  })

  it('data nyata BBCA — bentuk keluaran valid & konsisten', () => {
    const baris = (bbcaRaw as { d: [string, number, number, number, number, number][] }).d
    const bars: LilinData[] = baris.map(([time, open, high, low, close]) => (
      { time, open, high, low, close }
    ))
    const hasil = cariGap(bars)

    // BBCA 22 tahun riwayat harian — kalau ini kosong, mesinnya rusak total.
    expect(hasil.length).toBeGreaterThan(0)

    const waktuValid = new Set(bars.map((b) => b.time))
    let terakhir = ''
    for (const g of hasil) {
      expect(['naik', 'turun']).toContain(g.arah)
      expect(waktuValid.has(g.waktuGap)).toBe(true)
      expect(waktuValid.has(g.waktuAcuan)).toBe(true)
      expect(g.waktuGap > g.waktuAcuan).toBe(true)
      // Satu rumus gapPct membawa tanda arahnya sendiri.
      if (g.arah === 'naik') expect(g.gapPct).toBeGreaterThan(0)
      else expect(g.gapPct).toBeLessThan(0)
      if (g.terisi) {
        expect(g.waktuTerisi).toBeDefined()
        expect(waktuValid.has(g.waktuTerisi!)).toBe(true)
        expect(g.hariTerisi).toBeGreaterThanOrEqual(0)
      } else {
        expect(g.waktuTerisi).toBeUndefined()
        expect(g.hariTerisi).toBeUndefined()
      }
      // Urut naik menurut waktu gap — kontrak yang dipakai penggambar.
      expect(g.waktuGap >= terakhir).toBe(true)
      terakhir = g.waktuGap
    }
  })
})
