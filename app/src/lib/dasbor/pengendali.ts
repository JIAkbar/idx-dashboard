import { useEffect, useState } from 'react'

/**
 * Informasi pemegang saham pengendali dari laporan keuangan resmi bursa (XBRL
 * sheet `1000000`), diperas `scripts/panen_pengendali.py` dari arsip mentah.
 *
 * ## Yang dijawab berkas ini — dan yang TIDAK
 *
 * Ruas resminya berisi **kategori**, bukan nama. Seluruh 47 sheet laporan sudah
 * disapu mencari daftar nama pemegang saham: tidak ada. Jadi halaman boleh
 * menyebut "dikendalikan korporasi nasional", tapi **tidak boleh** menyiratkan
 * ia tahu siapa. Nama pengendali harus dari sumber lain (KSEI, prospektus).
 *
 * Terpanen 20 Agu 2026: 949 emiten, 8 kategori.
 *
 * ## Tanggalnya wajib ikut tampil
 *
 * Kepemilikan berubah. Kategori tanpa tanggal laporan terbaca sebagai posisi
 * hari ini, padahal 18 emiten datanya berasal dari laporan 2019. Karena itu
 * `tanggal` bukan pelengkap opsional — komponen yang menampilkan `jenis` wajib
 * menampilkan tanggalnya juga.
 */

export interface PengendaliEmiten {
  /** Nilai apa adanya dari taksonomi XBRL, mis. `"National Corporation"`. */
  jenis: string
  /** Tanggal akhir periode laporan sumbernya, ISO `YYYY-MM-DD`. */
  tanggal: string | null
  /** Mis. `"Kuartal I / First Quarter"` atau `"Tahunan / Annual"`. */
  periode: string | null
  /** Folder arsip asalnya, mis. `"2026/tw1"` — untuk penelusuran balik. */
  arsip: string
}

export interface DaftarPengendali {
  diperbarui: string
  sumber: string
  catatan: string
  n: number
  emiten: Record<string, PengendaliEmiten>
}

/**
 * Terjemahan kategori XBRL → Bahasa Indonesia. Kunci apa adanya dari taksonomi
 * bursa; kategori yang belum terdaftar di sini ditampilkan apa adanya (bukan
 * dibuang), supaya kategori baru dari bursa tetap terlihat alih-alih hilang
 * diam-diam.
 */
export const LABEL_PENGENDALI: Record<string, string> = {
  'National Corporation': 'Korporasi nasional',
  'Individual WNI': 'Perorangan WNI',
  'Foreign Corporation': 'Korporasi asing',
  'Indonesian Government': 'Pemerintah Indonesia',
  'National and Foreign Corporation': 'Korporasi nasional & asing',
  'No Controlling Shareholder': 'Tanpa pemegang saham pengendali',
  'Individual Foreign, Residential': 'Perorangan asing (berdomisili di Indonesia)',
  'Individual Foreign, Non-Residential': 'Perorangan asing (di luar Indonesia)',
}

export function labelPengendali(jenis: string): string {
  return LABEL_PENGENDALI[jenis] ?? jenis
}

let cache: DaftarPengendali | null = null
let cacheSejak = 0
let sedangAmbil: Promise<DaftarPengendali> | null = null
// TTL 30 menit (audit kesegaran 27 Agu §2) — pola screener.ts; tanpa ini data halaman membeku sampai muat-ulang penuh.
const UMUR_CACHE_MS = 30 * 60 * 1000

function segar(): boolean {
  return cache !== null && Date.now() - cacheSejak < UMUR_CACHE_MS
}

export function muatPengendali(): Promise<DaftarPengendali> {
  if (segar()) return Promise.resolve(cache!)
  cache = null
  if (!sedangAmbil) {
    sedangAmbil = fetch('/data-idx/json/pengendali.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: DaftarPengendali) => {
        cache = d
        cacheSejak = Date.now()
        return d
      })
      .finally(() => {
        sedangAmbil = null
      })
  }
  return sedangAmbil
}

export function usePengendali() {
  const [daftar, setDaftar] = useState<DaftarPengendali | null>(segar() ? cache : null)
  useEffect(() => {
    if (segar()) return
    let batal = false
    muatPengendali()
      .then((d) => !batal && setDaftar(d))
      .catch(() => {})
    return () => {
      batal = true
    }
  }, [])
  return daftar
}

/** `null` = belum termuat ATAU emiten tak ada di berkas — dua-duanya tampil
 *  sebagai "belum tersedia" di layar, tak pernah sebagai 0 atau "tidak ada". */
export function pengendaliEmiten(daftar: DaftarPengendali | null, kode: string): PengendaliEmiten | null {
  return daftar?.emiten[kode.toUpperCase()] ?? null
}
