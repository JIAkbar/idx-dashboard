import type { BarisOhlc } from './ihsgOhlc'

/**
 * Skor teknikal agregat PAPAN — kolom "SSS Score D/W/M" di Screener.
 *
 * ## Kenapa bentuknya begini
 *
 * Dua istilah di lembar kerja acuan dicari lebih dulu, dan hasilnya menentukan
 * keputusan yang berbeda untuk masing-masing:
 *
 * * **TDM%** — nol hasil. Tak ada definisi industri; ia istilah milik lembar
 *   kerja itu sendiri. Johan menyebutnya "perubahan", jadi di sini ia
 *   perubahan harga 10 hari bursa (`MOMENTUM_HARI`) dan angkanya SELALU
 *   diberi label periodenya di layar — singkatan yang tak punya standar tak
 *   boleh dipajang sendirian.
 *
 * * **SSS Score** — juga tak ada standarnya, TAPI bentuk keluarannya
 *   (Strong buy / Buy / Neutral / Sell / Strong sell pada tiga kerangka
 *   waktu) persis Technical Rating TradingView, yang metodenya terbuka: tiap
 *   komponen dinilai +1/0/−1, dirata-rata, lalu diambangi ±0,5 dan ±0,1.
 *   Metode itu yang ditiru — bukan angkanya, karena angka TradingView tak
 *   bisa direproduksi tanpa daftar komponen persisnya.
 *
 * ## Yang TIDAK ditiru, dan alasannya
 *
 * TradingView memakai 26 komponen. Di sini 18, dan bedanya disebut jujur:
 * delapan komponennya (Ichimoku, Bull Bear Power, Awesome Oscillator, ADX,
 * Ultimate Oscillator, HMA, VWMA, Momentum) belum punya rumus yang kita
 * hitung sendiri. Memasukkan komponen yang rumusnya ditebak berarti skor yang
 * terlihat presisi tapi tak bisa diperiksa siapa pun — persis jenis angka
 * yang halaman ini ada untuk menghindarinya.
 *
 * Skor ini **penyajian keadaan, bukan saran beli atau jual**. Larangan yang
 * sama sudah berlaku di Screener Kartu Analisa dan Bedah Emiten.
 */

/** Perubahan harga berapa hari bursa untuk kolom TDM%. */
export const MOMENTUM_HARI = 10

export type LabelSkor = 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell'

/** Ambang label — sama dengan Technical Rating TradingView, dan sengaja:
 *  metodenya terbuka dan sudah dikenal pembaca yang datang dari sana. */
export const AMBANG_KUAT = 0.5
export const AMBANG_LEMAH = 0.1

export function labelSkor(skor: number): LabelSkor {
  if (skor >= AMBANG_KUAT) return 'Strong Buy'
  if (skor >= AMBANG_LEMAH) return 'Buy'
  if (skor <= -AMBANG_KUAT) return 'Strong Sell'
  if (skor <= -AMBANG_LEMAH) return 'Sell'
  return 'Neutral'
}

/** Satu komponen skor: namanya, dan biasnya (+1 / 0 / −1). */
export interface Komponen {
  nama: string
  bias: -1 | 0 | 1
}

export interface HasilSkor {
  skor: number
  label: LabelSkor
  /** Dipecah supaya pembaca bisa melihat SIAPA yang menarik skornya. */
  ma: number
  osilator: number
  komponen: Komponen[]
}

export function sma(nilai: number[], n: number): number | null {
  if (nilai.length < n) return null
  let j = 0
  for (let i = nilai.length - n; i < nilai.length; i++) j += nilai[i]
  return j / n
}

export function emaAkhir(nilai: number[], n: number): number | null {
  if (nilai.length < n) return null
  let e = 0
  for (let i = 0; i < n; i++) e += nilai[i]
  e /= n
  const k = 2 / (n + 1)
  for (let i = n; i < nilai.length; i++) e = nilai[i] * k + e * (1 - k)
  return e
}

/** RSI Wilder. null kalau deretnya lebih pendek dari periodenya. */
export function rsi(nilai: number[], n = 14): number | null {
  if (nilai.length <= n) return null
  let naik = 0
  let turun = 0
  for (let i = 1; i <= n; i++) {
    const d = nilai[i] - nilai[i - 1]
    if (d >= 0) naik += d
    else turun -= d
  }
  naik /= n
  turun /= n
  for (let i = n + 1; i < nilai.length; i++) {
    const d = nilai[i] - nilai[i - 1]
    naik = (naik * (n - 1) + (d > 0 ? d : 0)) / n
    turun = (turun * (n - 1) + (d < 0 ? -d : 0)) / n
  }
  if (turun === 0) return naik === 0 ? 50 : 100
  return 100 - 100 / (1 + naik / turun)
}

/** Stochastic %K akhir. Rentang tinggi=rendah menghasilkan 50 (netral),
 *  bukan pembagian nol — hari tanpa rentang tak memihak siapa pun. */
export function stochK(baris: BarisOhlc[], n = 14): number | null {
  if (baris.length < n) return null
  const potong = baris.slice(-n)
  const hi = Math.max(...potong.map((b) => b[2]))
  const lo = Math.min(...potong.map((b) => b[3]))
  if (hi === lo) return 50
  return ((baris[baris.length - 1][4] - lo) / (hi - lo)) * 100
}

/** Williams %R — cerminan Stochastic, rentangnya −100..0. */
export function williamsR(baris: BarisOhlc[], n = 14): number | null {
  const k = stochK(baris, n)
  return k === null ? null : k - 100
}

/** CCI klasik dengan deviasi rata-rata (bukan deviasi baku). */
export function cci(baris: BarisOhlc[], n = 20): number | null {
  if (baris.length < n) return null
  const tp = baris.slice(-n).map((b) => (b[2] + b[3] + b[4]) / 3)
  const rata = tp.reduce((a, b) => a + b, 0) / n
  const dev = tp.reduce((a, b) => a + Math.abs(b - rata), 0) / n
  if (dev === 0) return 0
  return (tp[tp.length - 1] - rata) / (0.015 * dev)
}

/** MACD: [garis, sinyal]. null kalau deretnya belum cukup panjang. */
export function macd(nilai: number[], cepat = 12, lambat = 26, sinyal = 9): [number, number] | null {
  if (nilai.length < lambat + sinyal) return null
  const deret: number[] = []
  for (let i = lambat; i <= nilai.length; i++) {
    const potong = nilai.slice(0, i)
    const a = emaAkhir(potong, cepat)
    const b = emaAkhir(potong, lambat)
    if (a === null || b === null) return null
    deret.push(a - b)
  }
  const garis = deret[deret.length - 1]
  const sg = emaAkhir(deret, sinyal)
  return sg === null ? null : [garis, sg]
}

/** Bias satu osilator dari nilai & ambangnya. Di ANTARA kedua ambang = 0. */
function biasAmbang(v: number | null, jenuhBawah: number, jenuhAtas: number): -1 | 0 | 1 {
  if (v === null) return 0
  // Jenuh jual dibaca BULLISH dan jenuh beli BEARISH — sama dengan Technical
  // Rating, dan memang begitulah osilator dibaca: ia mengukur kelelahan, bukan
  // arah. Yang membacanya terbalik akan selalu terlambat satu ayunan.
  if (v <= jenuhBawah) return 1
  if (v >= jenuhAtas) return -1
  return 0
}

/**
 * Skor satu deret OHLC.
 *
 * Komponen yang datanya belum cukup panjang (mis. SMA 200 pada emiten yang
 * baru setahun melantai) TIDAK dihitung sebagai netral — ia dibuang dari
 * penyebut. Menganggapnya netral membuat skor emiten baru selalu tertarik ke
 * nol, dan itu bukan keadaan pasarnya melainkan keadaan datanya.
 */
export function skorTeknikal(baris: BarisOhlc[]): HasilSkor | null {
  if (baris.length < 30) return null
  const tutup = baris.map((b) => b[4])
  const harga = tutup[tutup.length - 1]
  const komponen: Komponen[] = []

  const PERIODE = [10, 20, 30, 50, 100, 200]
  const arahHarga = (v: number | null, nama: string) => {
    if (v === null) return
    komponen.push({ nama, bias: harga > v ? 1 : harga < v ? -1 : 0 })
  }
  for (const n of PERIODE) arahHarga(sma(tutup, n), `SMA ${n}`)
  for (const n of PERIODE) arahHarga(emaAkhir(tutup, n), `EMA ${n}`)
  const jumlahMa = komponen.length

  const r = rsi(tutup)
  if (r !== null) komponen.push({ nama: 'RSI 14', bias: biasAmbang(r, 30, 70) })
  const k = stochK(baris)
  if (k !== null) komponen.push({ nama: 'Stoch %K', bias: biasAmbang(k, 20, 80) })
  const w = williamsR(baris)
  if (w !== null) komponen.push({ nama: 'Williams %R', bias: biasAmbang(w, -80, -20) })
  const c = cci(baris)
  if (c !== null) komponen.push({ nama: 'CCI 20', bias: biasAmbang(c, -100, 100) })
  const m = macd(tutup)
  if (m) komponen.push({ nama: 'MACD', bias: m[0] > m[1] ? 1 : m[0] < m[1] ? -1 : 0 })
  // Momentum sederhana: harga sekarang vs 10 hari lalu. Satu-satunya komponen
  // yang membaca perubahan langsung, bukan turunan.
  if (tutup.length > MOMENTUM_HARI) {
    const lalu = tutup[tutup.length - 1 - MOMENTUM_HARI]
    komponen.push({ nama: `Momentum ${MOMENTUM_HARI}H`, bias: harga > lalu ? 1 : harga < lalu ? -1 : 0 })
  }

  if (komponen.length === 0) return null
  const rata = (dari: number, sampai: number) => {
    const potong = komponen.slice(dari, sampai)
    return potong.length ? potong.reduce((a, b) => a + b.bias, 0) / potong.length : 0
  }
  const skor = komponen.reduce((a, b) => a + b.bias, 0) / komponen.length
  return {
    skor,
    label: labelSkor(skor),
    ma: rata(0, jumlahMa),
    osilator: rata(jumlahMa, komponen.length),
    komponen,
  }
}

/**
 * Rakit lilin harian jadi PEKANAN atau BULANAN.
 *
 * Dikelompokkan menurut tanggal, bukan menurut jumlah lilin: pekan bursa
 * Indonesia sering pendek karena hari libur nasional, dan "tiap 5 lilin"
 * akan menggeser batas pekan sedikit demi sedikit sepanjang tahun sampai
 * satu "pekan" berisi hari-hari dari dua pekan berbeda.
 */
export function rakitPeriode(baris: BarisOhlc[], satuan: 'pekan' | 'bulan'): BarisOhlc[] {
  const kunci = (t: string): string => {
    if (satuan === 'bulan') return t.slice(0, 7)
    const d = new Date(`${t}T00:00:00Z`)
    // Kunci pekan = tanggal hari Senin-nya. Aman melintasi pergantian tahun,
    // beda dari nomor pekan yang berulang tiap Januari.
    const hari = (d.getUTCDay() + 6) % 7
    d.setUTCDate(d.getUTCDate() - hari)
    return d.toISOString().slice(0, 10)
  }
  const keluar: BarisOhlc[] = []
  let kini: BarisOhlc | null = null
  let kiniKunci = ''
  for (const [t, o, h, l, c, v] of baris) {
    const kk = kunci(t)
    if (!kini || kk !== kiniKunci) {
      if (kini) keluar.push(kini)
      kini = [t, o, h, l, c, v]
      kiniKunci = kk
      continue
    }
    kini[2] = Math.max(kini[2], h)
    kini[3] = Math.min(kini[3], l)
    kini[4] = c
    kini[5] = (kini[5] ?? 0) + (v ?? 0)
  }
  if (kini) keluar.push(kini)
  return keluar
}

export interface SkorTigaKerangka {
  harian: HasilSkor | null
  pekanan: HasilSkor | null
  bulanan: HasilSkor | null
}

export function skorTigaKerangka(baris: BarisOhlc[]): SkorTigaKerangka {
  return {
    harian: skorTeknikal(baris),
    pekanan: skorTeknikal(rakitPeriode(baris, 'pekan')),
    bulanan: skorTeknikal(rakitPeriode(baris, 'bulan')),
  }
}

/** Perubahan harga `hari` hari bursa terakhir, persen. Kolom TDM%. */
export function momentumPersen(baris: BarisOhlc[], hari = MOMENTUM_HARI): number | null {
  if (baris.length <= hari) return null
  const kini = baris[baris.length - 1][4]
  const lalu = baris[baris.length - 1 - hari][4]
  return lalu > 0 ? (kini / lalu - 1) * 100 : null
}
