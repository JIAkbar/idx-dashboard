import { describe, expect, it } from 'vitest'
import { lencanaSaringan, posisi52, tickPersen, type RingkasWinrate } from './winratePapan'

function r(n: number, eks: number | null): RingkasWinrate {
  return {
    menang: 0, kalah: 0, gantung: 0, n, winRate: null, winRateSemua: null,
    ekspektansi: eks, ekspektansiBiaya: eks, rataMenang: null, rataKalah: null,
    rataGantung: null, medianBarKe: null,
  }
}

describe('lencanaSaringan', () => {
  it('terbaik & terburuk hanya dari kondisi yang n-nya sah', () => {
    const s = {
      'RSI < 30': r(10, 9.9),          // n kecil: angka besar tak boleh menang
      'RSI 30–70': r(300, -1.1),
      'Di atas MA20·50·200': r(90, 2.8),
      'Volume normal': r(180, -0.7),
    }
    expect(lencanaSaringan(s)).toEqual({ terbaik: 'Di atas MA20·50·200', terburuk: 'RSI 30–70' })
  })

  it('satu kondisi sah = tanpa lencana; kosong = tanpa lencana', () => {
    expect(lencanaSaringan({ 'RSI 30–70': r(300, 1) })).toEqual({ terbaik: null, terburuk: null })
    expect(lencanaSaringan({})).toEqual({ terbaik: null, terburuk: null })
  })

  it('ekspektansi kosong tak ikut dibandingkan', () => {
    const s = { a: r(300, null), b: r(300, 0.5), c: r(300, -0.5) }
    expect(lencanaSaringan(s)).toEqual({ terbaik: 'b', terburuk: 'c' })
  })
})

describe('tickPersen', () => {
  it('mengikuti fraksi bursa: Rp 100 satu tick 1%, Rp 1.310 satu tick 0,38%', () => {
    expect(tickPersen(100)).toBeCloseTo(1, 5)
    expect(tickPersen(1310)).toBeCloseTo((5 / 1310) * 100, 5)
    expect(tickPersen(0)).toBeNull()
  })
})

describe('posisi52', () => {
  it('0 di terendah, 1 di tertinggi, dijepit di luar rentang, null bila rentang nol', () => {
    expect(posisi52(26, 26, 224)).toBe(0)
    expect(posisi52(224, 26, 224)).toBe(1)
    expect(posisi52(300, 26, 224)).toBe(1)
    expect(posisi52(100, 100, 100)).toBeNull()
  })
})
