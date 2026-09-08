/**
 * Swauji pagar bersama (#109 A, dipakai #112) — murni, nol jaringan, nol token.
 *
 * Fungsi serverless tak ikut suite vitest `app/` (di luar akar proyeknya), jadi
 * pagarnya diuji di sini dan dijalankan tangan sebelum deploy:
 *     node api/_pagar.uji.mjs
 *
 * Kasus pertama yang ditulis justru yang MENANGKAP kesalahan pertama: pola asal
 * versi awal memakai `(^|.)vercel.app$`, yang meloloskan situs Vercel milik
 * siapa pun — pagar yang terbaca ketat tapi praktis terbuka.
 */
import { asalDiizinkan, catatLaju, ipPemanggil, periksaPagar, tglWib } from './_pagar.js'
import { sidikKunjungan, garamEfektif } from './kunjungan.js'

let gagal = 0
const cek = (n, ok) => { if (!ok) gagal++; console.log((ok ? '  ok   ' : '  GAGAL ') + n) }

// ── asal ────────────────────────────────────────────────────────────────────
cek('tanpa asal -> boleh (bilah alamat, curl, pemantau)', asalDiizinkan({}) === true)
cek('domain PAPAN -> boleh', asalDiizinkan({ origin: 'https://papan-idx.vercel.app' }) === true)
cek('pratayang cabang -> boleh', asalDiizinkan({ origin: 'https://papan-idx-git-main-x.vercel.app' }) === true)
cek('pratayang deploy proyek ini -> boleh', asalDiizinkan({ origin: 'https://papan-kzaqznl06-johan-iriawan-akbar-s-projects.vercel.app' }) === true)
cek('localhost -> boleh', asalDiizinkan({ origin: 'http://localhost:5173' }) === true)
cek('situs lain -> DITOLAK', asalDiizinkan({ origin: 'https://pencuri.example' }) === false)
cek('referer situs lain -> DITOLAK', asalDiizinkan({ referer: 'https://pencuri.example/hal' }) === false)
cek('vercel.app milik ORANG LAIN -> DITOLAK', asalDiizinkan({ origin: 'https://situs-lain.vercel.app' }) === false)

// ── batas laju ──────────────────────────────────────────────────────────────
const t0 = 1_700_000_000_000
let sisa = 0
for (let i = 0; i < 40; i++) sisa = catatLaju('1.2.3.4', t0 + i)
cek('40 permintaan pertama masih boleh', sisa === 0)
cek('permintaan ke-41 melewati batas', catatLaju('1.2.3.4', t0 + 41) < 0)
cek('IP lain tak kena imbas', catatLaju('9.9.9.9', t0 + 41) === 39)
cek('sesudah jendela 60 detik lewat, jatah pulih', catatLaju('1.2.3.4', t0 + 61_000) === 39)

// ── pagar utuh ──────────────────────────────────────────────────────────────
cek('periksaPagar: asal asing -> 403', periksaPagar({ headers: { origin: 'https://x.example' } })?.kode === 403)
cek('periksaPagar: wajar -> lolos', periksaPagar({ headers: {}, }, t0 + 200_000) === null)
cek('ipPemanggil membaca x-forwarded-for pertama',
  ipPemanggil({ headers: { 'x-forwarded-for': '3.3.3.3, 4.4.4.4' } }) === '3.3.3.3')

// ── tanggal WIB ─────────────────────────────────────────────────────────────
// 2026-09-08 17:00 UTC = 9 Sep 00:00 WIB. Tanpa geser +7 jam, penghitung harian
// akan memakai tanggal kemarin setiap dini hari WIB.
const malam = Date.parse('2026-09-08T17:30:00Z')
cek('tglWib memakai tanggal Jakarta, bukan UTC', tglWib(0, malam) === '2026-09-09')
cek('tglWib mundur N hari', tglWib(10, malam) === '2026-08-30')

// ── sidik kunjungan (#112) ─────────────────────────────────────────────────
const s1 = sidikKunjungan('1.1.1.1', 'UA', '2026-09-08', 'garam')
const s2 = sidikKunjungan('1.1.1.1', 'UA', '2026-09-08', 'garam')
const s3 = sidikKunjungan('1.1.1.1', 'UA', '2026-09-09', 'garam')
const s4 = sidikKunjungan('1.1.1.2', 'UA', '2026-09-08', 'garam')
cek('sidik stabil dalam satu hari (kunjungan ulang tak terhitung dua kali)', s1 === s2)
cek('sidik berbeda lintas hari (tak bisa disambung antar-hari)', s1 !== s3)
cek('sidik berbeda antar-IP', s1 !== s4)
cek('sidik tak memuat bahan bakunya', !s1.includes('1.1.1.1') && !s1.includes('UA') && !s1.includes('garam'))
cek('sidik panjang sha256', /^[0-9a-f]{64}$/.test(s1))
cek('garam: env dipakai lebih dulu', garamEfektif({ KUNJUNGAN_GARAM: 'X', SUPABASE_SERVICE_ROLE_KEY: 'Y' }).asal === 'env')
cek('garam: jatuh ke turunan kunci server', garamEfektif({ SUPABASE_SERVICE_ROLE_KEY: 'Y' }).asal === 'turunan-kunci-server')
cek('garam: tanpa keduanya -> tidak ada', garamEfektif({}).garam === null)

console.log(gagal ? `GAGAL ${gagal} kasus` : 'semua kasus lolos')
process.exit(gagal ? 1 : 0)
