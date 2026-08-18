import { describe, it, expect } from 'vitest'
import {
  peluangTersusut, selangWilson, ujiPermutasi, ringkasEmiten, ALFA,
  ringkasHarian, hariBursaDiRentang, rentangSumbuBalapan,
} from './seasonality'

describe('peluangTersusut', () => {
  it('menarik sampel tipis ke peluang dasar', () => {
    // 4 dari 5 = 80% mentah. Dengan dasar 50%, harus turun jauh — inilah
    // koreksi yang tidak dilakukan tabel seasonality biasa.
    const p = peluangTersusut(4, 5, 50)
    expect(p).toBeGreaterThan(50)
    expect(p).toBeLessThan(70)
  })

  it('nyaris tidak menggeser sampel tebal', () => {
    // 60 dari 100 dengan dasar 50: bobot α=6 kecil dibanding n=100.
    const p = peluangTersusut(60, 100, 50)
    expect(p).toBeGreaterThan(58)
    expect(p).toBeLessThan(60)
  })

  it('tanpa data sama sekali, jatuh ke peluang dasar', () => {
    expect(peluangTersusut(0, 0, 42)).toBe(42)
  })

  it('bobotnya persis α pengamatan bayangan', () => {
    // Rumusnya (naik + α·p₀)/(n + α): dengan naik=0, n=0 ekuivalen p₀.
    expect(peluangTersusut(ALFA, ALFA, 0)).toBeCloseTo(50, 6)
  })
})

describe('selangWilson', () => {
  it('5 dari 5 TIDAK menghasilkan "pasti 100%"', () => {
    const [bawah, atas] = selangWilson(5, 5)
    expect(atas).toBe(100)
    expect(bawah).toBeGreaterThan(50)
    expect(bawah).toBeLessThan(70)
  })

  it('sampel tebal memberi selang yang sempit', () => {
    const [b1, a1] = selangWilson(5, 10)
    const [b2, a2] = selangWilson(50, 100)
    expect(a1 - b1).toBeGreaterThan(a2 - b2)
  })

  it('selalu memuat proporsi mentahnya', () => {
    for (const [naik, n] of [[1, 3], [7, 9], [13, 40]] as const) {
      const [bawah, atas] = selangWilson(naik, n)
      const p = (naik / n) * 100
      expect(p).toBeGreaterThanOrEqual(bawah - 1e-9)
      expect(p).toBeLessThanOrEqual(atas + 1e-9)
    }
  })
})

describe('ujiPermutasi', () => {
  it('menolak data yang terlalu pendek', () => {
    const pendek = Array.from({ length: 20 }, (_, i) => ({ bulan: (i % 12) + 1, persen: i }))
    expect(ujiPermutasi(pendek)).toBeNull()
  })

  it('hasilnya sama persis tiap kali dipanggil (berbenih)', () => {
    const data = Array.from({ length: 120 }, (_, i) => ({
      bulan: (i % 12) + 1,
      persen: Math.sin(i) * 10,
    }))
    const a = ujiPermutasi(data, 300)
    const b = ujiPermutasi(data, 300)
    expect(a).toEqual(b)
  })

  it('pola yang ditanam terdeteksi tidak acak', () => {
    // Juni (bulan 6) selalu naik, sisanya berselang-seling.
    const data: Array<{ bulan: number; persen: number }> = []
    for (let t = 0; t < 15; t++) {
      for (let b = 1; b <= 12; b++) {
        data.push({ bulan: b, persen: b === 6 ? 5 : (t + b) % 2 ? 3 : -3 })
      }
    }
    const hasil = ujiPermutasi(data, 500)!
    expect(hasil.bulanJuara).toBe(6)
    expect(hasil.pValue).toBeLessThan(0.05)
  })

  it('p-value tidak pernah nol — 2.000 percobaan bukan bukti kemustahilan', () => {
    const data: Array<{ bulan: number; persen: number }> = []
    for (let t = 0; t < 20; t++) {
      for (let b = 1; b <= 12; b++) data.push({ bulan: b, persen: b === 3 ? 9 : -9 })
    }
    const hasil = ujiPermutasi(data, 200)!
    expect(hasil.pValue).toBeGreaterThan(0)
  })
})

describe('ringkasEmiten', () => {
  const seri = {
    '2020-01': 5, '2020-02': -3, '2020-06': 8,
    '2021-01': -2, '2021-02': 4, '2021-06': 10,
    '2022-01': 6, '2022-02': -1, '2022-06': -5,
  }

  it('mengelompokkan per bulan kalender', () => {
    const r = ringkasEmiten('TEST', seri)!
    const jan = r.perBulan[0]
    expect(jan.n).toBe(3)
    expect(jan.naik).toBe(2)
    expect(jan.mentah).toBeCloseTo(66.67, 1)
  })

  it('pembanding pasar hanya menghitung bulan yang IHSG-nya ada', () => {
    // IHSG cuma punya dua dari tiga Januari — penyebutnya harus 2, bukan 3.
    const r = ringkasEmiten('TEST', seri, { '2020-01': 1, '2021-01': 1 })!
    const jan = r.perBulan[0]
    expect(jan.unggulDari).toBe(2)
    expect(jan.unggul).toBe(1) // 2020 (+5 > +1) menang, 2021 (-2) kalah
  })

  it('bulan tanpa data tidak mengarang angka', () => {
    const r = ringkasEmiten('TEST', seri)!
    const mar = r.perBulan[2]
    expect(mar.n).toBe(0)
    expect(mar.nilai).toEqual([])
    // Tersusut jatuh ke peluang dasar, bukan nol — nol terbaca sebagai
    // "tidak pernah naik", padahal yang benar "belum pernah tercatat".
    expect(mar.tersusut).toBeCloseTo(r.dasar, 6)
  })

  it('menyaring tahun awal', () => {
    const r = ringkasEmiten('TEST', seri, {}, 2022)!
    expect(r.totalObservasi).toBe(3)
    expect(r.mulai).toBe('2022-01')
  })

  it('seri kosong mengembalikan null, bukan objek palsu', () => {
    expect(ringkasEmiten('KOSONG', {})).toBeNull()
  })
})

describe('ringkasHarian', () => {
  // 2024-01-01 = Senin. Tiga pekan penuh Senin–Jumat, 15 hari bursa.
  const tanggal = [
    '2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05',
    '2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12',
    '2024-01-15', '2024-01-16', '2024-01-17', '2024-01-18', '2024-01-19',
  ]
  const tutup = Object.fromEntries(tanggal.map((t, i) => [t, 100 + i]))

  it('tanpa batas atas berperilaku sama seperti sebelumnya (kompatibel mundur)', () => {
    const r = ringkasHarian('T', tutup, '2024-01-08')!
    // mulai = tanggal diff PERTAMA (hari kedua di rentang) — hari pertama
    // dipakai sebagai basis, belum punya persen perubahan sendiri.
    expect(r.mulai).toBe('2024-01-09')
    expect(r.akhir).toBe('2024-01-19')
    expect(r.totalObservasi).toBe(9) // 10 hari di rentang - 1 diff pertama
  })

  it('batas atas memotong data, tidak menariknya sampai akhir', () => {
    const r = ringkasHarian('T', tutup, '', '2024-01-10')!
    expect(r.akhir).toBe('2024-01-10')
    expect(r.mulai).toBe('2024-01-02') // diff pertama jatuh di hari kedua
    expect(r.totalObservasi).toBe(7) // 8 hari (01-08..10) - 1
  })

  it('batas bawah dan atas dipakai bersamaan', () => {
    const r = ringkasHarian('T', tutup, '2024-01-08', '2024-01-12')!
    expect(r.mulai).toBe('2024-01-09')
    expect(r.akhir).toBe('2024-01-12')
    expect(r.totalObservasi).toBe(4) // 5 hari bursa - 1
  })
})

describe('hariBursaDiRentang', () => {
  const tanggal = [
    '2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05',
    '2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12',
  ]
  const tutup = Object.fromEntries(tanggal.map((t, i) => [t, 100 + i]))

  it('menghitung hari bursa yang benar-benar ada datanya, bukan selisih kalender', () => {
    // 01-05 (Jum) → 01-08 (Sen): 4 hari kalender lompat akhir pekan, tapi
    // cuma 2 hari bursa yang punya data di rentang itu.
    expect(hariBursaDiRentang(tutup, '2024-01-05', '2024-01-08')).toBe(2)
  })

  it('rentang penuh seminggu = 5, pas di ambang minimum', () => {
    expect(hariBursaDiRentang(tutup, '2024-01-08', '2024-01-12')).toBe(5)
  })

  it('batas kosong berarti tak dibatasi', () => {
    expect(hariBursaDiRentang(tutup)).toBe(tanggal.length)
  })
})

describe('rentangSumbuBalapan', () => {
  // Lima hari, nilai akhir jauh berbeda — Jumat (indeks 4) yang paling
  // ekstrem, mendominasi skala kalau semua dihitung.
  const jejak = [
    { nilai: [0, 0, 0, 0, 0] },
    { nilai: [5, -2, 1, 3, 40] },
    { nilai: [8, -6, 2, 5, 90] },
  ]

  it('tanpa yang disembunyikan, rentang ditarik oleh hari paling ekstrem', () => {
    const { min, maks } = rentangSumbuBalapan(jejak, new Set())
    expect(maks).toBe(90) // Jumat
    expect(min).toBe(-6) // Selasa, dan tetap turun ke 0 kalau positif
  })

  it('menyembunyikan hari paling ekstrem MELEBARKAN sumbu untuk sisanya', () => {
    // #182: ini bukti utama fitur — sembunyikan Jumat, skala harus menciut
    // ke rentang hari-hari yang tersisa, bukan tetap terentang oleh Jumat
    // yang sudah tak tergambar.
    const { min, maks } = rentangSumbuBalapan(jejak, new Set([4]))
    expect(maks).toBe(8) // Senin, tanpa Jumat
    expect(min).toBe(-6) // Selasa tetap paling rendah
    expect(maks).toBeLessThan(90)
  })

  it('kalau semua hari (secara keliru) disembunyikan, jatuh balik ke seluruhnya — sumbu tak pernah kolaps', () => {
    const kosong = rentangSumbuBalapan(jejak, new Set([0, 1, 2, 3, 4]))
    const penuh = rentangSumbuBalapan(jejak, new Set())
    expect(kosong).toEqual(penuh)
  })
})
