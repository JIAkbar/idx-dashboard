/**
 * Jembatan ke `lightweight-charts-drawing` (MIT, v0.1.1) — 68 alat gambar
 * (Garis, Channels, Pitchforks, Fibonacci, Gann, Forecasting, Shapes,
 * Annotations). Sudah diverifikasi Johan: `peerDependencies:
 * lightweight-charts ^5.0.0`, kita di 5.2.1.
 *
 * ------------------------------------------------------------------
 * IMPOR DINAMIS — SYARAT, BUKAN PILIHAN GAYA. Pola SAMA dengan
 * `katalogIndikator.ts`: berkas itu sudah menjelaskan kenapa (bundel 1,9 MB
 * yang tak bisa di-tree-shake begitu registrynya disentuh). Pustaka ini
 * 2,7 MB tak terpaket (dist), dan alasan yang sama berlaku — pembaca /grafik
 * yang tak pernah menyentuh bilah alat gambar tak boleh mengunduhnya.
 * **Jangan pernah menambahkan `import ... from 'lightweight-charts-drawing'`
 * statis di berkas mana pun.** Impor TIPE (`import type`) aman, terhapus saat
 * kompilasi — dipakai leluasa di `useAlatGambar.ts`.
 * ------------------------------------------------------------------
 */

/** Delapan alat UTAMA di bilah — dipilih dari 68, bukan menampilkan
 *  semuanya (68 baris tak bisa dipakai siapa pun). Alasan pemilihannya ada
 *  di `AlatGambar.tsx`. `type` di sini HARUS persis `readonly type` kelas
 *  pustaka (diverifikasi terhadap `dist/index.d.ts` saat menulis berkas
 *  ini) — dan sengaja ditulis sebagai STRING telanjang di sini, bukan
 *  dibaca dari pustaka, supaya bilah alat bisa dirender SEBELUM pustakanya
 *  dimuat (tombolnya harus tampak dari awal; klik pertamanya yang memicu
 *  unduhan). */
export interface AlatUtama {
  id: string
  label: string
  /** Jumlah titik yang diklik sebelum gambar selesai. `null` = kuas
   *  (freehand, jalur seret — lihat `useAlatGambar.ts`). */
  anchor: number | null
  /** Alat ini butuh teks dari pembaca (prompt) sesudah titiknya diklik. */
  butuhTeks?: boolean
}

export const ALAT_UTAMA: AlatUtama[] = [
  { id: 'trend-line', label: 'Garis Tren', anchor: 2 },
  { id: 'horizontal-line', label: 'Garis Horizontal', anchor: 1 },
  { id: 'vertical-line', label: 'Garis Vertikal', anchor: 1 },
  { id: 'fib-retracement', label: 'Fibonacci Retracement', anchor: 2 },
  { id: 'rectangle', label: 'Persegi', anchor: 2 },
  { id: 'text-annotation', label: 'Teks', anchor: 1, butuhTeks: true },
  { id: 'brush', label: 'Kuas', anchor: null },
]

/** Urutan & terjemahan kategori pustaka (`DrawingCategory`) untuk kelompok
 *  "Alat lainnya" — sama polanya dengan `KATEGORI` di `katalogIndikator.ts`:
 *  nama Inggrisnya MILIK pustaka (dicocokkan ke `entry.category`), yang kita
 *  tentukan cuma urutan tampil & terjemahan. Kategori pustaka yang tak
 *  terdaftar di sini tetap tampil (nama aslinya) — bukan lenyap dari menu. */
export const KATEGORI_GAMBAR: Array<[inggris: string, indonesia: string]> = [
  ['line', 'Garis'],
  ['channel', 'Channels'],
  ['pitchfork', 'Pitchforks'],
  ['fibonacci', 'Fibonacci'],
  ['gann', 'Gann'],
  ['forecasting', 'Forecasting'],
  ['measurement', 'Pengukuran'],
  ['shape', 'Bentuk'],
  ['annotation', 'Anotasi'],
  ['trading', 'Trading'],
]

/** Id alat yang sudah jadi tombol UTAMA — tak boleh dobel di dropdown
 *  "Alat lainnya" (pola sama dengan `ID_SUDAH_ADA` indikator). */
export const ID_ALAT_UTAMA = new Set(ALAT_UTAMA.map((a) => a.id))

let terpasang: Promise<typeof import('lightweight-charts-drawing')> | null = null

/**
 * Memuat pustaka SEKALI lalu memakai ulang janjinya. Dipicu saat pembaca
 * menyentuh bilah alat gambar (pointer/fokus — pola sama dengan
 * `muatKatalog`), bukan saat halaman /grafik dibuka.
 *
 * Berbeda dari `muatKatalog`: gagal muat di SINI melempar, bukan
 * mengembalikan nilai kosong. Katalog indikator kosong masih menyisakan
 * kanvas yang berguna (harga, volume, sepuluh kurasi PAPAN); tanpa pustaka
 * gambar, bilah alat gambar sama sekali tak punya apa pun untuk dilakukan —
 * lebih jujur menampilkan pesan galat daripada bilah yang tombolnya diam
 * saat diklik. Janjinya dilepas saat gagal supaya klik berikutnya benar-benar
 * mencoba lagi (mode privat yang jaringannya baru pulih, mis.).
 */
export function muatPustakaGambar(): Promise<typeof import('lightweight-charts-drawing')> {
  if (!terpasang) {
    terpasang = import('lightweight-charts-drawing').catch((e: unknown) => {
      terpasang = null
      throw e
    })
  }
  return terpasang
}
