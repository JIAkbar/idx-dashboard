/**
 * Fraksi harga & auto rejection BEI — pedoman untuk SEMUA angka harga yang
 * dihasilkan PAPAN: target, support, resistance, sasaran pemulihan, apa pun.
 *
 * Harga saham di BEI tidak bisa sembarang angka. "Resistance 1.237" itu harga
 * yang tak pernah bisa terjadi — pada rentang Rp 500–2.000 fraksinya Rp 5,
 * jadi yang mungkin cuma 1.235 atau 1.240. Angka yang tak bisa dipesan di
 * bursa membuat seluruh analisisnya terbaca seperti dihitung tanpa melihat
 * pasar.
 *
 * Batasnya EKSKLUSIF di atas: harga tepat 2.000 masih fraksi Rp 5, mulai
 * 2.001 baru Rp 10. Titik batas inilah yang paling sering salah dipakai.
 *
 * Sumber: aturan fraksi harga BEI (lima jenjang) dan ketentuan auto rejection.
 * ARB seragam 15% berlaku sejak 5 Juni 2023 — sebelumnya 7% dan bertingkat.
 * Kalau BEI mengubahnya lagi, HANYA berkas ini yang perlu disunting.
 */

export interface Jenjang {
  /** Batas bawah inklusif. */
  dari: number
  /** Batas atas inklusif; Infinity untuk jenjang teratas. */
  sampai: number
  fraksi: number
}

export const JENJANG: Jenjang[] = [
  { dari: 0, sampai: 200, fraksi: 1 },
  { dari: 200, sampai: 500, fraksi: 2 },
  { dari: 500, sampai: 2000, fraksi: 5 },
  { dari: 2000, sampai: 5000, fraksi: 10 },
  { dari: 5000, sampai: Infinity, fraksi: 25 },
]

/** Fraksi harga yang berlaku pada suatu harga. */
export function fraksi(harga: number): number {
  for (const j of JENJANG) if (harga <= j.sampai) return j.fraksi
  return 25
}

/**
 * Bulatkan ke harga yang benar-benar bisa dipesan di bursa.
 *
 * `arah` menentukan pembulatan saat harga jatuh di antara dua tick:
 * 'atas' untuk target/resistance (jangan menjanjikan harga yang lebih dekat
 * dari yang sebenarnya), 'bawah' untuk support/stop (jangan memasang jaring
 * lebih tinggi dari yang bisa dipesan), 'dekat' untuk sekadar menampilkan.
 */
export function keFraksi(harga: number, arah: 'atas' | 'bawah' | 'dekat' = 'dekat'): number {
  if (!isFinite(harga) || harga <= 0) return 0
  const f = fraksi(harga)
  // Toleransi galat pecahan biner SEBELUM dibulatkan. Tanpa ini, 8.000 dikurangi
  // 55% menghasilkan 3599,9999999999995 di JavaScript, dan pembulatan ke bawah
  // menjatuhkannya satu tick penuh ke 3.590 — bukan 3.600 yang benar. Galatnya
  // sangat kecil, tapi arah pembulatanlah yang membesarkannya jadi kesalahan
  // harga yang terlihat. Terbukti di tab Pemulihan, 15 Agu 2026.
  const bagi = Math.abs(Math.round(harga / f) - harga / f) < 1e-9
    ? Math.round(harga / f)
    : harga / f
  const n = arah === 'atas' ? Math.ceil(bagi) : arah === 'bawah' ? Math.floor(bagi) : Math.round(bagi)
  const hasil = n * f
  // Pembulatan bisa melompati batas jenjang (mis. 1.999 → 2.000 → fraksinya
  // berubah). Sekali koreksi cukup: jenjangnya bersebelahan, tak mungkin
  // melompat dua.
  return fraksi(hasil) === f ? hasil : keFraksi(hasil, arah === 'dekat' ? 'dekat' : arah)
}

/** Batas auto rejection ATAS (persen) menurut rentang harga acuan. */
export function batasAra(hargaAcuan: number): number {
  if (hargaAcuan <= 200) return 35
  if (hargaAcuan <= 5000) return 25
  return 20
}

/** ARB seragam 15% untuk semua rentang, berlaku sejak 5 Juni 2023. */
export const BATAS_ARB = 15

/**
 * Berapa hari ARA berturut-turut minimal untuk naik `persen` dari harga acuan.
 *
 * Dihitung bertingkat, bukan dengan satu batas: begitu harga naik melewati
 * 200 atau 5.000, batas ARA-nya ikut berubah. Memakai satu batas untuk
 * seluruh perjalanan memberi angka yang terlalu optimis.
 */
export function hariAraMinimal(hargaAcuan: number, persenNaik: number): number {
  if (hargaAcuan <= 0 || persenNaik <= 0) return 0
  const sasaran = hargaAcuan * (1 + persenNaik / 100)
  let h = hargaAcuan
  let hari = 0
  // 400 hari bursa ≈ 1,5 tahun — cukup jauh untuk kasus wajar, dan mencegah
  // putaran tak berujung kalau ada masukan aneh.
  while (h < sasaran && hari < 400) {
    h = h * (1 + batasAra(h) / 100)
    hari++
  }
  return hari
}
