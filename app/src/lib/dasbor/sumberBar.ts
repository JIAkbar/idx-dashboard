/**
 * Sumber per bar untuk arsip harga gabungan.
 *
 * Keputusan Johan 5 Sep 2026: *"pakai penanda sumber per bar, riwayat lama
 * jangan dipotong"*.
 *
 * Arsip harga `ohlc/<KODE>.json` adalah GABUNGAN dua penyedia: yang utama
 * menyediakan hari-hari baru dengan ruas lengkap, yang cadangan menyimpan
 * riwayat jauh lebih tua yang tak dimiliki penyedia utama. Sebelum ini
 * berkasnya hanya membawa SATU kalimat sumber untuk seluruh deret, jadi
 * tujuh pembaca — termasuk yang menghitung rekomendasi dan tingkat menang —
 * tak bisa membedakan bar yang berasal dari penyedia utama dari bar cadangan.
 *
 * Sekarang tiap berkas membawa `sumber_bar`: rentang beruntun `[dari, sampai,
 * kode]`. Rentang, bukan bendera per baris, karena sumbernya memang datang
 * dalam blok — riwayat tua seluruhnya cadangan, hari-hari baru seluruhnya
 * utama. Jawabannya tetap per bar dan tetap tepat; yang dihemat ukurannya.
 *
 * Yang WAJIB dilakukan pemakai: kalau rentang yang sedang ditampilkan
 * menyentuh bar cadangan, sebutkan di layar. Angka dari dua penyedia yang
 * berbeda tak selalu identik, dan pembaca berhak tahu bagian mana yang
 * bukan dari sumber utama — itu seluruh alasan penanda ini ada.
 *
 * SAPUAN PEMBACA, 5 Sep 2026 — tujuh pembaca arsip harga, dua dipasangi
 * catatan, lima sengaja tidak. Alasannya satu dan terukur: **bar cadangan
 * termuda bertanggal 2020-05-19**, sedangkan kelima pembaca itu hanya
 * melihat jendela yang mulai jauh sesudahnya, jadi rentang tampilannya tak
 * pernah bisa menyentuh satu pun bar cadangan.
 *
 * | Pembaca | Jendelanya | Dipasangi? |
 * |---|---|---|
 * | Grafik Emiten | seluruh riwayat berkas | ya |
 * | Musiman (harian) | rentang pilihan pembaca | ya |
 * | Watchlist | harga terakhir saja | tidak |
 * | Screener → tingkat menang | hari rekomendasi, 2026-08-24 → | tidak |
 * | Tanya PAPAN | ringkas kinerja 1 tahun | tidak |
 *
 * Kalau salah satu dari lima itu kelak melebarkan jendelanya ke belakang
 * 2020, catatannya WAJIB ikut dipasang — alasan di atas gugur bersama
 * jendelanya, dan tak ada galat yang akan memberitahu.
 */

/** Kode sumber di berkas. Sengaja pendek: ia berulang di ribuan berkas. */
export type KodeSumber = 'sb' | 'yh'

/** `[dari, sampai, kode]` — kedua ujungnya inklusif, tanggal ISO. */
export type RentangSumber = [string, string, KodeSumber]

/** Nama yang boleh dibaca pengguna. Nama penyedia adalah atribusi, bukan
 *  bocoran teknis — yang tak boleh tayang itu nama endpoint dan jalur berkas. */
export const NAMA_SUMBER: Record<KodeSumber, string> = {
  sb: 'Stockbit',
  yh: 'Yahoo Finance',
}

/** Sumber satu tanggal. `null` kalau tanggalnya di luar seluruh rentang —
 *  itu berarti berkasnya belum membawa penanda (arsip lama), bukan berarti
 *  tak bersumber. Pemakai wajib membedakan keduanya. */
export function sumberBar(rentang: RentangSumber[] | undefined, tanggal: string): KodeSumber | null {
  if (!rentang?.length) return null
  // Deret berurut menaik dan tak tumpang tindih (dijamin pembuatnya), jadi
  // pencarian biner cukup — dipanggil per bar di grafik ribuan titik.
  let lo = 0
  let hi = rentang.length - 1
  while (lo <= hi) {
    const tengah = (lo + hi) >> 1
    const [dari, sampai] = rentang[tengah]
    if (tanggal < dari) hi = tengah - 1
    else if (tanggal > sampai) lo = tengah + 1
    else return rentang[tengah][2]
  }
  return null
}

/** Sumber yang tersentuh sebuah rentang tampilan, urut kemunculan.
 *  Dipakai antarmuka untuk memutuskan apakah perlu menyebut sumber campuran. */
export function sumberDalamRentang(
  rentang: RentangSumber[] | undefined,
  mulai: string,
  akhir: string,
): KodeSumber[] {
  if (!rentang?.length) return []
  const ada: KodeSumber[] = []
  for (const [dari, sampai, kode] of rentang) {
    if (sampai < mulai || dari > akhir) continue
    if (!ada.includes(kode)) ada.push(kode)
  }
  return ada
}

/** Kalimat siap tayang, atau `null` kalau tak perlu disebut.
 *
 * Sengaja diam saat seluruh rentang berasal dari penyedia utama — catatan
 * yang selalu muncul berhenti dibaca, dan yang ingin diketahui pembaca
 * justru pengecualiannya. Diam juga saat berkasnya belum berpenanda:
 * mengarang "sumber tidak diketahui" lebih buruk daripada tidak berkata apa-apa.
 */
export function catatanSumber(
  rentang: RentangSumber[] | undefined,
  mulai: string,
  akhir: string,
): string | null {
  const ada = sumberDalamRentang(rentang, mulai, akhir)
  if (ada.length === 0) return null
  if (ada.length === 1 && ada[0] === 'sb') return null
  if (ada.length === 1) return `Harga pada rentang ini dari ${NAMA_SUMBER[ada[0]]}.`
  // Campuran: sebut bagian cadangannya dengan tanggalnya, karena itu yang
  // perlu diperiksa pembaca — bukan sekadar "ada dua sumber".
  const potongan = (rentang ?? [])
    .filter(([dari, sampai, kode]) => kode === 'yh' && sampai >= mulai && dari <= akhir)
    .map(([dari, sampai]) => (dari === sampai ? dari : `${dari} s.d. ${sampai}`))
  return `Sebagian besar harga dari ${NAMA_SUMBER.sb}; bagian ${potongan.join(', ')} dari ${NAMA_SUMBER.yh}.`
}
