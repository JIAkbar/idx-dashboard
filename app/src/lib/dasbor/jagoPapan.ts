import { useEffect, useState } from 'react'

/**
 * Jago Papan (`/jago-papan`, docs/spek-dev-papan/spek_jago_papan.md) — empat
 * tab screener siap-pakai bertema momentum: Strong Uptrend, Breakout, Early
 * Breakout, Foreign Flow Uptrend. Satu bursa, SATU tanggal (bar final tutup
 * pasar terakhir — beda dari Harian Papan yang punya jendela 30 hari, di sini
 * tak ada pemilih tanggal).
 *
 * Sumber (spek §Bukti verifikasi): `ohlcv_stockbit/<KODE>.json` — SATU berkas
 * per emiten sudah memuat harga+volume+foreignbuy/foreignsell/foreignflow
 * dalam satu deret, tak perlu menjahit sumber lain. Berkas ini murni FUNGSI
 * (bisa diuji tanpa fetch/React, lihat `hitungBarisJagoPapan`) + pemuat
 * cross-section pracetak `data-idx/json/jago_papan/terbaru.json` (dibangun
 * `app/scripts/bangun-jago-papan.mjs`, pola sama `bangun-harian-papan.mjs` —
 * 962 emiten × riwayat penuh terlalu berat dihitung ulang di klien tiap
 * kunjungan halaman).
 *
 * Ambang (Rp2 M value, Rp1 T mcap, 2× volume MA20, streak ≥2) hidup di
 * `AMBANG_JAGO_PAPAN` di berkas ini — spek minta ia "di config yang sama
 * dengan preset Screener", tapi `presetScreener.ts` DILARANG disentuh dari
 * paket ini (batas keras tugas), jadi untuk sekarang ambangnya berdiri
 * sendiri di sini; menyatukannya ke `presetScreener.ts` menyusul dari
 * pemanggil serial.
 */

// ── Bentuk data mentah ──────────────────────────────────────────────────

/** Satu bar `ohlcv_stockbit/<KODE>.json` (chartbit) — kolom persis urutan
 *  berkas nyata (ruas `kolom` di tiap berkas): tanggal, unixdate, open, high,
 *  low, close, volume, value, frequency, foreignbuy, foreignsell, foreignflow
 *  (KUMULATIF sejak awal deret — spek: "chartbit sudah punya kolom itu,
 *  jangan hitung ulang"), dividend, shareoutstanding, soxclose (market cap),
 *  freq_analyzer, lot. */
export type BarChartbit = [
  tanggal: string, unixdate: number, open: number, high: number, low: number,
  close: number, volume: number, value: number, frequency: number,
  foreignbuy: number, foreignsell: number, foreignflow: number,
  dividend: number, shareoutstanding: number, soxclose: number,
  freq_analyzer: number, lot: number,
]

// ── Baris hasil hitung ──────────────────────────────────────────────────

export interface RowJagoPapan {
  kode: string
  nama: string | null
  harga: number
  /** 1 Day Price Returns %. */
  chg_1d: number | null
  ma5: number | null
  ma20: number | null
  /** Market Cap — kolom `soxclose` bar terakhir. */
  mcap: number | null
  /** Nilai transaksi hari terakhir (rupiah). */
  value: number | null
  volume: number | null
  vol_ma20: number | null
  /** close ÷ tertinggi CLOSE 250 bar terakhir (≈52 minggu) — BUKAN tertinggi
   *  HIGH, bukan posisi dalam rentang high–low. Diuji spek §Bukti (INET/MEJA/
   *  NICL/TRIN), formula close-vs-close paling dekat ke acuan. */
  near52w: number | null
  /** Net foreign hari ini, rupiah resmi chartbit (`foreignbuy − foreignsell`). */
  net_asing: number
  /** Rata-rata net foreign harian 10 hari terakhir (BUKAN kumulatif/10). */
  net_asing_ma10: number | null
  /** Hari beruntun net beli/jual: + = beruntun BELI, − = beruntun JUAL,
   *  besarannya jumlah hari (pola sama `asing_streak` kartu_analisa.py). */
  net_asing_streak: number
  /** Foreign flow kumulatif — kolom `foreignflow` bar terakhir apa adanya. */
  foreign_flow_kum: number | null
  /** MA20 dari deret `foreignflow` kumulatif (BUKAN MA20 net harian). */
  foreign_flow_ma20: number | null
  /** close > MA20 hari ini DAN close ≤ MA20 kemarin (MA20 dihitung ulang
   *  dgn data sampai kemarin) — "menembus MA20 hari ini". */
  tembus_ma20_hari_ini: boolean
  /** Volume hari ini 0 — dikeluarkan dari SEMUA tab (spek §Kejujuran & batas). */
  beku: boolean
}

// ── Primitif ────────────────────────────────────────────────────────────

function sma(v: number[], n: number): number | null {
  if (v.length < n) return null
  let s = 0
  for (let i = v.length - n; i < v.length; i++) s += v[i]
  return s / n
}

function rata(v: number[]): number | null {
  if (v.length === 0) return null
  return v.reduce((a, b) => a + b, 0) / v.length
}

function near52w(closes: number[]): number | null {
  if (closes.length === 0) return null
  const jendela = closes.slice(-250)
  const puncak = Math.max(...jendela)
  return puncak > 0 ? closes[closes.length - 1] / puncak : null
}

/** Rata-rata net foreign HARIAN (fb−fs per bar), 10 hari terakhir — beda dari
 *  MA kumulatif. `null` kalau riwayatnya kurang dari 10 hari. */
function netAsingMa10(bar: BarChartbit[]): number | null {
  if (bar.length < 10) return null
  const dasar = bar.slice(-10).map((b) => (b[9] ?? 0) - (b[10] ?? 0))
  return rata(dasar)
}

/** Streak hari beruntun net beli (+) / net jual (−) — arah hari TERAKHIR,
 *  mundur selama net-nya bertanda sama. Net = 0 di hari terakhir → streak 0. */
function netAsingStreak(bar: BarChartbit[]): number {
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

function foreignFlowMa20(bar: BarChartbit[]): number | null {
  if (bar.length < 20) return null
  return rata(bar.slice(-20).map((b) => b[11] ?? 0))
}

function tembusMa20HariIni(closes: number[]): boolean {
  if (closes.length < 21) return false
  const ma20Kini = sma(closes, 20)
  const ma20Kemarin = sma(closes.slice(0, -1), 20)
  if (ma20Kini === null || ma20Kemarin === null) return false
  const closeKini = closes[closes.length - 1]
  const closeKemarin = closes[closes.length - 2]
  return closeKini > ma20Kini && closeKemarin <= ma20Kemarin
}

/**
 * Satu baris Jago Papan dari deret bar `ohlcv_stockbit` SAMPAI tanggal
 * target (bar terakhir larik = tanggal target — pemanggil yang memotong
 * deretnya, sama pola `bangunBarisHarianPapan`). `null` kalau deretnya
 * kosong.
 */
export function hitungBarisJagoPapan(kode: string, nama: string | null, bar: BarChartbit[]): RowJagoPapan | null {
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

// ── Empat tab — aturan & ambang v1 ─────────────────────────────────────

/** v1 (spek §Kejujuran & batas) — belum bisa hidup di `presetScreener.ts`
 *  (berkas itu dilarang disentuh dari paket ini), lihat komentar berkas. */
export const AMBANG_JAGO_PAPAN = {
  value_min: 2_000_000_000, // Rp2 miliar — Strong Uptrend
  mcap_min: 1_000_000_000_000, // Rp1 triliun — Strong Uptrend
  multipel_early_breakout: 2, // volume > 2× volume MA20 — Early Breakout
  streak_min: 2, // hari net beli beruntun — Foreign Flow Uptrend
}

function lolosStrongUptrend(b: RowJagoPapan): boolean {
  return !b.beku && b.ma20 != null && b.harga > b.ma20
    && b.value != null && b.value > AMBANG_JAGO_PAPAN.value_min
    && b.mcap != null && b.mcap > AMBANG_JAGO_PAPAN.mcap_min
}

function lolosBreakout(b: RowJagoPapan): boolean {
  return !b.beku && b.ma20 != null && b.harga > b.ma20 && b.tembus_ma20_hari_ini
    && b.vol_ma20 != null && b.volume != null && b.volume > b.vol_ma20
    && b.chg_1d != null && b.chg_1d > 0
}

function lolosEarlyBreakout(b: RowJagoPapan): boolean {
  return !b.beku && b.vol_ma20 != null && b.volume != null
    && b.volume > AMBANG_JAGO_PAPAN.multipel_early_breakout * b.vol_ma20
    && b.ma20 != null && b.harga > b.ma20
    && b.ma5 != null && b.harga > b.ma5
    && b.chg_1d != null && b.chg_1d > 0
}

function lolosForeignFlowUptrend(b: RowJagoPapan): boolean {
  return !b.beku && b.net_asing > 0
    && b.net_asing_ma10 != null && b.net_asing > b.net_asing_ma10
    && b.foreign_flow_kum != null && b.foreign_flow_ma20 != null
    && b.foreign_flow_kum > b.foreign_flow_ma20
    && b.net_asing_streak >= AMBANG_JAGO_PAPAN.streak_min
}

export type TabJagoPapan = 'strong-uptrend' | 'breakout' | 'early-breakout' | 'foreign-flow-uptrend'

export interface KonfigTabJagoPapan {
  id: TabJagoPapan
  label: string
  /** Kalimat aturan, ditampilkan di kepala tab — apa adanya, gaya slide
   *  "Jago Saham" (spek §Halaman). */
  aturan: string
  urutBawaan: keyof RowJagoPapan
  arahBawaan: 'naik' | 'turun'
  lolos: (b: RowJagoPapan) => boolean
}

/** Urutan PERSIS sesuai tangkapan layar (spek §Halaman) — tab pertama =
 *  keadaan bawaan halaman. */
export const TAB_JAGO_PAPAN: KonfigTabJagoPapan[] = [
  {
    id: 'strong-uptrend', label: 'Strong Uptrend',
    aturan: 'close > MA20 · value > Rp2 miliar · market cap > Rp1 triliun',
    urutBawaan: 'value', arahBawaan: 'turun', lolos: lolosStrongUptrend,
  },
  {
    id: 'breakout', label: 'Breakout',
    aturan: 'close > MA20 · close menembus MA20 hari ini (kemarin ≤ MA20) · volume > volume MA20 · 1D return positif',
    urutBawaan: 'volume', arahBawaan: 'turun', lolos: lolosBreakout,
  },
  {
    id: 'early-breakout', label: 'Early Breakout',
    aturan: 'volume > 2× volume MA20 · close > MA20 · close > MA5 · 1D return positif',
    urutBawaan: 'volume', arahBawaan: 'turun', lolos: lolosEarlyBreakout,
  },
  {
    id: 'foreign-flow-uptrend', label: 'Foreign Flow Uptrend',
    aturan: 'net foreign hari ini > 0 · net foreign > MA10 net foreign · foreign flow kumulatif > MA20 foreign flow · streak net beli ≥ 2 hari',
    urutBawaan: 'foreign_flow_kum', arahBawaan: 'turun', lolos: lolosForeignFlowUptrend,
  },
]

/** Tab bawaan saat halaman pertama dibuka — tab pertama di atas. */
export const TAB_JAGO_PAPAN_BAWAAN: TabJagoPapan = TAB_JAGO_PAPAN[0].id

export function konfigTab(id: TabJagoPapan): KonfigTabJagoPapan {
  return TAB_JAGO_PAPAN.find((t) => t.id === id) ?? TAB_JAGO_PAPAN[0]
}

export function saringTab(baris: RowJagoPapan[], id: TabJagoPapan): RowJagoPapan[] {
  return baris.filter(konfigTab(id).lolos)
}

// ── CSV ─────────────────────────────────────────────────────────────────

const KOLOM_CSV: (keyof RowJagoPapan)[] = [
  'kode', 'nama', 'harga', 'chg_1d', 'ma5', 'ma20', 'mcap', 'value', 'volume',
  'vol_ma20', 'near52w', 'net_asing', 'net_asing_ma10', 'net_asing_streak',
  'foreign_flow_kum', 'foreign_flow_ma20',
]

/** CSV mentah (koma, header ruas apa adanya) — tombol unduh murni memicu
 *  Blob di komponen, string-nya sendiri diuji tanpa DOM (pola sama
 *  `keCsvHarianPapan`). */
export function keCsvJagoPapan(baris: RowJagoPapan[]): string {
  const baris_ = baris.map((b) =>
    KOLOM_CSV.map((k) => {
      const v = b[k]
      if (v == null) return ''
      const s = String(v)
      return s.includes(',') ? `"${s}"` : s
    }).join(','),
  )
  return [KOLOM_CSV.join(','), ...baris_].join('\n')
}

// ── Pemuat ──────────────────────────────────────────────────────────────

export interface DataJagoPapan {
  tanggal: string
  diperbarui: string
  n: number
  emiten: RowJagoPapan[]
}

export async function ambilJagoPapan(pengambil: typeof fetch = fetch): Promise<DataJagoPapan | null> {
  try {
    const r = await pengambil('/data-idx/json/jago_papan/terbaru.json')
    if (!r.ok) return null
    return (await r.json()) as DataJagoPapan
  } catch {
    return null
  }
}

let cache: DataJagoPapan | null = null
let cacheSejak = 0
const UMUR_CACHE_MS = 30 * 60 * 1000 // sama Screener — jangan melewati satu sesi perdagangan

export function useJagoPapan(): DataJagoPapan | null {
  const segar = cache !== null && Date.now() - cacheSejak < UMUR_CACHE_MS
  const [data, setData] = useState<DataJagoPapan | null>(segar ? cache : null)
  useEffect(() => {
    if (cache && Date.now() - cacheSejak < UMUR_CACHE_MS) { setData(cache); return }
    let batal = false
    void ambilJagoPapan().then((d) => {
      if (d) { cache = d; cacheSejak = Date.now() }
      if (!batal) setData(d)
    })
    return () => { batal = true }
  }, [])
  return data
}
