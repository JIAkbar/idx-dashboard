import { describe, expect, it } from 'vitest'
import { hitungYtdPct } from './ytd'

const dates = [
  { stem: 'ds_260107', date_iso: '2026-01-07', ihsg: 8000, ihsg_pct: 0.1, trading_day: 4 },
  { stem: 'ds_260108', date_iso: '2026-01-08', ihsg: 8100, ihsg_pct: 1.2, trading_day: 5 },
] as never[]

describe('hitungYtdPct', () => {
  it('menghitung persen terhadap tanggal pertama tahun berjalan', () => {
    expect(hitungYtdPct(8400, dates)).toBeCloseTo(5, 6)
  })

  it('memberi null kalau daftar tanggal kosong — jangan diam-diam jadi 0', () => {
    expect(hitungYtdPct(8400, [])).toBeNull()
  })

  it('memberi null kalau harga acuan nol', () => {
    const nol = [{ stem: 'x', date_iso: '2026-01-07', ihsg: 0, ihsg_pct: 0, trading_day: 1 }] as never[]
    expect(hitungYtdPct(8400, nol)).toBeNull()
  })
})
