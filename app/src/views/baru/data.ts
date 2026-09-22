import { useEffect, useState } from 'react'
import { urlData } from '../../lib/dasbor/baseData'

/** Muat satu berkas JSON data. `null` = sedang dimuat; `galat` terisi kalau gagal. */
export function useJson<T>(jalur: string | null): { data: T | null; galat: string | null } {
  const [data, setData] = useState<T | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  useEffect(() => {
    if (!jalur) return
    let hidup = true
    setData(null)
    setGalat(null)
    fetch(urlData(jalur))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<T>
      })
      .then((j) => { if (hidup) setData(j) })
      .catch((e: unknown) => { if (hidup) setGalat(e instanceof Error ? e.message : String(e)) })
    return () => { hidup = false }
  }, [jalur])
  return { data, galat }
}

interface IndeksHarian { dates: { stem: string; date_iso: string; date_id: string }[] }

/** Statistik harian resmi terbaru: baca daftar tanggal, lalu berkas hari terakhir. */
export function useDsTerbaru<T>(): { data: T | null; tanggal: string | null; galat: string | null } {
  const idx = useJson<IndeksHarian>('/data-idx/json/index.json')
  const akhir = idx.data?.dates[idx.data.dates.length - 1] ?? null
  const ds = useJson<T>(akhir ? `/data-idx/json/${akhir.stem}.json` : null)
  return { data: ds.data, tanggal: akhir?.date_iso ?? null, galat: idx.galat ?? ds.galat }
}

const ANGKA = new Map<number, Intl.NumberFormat>()
/** Angka gaya Indonesia: titik ribuan, koma desimal. */
export function angka(v: number | null | undefined, desimal = 0): string {
  if (v == null || !Number.isFinite(v)) return '–'
  let f = ANGKA.get(desimal)
  if (!f) {
    f = new Intl.NumberFormat('id-ID', { minimumFractionDigits: desimal, maximumFractionDigits: desimal })
    ANGKA.set(desimal, f)
  }
  return f.format(v)
}

/** Angka bertanda: +1,23 / −1,23 (minus tipografis). */
export function bertanda(v: number | null | undefined, desimal = 2): string {
  if (v == null || !Number.isFinite(v)) return '–'
  const s = angka(Math.abs(v), desimal)
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : s
}

/** Rupiah ringkas dari rupiah penuh: Rp 1,2 T / Rp 345,6 M / Rp 12,3 jt. */
export function rupiah(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '–'
  const tanda = v < 0 ? '−' : ''
  const a = Math.abs(v)
  if (a >= 1e12) return `${tanda}Rp ${angka(a / 1e12, 1)} T`
  if (a >= 1e9) return `${tanda}Rp ${angka(a / 1e9, 1)} M`
  if (a >= 1e6) return `${tanda}Rp ${angka(a / 1e6, 1)} jt`
  return `${tanda}Rp ${angka(a, 0)}`
}

/** "2026-09-22" → "22 Sep 2026". */
export function tanggalPendek(iso: string | null | undefined): string {
  if (!iso) return '–'
  const [y, m, d] = iso.split('-').map(Number)
  const bln = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][m - 1]
  return `${d} ${bln} ${y}`
}

/** Kelas warna arah: naik hijau, turun merah, nol netral. */
export function arah(v: number | null | undefined): 'naik' | 'turun' | 'datar' {
  if (v == null || !Number.isFinite(v) || v === 0) return 'datar'
  return v > 0 ? 'naik' : 'turun'
}
