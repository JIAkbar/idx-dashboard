import type { BarisOhlc } from './ihsgOhlc'

/**
 * Posisi harga terhadap EMA 50/100/200, dan **peluang empiris** yang mengikuti
 * posisi itu — untuk kolom baru di /watchlist (spek Johan 20 Agu 2026:
 * "berikan probabilitas misal EMA 50/100/200").
 *
 * Kata "probabilitas" di dashboard saham nyaris selalu berarti angka karangan:
 * skor yang terdengar seperti peluang padahal cuma bobot yang dipilih penulisnya.
 * Yang dihitung di sini bukan itu. Pertanyaannya sempit dan bisa dijawab dari
 * berkas yang sudah ada di peranti:
 *
 *   > Dalam sejarah emiten INI, setiap kali harganya berada di posisi yang SAMA
 *   > terhadap ketiga EMA seperti hari ini, berapa persen di antaranya yang 20
 *   > hari bursa kemudian ditutup lebih tinggi?
 *
 * Jadi angkanya frekuensi masa lalu emiten itu sendiri, bukan ramalan — dan
 * jumlah sampelnya ikut dibawa (`n`) supaya pembaca bisa menolaknya sendiri.
 * Di bawah `MIN_SAMPEL` kejadian, hasilnya `null`: lebih baik "—" daripada
 * "100%" yang lahir dari tiga kejadian.
 *
 * Nol jaringan tambahan: deretnya berkas `ohlc/<KODE>.json` yang memang sudah
 * diunduh halaman ini untuk harga terakhir.
 */

/** Berapa hari bursa ke depan yang ditanyakan. */
export const HORIZON = 20

/** Di bawah ini hasilnya tak dilaporkan — frekuensi dari segelintir kejadian
 *  bukan peluang, cuma kebetulan yang dibulatkan jadi persen. */
export const MIN_SAMPEL = 25

export const PERIODE = [50, 100, 200] as const

/**
 * EMA baku (`k = 2/(n+1)`), disemai rata-rata sederhana `n` nilai pertama —
 * cara yang sama dipakai platform grafik. Indeks < n-1 diisi `null`: EMA
 * sebelum periodenya penuh bukan "nilai awal yang kasar", ia belum ada, dan
 * memberi angka di situ akan diam-diam menambah sampel palsu ke perhitungan
 * peluang di bawah.
 */
export function hitungEma(nilai: number[], periode: number): (number | null)[] {
  const keluar: (number | null)[] = new Array(nilai.length).fill(null)
  if (nilai.length < periode || periode < 1) return keluar
  let jumlah = 0
  for (let i = 0; i < periode; i++) jumlah += nilai[i]
  let ema = jumlah / periode
  keluar[periode - 1] = ema
  const k = 2 / (periode + 1)
  for (let i = periode; i < nilai.length; i++) {
    ema = nilai[i] * k + ema * (1 - k)
    keluar[i] = ema
  }
  return keluar
}

/**
 * Sandi keadaan: satu digit per EMA, '1' harga di atas, '0' di bawah, urut
 * 50/100/200. `null` kalau salah satu EMA belum ada di indeks itu — keadaan
 * setengah diketahui tidak boleh disamakan dengan keadaan lain, karena
 * "harga di atas EMA50 sementara EMA200 belum ada" adalah emiten yang baru
 * setahun melantai, bukan emiten yang harganya di bawah EMA200.
 */
export function sandiKeadaan(harga: number, ema: (number | null)[]): string | null {
  const digit: string[] = []
  for (const e of ema) {
    if (e == null) return null
    digit.push(harga >= e ? '1' : '0')
  }
  return digit.join('')
}

export interface PosisiEma {
  /** null = deretnya belum cukup panjang untuk EMA itu. */
  ema: (number | null)[]
  /** Sandi keadaan hari terakhir, mis. '110'. null = EMA belum lengkap. */
  sandi: string | null
  /** Peluang empiris naik dalam `HORIZON` hari. null = sampel < MIN_SAMPEL. */
  peluang: { persen: number; n: number; naik: number } | null
}

/** Label manusia untuk sandi — dipakai judul bantuan (tooltip), bukan angka. */
export function labelKeadaan(sandi: string | null): string {
  if (!sandi) return 'EMA belum lengkap — riwayat harganya belum cukup panjang'
  const bagian = PERIODE.map((p, i) => `${sandi[i] === '1' ? 'di atas' : 'di bawah'} EMA${p}`)
  return `Harga ${bagian.join(', ')}`
}

/**
 * Hitung posisi + peluang dari satu deret OHLC.
 *
 * Sampelnya sengaja TIDAK memakai hari-hari terakhir yang hasilnya belum
 * diketahui: satu kejadian baru boleh dihitung kalau `i + HORIZON` masih ada
 * di dalam deret. Tanpa batas itu, hari-hari terbaru ikut masuk penyebut
 * dengan hasil "belum naik" — dan peluangnya bias turun tepat pada emiten
 * yang datanya paling segar.
 */
export function posisiEma(baris: BarisOhlc[]): PosisiEma {
  const tutup = baris.map((b) => b[4])
  const emas = PERIODE.map((p) => hitungEma(tutup, p))
  const akhir = tutup.length - 1
  const kosong: PosisiEma = { ema: [null, null, null], sandi: null, peluang: null }
  if (akhir < 0) return kosong

  const emaAkhir = emas.map((e) => e[akhir])
  const sandi = sandiKeadaan(tutup[akhir], emaAkhir)
  if (!sandi) return { ...kosong, ema: emaAkhir }

  let n = 0
  let naik = 0
  for (let i = 0; i + HORIZON <= akhir; i++) {
    const s = sandiKeadaan(tutup[i], emas.map((e) => e[i]))
    if (s !== sandi) continue
    n++
    if (tutup[i + HORIZON] > tutup[i]) naik++
  }
  return {
    ema: emaAkhir,
    sandi,
    peluang: n >= MIN_SAMPEL ? { persen: (naik / n) * 100, n, naik } : null,
  }
}
