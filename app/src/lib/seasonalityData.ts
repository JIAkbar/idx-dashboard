import type { SeriImbal } from './seasonality'

/** Baris indeks.json — cukup untuk kotak pencarian, tanpa satu pun angka imbal. */
export interface BarisIndeks {
  /** kode */ k: string
  /** nama */ n: string
  /** mulai YYYY-MM */ m: string
  /** akhir YYYY-MM */ a: string
  /** jumlah bulan */ j: number
}

const AKAR = '/data-idx/json/seasonality'

/** Berkas huruf yang sudah diunduh — 24 berkas, tak perlu diambil dua kali. */
const singgahHuruf = new Map<string, Promise<Record<string, SeriImbal>>>()
let singgahIndeks: Promise<BarisIndeks[]> | null = null
let singgahIhsg: Promise<SeriImbal> | null = null

async function ambilJson<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Gagal memuat ${url} (${r.status})`)
  return r.json() as Promise<T>
}

export function muatIndeks(): Promise<BarisIndeks[]> {
  singgahIndeks ??= ambilJson<{ emiten: BarisIndeks[] }>(`${AKAR}/indeks.json`).then((d) => d.emiten)
  return singgahIndeks
}

export function muatIhsg(): Promise<SeriImbal> {
  singgahIhsg ??= ambilJson<{ imbal: SeriImbal }>(`${AKAR}/ihsg_bulanan.json`).then((d) => d.imbal)
  return singgahIhsg
}

/**
 * Seri imbal satu emiten. Yang diunduh berkas HURUF AWALNYA, bukan seluruh
 * data: memilih BBCA menarik imbal_B.json (284 KB terbesar), bukan 3,2 MB.
 * Emiten lain berhuruf sama ikut terbawa dan itu justru menguntungkan —
 * membandingkan BBCA dengan BBRI tak menambah satu pun permintaan.
 */
export async function muatSeri(kode: string): Promise<SeriImbal> {
  const huruf = kode[0].toUpperCase()
  let p = singgahHuruf.get(huruf)
  if (!p) {
    p = ambilJson<Record<string, SeriImbal>>(`${AKAR}/imbal_${huruf}.json`)
    singgahHuruf.set(huruf, p)
  }
  const isi = await p
  return isi[kode] ?? {}
}
