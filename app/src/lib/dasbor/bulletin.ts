import { useEffect, useState } from 'react'
import { pesanGalat } from '../pesanGalat'

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
  /** Sidecar analitik per emiten (build.py → generate_index.py) — bahan
   *  tabel detail Probabilitas di baris edisi. Edisi lama tidak punya. */
  analisa?: AnalisaEmiten[]
}

export type TipeEdisi = 'Harian' | 'Mingguan' | 'Bulanan' | 'Bedah'

/**
 * Tipe edisi dari kodenya (#92) — pola generator arus-pasar: `AP-<ddmmyy>`
 * harian (build.py), `AP-W<ddmmyy>` mingguan (build_weekly.py), `AP-M<mmyy>`
 * bulanan (build_monthly.py), `BA-<...>`/`DD-<...>` terbitan satu-emiten
 * (dulu "Bedah Arus Saham", diganti nama "Deep Dive" 21 Agu 2026 — ambigu
 * dengan halaman web Bedah Emiten; `BA-` = edisi lama, `DD-` = edisi baru,
 * dua-duanya masuk tipe internal `'Bedah'`, lihat LABEL_TIPE_EDISI di bawah
 * untuk teks yang ditampilkan); edisi uji berprefiks `UJI-`.
 *
 * Tinggal di lib, bukan di salah satu halaman: halaman Bulletin publik dan
 * Rak Terbitan admin sama-sama menyaring dengan aturan ini, dan aturan yang
 * disalin akan menyimpang begitu ada jenis edisi baru.
 */
export function tipeEdisi(kode: string): TipeEdisi {
  const k = kode.replace(/^UJI-/, '')
  if (k.startsWith('AP-W')) return 'Mingguan'
  if (k.startsWith('AP-M')) return 'Bulanan'
  if (k.startsWith('BA-') || k.startsWith('DD-')) return 'Bedah'
  return 'Harian'
}

/** Label tampil per tipe — nilai `TipeEdisi` sendiri TETAP `'Bedah'` (kunci
 *  internal dipakai jadi kelas CSS `.t-bedah` di lantai.css dan sebagai
 *  state saringan); cuma teks yang dibaca pengguna yang berganti "Deep
 *  Dive" (21 Agu 2026, permintaan Johan — "Bedah" ambigu dgn halaman web
 *  Bedah Emiten). Dieja satu tempat, pola sama dengan LABEL_RENTANG. */
export const LABEL_TIPE_EDISI: Record<TipeEdisi, string> = {
  Harian: 'Harian',
  Mingguan: 'Mingguan',
  Bulanan: 'Bulanan',
  Bedah: 'Deep Dive',
}

/** Satu baris analitik emiten dari keluaran/<kode>.analisa.json. */
export interface AnalisaEmiten {
  ticker: string
  label: string
  arah: string
  close: number
  pct: number
  skor: number
  risiko: string
  /** P(close naik dalam 5 hari) 0..1 — null kalau riwayat belum cukup. */
  p5: number | null
  /** P(sempat ≥ +3% dalam 5 hari) 0..1. */
  p3: number | null
  n: number | null
  /** Berapa dari `total_fitur` fitur setup yang cocok (fallback pencocokan
   *  longgar bila sampel penuh terlalu sedikit). */
  cocok: number | null
  vv_z: number | null
  vv_sinyal: boolean
  /** v2 (B39) — opsional: edisi lama (build.py sebelum 21 Agu 2026) tidak
   *  menulis kunci ini. P(capai R1/R2) & P(sentuh S1) dalam 5 hari, angka
   *  dasar pool, dan total fitur setup (13 di v2, dulu 4). */
  pR1?: number | null
  pR2?: number | null
  pS1?: number | null
  base5?: number | null
  total_fitur?: number | null
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
        if (!batal) setError(pesanGalat(e, 'Gagal memuat daftar edisi'))
      })
    return () => {
      batal = true
    }
  }, [])

  return { daftar, error }
}
