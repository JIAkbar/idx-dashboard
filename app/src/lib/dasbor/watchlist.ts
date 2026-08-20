import type { BarisOhlc } from './ihsgOhlc'

/**
 * Watchlist dinamis (backlog C8, spek Johan 19 Agu 2026: "watchlist yang
 * dinamis jadi akan update berdasarkan data OHLCV" + "dan harga yang
 * dimiliki"). Bukan daftar kode statis — tiap baris bergerak mengikuti
 * OHLCV harian (`fetchHargaTerakhir`), dan pengguna bisa menyimpan harga
 * miliknya sendiri supaya untung-rugi ikut terhitung.
 *
 * Disimpan di localStorage, BUKAN Supabase — halaman ini harus bisa dipakai
 * tanpa login, dan catatan backlog aslinya memang menyebut localStorage
 * tanpa server. Modul ini satu-satunya tempat yang menyentuh localStorage
 * (muat/tambah/hapus/simpanHargaMilik) — kalau kelak pindah ke Supabase,
 * cukup isi ulang modul ini, komponennya tak perlu tahu bedanya.
 */

const KUNCI = 'papan_watchlist_v1'

/**
 * Satu transaksi beli. Sekarang UI cuma pernah menulis SATU entri per kode
 * (harga milik = rata-rata tunggal, riwayat beli bertahap sengaja belum
 * dikerjakan — lihat CLAUDE.md tugas ini). Bentuknya sudah berupa ARRAY sejak
 * awal supaya nanti (kalau riwayat bertahap ditambah) cukup mendorong entri
 * baru ke sini — tanpa migrasi skema, tanpa mengubah `WatchlistItem`.
 */
export interface EntriBeli {
  harga: number
  tanggal: string
}

export interface WatchlistItem {
  kode: string
  ditambahkan: string
  /** Kosong = belum ada harga milik (baris cuma pemantau harga). */
  beli: EntriBeli[]
}

export interface HargaTerakhir {
  harga: number
  /** null = tak ada hari pembanding (baris pertama di berkas). */
  chgPersen: number | null
  tanggal: string
}

function bacaSemua(): WatchlistItem[] {
  try {
    const raw = localStorage.getItem(KUNCI)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    // localStorage tak tersedia (mode privat/dilarang) atau isinya korup —
    // mulai kosong, jangan lempar galat ke pemanggil.
    return []
  }
}

function simpanSemua(items: WatchlistItem[]): void {
  try {
    localStorage.setItem(KUNCI, JSON.stringify(items))
  } catch {
    /* localStorage tak tersedia — perubahan cuma hidup di state React sesi ini */
  }
}

/** Muat watchlist tersimpan. Dipanggil sekali saat halaman dibuka. */
export function muatWatchlist(): WatchlistItem[] {
  return bacaSemua()
}

/** Tambah satu kode (tak berefek kalau sudah ada). Mengembalikan daftar terbaru. */
export function tambahEmiten(kode: string): WatchlistItem[] {
  const items = bacaSemua()
  const k = kode.trim().toUpperCase()
  if (!k || items.some((i) => i.kode === k)) return items
  const next = [...items, { kode: k, ditambahkan: new Date().toISOString(), beli: [] }]
  simpanSemua(next)
  return next
}

/** Hapus satu kode. Mengembalikan daftar terbaru. */
export function hapusEmiten(kode: string): WatchlistItem[] {
  const next = bacaSemua().filter((i) => i.kode !== kode)
  simpanSemua(next)
  return next
}

/**
 * Simpan/ubah harga milik satu kode. `harga` null (atau ≤0) mengosongkan
 * baris `beli` — baris tetap ada di watchlist sebagai pemantau harga saja.
 */
export function simpanHargaMilik(kode: string, harga: number | null): WatchlistItem[] {
  const items = bacaSemua()
  const next = items.map((i) =>
    i.kode === kode
      ? { ...i, beli: harga != null && harga > 0 ? [{ harga, tanggal: new Date().toISOString() }] : [] }
      : i,
  )
  simpanSemua(next)
  return next
}

/** Rata-rata harga milik dari daftar transaksi. null = belum ada harga milik. */
export function hargaRataRata(beli: EntriBeli[]): number | null {
  if (beli.length === 0) return null
  return beli.reduce((s, b) => s + b.harga, 0) / beli.length
}

/**
 * Untung-rugi terhadap harga milik. `rp` positif = untung. `hargaMilik` wajib
 * > 0 (dijaga pemanggil lewat `hargaRataRata`, yang mengembalikan null kalau
 * kosong) supaya persen tak pernah dibagi nol.
 */
export function untungRugi(hargaMilik: number, hargaTerakhir: number): { rp: number; persen: number } {
  const rp = hargaTerakhir - hargaMilik
  return { rp, persen: hargaMilik > 0 ? (rp / hargaMilik) * 100 : 0 }
}

/**
 * Harga penutupan terakhir + %chg dari DUA baris terakhir `ohlc/<KODE>.json`
 * — pure, diuji tanpa fetch. null kalau berkasnya kosong.
 */
export function ambilHargaTerakhir(baris: BarisOhlc[]): HargaTerakhir | null {
  if (baris.length === 0) return null
  const last = baris[baris.length - 1]
  const prev = baris.length > 1 ? baris[baris.length - 2] : null
  const hargaPrev = prev?.[4]
  return {
    harga: last[4],
    chgPersen: hargaPrev && hargaPrev > 0 ? (last[4] / hargaPrev - 1) * 100 : null,
    tanggal: last[0],
  }
}

/**
 * Cache modul per kode — sama pola `ohlcCache` (TanyaPapan.tsx): satu fetch
 * per kode per sesi, `null` dicache juga (404) supaya tak diulang percuma.
 *
 * Yang di-cache DERETNYA, bukan harga terakhirnya. Kolom EMA/peluang butuh
 * seluruh riwayat, dan harga terakhir bisa diturunkan darinya kapan saja —
 * menyimpan hasil olahan saja akan memaksa unduhan kedua untuk berkas yang
 * persis sama.
 */
const deretCache = new Map<string, BarisOhlc[] | null>()

export function fetchDeret(kode: string): Promise<BarisOhlc[] | null> {
  const cached = deretCache.get(kode)
  if (cached !== undefined) return Promise.resolve(cached)
  return fetch(`/data-idx/json/ohlc/${kode}.json`)
    .then((r) => (r.ok ? (r.json() as Promise<{ d: BarisOhlc[] }>) : Promise.reject(new Error('not found'))))
    .then((j) => {
      const d = j.d ?? []
      deretCache.set(kode, d)
      return d
    })
    .catch(() => {
      deretCache.set(kode, null)
      return null
    })
}

export function fetchHargaTerakhir(kode: string): Promise<HargaTerakhir | null> {
  return fetchDeret(kode).then((d) => (d ? ambilHargaTerakhir(d) : null))
}
