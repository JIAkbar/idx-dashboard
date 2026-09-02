/**
 * Alamat dasar untuk data yang TIDAK ikut ter-deploy ke Vercel.
 *
 * Kenapa ada: `broker_tahunan` sendirian 2.161 MB dan 8.894 berkas — 74%
 * ukuran dan 36% jumlah berkas seluruh deployment, dan ia tumbuh ~963 berkas
 * tiap tahun yang dibangun. Sejak 2 Sep 2026 ia dikecualikan dari salinan
 * build (`scripts/copy-static-data.mjs`) dan diambil dari GitHub Pages, yang
 * menyajikan repo yang sama.
 *
 * Diperiksa 2 Sep 2026 sebelum dipakai, bukan diasumsikan:
 *   `/data-idx/json/broker_tahunan/BUMI/index.json` -> HTTP 200
 *   `/data-idx/json/index.json` di Pages bertanggal **1 September**,
 *   sementara yang di Vercel masih **27 Agustus** — jadi jalur ini bukan
 *   sekadar cadangan, ia justru lebih segar.
 *
 * Kenapa satu helper dan bukan menyunting 109 pemanggilan `/data-idx/`:
 * yang dipindah cuma SATU folder, dan pembacanya cuma tiga berkas. Menyapu
 * seluruh pemanggilan berarti mengubah jalur data yang selama ini bekerja
 * demi masalah yang tak menyentuhnya.
 *
 * DEV tetap memakai jalur relatif: `vite.config.ts` sudah menyajikan
 * `../data-idx/json` apa adanya, jadi di localhost tak ada yang berubah dan
 * pekerjaan lokal tak bergantung pada jaringan.
 *
 * Membatalkannya: kosongkan konstanta ini DAN `LUAR` di copy-static-data.mjs.
 * Keduanya harus berubah bersama — kalau cuma satu, halaman meminta berkas
 * yang tak ada di mana pun.
 */
const BASE_DATA_LUAR = 'https://jiakbar.github.io/idx-dashboard'

/** Folder di bawah `data-idx/json/` yang disajikan dari luar Vercel. */
const DI_LUAR = ['broker_tahunan']

/**
 * Ubah jalur data jadi URL yang benar untuk lingkungan saat ini.
 *
 * Menerima jalur apa adanya (`/data-idx/json/...`) supaya pemanggil tak perlu
 * tahu folder mana yang sedang tinggal di mana — dan supaya memindahkan folder
 * berikutnya cukup menambah satu nama di `DI_LUAR`.
 */
export function urlData(jalur: string): string {
  if (!import.meta.env.PROD) return jalur
  if (!BASE_DATA_LUAR) return jalur
  const cocok = DI_LUAR.some((f) => jalur.startsWith(`/data-idx/json/${f}/`))
  return cocok ? BASE_DATA_LUAR + jalur : jalur
}
