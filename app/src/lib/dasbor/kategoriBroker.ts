import { useEffect, useState } from 'react'

/**
 * Kategori PERILAKU broker — `scripts/bangun_kategori_broker.py`, dihitung
 * dari data 120 hari bursa terakhir (porsi nilai pasar, directionality
 * |net|/gross, konsistensi arah). BUKAN daftar tetap.
 *
 * Sumbu ini BEDA dari `kelompokBroker.ts` (identitas/warna, kurasi tangan) —
 * keputusan Johan 27 Agu 2026 (AskUserQuestion): dua sumbu berbeda, jangan
 * digabung. Satu broker bisa BUMN secara identitas tapi 'ritel' secara
 * perilaku (share besar, directionality rendah) — itu bukan bug.
 */

export type KategoriBroker = 'whale' | 'smart' | 'smart_ritel' | 'ritel'
export type GayaBroker = 'akumulasi' | 'distribusi' | 'flip_beli' | 'flip_jual' | 'scalper' | 'campuran'

export interface BrokerPerilaku {
  kategori: KategoriBroker
  gaya: GayaBroker
  share: number
  directionality: number
  konsistensi: number
  net_nilai: number
  gross_nilai: number
  z_vol_terakhir: number
}

export interface KalibrasiKategoriSatu {
  n: number
  rentang_share: [number, number]
  median_directionality: number
}

export interface KalibrasiKategoriBroker {
  q3_share: number
  median_directionality: number
  median_konsistensi: number
  per_kategori: Record<KategoriBroker, KalibrasiKategoriSatu>
  per_gaya: Record<GayaBroker, number>
}

export interface DaftarKategoriBroker {
  dibangun: string
  jendela: { mulai: string; akhir: string; n_hari: number }
  kalibrasi: KalibrasiKategoriBroker
  broker: Record<string, BrokerPerilaku>
}

/**
 * PENAMAAN DIREVISI 27 Agu 2026 atas keberatan pengawas (dikirim atas
 * perintah Johan). Versi pertama memakai "Smart Money"/"Smart Ritel" —
 * tiga cacat yang membatalkannya: (1) ambang median menurut konstruksi
 * meloloskan ~50% populasi, jadi 67/90 broker berlabel "Smart" — kategori
 * yang tak menyaring; (2) directionality 0,032 berarti beli 51,6%/jual
 * 48,4% sudah "tegas" — klaim "pintar" tak didukung; (3) "Smart Money" itu
 * klaim prediktif yang seharusnya dikunci BadgeRapor. Uji korelasi yang
 * diminta pengawas: Spearman share vs directionality = −0,21 (lemah, arah
 * sesuai dugaan "broker tipis lebih gampang searah" tapi bukan bukti keras).
 * Nama sekarang MENYEBUT APA YANG DIUKUR — dua sumbu porsi × arah; kunci
 * internal (whale/smart/…) sengaja TIDAK diubah supaya data & kode stabil.
 */
export const LABEL_KATEGORI: Record<KategoriBroker, string> = {
  whale: 'Porsi Besar · Arah Tegas',
  ritel: 'Porsi Besar · Arah Lemah',
  smart: 'Porsi Kecil · Arah Tegas',
  smart_ritel: 'Porsi Kecil · Arah Lemah',
}

/** Tooltip/keterangan wajib tampil di dekat label (aturan kejujuran). */
export const KETERANGAN_KATEGORI =
  'Kurasi PAPAN dari perilaku terukur 120 hari bursa (porsi nilai pasar × keteguhan arah net) — bukan penggolongan resmi bursa, bukan klaim kepintaran.'

export const LABEL_GAYA: Record<GayaBroker, string> = {
  akumulasi: 'Akumulasi',
  distribusi: 'Distribusi',
  flip_beli: 'Balik Beli',
  flip_jual: 'Balik Jual',
  scalper: 'Scalper',
  campuran: 'Campuran',
}

// Cache modul + TTL — pola sama `muatSektor` (sektorIdx.ts).
let cache: DaftarKategoriBroker | null = null
let cacheSejak = 0
let sedangAmbil: Promise<DaftarKategoriBroker> | null = null
const UMUR_CACHE_MS = 30 * 60 * 1000

function segar(): boolean {
  return cache !== null && Date.now() - cacheSejak < UMUR_CACHE_MS
}

export function muatKategoriBroker(): Promise<DaftarKategoriBroker> {
  if (segar()) return Promise.resolve(cache!)
  cache = null
  if (!sedangAmbil) {
    sedangAmbil = fetch('/data-idx/json/kategori_broker.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: DaftarKategoriBroker) => {
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

export function useKategoriBroker() {
  const [daftar, setDaftar] = useState<DaftarKategoriBroker | null>(segar() ? cache : null)
  useEffect(() => {
    if (segar()) return
    let batal = false
    muatKategoriBroker()
      .then((d) => !batal && setDaftar(d))
      .catch(() => {})
    return () => {
      batal = true
    }
  }, [])
  return daftar
}

/** Perilaku satu broker; `null` kalau belum termuat atau kodenya tak aktif
 *  di jendela (lihat `BrokerPerilaku` — broker tanpa transaksi nyata di 120
 *  hari terakhir tak masuk keluaran, bukan galat). */
export function perilakuBroker(daftar: DaftarKategoriBroker | null, kode: string): BrokerPerilaku | null {
  return daftar?.broker[kode.toUpperCase()] ?? null
}
