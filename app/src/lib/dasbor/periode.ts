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

/** Rentang tanggal terpilih mode Rentang (#75) — kedua ujung selalu hari berdata. */
export interface RentangTanggal {
  mulai: string
  akhir: string
}

export type PresetRentang = 'w1' | 'b1' | 'b3' | 'ytd'

export const PRESET_RENTANG: { id: PresetRentang; label: string }[] = [
  { id: 'w1', label: '1 Minggu' },
  { id: 'b1', label: '1 Bulan' },
  { id: 'b3', label: '3 Bulan' },
  { id: 'ytd', label: 'YTD' },
]

const HARI_PRESET: Record<Exclude<PresetRentang, 'ytd'>, number> = { w1: 7, b1: 30, b3: 91 }

/**
 * Rentang preset mundur dari `akhir` (tanggal aktif), snap ke hari berdata:
 * w1/b1/b3 pakai cariTanggalPembanding (hari bursa terakhir ≤ target); kalau
 * riwayat lebih pendek dari preset, mulai jatuh ke tanggal berdata pertama.
 * ytd = tanggal berdata pertama di tahun yang sama dengan `akhir`. null kalau
 * rentang tidak valid (mulai ≥ akhir — riwayat cuma satu hari).
 */
export function rentangPreset(
  tanggal: TanggalIndex[],
  akhir: string,
  preset: PresetRentang,
): RentangTanggal | null {
  let mulai: string | undefined
  if (preset === 'ytd') {
    mulai = tanggal.find((t) => t.date_iso >= `${akhir.slice(0, 4)}-01-01`)?.date_iso
  } else {
    mulai = cariTanggalPembanding(tanggal, akhir, HARI_PRESET[preset])?.date_iso
      ?? tanggal[0]?.date_iso
  }
  if (!mulai || mulai >= akhir) return null
  return { mulai, akhir }
}
