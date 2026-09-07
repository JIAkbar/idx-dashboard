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
import { rakitBar, kunciPekan, kunciBulan } from '../src/lib/dasbor/kerangkaWaktu.ts'
import type { LilinData } from '../src/lib/dasbor/grafikEmiten.ts'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OHLC = join(AKAR, 'data-idx', 'json', 'ohlc')
const BT = join(AKAR, 'data-idx', 'json', 'bt')

type Baris = [string, number, number, number, number, number]

const arg = process.argv.slice(2)
const tf = (arg.find((a) => a.startsWith('--tf='))?.slice(5) ?? 'D').toUpperCase()
const tulis = arg.includes('--tulis')

/**
 * Bar harian -> bar kerangka, lewat perakit yang dipakai CHART (#74).
 *
 * Sampai 7 Sep 2026 berkas ini merakit sendiri dengan ember Senin /
 * tanggal 1 - hasilnya kebetulan sama persis, tapi tak ada yang
 * menjaganya tetap sama. Itu ganjil justru di sini: statistik Gap ada
 * untuk mengangkakan zona yang digambar mesin satunya, jadi dua perakit
 * yang berbeda diam-diam akan membuat angkanya bicara soal bar yang tak
 * pernah dilihat pembaca.
 *
 * Diukur sebelum ditukar, atas SELURUH arsip (bukan sampel): 0 emiten
 * berbeda, 0 bar berbeda, di W maupun M.
 */
function rakit(bar: Baris[], kerangka: string): Baris[] {
  if (kerangka === 'D') return bar
  const lilin: LilinData[] = bar.map(([time, open, high, low, close]) => ({ time, open, high, low, close }))
  // `color` wajib ada di tipe VolumeData walau perakitnya menimpanya sendiri.
  const volume = bar.map(([time, , , , , v]) => ({ time, value: v, color: '' }))
  const r = rakitBar(lilin, volume, kerangka === 'W' ? kunciPekan : kunciBulan, '', '')
  return r.lilin.map((l, i) => [l.time, l.open, l.high, l.low, l.close, r.volume[i].value] as Baris)
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
