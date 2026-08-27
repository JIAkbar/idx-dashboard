import { useEffect, useState } from 'react'

/**
 * IPO Papan (`/ipo`) — angkanya SUDAH dihitung di sisi Node
 * (`app/scripts/bangun-ipo.mjs` → `data-idx/json/ipo.json`); berkas ini cuma
 * memuat, saring/urut/agregat TAMPILAN (pola sama `screener.ts`).
 *
 * Definisi horizon (dicetak juga di layar, jangan cuma di sini): "bar ke-N"
 * dihitung dari bar pertama yang tanggalnya ≥ tanggal listing — 1D = bar
 * ke-1 (bar itu sendiri), 1W = bar ke-5, 1M = bar ke-21, Kini = bar terakhir
 * arsip. `win` = return > 0.
 */

export interface HorizonAgregat {
  /** Jumlah emiten yang PUNYA angka return di horizon ini — bukan selalu
   *  sama dengan `n` IPO/underwriter (IPO yang lebih muda dari horizonnya
   *  belum punya bar sejauh itu). */
  n: number
  win: number | null
  median: number | null
}

export interface UnderwriterRapor {
  nama: string
  /** Jumlah emiten yang dijaminnya, terlepas horizonnya punya angka atau tidak. */
  n: number
  h1d: HorizonAgregat
  h1w: HorizonAgregat
  h1m: HorizonAgregat
  hkini: HorizonAgregat
}

export interface BarisIpo {
  kode: string
  nama: string | null
  tahun: number
  tanggal_listing: string
  harga_ipo: number
  lembar: number | null
  dana: number | null
  underwriters: string[]
  close_1d: number | null
  return_1d: number | null
  close_1w: number | null
  return_1w: number | null
  close_1m: number | null
  return_1m: number | null
  close_kini: number | null
  return_kini: number | null
}

export interface DataIpo {
  diperbarui: string
  tanggal: string | null
  n: number
  dilewati: number
  emiten: BarisIpo[]
  underwriter: UnderwriterRapor[]
}

export async function ambilIpo(pengambil: typeof fetch = fetch): Promise<DataIpo | null> {
  try {
    const r = await pengambil('/data-idx/json/ipo.json')
    if (!r.ok) return null
    return (await r.json()) as DataIpo
  } catch {
    return null
  }
}

let cache: DataIpo | null = null
let cacheSejak = 0
// Sama pola screener.ts (#4 audit 21 Agu) — cache tab lama tak menyeret data
// kemarin lewat pergantian hari bursa.
const UMUR_CACHE_MS = 30 * 60 * 1000

export function useIpo(): DataIpo | null {
  const segar = cache !== null && Date.now() - cacheSejak < UMUR_CACHE_MS
  const [data, setData] = useState<DataIpo | null>(segar ? cache : null)
  useEffect(() => {
    if (cache && Date.now() - cacheSejak < UMUR_CACHE_MS) { setData(cache); return }
    let batal = false
    void ambilIpo().then((d) => {
      if (d) { cache = d; cacheSejak = Date.now() }
      if (!batal) setData(d)
    })
    return () => { batal = true }
  }, [])
  return data
}

function median(arr: number[]): number | null {
  if (arr.length === 0) return null
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

type KunciReturn = 'return_1d' | 'return_1w' | 'return_1m' | 'return_kini'

function horizonDariBaris(baris: BarisIpo[], kunci: KunciReturn): HorizonAgregat {
  const vals = baris.map((b) => b[kunci]).filter((v): v is number => v != null)
  const win = vals.length > 0 ? vals.filter((v) => v > 0).length / vals.length : null
  return { n: vals.length, win, median: median(vals) }
}

export interface AgregatTahun {
  tahun: number
  n: number
  h1d: HorizonAgregat
  h1w: HorizonAgregat
  h1m: HorizonAgregat
  hkini: HorizonAgregat
}

/** Kartu ringkas per tahun — urut tahun MENURUN (terbaru dulu), pola sama
 *  daftar edisi/arsip lain di dasbor. */
export function agregatPerTahun(baris: BarisIpo[]): AgregatTahun[] {
  const byTahun = new Map<number, BarisIpo[]>()
  for (const b of baris) {
    const arr = byTahun.get(b.tahun)
    if (arr) arr.push(b)
    else byTahun.set(b.tahun, [b])
  }
  return [...byTahun.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([tahun, arr]) => ({
      tahun,
      n: arr.length,
      h1d: horizonDariBaris(arr, 'return_1d'),
      h1w: horizonDariBaris(arr, 'return_1w'),
      h1m: horizonDariBaris(arr, 'return_1m'),
      hkini: horizonDariBaris(arr, 'return_kini'),
    }))
}

/** Satu baris "SEMUA TAHUN" — dipakai kartu ringkas paling atas. */
export function agregatKeseluruhan(baris: BarisIpo[]): Omit<AgregatTahun, 'tahun'> {
  return {
    n: baris.length,
    h1d: horizonDariBaris(baris, 'return_1d'),
    h1w: horizonDariBaris(baris, 'return_1w'),
    h1m: horizonDariBaris(baris, 'return_1m'),
    hkini: horizonDariBaris(baris, 'return_kini'),
  }
}

/** Tahun yang benar-benar punya IPO, urut menurun — dipakai opsi filter tabel. */
export function tahunUnik(baris: BarisIpo[]): number[] {
  return [...new Set(baris.map((b) => b.tahun))].sort((a, b) => b - a)
}
