/**
 * Alamat data statis untuk lingkungan saat ini.
 *
 * Sejak A2 (#176, 13 Sep 2026) SELURUH `/data-idx/` dan `/arus-pasar/` di
 * produksi diambil dari GitHub Pages, yang menyajikan repo yang sama. Build
 * Vercel tak lagi menyalin data (`app/scripts/copy-static-data.mjs`): sebelum
 * A2 tiap build menyalin sekitar 800 MB data (hasil build lokal 13 Sep 2026:
 * `app/dist` 804 MB, 800 MB di antaranya data), dan tiap commit panen memicu
 * build itu. A1 (#175) lebih dulu membungkus tiap alamat data dengan fungsi
 * ini, jadi pemindahan cukup mengubah aturan di bawah.
 *
 * Riwayat singkat: 2 Sep 2026 `broker_tahunan` dipindah ke Pages lebih dulu
 * (2.161 MB, 74% ukuran deployment), 9 Sep 2026 `kabar.json` dan `snips.json`
 * (dipanen tiap dua jam tanpa memicu build).
 *
 * DEV tetap memakai jalur relatif: `vite.config.ts` menyajikan data repo apa
 * adanya, jadi localhost tak bergantung pada jaringan.
 *
 * ATURAN RILIS (#176 butir 6): berkas atau ruas data baru terbit di Pages
 * dulu (commit data, tunggu build Pages selesai), baru kode yang membacanya
 * di-push. Urutan terbalik membuat halaman meminta berkas yang belum ada.
 *
 * Membatalkan A2: kosongkan `BASE_DATA_LUAR` DAN kembalikan penyalinan di
 * copy-static-data.mjs. Keduanya harus berubah bersama.
 */
const BASE_DATA_LUAR = 'https://jiakbar.github.io/idx-dashboard'

/** Awalan jalur yang di produksi disajikan GitHub Pages. */
const AWALAN_LUAR = ['/data-idx/', '/arus-pasar/']

/**
 * Ubah jalur data jadi URL yang benar untuk lingkungan saat ini. Jalur di luar
 * kedua awalan (aset aplikasi, `/api/...`) dikembalikan apa adanya.
 */
export function urlData(jalur: string): string {
  if (!import.meta.env.PROD) return jalur
  if (!BASE_DATA_LUAR) return jalur
  return AWALAN_LUAR.some((a) => jalur.startsWith(a)) ? BASE_DATA_LUAR + jalur : jalur
}
