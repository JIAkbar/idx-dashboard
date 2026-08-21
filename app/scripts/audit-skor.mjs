/**
 * Sapuan skor teknikal atas SELURUH berkas OHLC di cakram.
 *
 * Bukan uji unit: yang diperiksa di sini adalah apakah SEBARAN labelnya masuk
 * akal di pasar sungguhan. Skor yang 90% "Neutral" tak berguna sebagai
 * penyaring, dan skor yang 60% "Strong Buy" berarti ambangnya terlalu longgar
 * — dua kegagalan yang tak akan pernah tertangkap deret uji buatan.
 *
 *   node app/scripts/audit-skor.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIR = join(AKAR, 'data-idx', 'json', 'ohlc')

// Rumus disalin seperlunya dari `skorTeknikal.ts` — skrip ini berjalan di Node
// tanpa transpiler, jadi ia tak bisa mengimpor TypeScript langsung. Kalau
// keduanya menyimpang, `skorTeknikal.test.ts` yang jadi wasitnya.
const sma = (v, n) => (v.length < n ? null : v.slice(-n).reduce((a, b) => a + b, 0) / n)
function emaAkhir(v, n) {
  if (v.length < n) return null
  let e = v.slice(0, n).reduce((a, b) => a + b, 0) / n
  const k = 2 / (n + 1)
  for (let i = n; i < v.length; i++) e = v[i] * k + e * (1 - k)
  return e
}
function rsi(v, n = 14) {
  if (v.length <= n) return null
  let naik = 0, turun = 0
  for (let i = 1; i <= n; i++) { const d = v[i] - v[i - 1]; if (d >= 0) naik += d; else turun -= d }
  naik /= n; turun /= n
  for (let i = n + 1; i < v.length; i++) {
    const d = v[i] - v[i - 1]
    naik = (naik * (n - 1) + (d > 0 ? d : 0)) / n
    turun = (turun * (n - 1) + (d < 0 ? -d : 0)) / n
  }
  if (turun === 0) return naik === 0 ? 50 : 100
  return 100 - 100 / (1 + naik / turun)
}
function stochK(b, n = 14) {
  if (b.length < n) return null
  const p = b.slice(-n)
  const hi = Math.max(...p.map((x) => x[2])), lo = Math.min(...p.map((x) => x[3]))
  return hi === lo ? 50 : ((b.at(-1)[4] - lo) / (hi - lo)) * 100
}
function cci(b, n = 20) {
  if (b.length < n) return null
  const tp = b.slice(-n).map((x) => (x[2] + x[3] + x[4]) / 3)
  const r = tp.reduce((a, x) => a + x, 0) / n
  const dev = tp.reduce((a, x) => a + Math.abs(x - r), 0) / n
  return dev === 0 ? 0 : (tp.at(-1) - r) / (0.015 * dev)
}
function macd(v, c = 12, l = 26, s = 9) {
  if (v.length < l + s) return null
  const d = []
  for (let i = l; i <= v.length; i++) {
    const p = v.slice(0, i), a = emaAkhir(p, c), b = emaAkhir(p, l)
    if (a === null || b === null) return null
    d.push(a - b)
  }
  const sg = emaAkhir(d, s)
  return sg === null ? null : [d.at(-1), sg]
}
const ambang = (v, bawah, atas) => (v === null ? 0 : v <= bawah ? 1 : v >= atas ? -1 : 0)

function skor(baris) {
  if (baris.length < 30) return null
  const tutup = baris.map((b) => b[4]), harga = tutup.at(-1)
  const k = []
  const arah = (v) => { if (v !== null) k.push(harga > v ? 1 : harga < v ? -1 : 0) }
  for (const n of [10, 20, 30, 50, 100, 200]) arah(sma(tutup, n))
  for (const n of [10, 20, 30, 50, 100, 200]) arah(emaAkhir(tutup, n))
  const r = rsi(tutup); if (r !== null) k.push(ambang(r, 30, 70))
  const st = stochK(baris); if (st !== null) k.push(ambang(st, 20, 80))
  if (st !== null) k.push(ambang(st - 100, -80, -20))
  const c = cci(baris); if (c !== null) k.push(ambang(c, -100, 100))
  const m = macd(tutup); if (m) k.push(m[0] > m[1] ? 1 : m[0] < m[1] ? -1 : 0)
  if (tutup.length > 10) { const lalu = tutup.at(-11); k.push(harga > lalu ? 1 : harga < lalu ? -1 : 0) }
  return k.length ? k.reduce((a, b) => a + b, 0) / k.length : null
}
const label = (s) => (s >= 0.5 ? 'Strong Buy' : s >= 0.1 ? 'Buy' : s <= -0.5 ? 'Strong Sell' : s <= -0.1 ? 'Sell' : 'Neutral')

const hitung = {}
let n = 0, kosong = 0
for (const f of readdirSync(DIR)) {
  if (!f.endsWith('.json') || f.startsWith('_')) continue
  let d
  try { d = JSON.parse(readFileSync(join(DIR, f), 'utf8')).d } catch { continue }
  if (!Array.isArray(d) || d.length < 30) { kosong++; continue }
  const s = skor(d)
  if (s === null) { kosong++; continue }
  hitung[label(s)] = (hitung[label(s)] ?? 0) + 1
  n++
}
console.log(`emiten terhitung ${n}, dilewati ${kosong}`)
for (const l of ['Strong Buy', 'Buy', 'Neutral', 'Sell', 'Strong Sell']) {
  const c = hitung[l] ?? 0
  console.log(`  ${l.padEnd(12)} ${String(c).padStart(4)}  ${(c / n * 100).toFixed(1)}%`)
}
