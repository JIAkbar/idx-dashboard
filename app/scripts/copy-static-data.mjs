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

// ── 2 September 2026: uji itu sudah dijalankan, dan hasilnya MERAH ──────────
//
// Johan memutuskan 25 Agu "deploy sekali, lihat hasilnya". Deploy-nya hijau
// sampai 28 Agustus, lalu 11 deployment berturut Error. Angkanya menjelaskan
// kenapa jeda itu ada:
//
//   25 Agu, hijau    17.184 berkas  (broker_tahunan 2.740)
//    2 Sep, merah    24.446 berkas  (broker_tahunan 8.894)
//
// `broker_tahunan` TRIPLE dalam sepekan — satu berkas per emiten per tahun,
// jadi tiap tahun yang dibangun menambah ~963. Ia sendirian **2.161 MB dari
// 2.915 MB** dan **8.894 dari 24.446 berkas**: 74% ukuran, 36% jumlah.
//
// Yang TIDAK bisa kuklaim: bahwa jumlah berkas adalah sebabnya. Log build
// belum terbaca, dan dugaanku sudah salah tiga kali di perkara ini (jumlah
// berkas, build yang kupatahkan, kuota). Yang bisa kuklaim: 2,9 GB disalin
// tiap build, tiap commit panen memicu build, dan itu rapuh dengan sebab apa
// pun.
//
// Karena itu `broker_tahunan` dikecualikan — bukan sebagai tebakan penyebab,
// melainkan karena ia satu-satunya bagian yang (a) besar sekali, (b) tumbuh
// tak terbatas, dan (c) **sudah tersedia utuh & lebih segar di GitHub Pages**
// (diperiksa 2 Sep: `/broker_tahunan/BUMI/index.json` HTTP 200, dan
// `index.json` Pages bertanggal 1 Sep sementara Vercel masih 27 Agu).
//
// Pembacanya diarahkan ke sana lewat `lib/dasbor/baseData.ts` — tiga berkas,
// bukan 109 pemanggilan. Kalau kelak Vercel terbukti sanggup lagi, cukup
// kosongkan `LUAR` di bawah dan `BASE_DATA_LUAR` di berkas itu.
const LUAR = new Set(['broker_tahunan'])

const targets = [
  { src: path.join(repoRoot, 'data-idx', 'json'), dest: path.join(distDir, 'data-idx', 'json'), saring: true },
  { src: path.join(repoRoot, 'data-idx', 'radar'), dest: path.join(distDir, 'data-idx', 'radar') },
  { src: path.join(repoRoot, 'arus-pasar', 'keluaran'), dest: path.join(distDir, 'arus-pasar', 'keluaran') },
]


for (const { src, dest, saring } of targets) {
  if (!existsSync(src)) {
    console.warn(`[copy-static-data] lewati, sumber tidak ada: ${src}`)
    continue
  }
  rmSync(dest, { recursive: true, force: true })
  cpSync(src, dest, {
    recursive: true,
    // `filter` dipanggil untuk TIAP berkas; hanya anak langsung yang diperiksa
    // supaya tak ada emiten bernama sama di kedalaman lain ikut terbuang.
    filter: saring
      ? (s) => !LUAR.has(path.relative(src, s).split(path.sep)[0])
      : undefined,
  })
  const nama = path.relative(repoRoot, src)
  console.log(`[copy-static-data] ${nama} -> dist/${path.relative(distDir, dest)}`
    + (saring ? `  (dikecualikan: ${[...LUAR].join(', ')} — disajikan GitHub Pages)` : ''))
}

