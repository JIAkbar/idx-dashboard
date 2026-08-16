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

export function papanBerisiko(papan: string | null | undefined): boolean {
  return !!papan && PAPAN_BERISIKO.has(papan)
}

/** Cache modul — pola sama `useKabar`/`useBulletinList`. Berkasnya ±200 KB dan
 *  tak berubah dalam satu sesi. */
let cache: DaftarSektor | null = null
let sedangAmbil: Promise<DaftarSektor> | null = null

export function muatSektor(): Promise<DaftarSektor> {
  if (cache) return Promise.resolve(cache)
  if (!sedangAmbil) {
    sedangAmbil = fetch('/data-idx/json/emiten_sektor.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: DaftarSektor) => {
        cache = d
        return d
      })
      .finally(() => {
        sedangAmbil = null
      })
  }
  return sedangAmbil
}

export function useSektorIdx() {
  const [daftar, setDaftar] = useState<DaftarSektor | null>(cache)
  useEffect(() => {
    if (cache) return
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
