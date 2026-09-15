import { describe, it, expect } from 'vitest'
import { hitungDominan, type HariRingkas } from './brokerDominan'

/** [kode, beli_lot, beli_nilai, jual_lot, jual_nilai] — urutan arsipnya. */
function h(tanggal: string, ...baris: HariRingkas['broker']): HariRingkas {
  return { tanggal, broker: baris }
}

// `mulaiRentang` (snap preset ketikan sendiri) dan `RENTANG_DOMINAN` (daftar
// pil statis) sudah dicabut #209 tahap 2 — keduanya diganti `rentangBaku`
// dari `periode.ts`, yang sudah diuji sendiri (`periode.test.ts`). Yang masih
// perlu diuji DI SINI cuma perilaku `hitungDominan` yang khas berkas ini:
// pemotongan hari, matematika sisi dominan, dan kalender vs preset.

describe('hitungDominan', () => {
  // Dua hari, tiga broker. Angkanya dipilih supaya rata-rata bulat. Preset
  // rentang dilewati lewat `kustom` di tes-tes ini — yang diuji di sini
  // matematika sisi dominan, bukan pemilihan jendela tanggal (itu milik
  // `rentangBaku`/`jendelaBaku`, `periode.test.ts`).
  const deret: HariRingkas[] = [
    h('2026-09-03',
      ['AK', 100, 100_000_000, 0, 0],          // beli 100 lot @ 10.000/lembar
      ['XL', 0, 0, 50, 60_000_000],            // jual  50 lot @ 12.000/lembar
      ['PD', 10, 12_000_000, 10, 11_000_000]), // net beli kecil
    h('2026-09-04',
      ['AK', 100, 140_000_000, 0, 0],          // beli 100 lot @ 14.000/lembar
      ['XL', 0, 0, 50, 60_000_000]),
  ]
  const duaHari = { dari: '2026-09-03', sampai: '2026-09-04' }

  it('sisi beli & jual dipisah menurut NET, bukan menurut nilai kotor', () => {
    const r = hitungDominan(deret, 'b1', 13_000, 7, duaHari)!
    expect(r.beli.map((b) => b.kode)).toEqual(['AK', 'PD'])
    expect(r.jual.map((b) => b.kode)).toEqual(['XL'])
  })

  it('rata-rata dihitung dari sisi DOMINAN, bukan dari campuran beli+jual', () => {
    const r = hitungDominan(deret, 'b1', 13_000, 7, duaHari)!
    // AK: 240 jt ÷ (200 lot × 100 lembar) = 12.000
    expect(r.beli[0].avg).toBeCloseTo(12_000, 6)
    // XL: 120 jt ÷ (100 lot × 100) = 12.000
    expect(r.jual[0].avg).toBeCloseTo(12_000, 6)
  })

  it('estimasi penjual BERLAWANAN tanda dengan pembeli pada harga yang sama', () => {
    // Keduanya rata-rata 12.000, penutupan 13.000. Pembeli untung ~8,33%;
    // penjual justru melepas sebelum naik, jadi tandanya negatif. Satu rumus
    // untuk dua sisi akan mengecat penjual sebagai untung.
    const r = hitungDominan(deret, 'b1', 13_000, 7, duaHari)!
    expect(r.beli[0].estimasi).toBeCloseTo(1 / 12, 6)
    expect(r.jual[0].estimasi).toBeCloseTo(-1 / 12, 6)
  })

  it('tanpa penutupan, estimasi null — bukan nol', () => {
    const r = hitungDominan(deret, 'b1', null, 7, duaHari)!
    expect(r.beli[0].estimasi).toBeNull()
  })

  it('penyebut dominasi adalah Σ nilai beli SELURUH broker di rentang', () => {
    const r = hitungDominan(deret, 'b1', 13_000, 7, duaHari)!
    // Σ beli = 100 + 140 + 12 = 252 juta.
    expect(r.totalNilai).toBe(252_000_000)
    expect(r.beli[0].dominasi).toBeCloseTo(240_000_000 / 252_000_000, 9)
    // Jumlah dominasi TIDAK 100%: itu tandanya penyebutnya bukan yang terpilih.
    const jumlah = [...r.beli, ...r.jual].reduce((s, b) => s + (b.dominasi ?? 0), 0)
    expect(jumlah).not.toBeCloseTo(1, 3)
  })

  it('rentang memotong hari via preset — 1 Minggu (w1) tak menyeret ZZ dari Januari', () => {
    // Ini SATU-SATUNYA tes di berkas ini yang lewat preset (bukan kustom),
    // dan sengaja: `rentangBaku` butuh hari BERDATA sebelum batas jendela
    // sebagai pembanding — 2026-01-05 di sini berperan itu, jadi 'w1' tetap
    // menghasilkan jendela 09-03..09-04, sama seperti versi lama sebelum
    // #209 tahap 2 (tak ada pergeseran angka untuk kasus ini).
    const panjang: HariRingkas[] = [
      h('2026-01-05', ['ZZ', 999, 999_000_000, 0, 0]),
      ...deret,
    ]
    const r = hitungDominan(panjang, 'w1', 13_000)!
    expect(r.nHari).toBe(2)
    expect(r.beli.map((b) => b.kode)).not.toContain('ZZ')
  })

  it('preset tanpa hari pembanding sebelum jendela — null, bukan dijepit ke hari pertama (#209 tahap 2, beda dari mulaiRentang lama)', () => {
    // `deret` cuma punya 09-03/09-04, tak ada hari sebelum batas 'b1' (30 hari
    // ke belakang) — mulaiRentang LAMA dulu diam-diam jatuh ke 09-03 (hari
    // pertama yang ada); rentangBaku sekarang menolaknya (null), dan
    // hitungDominan meneruskannya sebagai null — bukan dua hari yang
    // terbaca seolah representasi "1 Bulan" penuh.
    expect(hitungDominan(deret, 'b1', 13_000)).toBeNull()
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

  // 'hariIni'/'sejakJan'/'y1' lewat jendela preset sudah diuji langsung atas
  // `rentangBaku`/`jendelaBaku` di `periode.test.ts` (kunci baku `h1`/
  // `sejakJan`/`y1`) — tak diulang di sini supaya definisinya tetap SATU
  // tempat, bukan dua salinan yang bisa menyimpang.

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

  // Daftar pil (dulu `RENTANG_DOMINAN` statis di berkas ini) sekarang
  // dibangun `opsiRentangBaku` di `PanelBrokerDominan.tsx`, dari `hari`
  // (data) — bentuknya generik dan sudah diuji `periode.test.ts`
  // (`opsiRentangBaku (#209)`); MTD dibuang dari daftar baku (Johan 15 Sep
  // 2026), jadi tak ada lagi yang sepadan untuk diuji ulang di sini.
})
