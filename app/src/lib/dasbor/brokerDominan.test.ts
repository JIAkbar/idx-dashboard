import { describe, it, expect } from 'vitest'
import {
  RENTANG_DOMINAN, hitungDominan, mulaiRentang, type HariRingkas,
} from './brokerDominan'

/** [kode, beli_lot, beli_nilai, jual_lot, jual_nilai] — urutan arsipnya. */
function h(tanggal: string, ...baris: HariRingkas['broker']): HariRingkas {
  return { tanggal, broker: baris }
}

describe('mulaiRentang', () => {
  const deret = [
    h('2026-06-01'), h('2026-07-01'), h('2026-08-05'),
    h('2026-08-31'), h('2026-09-04'),
  ]

  it('1 Bulan mundur 30 hari kalender lalu snap ke hari BERDATA', () => {
    // 4 Sep − 30 hari = 5 Agu, dan 5 Agu kebetulan ada.
    expect(mulaiRentang(deret, 'b1')).toBe('2026-08-05')
  })

  it('target yang jatuh di hari tanpa data maju ke hari berdata berikutnya', () => {
    // 4 Sep − 7 = 28 Agu; hari berdata pertama ≥ 28 Agu adalah 31 Agu.
    expect(mulaiRentang(deret, 'w1')).toBe('2026-08-31')
  })

  it('riwayat lebih pendek daripada presetnya jatuh ke hari pertama, bukan kosong', () => {
    expect(mulaiRentang(deret, 'b6')).toBe('2026-06-01')
  })

  it('deret kosong tidak melempar', () => {
    expect(mulaiRentang([], 'b1')).toBe('')
  })
})

describe('hitungDominan', () => {
  // Dua hari, tiga broker. Angkanya dipilih supaya rata-rata bulat.
  const deret: HariRingkas[] = [
    h('2026-09-03',
      ['AK', 100, 100_000_000, 0, 0],          // beli 100 lot @ 10.000/lembar
      ['XL', 0, 0, 50, 60_000_000],            // jual  50 lot @ 12.000/lembar
      ['PD', 10, 12_000_000, 10, 11_000_000]), // net beli kecil
    h('2026-09-04',
      ['AK', 100, 140_000_000, 0, 0],          // beli 100 lot @ 14.000/lembar
      ['XL', 0, 0, 50, 60_000_000]),
  ]

  it('sisi beli & jual dipisah menurut NET, bukan menurut nilai kotor', () => {
    const r = hitungDominan(deret, 'b1', 13_000)!
    expect(r.beli.map((b) => b.kode)).toEqual(['AK', 'PD'])
    expect(r.jual.map((b) => b.kode)).toEqual(['XL'])
  })

  it('rata-rata dihitung dari sisi DOMINAN, bukan dari campuran beli+jual', () => {
    const r = hitungDominan(deret, 'b1', 13_000)!
    // AK: 240 jt ÷ (200 lot × 100 lembar) = 12.000
    expect(r.beli[0].avg).toBeCloseTo(12_000, 6)
    // XL: 120 jt ÷ (100 lot × 100) = 12.000
    expect(r.jual[0].avg).toBeCloseTo(12_000, 6)
  })

  it('estimasi penjual BERLAWANAN tanda dengan pembeli pada harga yang sama', () => {
    // Keduanya rata-rata 12.000, penutupan 13.000. Pembeli untung ~8,33%;
    // penjual justru melepas sebelum naik, jadi tandanya negatif. Satu rumus
    // untuk dua sisi akan mengecat penjual sebagai untung.
    const r = hitungDominan(deret, 'b1', 13_000)!
    expect(r.beli[0].estimasi).toBeCloseTo(1 / 12, 6)
    expect(r.jual[0].estimasi).toBeCloseTo(-1 / 12, 6)
  })

  it('tanpa penutupan, estimasi null — bukan nol', () => {
    const r = hitungDominan(deret, 'b1', null)!
    expect(r.beli[0].estimasi).toBeNull()
  })

  it('penyebut dominasi adalah Σ nilai beli SELURUH broker di rentang', () => {
    const r = hitungDominan(deret, 'b1', 13_000)!
    // Σ beli = 100 + 140 + 12 = 252 juta.
    expect(r.totalNilai).toBe(252_000_000)
    expect(r.beli[0].dominasi).toBeCloseTo(240_000_000 / 252_000_000, 9)
    // Jumlah dominasi TIDAK 100%: itu tandanya penyebutnya bukan yang terpilih.
    const jumlah = [...r.beli, ...r.jual].reduce((s, b) => s + (b.dominasi ?? 0), 0)
    expect(jumlah).not.toBeCloseTo(1, 3)
  })

  it('rentang memotong hari, bukan cuma melabelinya', () => {
    const panjang: HariRingkas[] = [
      h('2026-01-05', ['ZZ', 999, 999_000_000, 0, 0]),
      ...deret,
    ]
    const r = hitungDominan(panjang, 'w1', 13_000)!
    expect(r.nHari).toBe(2)
    expect(r.beli.map((b) => b.kode)).not.toContain('ZZ')
  })

  it('deret kosong mengembalikan null, bukan hasil bernilai nol', () => {
    expect(hitungDominan([], 'b1', 100)).toBeNull()
  })
})

describe('rentang baru & kalender (#95)', () => {
  // Deret sengaja melintasi pergantian tahun: "Sejak 1 Jan" hanya benar
  // kalau ia memotong di Januari tahun AKHIR, bukan 365 hari mundur.
  const lintasTahun = [
    h('2025-12-29'), h('2025-12-30'), h('2026-01-05'),
    h('2026-02-02'), h('2026-03-02'),
  ]

  it('hariIni = satu hari bursa terakhir, bukan nol hari', () => {
    expect(mulaiRentang(lintasTahun, 'hariIni')).toBe('2026-03-02')
  })

  it('sejakJan memotong di Januari tahun AKHIR, bukan 365 hari mundur', () => {
    expect(mulaiRentang(lintasTahun, 'sejakJan')).toBe('2026-01-05')
    // 365 hari mundur dari 2026-03-02 menyeret dua hari Desember 2025 ikut —
    // tahun lain, dan angkanya jadi bukan 'sejak 1 Januari'.
    expect(mulaiRentang(lintasTahun, 'y1')).toBe('2025-12-29')
  })

  it('rentang kalender MENGGANTIKAN preset, bukan menyaringnya', () => {
    const hasil = hitungDominan(lintasTahun, 'b1', null, 7,
      { dari: '2025-12-30', sampai: '2026-01-05' })!
    expect([hasil.mulai, hasil.akhir, hasil.nHari])
      .toEqual(['2025-12-30', '2026-01-05', 2])
  })

  it('rentang yang jatuh di hari tanpa data = null, bukan tabel kosong', () => {
    // Libur panjang atau arsip yang belum sampai situ: keadaan sah yang
    // harus terbaca "belum ada data", bukan tabel nol baris.
    expect(hitungDominan(lintasTahun, 'b1', null, 7,
      { dari: '2026-01-10', sampai: '2026-01-20' })).toBeNull()
  })

  it('daftar pil: tujuh, urut pendek ke panjang, sejakJan dieja YTD', () => {
    expect(RENTANG_DOMINAN.map((o) => o.id)).toEqual(
      ['hariIni', 'w1', 'b1', 'b3', 'b6', 'sejakJan', 'y1'])
    // Dibalik 9 Sep 2026 (#114 A): pil ini dieja "YTD". Kunci `sejakJan`
    // sengaja TIDAK ikut berganti — yang berubah cuma katanya di layar.
    expect(RENTANG_DOMINAN.map((o) => o.label)).toContain('YTD')
    expect(RENTANG_DOMINAN.map((o) => o.label)).not.toContain('Sejak 1 Jan')
  })
})
