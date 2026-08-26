import { useEffect, useState } from 'react'

/**
 * Kandidat Deep Dive (`data-idx/json/kandidat_deepdive.json`, dari
 * `scripts/riset/kandidat_deepdive.py`) — emiten yang jejak penyerapannya
 * terbaca dari harga & volume sendiri, dipakai Screener untuk MEMINTA
 * setoran Broker Summary dari kontributor, bukan untuk menilai kelayakan.
 *
 * PENTING: ini PENYARING, bukan peringkat. Uji luar sampel menaruh BUMI &
 * DSSA (dua Deep Dive yang terbukti) di paruh BAWAH daftar hari itu — jangan
 * pernah menulis "kandidat terbaik" atau apa pun yang terbaca sebagai
 * rekomendasi beli.
 */

export interface SinyalKandidat {
  nama: string
  bukti: string
}

export interface KandidatEmiten {
  kode: string
  skor: number
  sinyal: SinyalKandidat[]
  harga: number
  likuiditas: number
  ret10: number
  rvol_med: number
  efisiensi: number
  net_asing_20h: number
  tanggal: string
}

export interface DataKandidatDeepDive {
  diperbarui: string
  tanggal: string
  ambang: { skor_min: number; likuiditas_min: number; jendela: number }
  catatan: string
  n: number
  emiten: KandidatEmiten[]
}

export async function ambilKandidat(pengambil: typeof fetch = fetch): Promise<DataKandidatDeepDive | null> {
  try {
    const r = await pengambil('/data-idx/json/kandidat_deepdive.json')
    if (!r.ok) return null
    return (await r.json()) as DataKandidatDeepDive
  } catch {
    return null
  }
}

let cache: DataKandidatDeepDive | null = null
let cacheSejak = 0
// TTL 30 menit (audit kesegaran 27 Agu §2) — pola screener.ts; tanpa ini data halaman membeku sampai muat-ulang penuh.
const UMUR_CACHE_MS = 30 * 60 * 1000

export function useKandidatDeepDive(): DataKandidatDeepDive | null {
  const segar = cache !== null && Date.now() - cacheSejak < UMUR_CACHE_MS
  const [data, setData] = useState<DataKandidatDeepDive | null>(segar ? cache : null)
  useEffect(() => {
    if (cache && Date.now() - cacheSejak < UMUR_CACHE_MS) { setData(cache); return }
    let batal = false
    void ambilKandidat().then((d) => {
      if (d) { cache = d; cacheSejak = Date.now() }
      if (!batal) setData(d)
    })
    return () => { batal = true }
  }, [])
  return data
}

/** Lookup cepat kode → entri, untuk kolom tabel. Data kosong/rusak → peta
 *  kosong, tak pernah lempar galat (dipakai langsung di render). */
export function petaKandidat(data: DataKandidatDeepDive | null): Map<string, KandidatEmiten> {
  const m = new Map<string, KandidatEmiten>()
  if (!data?.emiten) return m
  for (const e of data.emiten) { if (e?.kode) m.set(e.kode, e) }
  return m
}
