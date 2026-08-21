/**
 * Backtest struktur pasar (swing HH/HL/LH/LL + BOS/CHoCH) atas OHLC NYATA.
 *
 * Johan 21 Agu 2026: "cek ke validitas nya di 1D 4H backtest di beberapa
 * saham". Yang diukur satu pertanyaan yang bisa salah:
 *
 *   Sesudah patahan struktur, apakah harga benar-benar melanjut ke arah itu
 *   lebih sering daripada kebetulan?
 *
 * Pembandingnya WAJIB ada dan itu inti skrip ini: tiap sinyal dibandingkan
 * dengan PELUANG DASAR emiten yang sama di periode yang sama — berapa persen
 * dari SEMUA lilin yang naik dalam horizon itu. Sinyal yang benar 55% tak
 * berarti apa-apa kalau emitennya memang naik 55% sepanjang waktu; yang
 * berarti cuma SELISIHNYA.
 *
 * ## Kenapa `.ts` dan bukan `.mjs`
 *
 * Versi pertama skrip ini menyalin `cariSwing` dan `cariPatahan` ke dalam
 * dirinya sendiri supaya bisa jalan sebagai JavaScript polos. Seorang agen
 * penyanggah menunjukkan akibatnya: salinan itu masih memakai gerbang
 * `urut[p].i <= i` yang sudah dibetulkan di `strukturPasar.ts` (kebocoran
 * masa depan — swing dipakai sebelum `n` lilin konfirmasinya ada), jadi
 * angka yang MEMBENARKAN fitur ini diukur dari kode yang tidak dikirim ke
 * pengguna. Terukur pada N=5: keunggulan BOS 5 lilin +12,7pp versi bocor
 * lawan +4,7pp versi jujur — hampir tiga kali lipat.
 *
 * Karena itu sekarang ia mengimpor rumus yang SAMA PERSIS dengan yang dipakai
 * layar. Node 24 melucuti tipe TypeScript sendiri, jadi tak ada peranti bangun
 * tambahan yang perlu dipasang.
 *
 *   node app/scripts/backtest-struktur.ts
 *   node app/scripts/backtest-struktur.ts --tf=4h    (ambil 1 jam dari Yahoo)
 *   node app/scripts/backtest-struktur.ts --n=3 --tf=4h
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { N_SWING_BAWAAN, cariPatahan, cariSwing } from '../src/lib/dasbor/strukturPasar.ts'
import { dariYahoo, kunci4Jam, rakitBar } from '../src/lib/dasbor/kerangkaWaktu.ts'
import type { YahooIntradayJson } from '../src/lib/dasbor/kerangkaWaktu.ts'
import type { LilinData, VolumeData } from '../src/lib/dasbor/grafikEmiten.ts'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const HORIZON = [5, 10, 20]

// Sengaja emiten berbeda watak, bukan sepuluh bank: likuid besar, tambang,
// teknologi, dan papan tipis. Pola yang cuma bekerja di satu jenis emiten
// tidak akan terlihat kalau sampelnya seragam.
const EMITEN = ['BBCA', 'BBRI', 'ASII', 'TLKM', 'ANTM', 'MDKA', 'MBMA', 'ARCI',
  'INCO', 'ADRO', 'PTBA', 'CUAN', 'BRMS', 'KIJA', 'BIPI', 'WIFI', 'INET', 'DSSA']

function harian(kode: string): LilinData[] {
  const j = JSON.parse(readFileSync(join(AKAR, 'data-idx', 'json', 'ohlc', `${kode}.json`), 'utf8'))
  return j.d.map(([time, open, high, low, close]: [string, number, number, number, number]) =>
    ({ time, open, high, low, close }))
}

/**
 * Lilin 4 jam: 1 jam dari Yahoo, dirakit lewat `rakitBar`/`kunci4Jam` yang
 * SAMA dengan yang dipakai halaman grafik.
 *
 * Mentahnya diarsipkan ke `_arsip-mentah/yahoo-60m/` dan dibaca dari sana
 * lebih dulu — aturan proyek yang sudah dibayar sekali: yang mahal MENGAMBIL
 * data, bukan menyimpannya. Di sini alasannya bahkan lebih tajam: Yahoo cuma
 * menyimpan ±2 tahun interval 60m, jadi jendela yang lewat hari ini tak bisa
 * diambil lagi besok.
 */
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
      // User-Agent peramban, BUKAN bawaan Node: terukur 18 Agu 2026, itu yang
      // membedakan 200 dari 429 — bukan alamat IP-nya.
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

/** Peluang dasar: berapa persen dari SEMUA lilin yang naik dalam h lilin. */
function dasar(lilin: LilinData[], h: number): number | null {
  let n = 0, naik = 0
  for (let i = 0; i + h < lilin.length; i++) { n++; if (lilin[i + h].close > lilin[i].close) naik++ }
  return n ? (naik / n) * 100 : null
}

const arg = process.argv.slice(2)
const nSwing = Number((arg.find((a) => a.startsWith('--n=')) || `--n=${N_SWING_BAWAAN}`).slice(4))
const tf = (arg.find((a) => a.startsWith('--tf=')) || '--tf=D').slice(5).toLowerCase()
if (tf !== 'd' && tf !== '4h') throw new Error(`--tf hanya menerima D atau 4h (diberi: ${tf})`)

interface Kum {
  bosN: number; bosBenar: number; chochN: number; chochBenar: number
  dasarJumlah: number; dasarN: number
}
const kum: Record<number, Kum> = {}
for (const h of HORIZON) kum[h] = { bosN: 0, bosBenar: 0, chochN: 0, chochBenar: 0, dasarJumlah: 0, dasarN: 0 }

console.log(`Backtest struktur pasar — N swing = ${nSwing}, ${EMITEN.length} emiten, `
  + `${tf === '4h' ? '4 jam (1h Yahoo dirakit)' : 'harian'}\n`)
console.log('emiten  lilin  swing  BOS  CHoCH   ' + HORIZON.map((h) => `${h}H`.padStart(7)).join(''))

for (const kode of EMITEN) {
  let lilin: LilinData[]
  try {
    lilin = tf === '4h' ? await empatJam(kode) : harian(kode)
  } catch (e) {
    console.log(`${kode.padEnd(7)} (${(e as Error).message})`)
    continue
  }
  if (lilin.length < 100) { console.log(`${kode.padEnd(7)} (riwayat terlalu pendek: ${lilin.length})`); continue }
  const swing = cariSwing(lilin, nSwing)
  const patah = cariPatahan(lilin, swing, nSwing)
  const kolom: string[] = []
  for (const h of HORIZON) {
    let n = 0, benar = 0
    for (const p of patah) {
      if (p.i + h >= lilin.length) continue
      n++
      const naik = lilin[p.i + h].close > lilin[p.i].close
      if (naik === (p.arah === 'naik')) benar++
      const k = kum[h]
      if (p.jenis === 'BOS') { k.bosN++; if (naik === (p.arah === 'naik')) k.bosBenar++ }
      else { k.chochN++; if (naik === (p.arah === 'naik')) k.chochBenar++ }
    }
    const d = dasar(lilin, h)
    kum[h].dasarJumlah += d ?? 0
    kum[h].dasarN++
    kolom.push(n ? `${((benar / n) * 100).toFixed(0)}%`.padStart(7) : '     — ')
  }
  console.log(`${kode.padEnd(7)}${String(lilin.length).padStart(6)}${String(swing.length).padStart(7)}`
    + `${String(patah.filter((p) => p.jenis === 'BOS').length).padStart(5)}`
    + `${String(patah.filter((p) => p.jenis === 'CHoCH').length).padStart(7)}   ${kolom.join('')}`)
}

console.log('\nGabungan — arah benar sesudah patahan vs peluang dasar emiten yang sama:')
for (const h of HORIZON) {
  const k = kum[h]
  const bos = k.bosN ? (k.bosBenar / k.bosN) * 100 : null
  const ch = k.chochN ? (k.chochBenar / k.chochN) * 100 : null
  const d = k.dasarN ? k.dasarJumlah / k.dasarN : null
  const sel = (v: number | null) => (v === null || d === null ? '   —' : `${(v - d >= 0 ? '+' : '')}${(v - d).toFixed(1)}pp`)
  console.log(`  ${String(h).padStart(2)} lilin  BOS ${bos?.toFixed(1) ?? '—'}% (n=${k.bosN}, ${sel(bos)})`
    + `   CHoCH ${ch?.toFixed(1) ?? '—'}% (n=${k.chochN}, ${sel(ch)})`
    + `   dasar ${d?.toFixed(1) ?? '—'}%`)
}
console.log('\nSelisih (pp) terhadap peluang dasar itu satu-satunya angka yang berarti:')
console.log('sinyal yang benar 55% tak berguna kalau emitennya memang naik 55% sepanjang waktu.')
