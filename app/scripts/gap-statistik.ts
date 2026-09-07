/**
 * Statistik pola Gap per KERANGKA — angka yang dipajang di chart (#50 §6).
 *
 * MENGIMPOR `cariGap` yang dipakai layar, tidak menyalinnya. Aturan yang sama
 * dengan `backtest-pola-klasik.ts` dan `backtest-struktur.ts`, dan #49 baru
 * saja membayar harganya kalau dilanggar: pola RBS sempat punya dua mesin yang
 * berbeda diam-diam selama berbulan-bulan, jadi angka backtest tak pernah
 * benar-benar menggambarkan garis yang dilihat orang. Untuk Gap itu tak boleh
 * terjadi sejak awal.
 *
 * Statistik dihitung dengan definisi RENTANG + pengisian progresif — bukan
 * definisi open yang lama. Bedanya bukan kosmetik: definisi open memberi
 * 258.327 gap harian yang 51,6% di antaranya "terisi" di bar ke-0.
 *
 *   node app/scripts/gap-statistik.ts            (harian)
 *   node app/scripts/gap-statistik.ts --tf=W --tulis
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { cariGap } from '../src/lib/dasbor/polaGap.ts'
import type { LilinData } from '../src/lib/dasbor/grafikEmiten.ts'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OHLC = join(AKAR, 'data-idx', 'json', 'ohlc')
const BT = join(AKAR, 'data-idx', 'json', 'bt')

type Baris = [string, number, number, number, number, number]

const arg = process.argv.slice(2)
const tf = (arg.find((a) => a.startsWith('--tf='))?.slice(5) ?? 'D').toUpperCase()
const tulis = arg.includes('--tulis')

/** Bar harian -> bar kerangka. Kunci ember: Senin (W), tanggal 1 (M). */
function rakit(bar: Baris[], kerangka: string): Baris[] {
  if (kerangka === 'D') return bar
  const ember = new Map<string, Baris>()
  for (const b of bar) {
    const d = new Date(`${b[0]}T00:00:00Z`)
    let k: string
    if (kerangka === 'W') {
      const senin = new Date(d)
      senin.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
      k = senin.toISOString().slice(0, 10)
    } else {
      k = `${b[0].slice(0, 7)}-01`
    }
    const e = ember.get(k)
    if (!e) ember.set(k, [k, b[1], b[2], b[3], b[4], b[5]])
    else { e[2] = Math.max(e[2], b[2]); e[3] = Math.min(e[3], b[3]); e[4] = b[4]; e[5] += b[5] }
  }
  return [...ember.keys()].sort().map((k) => ember.get(k)!)
}

function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

let nGap = 0
let nEmiten = 0
let n5 = 0
let n20 = 0
let nTersensor = 0
const barSampaiTerisi: number[] = []

for (const f of readdirSync(OHLC)) {
  if (!f.endsWith('.json') || f === 'IHSG.json') continue
  let d: { d?: Baris[] }
  try { d = JSON.parse(readFileSync(join(OHLC, f), 'utf-8')) } catch { continue }
  const mentah = rakit(d.d ?? [], tf)
  if (mentah.length < 40) continue
  nEmiten += 1
  const bars: LilinData[] = mentah.map(([time, open, high, low, close]) => ({ time, open, high, low, close }))
  for (const g of cariGap(bars, mentah.map((b) => b[5]))) {
    nGap += 1
    if (g.status === 'terisi') {
      barSampaiTerisi.push(g.barTerisi!)
      if (g.barTerisi! <= 5) n5 += 1
      if (g.barTerisi! <= 20) n20 += 1
    } else {
      // Belum terisi sampai data habis — sensor kanan, DIHITUNG. Membuangnya
      // diam-diam membuat sisanya terlihat lebih pasti daripada yang sebenarnya.
      nTersensor += 1
    }
  }
}

const hasil = {
  kerangka: tf,
  n_emiten: nEmiten,
  n_gap: nGap,
  n_tersensor: nTersensor,
  pct_terisi_5: nGap ? Math.round((n5 / nGap) * 1000) / 10 : null,
  pct_terisi_20: nGap ? Math.round((n20 / nGap) * 1000) / 10 : null,
  median_bar_terisi: median(barSampaiTerisi),
}

console.log(`[${tf}] ${nEmiten} emiten · ${nGap.toLocaleString('id-ID')} gap`)
console.log(`     terisi <=5 bar ${hasil.pct_terisi_5}% · <=20 bar ${hasil.pct_terisi_20}%`
  + ` · median ${hasil.median_bar_terisi} bar · belum terisi ${nTersensor.toLocaleString('id-ID')}`)

if (tulis) {
  if (!existsSync(BT)) mkdirSync(BT, { recursive: true })
  const p = join(BT, `gap-stat-${tf}.json`)
  writeFileSync(p, JSON.stringify(hasil, null, 1), 'utf-8')
  console.log(`     -> ${p}`)
}
