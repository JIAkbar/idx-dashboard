/**
 * Pembangun data Screener — satu baris per emiten, `data-idx/json/screener.json`.
 *
 * Nol jaringan: seluruhnya dibaca dari berkas yang sudah ada di cakram
 * (`data-idx/json/{ohlc,asing,fundamental}/<KODE>.json` +
 * `daftar_emiten.json`). Halaman tabelnya dikerjakan terpisah — skrip ini
 * cuma menyiapkan datanya.
 *
 * Rumus skor teknikal (sss_d/w/m, tdm_persen) hidup di `lib/skor.mjs`, port
 * JS dari `app/src/lib/dasbor/skorTeknikal.ts`. `lib/skorTeknikal.crossCheck.test.mjs`
 * membandingkan keduanya pada data nyata; jalankan `npx vitest run` di
 * `app/` kalau menyentuh rumusnya.
 *
 *   node app/scripts/bangun-screener.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rakitPeriode, sma, emaAkhir, skorTigaKerangka, momentumPersen } from './lib/skor.mjs'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIR_JSON = join(AKAR, 'data-idx', 'json')
const DIR_OHLC = join(DIR_JSON, 'ohlc')
const DIR_ASING = join(DIR_JSON, 'asing')
const DIR_FUND = join(DIR_JSON, 'fundamental')
const KELUARAN = join(DIR_JSON, 'screener.json')

// Berapa hari bursa untuk rata-rata volume pembagi rvol10, dan berapa hari
// untuk jumlah net asing — dipisah dari MOMENTUM_HARI (skor.mjs) karena
// tak ada alasan ketiganya harus sama.
const RVOL_N = 10
const ASING_N = 20
// Jendela median likuiditas — sama panjang ASING_N, tak ada alasan keduanya
// harus beda.
const LIKUIDITAS_N = 20

/** Median, BUKAN rata-rata: satu hari crossing raksasa (mis. DSSA Rp1,42 T
 *  di pasar negosiasi, 19 Agu 2026) menaikkan rata-rata sebulan tanpa
 *  membuat sahamnya benar-benar mudah dijual keesokan harinya — lihat
 *  docs/likuiditas-acuan.md. */
function median(arr) {
  if (arr.length === 0) return null
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function bacaJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

const daftar = bacaJson(join(DIR_JSON, 'daftar_emiten.json'))
const namaByKode = new Map((daftar?.emiten ?? []).map((e) => [e.kode, e.nama]))
// Sektor dari peta IDX-IC RESMI (emiten_sektor.json, 962/962) — keputusan
// Johan 26 Agu (spek kedalaman §3). Dulu dari data fundamental = taksonomi
// GICS/Yahoo: 46 emiten '-' padahal sektornya ada, dan tooltip yang
// mengklaim "IDX-IC" bohong untuk SELURUH kolom (TLKM "Communication
// Services" vs resmi "Infrastruktur"). GICS tak dibuang — tetap di
// fundamental/*.json sebagai cadangan.
const petaSektor = bacaJson(join(DIR_JSON, 'emiten_sektor.json'))
const sektorByKode = new Map(
  Object.entries(petaSektor?.emiten ?? {}).map(([k, v]) => [k, v?.sektor ?? null]),
)

const fileOhlc = readdirSync(DIR_OHLC)
  .filter((f) => f.endsWith('.json') && !f.startsWith('_') && f !== 'IHSG.json') // IHSG = indeks komposit, bukan emiten
  .sort()

// Pass 1: "hari bursa terakhir" diambil dari MODUS tanggal penutupan terakhir
// tiap emiten — BUKAN dari cal_index.json (basi, berhenti Juni) dan bukan
// dari satu emiten acak (bisa telat kalau emiten itu disuspensi hari ini).
const hitungTanggal = new Map()
for (const f of fileOhlc) {
  const last = bacaJson(join(DIR_OHLC, f))?.d?.at(-1)?.[0]
  if (last) hitungTanggal.set(last, (hitungTanggal.get(last) ?? 0) + 1)
}
const tanggalTerakhir = [...hitungTanggal.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

/** 'atas' | 'bawah' — null kalau v tak terhitung ATAU harga persis di v. */
function posisiHarga(harga, v) {
  if (v === null) return null
  if (harga > v) return 'atas'
  if (harga < v) return 'bawah'
  return null
}

const emiten = []
const dilewati = { ohlcKosong: 0 }

for (const f of fileOhlc) {
  const kode = f.replace(/\.json$/, '')
  const ohlc = bacaJson(join(DIR_OHLC, f))
  const baris = ohlc?.d
  if (!Array.isArray(baris) || baris.length === 0) {
    dilewati.ohlcKosong++ // "seri kosong" — emiten tanpa satu pun baris harga terpanen
    continue
  }

  const tutup = baris.map((b) => b[4])
  const vol = baris.map((b) => b[5])
  const harga = tutup.at(-1)

  // rvol10: volume hari terakhir / rata-rata volume 10 hari SEBELUM hari
  // terakhir. Butuh 11 titik penuh — sengaja tak dilonggarkan, rata-rata dari
  // <10 hari bukan baseline yang sama artinya.
  let rvol10 = null
  if (vol.length >= RVOL_N + 1) {
    const dasar = vol.slice(-(RVOL_N + 1), -1)
    const rata = dasar.reduce((a, b) => a + (b ?? 0), 0) / dasar.length
    rvol10 = rata > 0 ? vol.at(-1) / rata : null
  }

  // close_gap & chg_1d butuh minimal 2 lilin (hari ini + kemarin).
  let closeGap = null
  let chg1d = null
  if (baris.length >= 2) {
    const kemarin = baris.at(-2)[4]
    const bukaHariIni = baris.at(-1)[1]
    if (kemarin > 0) {
      closeGap = ((bukaHariIni - kemarin) / kemarin) * 100
      chg1d = (harga / kemarin - 1) * 100
    }
  }

  // chg_wtd/mtd = perubahan sejak penutupan pekan/bulan SEBELUMNYA (bukan
  // pekan/bulan berjalan yang masih ada di indeks terakhir rakitPeriode).
  const mingguan = rakitPeriode(baris, 'pekan')
  const bulanan = rakitPeriode(baris, 'bulan')
  const chgWtd = mingguan.length >= 2 && mingguan.at(-2)[4] > 0
    ? (harga / mingguan.at(-2)[4] - 1) * 100 : null
  const chgMtd = bulanan.length >= 2 && bulanan.at(-2)[4] > 0
    ? (harga / bulanan.at(-2)[4] - 1) * 100 : null

  // ma20_arah: apakah MA20 ITU SENDIRI sedang naik/turun (bukan posisi harga
  // terhadapnya) — dibandingkan ke MA20 satu hari sebelumnya.
  const ma20Kini = sma(tutup, 20)
  const ma20Lalu = tutup.length >= 21 ? sma(tutup.slice(0, -1), 20) : null
  const ma20Arah = ma20Kini === null || ma20Lalu === null ? null
    : ma20Kini > ma20Lalu ? 'naik' : ma20Kini < ma20Lalu ? 'turun' : 'datar'

  // Likuiditas: median nilai transaksi (close × volume) 20 hari bursa
  // terakhir — dari whatever tersedia kalau riwayatnya belum 20 hari (sama
  // pola partial-window dengan netAsingLembar di bawah).
  const nilaiHarian = baris.slice(-LIKUIDITAS_N).map((b) => b[4] * b[5])
  const likuiditas = median(nilaiHarian)

  const ema5 = emaAkhir(tutup, 5)
  const ma10 = sma(tutup, 10)

  const t3 = skorTigaKerangka(baris)

  const asing = bacaJson(join(DIR_ASING, `${kode}.json`))?.d
  const asingMentah = Array.isArray(asing) ? asing : []
  // Audit 21 Agu 2026 (#1): dua sumber per-kode ini TIDAK dijamin sekalender.
  // Terukur 128 dari 962 emiten (13%) tanggal terakhir `asing/` ≠ `ohlc/` —
  // kebanyakan asing sehari lebih baru, kasus ekstrem ARMY selisih sebulan.
  // Tanpa pemotongan, kolom Nilai/Net Asing sebuah baris melaporkan hari
  // bursa yang BEDA dari kolom Harga/%chg di baris yang sama, dan kaki
  // halaman tetap menyebut satu tanggal seolah seragam. Barisnya dipotong
  // sampai tanggal basis OHLC: kelebihan hari dibuang, bukan dibiarkan.
  const tglBasis = baris.at(-1)?.[0]
  const asingBaris = tglBasis ? asingMentah.filter((b) => b[0] <= tglBasis) : asingMentah
  // Nilai transaksi hanya diisi kalau tanggalnya PERSIS tanggal basis —
  // nilai kemarin yang mengaku hari ini lebih buruk daripada strip.
  const nilai = asingBaris.at(-1)?.[0] === tglBasis ? asingBaris.at(-1)?.[4] ?? null : null
  let netAsingLembar = null
  if (asingBaris.length > 0) {
    // Dijumlahkan 20 hari bursa terakhir; kalau riwayatnya belum 20 hari
    // (emiten baru), dijumlahkan sepanjang yang ada — bukan null, karena
    // jumlah parsial tetap informasi asli, bukan angka yang diarang.
    const jendela = asingBaris.slice(-ASING_N)
    netAsingLembar = jendela.reduce((a, b) => a + (b[1] - b[2]), 0)
  }

  const fund = bacaJson(join(DIR_FUND, `${kode}.json`))

  emiten.push({
    kode,
    nama: namaByKode.get(kode) ?? null,
    // '-' saat peta resmi tak memuat kodenya — BUKAN null: `sektorUnik()`
    // memanggil localeCompare pada tiap nilai, dan satu null menjatuhkan
    // seluruh halaman (audit 21 Agu #2). '-' sudah punya arti di UI:
    // "Tanpa sektor".
    sektor: sektorByKode.get(kode) ?? '-',
    harga,
    tdm_persen: momentumPersen(baris),
    volume: vol.at(-1) ?? null,
    rvol10,
    nilai,
    likuiditas,
    sss_d: t3.harian?.label ?? null,
    sss_w: t3.pekanan?.label ?? null,
    sss_m: t3.bulanan?.label ?? null,
    free_float: fund?.float_pct ?? null,
    ma20_arah: ma20Arah,
    close_gap: closeGap,
    chg_1d: chg1d,
    chg_wtd: chgWtd,
    chg_mtd: chgMtd,
    posisi_ema5: posisiHarga(harga, ema5),
    posisi_ma10: posisiHarga(harga, ma10),
    posisi_ma20: posisiHarga(harga, ma20Kini),
    net_asing_lembar: netAsingLembar,
  })
}

writeFileSync(KELUARAN, JSON.stringify({
  diperbarui: new Date().toISOString(),
  tanggal: tanggalTerakhir,
  n: emiten.length,
  emiten,
}))

console.log(`screener.json: ${emiten.length} emiten masuk, ${dilewati.ohlcKosong} dilewati (ohlc kosong)`)
console.log(`tanggal hari bursa terakhir (modus): ${tanggalTerakhir}`)
