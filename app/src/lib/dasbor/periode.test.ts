import { describe, expect, it } from 'vitest'
import { cariTanggalPembanding, hitungPeriodePct } from './periode'

const tanggal = [
  { stem: 'ds_260107', date_iso: '2026-01-07', ihsg: 8000, ihsg_pct: 0.1, trading_day: 4 },
  { stem: 'ds_260108', date_iso: '2026-01-08', ihsg: 8100, ihsg_pct: 1.2, trading_day: 5 },
  { stem: 'ds_260109', date_iso: '2026-01-09', ihsg: 8050, ihsg_pct: -0.6, trading_day: 6 },
  { stem: 'ds_260212', date_iso: '2026-02-12', ihsg: 8300, ihsg_pct: 0.4, trading_day: 26 },
  // entri tambahan buat cakupan tes 3 bulan (hariMundur=91) — lihat SektorIndeks.tsx HARI_MUNDUR.m3
  { stem: 'ds_260409', date_iso: '2026-04-09', ihsg: 8500, ihsg_pct: 0.3, trading_day: 65 },
] as never[]

describe('cariTanggalPembanding', () => {
  it('ambil hari bursa terakhir yang <= tanggal target (bukan pas 30 hari)', () => {
    // target = 2026-02-12 - 30 hari = 2026-01-13, terdekat <= itu = 2026-01-09
    expect(cariTanggalPembanding(tanggal, '2026-02-12', 30)?.stem).toBe('ds_260109')
  })

  it('null kalau tanggal aktif ada di awal riwayat data — bukan 0', () => {
    expect(cariTanggalPembanding(tanggal, '2026-01-08', 30)).toBeNull()
  })

  it('null kalau daftar tanggal kosong', () => {
    expect(cariTanggalPembanding([], '2026-02-12', 30)).toBeNull()
  })

  it('ambil hari bursa terakhir yang <= tanggal target (91 hari, 3 Bulan)', () => {
    // target = 2026-04-09 - 91 hari = 2026-01-08, pas kena entri itu
    expect(cariTanggalPembanding(tanggal, '2026-04-09', 91)?.stem).toBe('ds_260108')
  })

  it('null kalau mundur 91 hari lewat awal riwayat data — bukan 0 atau tanggal terdekat', () => {
    // target = 2026-01-08 - 91 hari = 2025-10-09, jauh sebelum entri paling awal (2026-01-07)
    expect(cariTanggalPembanding(tanggal, '2026-01-08', 91)).toBeNull()
  })
})

describe('hitungPeriodePct', () => {
  it('menghitung persen sekarang vs pembanding', () => {
    expect(hitungPeriodePct(8300, 8000)).toBeCloseTo(3.75, 6)
  })

  it('memberi null kalau data pembanding tidak ada — jangan diam-diam jadi 0', () => {
    expect(hitungPeriodePct(8300, undefined)).toBeNull()
    expect(hitungPeriodePct(8300, null)).toBeNull()
  })

  it('memberi null kalau nilai pembanding nol', () => {
    expect(hitungPeriodePct(8300, 0)).toBeNull()
  })
})
