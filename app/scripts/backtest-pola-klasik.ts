/**
 * Backtest pola chart klasik (`lib/dasbor/polaKlasik.ts`) atas OHLC NYATA —
 * tiga kerangka: harian, 4 jam (60m Yahoo dirakit), dan pekanan.
 *
 * Johan 21 Agu 2026: pola menu chart *"bukan asal tebak berdasarkan hasil
 * benchmark dan backtesting data di 4H dan 1D bahkan kalau bisa 1W juga"*.
 *
 * Aturan yang sama dengan `backtest-struktur.ts`, dua-duanya sudah dibayar:
 *   - MENGIMPOR rumus yang dipakai layar, bukan menyalinnya;
 *   - tiap sinyal dibandingkan PELUANG DASAR emiten yang sama — sinyal yang
 *     benar 55% tak berarti kalau emitennya memang naik 55% sepanjang waktu.
 *
 *   node app/scripts/backtest-pola-klasik.ts            (harian)
 *   node app/scripts/backtest-pola-klasik.ts --tf=4h
 *   node app/scripts/backtest-pola-klasik.ts --tf=w
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PARAM_POLA_KLASIK_BAWAAN, cariPolaKlasik } from '../src/lib/dasbor/polaKlasik.ts'
import type { NamaPolaKlasik } from '../src/lib/dasbor/polaKlasik.ts'
import { dariYahoo, kunci4Jam, kunciPekan, rakitBar } from '../src/lib/dasbor/kerangkaWaktu.ts'
import type { YahooIntradayJson } from '../src/lib/dasbor/kerangkaWaktu.ts'
import type { LilinData, VolumeData } from '../src/lib/dasbor/grafikEmiten.ts'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const HORIZON = [5, 10, 20]
const EMITEN = ['BBCA', 'BBRI', 'ASII', 'TLKM', 'ANTM', 'MDKA', 'MBMA', 'ARCI',
  'INCO', 'ADRO', 'PTBA', 'CUAN', 'BRMS', 'KIJA', 'BIPI', 'WIFI', 'INET', 'DSSA']

function harian(kode: string): LilinData[] {
  const j = JSON.parse(readFileSync(join(AKAR, 'data-idx', 'json', 'ohlc', `${kode}.json`), 'utf8'))
  return j.d.map(([time, open, high, low, close]: [string, number, number, number, number]) =>
    ({ time, open, high, low, close }))
}

function pekanan(kode: string): LilinData[] {
  const d = harian(kode)
  const vol: VolumeData[] = d.map((l) => ({ time: l.time, value: 0, color: '' }))
  return rakitBar(d, vol, kunciPekan, '#0a0', '#a00').lilin
}

/** 4 jam dari arsip 60m Yahoo — arsip yang sama dengan backtest struktur. */
async function empatJam(kode: string): Promise<LilinData[]> {
  const arsip = join(AKAR, '_arsip-mentah', 'yahoo-60m')
  mkdirSync(arsip, { recursive: true })
  const berkas = join(arsip, `${kode}.json`)
  let mentah: YahooIntradayJson
  if (existsSync(berkas)) {
    mentah = JSON.parse(readFileSync(berkas, 'utf8'))
  } else {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${kode}.JK?interval=60m&range=2y`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } },
    )
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    mentah = (await r.json()) as YahooIntradayJson
    writeFileSync(berkas, JSON.stringify(mentah), 'utf8')
  }
  const satuJam = dariYahoo(mentah, '#0a0', '#a00')
  if (satuJam.lilin.length === 0) throw new Error('Yahoo tak memberi lilin 60m')
  return rakitBar(satuJam.lilin, satuJam.volume as VolumeData[], kunci4Jam, '#0a0', '#a00').lilin
}

function dasar(lilin: LilinData[], h: number): number | null {
  let n = 0, naik = 0
  for (let i = 0; i + h < lilin.length; i++) { n++; if (lilin[i + h].close > lilin[i].close) naik++ }
  return n ? (naik / n) * 100 : null
}

const arg = process.argv.slice(2)
const tf = (arg.find((a) => a.startsWith('--tf=')) || '--tf=d').slice(5).toLowerCase()
if (!['d', '4h', 'w'].includes(tf)) throw new Error(`--tf hanya d/4h/w (diberi: ${tf})`)

interface Kum { n: number; benar: number; dasarSel: number }
const total: Record<number, Kum> = {}
const perNama: Record<string, Record<number, Kum>> = {}
for (const h of HORIZON) total[h] = { n: 0, benar: 0, dasarSel: 0 }

console.log(`Backtest pola klasik — 18 emiten, kerangka ${tf.toUpperCase()}, param bawaan\n`)
console.log('emiten  lilin  pola   ' + HORIZON.map((h) => `${h}H`.padStart(7)).join(''))

for (const kode of EMITEN) {
  let lilin: LilinData[]
  try {
    lilin = tf === '4h' ? await empatJam(kode) : tf === 'w' ? pekanan(kode) : harian(kode)
  } catch (e) { console.log(`${kode.padEnd(7)} (${(e as Error).message})`); continue }
  if (lilin.length < 100) { console.log(`${kode.padEnd(7)} (riwayat pendek: ${lilin.length})`); continue }

  const pola = cariPolaKlasik(lilin, PARAM_POLA_KLASIK_BAWAAN)
  const kolom: string[] = []
  for (const h of HORIZON) {
    const d = dasar(lilin, h) ?? 50
    let n = 0, benar = 0
    for (const q of pola) {
      if (q.iSinyal + h >= lilin.length) continue
      n++
      const naik = lilin[q.iSinyal + h].close > lilin[q.iSinyal].close
      const cocok = naik === (q.arah === 'bullish')
      if (cocok) benar++
      total[h].n++; if (cocok) total[h].benar++
      // Dasar per sinyal DIBALIK untuk sinyal bearish: peluang dasarnya
      // "berapa sering harga TURUN dalam h lilin", bukan naik.
      total[h].dasarSel += q.arah === 'bullish' ? d : 100 - d
      const pn = (perNama[q.nama] ??= Object.fromEntries(HORIZON.map((x) => [x, { n: 0, benar: 0, dasarSel: 0 }])))
      pn[h].n++; if (cocok) pn[h].benar++
      pn[h].dasarSel += q.arah === 'bullish' ? d : 100 - d
    }
    kolom.push(n ? `${((benar / n) * 100).toFixed(0)}%`.padStart(7) : '     — ')
  }
  console.log(`${kode.padEnd(7)}${String(lilin.length).padStart(6)}${String(pola.length).padStart(6)}   ${kolom.join('')}`)
}

console.log('\nPer pola — benar% (n, selisih pp thd dasar arah yang sama):')
const nama = Object.keys(perNama).sort() as NamaPolaKlasik[]
for (const nm of nama) {
  const baris = HORIZON.map((h) => {
    const k = perNama[nm][h]
    if (!k.n) return `${h}H      —`
    const b = (k.benar / k.n) * 100
    const d = k.dasarSel / k.n
    return `${h}H ${b.toFixed(0).padStart(3)}% (n=${String(k.n).padStart(3)}, ${b - d >= 0 ? '+' : ''}${(b - d).toFixed(1)}pp)`
  })
  console.log(`  ${nm.padEnd(20)} ${baris.join('   ')}`)
}

console.log('\nGabungan:')
for (const h of HORIZON) {
  const k = total[h]
  if (!k.n) { console.log(`  ${h}H —`); continue }
  const b = (k.benar / k.n) * 100
  const d = k.dasarSel / k.n
  console.log(`  ${String(h).padStart(2)} lilin  ${b.toFixed(1)}% benar (n=${k.n}, ${b - d >= 0 ? '+' : ''}${(b - d).toFixed(1)}pp di atas dasar ${d.toFixed(1)}%)`)
}
console.log('\nSelisih pp terhadap peluang dasar arah yang sama itu satu-satunya angka yang berarti.')
