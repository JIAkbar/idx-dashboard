/**
 * Radar WDWL — tipe data & muat arsip edisi (data-idx/radar/r_YYMMDD.json).
 * Satu edisi = satu tanggal, tidak pernah digabung. Arsip selalu diurutkan
 * date_iso naik supaya "edisi berikutnya" = indeks + 1 (dasar forward return).
 */
import { useEffect, useState } from 'react'

export interface MacdRadar {
  arah: 'up' | 'down' | null
  n: number | null
  kode: 'X' | 'SW' | null
}

export interface BarisRadar {
  tik: string
  hari_ke: number | null
  zona: 'breakout' | 'rebound' | 'uptrend' | null
  chg: number | null
  pct: number | null
  trx: number | null
  s: number | null
  close: number | null
  r: number | null
  colors: string | null
  bodies: string | null
  osc: string | null
  candle: string | null
  vr: number | null
  macd: MacdRadar | null
}

export interface EdisiRadar {
  date_iso: string
  watch: BarisRadar[]
  penny: BarisRadar[]
  rbu: string[]
  catatan?: string
}

/** Arsip = daftar edisi urut tanggal NAIK. */
export type ArsipRadar = EdisiRadar[]

/** "2026-08-13" → "r_260813" (nama berkas edisi). */
export function namaBerkas(dateIso: string): string {
  const [t, b, d] = dateIso.split('-')
  return `r_${t.slice(2)}${b}${d}`
}

/** ISO → "Kamis, 13 Agu 2026" (judul stepper). */
export function tanggalPanjang(iso: string): string {
  const [t, b, d] = iso.split('-').map(Number)
  if (!t || !b || !d) return iso
  const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date(t, b - 1, d).getDay()]
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][b - 1]
  return `${hari}, ${d} ${bulan} ${t}`
}

let cacheArsip: ArsipRadar | null = null

/** Muat SELURUH arsip sekali (index.json + tiap r_*.json) — berkasnya kecil
 *  dan kalibrasi skor/rollup memang butuh semuanya. Cache modul (pola
 *  useBulletinList/useIhsgMap). */
export function useArsipRadar() {
  const [arsip, setArsip] = useState<ArsipRadar | null>(cacheArsip)
  const [error, setError] = useState('')

  useEffect(() => {
    if (cacheArsip) return
    let batal = false
    fetch('/data-idx/radar/index.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ dates: string[] }>
      })
      .then((idx) =>
        Promise.all(
          [...idx.dates].sort().map((d) =>
            fetch(`/data-idx/radar/${namaBerkas(d)}.json`).then((r) => {
              if (!r.ok) throw new Error(`HTTP ${r.status} (${d})`)
              return r.json() as Promise<EdisiRadar>
            })
          )
        )
      )
      .then((edisi) => {
        if (batal) return
        cacheArsip = edisi
        setArsip(edisi)
      })
      .catch((e: Error) => !batal && setError(e.message))
    return () => {
      batal = true
    }
  }, [])

  return { arsip, error }
}

/** Semua baris satu edisi (watch + penny) dengan nama papannya; IHSG (baris
 *  indeks di papan) dikecualikan dari analisa saham. */
export function semuaBaris(e: EdisiRadar): { papan: 'watch' | 'penny'; row: BarisRadar }[] {
  return [
    ...e.watch.map((row) => ({ papan: 'watch' as const, row })),
    ...e.penny.map((row) => ({ papan: 'penny' as const, row })),
  ].filter(({ row }) => row.tik !== 'IHSG')
}

/** Cari close sebuah ticker pada satu edisi (kedua papan). */
export function closeDi(e: EdisiRadar, tik: string): number | null {
  for (const { row } of semuaBaris(e)) if (row.tik === tik) return row.close
  return null
}
