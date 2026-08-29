import { useEffect, useState } from 'react'
import {
  sma, emaAkhir, rsi, stochK, cci, macd, rakitPeriode, labelSkor,
  type LabelSkor,
} from './skorTeknikal'
import type { BarisOhlc } from './ihsgOhlc'

/**
 * Harian Papan (`/harian-papan`, docs/spek-dev-papan/spek_harian_papan.md) —
 * tiga tab (Stock Gainer · Net Buy Foreign · Net Sell Foreign) satu bursa
 * satu tanggal, 962 emiten. Sumbernya per spek: `ohlcv_stockbit/` (chartbit,
 * bar sudah punya harga + volume + foreignbuy/foreignsell dalam SATU berkas
 * per emiten — tak perlu menjahit sumber terpisah), `emiten_sektor.json`
 * (sektor IDX-IC resmi), `profil/<KODE>.json` (free float, dari susunan
 * pemegang saham — pemakaian pertama ruas ini di halaman mana pun).
 *
 * Berkas ini murni FUNGSI (bisa diuji tanpa fetch/React) + pemuat cross-
 * section pracetak `data-idx/json/harian_papan/<tanggal>.json` (dibangun
 * `app/scripts/bangun-harian-papan.mjs`, pola sama `screener.json`/
 * `bangun-screener.mjs` — 962 emiten × riwayat penuh per tanggal terlalu
 * besar untuk dihitung ulang di klien tiap kunjungan halaman).
 *
 * ## Skor Papan — BUKAN skor SSS Screener
 *
 * Screener sudah punya kolom "SSS D/W/M" (skorTeknikal.ts), tapi rumusnya
 * TIDAK dipakai ulang di sini: rumus itu memakai periode MA 10/20/30/50/100/
 * 200, ambang osilator gaya TradingView (RSI≤30/≥70 dibaca KONTRARIAN —
 * jenuh jual = bullish), dan rata-rata rata semua komponen sekaligus.
 *
 * Skor Papan (padanan "SSS Score" penyedia lain, hasil benchmark 83 label —
 * lihat spek §Skor Papan) beda di tiga hal, dan ketiganya SENGAJA:
 * 1. Periode MA 5/10/20/50/100/200 (bukan 10/20/30/50/100/200).
 * 2. 4 osilator gaya MOMENTUM, bukan kontrarian — RSI14 TINGGI (≥60) dibaca
 *    BULLISH, bukan bearish. Tabel benchmark (spek) menunjukkan Strong Buy
 *    berkorelasi dengan RSI≈73 (TINGGI), jadi arahnya harus dibalik dari
 *    TradingView Technical Rating.
 * 3. Skor akhir = rata-rata DUA KELOMPOK (skor MA, skor 4 osilator) masing-
 *    masing 50%, BUKAN rata-rata rata seluruh 16 komponen (yang akan memberi
 *    bobot 12:4 ke arah MA).
 * Primitif indikator (sma/emaAkhir/rsi/stochK/cci/macd/rakitPeriode) DIPAKAI
 * ULANG dari skorTeknikal.ts — cuma pengelompokan & ambangnya beda.
 */

// ── Skor Papan ──────────────────────────────────────────────────────────

export const PERIODE_SKOR_PAPAN = [5, 10, 20, 50, 100, 200] as const

export interface KomponenSkorPapan {
  nama: string
  bias: -1 | 0 | 1
}

export interface HasilSkorPapan {
  skor: number
  label: LabelSkor
  ma: number
  osilator: number
  komponen: KomponenSkorPapan[]
}

/** Bias osilator gaya MOMENTUM: nilai TINGGI = bullish (+1), nilai RENDAH =
 *  bearish (−1) — kebalikan `biasAmbang` kontrarian di skorTeknikal.ts.
 *  Lihat komentar berkas untuk kenapa arahnya dibalik. */
function biasMomentum(v: number | null, ambangBawah: number, ambangAtas: number): -1 | 0 | 1 {
  if (v === null) return 0
  if (v >= ambangAtas) return 1
  if (v <= ambangBawah) return -1
  return 0
}

/** Skor Papan satu deret OHLC. `null` kalau deretnya lebih pendek dari 30
 *  bar (sama ambang minimum dengan `skorTeknikal()`). */
export function skorPapan(baris: BarisOhlc[]): HasilSkorPapan | null {
  if (baris.length < 30) return null
  const tutup = baris.map((b) => b[4])
  const harga = tutup[tutup.length - 1]

  const ma: KomponenSkorPapan[] = []
  const arahHarga = (v: number | null, nama: string) => {
    if (v === null) return
    ma.push({ nama, bias: harga > v ? 1 : harga < v ? -1 : 0 })
  }
  for (const n of PERIODE_SKOR_PAPAN) arahHarga(sma(tutup, n), `SMA ${n}`)
  for (const n of PERIODE_SKOR_PAPAN) arahHarga(emaAkhir(tutup, n), `EMA ${n}`)

  const osc: KomponenSkorPapan[] = []
  const r = rsi(tutup, 14)
  if (r !== null) osc.push({ nama: 'RSI 14', bias: biasMomentum(r, 40, 60) })
  const k = stochK(baris, 14)
  if (k !== null) osc.push({ nama: 'Stoch 14', bias: biasMomentum(k, 20, 80) })
  const c = cci(baris, 20)
  if (c !== null) osc.push({ nama: 'CCI 20', bias: biasMomentum(c, -100, 100) })
  const m = macd(tutup, 12, 26, 9)
  if (m) osc.push({ nama: 'MACD 12-26', bias: m[0] > 0 ? 1 : m[0] < 0 ? -1 : 0 })

  if (ma.length === 0 && osc.length === 0) return null
  const rata = (arr: KomponenSkorPapan[]) => (arr.length ? arr.reduce((a, b) => a + b.bias, 0) / arr.length : 0)
  const maSkor = rata(ma)
  const oscSkor = rata(osc)
  const skor = (maSkor + oscSkor) / 2
  return { skor, label: labelSkor(skor), ma: maSkor, osilator: oscSkor, komponen: [...ma, ...osc] }
}

export interface SkorPapanTigaKerangka {
  harian: HasilSkorPapan | null
  pekanan: HasilSkorPapan | null
  bulanan: HasilSkorPapan | null
}

export function skorPapanTigaKerangka(baris: BarisOhlc[]): SkorPapanTigaKerangka {
  return {
    harian: skorPapan(baris),
    pekanan: skorPapan(rakitPeriode(baris, 'pekan')),
    bulanan: skorPapan(rakitPeriode(baris, 'bulan')),
  }
}

// ── Kolom lain ──────────────────────────────────────────────────────────

/** NBSF (000) — net asing dalam RIBU rupiah, tanda apa adanya (positif =
 *  net beli). Temuan 1 spek: penyedia lain mencetak tanda terbalik di tabel
 *  "Net Sell" mereka (minus borongan walau net-nya beli) — Harian Papan
 *  WAJIB memakai tanda sebenarnya, jangan meniru itu. */
export function hitungNbsf000(foreignBuy: number, foreignSell: number): number {
  return (foreignBuy - foreignSell) / 1000
}

export function hitungCloseGap(bukaHariIni: number, tutupKemarin: number): number | null {
  return tutupKemarin > 0 ? ((bukaHariIni - tutupKemarin) / tutupKemarin) * 100 : null
}

export function hitungChg1d(hargaKini: number, tutupKemarin: number): number | null {
  return tutupKemarin > 0 ? (hargaKini / tutupKemarin - 1) * 100 : null
}

/** %chg WTD/MTD — harga kini vs tutup PEKAN/BULAN sebelumnya (elemen -2 hasil
 *  `rakitPeriode`; elemen -1 adalah pekan/bulan BERJALAN yang belum tutup).
 *  TDM% di spek = MTD persis rumus ini (Temuan terpecahkan 25 Agu 2026). */
export function hitungChgPeriode(hargaKini: number, rakit: BarisOhlc[]): number | null {
  if (rakit.length < 2) return null
  const dasar = rakit[rakit.length - 2][4]
  return dasar > 0 ? (hargaKini / dasar - 1) * 100 : null
}

/** RVol(10) — volume hari ini dibagi rata-rata volume 10 hari bursa
 *  SEBELUMNYA (tidak termasuk hari ini). Butuh 11 titik penuh. */
export function hitungRvol10(volume: (number | null | undefined)[], n = 10): number | null {
  if (volume.length < n + 1) return null
  const dasar = volume.slice(-(n + 1), -1)
  const rata = dasar.reduce((a: number, b) => a + (b ?? 0), 0) / dasar.length
  return rata > 0 ? (volume[volume.length - 1] ?? 0) / rata : null
}

/** Arah MA20 ITU SENDIRI (naik/turun/datar dibanding satu hari sebelumnya)
 *  — bukan posisi harga terhadapnya (itu `posisiHarga`). */
export function hitungMa20Arah(tutup: number[]): 'naik' | 'datar' | 'turun' | null {
  const kini = sma(tutup, 20)
  const lalu = tutup.length >= 21 ? sma(tutup.slice(0, -1), 20) : null
  if (kini === null || lalu === null) return null
  return kini > lalu ? 'naik' : kini < lalu ? 'turun' : 'datar'
}

export function posisiHarga(harga: number, v: number | null): 'atas' | 'bawah' | null {
  if (v === null) return null
  if (harga > v) return 'atas'
  if (harga < v) return 'bawah'
  return null
}

/** Satu baris pemegang saham `profil/<KODE>.json` — cuma ruas yang dipakai
 *  turunan free float. */
export interface PemegangSahamRingkas {
  persen: number
  pengendali: boolean
}

/** Free float % = 100 − jumlah persen pemegang PENGENDALI. `profil/*.json`
 *  tak punya ruas "free float" langsung — ini pemakaian pertama ruas
 *  `pemegang_saham` untuk itu (spek: "ada, perlu dipetakan"). `null` kalau
 *  berkas profil tak ada/kosong — dibiarkan basi, bukan ditebak (0% berarti
 *  klaim "seluruhnya dikuasai", beda dari "tak diketahui"). */
export function hitungFreeFloat(pemegang: PemegangSahamRingkas[] | null | undefined): number | null {
  if (!pemegang || pemegang.length === 0) return null
  const dikuasai = pemegang.filter((p) => p.pengendali).reduce((a, p) => a + p.persen, 0)
  return Math.max(0, Math.min(100, 100 - dikuasai))
}

/** Temuan 3 spek: emiten yang volumenya NOL pada tanggal terpilih tidak
 *  benar-benar "diperdagangkan" hari itu meski harga tercatat tak berubah —
 *  dipakai mengeluarkannya dari peringkat Stock Gainer. Definisi per-HARI ini
 *  SENGAJA beda dari `AMBANG_BEKU` (lib/statusBeku.ts, ambang 20 hari
 *  berturut-turut) — itu untuk lencana kartu tanggal-terkini, ini untuk satu
 *  tanggal manapun yang dipilih pembaca di sini. */
export function tidakDiperdagangkanHariIni(volumeHariIni: number | null | undefined): boolean {
  return (volumeHariIni ?? 0) === 0
}

// ── Baris gabungan satu emiten ─────────────────────────────────────────

/** Bentuk longgar satu bar `ohlcv_stockbit/<KODE>.json` — cuma indeks yang
 *  dipakai di sini disebut eksplisit (lihat `d.kolom` di berkas sumber untuk
 *  urutan lengkap 17 ruas). */
export type BarOhlcvStockbit = readonly [
  tanggal: string,
  unixdate: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
  value: number,
  frequency: number,
  foreignbuy: number,
  foreignsell: number,
  ...rest: number[]
]

function keBarisOhlc(bar: BarOhlcvStockbit): BarisOhlc {
  return [bar[0], bar[2], bar[3], bar[4], bar[5], bar[6]]
}

export interface BarisHarianPapan {
  kode: string
  nama: string | null
  sektor: string
  harga: number | null
  /** = MTD (spek §Kolom, Temuan terpecahkan) — perubahan sejak tutup hari
   *  bursa terakhir BULAN sebelumnya, bukan momentum N-hari. */
  tdm_persen: number | null
  volume: number | null
  rvol10: number | null
  nilai: number | null
  nbsf_000: number | null
  free_float: number | null
  ma20_arah: 'naik' | 'datar' | 'turun' | null
  close_gap: number | null
  chg_1d: number | null
  chg_wtd: number | null
  chg_mtd: number | null
  posisi_ema5: 'atas' | 'bawah' | null
  posisi_ma10: 'atas' | 'bawah' | null
  posisi_ma20: 'atas' | 'bawah' | null
  skor_d: LabelSkor | null
  skor_w: LabelSkor | null
  skor_m: LabelSkor | null
  tidak_diperdagangkan: boolean
  /** Sampai 5 bar terakhir (lama→baru, {open,close}) — adendum Rapor & Badge
   *  (docs/spek-dev-papan/adendum_rapor_badge.md): kolom Form wajib di SEMUA
   *  tabel emiten. Cuma bahan mentah untuk `hitungForm()` (raporBadge.ts) di
   *  sisi komponen — dihitung ulang di sana (bukan di sini) supaya rumus
   *  form tetap SATU sumber (raporBadge.ts), bukan disalin ke pemuat ini. */
  bar5: { open: number; close: number }[]
  /** Selisih menang−kalah kolom Form (mis. 4-1 → +3, 1-4 → −3).
   *  Dihitung di sini SUPAYA KOLOMNYA BISA DIURUT (Johan 29 Agu: "form ini
   *  berdasarkan apa? seharusnya bisa di sorting juga"). Panah & label tetap
   *  dirender `hitungForm` dari `bar5` — angka ini cuma kunci urut, bukan
   *  sumber tampilan kedua yang bisa menyimpang darinya. */
  form_skor: number | null
}

/**
 * Baris satu emiten pada satu tanggal. `barSampaiTanggal` HARUS sudah
 * dipotong pemanggil sampai & TERMASUK tanggal target sebagai elemen
 * TERAKHIR — baris sesudahnya tidak boleh ikut, atau seluruh indikator
 * (MA/skor/%chg "vs kemarin") diam-diam mengintip masa depan.
 */
export function bangunBarisHarianPapan(
  kode: string,
  nama: string | null,
  sektor: string,
  freeFloat: number | null,
  barSampaiTanggal: BarOhlcvStockbit[],
): BarisHarianPapan | null {
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
    bar5: barSampaiTanggal.slice(-5).map((b) => ({ open: b[2], close: b[5] })),
    form_skor: (() => {
      const lima = barSampaiTanggal.slice(-5)
      if (lima.length === 0) return null
      let n = 0
      for (const b of lima) {
        const d = Number(b[5]) - Number(b[2])
        if (d > 0) n += 1
        else if (d < 0) n -= 1
      }
      return n
    })(),
  }
}

// ── Saring & urut per tab ───────────────────────────────────────────────

export type TabHarianPapan = 'gainer' | 'net-buy' | 'net-sell'

/** Stock Gainer mengeluarkan emiten yang tak diperdagangkan tanggal itu
 *  (Temuan 3 spek) — dua tab Net Buy/Sell TIDAK disaring: NBSF emiten beku
 *  otomatis 0 dan tenggelam sendiri di kedua peringkat tanpa perlu aturan
 *  saring terpisah. */
export function barisUntukTab(baris: BarisHarianPapan[], tab: TabHarianPapan): BarisHarianPapan[] {
  return tab === 'gainer' ? baris.filter((b) => !b.tidak_diperdagangkan) : baris
}

export function sektorUnikHarianPapan(baris: BarisHarianPapan[]): string[] {
  return [...new Set(baris.map((b) => b.sektor))].sort((a, b) => a.localeCompare(b, 'id'))
}

const KOLOM_CSV: (keyof BarisHarianPapan)[] = [
  'kode', 'nama', 'sektor', 'harga', 'tdm_persen', 'volume', 'rvol10', 'nilai',
  'nbsf_000', 'free_float', 'ma20_arah', 'close_gap', 'chg_1d', 'chg_wtd', 'chg_mtd',
  'posisi_ema5', 'posisi_ma10', 'posisi_ma20', 'skor_d', 'skor_w', 'skor_m',
  'tidak_diperdagangkan',
]

/** CSV mentah (koma, header ruas apa adanya) — tombol unduh murni memicu
 *  Blob di komponen, string-nya sendiri diuji tanpa DOM. */
export function keCsvHarianPapan(
  baris: BarisHarianPapan[],
  /** Hari ini dirakit dari data bursa, jadi `nbsf_000`-nya taksiran. Penanda
   *  visual di tabel (miring + ≈) TIDAK ikut ke berkas, dan CSV justru yang
   *  paling mungkin dijumlahkan di tempat lain berbulan-bulan kemudian —
   *  jadi penandanya harus ada di NAMA KOLOM, satu-satunya bagian yang pasti
   *  ikut terbawa ke mana pun berkas itu dibuka. */
  nbsfTaksiran = false,
): string {
  const kepala = KOLOM_CSV.map((k) =>
    nbsfTaksiran && k === 'nbsf_000' ? 'nbsf_000_taksiran' : k,
  )
  const baris_ = baris.map((b) =>
    KOLOM_CSV.map((k) => {
      const v = b[k]
      if (v == null) return ''
      const s = String(v)
      return s.includes(',') ? `"${s}"` : s
    }).join(','),
  )
  return [kepala.join(','), ...baris_].join('\n')
}

// ── Pemuat ──────────────────────────────────────────────────────────────

export interface DataHarianPapan {
  tanggal: string
  diperbarui: string
  n: number
  /** Hari ini dirakit dari data bursa, bukan dari arsip harga biasa — dipakai
   *  saat arsip harga belum memuat hari itu. Angkanya terukur sama (median
   *  rasio 1,000000 atas 8.976 pasang emiten-hari), tapi bursa tak selalu
   *  melaporkan harga pembukaan, jadi kolom Close Gap bisa kosong. Halaman
   *  WAJIB menyebutkan ini — pembaca berhak tahu angkanya dari mana. */
  dari_bursa?: boolean
  emiten: BarisHarianPapan[]
}

export interface DataTanggalHarianPapan {
  diperbarui: string
  /** Terurut BARU → LAMA — elemen [0] = bawaan (hari bursa terakhir yang
   *  datanya lengkap, spek §Halaman). */
  tanggal_tersedia: string[]
}

export async function ambilTanggalHarianPapan(pengambil: typeof fetch = fetch): Promise<DataTanggalHarianPapan | null> {
  try {
    const r = await pengambil('/data-idx/json/harian_papan/index.json')
    if (!r.ok) return null
    return (await r.json()) as DataTanggalHarianPapan
  } catch {
    return null
  }
}

export async function ambilHarianPapan(tanggal: string, pengambil: typeof fetch = fetch): Promise<DataHarianPapan | null> {
  try {
    const r = await pengambil(`/data-idx/json/harian_papan/${tanggal}.json`)
    if (!r.ok) return null
    return (await r.json()) as DataHarianPapan
  } catch {
    return null
  }
}

let cacheTanggal: DataTanggalHarianPapan | null = null
let cacheTanggalSejak = 0
// TTL 30 menit (audit kesegaran 27 Agu §2) — pola screener.ts; tanpa ini data halaman membeku sampai muat-ulang penuh.
const UMUR_CACHE_MS = 30 * 60 * 1000

export function useTanggalHarianPapan(): DataTanggalHarianPapan | null {
  const segar = cacheTanggal !== null && Date.now() - cacheTanggalSejak < UMUR_CACHE_MS
  const [data, setData] = useState<DataTanggalHarianPapan | null>(segar ? cacheTanggal : null)
  useEffect(() => {
    if (cacheTanggal && Date.now() - cacheTanggalSejak < UMUR_CACHE_MS) { setData(cacheTanggal); return }
    let batal = false
    void ambilTanggalHarianPapan().then((d) => {
      if (d) { cacheTanggal = d; cacheTanggalSejak = Date.now() }
      if (!batal) setData(d)
    })
    return () => { batal = true }
  }, [])
  return data
}

const cacheHarian = new Map<string, DataHarianPapan>()

/** `tanggal === null` berarti belum siap memuat (mis. menunggu tanggal
 *  bawaan dari `useTanggalHarianPapan`) — sengaja tak fetch apa pun. */
export function useHarianPapan(tanggal: string | null): { data: DataHarianPapan | null; muat: boolean } {
  const cached = tanggal ? cacheHarian.get(tanggal) ?? null : null
  const [data, setData] = useState<DataHarianPapan | null>(cached)
  const [muat, setMuat] = useState(tanggal !== null && !cached)
  useEffect(() => {
    if (!tanggal) { setData(null); setMuat(false); return }
    const ada = cacheHarian.get(tanggal)
    if (ada) { setData(ada); setMuat(false); return }
    let batal = false
    setMuat(true)
    void ambilHarianPapan(tanggal).then((d) => {
      if (d) cacheHarian.set(tanggal, d)
      if (!batal) { setData(d); setMuat(false) }
    })
    return () => { batal = true }
  }, [tanggal])
  return { data, muat }
}

/**
 * Muat BEBERAPA tanggal sekaligus untuk mode rentang (29 Agu 2026).
 *
 * Memakai cache modul yang sama dengan `useHarianPapan`, jadi tanggal yang
 * sudah pernah dibuka satu-satu tak diambil ulang. Tanggal yang tak punya
 * berkas (akhir pekan, libur, hari yang belum dibangun) dilewati diam-diam —
 * itu keadaan normal, bukan galat; jumlah hari yang benar-benar terpakai
 * dilaporkan pemanggil lewat `tanggalDipakai`.
 */
export function useHarianPapanRentang(dari: string | null, sampai: string | null): {
  perTanggal: Map<string, BarisHarianPapan[]>
  muat: boolean
} {
  const [perTanggal, setPerTanggal] = useState<Map<string, BarisHarianPapan[]>>(new Map())
  const [muat, setMuat] = useState(false)

  useEffect(() => {
    if (!dari || !sampai) { setPerTanggal(new Map()); setMuat(false); return }
    let batal = false
    setMuat(true)

    // Daftar tanggal kalender di rentang; yang tak berdata gugur saat fetch.
    const daftar: string[] = []
    const d = new Date(`${dari}T00:00:00`)
    const akhir = new Date(`${sampai}T00:00:00`)
    // Pagar 400 hari: rentang yang keliru lebar (mis. salah klik tahun) akan
    // menembak ratusan permintaan sebelum ada yang sadar.
    // ISO dirakit dari ruas LOKAL, bukan lewat toISOString(): tanggal
    // dibangun dengan `new Date("...T00:00:00")` yang berarti tengah malam
    // WAKTU SETEMPAT, dan toISOString() mengubahnya ke UTC — di WIB itu
    // mundur 7 jam alias SATU HARI PENUH. Terlihat saat verifikasi 29 Agu:
    // rentang berlabel "14 – 27 Agu" mengambil berkas 13–26 Agu.
    const isoLokal = (x: Date) =>
      `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`
    while (d <= akhir && daftar.length < 400) {
      daftar.push(isoLokal(d))
      d.setDate(d.getDate() + 1)
    }

    void Promise.all(daftar.map((t) => {
      const ada = cacheHarian.get(t)
      if (ada) return Promise.resolve<[string, DataHarianPapan | null]>([t, ada])
      return ambilHarianPapan(t).then((r) => {
        if (r) cacheHarian.set(t, r)
        return [t, r] as [string, DataHarianPapan | null]
      })
    })).then((hasil) => {
      if (batal) return
      const peta = new Map<string, BarisHarianPapan[]>()
      for (const [t, r] of hasil) if (r?.emiten?.length) peta.set(t, r.emiten)
      setPerTanggal(peta)
      setMuat(false)
    })
    return () => { batal = true }
  }, [dari, sampai])

  return { perTanggal, muat }
}
