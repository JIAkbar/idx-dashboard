import { useEffect, useState } from 'react'

/** Satu baris arus-pasar/keluaran/index.json (dibuat generate_index.py). */
export interface EdisiBulletin {
  kode: string
  tanggal: string
  tanggal_id: string
  judul: string
  emiten: string[]
  pdf: string
}

/** Cache modul — pindah halaman balik lagi tidak fetch ulang, pola sama dataHarian.ts. */
let cache: EdisiBulletin[] | null = null

export function useBulletinList() {
  const [daftar, setDaftar] = useState<EdisiBulletin[] | null>(cache)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cache) return
    let batal = false
    fetch('/arus-pasar/keluaran/index.json')
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
