// Sejak A2 (#176, 13 Sep 2026) skrip ini TIDAK menyalin data lagi: produksi membaca
// seluruh /data-idx/ dan /arus-pasar/ dari GitHub Pages (lihat `src/lib/dasbor/baseData.ts`).
// Yang tersisa dua penjaga: `dist/` harus sudah ada, dan bayangan data lama di
// `app/public/` dibersihkan supaya dev server tak menyajikan salinan beku.
//
// Catatan versi sebelum A2 (dipertahankan karena alasannya masih berlaku untuk pembersihan):
// Salin data statis dari luar app/ (akar repo) ke `dist/` SESUDAH `vite build`.
//
// Kenapa ke `dist/` dan bukan ke `app/public/` seperti versi sebelumnya —
// dan ini bug nyata yang sudah menggigit, bukan kerapian:
//
//   Vite menyajikan `public/` LEBIH DULU daripada middleware `serveRepoDir`
//   di `vite.config.ts`. Jadi begitu `npm run build` dijalankan sekali, folder
//   `app/public/data-idx/` tercipta dan sejak itu dev server selamanya
//   menyajikan SALINAN BEKU, bukan data hidup. Middleware-nya masih ada dan
//   masih benar — ia cuma tak pernah kebagian permintaan.
//
//   20 Agustus 2026: halaman Beranda menampilkan IHSG 6.498,60 dengan VOLUME,
//   NILAI, FREKUENSI, KAPITALISASI, NET FOREIGN, PER, dan PBV semuanya "—"
//   atau 0,00. Berkas aslinya punya 49 ruas; yang dilayani cuma 11 — sisa
//   tambalan cadangan Yahoo yang tersalin ke `public/` sebelum PDF resmi IDX
//   turun dan diparse. Nol galat, nol peringatan: halamannya memuat dengan
//   sempurna, angkanya saja yang kosong.
//
// Menyalin ke `dist/` menghapus seluruh kelas masalah itu: dev tak pernah
// punya salinan untuk dijadikan bayangan, dan hasil build tetap lengkap.
//
// Sumber (`../data-idx/json`, `../data-idx/radar`, `../arus-pasar/keluaran`)
// tetap satu-satunya lokasi asli.
import { rmSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const appDir = path.resolve(fileURLToPath(import.meta.url), '..', '..')
const repoRoot = path.resolve(appDir, '..')
const distDir = path.join(appDir, 'dist')

if (!existsSync(distDir)) {
  // Skrip ini jalan SESUDAH `vite build`. Kalau `dist/` tak ada, buildnya
  // gagal atau urutannya tertukar — dan menyalin ke folder yang tak ada
  // akan lolos diam-diam lalu menghasilkan situs tanpa data.
  console.error('[copy-static-data] dist/ tidak ada — jalankan SESUDAH `vite build`.')
  process.exit(1)
}

// Sisa dari versi lama. Selama folder ini masih ada, dev server tetap
// menyajikannya alih-alih data hidup — jadi ia dibersihkan tiap build,
// bukan cuma diabaikan.
for (const usang of ['data-idx', 'arus-pasar']) {
  const p = path.join(appDir, 'public', usang)
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true })
    console.log(`[copy-static-data] dibersihkan (bayangan dev): app/public/${usang}`)
  }
}

// Riwayat penyalinan data (2 Sep 2026 broker_tahunan dikecualikan, 9 Sep 2026 kabar.json dan
// snips.json) ada di git log berkas ini. Sejak A2 tak ada lagi yang disalin, jadi pengecualian itu
// ikut hilang: build Vercel sekarang cuma membawa aplikasi.
console.log('[copy-static-data] data statis tidak disalin ke dist/: produksi membacanya dari GitHub Pages (#176 A2)')
