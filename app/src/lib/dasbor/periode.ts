import type { TanggalIndex } from './dataHarian'

/**
 * Cari tanggal bursa terdekat ≤ (tanggalAktif − hariMundur hari kalender),
 * dari daftar tanggal terurut naik (`index.json`). Dipakai pemilih periode
 * 1 Bulan/3 Bulan di tabel sektor (SektorIndeks.tsx) — mundur lewat kalender
 * lalu ambil hari bursa terakhir yang <= target, karena bursa tidak buka
 * tiap hari kalender ("trading_day − 30" akan salah).
 *
 * null kalau tidak ada tanggal yang cukup lama (mis. tanggal aktif ada di
 * awal riwayat data) — pemanggil wajib menampilkan "—", bukan 0.
 */
export function cariTanggalPembanding(
  tanggal: TanggalIndex[],
  tanggalAktif: string,
  hariMundur: number,
): TanggalIndex | null {
  const target = new Date(tanggalAktif)
  target.setDate(target.getDate() - hariMundur)
  const targetIso = target.toISOString().slice(0, 10)

  let hasil: TanggalIndex | null = null
  for (const t of tanggal) {
    if (t.date_iso <= targetIso) hasil = t
    else break
  }
  return hasil
}

/**
 * Persen perubahan periode: v_sekarang / v_pembanding − 1. null kalau data
 * pembanding tidak ada/nol — pemanggil tampilkan "—", bukan 0 (pola bug
 * berulang di proyek ini, lihat ytd.ts).
 */
export function hitungPeriodePct(sekarang: number, pembanding: number | null | undefined): number | null {
  if (!pembanding) return null
  return (sekarang / pembanding - 1) * 100
}
