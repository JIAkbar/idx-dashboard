/**
 * Pembangun data Harian Papan — cross-section 962 emiten per tanggal,
 * `data-idx/json/harian_papan/<tanggal>.json` + `index.json` (daftar tanggal
 * tersedia). Pola sama `bangun-screener.mjs`: nol jaringan, seluruhnya dibaca
 * dari berkas yang sudah ada di cakram.
 *
 * Sumber (docs/spek-dev-papan/spek_harian_papan.md §Cakupan & sumber):
 *   - `ohlcv_stockbit/<KODE>.json` — SATU berkas per emiten sudah memuat
 *     harga+volume+foreignbuy/foreignsell, tak perlu menjahit sumber lain.
 *   - `emiten_sektor.json` — sektor IDX-IC resmi.
 *   - `profil/<KODE>.json` — free float, diturunkan dari `pemegang_saham`
 *     (100% − jumlah persen pemegang berlabel `pengendali:true`); ruas ini
 *     belum pernah dipakai halaman lain (spek: "perlu dipetakan").
 *
 * Rumus (skor Papan, NBSF, TDM=MTD, dst.) hidup di
 * `app/src/lib/dasbor/harianPapan.ts` — berkas ini PORT JS-nya, sama alasan
 * `lib/skor.mjs` (Node di sini tak bisa impor `.ts` langsung). Primitif
 * indikator (sma/emaAkhir/rsi/stochK/cci/macd/rakitPeriode) DIPAKAI ULANG
 * dari `lib/skor.mjs` yang sudah ada (sudah port dari skorTeknikal.ts) — cuma
 * fungsi skor Papan sendiri (periode/ambang beda) yang perlu ditulis ulang di
 * sini, isinya WAJIB sama persis dengan `skorPapan()` di harianPapan.ts.
 *
 *   node app/scripts/bangun-harian-papan.mjs [--hari N]
 *
 * `--hari N` (bawaan 30): berapa hari bursa terakhir yang dibangun. Dibatasi
 * (bukan riwayat penuh) karena satu tanggal × 962 emiten ~600KB — riwayat
 * penuh akan jadi ratusan MB, tak masuk akal di-fetch klien. Tanggal di luar
 * jendela ini belum tersedia di pemilih tanggal Harian Papan; memperluasnya
 * tinggal menaikkan N dan menjalankan ulang skrip ini (nol risiko, idempoten).
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { sma, emaAkhir, rsi, stochK, cci, macd, rakitPeriode, labelSkor } from './lib/skor.mjs'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIR_JSON = join(AKAR, 'data-idx', 'json')
const DIR_OHLCV = join(DIR_JSON, 'ohlcv_stockbit')
const DIR_PROFIL = join(DIR_JSON, 'profil')
const DIR_KELUARAN = join(DIR_JSON, 'harian_papan')

const argHari = process.argv.indexOf('--hari')
const N_HARI = argHari >= 0 ? Number(process.argv[argHari + 1]) : 30

// Jendela histori dilewatkan ke tiap tanggal target — BUKAN seluruh riwayat
// emiten. `macd()` (skor.mjs) itu O(n²) (loop EMA berulang atas larik yang
// makin panjang); tanpa batas, emiten setua ANTM (5.480 bar) × 30 tanggal ×
// 962 emiten meledak jadi puluhan miliar operasi (dicoba, dibunuh setelah
// >4 menit tanpa selesai). 600 bar cukup: EMA200 (periode terpanjang yang
// dipakai Skor Papan) konvergen jauh sebelum 3× periodenya (peluruhan
// eksponensial) — bar sebelum jendela ini pengaruhnya microskopis, bukan
// nol tapi tak terukur pada presisi tampilan manapun. TDM%/WTD/RVol10 tak
// tersentuh (semuanya cuma butuh beberapa bulan/hari terakhir, jauh di
// dalam jendela ini). ponytail: batas performa, naikkan kalau nanti ada
// indikator berperiode >200 hari yang butuh histori lebih panjang.
const JENDELA_HISTORI = 600

function bacaJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

// ── Skor Papan (JS) — WAJIB sama persis dgn skorPapan() di harianPapan.ts ──
const PERIODE_SKOR_PAPAN = [5, 10, 20, 50, 100, 200]

function biasMomentum(v, ambangBawah, ambangAtas) {
  if (v === null) return 0
  if (v >= ambangAtas) return 1
  if (v <= ambangBawah) return -1
  return 0
}

function skorPapan(baris) {
  if (baris.length < 30) return null
  const tutup = baris.map((b) => b[4])
  const harga = tutup[tutup.length - 1]

  const ma = []
  const arahHarga = (v, nama) => {
    if (v === null) return
    ma.push({ nama, bias: harga > v ? 1 : harga < v ? -1 : 0 })
  }
  for (const n of PERIODE_SKOR_PAPAN) arahHarga(sma(tutup, n), `SMA ${n}`)
  for (const n of PERIODE_SKOR_PAPAN) arahHarga(emaAkhir(tutup, n), `EMA ${n}`)

  const osc = []
  const r = rsi(tutup, 14)
  if (r !== null) osc.push({ nama: 'RSI 14', bias: biasMomentum(r, 40, 60) })
  const k = stochK(baris, 14)
  if (k !== null) osc.push({ nama: 'Stoch 14', bias: biasMomentum(k, 20, 80) })
  const c = cci(baris, 20)
  if (c !== null) osc.push({ nama: 'CCI 20', bias: biasMomentum(c, -100, 100) })
  const m = macd(tutup, 12, 26, 9)
  if (m) osc.push({ nama: 'MACD 12-26', bias: m[0] > 0 ? 1 : m[0] < 0 ? -1 : 0 })

  if (ma.length === 0 && osc.length === 0) return null
  const rata = (arr) => (arr.length ? arr.reduce((a, b) => a + b.bias, 0) / arr.length : 0)
  const maSkor = rata(ma)
  const oscSkor = rata(osc)
  const skor = (maSkor + oscSkor) / 2
  return { skor, label: labelSkor(skor), ma: maSkor, osilator: oscSkor }
}

function skorPapanTigaKerangka(baris) {
  return {
    harian: skorPapan(baris),
    pekanan: skorPapan(rakitPeriode(baris, 'pekan')),
    bulanan: skorPapan(rakitPeriode(baris, 'bulan')),
  }
}

// ── Kolom lain — WAJIB sama persis dgn harianPapan.ts ──────────────────────
function hitungNbsf000(fb, fs) {
  return (fb - fs) / 1000
}
function hitungCloseGap(buka, kemarin) {
  return kemarin > 0 ? ((buka - kemarin) / kemarin) * 100 : null
}
function hitungChg1d(kini, kemarin) {
  return kemarin > 0 ? (kini / kemarin - 1) * 100 : null
}
function hitungChgPeriode(kini, rakit) {
  if (rakit.length < 2) return null
  const dasar = rakit[rakit.length - 2][4]
  return dasar > 0 ? (kini / dasar - 1) * 100 : null
}
function hitungRvol10(volume, n = 10) {
  if (volume.length < n + 1) return null
  const dasar = volume.slice(-(n + 1), -1)
  const rata = dasar.reduce((a, b) => a + (b ?? 0), 0) / dasar.length
  return rata > 0 ? (volume[volume.length - 1] ?? 0) / rata : null
}
function hitungMa20Arah(tutup) {
  const kini = sma(tutup, 20)
  const lalu = tutup.length >= 21 ? sma(tutup.slice(0, -1), 20) : null
  if (kini === null || lalu === null) return null
  return kini > lalu ? 'naik' : kini < lalu ? 'turun' : 'datar'
}
function posisiHarga(harga, v) {
  if (v === null) return null
  if (harga > v) return 'atas'
  if (harga < v) return 'bawah'
  return null
}
function hitungFreeFloat(pemegang) {
  if (!pemegang || pemegang.length === 0) return null
  const dikuasai = pemegang.filter((p) => p.pengendali).reduce((a, p) => a + (p.persen ?? 0), 0)
  return Math.max(0, Math.min(100, 100 - dikuasai))
}
function tidakDiperdagangkanHariIni(vol) {
  return (vol ?? 0) === 0
}
function keBarisOhlc(bar) {
  return [bar[0], bar[2], bar[3], bar[4], bar[5], bar[6]]
}

function bangunBarisHarianPapan(kode, nama, sektor, freeFloat, barSampaiTanggal) {
  if (barSampaiTanggal.length === 0) return null
  const ohlc = barSampaiTanggal.map(keBarisOhlc)
  const tutup = ohlc.map((b) => b[4])
  const volume = ohlc.map((b) => b[5])
  const hargaTerakhir = tutup[tutup.length - 1]
  const barIni = barSampaiTanggal[barSampaiTanggal.length - 1]
  const kemarin = ohlc.length >= 2 ? ohlc[ohlc.length - 2] : null

  const mingguan = rakitPeriode(ohlc, 'pekan')
  const bulanan = rakitPeriode(ohlc, 'bulan')
  const chgWtd = hitungChgPeriode(hargaTerakhir, mingguan)
  const chgMtd = hitungChgPeriode(hargaTerakhir, bulanan)

  const ema5 = emaAkhir(tutup, 5)
  const ma10 = sma(tutup, 10)
  const ma20 = sma(tutup, 20)
  const skor = skorPapanTigaKerangka(ohlc)

  const foreignBuy = Number(barIni[9] ?? 0)
  const foreignSell = Number(barIni[10] ?? 0)
  const volumeIni = volume[volume.length - 1] ?? null

  return {
    kode,
    nama,
    sektor,
    harga: hargaTerakhir,
    tdm_persen: chgMtd,
    volume: volumeIni,
    rvol10: hitungRvol10(volume),
    nilai: barIni[7] ?? null,
    nbsf_000: hitungNbsf000(foreignBuy, foreignSell),
    free_float: freeFloat,
    ma20_arah: hitungMa20Arah(tutup),
    close_gap: kemarin ? hitungCloseGap(ohlc[ohlc.length - 1][1], kemarin[4]) : null,
    chg_1d: kemarin ? hitungChg1d(hargaTerakhir, kemarin[4]) : null,
    chg_wtd: chgWtd,
    chg_mtd: chgMtd,
    posisi_ema5: posisiHarga(hargaTerakhir, ema5),
    posisi_ma10: posisiHarga(hargaTerakhir, ma10),
    posisi_ma20: posisiHarga(hargaTerakhir, ma20),
    skor_d: skor.harian?.label ?? null,
    skor_w: skor.pekanan?.label ?? null,
    skor_m: skor.bulanan?.label ?? null,
    tidak_diperdagangkan: tidakDiperdagangkanHariIni(volumeIni),
    // Bahan mentah kolom Form (adendum Rapor & Badge) — dihitung ulang di
    // komponen lewat hitungForm() (raporBadge.ts), bukan di sini.
    bar5: barSampaiTanggal.slice(-5).map((b) => ({ open: b[2], close: b[5] })),
  }
}

// ── Main ────────────────────────────────────────────────────────────────
const daftar = bacaJson(join(DIR_JSON, 'daftar_emiten.json'))
const namaByKode = new Map((daftar?.emiten ?? []).map((e) => [e.kode, e.nama]))
const sektorData = bacaJson(join(DIR_JSON, 'emiten_sektor.json'))
const sektorByKode = sektorData?.emiten ?? {}

const fileOhlcv = readdirSync(DIR_OHLCV)
  .filter((f) => f.endsWith('.json') && !f.startsWith('_') && f !== 'IHSG.json') // IHSG = indeks, bukan emiten (bukan barang dagangan broker)
  .sort()

// Pass 1: tanggal bursa terakhir = MODUS tanggal bar terakhir tiap emiten
// (sama alasan bangun-screener.mjs: bukan dari satu emiten acak yang bisa
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

// Kalender acuan: tanggal bar emiten mana pun yang bar terakhirnya PERSIS
// tanggalTerakhir (ada banyak, ambil yang riwayatnya terpanjang supaya N_HARI
// ke belakang aman tercakup).
let kalender = null
for (const [kode, bar] of berkasByKode) {
  if (bar.at(-1)?.[0] !== tanggalTerakhir) continue
  if (!kalender || bar.length > kalender.length) kalender = bar.map((b) => b[0])
}
const tanggalTarget = (kalender ?? []).slice(-N_HARI) // lama -> baru

console.log(`tanggal bursa terakhir (modus): ${tanggalTerakhir}`)
console.log(`membangun ${tanggalTarget.length} tanggal: ${tanggalTarget[0]} .. ${tanggalTarget.at(-1)}`)

mkdirSync(DIR_KELUARAN, { recursive: true })

const hasilPerTanggal = new Map(tanggalTarget.map((t) => [t, []]))

for (const [kode, bar] of berkasByKode) {
  // Indeks tanggal -> posisi di larik bar, sekali per emiten (bukan per
  // tanggal target — O(n) sekali, bukan O(n × N_HARI)).
  const idxByTanggal = new Map(bar.map((b, i) => [b[0], i]))
  const profil = bacaJson(join(DIR_PROFIL, `${kode}.json`))
  const freeFloat = hitungFreeFloat(profil?.pemegang_saham)
  // Nilai klasifikasi Inggris resmi (Johan 27 Agu); ID = cadangan.
  const sektor = sektorByKode[kode]?.sektor_en ?? sektorByKode[kode]?.sektor ?? '-'
  const nama = namaByKode.get(kode) ?? null

  for (const t of tanggalTarget) {
    const idx = idxByTanggal.get(t)
    if (idx === undefined) continue // emiten belum listing / suspensi tanggal ini
    const potong = bar.slice(Math.max(0, idx + 1 - JENDELA_HISTORI), idx + 1)
    const baris = bangunBarisHarianPapan(kode, nama, sektor, freeFloat, potong)
    if (baris) hasilPerTanggal.get(t).push(baris)
  }
}

const diperbarui = new Date().toISOString()
for (const t of tanggalTarget) {
  const emiten = hasilPerTanggal.get(t)
  writeFileSync(
    join(DIR_KELUARAN, `${t}.json`),
    JSON.stringify({ tanggal: t, diperbarui, n: emiten.length, emiten }),
  )
}
writeFileSync(
  join(DIR_KELUARAN, 'index.json'),
  JSON.stringify({ diperbarui, tanggal_tersedia: [...tanggalTarget].reverse() }),
)

console.log(`selesai: ${tanggalTarget.length} berkas tanggal + index.json di ${DIR_KELUARAN}`)
console.log(`emiten tanggal terakhir (${tanggalTerakhir}): ${hasilPerTanggal.get(tanggalTerakhir)?.length ?? 0}`)
