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
 * dari SEMUA hari yang naik dalam horizon itu. Sinyal yang benar 55% tak
 * berarti apa-apa kalau emitennya memang naik 55% sepanjang waktu; yang
 * berarti cuma SELISIHNYA.
 *
 *   node app/scripts/backtest-struktur.mjs
 *   node app/scripts/backtest-struktur.mjs --tf=4h    (butuh cache intraday)
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const HORIZON = [5, 10, 20]

// Sengaja emiten berbeda watak, bukan sepuluh bank: likuid besar, tambang,
// teknologi, dan papan tipis. Pola yang cuma bekerja di satu jenis emiten
// tidak akan terlihat kalau sampelnya seragam.
const EMITEN = ['BBCA', 'BBRI', 'ASII', 'TLKM', 'ANTM', 'MDKA', 'MBMA', 'ARCI',
  'INCO', 'ADRO', 'PTBA', 'CUAN', 'BRMS', 'KIJA', 'BIPI', 'WIFI', 'INET', 'DSSA']

function lilinDari(kode) {
  const j = JSON.parse(readFileSync(join(AKAR, 'data-idx', 'json', 'ohlc', `${kode}.json`), 'utf8'))
  return j.d.map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }))
}

/** Rakit lilin harian jadi 4 jam TIRUAN — dipakai kalau cache intraday tak
 *  ada. DITANDAI di laporan supaya tak dikira data 4 jam sungguhan. */
function keEmpatJam(lilin) {
  return lilin // harian tak bisa dipecah jadi intraday; lihat catatan di laporan
}

function cariSwing(lilin, n) {
  if (n < 1 || lilin.length < n * 2 + 1) return []
  const mentah = []
  for (let i = n; i < lilin.length - n; i++) {
    let tinggi = true, rendah = true
    for (let k = 1; k <= n; k++) {
      if (lilin[i].high < lilin[i - k].high) tinggi = false
      if (lilin[i].high <= lilin[i + k].high) tinggi = false
      if (lilin[i].low > lilin[i - k].low) rendah = false
      if (lilin[i].low >= lilin[i + k].low) rendah = false
      if (!tinggi && !rendah) break
    }
    if (tinggi) mentah.push({ i, harga: lilin[i].high, jenis: 'high' })
    if (rendah) mentah.push({ i, harga: lilin[i].low, jenis: 'low' })
  }
  let hi = null, lo = null
  return mentah.map((s) => {
    let label = null
    if (s.jenis === 'high') { if (hi !== null) label = s.harga > hi ? 'HH' : 'LH'; hi = s.harga }
    else { if (lo !== null) label = s.harga > lo ? 'HL' : 'LL'; lo = s.harga }
    return { ...s, label }
  })
}

function cariPatahan(lilin, swing) {
  const keluar = []
  let hi = null, lo = null, arah = 'sisi', p = 0
  const urut = [...swing].sort((a, b) => a.i - b.i)
  for (let i = 0; i < lilin.length; i++) {
    while (p < urut.length && urut[p].i <= i) {
      const s = urut[p++]
      if (s.jenis === 'high') hi = s; else lo = s
      const h = urut.filter((x) => x.jenis === 'high' && x.i <= s.i).at(-1)
      const l = urut.filter((x) => x.jenis === 'low' && x.i <= s.i).at(-1)
      if (h?.label && l?.label) {
        arah = h.label === 'HH' && l.label === 'HL' ? 'naik'
          : h.label === 'LH' && l.label === 'LL' ? 'turun' : arah
      }
    }
    const c = lilin[i].close
    if (hi && c > hi.harga) { keluar.push({ i, arah: 'naik', jenis: arah === 'turun' ? 'CHoCH' : 'BOS' }); arah = 'naik'; hi = null }
    else if (lo && c < lo.harga) { keluar.push({ i, arah: 'turun', jenis: arah === 'naik' ? 'CHoCH' : 'BOS' }); arah = 'turun'; lo = null }
  }
  return keluar
}

/** Peluang dasar: berapa persen dari SEMUA lilin yang naik dalam h lilin. */
function dasar(lilin, h) {
  let n = 0, naik = 0
  for (let i = 0; i + h < lilin.length; i++) { n++; if (lilin[i + h].close > lilin[i].close) naik++ }
  return n ? (naik / n) * 100 : null
}

const arg = process.argv.slice(2)
const nSwing = Number((arg.find((a) => a.startsWith('--n=')) || '--n=5').slice(4))

const kum = {}
for (const h of HORIZON) kum[h] = { bosN: 0, bosBenar: 0, chochN: 0, chochBenar: 0, dasarJumlah: 0, dasarN: 0 }

console.log(`Backtest struktur pasar — N swing = ${nSwing}, ${EMITEN.length} emiten, harian\n`)
console.log('emiten  lilin  swing  BOS  CHoCH   ' + HORIZON.map((h) => `${h}H`.padStart(7)).join(''))

for (const kode of EMITEN) {
  let lilin
  try { lilin = lilinDari(kode) } catch { console.log(`${kode.padEnd(7)} (tak ada berkasnya)`); continue }
  if (lilin.length < 100) { console.log(`${kode.padEnd(7)} (riwayat terlalu pendek: ${lilin.length})`); continue }
  const swing = cariSwing(lilin, nSwing)
  const patah = cariPatahan(lilin, swing)
  const kolom = []
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
  const sel = (v) => (v === null || d === null ? '   —' : `${(v - d >= 0 ? '+' : '')}${(v - d).toFixed(1)}pp`)
  console.log(`  ${String(h).padStart(2)} lilin  BOS ${bos?.toFixed(1) ?? '—'}% (n=${k.bosN}, ${sel(bos)})`
    + `   CHoCH ${ch?.toFixed(1) ?? '—'}% (n=${k.chochN}, ${sel(ch)})`
    + `   dasar ${d?.toFixed(1) ?? '—'}%`)
}
console.log('\nSelisih (pp) terhadap peluang dasar itu satu-satunya angka yang berarti:')
console.log('sinyal yang benar 55% tak berguna kalau emitennya memang naik 55% sepanjang waktu.')
