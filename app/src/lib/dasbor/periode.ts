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

/**
 * Kosakata waktu tunggal (#170, prinsip 4 `docs/spek-kendali.md`).
 *
 * Audit `docs/audit-kendali.md` §3.2 menemukan tiga cara menulis hal yang
 * sama — "1 Tahun" di Broker Summary, "1T" di Indeks Dunia, "1 thn" di
 * Seasonality — dan Seasonality memakai "20 thn" sementara Indeks Dunia
 * memakai "10T" untuk maksud yang sama persis.
 *
 * Yang dipilih: kata penuh, mengikuti `PRESET_RENTANG` di bawah — satu-satunya
 * penulisan yang memang sudah dipakai bersama tiga halaman (Kalender Bursa,
 * Top Stocks, Sektor), jadi menyeragamkan ke sana mengubah paling sedikit
 * layar. Singkatan "1T"/"1 thn" dibuang: hemat beberapa piksel, tapi "T" bisa
 * terbaca sebagai triliun di halaman yang di sebelahnya memang menampilkan
 * nilai transaksi dalam triliun.
 *
 * Daftar ini BUKAN daftar pilihan satu halaman — tiap halaman mengambil
 * bagian yang berlaku untuknya. Yang tak berlaku dihilangkan, bukan ditulis
 * dengan gaya lain (prinsip 4).
 */
export const LABEL_RENTANG = {
  // hariIni: preset SATU hari bursa terakhir yang berdata (bukan "1 Hari"
  // duration — h1 di bawah punya makna beda, dipakai pemilih 1D/5D ala RTI).
  hariIni: 'Hari Ini',
  // Dua kunci tingkat HARI, ditambah B36 (panel Aliran Investor meniru
  // pemilih 1D/5D panel RTI). Dieja di sini, bukan di halamannya — itu
  // seluruh alasan tabel ini ada.
  h1: '1 Hari',
  h5: '5 Hari',
  w1: '1 Minggu',
  b1: '1 Bulan',
  b3: '3 Bulan',
  b6: '6 Bulan',
  mtd: 'MTD',
  ytd: 'YTD',
  y1: '1 Tahun',
  y2: '2 Tahun',
  y3: '3 Tahun',
  y5: '5 Tahun',
  y10: '10 Tahun',
  y20: '20 Tahun',
  semua: 'Semua',
} as const

export type KunciRentang = keyof typeof LABEL_RENTANG

export type PresetRentang = 'w1' | 'b1' | 'b3' | 'ytd'

export const PRESET_RENTANG: { id: PresetRentang; label: string }[] =
  (['w1', 'b1', 'b3', 'ytd'] as const).map((id) => ({ id, label: LABEL_RENTANG[id] }))


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
