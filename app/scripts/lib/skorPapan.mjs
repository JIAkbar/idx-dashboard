/**
 * Skor Papan (JS polos) — salinan runtime dari `skorPapan()` di
 * `app/src/lib/dasbor/harianPapan.ts`, untuk skrip Node yang berjalan tanpa
 * transpiler.
 *
 * Mengikuti pola yang sudah dipakai Screener (`lib/skor.mjs` ↔
 * `skorTeknikal.ts`, diuji silang `skorTeknikal.crossCheck.test.mjs`), dan
 * dibuat karena pola itu **belum** dipakai untuk Harian Papan: rumusnya hidup
 * di dalam `bangun-harian-papan.mjs`, dan skrip itu menjalankan pembangunan
 * penuh saat diimpor — jadi tak ada uji yang bisa memanggilnya. Empat salinan
 * konstanta periode, dua pasang, dan pasangan ini satu-satunya yang tak punya
 * penjaga sama sekali (30 Agu 2026).
 *
 * Berkas ini sengaja TANPA efek samping: nol pembacaan cakram, nol tulis, nol
 * `console`. Itu syarat supaya ia bisa diimpor uji.
 *
 * ## Bukan skor Screener, dan itu disengaja
 *
 * Skor Papan berbeda dari SSS Screener di tiga hal, ketiganya keputusan
 * (`harianPapan.ts:23-42`, spek §Skor Papan — kalibrasi 83 label, 96% dalam
 * ±1 tingkat): periode MA 5/10/20/50/100/200, empat osilator gaya MOMENTUM
 * (RSI tinggi = bullish, kebalikan pembacaan kontrarian Screener), dan skor
 * akhir = rata-rata dua kelompok 50:50. Jangan "merapikannya" jadi satu
 * dengan `skor.mjs` — itu membuang kalibrasinya.
 */
import { sma, emaAkhir, rsi, stochK, cci, macd, rakitPeriode, labelSkor } from './skor.mjs'

export const PERIODE_SKOR_PAPAN = [5, 10, 20, 50, 100, 200]

/** Osilator gaya MOMENTUM: nilai TINGGI dibaca bullish. Kebalikan
 *  `biasAmbang` di skor.mjs, dan itu inti perbedaannya. */
export function biasMomentum(v, ambangBawah, ambangAtas) {
  if (v === null) return 0
  if (v >= ambangAtas) return 1
  if (v <= ambangBawah) return -1
  return 0
}

export function skorPapan(baris) {
  if (baris.length < 30) return null
  const tutup = baris.map((b) => b[4])
  const harga = tutup[tutup.length - 1]

  const ma = []
  const arahHarga = (v, nama) => {
    if (v === null) return
    ma.push({ nama, bias: harga > v ? 1 : harga < v ? -1 : 0 })
  }
  for (const n of PERIODE_SKOR_PAPAN) arahHarga(sma(tutup, n), `SMA ${n}`)
  for (const n of PERIODE_SKOR_PAPAN) arahHarga(emaAkhir(tutup, n), `EMA ${n}`)

  const osc = []
  const r = rsi(tutup, 14)
  if (r !== null) osc.push({ nama: 'RSI 14', bias: biasMomentum(r, 40, 60) })
  const k = stochK(baris, 14)
  if (k !== null) osc.push({ nama: 'Stoch 14', bias: biasMomentum(k, 20, 80) })
  const c = cci(baris, 20)
  if (c !== null) osc.push({ nama: 'CCI 20', bias: biasMomentum(c, -100, 100) })
  const m = macd(tutup, 12, 26, 9)
  if (m) osc.push({ nama: 'MACD 12-26', bias: m[0] > 0 ? 1 : m[0] < 0 ? -1 : 0 })

  if (ma.length === 0 && osc.length === 0) return null
  const rata = (arr) => (arr.length ? arr.reduce((a, b) => a + b.bias, 0) / arr.length : 0)
  const maSkor = rata(ma)
  const oscSkor = rata(osc)
  const skor = (maSkor + oscSkor) / 2
  return { skor, label: labelSkor(skor), ma: maSkor, osilator: oscSkor }
}

export function skorPapanTigaKerangka(baris) {
  return {
    harian: skorPapan(baris),
    pekanan: skorPapan(rakitPeriode(baris, 'pekan')),
    bulanan: skorPapan(rakitPeriode(baris, 'bulan')),
  }
}
