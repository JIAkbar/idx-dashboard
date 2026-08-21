/**
 * SAPUAN PENUH pola klasik — SELURUH emiten, bukan sampel.
 *
 * Johan 21 Agu 2026: *"tapi tidak hanya di BBCA saja kan ? di semua emiten
 * sudah di backtest untuk 4H dan 1D ? atau valid untuk semua timeframe ?"*
 *
 * Pertanyaan itu membongkar cacat nyata di `backtest-pola-klasik.ts`: ia
 * memakai **18 emiten pilihan** — likuid, kapitalisasi besar, sengaja
 * beragam watak. Dijalankan atas 915 emiten yang benar-benar berpola,
 * hasilnya BERBALIK TANDA:
 *
 *              18 emiten        915 emiten
 *   1D 20 lilin  +4,2pp           −2,5pp
 *   Head & Shoulders  +18,2pp     −4,5pp
 *
 * Sampel yang seluruhnya likuid bukan sampel pasar. Skrip ini yang jadi
 * patokan sejak sekarang; yang 18 emiten tetap ada untuk membandingkan
 * kerangka 4 jam, yang memang cuma punya arsip 18 emiten itu.
 *
 *   npx vite-node app/scripts/sapu-pola-klasik.ts           # harian
 *   npx vite-node app/scripts/sapu-pola-klasik.ts -- --tf=w # pekanan
 *
 * Kerangka 4 jam TIDAK bisa disapu penuh: ia butuh 60m Yahoo per emiten dan
 * arsip kita cuma memuat 18 — memanen 900-an emiten dari Yahoo bukan biaya
 * yang sepadan untuk satu angka pembanding.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PARAM_POLA_KLASIK_BAWAAN, cariPolaKlasik, LABEL_POLA_KLASIK } from '../src/lib/dasbor/polaKlasik.ts'
import { rakitBar, kunciPekan } from '../src/lib/dasbor/kerangkaWaktu.ts'
import type { LilinData, VolumeData } from '../src/lib/dasbor/grafikEmiten.ts'

const HOR = [5, 10, 20]
const arg = process.argv.slice(2)
const tf = (arg.find(a => a.startsWith('--tf=')) || '--tf=d').slice(5)
// Jalur dihitung dari LETAK BERKAS, bukan dari direktori kerja: skrip yang
// cuma jalan kalau dipanggil dari satu folder tertentu akan gagal senyap di
// CI dan di komputer orang lain.
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data-idx', 'json', 'ohlc')
const kode = readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5))

const kum: Record<number, { n: number; benar: number; dasar: number }> = {}
for (const h of HOR) kum[h] = { n: 0, benar: 0, dasar: 0 }
const perNama: Record<string, { n: number; benar: number; dasar: number }> = {}
let emitenPakai = 0, totalPola = 0

for (const k of kode) {
  let lilin: LilinData[]
  try {
    const j = JSON.parse(readFileSync(join(dir, `${k}.json`), 'utf8'))
    lilin = j.d.map(([time, open, high, low, close]: any) => ({ time, open, high, low, close }))
  } catch { continue }
  if (tf === 'w') {
    const vol: VolumeData[] = lilin.map(l => ({ time: l.time, value: 0, color: '' }))
    lilin = rakitBar(lilin, vol, kunciPekan, '#0a0', '#a00').lilin
  }
  if (lilin.length < 120) continue
  const pola = cariPolaKlasik(lilin, PARAM_POLA_KLASIK_BAWAAN)
  if (!pola.length) continue
  emitenPakai++; totalPola += pola.length
  for (const h of HOR) {
    let n = 0, naikDasar = 0
    for (let i = 0; i + h < lilin.length; i++) { n++; if (lilin[i + h].close > lilin[i].close) naikDasar++ }
    const d = n ? (naikDasar / n) * 100 : 50
    for (const q of pola) {
      if (q.iSinyal + h >= lilin.length) continue
      const naik = lilin[q.iSinyal + h].close > lilin[q.iSinyal].close
      const cocok = naik === (q.arah === 'bullish')
      const dasarArah = q.arah === 'bullish' ? d : 100 - d
      kum[h].n++; if (cocok) kum[h].benar++; kum[h].dasar += dasarArah
      const key = `${q.nama}|${h}`
      const pn = (perNama[key] ??= { n: 0, benar: 0, dasar: 0 })
      pn.n++; if (cocok) pn.benar++; pn.dasar += dasarArah
    }
  }
}

console.log(`SAPUAN PENUH — kerangka ${tf.toUpperCase()} · ${emitenPakai} emiten berpola dari ${kode.length} berkas · ${totalPola} pola\n`)
console.log('pola                          ' + HOR.map(h => `${h} lilin`.padStart(22)).join(''))
for (const nm of Object.keys(LABEL_POLA_KLASIK)) {
  const sel = HOR.map(h => {
    const p = perNama[`${nm}|${h}`]
    if (!p || !p.n) return '                     —'
    const b = (p.benar / p.n) * 100, d = p.dasar / p.n
    return `${b.toFixed(0)}% n=${String(p.n).padStart(4)} ${(b - d >= 0 ? '+' : '')}${(b - d).toFixed(1)}pp`.padStart(22)
  })
  console.log(LABEL_POLA_KLASIK[nm as keyof typeof LABEL_POLA_KLASIK].padEnd(28) + sel.join(''))
}
console.log('\nGABUNGAN:')
for (const h of HOR) {
  const k = kum[h]
  if (!k.n) continue
  const b = (k.benar / k.n) * 100, d = k.dasar / k.n
  console.log(`  ${String(h).padStart(2)} lilin  ${b.toFixed(1)}% benar (n=${k.n.toLocaleString()}, ${b - d >= 0 ? '+' : ''}${(b - d).toFixed(1)}pp di atas dasar ${d.toFixed(1)}%)`)
}
