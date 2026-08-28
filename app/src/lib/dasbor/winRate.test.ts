import { describe, it, expect } from 'vitest'
import {
  cariIndeksHari, menangOpenHigh, menangCloseToClose, menangTpSlH5,
  agregatWinRate, rataPersen, type BarWinRate,
} from './winRate'

/** Deret tangan-hitung — H = 2026-08-20. tp1=113, sl=97 dipakai di uji TP/SL. */
const bars: BarWinRate[] = [
  { tanggal: '2026-08-20', open: 100, high: 105, low: 98, close: 102 }, // H
  { tanggal: '2026-08-21', open: 102, high: 110, low: 101, close: 108 }, // H+1: high>open, close naik
  { tanggal: '2026-08-24', open: 108, high: 112, low: 106, close: 110 }, // H+2: belum kena tp1(113)/sl(97)
  { tanggal: '2026-08-25', open: 110, high: 120, low: 95, close: 96 }, // H+3: tp1 DAN sl kena hari sama
  { tanggal: '2026-08-26', open: 96, high: 99, low: 94, close: 97 },
  { tanggal: '2026-08-27', open: 97, high: 100, low: 93, close: 95 },
]

describe('cariIndeksHari', () => {
  it('menemukan indeks H dari tanggal', () => {
    expect(cariIndeksHari(bars, '2026-08-20')).toBe(0)
    expect(cariIndeksHari(bars, '2026-08-25')).toBe(3)
  })
  it('-1 kalau tanggal tak ada (libur/riwayat belum sampai)', () => {
    expect(cariIndeksHari(bars, '2026-08-22')).toBe(-1)
  })
})

describe('menangOpenHigh — Open-vs-High H+1', () => {
  it('menang: high(H+1)=110 > open(H+1)=102', () => {
    expect(menangOpenHigh(bars, 0)).toBe('menang')
  })
  it('kalah: bar buatan high <= open', () => {
    const b2: BarWinRate[] = [bars[0], { tanggal: '2026-08-21', open: 102, high: 102, low: 100, close: 101 }]
    expect(menangOpenHigh(b2, 0)).toBe('kalah')
  })
  it('tak-terukur: H+1 belum ada (ujung riwayat)', () => {
    expect(menangOpenHigh(bars, bars.length - 1)).toBe('tak-terukur')
  })
  it('tak-terukur: indeks H tak ditemukan (-1)', () => {
    expect(menangOpenHigh(bars, -1)).toBe('tak-terukur')
  })
})

describe('menangCloseToClose — H+1', () => {
  it('menang + persen tangan-hitung: (108-102)/102*100 = 5,882...%', () => {
    const r = menangCloseToClose(bars, 0)
    expect(r.hasil).toBe('menang')
    expect(r.persen).toBeCloseTo(5.882, 2)
  })
  it('kalah kalau close H+1 turun (idx4: close 97 -> idx5: close 95)', () => {
    const r = menangCloseToClose(bars, 4)
    expect(r.hasil).toBe('kalah')
    expect(r.persen).toBeCloseTo(((95 - 97) / 97) * 100, 6)
  })
  it('kalah: close H+1 <= close H (sama dihitung kalah, bukan menang)', () => {
    const sama: BarWinRate[] = [bars[0], { ...bars[0], tanggal: '2026-08-21' }]
    expect(menangCloseToClose(sama, 0).hasil).toBe('kalah')
  })
  it('tak-terukur di ujung riwayat', () => {
    expect(menangCloseToClose(bars, bars.length - 1).hasil).toBe('tak-terukur')
  })
})

describe('menangTpSlH5 — tp1=113, sl=97', () => {
  it('tak-tentu: tp1(113) DAN sl(97) sama-sama tersentuh di H+3 (high 120, low 95)', () => {
    expect(menangTpSlH5(bars, 0, 113, 97)).toBe('tak-tentu')
  })
  it('menang: tp1 kena lebih dulu, sl tak pernah', () => {
    const naik: BarWinRate[] = [
      { tanggal: '2026-08-20', open: 100, high: 100, low: 100, close: 100 },
      { tanggal: '2026-08-21', open: 100, high: 108, low: 99, close: 105 },
      { tanggal: '2026-08-24', open: 105, high: 116, low: 104, close: 114 }, // tp1=113 kena, sl=90 tak kena
    ]
    expect(menangTpSlH5(naik, 0, 113, 90)).toBe('menang')
  })
  it('kalah: sl kena lebih dulu, tp1 tak pernah', () => {
    const turun: BarWinRate[] = [
      { tanggal: '2026-08-20', open: 100, high: 100, low: 100, close: 100 },
      { tanggal: '2026-08-21', open: 100, high: 101, low: 88, close: 90 }, // sl=90 kena, tp1=140 tak kena
    ]
    expect(menangTpSlH5(turun, 0, 140, 90)).toBe('kalah')
  })
  it('tak-tentu: sampai H+5 tak satu pun tersentuh', () => {
    const datar: BarWinRate[] = [
      { tanggal: '2026-08-20', open: 100, high: 101, low: 99, close: 100 },
      { tanggal: '2026-08-21', open: 100, high: 101, low: 99, close: 100 },
    ]
    expect(menangTpSlH5(datar, 0, 200, 10)).toBe('tak-tentu')
  })
  it('tak-terukur: H+1 belum ada sama sekali', () => {
    expect(menangTpSlH5(bars, bars.length - 1, 113, 97)).toBe('tak-terukur')
  })
})

describe('agregatWinRate', () => {
  it('menghitung win rate hanya dari menang+kalah, tak-tentu/tak-terukur dikeluarkan', () => {
    const a = agregatWinRate(['menang', 'menang', 'kalah', 'tak-tentu', 'tak-terukur'])
    expect(a).toMatchObject({ menang: 2, kalah: 1, takTentu: 1, takTerukur: 1 })
    expect(a.winRatePct).toBeCloseTo((2 / 3) * 100, 6)
  })
  it('null (bukan 0) kalau tak ada satu pun yang terukur', () => {
    expect(agregatWinRate(['tak-tentu', 'tak-terukur']).winRatePct).toBeNull()
  })
})

describe('rataPersen', () => {
  it('mengabaikan null, bukan menghitungnya sebagai 0', () => {
    expect(rataPersen([10, null, 20, null])).toBeCloseTo(15, 6)
  })
  it('null kalau semuanya null', () => {
    expect(rataPersen([null, null])).toBeNull()
  })
})
