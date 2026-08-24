import type { OhlcvKaya } from './ohlcvKaya'

/**
 * Net rupiah aliran asing per emiten — SEBENARNYA, bukan taksiran lembar×harga
 * (taksiran lama `taksiranNetAsing` di flowNego.ts terukur miring +33%
 * kumulatif, dibuang). Sumber tunggal rupiah: gudang harga kaya yang sudah
 * dibaca `ohlcvKaya.ts` (dipakai bareng Grafik Emiten) — beli/jual asing di
 * situ SUDAH dalam rupiah, jadi net-nya cuma pengurangan, bukan hitungan baru.
 *
 * Cakupan rupiah jauh lebih panjang dari cakupan lembar resmi bursa (yang
 * mulai 2020) — bisa mundur ke ±2004. Bagian sebelum cakupan bursa TIDAK
 * punya pembanding sumber kedua, jadi ditandai `jahitan` supaya pembaca tahu
 * bagian mana yang baru satu sumber.
 */

export interface NetRupiahPeriode {
  beli: number
  jual: number
  net: number
  /** Bisa < jendela diminta kalau riwayat rupiah memang lebih pendek/berlubang. */
  hariTersedia: number
}

/** Net rupiah `hari` hari TERSEDIA terakhir s.d. `akhir` (inklusif). `null`
 * kalau tak satu pun hari di jendela itu punya data rupiah. */
export function netRupiahPeriode(stockbit: OhlcvKaya, akhir: string, hari: number): NetRupiahPeriode | null {
  const tanggals = Array.from(stockbit.byDate.keys())
    .filter((t) => t <= akhir)
    .sort()
  const slice = tanggals.slice(-hari)
  if (slice.length === 0) return null
  let beli = 0
  let jual = 0
  for (const t of slice) {
    const b = stockbit.byDate.get(t)!
    beli += b.foreignBeli
    jual += b.foreignJual
  }
  return { beli, jual, net: beli - jual, hariTersedia: slice.length }
}

export interface TitikRupiah {
  tanggal: string
  kumulatif: number
  /** true = sebelum cakupan bursa (`bursaMulai`) — cuma dari satu sumber,
   * belum ada pembanding resmi bursa untuk hari ini. */
  jahitan: boolean
}

/** Net rupiah kumulatif (running sum, mulai 0) dalam rentang [mulai, akhir].
 * `bursaMulai` = tanggal awal cakupan bursa resmi emiten ini (`AsingData.mulai`,
 * null kalau bursa tak punya data emiten ini sama sekali) — dipakai semata
 * untuk menandai `jahitan`, bukan untuk memfilter titik. */
export function kumulatifRupiah(
  stockbit: OhlcvKaya,
  bursaMulai: string | null,
  mulai: string,
  akhir: string,
): TitikRupiah[] {
  const tanggals = Array.from(stockbit.byDate.keys())
    .filter((t) => t >= mulai && t <= akhir)
    .sort()
  let running = 0
  return tanggals.map((t) => {
    const b = stockbit.byDate.get(t)!
    running += b.foreignBeli - b.foreignJual
    return { tanggal: t, kumulatif: running, jahitan: bursaMulai == null || t < bursaMulai }
  })
}
