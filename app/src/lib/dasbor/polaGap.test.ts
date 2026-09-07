import { describe, expect, it } from 'vitest'
import { cariGap, potongZona } from './polaGap'
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

describe('cariGap — definisi RENTANG', () => {
  it('ambang 2 tick menang di harga murah (fraksi 1 di harga 100 -> 2, bukan 1% = 1)', () => {
    // Zona 100..101,5 lebar 1,5 < ambang 2 -> ditolak.
    expect(cariGap([bar(0, 100, 100, 99, 100), bar(1, 102, 103, 101.5, 102)])).toHaveLength(0)
    // Zona 100..102,5 lebar 2,5 > 2 -> lolos.
    const hasil = cariGap([bar(0, 100, 100, 99, 100), bar(1, 103, 104, 102.5, 103)])
    expect(hasil).toHaveLength(1)
    expect(hasil[0].arah).toBe('naik')
    expect(hasil[0].bawah).toBe(100)
    expect(hasil[0].atas).toBe(102.5)
    expect(hasil[0].gapPct).toBeCloseTo(2.5, 5)
  })

  it('ambang 1% menang di harga tinggi (fraksi 3000 = 10 -> 2 tick 20 < 1% 30)', () => {
    // Lebar 25 < 30 -> ditolak walau sudah lebih dari dua tick.
    expect(cariGap([bar(0, 3000, 3000, 2990, 3000), bar(1, 3030, 3040, 3025, 3030)])).toHaveLength(0)
    const hasil = cariGap([bar(0, 3000, 3000, 2990, 3000), bar(1, 3040, 3050, 3031, 3040)])
    expect(hasil).toHaveLength(1)
    expect(hasil[0].gapPct).toBeCloseTo(31 / 30, 2)
  })

  it('OPEN tak lagi menentukan — candle yang membuka jauh tapi sumbunya menutup ruangnya bukan gap', () => {
    // Persis keluhan Johan: open 90 melompat jauh di bawah low 98, tapi high
    // 97,5 hampir menyentuhnya sehingga ruang kosongnya cuma 0,5.
    // Definisi open lama menandainya gap −8%; definisi rentang menolaknya.
    expect(cariGap([bar(0, 100, 100, 98, 99), bar(1, 90, 97.5, 89, 97)])).toHaveLength(0)
  })

  it('zona menyusut sedikit demi sedikit, bukan penuh-lalu-hilang', () => {
    const b: LilinData[] = [
      bar(0, 100, 100, 98, 99),
      bar(1, 110, 112, 108, 110),   // gap naik, zona 100..108
      bar(2, 108, 109, 104, 105),   // memotong dari atas -> sisa 100..104
      bar(3, 104, 105, 102, 103),   // -> sisa 100..102
    ]
    const g = cariGap(b)[0]
    expect(g.status).toBe('sebagian')
    expect(g.sisa).toEqual([[100, 102]])
    expect(g.sisaPct).toBeCloseTo(25, 5)   // 2 dari 8
  })

  it('terisi di bar gap SENDIRI kalau bar berikutnya langsung melahapnya', () => {
    const b: LilinData[] = [
      bar(0, 100, 100, 98, 99),
      bar(1, 110, 112, 108, 110),   // zona 100..108
      bar(2, 108, 109, 99, 100),    // rentang 99..109 menutupi seluruh zona
    ]
    const g = cariGap(b)[0]
    expect(g.status).toBe('terisi')
    expect(g.waktuTerisi).toBe(tgl(2))
    expect(g.barTerisi).toBe(1)
    expect(g.dataHabis).toBe(false)
  })

  it('belum terisi sampai data habis -> dataHabis true, dan itu DISEBUT', () => {
    const b: LilinData[] = [
      bar(0, 100, 100, 98, 99),
      bar(1, 110, 112, 108, 110),
      bar(2, 111, 113, 109, 112),
    ]
    const g = cariGap(b)[0]
    expect(g.status).toBe('utuh')
    expect(g.dataHabis).toBe(true)
    expect(g.waktuTerisi).toBeUndefined()
    expect(g.bertahanBar).toBe(1)
  })

  it('gap turun — cermin', () => {
    const b: LilinData[] = [
      bar(0, 100, 102, 100, 101),
      bar(1, 96, 97, 95, 96),       // zona 97..100
      bar(2, 96, 101, 96, 100),     // menutupi seluruh zona
    ]
    const g = cariGap(b)[0]
    expect(g.arah).toBe('turun')
    expect(g.bawah).toBe(97)
    expect(g.atas).toBe(100)
    expect(g.gapPct).toBeLessThan(0)
    expect(g.status).toBe('terisi')
  })

  it('data nyata BBCA — bentuk keluaran valid & konsisten', () => {
    const baris = (bbcaRaw as unknown as { d: [string, number, number, number, number, number][] }).d
    const bars: LilinData[] = baris.map(([time, open, high, low, close]) => (
      { time, open, high, low, close }
    ))
    const hasil = cariGap(bars, baris.map((b) => b[5]))
    expect(hasil.length).toBeGreaterThan(0)

    const waktuValid = new Set(bars.map((b) => b.time))
    let terakhir = ''
    for (const g of hasil) {
      expect(['naik', 'turun']).toContain(g.arah)
      expect(waktuValid.has(g.waktuGap)).toBe(true)
      expect(waktuValid.has(g.waktuAcuan)).toBe(true)
      expect(g.waktuGap > g.waktuAcuan).toBe(true)
      expect(g.atas).toBeGreaterThan(g.bawah)
      if (g.arah === 'naik') expect(g.gapPct).toBeGreaterThan(0)
      else expect(g.gapPct).toBeLessThan(0)
      if (g.status === 'terisi') {
        expect(g.waktuTerisi).toBeDefined()
        expect(waktuValid.has(g.waktuTerisi!)).toBe(true)
        expect(g.dataHabis).toBe(false)
      } else {
        expect(g.sisa.length).toBeGreaterThan(0)
      }
      expect(g.waktuGap >= terakhir).toBe(true)
      terakhir = g.waktuGap
    }
  })
})
/* ------------------------------------------------------------------ *
 * Definisi RENTANG + pengisian progresif (#50).
 *
 * Johan, menunjuk zona yang masih tergambar padahal candle-nya sudah
 * menutupinya: "gap kecil tapi kenapa masih ada, padahal sudah di tutpu
 * sama depannya … artinya logika berpikir nya salah, lalu gap itu candle
 * yang tidak terisi".
 * ------------------------------------------------------------------ */

describe('potongZona', () => {
  it('bar yang jatuh di TENGAH zona membelahnya jadi dua', () => {
    // 1.739 kejadian di kerangka 1 jam — bukan kasus tepi.
    expect(potongZona([[100, 200]], 140, 160)).toEqual([[100, 140], [160, 200]])
  })

  it('bar yang menutupi seluruh zona menghabiskannya', () => {
    expect(potongZona([[100, 200]], 90, 210)).toEqual([])
  })

  it('bar yang tak bersinggungan tak mengubah apa pun', () => {
    expect(potongZona([[100, 200]], 210, 220)).toEqual([[100, 200]])
    expect(potongZona([[100, 200]], 50, 100)).toEqual([[100, 200]])
  })

  it('memotong dari satu sisi', () => {
    expect(potongZona([[100, 200]], 90, 150)).toEqual([[150, 200]])
    expect(potongZona([[100, 200]], 150, 250)).toEqual([[100, 150]])
  })
})

describe('cariGap — arsip BBCA 2026, kriteria terima #50', () => {
  const bar2026: LilinData[] = (bbcaRaw.d as Array<[string, number, number, number, number, number]>)
    .filter(([t]) => t.startsWith('2026'))
    .map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c }))
  const vol2026 = (bbcaRaw.d as Array<[string, number, number, number, number, number]>)
    .filter(([t]) => t.startsWith('2026')).map((b) => b[5])
  const gap = cariGap(bar2026, vol2026)

  it('6 Feb dan 2 Mar TIDAK jadi gap — lebarnya di bawah ambang', () => {
    // Dua zona yang dikeluhkan Johan masih tergambar. Definisi open dulu
    // menandainya; definisi rentang memberi lebar 25 dengan ambang ~78 dan ~72.
    expect(gap.find((g) => g.waktuGap === '2026-02-06')).toBeUndefined()
    expect(gap.find((g) => g.waktuGap === '2026-03-02')).toBeUndefined()
  })

  it('30 Mar jadi gap turun zona 6.500-6.700', () => {
    const g = gap.find((x) => x.waktuGap === '2026-03-30')
    expect(g).toBeDefined()
    expect(g!.arah).toBe('turun')
    expect(g!.bawah).toBe(6500)
    expect(g!.atas).toBe(6700)
  })

  it('zona 30 Mar menyusut lebih dulu, lalu habis 8 Apr', () => {
    const g = gap.find((x) => x.waktuGap === '2026-03-30')!
    expect(g.status).toBe('terisi')
    expect(g.waktuTerisi).toBe('2026-04-08')
    // Menyusut, bukan langsung habis: kalau ia habis di bar pertama berarti
    // pengisian progresifnya tak berjalan.
    expect(g.barTerisi).toBeGreaterThan(0)
  })

  it('tiap gap punya sisa yang konsisten dengan statusnya', () => {
    for (const g of gap) {
      const lebarSisa = g.sisa.reduce((s, [a, b]) => s + (b - a), 0)
      if (g.status === 'terisi') expect(lebarSisa).toBe(0)
      else expect(lebarSisa).toBeGreaterThan(0)
      expect(g.sisaPct).toBeGreaterThanOrEqual(0)
      expect(g.sisaPct).toBeLessThanOrEqual(100)
    }
  })
})

describe('bar bervolume nol tak membentuk dan tak mengisi', () => {
  it('bar hantu di tengah zona tidak menghabiskannya', () => {
    const b: LilinData[] = [
      { time: '2026-01-01', open: 100, high: 100, low: 98, close: 99 },
      { time: '2026-01-02', open: 90, high: 90, low: 88, close: 89 },   // gap turun 90..98
      { time: '2026-01-05', open: 94, high: 95, low: 93, close: 94 },   // hantu, di tengah zona
      { time: '2026-01-06', open: 89, high: 90, low: 88, close: 89 },
    ]
    const denganHantu = cariGap(b, [1000, 1000, 0, 1000])
    const tanpaPenyaring = cariGap(b)
    expect(denganHantu).toHaveLength(1)
    // Tanpa volume, bar hantu ikut memotong dan zonanya terbelah.
    expect(tanpaPenyaring[0].sisa.length).toBeGreaterThan(denganHantu[0].sisa.length)
  })
})

describe('gap ANTAR-SESI di kerangka intraday (#50 §5)', () => {
  /** Bar 1 jam, sesi IDX disederhanakan: 09-11 lalu 13-15. */
  const jam = (tgl: string, j: number, o: number, h: number, l: number, c: number): LilinData => ({
    time: `${tgl} ${String(j).padStart(2, '0')}:00`, open: o, high: h, low: l, close: c,
  })

  it('lompatan SEMALAM ditandai antarSesi, bukan disamakan dengan celah intrahari', () => {
    const b: LilinData[] = [
      jam('2026-09-01', 9, 100, 101, 99, 100),
      jam('2026-09-01', 10, 100, 101, 99, 100),
      jam('2026-09-01', 11, 100, 101, 99, 100),
      jam('2026-09-01', 13, 100, 101, 99, 100),
      jam('2026-09-01', 14, 100, 101, 99, 100),
      jam('2026-09-01', 15, 100, 101, 99, 100),
      // Buka esok jauh di atas high kemarin -> zona 101..110.
      jam('2026-09-02', 9, 111, 112, 110, 111),
      jam('2026-09-02', 10, 111, 112, 110, 111),
    ]
    const g = cariGap(b)
    expect(g).toHaveLength(1)
    expect(g[0].antarSesi).toBe(true)
    expect(g[0].bawah).toBe(101)
    expect(g[0].atas).toBe(110)
  })

  it('celah DI DALAM satu sesi tidak ditandai antarSesi', () => {
    const b: LilinData[] = [
      jam('2026-09-01', 9, 100, 101, 99, 100),
      jam('2026-09-01', 10, 100, 101, 99, 100),
      jam('2026-09-01', 11, 100, 101, 99, 100),
      jam('2026-09-01', 12, 111, 112, 110, 111),   // lompat, tapi bar berikutnya
      jam('2026-09-01', 13, 111, 112, 110, 111),
      jam('2026-09-01', 14, 111, 112, 110, 111),
    ]
    const g = cariGap(b)
    expect(g).toHaveLength(1)
    expect(g[0].antarSesi).toBe(false)
  })

  it('kerangka HARIAN tak pernah antarSesi — di sana tiap bar memang satu sesi', () => {
    const b: LilinData[] = [
      bar(0, 100, 100, 98, 99),
      bar(1, 110, 112, 108, 110),
      bar(2, 111, 113, 109, 112),
    ]
    expect(cariGap(b)[0].antarSesi).toBe(false)
  })
})
