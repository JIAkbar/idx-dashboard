import type { TanggalIndex } from './dataHarian'

/**
 * Persen IHSG tahun berjalan terhadap hari bursa pertama di `index.json`.
 *
 * Sebelumnya nilai ini dibaca dari ruas `ihsg_ytd` di ds_*.json (index_live.html
 * baris 2725) — ruas yang tidak pernah ada, sehingga `?? 0` membuatnya selalu
 * tampil +0,00%. Mengembalikan null, bukan 0, supaya "tidak diketahui" tidak
 * menyamar jadi "tidak berubah".
 */
export function hitungYtdPct(ihsgSekarang: number, dates: TanggalIndex[]): number | null {
  const awal = dates[0]?.ihsg
  if (!awal) return null
  return (ihsgSekarang / awal - 1) * 100
}
