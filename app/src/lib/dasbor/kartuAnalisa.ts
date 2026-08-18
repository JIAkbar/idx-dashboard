import { useEffect, useState } from 'react'

/**
 * Kartu Analisa Emiten — tipe & pemuat untuk `data-idx/json/kartu/<KODE>.json`,
 * ditulis `scripts/riset/kartu_analisa.py --tulis` (bukan dihitung ulang di
 * sini). SELURUH angka di berkas ini sudah jadi — TypeScript cuma membaca dan
 * menampilkan, tidak pernah menghitung ulang rumusnya (dua sumber kebenaran
 * yang bisa menyimpang diam-diam adalah persis yang mau dihindari).
 */

export interface LevelSR {
  level: number
  sentuhan: number
  terakhir: string
  dalam_atr: boolean
  /** Sudah dibulatkan ke fraksi harga BEI oleh skrip Python — tampilkan apa adanya. */
  harga: number
}

export interface FirstPassage {
  n: number
  kena?: number
  stop?: number
  lewat?: number
  p_kena?: number
  p_stop?: number
  median_hari?: number | null
  q1?: number | null
  q3?: number | null
  harapan?: number
}

export interface TargetItem {
  harga: number
  pct: number
  sentuhan: number
  terakhir: string
  fp: FirstPassage
  fp60: FirstPassage
}

export interface Musiman {
  n: number
  naik: number
  mentah: number | null
  tersusut: number
  bawah: number
  atas: number
  median: number | null
  dasar: number
  total_bulan: number
}

export interface SektorRingkas {
  nama: string | null
  sektor: string | null
  subsektor: string | null
  subindustri: string | null
  papan: string | null
  tercatat: string | null
}

export interface FundamentalRingkas {
  name?: string | null
  updated?: string | null
  pe?: number | null
  pb?: number | null
  eps?: number | null
  roe?: number | null
  der?: number | null
  npm?: number | null
  rev_yoy?: number | null
  ni_yoy?: number | null
  dividend_yield?: number | null
  beta?: number | null
  shares?: number | null
  float_pct?: number | null
  week52_high?: number | null
  week52_low?: number | null
}

export interface AsingPeriode {
  n: number
  beli: number
  jual: number
  net: number
  porsi_beli_pct: number | null
  porsi_jual_pct: number | null
}

export interface AsingRingkas {
  satuan: Record<string, string>
  mulai: string
  akhir: string
  n_total: number
  periode: Record<string, AsingPeriode>
}

export interface KartuEmiten {
  kode: string
  tgl: string
  harga: number
  prev: number
  chg: number
  n: number
  mulai: string
  ma20: number | null
  ma50: number | null
  ma200: number | null
  atr: number | null
  atr_pct: number | null
  rsi: number | null
  stochrsi: [number, number] | null
  support: LevelSR[]
  resistance: LevelSR[]
  stop: number
  stop_pct: number
  target: TargetItem[]
  er: number | null
  er_persentil: number | null
  er_n_populasi: number | null
  likuiditas_median20: number
  musiman: Musiman
  sektor: SektorRingkas
  fundamental: FundamentalRingkas
  /** `null` = belum dipanen untuk emiten ini — WAJIB tampil "belum tersedia", bukan 0. */
  asing: AsingRingkas | null
  /** Tanggal data terakhir yang dipakai menghitung kartu ini. */
  dihitung: string
}

export interface IndeksKartuEntry {
  kode: string
  dihitung: string
}

export interface IndeksKartu {
  diperbarui: string
  emiten: IndeksKartuEntry[]
}

// ── Pemuat — logika murni dipisah dari hook supaya bisa diuji tanpa render
// React (pola sama netPeriode/persentilNet di PanelAliranAsing.tsx). ──

/**
 * Ambil satu berkas kartu. Berkas yang tak ada (404, emiten belum dihitung)
 * ATAU jaringan gagal mengembalikan `null` — BUKAN melempar galat, dan BUKAN
 * objek kosong yang bisa terbaca sebagai "harga 0". Pemanggil (hook di bawah,
 * atau komponen) WAJIB menafsirkan `null` sebagai "belum tersedia".
 */
export async function ambilKartu(kode: string, pengambil: typeof fetch = fetch): Promise<KartuEmiten | null> {
  try {
    const r = await pengambil(`/data-idx/json/kartu/${kode}.json`)
    if (!r.ok) return null
    return (await r.json()) as KartuEmiten
  } catch {
    return null
  }
}

/** Sama polanya, untuk daftar kode yang tersedia (`index.json`). */
export async function ambilIndeksKartu(pengambil: typeof fetch = fetch): Promise<IndeksKartu | null> {
  try {
    const r = await pengambil('/data-idx/json/kartu/index.json')
    if (!r.ok) return null
    return (await r.json()) as IndeksKartu
  } catch {
    return null
  }
}

const cacheKartu = new Map<string, KartuEmiten | null>()
let cacheIndeks: IndeksKartu | null = null

export type StatusKartu = 'memuat' | 'tersedia' | 'belum-tersedia'

/** Daftar kode yang punya kartu jadi (`index.json`) — `null` selagi belum dimuat. */
export function useIndeksKartu(): IndeksKartu | null {
  const [data, setData] = useState<IndeksKartu | null>(cacheIndeks)
  useEffect(() => {
    if (cacheIndeks) return
    let batal = false
    void ambilIndeksKartu().then((d) => {
      if (d) cacheIndeks = d
      if (!batal) setData(d)
    })
    return () => { batal = true }
  }, [])
  return data
}

/** Satu kartu emiten, dengan cache modul sederhana (sekali per kode per sesi). */
export function useKartu(kode: string | null): { data: KartuEmiten | null; status: StatusKartu } {
  const [data, setData] = useState<KartuEmiten | null>(kode && cacheKartu.has(kode) ? (cacheKartu.get(kode) ?? null) : null)
  const [status, setStatus] = useState<StatusKartu>(() => {
    if (!kode) return 'belum-tersedia'
    if (!cacheKartu.has(kode)) return 'memuat'
    return cacheKartu.get(kode) ? 'tersedia' : 'belum-tersedia'
  })

  useEffect(() => {
    if (!kode) { setData(null); setStatus('belum-tersedia'); return }
    if (cacheKartu.has(kode)) {
      const d = cacheKartu.get(kode) ?? null
      setData(d)
      setStatus(d ? 'tersedia' : 'belum-tersedia')
      return
    }
    let batal = false
    setStatus('memuat')
    setData(null)
    void ambilKartu(kode).then((d) => {
      cacheKartu.set(kode, d)
      if (batal) return
      setData(d)
      setStatus(d ? 'tersedia' : 'belum-tersedia')
    })
    return () => { batal = true }
  }, [kode])

  return { data, status }
}

// ── Turunan murni untuk tampilan (diuji kartuAnalisa.test.ts) ──

/**
 * Peringatan "pembatal di dalam satu ATR" — jarak ke pembatal (persen) lebih
 * kecil daripada ayunan harian normal emiten ini (ATR harian, persen). Kalau
 * ya, level itu ada di dalam ayunan harian biasa, bukan level yang berarti.
 * Dihitung dari data (bukan diketik untuk emiten tertentu) — WAJIB muncul
 * otomatis kalau syaratnya terpenuhi, apa pun emitennya.
 */
export function pembatalDalamAtr(k: Pick<KartuEmiten, 'stop_pct' | 'atr_pct'>): boolean {
  return k.atr_pct != null && k.stop_pct < k.atr_pct
}

function fmtHarga(v: number): string {
  return Math.round(v).toLocaleString('id-ID')
}

/** Persen id-ID (koma desimal) — bukan `toFixed` (titik), konsisten dengan angka lain di kartu. */
function fmtPct(v: number, d = 2): string {
  const teks = Math.abs(v).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
  return `${v >= 0 ? '+' : '-'}${teks}%`
}
function fmtPctPos(v: number, d = 2): string {
  return `${v.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })}%`
}

export interface Tesis {
  terbaca: string[]
  membatalkan: string[]
  perluDiingat: string[]
}

/**
 * Blok tesis (Yang terbaca / Yang membatalkan / Yang perlu diingat) — dirakit
 * dari kalimat berpola, seluruhnya dari data kartu. TIDAK ada narasi yang
 * diketik khusus untuk satu emiten: sengaja begitu supaya berlaku untuk
 * emiten mana pun di `index.json`, bukan cuma tiga yang sudah ada.
 */
export function bangunTesis(k: KartuEmiten): Tesis {
  const terbaca: string[] = []
  const membatalkan: string[] = []
  const perluDiingat: string[] = []

  const posisi = (nilai: number | null, label: string) =>
    nilai == null ? null : `${nilai <= k.harga ? 'di atas' : 'di bawah'} ${label} (${fmtHarga(nilai)})`
  const bagianMA = [posisi(k.ma20, 'MA20'), posisi(k.ma50, 'MA50'), posisi(k.ma200, 'MA200')].filter(
    (x): x is string => x !== null,
  )
  if (bagianMA.length > 0) {
    terbaca.push(`Harga ${fmtHarga(k.harga)} ${bagianMA.join(', ')} — perubahan hari terakhir ${fmtPct(k.chg, 2)}.`)
  }
  if (k.fundamental.rev_yoy != null && k.fundamental.ni_yoy != null) {
    terbaca.push(`Pendapatan tumbuh ${fmtPct(k.fundamental.rev_yoy, 1)} YoY, laba bersih ${fmtPct(k.fundamental.ni_yoy, 1)} YoY.`)
  }
  if (k.er_persentil != null && k.er_n_populasi) {
    terbaca.push(
      `Efficiency Ratio berada di persentil ${Math.round(k.er_persentil)} dari ${k.er_n_populasi} emiten ber-riwayat cukup — `
      + `${k.er_persentil >= 50 ? 'lebih trending' : 'lebih sideways'} daripada mayoritas pasar.`,
    )
  }

  const s1 = k.support[0]
  membatalkan.push(
    `Penutupan di bawah ${fmtHarga(k.stop)} (${fmtPct(-k.stop_pct, 2)})`
    + (s1 ? ` — klaster support dengan ${s1.sentuhan} sentuhan, terakhir ${s1.terakhir}.` : '.'),
  )

  perluDiingat.push(`Jarak ke pembatal ${fmtPctPos(k.stop_pct)} dari harga sekarang.`)
  if (pembatalDalamAtr(k) && k.atr_pct != null) {
    perluDiingat.push(
      `Jarak itu lebih kecil daripada satu ATR harian (${fmtPctPos(k.atr_pct)}) — pembatal berada di dalam ayunan harian normal emiten ini.`,
    )
  }
  if (k.musiman.n > 0 && k.musiman.n < 8) {
    perluDiingat.push(`Musiman bulan ini cuma dari ${k.musiman.n} pengamatan — selang kepercayaannya lebar, bacalah dengan hati-hati.`)
  }

  return { terbaca, membatalkan, perluDiingat }
}
