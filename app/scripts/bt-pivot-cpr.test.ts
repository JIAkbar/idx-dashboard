import { describe, it, expect } from 'vitest'
import { hasilRRTrade, returnArah, ARAH_RELASI, ARAH_POSISI, HORIZON } from './bt-pivot-cpr.ts'

const bar = (high: number, low: number) => ({ high, low })

describe('hasil satu trade R:R (#63, spek §4.3)', () => {
  it('target tersentuh duluan = target', () => {
    expect(hasilRRTrade([bar(0, 0), bar(105, 98), bar(90, 80)], 1, 2, 104, 95)).toBe('target')
  })

  it('stop tersentuh duluan = sl', () => {
    expect(hasilRRTrade([bar(0, 0), bar(103, 94), bar(110, 100)], 1, 2, 104, 95)).toBe('sl')
  })

  it('keduanya di bar yang SAMA = ambigu, bukan target', () => {
    // Urutannya tak bisa dipastikan dari OHLC harian. Speknya memutuskan
    // konservatif: bukan kemenangan. Kalau ini terbaca 'target', win rate
    // seluruh setup naik tanpa satu pun galat.
    expect(hasilRRTrade([bar(0, 0), bar(106, 94)], 1, 1, 104, 95)).toBe('ambigu')
  })

  it('tak menyentuh apa pun sampai horizon habis = tak_selesai', () => {
    expect(hasilRRTrade([bar(0, 0), bar(103, 96), bar(102, 97)], 1, 2, 104, 95)).toBe('tak_selesai')
  })

  it('bar SESUDAH horizon tak ikut dinilai', () => {
    // Bar ke-3 menyentuh target, tapi horizonnya berhenti di bar ke-2.
    expect(hasilRRTrade([bar(0, 0), bar(103, 96), bar(102, 97), bar(120, 90)], 1, 2, 104, 95)).toBe('tak_selesai')
  })

  it('deret yang lebih pendek daripada horizon berhenti di bar terakhir, bukan galat', () => {
    expect(hasilRRTrade([bar(0, 0), bar(103, 96)], 1, 5, 104, 95)).toBe('tak_selesai')
  })
})

describe('return bertanda arah (#63)', () => {
  it('bearish yang TURUN itu menang', () => {
    expect(returnArah(100, 90, 'bearish')).toBeCloseTo(0.1, 10)
    expect(returnArah(100, 90, 'bullish')).toBeCloseTo(-0.1, 10)
  })
})

describe('kelas tanpa bias tak diukur (#63)', () => {
  it('Outside/Inside Value dan di-dalam tak punya arah', () => {
    // Speknya memberi bias untuk empat kelas relasi dan dua posisi saja.
    // Menambahkan arah untuk sisanya = mengarang definisi, dan badge-nya
    // akan memajang win rate yang diam-diam mengasumsikan long.
    expect(ARAH_RELASI['Outside Value']).toBeUndefined()
    expect(ARAH_RELASI['Inside Value']).toBeUndefined()
    expect(ARAH_POSISI['di-dalam']).toBeUndefined()
    expect(Object.keys(ARAH_RELASI)).toHaveLength(4)
    expect(Object.keys(ARAH_POSISI)).toHaveLength(2)
  })

  it('horizon tetap 5 bar — kunci badge mengeja h5', () => {
    expect(HORIZON).toBe(5)
  })
})
