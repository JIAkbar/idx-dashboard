import { useEffect, useState } from 'react'

/**
 * Klasifikasi IDX-IC resmi per emiten — dipanen `scripts/panen_sektor_idx.py`
 * dari `GetCompanyProfiles`.
 *
 * Beda dari ruas `sector` di `fundamental/*.json`, yang berasal dari Yahoo:
 * yang ini klasifikasi resmi bursa, lengkap sampai subindustri, plus dua hal
 * yang tak ada di Yahoo sama sekali — **papan pencatatan** dan tanggal
 * pencatatan.
 */

export interface SektorEmiten {
  nama: string
  sektor: string | null
  subsektor: string | null
  /** Nama RESMI Inggris IDX (lang=en) — yang DITAMPILKAN sejak keputusan
   *  Johan 27 Agu; ruas tanpa _en adalah cadangan Indonesia. */
  sektor_en?: string | null
  subsektor_en?: string | null
  industri_en?: string | null
  subindustri_en?: string | null
  industri: string | null
  subindustri: string | null
  /** Utama · Pengembangan · Akselerasi · Pemantauan Khusus · Ekonomi Baru */
  papan: string | null
  /** Tanggal pencatatan di bursa, ISO `YYYY-MM-DD`. */
  tercatat: string | null
}

export interface DaftarSektor {
  diperbarui: string
  sumber: string
  n: number
  n_bersektor: number
  emiten: Record<string, SektorEmiten>
}

/**
 * Papan yang menandakan RISIKO, bukan sekadar penggolongan.
 *
 * Papan Pemantauan Khusus dipakai bursa untuk emiten yang memenuhi kriteria
 * tertentu (mis. harga di bawah batas, likuiditas rendah, opini disclaimer,
 * dalam PKPU). Terukur 17 Agu 2026: **154 dari 962 emiten** ada di sana —
 * hampir seperenam papan. Angka fundamental apa pun tentang emiten itu harus
 * dibaca dengan penanda ini terlihat lebih dulu, bukan sesudahnya.
 */
export const PAPAN_BERISIKO = new Set(['Pemantauan Khusus'])

/** 11 nama sektor IDX-IC resmi berbahasa Inggris — EJAAN DIKUNCI UJI
 *  (sektorIdx.test.ts): `Properties` JAMAK, `Logistic` TUNGGAL. Salah satu
 *  huruf memutus tiga join sekaligus (kunci RRG, SYM_SEKTOR, pencocokan
 *  `hari.sectors`). Sumber: GetCompanyProfiles lang=en, bijeksi 962×962. */
export const SEKTOR_IDX_EN = [
  'Basic Materials', 'Consumer Cyclicals', 'Consumer Non-Cyclicals',
  'Energy', 'Financials', 'Healthcare', 'Industrials', 'Infrastructures',
  'Properties & Real Estate', 'Technology', 'Transportation & Logistic',
] as const

/** Kode pill/akhiran indeks sektoral IDX resmi per sektor (RRG dkk). */
export const KODE_SEKTOR_EN: Record<string, string> = {
  'Energy': 'ENERGY', 'Basic Materials': 'BASIC', 'Industrials': 'INDUST',
  'Consumer Non-Cyclicals': 'NONCYC', 'Consumer Cyclicals': 'CYCLIC',
  'Healthcare': 'HEALTH', 'Financials': 'FINANCE',
  'Properties & Real Estate': 'PROPERT', 'Infrastructures': 'INFRA',
  'Transportation & Logistic': 'TRANS', 'Technology': 'TECHNO',
}

export function papanBerisiko(papan: string | null | undefined): boolean {
  return !!papan && PAPAN_BERISIKO.has(papan)
}

/** Cache modul — pola sama `useKabar`/`useBulletinList`. Berkasnya ±200 KB dan
 *  tak berubah dalam satu sesi. */
let cache: DaftarSektor | null = null
let cacheSejak = 0
let sedangAmbil: Promise<DaftarSektor> | null = null
// TTL 30 menit (audit kesegaran 27 Agu §2) — pola screener.ts; tanpa ini data halaman membeku sampai muat-ulang penuh.
const UMUR_CACHE_MS = 30 * 60 * 1000

function segar(): boolean {
  return cache !== null && Date.now() - cacheSejak < UMUR_CACHE_MS
}

export function muatSektor(): Promise<DaftarSektor> {
  if (segar()) return Promise.resolve(cache!)
  cache = null
  if (!sedangAmbil) {
    sedangAmbil = fetch('/data-idx/json/emiten_sektor.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: DaftarSektor) => {
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

export function useSektorIdx() {
  const [daftar, setDaftar] = useState<DaftarSektor | null>(segar() ? cache : null)
  useEffect(() => {
    if (segar()) return
    let batal = false
    muatSektor()
      .then((d) => !batal && setDaftar(d))
      .catch(() => {})
    return () => {
      batal = true
    }
  }, [])
  return daftar
}

/** Satu emiten. `null` kalau belum termuat atau kodenya tak dikenal — dua
 *  keadaan yang berbeda, tapi pemanggil UI memperlakukannya sama: tak
 *  menampilkan apa-apa, bukan menampilkan "tidak diketahui". */
export function sektorEmiten(daftar: DaftarSektor | null, kode: string): SektorEmiten | null {
  return daftar?.emiten[kode.toUpperCase()] ?? null
}
