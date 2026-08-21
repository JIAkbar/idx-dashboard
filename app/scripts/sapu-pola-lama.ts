/**
 * SAPUAN PENUH pola LAMA (generasi pertama, `grafikEmiten.ts`) — Double
 * Bottom, Lonjakan Volume, Divergensi, Harmonik. Meniru PERSIS metodologi
 * `sapu-pola-klasik.ts` (baca itu dulu): seluruh `data-idx/json/ohlc/*.json`
 * (bukan sampel), peluang dasar arah yang sama DIHITUNG PER EMITEN, horizon
 * 5/10/20 lilin, bebas bocor masa depan. Wyckoff & Struktur Pasar tak ikut
 * (fase, bukan sinyal titik; struktur sudah disapu `backtest-struktur.ts`).
 * Musiman juga tak ikut (bukan sinyal).
 *
 * SINYAL per pola — lilin tempat "sudah tahu polanya ada" tanpa mengintip
 * masa depan, dan alasannya:
 *
 * - Double Bottom: lilin KONFIRMASI (`iKonfirmasi`, status==='terkonfirmasi'
 *   saja — 'terbentuk'/'batal' tak pernah jadi sinyal). Arah selalu bullish,
 *   itu definisi polanya (breakout ke atas leher).
 * - Lonjakan Volume: lilin lonjakan itu sendiri (`i`) — sudah kausal, RVOL
 *   cuma memakai `periode` hari SEBELUM `i`. BUKAN pola arah murni: syarat
 *   masuknya sendiri sudah "naik >= naikMin%", jadi peluang dasarnya sengaja
 *   dibandingkan terhadap peluang naik (bukan turun) — hasilnya dilaporkan
 *   apa adanya, jangan dibaca sebagai bukti pola ini "meramal" kenaikan.
 * - Divergensi: pivot KEDUA (`i2`) + `p.jendela` lilin. `cariPivotTinggi`/
 *   `cariPivotRendah` baru mengakui `i2` sebagai pivot setelah `jendela`
 *   lilin di KANANNYA sudah ada (syarat jendela penuh di kedua sisi) — jadi
 *   memakai `i2` mentah sebagai sinyal berarti diam-diam memakai `jendela`
 *   lilin yang belum terjadi. Sinyal sebenarnya baru sah di `i2 + jendela`.
 * - Harmonik: titik D (`indeks[4]`) + `p.jendela` lilin, alasan sama persis
 *   dengan Divergensi — D juga pivot zigzag dari pencari yang sama.
 *
 *   npx vite-node app/scripts/sapu-pola-lama.ts
 *
 * HASIL (SAPUAN PENUH, 915 emiten berpola dari 964 berkas — output apa
 * adanya, tak dihaluskan walau negatif):
 *
 * pola                                         5 lilin              10 lilin              20 lilin
 * Double Bottom                   43% n=11536 +1.3pp    43% n=11485 +0.1pp    42% n=11425 -0.8pp
 * Lonjakan Volume                39% n=203463 -1.3pp   40% n=202816 -0.8pp   41% n=201368 -0.3pp
 * Divergensi                      48% n=42687 -0.8pp    48% n=42549 -0.7pp    48% n=42250 -0.6pp
 * Harmonik                         54% n=1090 +5.8pp     52% n=1084 +3.1pp     51% n=1069 +2.6pp
 *
 * Berbeda dari pola klasik (`sapu-pola-klasik.ts`), yang generasi pertama ini
 * TIDAK ada yang jelas kuat. Double Bottom nyaris rata dan malah membalik
 * NEGATIF di horizon 20 lilin (-0.8pp) — breakout leher terkonfirmasi TIDAK
 * berarti lanjutan berarti di sini. Lonjakan Volume negatif di ketiga
 * horizon (-1.3 sampai -0.3pp): seperti diduga di komentar sinyalnya, ini
 * bukan pola arah murni — definisinya sendiri sudah mensyaratkan "naik
 * >= naikMin%", jadi angka ini mengukur "apakah kenaikan itu BERLANJUT",
 * dan jawabannya justru sedikit di bawah dasar (RVOL tinggi lebih sering
 * diikuti koreksi/konsolidasi daripada lanjutan). Divergensi konsisten
 * negatif tipis (-0.6 sampai -0.8pp) di ketiga horizon — divergensi
 * regular di sini TIDAK terbukti unggul dari dasar. Harmonik satu-satunya
 * yang positif di ketiga horizon (+5.8 turun ke +2.6pp), tapi n-nya jauh
 * paling kecil (1.090 — pola XABCD memang langka), jadi keyakinannya paling
 * rendah dari keempatnya.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  keDataLilinVolume, cariDoubleBottom, cariLonjakanVolume, cariDivergensi, stochUntukDivergensi,
  cariHarmonik, SPEK_POLA,
  type LilinData, type BerkasOhlcEmiten,
  type ParamDoubleBottom, type ParamLonjakanVolume, type ParamDivergensi, type ParamHarmonik,
} from '../src/lib/dasbor/grafikEmiten.ts'
import { muatKatalog } from '../src/lib/dasbor/katalogIndikator.ts'

const HOR = [5, 10, 20]
// Jalur dihitung dari LETAK BERKAS, sama seperti sapu-pola-klasik.ts.
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data-idx', 'json', 'ohlc')
const kode = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))

/** Bawaan diambil dari `SPEK_POLA` — satu-satunya tempat angka itu boleh
 *  hidup — bukan disalin tangan di sini. Sama seperti pola tes yang sudah ada
 *  (`grafikEmiten.test.ts`). */
function paramBawaan<T>(jenis: keyof typeof SPEK_POLA): T {
  return Object.fromEntries(SPEK_POLA[jenis].param.map((s) => [s.kunci, s.bawaan])) as T
}
const P_DB = paramBawaan<ParamDoubleBottom>('doubleBottom')
const P_LV = paramBawaan<ParamLonjakanVolume>('lonjakanVolume')
const P_DV = paramBawaan<ParamDivergensi>('divergensi')
const P_HM = paramBawaan<ParamHarmonik>('harmonik')

const NAMA_POLA = ['Double Bottom', 'Lonjakan Volume', 'Divergensi', 'Harmonik'] as const
type NamaPola = (typeof NAMA_POLA)[number]

interface Sinyal { i: number; arah: 'bullish' | 'bearish' }

const kum: Record<NamaPola, Record<number, { n: number; benar: number; dasar: number }>> =
  Object.fromEntries(NAMA_POLA.map((nm) => [nm, Object.fromEntries(HOR.map((h) => [h, { n: 0, benar: 0, dasar: 0 }]))])) as any

// Katalog pustaka dimuat SEKALI — Divergensi memakainya untuk %K Stochastic,
// jalur yang sama persis dengan yang tergambar di kanvas (`stochUntukDivergensi`).
const katalog = await muatKatalog()

let emitenPakai = 0

for (const k of kode) {
  let lilin: LilinData[]
  let vol: number[]
  try {
    const j: BerkasOhlcEmiten = JSON.parse(readFileSync(join(dir, `${k}.json`), 'utf8'))
    // Hari tanpa perdagangan WAJIB tersaring sebelum masuk Lonjakan Volume &
    // Double Bottom (lihat dokumentasi `keDataLilinVolume`/`cariLonjakanVolume`)
    // — kalau tidak, RVOL & volumeMenguat dihitung dari volume nol palsu.
    const d = keDataLilinVolume(j.d, '#0a0', '#a00')
    lilin = d.lilin
    vol = d.volume.map((v) => v.value)
  } catch { continue }
  if (lilin.length < 120) continue

  const sinyal: Record<NamaPola, Sinyal[]> = {
    'Double Bottom': [], 'Lonjakan Volume': [], Divergensi: [], Harmonik: [],
  }

  for (const q of cariDoubleBottom(lilin, vol, P_DB)) {
    if (q.status === 'terkonfirmasi' && q.iKonfirmasi !== null) {
      sinyal['Double Bottom'].push({ i: q.iKonfirmasi, arah: 'bullish' })
    }
  }

  for (const q of cariLonjakanVolume(lilin, vol, P_LV)) {
    sinyal['Lonjakan Volume'].push({ i: q.i, arah: 'bullish' })
  }

  const stoch = stochUntukDivergensi(lilin, vol, P_DV, katalog)
  if (stoch.length === lilin.length) {
    for (const q of cariDivergensi(lilin, vol, stoch, P_DV)) {
      const i = q.i2 + P_DV.jendela
      if (i < lilin.length) sinyal.Divergensi.push({ i, arah: q.arah })
    }
  }

  for (const q of cariHarmonik(lilin, P_HM)) {
    const i = q.indeks[4] + P_HM.jendela
    if (i < lilin.length) sinyal.Harmonik.push({ i, arah: q.arah })
  }

  if (!NAMA_POLA.some((nm) => sinyal[nm].length > 0)) continue
  emitenPakai++

  for (const h of HOR) {
    let n = 0, naikDasar = 0
    for (let i = 0; i + h < lilin.length; i++) { n++; if (lilin[i + h].close > lilin[i].close) naikDasar++ }
    const d = n ? (naikDasar / n) * 100 : 50
    for (const nm of NAMA_POLA) {
      for (const s of sinyal[nm]) {
        if (s.i + h >= lilin.length) continue
        const naik = lilin[s.i + h].close > lilin[s.i].close
        const cocok = naik === (s.arah === 'bullish')
        const dasarArah = s.arah === 'bullish' ? d : 100 - d
        const kk = kum[nm][h]
        kk.n++; if (cocok) kk.benar++; kk.dasar += dasarArah
      }
    }
  }
}

console.log(`SAPUAN PENUH pola LAMA — ${emitenPakai} emiten berpola dari ${kode.length} berkas\n`)
console.log('pola                          ' + HOR.map((h) => `${h} lilin`.padStart(22)).join(''))
for (const nm of NAMA_POLA) {
  const sel = HOR.map((h) => {
    const p = kum[nm][h]
    if (!p.n) return '                     —'
    const b = (p.benar / p.n) * 100, d = p.dasar / p.n
    return `${b.toFixed(0)}% n=${String(p.n).padStart(4)} ${(b - d >= 0 ? '+' : '')}${(b - d).toFixed(1)}pp`.padStart(22)
  })
  console.log(nm.padEnd(28) + sel.join(''))
}
