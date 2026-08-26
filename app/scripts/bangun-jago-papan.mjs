/**
 * Pembangun cross-section Jago Papan — SATU tanggal (bar final tutup pasar
 * terakhir), 962 emiten, `data-idx/json/jago_papan/terbaru.json`. Beda dari
 * `bangun-harian-papan.mjs` (jendela 30 hari): Jago Papan tak punya pemilih
 * tanggal (spek batas keras: "bar final tutup pasar saja"), jadi cuma SATU
 * berkas keluaran.
 *
 * Nol jaringan: seluruhnya dibaca dari `ohlcv_stockbit/<KODE>.json` yang
 * sudah ada di cakram (chartbit — harga+volume+foreignbuy/foreignsell/
 * foreignflow dalam satu berkas per emiten, tak perlu menjahit sumber lain).
 *
 * Rumus di sini WAJIB sama persis dengan `hitungBarisJagoPapan()` di
 * `app/src/lib/dasbor/jagoPapan.ts` (Node tak bisa impor `.ts` langsung —
 * alasan sama `lib/skor.mjs`/`bangun-harian-papan.mjs`). Nilai acuan regresi
 * (spek §Bukti, PACK/PIPA/JARR/CSMI/VICI 21 Agu) diuji di `jagoPapan.test.ts`
 * atas fungsi TS-nya, BUKAN atas keluaran skrip ini — kalau rumus di sini
 * menyimpang dari versi TS, satu-satunya jaring pengaman adalah membaca
 * kedua berkas berdampingan saat menyunting salah satunya.
 *
 *   node app/scripts/bangun-jago-papan.mjs
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIR_JSON = join(AKAR, 'data-idx', 'json')
const DIR_OHLCV = join(DIR_JSON, 'ohlcv_stockbit')
const DIR_KELUARAN = join(DIR_JSON, 'jago_papan')

function bacaJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

// ── Primitif — WAJIB sama persis dgn jagoPapan.ts ──────────────────────
function sma(v, n) {
  if (v.length < n) return null
  let s = 0
  for (let i = v.length - n; i < v.length; i++) s += v[i]
  return s / n
}
function rata(v) {
  if (v.length === 0) return null
  return v.reduce((a, b) => a + b, 0) / v.length
}
function near52w(closes) {
  if (closes.length === 0) return null
  const jendela = closes.slice(-250)
  const puncak = Math.max(...jendela)
  return puncak > 0 ? closes[closes.length - 1] / puncak : null
}
function netAsingMa10(bar) {
  if (bar.length < 10) return null
  const dasar = bar.slice(-10).map((b) => (b[9] ?? 0) - (b[10] ?? 0))
  return rata(dasar)
}
function netAsingStreak(bar) {
  if (bar.length === 0) return 0
  const netTerakhir = (bar[bar.length - 1][9] ?? 0) - (bar[bar.length - 1][10] ?? 0)
  const arah = netTerakhir > 0 ? 1 : netTerakhir < 0 ? -1 : 0
  if (arah === 0) return 0
  let n = 0
  for (let i = bar.length - 1; i >= 0; i--) {
    const net = (bar[i][9] ?? 0) - (bar[i][10] ?? 0)
    const a = net > 0 ? 1 : net < 0 ? -1 : 0
    if (a !== arah) break
    n++
  }
  return n * arah
}
function foreignFlowMa20(bar) {
  if (bar.length < 20) return null
  return rata(bar.slice(-20).map((b) => b[11] ?? 0))
}
function tembusMa20HariIni(closes) {
  if (closes.length < 21) return false
  const ma20Kini = sma(closes, 20)
  const ma20Kemarin = sma(closes.slice(0, -1), 20)
  if (ma20Kini === null || ma20Kemarin === null) return false
  const closeKini = closes[closes.length - 1]
  const closeKemarin = closes[closes.length - 2]
  return closeKini > ma20Kini && closeKemarin <= ma20Kemarin
}

function hitungBarisJagoPapan(kode, nama, bar) {
  if (bar.length === 0) return null
  const closes = bar.map((b) => b[5])
  const volumes = bar.map((b) => b[6])
  const barIni = bar[bar.length - 1]
  const closeIni = closes[closes.length - 1]
  const closeKemarin = closes.length >= 2 ? closes[closes.length - 2] : null

  const volumeIni = barIni[6] ?? null
  const fb = barIni[9] ?? 0
  const fs = barIni[10] ?? 0

  return {
    kode,
    nama,
    harga: closeIni,
    chg_1d: closeKemarin && closeKemarin > 0 ? (closeIni / closeKemarin - 1) * 100 : null,
    ma5: sma(closes, 5),
    ma20: sma(closes, 20),
    mcap: barIni[14] ?? null,
    value: barIni[7] ?? null,
    volume: volumeIni,
    vol_ma20: sma(volumes, 20),
    near52w: near52w(closes),
    net_asing: fb - fs,
    net_asing_ma10: netAsingMa10(bar),
    net_asing_streak: netAsingStreak(bar),
    foreign_flow_kum: barIni[11] ?? null,
    foreign_flow_ma20: foreignFlowMa20(bar),
    tembus_ma20_hari_ini: tembusMa20HariIni(closes),
    beku: (volumeIni ?? 0) === 0,
  }
}

// ── Main ────────────────────────────────────────────────────────────────
const daftar = bacaJson(join(DIR_JSON, 'daftar_emiten.json'))
const namaByKode = new Map((daftar?.emiten ?? []).map((e) => [e.kode, e.nama]))

const fileOhlcv = readdirSync(DIR_OHLCV)
  .filter((f) => f.endsWith('.json') && !f.startsWith('_') && f !== 'IHSG.json') // IHSG = indeks, bukan barang dagangan broker
  .sort()

// Tanggal bursa terakhir = MODUS tanggal bar terakhir tiap emiten (sama
// alasan bangun-harian-papan.mjs: bukan dari satu emiten acak yang bisa
// telat kalau ia disuspensi hari ini).
const hitungTanggal = new Map()
const berkasByKode = new Map()
for (const f of fileOhlcv) {
  const kode = f.replace(/\.json$/, '')
  const d = bacaJson(join(DIR_OHLCV, f))
  const bar = d?.bar
  if (!Array.isArray(bar) || bar.length === 0) continue
  berkasByKode.set(kode, bar)
  const last = bar.at(-1)?.[0]
  if (last) hitungTanggal.set(last, (hitungTanggal.get(last) ?? 0) + 1)
}
const tanggalTerakhir = [...hitungTanggal.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
if (!tanggalTerakhir) {
  console.error('Tak ada satu pun tanggal bar ditemukan di ohlcv_stockbit/.')
  process.exit(1)
}

const emiten = []
for (const [kode, bar] of berkasByKode) {
  // Emiten yang bar terakhirnya BUKAN tanggalTerakhir dilewati (suspensi/
  // baru delisting) — sama syarat bangun-harian-papan.mjs per tanggal.
  if (bar.at(-1)?.[0] !== tanggalTerakhir) continue
  const nama = namaByKode.get(kode) ?? null
  const row = hitungBarisJagoPapan(kode, nama, bar)
  if (row) emiten.push(row)
}

mkdirSync(DIR_KELUARAN, { recursive: true })
const diperbarui = new Date().toISOString()
writeFileSync(
  join(DIR_KELUARAN, 'terbaru.json'),
  JSON.stringify({ tanggal: tanggalTerakhir, diperbarui, n: emiten.length, emiten }),
)

console.log(`tanggal bursa terakhir (modus): ${tanggalTerakhir}`)
console.log(`selesai: ${emiten.length} emiten -> ${join(DIR_KELUARAN, 'terbaru.json')}`)
