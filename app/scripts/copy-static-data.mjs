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

// Folder yang TIDAK ikut ke `dist/`, walau ada di repo.
//
// Vercel membatasi JUMLAH BERKAS per deployment di 15.000 — bukan ukurannya.
// Terukur 24 Agustus 2026: data statis kita 14.363 berkas (lolos), lalu
// `broker_tahunan/` menambah 2.740 jadi 17.103 dan SETIAP deployment sesudah
// itu gagal. Yang menipu: 446 MB terdengar seperti masalah ukuran, padahal
// batasnya jumlah — 2.740 berkas mungil @0,23 MB yang menjatuhkannya.
//
// Gejalanya juga tak terlihat dari sini: build lokal tetap sukses, `tsc`
// bersih, uji lulus. Kegagalannya hanya muncul di Vercel, dan produksi diam
// di versi lama selama 13 jam tanpa satu pun galat di repo.
//
// Ini TAMBALAN, bukan jawaban. Menyajikan ribuan JSON mungil lewat Vercel
// memang salah bentuk; jawabannya memindahkan data statis ke luar (atau
// menggabungkannya jadi jauh lebih sedikit berkas) — belum diputuskan.
const JANGAN_SALIN = [path.join('data-idx', 'json', 'broker_tahunan')]

const targets = [
  { src: path.join(repoRoot, 'data-idx', 'json'), dest: path.join(distDir, 'data-idx', 'json') },
  { src: path.join(repoRoot, 'data-idx', 'radar'), dest: path.join(distDir, 'data-idx', 'radar') },
  { src: path.join(repoRoot, 'arus-pasar', 'keluaran'), dest: path.join(distDir, 'arus-pasar', 'keluaran') },
]

const dilewati = JANGAN_SALIN.map((rel) => path.join(repoRoot, rel))
const bolehSalin = (p) => !dilewati.some((d) => p === d || p.startsWith(d + path.sep))

for (const { src, dest } of targets) {
  if (!existsSync(src)) {
    console.warn(`[copy-static-data] lewati, sumber tidak ada: ${src}`)
    continue
  }
  rmSync(dest, { recursive: true, force: true })
  cpSync(src, dest, { recursive: true, filter: bolehSalin })
  console.log(`[copy-static-data] ${path.relative(repoRoot, src)} -> dist/${path.relative(distDir, dest)}`)
}

for (const rel of JANGAN_SALIN) {
  console.log(`[copy-static-data] TIDAK disalin (batas 15.000 berkas Vercel): ${rel}`)
}
