/**
 * Rumus skor teknikal PAPAN — port JS POLOS dari `app/src/lib/dasbor/skorTeknikal.ts`.
 *
 * KENAPA modul terpisah, bukan disalin lagi ke tiap skrip Node: skrip
 * pembangun (`bangun-screener.mjs`, `audit-skor.mjs`) jalan di Node tanpa
 * transpiler, jadi tak bisa mengimpor `.ts` langsung. Sebelum berkas ini,
 * `audit-skor.mjs` menyalin rumusnya sendiri — dua salinan yang bisa
 * menyimpang diam-diam adalah bug termahal di proyek ini (lihat komentar di
 * `skorTeknikal.ts`). Sekarang cuma SATU salinan JS, dipakai kedua skrip, dan
 * `skorTeknikal.crossCheck.test.mjs` membandingkannya ke sumber TS pada data
 * NYATA supaya penyimpangan gagal keras, bukan gagal senyap.
 *
 * Isi & urutan komponen WAJIB sama persis dengan skorTeknikal.ts. Kalau
 * sumber TS berubah, ubah berkas ini juga lalu jalankan uji silangnya.
 */

export const MOMENTUM_HARI = 10
export const AMBANG_KUAT = 0.5
export const AMBANG_LEMAH = 0.1

export function labelSkor(skor) {
  if (skor >= AMBANG_KUAT) return 'Strong Buy'
  if (skor >= AMBANG_LEMAH) return 'Buy'
  if (skor <= -AMBANG_KUAT) return 'Strong Sell'
  if (skor <= -AMBANG_LEMAH) return 'Sell'
  return 'Neutral'
}

export function sma(nilai, n) {
  if (nilai.length < n) return null
  let j = 0
  for (let i = nilai.length - n; i < nilai.length; i++) j += nilai[i]
  return j / n
}

export function emaAkhir(nilai, n) {
  if (nilai.length < n) return null
  let e = 0
  for (let i = 0; i < n; i++) e += nilai[i]
  e /= n
  const k = 2 / (n + 1)
  for (let i = n; i < nilai.length; i++) e = nilai[i] * k + e * (1 - k)
  return e
}

/** RSI Wilder. null kalau deretnya lebih pendek dari periodenya. */
export function rsi(nilai, n = 14) {
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

/** Stochastic %K akhir. Rentang tinggi=rendah -> 50 (netral), bukan NaN. */
export function stochK(baris, n = 14) {
  if (baris.length < n) return null
  const potong = baris.slice(-n)
  const hi = Math.max(...potong.map((b) => b[2]))
  const lo = Math.min(...potong.map((b) => b[3]))
  if (hi === lo) return 50
  return ((baris[baris.length - 1][4] - lo) / (hi - lo)) * 100
}

/** Williams %R — cerminan Stochastic, rentangnya -100..0. */
export function williamsR(baris, n = 14) {
  const k = stochK(baris, n)
  return k === null ? null : k - 100
}

/** CCI klasik dengan deviasi rata-rata (bukan deviasi baku). */
export function cci(baris, n = 20) {
  if (baris.length < n) return null
  const tp = baris.slice(-n).map((b) => (b[2] + b[3] + b[4]) / 3)
  const rata = tp.reduce((a, b) => a + b, 0) / n
  const dev = tp.reduce((a, b) => a + Math.abs(b - rata), 0) / n
  if (dev === 0) return 0
  return (tp[tp.length - 1] - rata) / (0.015 * dev)
}

/** MACD: [garis, sinyal]. null kalau deretnya belum cukup panjang. */
export function macd(nilai, cepat = 12, lambat = 26, sinyal = 9) {
  if (nilai.length < lambat + sinyal) return null
  const deret = []
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
function biasAmbang(v, jenuhBawah, jenuhAtas) {
  if (v === null) return 0
  if (v <= jenuhBawah) return 1
  if (v >= jenuhAtas) return -1
  return 0
}

/**
 * Skor satu deret OHLC. Sama persis dengan `skorTeknikal()` di skorTeknikal.ts
 * — lihat berkas itu untuk penjelasan kenapa bentuknya begini.
 */
export function skorTeknikal(baris) {
  if (baris.length < 30) return null
  const tutup = baris.map((b) => b[4])
  const harga = tutup[tutup.length - 1]
  const komponen = []

  const PERIODE = [10, 20, 30, 50, 100, 200]
  const arahHarga = (v, nama) => {
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
  if (tutup.length > MOMENTUM_HARI) {
    const lalu = tutup[tutup.length - 1 - MOMENTUM_HARI]
    komponen.push({ nama: `Momentum ${MOMENTUM_HARI}H`, bias: harga > lalu ? 1 : harga < lalu ? -1 : 0 })
  }

  if (komponen.length === 0) return null
  const rata = (dari, sampai) => {
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

/** Rakit lilin harian jadi PEKANAN atau BULANAN. Dikelompokkan menurut
 *  tanggal, bukan jumlah lilin — lihat skorTeknikal.ts untuk alasannya. */
export function rakitPeriode(baris, satuan) {
  const kunci = (t) => {
    if (satuan === 'bulan') return t.slice(0, 7)
    const d = new Date(`${t}T00:00:00Z`)
    const hari = (d.getUTCDay() + 6) % 7
    d.setUTCDate(d.getUTCDate() - hari)
    return d.toISOString().slice(0, 10)
  }
  const keluar = []
  let kini = null
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

export function skorTigaKerangka(baris) {
  return {
    harian: skorTeknikal(baris),
    pekanan: skorTeknikal(rakitPeriode(baris, 'pekan')),
    bulanan: skorTeknikal(rakitPeriode(baris, 'bulan')),
  }
}

/** Perubahan harga `hari` hari bursa terakhir, persen. Kolom TDM%. */
export function momentumPersen(baris, hari = MOMENTUM_HARI) {
  if (baris.length <= hari) return null
  const kini = baris[baris.length - 1][4]
  const lalu = baris[baris.length - 1 - hari][4]
  return lalu > 0 ? (kini / lalu - 1) * 100 : null
}
