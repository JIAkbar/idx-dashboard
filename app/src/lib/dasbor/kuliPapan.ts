/**
 * Kuli Papan — dua kalkulator, rumusnya saja (tanpa React).
 *
 * Dipisah dari komponen supaya bisa diuji terhadap angka yang sudah
 * beredar di luar produk: contoh DEWA di `data ide/Kuli Papan.pdf` harus
 * menghasilkan 41 papan · 133.024,37 lot · 7 / 3,5 · 26,35 poin ·
 * Rp 570,86 / 588,37. Rumusnya DISALIN dari prototipe
 * `data ide/dev-kuli-neo-papan.template.html`, bukan diturunkan ulang —
 * asalnya komunitas (adimollogy & buruhIHSG), jadi mengubah rumus berarti
 * menjawab pertanyaan yang berbeda dari yang penggunanya kenal.
 */

/** Antrean penutupan level terbaik — bukan total orderbook. */
export interface AntreanPenutupan {
  bid: number
  bidLot: number
  offer: number
  offerLot: number
  close: number
  prev: number
}

export interface MasukanTarget {
  buyAvg: number
  buyLot: number
  bid: number
  offer: number
  totalBidLot: number
  totalOfferLot: number
  tick: number
  /** Baseline dalam persen; rumus aslinya 5. */
  baselinePersen: number
}

export interface HasilTarget {
  papan: number
  rataPerPapan: number
  dorongHigh: number
  dorongLow: number
  baselinePoin: number
  targetLow: number
  targetHigh: number
}

/**
 * Target Realistis (adimollogy & buruhIHSG).
 *
 * `null` kalau masukan wajibnya belum lengkap — halaman menampilkan keadaan
 * kosong alih-alih angka yang lahir dari pembagian nol.
 */
export function hitungTarget(m: MasukanTarget): HasilTarget | null {
  const { buyAvg, buyLot, bid, offer, totalBidLot, totalOfferLot, tick } = m
  if (!buyAvg || !bid || !offer || !tick) return null

  const papan = Math.round((offer - bid) / tick) + 1
  const rataPerPapan = papan ? (totalBidLot + totalOfferLot) / papan : 0
  // Pembagi nol nyata terjadi: emiten tanpa antrean pada level terbaik.
  const dorongHigh = rataPerPapan ? buyLot / rataPerPapan : 0
  const dorongLow = dorongHigh / 2
  const baselinePoin = buyAvg * (m.baselinePersen / 100)

  return {
    papan,
    rataPerPapan,
    dorongHigh,
    dorongLow,
    baselinePoin,
    targetLow: buyAvg + baselinePoin + dorongLow * tick,
    targetHigh: buyAvg + baselinePoin + dorongHigh * tick,
  }
}

export interface HasilPbv {
  hargaWajar: number
  upsidePersen: number
  status: 'UNDERVALUED' | 'FAIR' | 'OVERVALUED'
  mos: Array<{ persen: number; harga: number }>
}

/** Ambang ±10% memisahkan tiga status — sama dengan prototipe. */
const AMBANG_STATUS = 10
const TINGKAT_MOS = [10, 20, 30, 40, 50, 60, 70, 80]

export function hitungPbv(harga: number, bvps: number, band: number): HasilPbv | null {
  if (!harga || !bvps || !band) return null
  const hargaWajar = bvps * band
  const upsidePersen = (hargaWajar / harga - 1) * 100
  return {
    hargaWajar,
    upsidePersen,
    status:
      upsidePersen > AMBANG_STATUS ? 'UNDERVALUED'
        : upsidePersen < -AMBANG_STATUS ? 'OVERVALUED'
          : 'FAIR',
    mos: TINGKAT_MOS.map((persen) => ({ persen, harga: hargaWajar * (1 - persen / 100) })),
  }
}

/**
 * Harga beli rata-rata satu broker dari baris padat `broker_harian`.
 *
 * Baris itu menyimpan lot dan nilai rupiah; avg-nya SENGAJA tidak ikut
 * disimpan (terukur 100,00% sama dengan hitungan ini atas 16.379 baris).
 * Pengalinya 100 karena nilai dalam rupiah sementara lot dalam lot.
 */
export function avgBeli(beliLot: number, beliNilai: number): number {
  return beliLot ? beliNilai / (beliLot * 100) : 0
}
