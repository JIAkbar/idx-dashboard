import { useEffect, useState } from 'react'

/** Satu baris arus-pasar/keluaran/index.json (dibuat generate_index.py). */
export interface EdisiBulletin {
  kode: string
  tanggal: string
  tanggal_id: string
  judul: string
  emiten: string[]
  pdf: string
  /** Jumlah emiten saat rilis pertama — ada berarti edisi dirilis ulang
   *  dengan cakupan lebih luas; dashboard tampilkan badge "Update N→M". */
  update_dari?: number
}

/** Cache modul — pindah halaman balik lagi langsung tampil, TAPI tetap
 *  revalidate di latar tiap mount (stale-while-revalidate): edisi bisa
 *  dirilis ulang di tengah sesi dan daftar lama nyangkut kalau di-skip. */
let cache: EdisiBulletin[] | null = null

export function useBulletinList() {
  const [daftar, setDaftar] = useState<EdisiBulletin[] | null>(cache)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let batal = false
    // no-cache = tetap pakai HTTP cache tapi wajib revalidasi (ETag) ke server
    fetch('/arus-pasar/keluaran/index.json', { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ edisi: EdisiBulletin[] }>
      })
      .then((j) => {
        if (batal) return
        cache = j.edisi
        setDaftar(j.edisi)
      })
      .catch((e: unknown) => {
        if (!batal) setError(e instanceof Error ? e.message : 'Gagal memuat daftar edisi')
      })
    return () => {
      batal = true
    }
  }, [])

  return { daftar, error }
}
