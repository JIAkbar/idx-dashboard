/**
 * Logika murni Grafik Emiten (#tahap 3 jalur chart PAPAN) — dipisah dari
 * komponen supaya bisa diuji tanpa lightweight-charts/DOM. Bentuk berkas
 * sumber (`ohlc/<KODE>.json`) didokumentasikan di `ihsgOhlc.ts` (`BarisOhlc`):
 * satu baris = [tanggal, buka, tinggi, rendah, tutup, volume].
 */
import type { BarisOhlc } from './ihsgOhlc'

export interface BerkasOhlcEmiten {
  kode: string
  mulai: string
  akhir: string
  n: number
  d: BarisOhlc[]
}

/** Satu lilin siap pakai `CandlestickSeries.setData()`. Waktu tetap string
 *  'yyyy-mm-dd' — lightweight-charts menerimanya langsung sebagai BusinessDay,
 *  tak perlu dikonversi ke timestamp. */
export interface LilinData {
  time: string
  open: number
  high: number
  low: number
  close: number
}

/** Satu batang volume siap pakai `HistogramSeries.setData()`. Warna dihitung
 *  di sini (bukan di komponen) supaya jadi satu fungsi yang bisa diuji: naik
 *  kalau tutup >= buka HARI ITU, bukan dibanding hari sebelumnya — sama
 *  dengan definisi warna lilinnya sendiri. */
export interface VolumeData {
  time: string
  value: number
  color: string
}

/** Pisah satu baris OHLC mentah jadi data lilin + data volume, dengan warna
 *  volume ikut arah lilin hari itu (naik/turun). `warnaNaik`/`warnaTurun`
 *  dilempar dari luar (dibaca dari token CSS --green/--red saat panggil,
 *  bukan ditulis di sini) supaya fungsi ini tetap murni tak tahu apa-apa
 *  soal tema. */
export function keDataLilinVolume(
  baris: BarisOhlc[],
  warnaNaik: string,
  warnaTurun: string,
): { lilin: LilinData[]; volume: VolumeData[] } {
  const lilin: LilinData[] = []
  const volume: VolumeData[] = []
  for (const [tanggal, buka, tinggi, rendah, tutup, vol] of baris) {
    if (hariTanpaPerdagangan(buka, tinggi, rendah, tutup, vol)) continue
    lilin.push({ time: tanggal, open: buka, high: tinggi, low: rendah, close: tutup })
    volume.push({ time: tanggal, value: vol, color: tutup >= buka ? warnaNaik : warnaTurun })
  }
  return { lilin, volume }
}

/**
 * Hari yang ADA di berkas tapi TIDAK ada perdagangannya.
 *
 * Berkas OHLC memuat baris untuk hari-hari semacam ini dengan volume 0 dan
 * harga yang dibawa dari hari sebelumnya, sehingga buka=tinggi=rendah=tutup.
 * Kalau ikut digambar, hasilnya garis mendatar setipis benang di antara lilin
 * sungguhan plus batang volume setinggi nol — dan saat kursor berhenti di
 * situ, tooltipnya menyebut sebuah hari yang sebenarnya tak punya transaksi.
 * Johan 17 Agu 2026: "data kosong kok masih di gambar di canvas?".
 *
 * Terukur pada 400 emiten: **398 di antaranya punya baris seperti ini**,
 * total 28.225 baris. Jadi ini bukan kasus pinggiran.
 *
 * Kedua syarat diminta bersamaan, bukan salah satu. Volume 0 saja tak cukup
 * sebagai bukti: kalau harganya bergerak sementara volumenya tercatat nol,
 * yang salah justru ruas volumenya, dan membuang lilin yang harganya nyata
 * berarti menghapus data yang benar. Sebaliknya buka=tinggi=rendah=tutup saja
 * juga tak cukup — hari yang kena auto-reject batas atas/bawah bisa datar
 * dengan volume besar, dan hari itu sungguh diperdagangkan.
 */
function hariTanpaPerdagangan(
  buka: number,
  tinggi: number,
  rendah: number,
  tutup: number,
  vol: number,
): boolean {
  const takAdaVolume = !vol || vol <= 0
  const hargaTakBergerak = buka === tinggi && tinggi === rendah && rendah === tutup
  return takAdaVolume && hargaTakBergerak
}

/** Label chip → jumlah tahun ke belakang dari tanggal TERAKHIR data (bukan
 *  dari hari ini): data OHLC berhenti beberapa hari sebelum "sekarang" kalau
 *  panen belum jalan, dan menghitung dari hari ini bisa memotong lilin
 *  terbaru yang sebenarnya masih ada. `null` = 'Semua', tak dipotong. */
export const RENTANG_GRAFIK: Array<[label: string, tahun: number | null]> = [
  ['1 thn', 1],
  ['3 thn', 3],
  ['5 thn', 5],
  ['Semua', null],
]

/** Tanggal ISO batas bawah rentang, dihitung mundur dari `akhirData` (bukan
 *  `new Date()` — lihat komentar RENTANG_GRAFIK). `tahun: null` -> string
 *  kosong (tak ada batas bawah, seluruh data lolos). */
export function batasBawahRentang(akhirData: string, tahun: number | null): string {
  if (tahun === null || !akhirData) return ''
  const d = new Date(`${akhirData}T00:00:00Z`)
  d.setUTCFullYear(d.getUTCFullYear() - tahun)
  return d.toISOString().slice(0, 10)
}

/** Potong lilin+volume ke rentang [batasBawah, ∞). Dua array dipotong
 *  bersamaan (indeksnya selalu selaras — sama-sama diturunkan dari `d` yang
 *  sama di `keDataLilinVolume`), jadi cukup satu pencarian indeks. */
export function potongRentang<T extends { time: string }>(data: T[], batasBawah: string): T[] {
  if (!batasBawah) return data
  const i = data.findIndex((b) => b.time >= batasBawah)
  return i === -1 ? [] : data.slice(i)
}

/* ------------------------------------------------------------------ *
 * Indikator baku (tahap 4). Semua fungsi murni: masukan array harga
 * tutup (SUDAH tersaring lewat hariTanpaPerdagangan — dipanggil lewat
 * `keDataLilinVolume`, jangan hitung dari `d` mentah), keluaran array
 * sepanjang masukan dengan `null` di posisi yang belum cukup riwayat.
 * `keSeriGaris` di bawah membuang posisi `null` itu supaya siap dipakai
 * `LineSeries.setData()` (lightweight-charts menolak nilai bukan-angka).
 * ------------------------------------------------------------------ */

/** Rata-rata bergerak sederhana (Simple Moving Average). */
export function hitungMA(tutup: number[], periode: number): Array<number | null> {
  const hasil: Array<number | null> = new Array(tutup.length).fill(null)
  let jumlah = 0
  for (let i = 0; i < tutup.length; i++) {
    jumlah += tutup[i]
    if (i >= periode) jumlah -= tutup[i - periode]
    if (i >= periode - 1) hasil[i] = jumlah / periode
  }
  return hasil
}

/** Rata-rata bergerak eksponensial. Bibitnya SMA `periode` titik pertama
 *  (konvensi umum), baru dilanjut rumus rekursif `(harga - emaSebelum) * k +
 *  emaSebelum` dengan `k = 2 / (periode + 1)`. */
export function hitungEMA(tutup: number[], periode: number): Array<number | null> {
  const hasil: Array<number | null> = new Array(tutup.length).fill(null)
  if (tutup.length < periode) return hasil
  const k = 2 / (periode + 1)
  let sma = 0
  for (let i = 0; i < periode; i++) sma += tutup[i]
  sma /= periode
  hasil[periode - 1] = sma
  let ema = sma
  for (let i = periode; i < tutup.length; i++) {
    ema = (tutup[i] - ema) * k + ema
    hasil[i] = ema
  }
  return hasil
}

/** RSI (Relative Strength Index) ala Wilder — pemulusan eksponensial pada
 *  rata-rata untung/rugi, bukan rata-rata sederhana yang dihitung ulang tiap
 *  jendela. Bibitnya rata-rata sederhana dari `periode` selisih pertama. */
export function hitungRSI(tutup: number[], periode: number): Array<number | null> {
  const hasil: Array<number | null> = new Array(tutup.length).fill(null)
  if (tutup.length <= periode) return hasil
  let untung = 0
  let rugi = 0
  for (let i = 1; i <= periode; i++) {
    const selisih = tutup[i] - tutup[i - 1]
    if (selisih > 0) untung += selisih
    else rugi += -selisih
  }
  untung /= periode
  rugi /= periode
  hasil[periode] = rugi === 0 ? 100 : 100 - 100 / (1 + untung / rugi)
  for (let i = periode + 1; i < tutup.length; i++) {
    const selisih = tutup[i] - tutup[i - 1]
    const untungHariIni = selisih > 0 ? selisih : 0
    const rugiHariIni = selisih < 0 ? -selisih : 0
    untung = (untung * (periode - 1) + untungHariIni) / periode
    rugi = (rugi * (periode - 1) + rugiHariIni) / periode
    hasil[i] = rugi === 0 ? 100 : 100 - 100 / (1 + untung / rugi)
  }
  return hasil
}

export interface HasilMACD {
  macd: Array<number | null>
  sinyal: Array<number | null>
  histogram: Array<number | null>
}

/** MACD = EMA cepat - EMA lambat; garis sinyal = EMA dari garis MACD;
 *  histogram = MACD - sinyal. Standar 12/26/9 dilempar dari pemanggil. */
export function hitungMACD(
  tutup: number[],
  periodeCepat: number,
  periodeLambat: number,
  periodeSinyal: number,
): HasilMACD {
  const cepat = hitungEMA(tutup, periodeCepat)
  const lambat = hitungEMA(tutup, periodeLambat)
  const macd: Array<number | null> = tutup.map((_, i) => {
    const c = cepat[i]
    const l = lambat[i]
    return c === null || l === null ? null : c - l
  })
  // EMA garis sinyal dihitung di atas deret MACD yang SUDAH terisi (tanpa
  // null di depan) — hitungEMA butuh deret rapat, bukan yang berlubang.
  const mulai = macd.findIndex((v) => v !== null)
  const sinyal: Array<number | null> = new Array(tutup.length).fill(null)
  if (mulai !== -1) {
    const rapat = macd.slice(mulai) as number[]
    const emaRapat = hitungEMA(rapat, periodeSinyal)
    for (let i = 0; i < emaRapat.length; i++) sinyal[mulai + i] = emaRapat[i]
  }
  const histogram: Array<number | null> = tutup.map((_, i) => {
    const m = macd[i]
    const s = sinyal[i]
    return m === null || s === null ? null : m - s
  })
  return { macd, sinyal, histogram }
}

export interface HasilBollinger {
  tengah: Array<number | null>
  atas: Array<number | null>
  bawah: Array<number | null>
}

/** Bollinger Bands: pita tengah = MA `periode`, pita atas/bawah = tengah ±
 *  `k` simpangan baku POPULASI (dibagi `periode`, bukan `periode - 1`) dari
 *  jendela yang sama — konvensi standar Bollinger. */
export function hitungBollinger(tutup: number[], periode: number, k: number): HasilBollinger {
  const tengah = hitungMA(tutup, periode)
  const atas: Array<number | null> = new Array(tutup.length).fill(null)
  const bawah: Array<number | null> = new Array(tutup.length).fill(null)
  for (let i = periode - 1; i < tutup.length; i++) {
    const rata = tengah[i] as number
    let jumlahKuadrat = 0
    for (let j = i - periode + 1; j <= i; j++) jumlahKuadrat += (tutup[j] - rata) ** 2
    const simpanganBaku = Math.sqrt(jumlahKuadrat / periode)
    atas[i] = rata + k * simpanganBaku
    bawah[i] = rata - k * simpanganBaku
  }
  return { tengah, atas, bawah }
}

/** Titik siap `LineSeries.setData()`: zip waktu+nilai, buang posisi `null`
 *  (belum cukup riwayat) — lightweight-charts tak menerima nilai kosong di
 *  tengah deret LineData. */
export interface TitikGaris {
  time: string
  value: number
}

export function keSeriGaris(waktu: string[], nilai: Array<number | null>): TitikGaris[] {
  const hasil: TitikGaris[] = []
  for (let i = 0; i < nilai.length; i++) {
    const v = nilai[i]
    if (v !== null) hasil.push({ time: waktu[i], value: v })
  }
  return hasil
}

/** Periode bawaan tiap indikator — dipakai komponen supaya angka tak
 *  tertulis dua kali (di sini dan di label layar). */
export const INDIKATOR_DEFAULT = {
  ma: [20, 50] as const,
  ema: [20, 50] as const,
  rsi: 14,
  macd: { cepat: 12, lambat: 26, sinyal: 9 },
  bollinger: { periode: 20, k: 2 },
}
