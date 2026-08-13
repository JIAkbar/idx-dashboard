import { describe, expect, it } from 'vitest'
import { cariTanggalPembanding, hitungPeriodePct, rentangPreset } from './periode'
import { agregatBrokerRows } from './brokerHarian'

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

describe('rentangPreset (#75)', () => {
  it('1 Bulan mundur 30 hari kalender, snap ke hari berdata terakhir <= target', () => {
    // target = 2026-02-12 - 30 = 2026-01-13 → snap ke 2026-01-09
    expect(rentangPreset(tanggal, '2026-02-12', 'b1')).toEqual({ mulai: '2026-01-09', akhir: '2026-02-12' })
  })

  it('riwayat lebih pendek dari preset → mulai jatuh ke tanggal berdata pertama', () => {
    expect(rentangPreset(tanggal, '2026-01-09', 'b3')).toEqual({ mulai: '2026-01-07', akhir: '2026-01-09' })
  })

  it('YTD = tanggal berdata pertama di tahun yang sama', () => {
    expect(rentangPreset(tanggal, '2026-04-09', 'ytd')).toEqual({ mulai: '2026-01-07', akhir: '2026-04-09' })
  })

  it('null kalau rentang tidak valid (akhir = tanggal berdata pertama)', () => {
    expect(rentangPreset(tanggal, '2026-01-07', 'w1')).toBeNull()
    expect(rentangPreset([], '2026-01-07', 'ytd')).toBeNull()
  })
})

describe('agregatBrokerRows (#75)', () => {
  const hari1 = [
    { kode: 'YP', nama: 'Mirae', vol: 10, nilai: 100, freq: 5, rn: 1, rf: 1 },
    { kode: 'NI', nama: 'BNI', vol: 4, nilai: 40, freq: 9, rn: 2, rf: 2 },
  ]
  const hari2 = [
    { kode: 'NI', nama: 'BNI', vol: 6, nilai: 70, freq: 1, rn: 1, rf: 2 },
    { kode: 'CC', nama: 'Mandiri', vol: 1, nilai: 60, freq: 8, rn: 2, rf: 1 },
  ]

  it('SUM vol/nilai/freq per broker + ranking ulang atas totalnya', () => {
    const agg = agregatBrokerRows([hari1, hari2])
    // NI total nilai 110 > YP 100 > CC 60 — rank nilai ikut total, bukan harian
    expect(agg.map((b) => [b.kode, b.vol, b.nilai, b.freq, b.rn])).toEqual([
      ['NI', 10, 110, 10, 1],
      ['YP', 10, 100, 5, 2],
      ['CC', 1, 60, 8, 3],
    ])
    // rank frekuensi: NI 10 > CC 8 > YP 5
    expect(agg.find((b) => b.kode === 'NI')?.rf).toBe(1)
    expect(agg.find((b) => b.kode === 'CC')?.rf).toBe(2)
    expect(agg.find((b) => b.kode === 'YP')?.rf).toBe(3)
  })

  it('tidak memutasi baris harian sumber (baris itu dicache per tanggal)', () => {
    agregatBrokerRows([hari1, hari2])
    expect(hari1[0].nilai).toBe(100)
    expect(hari2[0].nilai).toBe(70)
  })
})
