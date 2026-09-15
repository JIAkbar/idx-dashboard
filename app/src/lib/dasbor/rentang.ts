import { RENTANG_BAKU, jendelaBaku, opsiRentangBaku, type KunciBaku } from './periode'

/**
 * Modul rentang BERSAMA (spek konsistensi §2) — dipakai halaman yang memotong
 * DERET ber-tanggal (candle/baris harian), bukan kosakata sendiri.
 *
 * Disatukan #209 (Johan 15 Sep 2026: "samakan semua mulai dari 1 hari, 5 hari
 * [dianggap 1 minggu], 2 minggu, 1 bulan, 3 bulan, 6 bulan, Year to Date, 1
 * tahun, 2 tahun" + opsi "Semua"). Sebelum ini modul punya kosakata SENDIRI
 * (`HARI_BURSA`, N baris bursa terakhir via `slice(-N)`) yang beda dari
 * `periode.ts` (N hari kalender mundur + snap ke hari berdata) — kata
 * "1 Bulan" berarti dua angka berbeda tergantung halaman. Sekarang berkas
 * ini cuma pembungkus tipis di atas `RENTANG_BAKU`/`jendelaBaku` (periode.ts):
 * SATU daftar, SATU hitungan, dipakai lewat fungsi potong deret di sini.
 *
 * `HARI_BURSA` DIPERTAHANKAN untuk `StalkerTab.tsx` — jendela `y3`/`y5`/`y10`
 * di sana di luar daftar baku #209 (perhitungan Broker Stalker, bukan
 * pemilih rentang mundur biasa) dan perilakunya tak boleh berubah. Halaman
 * lain (Neo Transaksi/Inventory, Watchlist) tak lagi memakainya.
 */

export type IdRentang = KunciBaku | 'semua'

export const HARI_BURSA: Record<'w1' | 'w2' | 'b1' | 'b3' | 'b6' | 'y1' | 'y2' | 'y3' | 'y5' | 'y10', number> = {
  w1: 5, w2: 10, b1: 21, b3: 63, b6: 126, y1: 252, y2: 504, y3: 756, y5: 1260, y10: 2520,
}

/**
 * Susun opsi BAKU (#209) dari tanggal NYATA — SELALU seluruh `RENTANG_BAKU` +
 * Semua (lewat `opsiRentangBaku`); opsi yang `jendelaBaku` tak sanggup isi
 * (data kurang) tampil nonaktif, bukan disembunyikan atau disaring dari
 * hitungan baris kasar seperti versi lama.
 *
 * KOREKSI 15 Sep 2026 (Johan lewat pengawas — "boleh nonaktif HANYA kalau
 * datanya tidak cukup, bukan karena dulu tidak ada di daftar halaman itu"):
 * "Semua" DULU digerbang ambang 2 tahun ("aktif hanya kalau riwayatnya lebih
 * dari 2 tahun") — ambang itu dicabut. Sekarang `semua` diuji SAMA seperti
 * kunci lain: `jendelaBaku(tanggal, akhir, 'semua')` — yang cuma `null` kalau
 * datanya betul-betul kosong (tak ada hari berdata pada/sebelum `akhir`),
 * bukan kalau riwayatnya "cuma" pendek. Riwayat 5 hari tetap sah menampilkan
 * "Semua" (lima hari itu) — itu bukan kekurangan data, itu memang semuanya.
 *
 * `tanggal` = tanggal berdata baris (urut naik, ISO); `akhir` = tanggal
 * baris terakhir yang berlaku (biasanya `tanggal[tanggal.length-1]`).
 */
export function opsiRentang(tanggal: readonly string[], akhir: string) {
  const peta: Partial<Record<KunciBaku | 'semua', IdRentang>> = {}
  for (const k of [...RENTANG_BAKU, 'semua'] as const) {
    if (jendelaBaku(tanggal, akhir, k)) peta[k] = k
  }
  return opsiRentangBaku(peta)
}

/**
 * Potong deret ber-tanggal ISO (urut naik) ke jendela BAKU (#209 Q1,
 * `jendelaBaku` di periode.ts) — mundur hari KALENDER dari tanggal baris
 * TERAKHIR, bukan hitung N baris tetap seperti sebelumnya (bug lama: "1
 * Bulan" di sini dan "1 Bulan" di BilahTanggal artinya angka berbeda hari).
 * `semua` dan data yang tak cukup untuk `id` mengembalikan apa adanya —
 * opsi yang datanya tak cukup sudah tampil nonaktif lewat `opsiRentang`
 * di atas, jadi seharusnya tak pernah dipilih dalam keadaan itu.
 */
export function potongRentang<T>(
  rows: readonly T[],
  id: IdRentang,
  tanggal: (r: T) => string = (r) => (r as { tanggal: string }).tanggal,
): T[] {
  if (id === 'semua' || rows.length === 0) return [...rows]
  const tgl = rows.map(tanggal)
  const j = jendelaBaku(tgl, tgl[tgl.length - 1], id)
  if (!j) return [...rows]
  return rows.filter((r) => tanggal(r) >= j.mulai)
}

/**
 * Sama dengan `potongRentang`, tetapi baris HARI PEMBANDING ikut di depan —
 * untuk deret yang dibaca sebagai return/indeks (titik pertama = dasar 100),
 * supaya total return = tutup terakhir lawan tutup pembanding (J20).
 */
export function potongDenganPembanding<T>(
  rows: readonly T[],
  id: IdRentang,
  tanggal: (r: T) => string = (r) => (r as { tanggal: string }).tanggal,
): T[] {
  if (id === 'semua' || rows.length === 0) return [...rows]
  const tgl = rows.map(tanggal)
  const j = jendelaBaku(tgl, tgl[tgl.length - 1], id)
  if (!j) return [...rows]
  const awal = j.pembanding ?? j.mulai
  return rows.filter((r) => tanggal(r) >= awal)
}

/**
 * Caption rentang SEBENARNYA — wajib menyertai preset apa pun. Kalau hasil
 * potongan lebih pendek dari yang diminta, itu terlihat sendiri dari n-nya;
 * pemanggil boleh menambah "(diminta X, arsip hanya Y)" pola Seasonality.
 */
export function captionRentang<T>(
  rows: T[],
  tanggal: (r: T) => string = (r) => (r as { tanggal: string }).tanggal,
): string {
  if (rows.length === 0) return 'tak ada data di rentang ini'
  return `${tanggal(rows[0])} → ${tanggal(rows[rows.length - 1])} · ${rows.length.toLocaleString('id-ID')} hari bursa`
}
