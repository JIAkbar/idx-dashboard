import { describe, expect, it } from 'vitest'
import { geserPeriode } from './geserPeriode'

describe('geserPeriode', () => {
  it('geser bulan biasa', () => {
    expect(geserPeriode(2026, 1, 1, 0)).toEqual({ t: 2026, b: 2 })
    expect(geserPeriode(2026, 1, -1, 0)).toEqual({ t: 2026, b: 0 })
  })
  it('limpahan bulan menyeberang tahun', () => {
    expect(geserPeriode(2026, 11, 1, 0)).toEqual({ t: 2027, b: 0 })
    expect(geserPeriode(2026, 0, -1, 0)).toEqual({ t: 2025, b: 11 })
  })
  it('geser tahun mempertahankan bulan', () => {
    expect(geserPeriode(2026, 7, 0, -1)).toEqual({ t: 2025, b: 7 })
    expect(geserPeriode(2021, 1, 0, 1)).toEqual({ t: 2022, b: 1 })
  })
  it('lompat lima tahun cukup lima kali, bukan enam puluh', () => {
    let s = { t: 2021, b: 1 }
    for (let i = 0; i < 5; i++) s = geserPeriode(s.t, s.b, 0, 1)
    expect(s).toEqual({ t: 2026, b: 1 })
  })
})
