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
import { skorTeknikal } from './lib/skor.mjs'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIR = join(AKAR, 'data-idx', 'json', 'ohlc')

// Rumus hidup di satu tempat: `lib/skor.mjs`, port JS dari `skorTeknikal.ts`.
// Dulu skrip ini menyalin rumusnya sendiri; dua salinan yang bisa menyimpang
// diam-diam adalah bug termahal di proyek ini. `skorTeknikal.crossCheck.test.mjs`
// jadi wasit yang membandingkan `lib/skor.mjs` ke sumber TS.

const hitung = {}
let n = 0, kosong = 0
for (const f of readdirSync(DIR)) {
  if (!f.endsWith('.json') || f.startsWith('_')) continue
  let d
  try { d = JSON.parse(readFileSync(join(DIR, f), 'utf8')).d } catch { continue }
  if (!Array.isArray(d) || d.length < 30) { kosong++; continue }
  const h = skorTeknikal(d)
  if (h === null) { kosong++; continue }
  hitung[h.label] = (hitung[h.label] ?? 0) + 1
  n++
}
console.log(`emiten terhitung ${n}, dilewati ${kosong}`)
for (const l of ['Strong Buy', 'Buy', 'Neutral', 'Sell', 'Strong Sell']) {
  const c = hitung[l] ?? 0
  console.log(`  ${l.padEnd(12)} ${String(c).padStart(4)}  ${(c / n * 100).toFixed(1)}%`)
}
