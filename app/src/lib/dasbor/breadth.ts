import type { DataHarian } from './dataHarian'

/**
 * Market breadth (advance/decline) — dari `price_movement.stocks`
 * (data-idx/json/ds_*.json), lima keranjang sebaran gerak harga sepasar:
 * [turun banyak, turun, tidak berubah, naik, naik banyak].
 *
 * Urutan itu BUKAN ditebak dari nama field — dicocokkan ke dua hari berlawanan
 * arah (19 Agu 2026 IHSG −0,86% → keranjang turun dominan; 18 Agu +0,75% →
 * keranjang naik dominan), lalu disilangkan ke seluruh 144 hari yang tersedia:
 * 127/143 hari (89%) breadth searah IHSG, korelasi 0,91. Sisa 11% itu BUKAN
 * galat pencocokan — itulah alasan fitur ini ada: IHSG berbobot kapitalisasi
 * bisa naik walau mayoritas saham turun, dan sebaliknya.
 *
 * Fungsi MURNI: tak menyentuh jaringan, gampang diuji dengan fixture
 * (breadth.test.ts).
 */

export interface Breadth {
  naik: number
  turun: number
  tetap: number
  total: number
  /** naik% − turun%, dalam POIN PERSENTASE. Positif = saham naik lebih
   *  banyak dari yang turun (breadth bullish), negatif sebaliknya. */
  selisihPp: number
}

/** null kalau `price_movement.stocks` tidak ada/rusak — pemanggil WAJIB
 *  menampilkan "belum tersedia", bukan 0 (nol berarti bursa tutup total, dan
 *  itu berbohong untuk hari yang datanya cuma belum sampai). */
export function hitungBreadth(hari: DataHarian): Breadth | null {
  const v = hari.price_movement?.stocks
  if (!v || v.length !== 5) return null
  const [turunBanyak, turun, tetap, naik, naikBanyak] = v.map((b) => b.v)
  const totalNaik = naik + naikBanyak
  const totalTurun = turunBanyak + turun
  const total = totalNaik + totalTurun + tetap
  if (total <= 0) return null
  return {
    naik: totalNaik,
    turun: totalTurun,
    tetap,
    total,
    selisihPp: (totalNaik / total - totalTurun / total) * 100,
  }
}

export interface BreadthTitik {
  tanggal: string
  breadth: Breadth | null
}

/**
 * Riwayat breadth berpasangan tanggal↔hari — dipakai untuk grafik rentang.
 * `tanggal` dan `hari` HARUS urutan sama (hasil `useDataRentang(tanggal)`
 * mempertahankan urutan input lewat `Promise.all`). Hari tanpa
 * `price_movement` tetap muncul di larik dengan `breadth: null`, bukan
 * dilompati — pemanggil yang memutuskan cara menggambar celahnya.
 */
export function susunHistoriBreadth(
  tanggal: { date_iso: string }[],
  hari: DataHarian[],
): BreadthTitik[] {
  return tanggal.map((t, i) => ({
    tanggal: t.date_iso,
    breadth: hari[i] ? hitungBreadth(hari[i]) : null,
  }))
}
