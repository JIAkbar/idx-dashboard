/**
 * Panel analitik chart — Pivot Points, CPR, R:R Setup, Return multi-horizon,
 * Volume Surge, gating jujur. Rumus dari `docs/spek-dev-papan/audit_chart_custom_LENGKAP.md`
 * §4.1–4.3, §4.5–§4.7. Semua murni: OHLCV masuk, angka keluar, nol jaringan.
 *
 * Notasi spek: bar `t` = sesi terakhir TUTUP (bukan hari berjalan).
 */
import type { Pivot } from '../skor/types'

// ── 1. Pivot Points klasik (§4.1) ───────────────────────────────────────────

export function hitungPivot(h: number, l: number, c: number): Pivot {
  const P = (h + l + c) / 3
  return {
    P,
    R1: 2 * P - l,
    S1: 2 * P - h,
    R2: P + (h - l),
    S2: P - (h - l),
    R3: h + 2 * (P - l),
    S3: l - 2 * (h - P),
  }
}

// ── 2. Central Pivot Range (§4.2) ───────────────────────────────────────────

export interface HasilCpr {
  bc: number
  tc: number
  /** |TC-BC|, satuan harga. */
  lebarBand: number
  /** LebarBand / P × 100. */
  lebarPct: number
}

export function hitungCpr(h: number, l: number, c: number): HasilCpr {
  const { P } = hitungPivot(h, l, c)
  let bc = (h + l) / 2
  let tc = 2 * P - bc
  // TC wajib selalu batas atas — tukar label kalau hitungan mentah kebalik
  // (terjadi saat Close jauh di bawah tengah H/L).
  if (bc > tc) { const tmp = bc; bc = tc; tc = tmp }
  const lebarBand = Math.abs(tc - bc)
  return { bc, tc, lebarBand, lebarPct: (lebarBand / P) * 100 }
}

// ── 3. Klasifikasi Lebar/Sempit (§4.2) ──────────────────────────────────────

export type KlasifikasiLebar = 'Sempit' | 'Lebar' | 'Normal'

export interface HasilKlasifikasiLebar {
  klasifikasi: KlasifikasiLebar
  /** Median 60 sesi terakhir — null kalau riwayat kurang (pakai fallback). */
  m60: number | null
  pakaiFallback: boolean
  /** Label siap tampil — sudah menyisipkan catatan fallback kalau perlu. */
  label: string
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * `riwayatLebarPct` = deret LebarBand% historis (disarankan trailing 60 sesi
 * TERMASUK sesi berjalan) — panjangnya sendiri yang menentukan gating
 * fallback, bukan parameter terpisah.
 */
export function klasifikasiLebarCpr(lebarPct: number, riwayatLebarPct: number[]): HasilKlasifikasiLebar {
  if (riwayatLebarPct.length < 30) {
    const klasifikasi: KlasifikasiLebar = lebarPct < 0.5 ? 'Sempit' : lebarPct > 1.2 ? 'Lebar' : 'Normal'
    return { klasifikasi, m60: null, pakaiFallback: true, label: `${klasifikasi} (ambang default, riwayat kurang)` }
  }
  const m60 = median(riwayatLebarPct)
  const klasifikasi: KlasifikasiLebar = lebarPct < 0.7 * m60 ? 'Sempit' : lebarPct > 1.3 * m60 ? 'Lebar' : 'Normal'
  return { klasifikasi, m60, pakaiFallback: false, label: klasifikasi }
}

// ── 4. Posisi harga vs CPR (§4.2) ───────────────────────────────────────────

export type PosisiCpr = 'di-atas' | 'di-dalam' | 'di-bawah'

export function posisiCpr(close: number, tc: number, bc: number): PosisiCpr {
  if (close > tc) return 'di-atas'
  if (close < bc) return 'di-bawah'
  return 'di-dalam'
}

// ── 5. Relasi CPR vs sesi lalu — 6 kelas (§4.2) ─────────────────────────────

export type KelasRelasiCpr =
  | 'Higher Value' | 'Lower Value' | 'Outside Value' | 'Inside Value'
  | 'Overlapping Higher' | 'Overlapping Lower'

export interface HasilRelasiCpr {
  kelas: KelasRelasiCpr
  bias: string
}

// REVISI 27 Agu 2026 (sapuan pengawas #5): versi lama memvonis arah —
// "Bullish kuat"/"Bearish kuat"/"potensi reversal" — klaim prediktif telanjang
// tanpa BadgeRapor. Aturan proyek: klaim prediktif dikunci di belakang bukti
// win-rate. Sampai BT Papan mengukurnya, teksnya DESKRIPSI STRUKTURAL murni:
// menyebut apa yang terjadi pada rentang nilai CPR, bukan apa artinya besok.
const BIAS_RELASI: Record<KelasRelasiCpr, string> = {
  'Higher Value': 'Rentang CPR bergeser naik penuh dari sesi lalu',
  'Lower Value': 'Rentang CPR bergeser turun penuh dari sesi lalu',
  'Outside Value': 'Rentang CPR melebar melampaui sesi lalu',
  'Inside Value': 'Rentang CPR menyempit di dalam sesi lalu',
  'Overlapping Higher': 'Rentang CPR tumpang tindih, pivot lebih tinggi',
  'Overlapping Lower': 'Rentang CPR tumpang tindih, pivot lebih rendah',
}

/** Urutan pengecekan PERSIS tabel spek — Higher/Lower diputuskan duluan,
 *  baru Outside/Inside, sisanya Overlapping (dibedakan arah P). */
export function relasiCpr(
  kini: { tc: number; bc: number; p: number },
  prev: { tc: number; bc: number; p: number },
): HasilRelasiCpr {
  let kelas: KelasRelasiCpr
  if (kini.bc >= prev.tc) kelas = 'Higher Value'
  else if (kini.tc <= prev.bc) kelas = 'Lower Value'
  else if (kini.tc > prev.tc && kini.bc < prev.bc) kelas = 'Outside Value'
  else if (kini.tc < prev.tc && kini.bc > prev.bc) kelas = 'Inside Value'
  else kelas = kini.p > prev.p ? 'Overlapping Higher' : 'Overlapping Lower'
  return { kelas, bias: BIAS_RELASI[kelas] }
}

// ── 6. R:R Setup (§4.3) ─────────────────────────────────────────────────────

export interface HasilRR {
  target: number
  stopLoss: number
  rewardPct: number
  riskPct: number
  /** Reward% / Risk% — satu rumus, jangan dibalik. */
  x: number
  label: string
}

export function hitungRR(close: number, pivot: Pivot): HasilRR {
  const target = pivot.R1
  const stopLoss = pivot.S1
  const rewardPct = ((target - close) / close) * 100
  const riskPct = ((close - stopLoss) / close) * 100
  const x = rewardPct / riskPct
  return { target, stopLoss, rewardPct, riskPct, x, label: `Risk : Reward = 1 : ${x.toFixed(1)}` }
}

// ── 7. Jarak ke level kunci (§4.6) ──────────────────────────────────────────

export interface HasilJarakLevel {
  r1: number
  s1: number
  tc: number
  bc: number
}

export function jarakKeLevel(close: number, level: { r1: number; s1: number; tc: number; bc: number }): HasilJarakLevel {
  const pct = (lvl: number) => ((lvl - close) / close) * 100
  return { r1: pct(level.r1), s1: pct(level.s1), tc: pct(level.tc), bc: pct(level.bc) }
}

// ── 8. Return multi-horizon (§4.6) ──────────────────────────────────────────

export interface HasilReturnMultiHorizon {
  r1d: number | null
  r1w: number | null
  r1m: number | null
  r3m: number | null
}

export interface OffsetHorizon {
  /** Berapa BAR ke belakang untuk tiap horizon; null = tak bisa dinyatakan
   *  pada kerangka itu (mis. "1 hari" pada chart bulanan). */
  d1: number | null
  w1: number | null
  m1: number | null
  m3: number | null
}

/** Offset baku kerangka HARIAN — sesi bursa: 1W=5 sesi, 1M=21, 3M=63. */
export const OFFSET_HARIAN: OffsetHorizon = { d1: 1, w1: 5, m1: 21, m3: 63 }

/**
 * Berapa bar ke belakang yang benar-benar berarti "1 hari / 1 pekan / 1 bulan
 * / 3 bulan" pada kerangka HARIAN, PEKANAN, atau BULANAN.
 *
 * Ini menutup cacat yang persis ditanyakan Johan ("data tebakan saja"):
 * sebelumnya offsetnya SELALU 1/5/21/63 bar apa pun kerangkanya, sementara
 * label di layar tetap 1D/1W/1M/3M. Di chart bulanan kotak "3M" berisi return
 * 63 BULAN — lima tahun lebih — dan tetap terbaca masuk akal. Di chart 5 menit
 * kotak "3M" justru lebih pendek daripada satu hari bursa.
 *
 * Tabelnya sengaja ditulis eksplisit, bukan diturunkan dari rumus: 1 pekan =
 * 5 sesi tapi 7 hari kalender, dan mencampur dua satuan itu di dalam satu
 * rumus adalah cara paling gampang melahirkan angka yang salah tanpa galat.
 * Pembulatannya tak terhindarkan (1 bulan = 4,33 pekan), jadi angkanya
 * DICETAK di layar alih-alih diakali — lihat `LOOKBACK` di panel.
 *
 * Intraday TIDAK ada di sini: di sana offsetnya wajib dicari dari cap
 * waktunya sendiri (`offsetIntraday`), bukan dari perkalian.
 */
export function offsetHorizon(kerangka: 'D' | 'W' | 'M'): OffsetHorizon {
  if (kerangka === 'D') return OFFSET_HARIAN
  // Pekan: 1 bulan ≈ 4 pekan, 3 bulan ≈ 13 pekan. "1 hari" tak ada wujudnya.
  if (kerangka === 'W') return { d1: null, w1: 1, m1: 4, m3: 13 }
  return { d1: null, w1: null, m1: 1, m3: 3 }
}

/** Berapa HARI BURSA ke belakang tiap horizon, untuk deret intraday. */
const HARI_HORIZON: Array<[keyof OffsetHorizon, number]> = [
  ['d1', 1], ['w1', 5], ['m1', 21], ['m3', 63],
]

/**
 * Offset intraday DICARI DARI CAP WAKTU, bukan dari perkalian bar-per-hari.
 *
 * Versi pertama fungsi ini mengukur modus bar-per-hari lalu mengalikannya
 * 5/21/63, dan itu salah secara struktural — bukan cuma kurang teliti:
 *
 * - Sesi Jumat IDX lebih pendek, dan bar tanpa transaksi dibuang di emiten
 *   tipis, jadi tak ada satu pun angka "bar per hari" yang berlaku untuk semua
 *   hari. Melesetnya searah dan menumpuk: pada 3 bulan ia lewat ~2 hari bursa.
 * - Bar-per-hari itu diukur dari JENDELA PANDANG, jadi ia menyusut saat
 *   pengguna memperbesar. Jendela 2,5 jam yang membelah dua tanggal memberi
 *   "1 hari" = 75 menit — dan ambang gatingnya (offset + 1) lahir dari
 *   pengukuran yang SAMA sehingga ikut menyusut dengan laju persis sama.
 *   Golongan galat itu mustahil tertangkap pagar semacam itu.
 *
 * Cara di bawah kebal ketiganya: jangkarnya bar TERAKHIR pada tanggal bursa
 * ke-k sebelum tanggal bar t. Sesi pendek, libur, dan bar yang dibuang tak
 * mengubah apa pun, karena yang dihitung tanggal, bukan jumlah bar.
 */
export function offsetIntraday(waktu: string[]): OffsetHorizon {
  const n = waktu.length
  const hasil: OffsetHorizon = { d1: null, w1: null, m1: null, m3: null }
  if (n === 0) return hasil
  const tanggal = waktu.map((w) => w.slice(0, 10))
  const hari: string[] = []
  for (const t of tanggal) if (hari[hari.length - 1] !== t) hari.push(t)
  // Indeks bar TERAKHIR di tiap tanggal — itulah "tutup" hari bursa itu.
  const akhirHari = new Map<string, number>()
  for (let i = 0; i < n; i++) akhirHari.set(tanggal[i], i)
  for (const [ruas, k] of HARI_HORIZON) {
    if (hari.length < k + 1) continue
    const idx = akhirHari.get(hari[hari.length - 1 - k])
    if (idx == null) continue
    hasil[ruas] = n - 1 - idx
  }
  return hasil
}

/** `closes` ASCENDING, elemen terakhir = Close bar `t`. `offset` menentukan
 *  berapa bar setiap horizon — bawaannya kerangka harian. */
export function returnMultiHorizon(
  closes: number[],
  offset: OffsetHorizon = OFFSET_HARIAN,
): HasilReturnMultiHorizon {
  const n = closes.length
  const ret = (bars: number | null): number | null => {
    if (bars == null || n < bars + 1) return null
    const cPrev = closes[n - 1 - bars]
    if (cPrev === 0) return null
    return ((closes[n - 1] - cPrev) / cPrev) * 100
  }
  return { r1d: ret(offset.d1), r1w: ret(offset.w1), r1m: ret(offset.m1), r3m: ret(offset.m3) }
}

// ── 9. Klasifikasi Volume Surge (§4.5) ──────────────────────────────────────
// Pelengkap tampilan (klasifikasi hari-t vs MA20) — deteksi lonjakan multi-hari
// di chart tetap lewat `cariLonjakanVolume` (grafikEmiten.ts), tidak diulang di sini.

export type KlasifikasiVolumeSurge = 'sangat-tinggi' | 'tinggi' | 'normal' | 'rendah'

export interface HasilVolumeSurge {
  surgePct: number
  klasifikasi: KlasifikasiVolumeSurge
  ma20: number
}

/** `volumes20SebelumT` = 20 volume SEBELUM bar t (TIDAK termasuk `vT`) —
 *  memasukkan `vT` ke pembagi meredam surge-nya sendiri, makin besar
 *  lonjakannya makin besar peredamannya. */
export function klasifikasiVolumeSurge(vT: number, volumes20SebelumT: number[]): HasilVolumeSurge | null {
  if (volumes20SebelumT.length === 0) return null
  const ma20 = volumes20SebelumT.reduce((a, b) => a + b, 0) / volumes20SebelumT.length
  if (ma20 <= 0) return null
  const surgePct = ((vT - ma20) / ma20) * 100
  const klasifikasi: KlasifikasiVolumeSurge =
    surgePct >= 100 ? 'sangat-tinggi'
      : surgePct >= 50 ? 'tinggi'
        : surgePct > -30 ? 'normal'
          : 'rendah'
  return { surgePct, klasifikasi, ma20 }
}

// ── 10. Gating data jujur (§4.7) — generik, dipakai seluruh panel di atas ──

export type KunciGating =
  | 'pivot_cpr' | 'relasi_cpr' | 'rr_setup'
  | 'candlestick_1bar' | 'candlestick_2bar'
  | 'volume_surge' | 'return_1d' | 'return_1w' | 'return_1m' | 'return_3m'

export interface MetrikGagal {
  kunci: KunciGating
  label: string
  /** Bar minimum. `null` = horizon itu TAK BERLAKU di kerangka aktif (mis.
   *  "1 hari" pada chart bulanan) — bukan soal data kurang. */
  minimum: number | null
}

/** Tabel bar minimum PERSIS §4.7. `klasifikasi-lebar` sengaja TAK ADA di
 *  sini — <30 sesi jatuh ke fallback ambang tetap (§klasifikasiLebarCpr),
 *  bukan gate total. */
const AMBANG_GATING: MetrikGagal[] = [
  { kunci: 'pivot_cpr', label: 'Pivot & CPR', minimum: 2 },
  // Label ini ikut tercetak di banner yang satuannya SUDAH mengikuti kerangka,
  // jadi 'sesi' di sini melahirkan kalimat yang menabrak dirinya sendiri:
  // 'Periode 2 bulan belum cukup untuk: Relasi CPR vs sesi lalu'. Netral.
  { kunci: 'relasi_cpr', label: 'Relasi CPR vs bar sebelumnya', minimum: 3 },
  { kunci: 'rr_setup', label: 'R:R Setup', minimum: 2 },
  { kunci: 'candlestick_1bar', label: 'Pola candlestick 1-bar', minimum: 1 },
  { kunci: 'candlestick_2bar', label: 'Pola candlestick 2-bar', minimum: 2 },
  { kunci: 'volume_surge', label: 'Volume Surge', minimum: 21 },
  { kunci: 'return_1d', label: 'Return 1D', minimum: 2 },
  { kunci: 'return_1w', label: 'Return 1W', minimum: 6 },
  { kunci: 'return_1m', label: 'Return 1M', minimum: 22 },
  { kunci: 'return_3m', label: 'Return 3M', minimum: 64 },
]

export interface HasilGating {
  gagal: MetrikGagal[]
  /** Teks siap tampil, format persis spek — null kalau semua metrik lolos. */
  banner: string | null
}

/** Kunci return -> ruas offset yang menentukan ambangnya. */
const RUAS_RETURN: Array<[KunciGating, keyof OffsetHorizon]> = [
  ['return_1d', 'd1'], ['return_1w', 'w1'], ['return_1m', 'm1'], ['return_3m', 'm3'],
]

/**
 * `satuan` = kata untuk SATU bar pada kerangka aktif ("sesi", "pekan",
 * "bulan", "candle 5 menit"). Bawaannya "sesi" supaya pemanggil harian tak
 * berubah — tapi memakai bawaan itu di kerangka lain berarti banner menyebut
 * 40 candle lima menit sebagai "40 sesi", persis salah baca yang dikeluhkan.
 *
 * `offset` menggeser ambang return supaya ikut kerangkanya: di chart pekanan
 * "3M" butuh 14 bar, bukan 64. Tanpa ini, panel di kerangka W hampir selalu
 * memajang banner "belum cukup" padahal riwayatnya sepuluh tahun.
 */
export function cekGating(
  nBar: number,
  opsi: { satuan?: string; offset?: OffsetHorizon } = {},
): HasilGating {
  const { satuan = 'sesi', offset = OFFSET_HARIAN } = opsi
  const ambang = AMBANG_GATING.map((m) => {
    const ruas = RUAS_RETURN.find(([k]) => k === m.kunci)
    if (!ruas) return m
    const o = offset[ruas[1]]
    return { ...m, minimum: o == null ? null : o + 1 }
  })
  const gagal = ambang.filter((m) => m.minimum == null || nBar < m.minimum)
  if (gagal.length === 0) return { gagal, banner: null }
  const kurang = gagal.filter((m) => m.minimum != null)
  if (kurang.length === 0) return { gagal, banner: null }
  const daftar = kurang.map((m) => m.label).join(', ')
  return { gagal, banner: `Periode ${nBar} ${satuan} belum cukup untuk: ${daftar}. Perpanjang rentang tanggal.` }
}

/** Placeholder generik metrik yang gagal gate — dipakai ganti angka apa pun
 *  ("0.0%"/"—" polos dilarang §4.7), bukan cuma di satu panel. `minimum` null
 *  berarti horizonnya tak berlaku di kerangka ini, bukan datanya kurang; dua
 *  sebab yang berbeda tak boleh memakai kalimat yang sama. */
export function placeholderGating(minimum: number | null, nBar: number, satuan = 'sesi'): string {
  if (minimum == null) return '— (tak berlaku di kerangka ini)'
  return `— (butuh ${minimum} ${satuan}, tersedia ${nBar})`
}
