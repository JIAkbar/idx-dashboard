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
