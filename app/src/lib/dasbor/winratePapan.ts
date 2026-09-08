/**
 * Winrate PAPAN — pembaca berkas `winrate/<KODE>.json` + `winrate/index.json`
 * (dibangun batch riset dari arsip harga, nol jaringan) dan helper murni
 * yang dipakai halaman `/winrate`.
 *
 * Angka di sini TIDAK dihitung ulang di peramban: aturannya milik batch yang
 * sama dengan kartu rencana dagang, jadi 120 sinyal h5/h10/h20 di halaman ini
 * identik dengan yang tercetak di Kartu Analisa. Halaman cuma memilih,
 * memformat, dan memberi label — kalau ada yang ingin "menyesuaikan" angka,
 * tempatnya di batch, bukan di sini.
 */
import { useEffect, useState } from 'react'
import { fraksi } from '../fraksiHarga'

export type Horizon = 'h5' | 'h10' | 'h20' | 'h60' | 'h120' | 'h200'
export type Jendela = 'n120' | 'n500'
export const HORIZON: readonly Horizon[] = ['h5', 'h10', 'h20', 'h60', 'h120', 'h200']
export const HARI_HORIZON: Record<Horizon, number> = { h5: 5, h10: 10, h20: 20, h60: 60, h120: 120, h200: 200 }
export const LABEL_JENDELA: Record<Jendela, string> = { n120: '120 sinyal terakhir', n500: '500 sinyal' }

/** Ringkasan satu kelompok sinyal — bentuk yang sama untuk tabel horizon
 *  maupun tiap kondisi saringan. */
export interface RingkasWinrate {
  menang: number
  kalah: number
  gantung: number
  n: number
  /** Dari yang TUNTAS (menang + kalah); null bila belum ada yang tuntas. */
  winRate: number | null
  /** Penyebut penuh: dari SELURUH sinyal termasuk yang menggantung. */
  winRateSemua: number | null
  ekspektansi: number | null
  /** Sesudah biaya pulang-pergi — angka utamanya. */
  ekspektansiBiaya: number | null
  rataMenang: number | null
  rataKalah: number | null
  rataGantung: number | null
  medianBarKe: number | null
  /** n ÷ horizon — sinyal harian yang jendelanya beririsan bukan sampel bebas. */
  nEfektif?: number
}

export interface ReturnMentah {
  n: number
  nEfektif: number
  winRate: number
  median: number
  p25: number
  p75: number
  rata: number
}

export interface PersentilPasar { persentilWinRate: number; persentilEks: number }

export interface BerkasWinrate {
  dibangun: string
  kelasBukti: string
  biayaPct: number
  kode: string
  nBar: number
  mulai: string
  akhir: string
  horizon: Record<Horizon, Record<Jendela, RingkasWinrate>>
  returnMentah: Record<Horizon, ReturnMentah | null>
  saringan: Record<'h20' | 'h60', Record<string, RingkasWinrate>>
  barBeku: Record<string, { beku: number; bar: number; pct: number }>
  teknikal: {
    harga: number
    ma20: number | null
    ma50: number | null
    ma200: number | null
    rsi14: number | null
    tertinggi52: number
    terendah52: number
  }
  /** null = emiten tak punya rencana dagang hari ini (mis. ATR nol). */
  rencana: {
    tanggal: string
    harga: number
    areaBeli: [number, number]
    tp1: number
    tp2: number
    sl: number
    rr: number | null
    atrPct: number
    nilaiHarian: number | null
  } | null
  pasar: Partial<Record<Horizon, PersentilPasar>>
}

export interface DistribusiPasar {
  n: number
  winRateMedian: number
  winRateP25: number
  winRateP75: number
  eksMedian: number
  eksP25: number
  eksP75: number
  pctEksPositif: number
}

export interface IndexWinrate {
  dibangun: string
  kelasBukti: string
  biayaPct: number
  akhir: string | null
  nEmiten: number
  pasar: Record<Horizon, DistribusiPasar | { n: 0 }>
  emiten: Record<string, { akhir: string; nBar: number; p: Partial<Record<Horizon, [number, number]>> }>
}

/** Urutan tampil 13 kondisi saringan — per keluarga, dari "rendah" ke "tinggi". */
export const URUTAN_SARINGAN: readonly string[] = [
  'RSI < 30', 'RSI 30–70', 'RSI > 70',
  'Di atas MA20·50·200', 'Campuran MA', 'Di bawah MA20·50·200',
  'Volume > 1,5× rata 20 hari', 'Volume normal', 'Volume < 0,5× rata 20 hari',
  'Asing net beli 5 hari', 'Asing net jual/nol 5 hari',
  'ATR di atas median', 'ATR di bawah median',
]

/** Batas n supaya sebuah kondisi boleh diberi lencana — di bawah ini satu
 *  kejadian menggeser ekspektansinya terlalu jauh untuk dipercaya. */
export const N_SARINGAN_SAH = 30

/** Kondisi terbaik & terburuk menurut ekspektansi sesudah biaya, HANYA di
 *  antara kondisi yang n-nya sah. null = tak ada yang sah. */
export function lencanaSaringan(
  saringan: Record<string, RingkasWinrate>,
  minN = N_SARINGAN_SAH,
): { terbaik: string | null; terburuk: string | null } {
  const sah = Object.entries(saringan)
    .filter(([, r]) => r.n >= minN && r.ekspektansiBiaya != null)
  if (!sah.length) return { terbaik: null, terburuk: null }
  let terbaik = sah[0]
  let terburuk = sah[0]
  for (const s of sah) {
    if ((s[1].ekspektansiBiaya as number) > (terbaik[1].ekspektansiBiaya as number)) terbaik = s
    if ((s[1].ekspektansiBiaya as number) < (terburuk[1].ekspektansiBiaya as number)) terburuk = s
  }
  // Satu kondisi saja yang sah = ia terbaik sekaligus terburuk; itu bukan
  // informasi, jadi lencananya tak diberikan.
  return sah.length === 1 ? { terbaik: null, terburuk: null } : { terbaik: terbaik[0], terburuk: terburuk[0] }
}

/** Satu tick fraksi bursa dalam persen harga — biaya nyata yang tak tampak
 *  di angka ekspektansi: di harga Rp 100, satu tick = 1%. */
export function tickPersen(harga: number): number | null {
  if (!Number.isFinite(harga) || harga <= 0) return null
  return (fraksi(harga) / harga) * 100
}

/** Posisi harga di rentang 52 minggu, 0..1; null bila rentangnya nol. */
export function posisi52(harga: number, terendah: number, tertinggi: number): number | null {
  const lebar = tertinggi - terendah
  if (!(lebar > 0)) return null
  return Math.min(1, Math.max(0, (harga - terendah) / lebar))
}

// ── pembaca berkas ─────────────────────────────────────────────────────────
const singgahan = new Map<string, Promise<BerkasWinrate | null>>()

export function ambilWinrate(kode: string): Promise<BerkasWinrate | null> {
  let p = singgahan.get(kode)
  if (!p) {
    p = fetch(`/data-idx/json/winrate/${encodeURIComponent(kode)}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<BerkasWinrate>) : null))
      .catch(() => null)
    singgahan.set(kode, p)
  }
  return p
}

export type StatusWinrate = 'memuat' | 'ada' | 'tidak-ada'

export function useWinrate(kode: string | null): { data: BerkasWinrate | null; status: StatusWinrate } {
  const [state, setState] = useState<{ kode: string | null; data: BerkasWinrate | null; status: StatusWinrate }>(
    { kode: null, data: null, status: 'memuat' },
  )
  useEffect(() => {
    if (!kode) return
    let batal = false
    setState({ kode, data: null, status: 'memuat' })
    void ambilWinrate(kode).then((d) => {
      if (!batal) setState({ kode, data: d, status: d ? 'ada' : 'tidak-ada' })
    })
    return () => { batal = true }
  }, [kode])
  return state.kode === kode ? { data: state.data, status: state.status } : { data: null, status: 'memuat' }
}

let indexPromise: Promise<IndexWinrate | null> | null = null

export function ambilIndexWinrate(): Promise<IndexWinrate | null> {
  if (!indexPromise) {
    indexPromise = fetch('/data-idx/json/winrate/index.json')
      .then((r) => (r.ok ? (r.json() as Promise<IndexWinrate>) : null))
      .catch(() => null)
  }
  return indexPromise
}

export function useIndexWinrate(): IndexWinrate | null {
  const [index, setIndex] = useState<IndexWinrate | null>(null)
  useEffect(() => {
    let batal = false
    void ambilIndexWinrate().then((d) => { if (!batal) setIndex(d) })
    return () => { batal = true }
  }, [])
  return index
}
