import { useEffect, useState } from 'react'
import type { LabelSkor } from './skorTeknikal'

/**
 * Screener (`/screener`, backlog B31) — tabel penyaring SELURUH emiten dalam
 * satu baris per emiten, dibaca dari berkas turunan `data-idx/json/screener.json`
 * (`scripts/riset/screener.py` — angkanya SUDAH dihitung di sisi Python, di sini
 * cuma saring/urut/format tampilan, pola sama dengan kartuRingkas.ts).
 */

export interface BarisScreener {
  kode: string
  nama: string
  sektor: string
  harga: number | null
  tdm_persen: number | null
  volume: number | null
  rvol10: number | null
  nilai: number | null
  sss_d: LabelSkor | null
  sss_w: LabelSkor | null
  sss_m: LabelSkor | null
  free_float: number | null
  ma20_arah: 'naik' | 'datar' | 'turun' | null
  close_gap: number | null
  chg_1d: number | null
  chg_wtd: number | null
  chg_mtd: number | null
  posisi_ema5: 'atas' | 'bawah' | null
  posisi_ma10: 'atas' | 'bawah' | null
  posisi_ma20: 'atas' | 'bawah' | null
  net_asing_lembar: number | null
}

export interface DataScreener {
  diperbarui: string
  tanggal: string
  n: number
  emiten: BarisScreener[]
}

/** Lima label tetap SSS Score, dalam urutan kuat→lemah→kuat — dipakai sebagai
 *  daftar chip saringan (bukan diturunkan dari data, supaya urutannya stabil
 *  walau satu label kebetulan nol baris hari itu). */
export const LABEL_SSS: LabelSkor[] = ['Strong Buy', 'Buy', 'Neutral', 'Sell', 'Strong Sell']

/** Sektor yang benar-benar muncul di data, urut abjad id-ID — bukan daftar
 *  tetap: sektor "-" (belum terklasifikasi IDX-IC) hanya jadi chip kalau
 *  memang ada barisnya. */
export function sektorUnik(baris: BarisScreener[]): string[] {
  return [...new Set(baris.map((b) => b.sektor))].sort((a, b) => a.localeCompare(b, 'id'))
}

/**
 * Hasil setelah chip SSS + chip sektor + kata cari diterapkan. Dua kelompok
 * chip itu OR di dalam kelompoknya sendiri (pilih Buy DAN Strong Buy berarti
 * "salah satu dari keduanya"), AND lintas kelompok — pola faceted filter
 * biasa, beda dari `kartuRingkas.saring()` yang AND semua chip karena di
 * sana tiap chip itu syarat independen, bukan pilihan label yang saling
 * eksklusif per baris.
 */
export function saring(
  baris: BarisScreener[], sssAktif: string[], sektorAktif: string[], cari: string,
): BarisScreener[] {
  const q = cari.trim().toUpperCase()
  return baris.filter((b) => {
    if (q && !b.kode.includes(q) && !b.nama.toUpperCase().includes(q)) return false
    if (sssAktif.length > 0 && (b.sss_d == null || !sssAktif.includes(b.sss_d))) return false
    if (sektorAktif.length > 0 && !sektorAktif.includes(b.sektor)) return false
    return true
  })
}

/** Warna teks label SSS/arah — teks berwarna, BUKAN lencana berlatar (962
 *  baris × 3 kolom SSS berlatar penuh terbaca seperti papan peringatan).
 *  `kuat` menandai Strong Buy/Strong Sell supaya kelas pemanggil bisa
 *  menebalkannya (<b> vs <span>) tanpa menambah kelas warna baru. */
export function kelasSss(label: LabelSkor | null): { warna: 'up' | 'dn' | ''; kuat: boolean } {
  switch (label) {
    case 'Strong Buy': return { warna: 'up', kuat: true }
    case 'Buy': return { warna: 'up', kuat: false }
    case 'Sell': return { warna: 'dn', kuat: false }
    case 'Strong Sell': return { warna: 'dn', kuat: true }
    default: return { warna: '', kuat: false } // Neutral atau null
  }
}

/** Warna arah MA20 (naik/datar/turun). */
export function kelasArah(v: 'naik' | 'datar' | 'turun' | null): 'up' | 'dn' | '' {
  return v === 'naik' ? 'up' : v === 'turun' ? 'dn' : ''
}

/** Warna posisi harga terhadap EMA/MA (atas/bawah) — pola sama `kelasArah`,
 *  ruas beda karena nilainya "atas"/"bawah", bukan "naik"/"turun". */
export function kelasPosisi(v: 'atas' | 'bawah' | null): 'up' | 'dn' | '' {
  return v === 'atas' ? 'up' : v === 'bawah' ? 'dn' : ''
}

/** Desimal tetap, `—` untuk null — BUKAN `fN()` (format.ts), yang mengubah
 *  null jadi 0 dan 0 di sini berarti "nol persen", klaim berbeda dari "tak
 *  diketahui". */
export function fDec(v: number | null, d = 2): string {
  return v == null ? '—' : v.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
}

/** Ringkas jt/M dengan tanda +/− — sama pola `ringkasLembar` di Watchlist.tsx,
 *  disalin bukan diimpor karena di sana ia fungsi privat berkas itu. Dipakai
 *  untuk Net Asing (lembar, bisa negatif); Volume & Nilai pakai `fRingkas`
 *  (stockDetailFormat.ts) yang sudah dipakai KartuAnalisa, tak perlu tanda
 *  karena keduanya tak pernah negatif. */
export function ringkasLembarBertanda(n: number | null): string {
  if (n == null) return '—'
  const tanda = n > 0 ? '+' : n < 0 ? '−' : ''
  const a = Math.abs(n)
  if (a >= 1e9) return `${tanda}${(a / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`
  if (a >= 1e6) return `${tanda}${(a / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
  if (a >= 1e3) return `${tanda}${(a / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`
  return `${tanda}${a.toLocaleString('id-ID')}`
}

export async function ambilScreener(pengambil: typeof fetch = fetch): Promise<DataScreener | null> {
  try {
    const r = await pengambil('/data-idx/json/screener.json')
    if (!r.ok) return null
    return (await r.json()) as DataScreener
  } catch {
    return null
  }
}

let cache: DataScreener | null = null

export function useScreener(): DataScreener | null {
  const [data, setData] = useState<DataScreener | null>(cache)
  useEffect(() => {
    if (cache) return
    let batal = false
    void ambilScreener().then((d) => {
      if (d) cache = d
      if (!batal) setData(d)
    })
    return () => { batal = true }
  }, [])
  return data
}
