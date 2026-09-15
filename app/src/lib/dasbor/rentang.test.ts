import { describe, expect, it } from 'vitest'
import { captionRentang, HARI_BURSA, opsiRentang, potongRentang, potongDenganPembanding } from './rentang'

const hari = (n: number, mulai = 2020): { tanggal: string }[] => {
  const keluar: { tanggal: string }[] = []
  const d = new Date(Date.UTC(mulai, 0, 1))
  while (keluar.length < n) {
    const day = d.getUTCDay()
    if (day !== 0 && day !== 6) keluar.push({ tanggal: d.toISOString().slice(0, 10) })
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return keluar
}

describe('opsiRentang (#209 — daftar baku dari tanggal NYATA)', () => {
  // opsiRentangBaku (periode.ts) memberi opsi nonaktif id SINTETIS (`__y2`,
  // bukan `y2`) — "tak pernah bisa dipilih, jadi tak pernah sampai ke state
  // halaman". Jadi opsi dicari lewat LABEL (tetap sama aktif/nonaktif),
  // bukan id, kalau maksudnya memang mengecek statusnya.
  it('opsi panjang NONAKTIF (bukan hilang) saat data pendek', () => {
    const rows = hari(300)
    const opsi = opsiRentang(rows.map((r) => r.tanggal), rows[rows.length - 1].tanggal)
    const y1 = opsi.find((o) => o.label === '1 Tahun')
    const y2 = opsi.find((o) => o.label === '2 Tahun')
    // 300 hari kerja ~14 bulan kalender: y1 (1 tahun) masih cukup, y2 tidak.
    expect(y1?.nonaktif).toBeFalsy()
    expect(y1?.id).toBe('y1')
    expect(y2?.nonaktif).toBe(true)
    expect(y2?.id).toBe('__y2')
    expect(opsi).toHaveLength(10) // RENTANG_BAKU (9) + semua — SELALU sepuluh.
  })
  // KOREKSI 15 Sep 2026: ambang "2 tahun" untuk Semua DICABUT — nonaktif
  // cuma kalau datanya betul-betul kosong, bukan "cuma" pendek (riwayat 5
  // hari tetap sah menampilkan Semua lima hari itu).
  it('"Semua" aktif walau riwayatnya pendek — bukan lagi digerbang 2 tahun', () => {
    const pendek = hari(300)
    const opsiPendek = opsiRentang(pendek.map((r) => r.tanggal), pendek[pendek.length - 1].tanggal)
    const semuaPendek = opsiPendek.find((o) => o.label === 'Semua')
    expect(semuaPendek?.nonaktif).toBeFalsy()
    expect(semuaPendek?.id).toBe('semua')
  })
  it('"Semua" nonaktif hanya kalau datanya kosong', () => {
    const opsiKosong = opsiRentang([], '')
    const semuaKosong = opsiKosong.find((o) => o.label === 'Semua')
    expect(semuaKosong?.nonaktif).toBe(true)
    expect(semuaKosong?.id).toBe('__semua')
  })
  it('urutan tetap URUTAN_PIL baku (h1..y2, semua di ujung)', () => {
    const rows = hari(4 * 252)
    const opsi = opsiRentang(rows.map((r) => r.tanggal), rows[rows.length - 1].tanggal)
    expect(opsi.map((o) => o.id)).toEqual(['h1', 'w1', 'w2', 'b1', 'b3', 'b6', 'sejakJan', 'y1', 'y2', 'semua'])
  })
})

describe('potongRentang (#209 — jendelaBaku, bukan slice(-N) hari bursa)', () => {
  it('b3 = jendela ±3 bulan KALENDER mundur dari baris terakhir, bukan 63 baris tetap', () => {
    const rows = hari(300)
    const potong = potongRentang(rows, 'b3')
    // Batas bawah harus berada di sekitar 91 hari kalender sebelum baris
    // terakhir — bukan persis HARI_BURSA.b3 (63) baris seperti definisi lama.
    expect(potong.length).toBeGreaterThan(0)
    expect(potong.length).toBeLessThan(rows.length)
    expect(potong[potong.length - 1].tanggal).toBe(rows[rows.length - 1].tanggal)
  })
  it('sejakJan (YTD) dari 1 Jan tahun baris TERAKHIR, bukan tahun berjalan', () => {
    const rows = hari(300, 2024) // menyeberang ke 2025
    const potong = potongRentang(rows, 'sejakJan')
    const thAkhir = rows[rows.length - 1].tanggal.slice(0, 4)
    expect(potong.every((r) => r.tanggal.startsWith(thAkhir))).toBe(true)
    expect(potong.length).toBeGreaterThan(0)
    expect(potong.length).toBeLessThan(rows.length)
  })
  it('semua & data yang tak cukup untuk id: apa adanya, tanpa melempar', () => {
    expect(potongRentang(hari(10), 'semua')).toHaveLength(10)
    expect(potongRentang(hari(10), 'y1')).toHaveLength(10) // 10 hari jauh < 1 tahun
    expect(potongRentang([], 'b1')).toHaveLength(0)
  })
})

describe('HARI_BURSA (dipertahankan untuk StalkerTab.tsx)', () => {
  it('masih punya b3/y1/y3/y5/y10 — jendela Broker Stalker di luar daftar baku', () => {
    expect(HARI_BURSA.b3).toBe(63)
    expect(HARI_BURSA.y1).toBe(252)
    expect(HARI_BURSA.y3).toBe(756)
    expect(HARI_BURSA.y5).toBe(1260)
    expect(HARI_BURSA.y10).toBe(2520)
  })
})

describe('captionRentang', () => {
  it('tanggal nyata + jumlah hari bursa', () => {
    const rows = hari(60)
    const c = captionRentang(rows)
    expect(c).toContain(rows[0].tanggal)
    expect(c).toContain(rows[59].tanggal)
    expect(c).toContain('60 hari bursa')
  })
  it('kosong dikatakan, bukan dikosongkan', () => {
    expect(captionRentang([])).toMatch(/tak ada data/)
  })
})

describe('potongDenganPembanding (#209, sanggahan pemeriksa)', () => {
  const T = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-14', '2026-09-15']
  it('1 Minggu dari Selasa: baris pembanding 8 Sep ikut di depan jendela 9-15 Sep', () => {
    expect(potongDenganPembanding(T, 'w1', (t) => t)).toEqual(['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-14', '2026-09-15'])
  })
  it('1 Hari: pembanding + hari aktif, jadi return tidak pernah 0% karena satu titik', () => {
    expect(potongDenganPembanding(T, 'h1', (t) => t)).toEqual(['2026-09-14', '2026-09-15'])
  })
  it('Semua: apa adanya', () => {
    expect(potongDenganPembanding(T, 'semua', (t) => t)).toEqual(T)
  })
})
