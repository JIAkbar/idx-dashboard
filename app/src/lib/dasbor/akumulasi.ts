import type { BarisOhlc } from './ihsgOhlc'
import type { AsingHarian } from './stockDetailData'

/**
 * Dua kolom baru /watchlist (Johan 20 Agu 2026: "tambahkan kolom juga foreign
 * net or sell, terus akumulasi atau distribusi"):
 *
 *   1. **Asing** — net beli/jual investor asing selama `JENDELA` hari bursa.
 *   2. **Akum/Dist** — apakah uang MASUK atau KELUAR diam-diam, dibaca dari
 *      garis Accumulation/Distribution (Chaikin) dibanding arah harganya.
 *
 * Keduanya lahir dari berkas yang sudah ada di peranti — `ohlc/<KODE>.json`
 * dan `asing/<KODE>.json` — jadi tak ada satu pun unduhan tambahan di luar
 * yang memang sudah diminta halaman ini.
 */

/** Berapa hari bursa terakhir yang diringkas kedua kolom. */
export const JENDELA = 20

/**
 * Net asing dalam LEMBAR, bukan rupiah.
 *
 * IDX tidak melaporkan aliran asing dalam rupiah — `beli` dan `jual` di
 * `asing/<KODE>.json` keduanya lembar, dan catatan di dalam berkasnya
 * menyatakan itu. Mengalikannya dengan harga rata-rata harian memang
 * menghasilkan angka berlabel "Rp" yang enak dibaca, tapi itu taksiran kita,
 * bukan angka bursa; kolom sesempit ini tak punya ruang untuk menjelaskan
 * bedanya, jadi yang ditampilkan tetap lembar.
 */
export interface RingkasAsing {
  /** Positif = asing net BELI selama jendela. */
  netLembar: number
  /** Berapa hari bursa yang benar-benar terpakai (bisa < JENDELA). */
  hari: number
  /** Net dibagi total volume perdagangan di jendela yang sama, dalam persen.
   *  Ini yang membuat emiten besar dan kecil bisa disandingkan: net 10 juta
   *  lembar berarti sangat berbeda di emiten bervolume 50 juta dan 5 miliar. */
  porsiPersen: number | null
}

export function ringkasAsing(d: AsingHarian[], jendela = JENDELA): RingkasAsing | null {
  if (d.length === 0) return null
  const potong = d.slice(-jendela)
  let net = 0
  let vol = 0
  for (const b of potong) {
    net += (b.beli ?? 0) - (b.jual ?? 0)
    vol += b.volume ?? 0
  }
  return { netLembar: net, hari: potong.length, porsiPersen: vol > 0 ? (net / vol) * 100 : null }
}

/**
 * Garis Accumulation/Distribution (Chaikin), kumulatif.
 *
 * Per lilin: `((tutup - rendah) - (tinggi - tutup)) / (tinggi - rendah)`
 * dikalikan volumenya. Lilin yang tutupnya di paruh atas rentang hari itu
 * menyumbang positif, di paruh bawah negatif — jadi yang diukur bukan naik
 * atau turunnya harga, melainkan DI MANA harga berhenti dibanding rentang
 * yang sempat dijelajahinya.
 *
 * Lilin bertinggi = rendah (auto-reject, atau emiten yang nyaris tak
 * diperdagangkan) menyumbang NOL, bukan dibagi nol. Itu jawaban yang benar,
 * bukan sekadar penghindaran NaN: hari tanpa rentang tak mengandung informasi
 * apa pun tentang siapa yang menang.
 */
export function garisAd(baris: BarisOhlc[]): number[] {
  const keluar: number[] = []
  let ad = 0
  for (const [, , tinggi, rendah, tutup, volume] of baris) {
    const rentang = tinggi - rendah
    if (rentang > 0) ad += (((tutup - rendah) - (tinggi - tutup)) / rentang) * (volume ?? 0)
    keluar.push(ad)
  }
  return keluar
}

export type Vonis = 'akumulasi' | 'distribusi' | 'akumulasi-diam' | 'distribusi-diam' | 'datar'

export interface RingkasAd {
  vonis: Vonis
  /** Perubahan garis A/D selama jendela, dinormalkan ke total volume jendela —
   *  besaran tanpa satuan yang bisa dibandingkan antar emiten. */
  kekuatan: number
  /** Perubahan harga selama jendela, persen. */
  hargaPersen: number
}

/** Di bawah ini, arah dianggap tak berarti — bukan naik, bukan turun. Angkanya
 *  dipilih supaya emiten yang harganya bergerak < 1% dalam 20 hari tak dilabeli
 *  akumulasi atau distribusi hanya karena pembulatan. */
export const AMBANG_HARGA = 1
export const AMBANG_AD = 0.05

/**
 * Vonis akumulasi/distribusi: arah UANG dibanding arah HARGA.
 *
 * Empat kombinasi, dan dua di antaranya justru yang paling berguna:
 *   - harga naik + A/D naik  -> akumulasi (kenaikan didukung)
 *   - harga turun + A/D turun -> distribusi (penurunan didukung)
 *   - harga TURUN + A/D naik  -> akumulasi diam-diam (dikumpulkan saat sepi)
 *   - harga NAIK + A/D turun  -> distribusi diam-diam (dilepas saat ramai)
 *
 * Ini penyajian keadaan, BUKAN saran beli atau jual — dan tak boleh berubah
 * jadi itu di kemudian hari, sama seperti larangan yang sudah berlaku di
 * Screener dan Kartu Analisa.
 */
export function ringkasAd(baris: BarisOhlc[], jendela = JENDELA): RingkasAd | null {
  if (baris.length < jendela + 1) return null
  const ad = garisAd(baris)
  const akhir = baris.length - 1
  const awal = akhir - jendela

  let vol = 0
  for (let i = awal + 1; i <= akhir; i++) vol += baris[i][5] ?? 0
  if (vol <= 0) return null

  const kekuatan = (ad[akhir] - ad[awal]) / vol
  const hargaAwal = baris[awal][4]
  if (!(hargaAwal > 0)) return null
  const hargaPersen = (baris[akhir][4] / hargaAwal - 1) * 100

  const naikHarga = hargaPersen > AMBANG_HARGA
  const turunHarga = hargaPersen < -AMBANG_HARGA
  const naikAd = kekuatan > AMBANG_AD
  const turunAd = kekuatan < -AMBANG_AD

  let vonis: Vonis = 'datar'
  if (naikAd && naikHarga) vonis = 'akumulasi'
  else if (turunAd && turunHarga) vonis = 'distribusi'
  else if (naikAd && turunHarga) vonis = 'akumulasi-diam'
  else if (turunAd && naikHarga) vonis = 'distribusi-diam'
  else if (naikAd) vonis = 'akumulasi'
  else if (turunAd) vonis = 'distribusi'

  return { vonis, kekuatan, hargaPersen }
}

export const LABEL_VONIS: Record<Vonis, string> = {
  akumulasi: 'Akumulasi',
  distribusi: 'Distribusi',
  'akumulasi-diam': 'Akumulasi diam',
  'distribusi-diam': 'Distribusi diam',
  datar: 'Datar',
}

export const ARTI_VONIS: Record<Vonis, string> = {
  akumulasi: 'Harga naik dan garis Accumulation/Distribution ikut naik — kenaikannya didukung aliran masuk.',
  distribusi: 'Harga turun dan garis Accumulation/Distribution ikut turun — penurunannya didukung aliran keluar.',
  'akumulasi-diam': 'Harga TURUN tapi garis Accumulation/Distribution justru naik — dikumpulkan selagi harganya lesu.',
  'distribusi-diam': 'Harga NAIK tapi garis Accumulation/Distribution justru turun — dilepas selagi harganya ramai.',
  datar: 'Tak ada arah yang cukup jelas selama 20 hari bursa terakhir.',
}
