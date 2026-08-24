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
import { cpSync, rmSync, existsSync } from 'node:fs'
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

// Semua yang ada di repo ikut ke `dist/`. Tak ada pengecualian — dan itu
// hasil keputusan, bukan kelalaian.
//
// Riwayatnya: 24 Agu 2026 `data-idx/json/broker_tahunan` dikecualikan sebagai
// kehati-hatian saat deployment gagal berturut selama 13 jam. Penyebab
// sebenarnya ternyata galat TypeScript (TS2345 di rasioTambahanKeystats.ts);
// `tsc -b` langkah pertama build, jadi penyalinan ini tak pernah sempat
// berjalan sama sekali dan jumlah berkas tak pernah jadi tersangka yang sah.
// Pengecualian itu berdiri di atas diagnosis yang belakangan terbukti salah.
//
// Yang terukur: deployment sukses terakhir membawa 13.513 berkas; tanpa
// broker_tahunan 14.444; dengan broker_tahunan 17.184 (2.740 berkas, seluruhnya
// terlacak git). Batas jumlah berkas Vercel TIDAK diketahui angkanya —
// dokumentasinya menyebut adanya "file limit" tanpa angka yang bisa dikutip.
// Versi pertama komentar ini menulis "15.000" seolah terverifikasi; itu
// karangan dan sudah dicabut.
//
// Pengecualiannya dibuang 25 Agu 2026 atas keputusan Johan: deploy sekali,
// lihat hasilnya. Kalau hijau, batas itu memang tak pernah mengikat kita.
// Kalau merah dengan galat yang MENYEBUT jumlah berkas (bukan galat lain),
// barulah kita punya bukti pertama bahwa bentuk penyimpanan ini perlu diubah.
//
// Terlepas dari hasil uji itu, bentuknya tetap rapuh: ~14 folder x ~963 berkas
// per emiten berarti tiap dataset baru menambah seribuan berkas. Jawaban
// sebenarnya memindahkan data statis ke luar Vercel — belum diputuskan.

const targets = [
  { src: path.join(repoRoot, 'data-idx', 'json'), dest: path.join(distDir, 'data-idx', 'json') },
  { src: path.join(repoRoot, 'data-idx', 'radar'), dest: path.join(distDir, 'data-idx', 'radar') },
  { src: path.join(repoRoot, 'arus-pasar', 'keluaran'), dest: path.join(distDir, 'arus-pasar', 'keluaran') },
]


for (const { src, dest } of targets) {
  if (!existsSync(src)) {
    console.warn(`[copy-static-data] lewati, sumber tidak ada: ${src}`)
    continue
  }
  rmSync(dest, { recursive: true, force: true })
  cpSync(src, dest, { recursive: true })
  console.log(`[copy-static-data] ${path.relative(repoRoot, src)} -> dist/${path.relative(distDir, dest)}`)
}

