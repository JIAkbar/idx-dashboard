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
 * kode]`. Rentang, bukan bendera per baris, karena sumbernya datang dalam
 * blok. Jawabannya tetap per bar dan tetap tepat; yang dihemat ukurannya.
 *
 * **Blok tidak selalu satu potongan tua di depan.** Dugaan itu sempat
 * dipercaya dan salah: terukur 5 Sep 2026, GOLD punya 45 blok berselang-seling
 * di 2016–2017 dan IHSG 26 blok sampai 2017. Kalimat apa pun yang
 * mengasumsikan bentuk "riwayat tua = cadangan, sisanya utama" akan salah
 * untuk keduanya — itu sebabnya `catatanSumber` di bawah tidak pernah
 * mengklaim mana yang mayoritas tanpa menghitungnya.
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

/** Berapa potongan cadangan yang masih layak disebut satu per satu sebelum
 *  kalimatnya berubah jadi ringkasan.
 *
 *  Bukan angka selera: tanpa batas, GOLD merender 22 rentang tanggal dalam
 *  satu paragraf 549 aksara — di ponsel 412px itu delapan baris teks abu-abu
 *  untuk menandai 6% barnya. Yang tayang berhenti jadi keterangan dan mulai
 *  jadi isi berkas. */
const MAKS_POTONGAN = 3

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

/** Potongan cadangan yang benar-benar terlihat, DIPOTONG ke jendela tampilan.
 *
 *  Pemotongan itu bukan kerapian: tanpanya kalimatnya menyebut tanggal di luar
 *  yang sedang dilihat pembaca — mis. "s.d. 2017-07-19" padahal layar berhenti
 *  di 2017-06-22 — dan pembaca tak punya cara tahu itu bukan bagian dari yang
 *  ia lihat. */
export function potonganCadangan(
  rentang: RentangSumber[] | undefined,
  mulai: string,
  akhir: string,
): Array<[string, string]> {
  return (rentang ?? [])
    .filter(([dari, sampai, kode]) => kode === 'yh' && sampai >= mulai && dari <= akhir)
    .map(([dari, sampai]): [string, string] => [
      dari < mulai ? mulai : dari,
      sampai > akhir ? akhir : sampai,
    ])
}

/** Kalimat siap tayang, atau `null` kalau tak perlu disebut.
 *
 * Sengaja diam saat seluruh rentang berasal dari penyedia utama — catatan
 * yang selalu muncul berhenti dibaca, dan yang ingin diketahui pembaca
 * justru pengecualiannya. Diam juga saat berkasnya belum berpenanda:
 * mengarang "sumber tidak diketahui" lebih buruk daripada tidak berkata apa-apa.
 *
 * **Tidak pernah menyebut mana yang mayoritas.** Versi pertama membuka dengan
 * "Sebagian besar harga dari [utama]" begitu dua sumber tersentuh — tanpa
 * pernah menghitung satu bar pun. Terukur pada GOLD, jendela 2017-01-03 s.d.
 * 2017-06-22: **107 dari 114 bar (94%) justru dari cadangan**, jadi kalimatnya
 * membantah daftarnya sendiri di kalimat yang sama. Modul ini tak memegang
 * deret barnya, jadi ia tak bisa menghitung proporsi — maka ia tidak
 * mengklaimnya. Kalimat netral yang benar mengalahkan kalimat tegas yang
 * kadang terbalik.
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

  const potongan = potonganCadangan(rentang, mulai, akhir)
  if (!potongan.length) return null
  const sebut = (p: [string, string]) => (p[0] === p[1] ? p[0] : `${p[0]} s.d. ${p[1]}`)
  const bagian = potongan.length <= MAKS_POTONGAN
    ? potongan.map(sebut).join(', ')
    // Diringkas, bukan dipotong diam-diam: jumlahnya disebut supaya pembaca
    // tahu ada berapa, dan ujung-ujungnya disebut supaya ia tahu di mana.
    : `${potongan.length} potongan antara ${potongan[0][0]} dan ${potongan[potongan.length - 1][1]}`
  return `Sebagian harga pada rentang ini dari ${NAMA_SUMBER.yh} — ${bagian}; selebihnya dari ${NAMA_SUMBER.sb}.`
}
