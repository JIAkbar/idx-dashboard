import { describe, expect, it } from 'vitest'
import {
  agregasi4h, agregatSeleksiIntraday, dariBerkas, jamWib, tanggalWib, type Bar1H,
} from './intradayWhales'

/** Epoch WIB dari 'yyyy-mm-dd HH' — dihitung manual (UTC+7). */
function e(tgl: string, jam: number): number {
  return Math.floor(Date.parse(`${tgl}T00:00:00Z`) / 1000) + (jam - 7) * 3600
}

function bar(tgl: string, jam: number, o = 100, c = 101, v = 10): Bar1H {
  return {
    epoch: e(tgl, jam), open: o, high: Math.max(o, c) + 1, low: Math.min(o, c) - 1,
    close: c, volume: v, value: v * 100, frequency: 1,
  }
}

describe('epoch WIB', () => {
  it('tanggal & jam dihitung di zona WIB, bukan zona mesin', () => {
    expect(tanggalWib(e('2026-08-24', 9))).toBe('2026-08-24')
    expect(jamWib(e('2026-08-24', 9))).toBe(9)
    expect(jamWib(e('2026-08-24', 15))).toBe(15)
  })
})

describe('agregasi4h — paruh sesi', () => {
  const hari = [
    bar('2026-08-24', 9, 100, 102, 10),
    bar('2026-08-24', 10, 102, 104, 20),
    bar('2026-08-24', 11, 104, 103, 30),
    bar('2026-08-24', 13, 103, 105, 40),
    bar('2026-08-24', 14, 105, 106, 50),
    bar('2026-08-24', 15, 106, 107, 60),
  ]

  it('tepat 2 bar per hari bursa (uji terima spek §8.4)', () => {
    expect(agregasi4h(hari)).toHaveLength(2)
  })

  it('open dari bar pertama paruh, close dari bar terakhir, volume dijumlah utuh', () => {
    const [pagi, sore] = agregasi4h(hari)
    expect(pagi.open).toBe(100)
    expect(pagi.close).toBe(103)
    expect(pagi.volume).toBe(60)
    expect(sore.open).toBe(103)
    expect(sore.close).toBe(107)
    expect(sore.volume).toBe(150)
    expect(pagi.volume + sore.volume).toBe(hari.reduce((s, b) => s + b.volume, 0))
  })

  it('high/low 4H = ekstrem harian per paruh (cocok high/low hari — uji §8.4)', () => {
    const [pagi, sore] = agregasi4h(hari)
    expect(Math.max(pagi.high, sore.high)).toBe(Math.max(...hari.map((b) => b.high)))
    expect(Math.min(pagi.low, sore.low)).toBe(Math.min(...hari.map((b) => b.low)))
  })

  it('Jumat tanpa ember 13 tetap dua paruh yang benar', () => {
    const jumat = [bar('2026-08-21', 9), bar('2026-08-21', 14), bar('2026-08-21', 15)]
    const hasil = agregasi4h(jumat)
    expect(hasil).toHaveLength(2)
    expect(jamWib(hasil[1].epoch)).toBe(14)
  })
})

describe('agregatSeleksiIntraday', () => {
  const semua = [bar('2026-08-24', 9, 100, 102, 10), bar('2026-08-25', 9, 200, 201, 20)]

  it('menyaring epoch DAN irisan rentang harga', () => {
    const h = agregatSeleksiIntraday(semua, e('2026-08-24', 0), e('2026-08-26', 0), 95, 110)
    expect(h?.nBar).toBe(1)
    expect(h?.volume).toBe(10)
    expect(h?.nHari).toBe(1)
  })

  it('null saat tak ada bar — bukan nol palsu', () => {
    expect(agregatSeleksiIntraday(semua, 0, 1, 0, 1)).toBeNull()
  })
})

describe('dariBerkas', () => {
  it('kolom padat terbaca dan angka string di-Number-kan', () => {
    const b = dariBerkas({ bar: [[1, '2', 3, 1, 2, '100', 200, '5', 0, 0]] })[0]
    expect(b.open).toBe(2)
    expect(b.volume).toBe(100)
    expect(b.frequency).toBe(5)
  })
  it('null/berkas cacat = larik kosong', () => {
    expect(dariBerkas(null)).toEqual([])
  })
})
