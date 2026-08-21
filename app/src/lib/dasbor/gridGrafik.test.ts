import { describe, expect, it } from 'vitest'
import { GRID_BAWAAN, gridDariTemplate, warnaGrid } from './grafikEmiten'

/**
 * B33 — garis bantu kanvas bisa dimatikan dan diatur transparansinya.
 * Yang diuji di sini bukan tampilannya melainkan dua hal yang gagal senyap:
 * warna yang berubah jadi hitam karena token tak terbaca, dan template lama
 * yang ditolak karena belum punya ruas `grid`.
 */
describe('warnaGrid', () => {
  it('alfa penuh mengembalikan token apa adanya — tak ada konversi yang tak perlu', () => {
    expect(warnaGrid('#24262E', 1)).toBe('#24262E')
  })

  it('hex 6 digit jadi rgba', () => {
    expect(warnaGrid('#24262E', 0.5)).toBe('rgba(36, 38, 46, 0.5)')
  })

  it('hex 3 digit dimekarkan dulu', () => {
    expect(warnaGrid('#abc', 0.4)).toBe('rgba(170, 187, 204, 0.4)')
  })

  it('huruf besar dan spasi di token tetap terbaca', () => {
    expect(warnaGrid('  #FFFFFF  ', 0.25)).toBe('rgba(255, 255, 255, 0.25)')
  })

  it('alfa di luar 0-1 diklem, bukan menghasilkan rgba tak sah', () => {
    expect(warnaGrid('#000000', -3)).toBe('rgba(0, 0, 0, 0)')
    expect(warnaGrid('#000000', 9)).toBe('#000000')
  })

  it('token yang bukan hex dikembalikan APA ADANYA, bukan dipaksa hitam', () => {
    // Grid yang diam-diam berubah hitam jauh lebih buruk daripada grid yang
    // mengabaikan setelan alfa.
    expect(warnaGrid('oklch(0.2 0.01 260)', 0.5)).toBe('oklch(0.2 0.01 260)')
    expect(warnaGrid('rebeccapurple', 0.5)).toBe('rebeccapurple')
    expect(warnaGrid('', 0.5)).toBe('')
  })
})

describe('gridDariTemplate', () => {
  it('template lama tanpa ruas grid memakai bawaan, bukan ditolak', () => {
    expect(gridDariTemplate(undefined)).toEqual(GRID_BAWAAN)
    expect(gridDariTemplate(null)).toEqual(GRID_BAWAAN)
    expect(gridDariTemplate('bukan objek')).toEqual(GRID_BAWAAN)
  })

  it('nilai tersimpan dipakai apa adanya', () => {
    expect(gridDariTemplate({ tampil: false, alfa: 0.3 })).toEqual({ tampil: false, alfa: 0.3 })
  })

  it('alfa rusak jatuh ke bawaan; alfa di luar rentang diklem', () => {
    expect(gridDariTemplate({ tampil: true, alfa: NaN }).alfa).toBe(GRID_BAWAAN.alfa)
    expect(gridDariTemplate({ tampil: true, alfa: 'banyak' }).alfa).toBe(GRID_BAWAAN.alfa)
    expect(gridDariTemplate({ tampil: true, alfa: 5 }).alfa).toBe(1)
    expect(gridDariTemplate({ tampil: true, alfa: -1 }).alfa).toBe(0)
  })

  it('hanya `tampil: false` yang mematikan grid — ruas hilang berarti hidup', () => {
    expect(gridDariTemplate({ alfa: 0.5 }).tampil).toBe(true)
    expect(gridDariTemplate({ tampil: false }).tampil).toBe(false)
  })
})
