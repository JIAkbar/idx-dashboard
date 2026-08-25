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

const BIAS_RELASI: Record<KelasRelasiCpr, string> = {
  'Higher Value': 'Bullish kuat',
  'Lower Value': 'Bearish kuat',
  'Outside Value': 'Volatilitas naik, potensi reversal',
  'Inside Value': 'Volatilitas turun, konsolidasi',
  'Overlapping Higher': 'Bullish ringan',
  'Overlapping Lower': 'Bearish ringan',
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

/** `closes` ASCENDING, elemen terakhir = Close bar `t`. Sesi bursa, bukan
 *  hari kalender — 1W=5 sesi, 1M=21 sesi, 3M=63 sesi. */
export function returnMultiHorizon(closes: number[]): HasilReturnMultiHorizon {
  const n = closes.length
  const ret = (bars: number): number | null => {
    if (n < bars + 1) return null
    const cPrev = closes[n - 1 - bars]
    if (cPrev === 0) return null
    return ((closes[n - 1] - cPrev) / cPrev) * 100
  }
  return { r1d: ret(1), r1w: ret(5), r1m: ret(21), r3m: ret(63) }
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
  minimum: number
}

/** Tabel bar minimum PERSIS §4.7. `klasifikasi-lebar` sengaja TAK ADA di
 *  sini — <30 sesi jatuh ke fallback ambang tetap (§klasifikasiLebarCpr),
 *  bukan gate total. */
const AMBANG_GATING: MetrikGagal[] = [
  { kunci: 'pivot_cpr', label: 'Pivot & CPR', minimum: 2 },
  { kunci: 'relasi_cpr', label: 'Relasi CPR vs sesi lalu', minimum: 3 },
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

export function cekGating(nBar: number): HasilGating {
  const gagal = AMBANG_GATING.filter((m) => nBar < m.minimum)
  if (gagal.length === 0) return { gagal, banner: null }
  const daftar = gagal.map((m) => m.label).join(', ')
  return { gagal, banner: `Periode ${nBar} sesi belum cukup untuk: ${daftar}. Perpanjang rentang tanggal.` }
}

/** Placeholder generik metrik yang gagal gate — dipakai ganti angka apa pun
 *  ("0.0%"/"—" polos dilarang §4.7), bukan cuma di satu panel. */
export function placeholderGating(minimum: number, nBar: number): string {
  return `— (butuh ${minimum} sesi, tersedia ${nBar})`
}
