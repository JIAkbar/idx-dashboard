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
  // w2 lahir di Inventory Neo (#359, disetujui Johan) — dieja di sini sejak
  // migrasi modul rentang bersama, bukan lagi hardcode '2 Pekan' di halaman.
  w2: '2 Pekan',
  b1: '1 Bulan',
  // b2 lahir di Harian Papan (Johan 29 Agu 2026, "berarti ada 2 month dan
  // 3 month yaa") — dieja di sini sejak awal, bukan ditulis di halamannya.
  b2: '2 Bulan',
  b3: '3 Bulan',
  b6: '6 Bulan',
  wtd: 'WTD',
  mtd: 'MTD',
  ytd: 'YTD',
  // Rentang yang mulai di hari berdata pertama tahun berjalan — HITUNGAN yang
  // sama dengan `ytd`, KATA yang sengaja berbeda (keputusan Johan 5 Sep 2026,
  // artifact "Empat Bilah Kendali PAPAN", opsi A).
  //
  // Sebabnya tabrakan nama, bukan selera: Sektor & Indeks dan Top Stocks
  // sama-sama memajang kolom "YTD" berisi angka RESMI bursa, sementara pil di
  // bilah atasnya menghitung sendiri dari harga di tanggal mulai. Dua angka
  // berbeda dengan satu nama di satu layar — dan itu sudah pernah salah
  // dibaca (lihat kasus khusus YTD yang dijatuhkan tinjauan 2 Sep). Kata
  // "YTD" sekarang milik kolom resmi saja.
  sejakJan: 'Sejak 1 Jan',
  y1: '1 Tahun',
  y2: '2 Tahun',
  y3: '3 Tahun',
  y5: '5 Tahun',
  y10: '10 Tahun',
  y20: '20 Tahun',
  semua: 'Semua',
} as const

export type KunciRentang = keyof typeof LABEL_RENTANG

/**
 * Bentuk RINGKAS untuk tempat yang tak muat label penuh — kepala kolom tabel
 * lebar, lencana, chip sempit.
 *
 * Ada karena ketegangan yang nyata: kepala kolom yang baru dirapatkan tak
 * muat "1 Bulan", tapi halaman juga tak boleh mengeja sendiri (aturan proyek:
 * kata rentang waktu cuma dieja di berkas ini). Jadi bentuk pendeknya ikut
 * tinggal di sini — satu tempat, dua bentuk, bukan dua tempat.
 *
 * Hanya kunci yang benar-benar dipakai di ruang sempit yang punya bentuk ini;
 * sisanya memakai LABEL_RENTANG apa adanya.
 *
 * Perhatikan `wtd` dan `mtd` TANPA awalan angka, sama seperti label penuhnya.
 * Awalan itu yang membuat "1MTD" terbaca sebagai "1 bulan ke belakang"
 * padahal artinya "sejak awal bulan berjalan" — kesalahpahaman yang
 * benar-benar terjadi (Johan 29 Agu 2026: "kalau 1mtd itu (1 bulan
 * kebelakang ya)"), dan berujung pada perubahan definisi kolomnya.
 */
export const LABEL_RENTANG_RINGKAS: Partial<Record<KunciRentang, string>> = {
  h1: '1D',
  w1: '1M',
  b1: '1B',
  b2: '2B',
  b3: '3B',
  wtd: 'WTD',
  mtd: 'MTD',
  ytd: 'YTD',
  y1: '1T',
}

export type PresetRentang = 'w1' | 'b1' | 'b3' | 'ytd'

/** Id-nya tetap `ytd` — yang berganti kata layarnya, bukan hitungannya, jadi
 *  tak ada state tersimpan atau tes yang perlu ikut berpindah. */
const KATA_PRESET: Record<PresetRentang, KunciRentang> =
  { w1: 'w1', b1: 'b1', b3: 'b3', ytd: 'sejakJan' }

export const PRESET_RENTANG: { id: PresetRentang; label: string }[] =
  (['w1', 'b1', 'b3', 'ytd'] as const).map((id) => ({ id, label: LABEL_RENTANG[KATA_PRESET[id]] }))


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
