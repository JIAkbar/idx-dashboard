/**
 * Harga live via proxy server PAPAN (`/api/live-harga`) — token akun kedua
 * Stockbit hidup HANYA di server (keputusan Johan 28 Agu 2026); yang sampai
 * ke peramban cuma angka. Gagal dalam bentuk apa pun (503 rantai mati, 404
 * di dev lokal karena fungsi hanya hidup di Vercel, timeout) = null — pemakai
 * WAJIB jatuh diam-diam ke arsip EOD, bukan menampilkan error.
 */
import { useEffect, useState } from 'react'

export interface HargaLive {
  kode: string
  tanggal: string | null
  close: number
  prev: number | null
  pct: number | null
}

export async function ambilHargaLive(kode: string): Promise<HargaLive | null> {
  const kendali = new AbortController()
  const batas = setTimeout(() => kendali.abort(), 2500)
  try {
    const r = await fetch(`/api/live-harga?kode=${encodeURIComponent(kode)}`, { signal: kendali.signal })
    if (!r.ok) return null
    const d = (await r.json()) as HargaLive
    return Number.isFinite(d?.close) ? d : null
  } catch {
    return null
  } finally {
    clearTimeout(batas)
  }
}

/** Segar tiap `jedaDetik` selama halaman terlihat; null selama belum/gagal. */
export function useHargaLive(kode: string | null, jedaDetik = 45): HargaLive | null {
  const [harga, setHarga] = useState<HargaLive | null>(null)
  useEffect(() => {
    if (!kode) { setHarga(null); return }
    let batal = false
    let timer: ReturnType<typeof setInterval> | null = null
    const tarik = () => {
      if (document.visibilityState === 'hidden') return
      void ambilHargaLive(kode).then((d) => { if (!batal) setHarga(d) })
    }
    setHarga(null)
    tarik()
    timer = setInterval(tarik, jedaDetik * 1000)
    return () => { batal = true; if (timer) clearInterval(timer) }
  }, [kode, jedaDetik])
  return harga
}
