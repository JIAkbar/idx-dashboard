/**
 * Swauji pagar `live-harga` (#109 A) — murni, nol jaringan, nol token.
 *
 * Fungsi serverless tak ikut suite vitest `app/` (di luar akar proyeknya),
 * jadi pagarnya diuji di sini dan dijalankan tangan sebelum deploy:
 *     node api/live-harga.uji.mjs
 *
 * Kasus pertama yang ditulis justru yang MENANGKAP kesalahan pertama: pola
 * asal versi awal memakai `(^|.)vercel.app$`, yang meloloskan situs Vercel
 * milik siapa pun — pagar yang terbaca ketat tapi praktis terbuka.
 */
import { asalDiizinkan, catatLaju } from './live-harga.js'
const m = { asalDiizinkan, catatLaju }

let gagal = 0
const cek = (n, ok) => { if (!ok) gagal++; console.log((ok ? '  ok   ' : '  GAGAL ') + n) }

cek('tanpa asal -> boleh (bilah alamat, curl, pemantau)', m.asalDiizinkan({}) === true)
cek('domain PAPAN -> boleh', m.asalDiizinkan({ origin: 'https://papan-idx.vercel.app' }) === true)
cek('pratayang vercel -> boleh', m.asalDiizinkan({ origin: 'https://papan-idx-git-main-x.vercel.app' }) === true)
cek('localhost -> boleh', m.asalDiizinkan({ origin: 'http://localhost:5173' }) === true)
cek('situs lain -> DITOLAK', m.asalDiizinkan({ origin: 'https://pencuri.example' }) === false)
cek('referer situs lain -> DITOLAK', m.asalDiizinkan({ referer: 'https://pencuri.example/hal' }) === false)
cek('vercel.app milik ORANG LAIN -> DITOLAK', m.asalDiizinkan({ origin: 'https://situs-lain.vercel.app' }) === false)
cek('pratayang deploy proyek ini -> boleh', m.asalDiizinkan({ origin: 'https://papan-kzaqznl06-johan-iriawan-akbar-s-projects.vercel.app' }) === true)

const t0 = 1_700_000_000_000
let sisa = 0
for (let i = 0; i < 40; i++) sisa = m.catatLaju('1.2.3.4', t0 + i)
cek('40 permintaan pertama masih boleh', sisa === 0)
cek('permintaan ke-41 melewati batas', m.catatLaju('1.2.3.4', t0 + 41) < 0)
cek('IP lain tak kena imbas', m.catatLaju('9.9.9.9', t0 + 41) === 39)
cek('sesudah jendela 60 detik lewat, jatah pulih', m.catatLaju('1.2.3.4', t0 + 61_000) === 39)

console.log(gagal ? `GAGAL ${gagal} kasus` : 'semua kasus lolos')
process.exit(gagal ? 1 : 0)
