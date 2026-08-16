import { useEffect, useState } from 'react'

/** Satu baris `daftar_emiten.json`. */
export interface EmitenEntry {
  kode: string
  nama: string
}

/** Satu anggota grup konglomerat — bentuk asli `grup_konglomerat.json`,
 *  disalin dari `GrupKonglomerat.tsx` (jangan menulis ulang tipe yang sama). */
export interface AnggotaGrup {
  kode: string
  lewat: string | null
  pct: number | null
  kelas: string | null
  harga: number | null
  pct1d: number | null
}

export interface GrupEntry {
  kode: string
  anggota: AnggotaGrup[]
}

/** Kamus emiten KECIL — tiga berkas yang aman dimuat sekaligus (puluhan KB
 *  total, bukan ratusan). Dipakai Tanya PAPAN supaya "harga BBCA berapa?"
 *  atau "bank central asia" bisa dijawab TANPA fetch tambahan; berkas
 *  PER-EMITEN (fundamental/ohlc/investor, bisa ratusan KB) sengaja tidak ikut
 *  di sini — itu lewat mekanisme `butuh` dua-langkah di tanyaPapan.ts. */
export interface KamusEmiten {
  /** kode → harga penutupan cadangan bulanan (harga_terakhir.json). */
  harga: Record<string, number>
  /** "2026-08" — bulan acuan `harga`. */
  hargaBulan: string
  emiten: EmitenEntry[]
  /** nama grup → anggotanya (grup_konglomerat.json). */
  grup: Record<string, GrupEntry>
}

/** Cache modul — pola sama `useKabar`/`useBulletinList`: sekali per sesi. */
let cache: KamusEmiten | null = null

export function useKamusEmiten() {
  const [kamus, setKamus] = useState<KamusEmiten | null>(cache)

  useEffect(() => {
    if (cache) return
    let batal = false
    Promise.all([
      fetch('/data-idx/json/harga_terakhir.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
      fetch('/data-idx/json/daftar_emiten.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
      fetch('/data-idx/json/grup_konglomerat.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
    ])
      .then(([h, e, g]: [
        { bulan?: string; harga?: Record<string, number> },
        { emiten?: EmitenEntry[] },
        { grup?: Record<string, GrupEntry> },
      ]) => {
        const k: KamusEmiten = {
          harga: h.harga ?? {},
          hargaBulan: h.bulan ?? '',
          emiten: e.emiten ?? [],
          grup: g.grup ?? {},
        }
        cache = k
        if (!batal) setKamus(k)
      })
      .catch(() => { /* Tanya PAPAN tetap jalan tanpa kamus — cuma pencarian nama & harga cadangan yang hilang. */ })
    return () => { batal = true }
  }, [])

  return kamus
}
