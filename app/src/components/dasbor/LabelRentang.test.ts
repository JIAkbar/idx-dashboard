import { describe, expect, it } from 'vitest'
import { teksRentang } from './LabelRentang'

describe('teksRentang', () => {
  it('rentang normal dengan n', () => {
    expect(teksRentang('2026-05-22', '2026-08-21', 63))
      .toBe('22 Mei 2026 – 21 Agu 2026 · 63 hari bursa')
  })

  it('rentang normal tanpa n (n tak diberi)', () => {
    expect(teksRentang('2026-05-22', '2026-08-21'))
      .toBe('22 Mei 2026 – 21 Agu 2026')
  })

  it('satuan kustom', () => {
    expect(teksRentang('2026-01-01', '2026-01-31', 4, 'minggu'))
      .toBe('1 Jan 2026 – 31 Jan 2026 · 4 minggu')
  })

  it('satu hari (mulai == akhir) cukup satu tanggal, n diabaikan', () => {
    expect(teksRentang('2026-08-21', '2026-08-21', 1)).toBe('21 Agu 2026')
  })

  it('kosong -> null', () => {
    expect(teksRentang('', '')).toBeNull()
    expect(teksRentang(null, null)).toBeNull()
    expect(teksRentang(undefined, undefined)).toBeNull()
    expect(teksRentang('2026-08-21', '')).toBeNull()
    expect(teksRentang('', '2026-08-21')).toBeNull()
  })
})
