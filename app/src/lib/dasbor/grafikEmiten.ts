/**
 * Logika murni Grafik Emiten (#tahap 3 jalur chart PAPAN) — dipisah dari
 * komponen supaya bisa diuji tanpa lightweight-charts/DOM. Bentuk berkas
 * sumber (`ohlc/<KODE>.json`) didokumentasikan di `ihsgOhlc.ts` (`BarisOhlc`):
 * satu baris = [tanggal, buka, tinggi, rendah, tutup, volume].
 */
import type { Bar } from 'oakscriptjs'
import type { Katalog } from './katalogIndikator'
import type { BarisOhlc } from './ihsgOhlc'
import { HARI, ringkasHarian, vonisUji, type RingkasHari } from '../seasonality'

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

/**
 * Rentang di BILAH BAWAH kanvas — `1D 5D 1M 3M 6M 1Y 5Y All`, persis deretan
 * yang ada di kaki chart Stockbit/TradingView.
 *
 * Satuannya HARI. Daftar sebelumnya (1T/3T/5T/Semua) memakai satuan TAHUN dan
 * dibuang bersama chip-nya: separuh isi kaki baru (1D, 5D, 1M) mustahil
 * dinyatakan sebagai bilangan tahun bulat, dan menyimpan dua daftar rentang
 * berdampingan berarti dua tempat yang bisa berselisih soal rentang mana yang
 * sedang aktif.
 *
 * Labelnya sengaja PENDEK dan berbahasa chart (1D/1M/1Y), bukan `LABEL_RENTANG`
 * yang berbahasa Indonesia panjang: delapan chip "1 Bulan"/"3 Bulan"/"1 Tahun"
 * tak muat di kaki kanvas 412px, dan justru kaki inilah yang paling sering
 * ditekan.
 */
export const RENTANG_KAKI: Array<[label: string, hari: number | null]> = [
  ['1D', 1],
  ['5D', 5],
  ['1M', 31],
  ['3M', 92],
  ['6M', 183],
  ['1Y', 365],
  ['5Y', 1826],
  ['Semua', null],
]

/** Tanggal ISO batas bawah sebuah rentang berbasis HARI, dihitung mundur dari
 *  tanggal TERAKHIR data — bukan dari hari ini. Data OHLC berhenti beberapa
 *  hari sebelum "sekarang" kalau panen belum jalan, dan menghitung dari hari
 *  ini memotong lilin terbaru yang sebenarnya masih ada. */
export function batasBawahHari(akhirData: string, hari: number | null): string {
  if (hari === null || !akhirData) return ''
  const d = new Date(`${akhirData.slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - hari)
  return d.toISOString().slice(0, 10)
}

/** Rentang yang aktif saat halaman pertama dibuka. Johan 17 Agu 2026: "buat
 *  default nya semua". Ditulis sebagai konstanta (bukan angka indeks) supaya
 *  chip yang tersorot dan data yang tergambar mustahil berbeda. */
export const RENTANG_KAKI_BAWAAN = 'Semua'

/**
 * Harga tutup pada waktu `t`, atau tutup terakhir SEBELUM `t` kalau waktu itu
 * tak ada di deret. `null` kalau seluruh deret masih di depan `t`.
 *
 * Dipakai Compare symbols (#187) menghitung persentase pembanding pada waktu
 * yang sedang disorot. Pencocokan PERSIS tidak cukup: pada kerangka pekanan
 * kunci lilinnya tanggal SENIN dan pada bulanan tanggal 1 — keduanya kerap
 * hari libur bursa, jadi tak ada barisnya di deret harian pembanding, dan
 * pencocokan persis akan melaporkan "—" untuk seluruh kerangka W dan M.
 *
 * `d` diasumsikan urut menaik menurut `time` (selalu begitu: ia turunan
 * langsung berkas OHLC yang memang urut) — karena itu pencarian binernya sah.
 */
export function tutupSampai(d: LilinData[], t: string): number | null {
  let lo = 0
  let hi = d.length - 1
  let hasil: number | null = null
  while (lo <= hi) {
    const m = (lo + hi) >> 1
    if (d[m].time <= t) {
      hasil = d[m].close
      lo = m + 1
    } else {
      hi = m - 1
    }
  }
  return hasil
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

/**
 * On-Balance Volume — volume hari itu DITAMBAHKAN kalau harga tutup naik,
 * DIKURANGKAN kalau turun, dan diabaikan kalau sama. Angka mutlaknya tak
 * berarti apa-apa (bergantung dari mana penjumlahan dimulai); yang dibaca
 * arahnya.
 *
 * Melengkapi pola Lonjakan Volume, bukan mengulanginya: pola itu melihat
 * SATU hari, OBV menumpuk arah volume sepanjang riwayat — pertanyaan yang
 * sama pada rentang waktu berbeda, dan satu hari saja bukti yang tipis.
 *
 * Titik pertama 0 sebagai titik berangkat (bukan `null`): tanpa hari
 * sebelumnya, arah hari pertama tak bisa ditentukan, dan menaruh volume hari
 * itu di sana akan membuat lompatan semu di ujung kiri grafik.
 */
export function hitungOBV(tutup: number[], volume: number[]): Array<number | null> {
  const hasil: Array<number | null> = new Array(tutup.length).fill(null)
  if (tutup.length === 0) return hasil
  let obv = 0
  hasil[0] = 0
  for (let i = 1; i < tutup.length; i++) {
    const vol = volume[i] ?? 0
    if (tutup[i] > tutup[i - 1]) obv += vol
    else if (tutup[i] < tutup[i - 1]) obv -= vol
    hasil[i] = obv
  }
  return hasil
}

/* ------------------------------------------------------------------ *
 * Jembatan ke `lightweight-charts-indicators` (MIT, di atas `oakscriptjs`).
 * Enam indikator yang sudah ada (MA/EMA/RSI/MACD/BB/OBV) SENGAJA tidak ditukar
 * ke pustaka: semuanya sudah punya uji sendiri, dan menukar implementasi teruji
 * dengan pustaka pra-1.0 berarti menukar risiko yang sudah diketahui dengan
 * risiko yang belum. Yang dilakukan sebaliknya: RSI kita diuji SILANG terhadap
 * RSI pustaka (grafikEmiten.test.ts) — cocok berarti keduanya saling
 * menguatkan.
 *
 * Rumus pustakanya sendiri TIDAK diimpor di sini. Yang masuk cuma `Katalog`
 * (tipe) dan fungsi hitung yang dibawa entrinya — pustakanya dimuat lewat impor
 * dinamis di `katalogIndikator.ts`, dan satu impor statis di berkas mana pun
 * akan menarik seluruh 1,9 MB-nya ke potongan /grafik. Lihat catatan di sana.
 * ------------------------------------------------------------------ */

/** Satu titik keluaran pustaka. Bentuk longgar (bukan `TimeValue` pustaka)
 *  supaya berkas ini tak ikut terikat pada tipe internalnya. */
interface TitikPustaka { time: unknown; value: number | null }

/**
 * Menjalankan satu fungsi `calculate` pustaka lalu mengembalikan deret yang
 * SEJAJAR INDEKS dengan `lilin` — bentuk yang sudah dipakai seluruh indikator
 * di berkas ini (`Array<number | null>`, `null` di posisi yang belum cukup
 * riwayat).
 *
 * Waktunya dikirim sebagai DETIK EPOCH sungguhan, bukan nomor urut lilin.
 * Itu bukan pilihan gaya: VWAP menghitung ulang akumulasinya tiap kali batas
 * jangkar (pekan/bulan) terlampaui, dan batas itu dibaca dari tanggal. Dengan
 * nomor urut, VWAP tak akan pernah menemukan batas mana pun dan hasilnya satu
 * garis akumulasi seumur data — salah tanpa satu pun galat.
 *
 * Pemetaan baliknya lewat waktu (bukan urutan) supaya tetap benar seandainya
 * versi pustaka berikutnya memangkas titik warm-up dari keluarannya.
 */
function plotPustaka(
  lilin: LilinData[],
  volume: number[],
  hitung: (bars: Bar[]) => { plots: Record<string, TitikPustaka[]> },
): Record<string, Array<number | null>> {
  if (!lilin.length) return {}
  const bars: Bar[] = lilin.map((l, i) => ({
    time: Math.floor(Date.parse(`${l.time}T00:00:00Z`) / 1000),
    open: l.open, high: l.high, low: l.low, close: l.close, volume: volume[i] ?? 0,
  }))
  const indeks = new Map(bars.map((b, i) => [b.time, i]))
  const keluar: Record<string, Array<number | null>> = {}
  for (const [nama, titik] of Object.entries(hitung(bars).plots)) {
    const deret: Array<number | null> = new Array(lilin.length).fill(null)
    for (const t of titik) {
      const i = indeks.get(Number(t.time))
      // NaN ikut disaring di sini: pustaka memakainya sebagai "belum ada
      // nilai", sedangkan lightweight-charts menolak deret bernilai NaN.
      if (i !== undefined && typeof t.value === 'number' && Number.isFinite(t.value)) deret[i] = t.value
    }
    keluar[nama] = deret
  }
  return keluar
}

export function keSeriGaris(waktu: string[], nilai: Array<number | null>): TitikGaris[] {
  const hasil: TitikGaris[] = []
  for (let i = 0; i < nilai.length; i++) {
    const v = nilai[i]
    if (v !== null) hasil.push({ time: waktu[i], value: v })
  }
  return hasil
}

/* ------------------------------------------------------------------ *
 * Instans indikator (#tahap 5). Indikator berhenti jadi sakelar nyala/mati
 * dan jadi DAFTAR instans: MA 20, MA 50, dan MA 200 bisa hidup bersamaan,
 * masing-masing dengan parameter, warna, dan sakelar tampilnya sendiri.
 * Johan 17 Agu 2026: "setiap indikator bisa di masukkan berkali-kali".
 * ------------------------------------------------------------------ */

/** Sepuluh jenis KURASI PAPAN — yang punya label, parameter, dan (untuk enam
 *  yang pertama) rumus Indonesia sendiri. */
export type JenisAsli =
  | 'ma' | 'ema' | 'bb' | 'rsi' | 'macd' | 'obv'
  | 'stoch' | 'stochrsi' | 'wpr' | 'vwap'

/**
 * Jenis sebuah instans indikator: salah satu dari sepuluh kurasi, ATAU
 * `p:<id>` — satu entri katalog pustaka (`katalogIndikator.ts`).
 *
 * Awalan `p:` bukan hiasan. Ia yang membuat template lama tetap terbaca (tak
 * ada jenis lama yang mengandung titik dua), membuat jenis katalog bisa
 * dikenali TANPA katalognya dimuat, dan membuat tabrakan nama mustahil kalau
 * kelak ada sumber indikator kedua.
 */
export type JenisIndikator = JenisAsli | `p:${string}`

/** Id entri katalog dari sebuah jenis, atau `null` kalau itu jenis kurasi. */
export function idPustaka(jenis: string): string | null {
  return jenis.startsWith('p:') ? jenis.slice(2) : null
}

/** Satu kolom masukan pada sebuah instans: batas-batasnya ditulis DI SINI,
 *  sekali, dan dipakai bersama oleh validasi, nilai bawaan, dan label kolom
 *  di layar — supaya ketiganya tak bisa berselisih. */
export interface SpekParam {
  kunci: string
  label: string
  bawaan: number
  min: number
  maks: number
  /** Periode harus bilangan bulat; pengali simpangan baku tidak. */
  bulat: boolean
  /**
   * Ruas yang isinya PILIHAN, bukan angka bebas — dirender sebagai `Dropdown`
   * di `SetelanInstans`. Nilainya tetap angka (biar template & validasi tak
   * perlu tahu apa-apa soal ruas jenis baru), yang berganti cuma cara
   * memilihnya. Dipakai dua ruas yang jawabannya memang terhingga: hari
   * musiman (Senin–Jumat) dan jangkar VWAP (pekan/bulan) — mengetik "3" untuk
   * Kamis adalah teka-teki, bukan masukan.
   */
  pilihan?: Array<{ nilai: number; label: string }>
  /** Ruas yang tak boleh melebihi jumlah lilin yang tergambar. Periode
   *  sepanjang itu membuat seluruh deret hasilnya `null` — garisnya lenyap
   *  tanpa satu pun galat, dan itulah kegagalan senyap yang harus dicegat
   *  di kolomnya, bukan dibiarkan sampai ke kanvas. */
  bandingLilin?: boolean
}

export interface SpekIndikator {
  label: string
  param: SpekParam[]
  /** true = garisnya menumpang di panel harga; false = pane terpisah di
   *  bawahnya (RSI/MACD skalanya sama sekali bukan rupiah). */
  diPanelHarga: boolean
}

const PERIODE = (bawaan: number, label = 'Periode'): SpekParam =>
  ({ kunci: 'periode', label, bawaan, min: 2, maks: 1000, bulat: true, bandingLilin: true })

export const SPEK_INDIKATOR: Record<JenisAsli, SpekIndikator> = {
  ma: { label: 'MA', diPanelHarga: true, param: [PERIODE(20)] },
  ema: { label: 'EMA', diPanelHarga: true, param: [PERIODE(20)] },
  bb: {
    label: 'BB',
    diPanelHarga: true,
    param: [
      PERIODE(20),
      { kunci: 'k', label: 'Simpangan', bawaan: 2, min: 0.1, maks: 10, bulat: false },
    ],
  },
  rsi: { label: 'RSI', diPanelHarga: false, param: [PERIODE(14)] },
  // OBV tak punya parameter sama sekali — ia menjumlah seluruh riwayat, tak
  // ada jendela yang bisa disetel. Barisnya di layar cuma nama + sakelar.
  obv: { label: 'OBV', diPanelHarga: false, param: [] },
  // Empat berikut dihitung pustaka (lihat plotPustaka). Nama parameternya
  // sengaja mengikuti nama masukan pustaka — kalau kelak angkanya dicurigai,
  // yang membaca kode ini bisa langsung mencocokkannya dengan dokumentasi
  // pustaka tanpa menebak ruas mana yang berganti nama di tengah jalan.
  stoch: {
    label: 'Stoch',
    diPanelHarga: false,
    param: [
      { kunci: 'periodeK', label: 'Periode %K', bawaan: 14, min: 1, maks: 1000, bulat: true, bandingLilin: true },
      { kunci: 'smoothK', label: 'Haluskan %K', bawaan: 1, min: 1, maks: 100, bulat: true },
      { kunci: 'periodeD', label: 'Periode %D', bawaan: 3, min: 1, maks: 100, bulat: true },
    ],
  },
  stochrsi: {
    label: 'StochRSI',
    diPanelHarga: false,
    param: [
      { kunci: 'periodeRsi', label: 'Periode RSI', bawaan: 14, min: 2, maks: 1000, bulat: true, bandingLilin: true },
      { kunci: 'periodeStoch', label: 'Periode Stoch', bawaan: 14, min: 1, maks: 1000, bulat: true, bandingLilin: true },
      { kunci: 'smoothK', label: 'Haluskan %K', bawaan: 3, min: 1, maks: 100, bulat: true },
      { kunci: 'smoothD', label: 'Haluskan %D', bawaan: 3, min: 1, maks: 100, bulat: true },
    ],
  },
  wpr: { label: 'W%R', diPanelHarga: false, param: [PERIODE(14)] },
  vwap: {
    label: 'VWAP',
    // Satu-satunya dari keempatnya yang MENUMPANG di panel harga: satuannya
    // rupiah, sama dengan lilinnya.
    diPanelHarga: true,
    param: [{
      kunci: 'jangkar',
      label: 'Jangkar',
      // Bawaan pustaka '1D' — dan pada data HARIAN itu menjadikan VWAP
      // menghitung ulang tiap lilin, jadi hasilnya cuma harga rata-rata lilin
      // itu sendiri: sebuah garis yang menempel pada harga dan tak
      // memberitahu apa pun. Jangkar terkecil yang berarti di sini pekan.
      bawaan: 2,
      min: 1,
      maks: 2,
      bulat: true,
      pilihan: [{ nilai: 1, label: 'Pekan' }, { nilai: 2, label: 'Bulan' }],
    }],
  },
  macd: {
    label: 'MACD',
    diPanelHarga: false,
    param: [
      { kunci: 'cepat', label: 'Cepat', bawaan: 12, min: 2, maks: 1000, bulat: true, bandingLilin: true },
      { kunci: 'lambat', label: 'Lambat', bawaan: 26, min: 2, maks: 1000, bulat: true, bandingLilin: true },
      { kunci: 'sinyal', label: 'Sinyal', bawaan: 9, min: 2, maks: 1000, bulat: true, bandingLilin: true },
    ],
  },
}

/** Satu baris di daftar indikator/pola: identitas, jenis, parameter, warna,
 *  dan sakelar tampil sementara. Bentuknya sama untuk indikator dan pola
 *  supaya penyimpanan template & pembuatan instans tak perlu ditulis dua
 *  kali. `warna` menyimpan NAMA TOKEN CSS (mis. '--amber'), bukan
 *  heksadesimal — dengan begitu satu instans yang sama ikut berganti warna
 *  saat tema terang/gelap ditukar. */
export interface Instans<J extends string> {
  id: string
  jenis: J
  param: Record<string, number>
  warna: string
  tampil: boolean
  /** Gaya PER PLOT, berkunci indeks deret dari `hitungInstans` — BB punya tiga
   *  pita, MACD dua garis + histogram, dan sebelum ini ketiganya terpaksa
   *  sewarna karena warna cuma ada satu per instans. Kosong = pakai warna &
   *  gaya instansnya (semua kunci opsional, jadi instans lama tetap terbaca). */
  gaya?: Record<number, GayaPlot>
  /** Angka di belakang koma pada lencana sumbu & legenda. `undefined` =
   *  ikut format bawaan. Ruas OUTPUTS di modal setelan. */
  presisi?: number
  /** Tampilkan lencana nilai terakhir di sumbu kanan. Bawaan: ya. */
  labelSumbu?: boolean
  /** Tampilkan angkanya di baris status/legenda. Bawaan: ya. */
  nilaiStatus?: boolean
  /**
   * Kerangka waktu tempat instans ini TIDAK digambar (tab Visibility) —
   * disimpan sebagai id telanjang ('5m', 'D', …), bukan tipe `IdKerangka`,
   * supaya berkas ini tak perlu mengimpor `kerangkaWaktu.ts` yang sudah
   * mengimpor tipe dari sini.
   *
   * Disimpan sebagai daftar yang DISEMBUNYIKAN, bukan yang ditampilkan:
   * dengan begitu instans lama (dan template lama) yang ruas ini tak ada
   * berarti "tampil di mana saja", bukan "tak tampil di mana pun".
   */
  sembunyiDi?: string[]
}

/** Gaya sebuah plot tunggal di dalam satu instans. Semua opsional: yang tak
 *  disetel jatuh ke gaya instansnya. */
export interface GayaPlot {
  /** Token CSS (mis. '--blue'), bukan heksadesimal — alasannya sama dengan
   *  `Instans.warna`: ikut berganti sendiri saat tema ditukar. */
  warna?: string
  /** 0=Solid, 1=Dotted, 2=Dashed — angka `LineStyle` lightweight-charts,
   *  disimpan sebagai angka telanjang supaya template tetap JSON murni. */
  garis?: number
  tebal?: number
  tampil?: boolean
}

/**
 * Salinan DALAM sebuah instans — dipakai modal setelan sebagai draf.
 *
 * `{...inst}` saja TIDAK cukup dan di situlah bahayanya: `param` dan `gaya`
 * objek, jadi salinan dangkal tetap menunjuk objek yang sama dan tiap ketikan
 * di modal langsung mengubah instans aslinya. Tombol `Cancel` kemudian
 * "membatalkan" sesuatu yang sudah terlanjur berlaku — persis keluhan yang
 * modal ini datang untuk memperbaiki, cuma sekarang tersembunyi di balik
 * tombol yang mengaku membatalkan.
 */
export function salinInstans<J extends string>(inst: Instans<J>): Instans<J> {
  return {
    ...inst,
    param: { ...inst.param },
    gaya: inst.gaya
      ? Object.fromEntries(Object.entries(inst.gaya).map(([k, v]) => [k, { ...v }]))
      : undefined,
  }
}

/**
 * Terapkan teks yang diketik di modal ke sebuah draf instans.
 *
 * `null` kalau ada kolom yang tak sah — pemanggilnya (tombol Ok) menolak
 * menutup, bukan menyimpan angka setengah jadi. Dipisah jadi fungsi murni
 * supaya aturan "Ok hanya berlaku kalau seluruh kolom sah" bisa diuji tanpa
 * merender modal.
 */
export function terapkanDraf<J extends string>(
  draf: Instans<J>,
  param: SpekParam[],
  teks: Record<string, string>,
  jumlahLilin: number,
): Instans<J> | null {
  if (Object.keys(galatInstans(param, teks, jumlahLilin)).length > 0) return null
  const salin = salinInstans(draf)
  for (const s of param) salin.param[s.kunci] = Number(teks[s.kunci])
  return salin
}

export type InstansIndikator = Instans<JenisIndikator>

/** Warna instans baru diambil berputar dari daftar ini. Semuanya token yang
 *  sudah ada di `.lantai` dan sudah lolos kontras di kedua tema. */
export const PALET_INDIKATOR = ['--amber', '--blue', '--green', '--red', '--text2', '--text3']

/** Instans baru berisi nilai bawaan seluruh parameter jenisnya. `id` dilempar
 *  dari luar (pemanggil yang tahu cara membuat id unik — `crypto.randomUUID`
 *  di peramban, string tetap di uji) supaya fungsi ini tetap murni. */
export function buatInstans<J extends string>(
  jenis: J,
  param: SpekParam[],
  id: string,
  urutanWarna: number,
): Instans<J> {
  return {
    id,
    jenis,
    param: Object.fromEntries(param.map((s) => [s.kunci, s.bawaan])),
    warna: PALET_INDIKATOR[urutanWarna % PALET_INDIKATOR.length],
    tampil: true,
  }
}

/** Galat satu kolom masukan, dibaca dari TEKS yang diketik (bukan dari angka
 *  yang sudah terlanjur dikonversi) — `Number('')` itu 0 dan `Number('12abc')`
 *  itu NaN, dan keduanya harus terbaca sebagai masukan salah, bukan sebagai
 *  angka yang kebetulan lolos. Mengembalikan `null` kalau tak ada masalah. */
export function galatNilaiParam(spek: SpekParam, teks: string, jumlahLilin: number): string | null {
  const t = teks.trim()
  if (!t) return 'Wajib diisi.'
  const n = Number(t)
  if (!Number.isFinite(n)) return 'Bukan angka.'
  if (spek.bulat && !Number.isInteger(n)) return 'Harus bilangan bulat.'
  if (n < spek.min) return `Minimum ${spek.min}.`
  if (n > spek.maks) return `Maksimum ${spek.maks}.`
  if (spek.bandingLilin && jumlahLilin > 0 && n > jumlahLilin) {
    return `Lebih besar dari jumlah lilin (${jumlahLilin}) — garisnya tak akan muncul.`
  }
  return null
}

/**
 * Seluruh galat sebuah instans, per kunci parameter. Selain memeriksa tiap
 * kolom sendiri-sendiri, di sini juga tempatnya aturan ANTAR kolom: MACD
 * dengan periode cepat >= lambat menghasilkan garis yang membalik artinya
 * tanpa satu pun galat, jadi ditolak di kolom 'cepat'.
 */
export function galatInstans(
  param: SpekParam[],
  teks: Record<string, string>,
  jumlahLilin: number,
): Record<string, string> {
  const galat: Record<string, string> = {}
  for (const spek of param) {
    const g = galatNilaiParam(spek, teks[spek.kunci] ?? '', jumlahLilin)
    if (g) galat[spek.kunci] = g
  }
  const punyaMacd = teks.cepat !== undefined && teks.lambat !== undefined
  if (punyaMacd && !galat.cepat && !galat.lambat && Number(teks.cepat) >= Number(teks.lambat)) {
    galat.cepat = 'Harus lebih kecil dari periode lambat.'
  }
  const jarak = teks.jarakMin !== undefined && teks.jarakMaks !== undefined
  if (jarak && !galat.jarakMin && !galat.jarakMaks && Number(teks.jarakMin) > Number(teks.jarakMaks)) {
    galat.jarakMin = 'Harus lebih kecil dari jarak maksimum.'
  }
  return galat
}

/**
 * Spek sebuah jenis — kurasi PAPAN atau entri katalog pustaka. Satu pintu
 * untuk KEDUANYA, karena tiga pembaca (kolom setelan, penempatan pane, menu)
 * harus mustahil berbeda pendapat soal jenis yang sama.
 *
 * `null` berarti jenis katalog yang katalognya BELUM dimuat (atau id yang
 * sudah tak ada di versi pustaka berikutnya). Pemanggilnya menggambar kosong
 * dan mencoba lagi begitu katalognya tiba — bukan melempar, karena satu
 * template usang tak boleh menjatuhkan seluruh halaman.
 */
export function spekJenis(jenis: string, katalog?: Katalog | null): SpekIndikator | null {
  const id = idPustaka(jenis)
  if (id === null) return SPEK_INDIKATOR[jenis as JenisAsli] ?? null
  const e = katalog?.get(id)
  return e ? { label: e.singkat, param: e.param, diPanelHarga: e.diPanelHarga } : null
}

/** Label layar sebuah instans indikator, LENGKAP dengan parameternya — "MA
 *  200", bukan "MA". Dengan beberapa instans jenis yang sama hidup bersamaan,
 *  label tanpa angka tak lagi bisa membedakan barisnya.
 *
 *  Instans katalog memakai nama pendek pustaka + nilai ruas ANGKA-nya (ruas
 *  berpilihan dilewati: "SuperTrend 10/3" terbaca, "SuperTrend 10/3/1"
 *  dengan 1 berarti indeks pilihan tidak). Tanpa katalog, yang tersisa
 *  id-nya sendiri — masih bisa dikenali, dan itu lebih baik daripada baris
 *  kosong. */
export function labelInstansIndikator(inst: InstansIndikator, katalog?: Katalog | null): string {
  const p = inst.param
  const id = idPustaka(inst.jenis)
  if (id !== null) {
    const e = katalog?.get(id)
    if (!e) return id
    const angka = e.param.filter((s) => !s.pilihan).map((s) => p[s.kunci]).filter((v) => v !== undefined)
    return angka.length ? `${e.singkat} ${angka.join('/')}` : e.singkat
  }
  switch (inst.jenis) {
    case 'ma': return `MA ${p.periode}`
    case 'ema': return `EMA ${p.periode}`
    case 'bb': return `BB ${p.periode}±${p.k}`
    case 'rsi': return `RSI ${p.periode}`
    case 'obv': return 'OBV'
    case 'macd': return `MACD ${p.cepat}/${p.lambat}/${p.sinyal}`
    case 'stoch': return `Stoch ${p.periodeK}/${p.smoothK}/${p.periodeD}`
    case 'stochrsi': return `StochRSI ${p.periodeRsi}/${p.periodeStoch}/${p.smoothK}/${p.smoothD}`
    case 'wpr': return `W%R ${p.periode}`
    case 'vwap': return `VWAP ${p.jangkar === 1 ? 'pekan' : 'bulan'}`
    // Jenis `p:` sudah keluar di atas; cabang ini cuma menutup tipe.
    default: return inst.jenis
  }
}

/** Satu deret yang harus digambar untuk sebuah instans. Satu instans bisa
 *  menghasilkan lebih dari satu (BB tiga pita, MACD dua garis + histogram). */
export interface GarisIndikator {
  nama: string
  nilai: Array<number | null>
  /** Digambar sebagai histogram (batang), bukan garis. */
  histogram?: boolean
  /** Garis pendamping — digambar putus-putus & lebih redup dari garis utama. */
  bantu?: boolean
}

/** Menerjemahkan satu instans jadi deret-deret siap gambar. Semua indikator
 *  masuk lewat pintu ini, jadi komponen tak perlu tahu bahwa BB menghasilkan
 *  tiga deret sementara MA cuma satu. */
export function hitungInstans(
  inst: InstansIndikator,
  tutup: number[],
  volume: number[] = [],
  /** Lilin penuh (buka/tinggi/rendah/tutup + waktu). Dibutuhkan seluruh
   *  indikator pustaka — tak satu pun bisa dihitung dari harga tutup saja.
   *  Ditaruh di ujung dan opsional supaya pemanggil lama (dan ujinya) tak
   *  berubah; tanpa lilin, hasilnya deret kosong, bukan angka tebakan. */
  lilin: LilinData[] = [],
  /** Katalog pustaka yang sudah dimuat. `null`/tak diisi berarti belum tiba —
   *  indikator pustaka menggambar kosong dan digambar ulang sendiri begitu
   *  katalognya sampai (katalog ikut jadi dependensi memo pemanggilnya). */
  katalog?: Katalog | null,
): GarisIndikator[] {
  const p = inst.param
  const label = labelInstansIndikator(inst, katalog)
  const idKatalog = idPustaka(inst.jenis)
  if (idKatalog !== null) return garisPustaka(katalog, idKatalog, label, lilin, volume, p)
  switch (inst.jenis) {
    case 'ma': return [{ nama: label, nilai: hitungMA(tutup, p.periode) }]
    case 'ema': return [{ nama: label, nilai: hitungEMA(tutup, p.periode) }]
    case 'rsi': return [{ nama: label, nilai: hitungRSI(tutup, p.periode) }]
    case 'obv': return [{ nama: label, nilai: hitungOBV(tutup, volume) }]
    case 'bb': {
      const bb = hitungBollinger(tutup, p.periode, p.k)
      return [
        { nama: label, nilai: bb.tengah },
        { nama: `${label} atas`, nilai: bb.atas, bantu: true },
        { nama: `${label} bawah`, nilai: bb.bawah, bantu: true },
      ]
    }
    case 'macd': {
      const m = hitungMACD(tutup, p.cepat, p.lambat, p.sinyal)
      return [
        { nama: label, nilai: m.macd },
        { nama: `${label} sinyal`, nilai: m.sinyal, bantu: true },
        { nama: `${label} histogram`, nilai: m.histogram, histogram: true },
      ]
    }
    // Empat berikut memakai RUMUS pustaka lewat katalog yang sama dengan
    // seluruh entri lain — yang dikurasi cuma label, nama parameter, dan
    // bawaannya. Nama ruas di sini adalah nama ruas PUSTAKA (`periodK`,
    // `lengthRSI`, `anchor`), bukan nama kolom kita: itu yang dipahami
    // `keMasukanPustaka`.
    case 'stoch':
      return garisPustaka(katalog, 'stoch', label, lilin, volume, {
        periodK: p.periodeK, smoothK: p.smoothK, periodD: p.periodeD,
      })
    case 'stochrsi':
      return garisPustaka(katalog, 'stoch-rsi', label, lilin, volume, {
        lengthRSI: p.periodeRsi, lengthStoch: p.periodeStoch, smoothK: p.smoothK, smoothD: p.smoothD,
      })
    case 'wpr':
      return garisPustaka(katalog, 'williams-r', label, lilin, volume, { length: p.periode })
    case 'vwap':
      // `jangkar` 1/2 kebetulan PERSIS indeks '1W'/'1M' di daftar pilihan
      // pustaka ['1D','1W','1M'] — dan itu memang disengaja: bawaan kita 2
      // (bulan) sekaligus menutup jebakan jangkar harian yang di data harian
      // membuat VWAP jadi harga lilin itu sendiri.
      return garisPustaka(katalog, 'vwap', label, lilin, volume, { anchor: p.jangkar })
    // Jenis `p:` sudah keluar sebelum switch; cabang ini cuma menutup tipe.
    default: return [{ nama: label, nilai: [] }]
  }
}

/**
 * Deret-deret sebuah entri katalog, siap gambar.
 *
 * Dua aturan penamaan yang menjaga legenda tetap terbaca:
 * 1. Deret yang SELURUHNYA kosong dibuang. Beberapa entri pustaka mengumumkan
 *    plot yang cuma terisi kalau sakelar opsionalnya dinyalakan (pita VWAP,
 *    divergensi RSI) — dibiarkan, legendanya penuh baris bernilai "—".
 * 2. Kalau yang tersisa cuma satu deret, namanya = label instans saja
 *    ("W%R 14"); kalau lebih, judul plot pustaka ditempel ("Stoch 14/1/3 %K").
 *
 * Deret pertama digambar penuh, sisanya `bantu` (putus-putus & lebih redup) —
 * konvensi yang sudah dipakai BB dan MACD di berkas ini.
 */
function garisPustaka(
  katalog: Katalog | null | undefined,
  id: string,
  label: string,
  lilin: LilinData[],
  volume: number[],
  masukan: Record<string, number>,
): GarisIndikator[] {
  const e = katalog?.get(id)
  if (!e || !lilin.length) return [{ nama: label, nilai: [] }]
  const pl = plotPustaka(lilin, volume, (b) => e.hitung(b, masukan))
  const isi = e.kunciPlot
    .map((kunci, i) => ({ judul: e.judulPlot[i], nilai: pl[kunci] ?? [] }))
    .filter((g) => g.nilai.some((v) => v !== null))
  if (!isi.length) return [{ nama: label, nilai: [] }]
  return isi.map((g, i) => ({
    nama: isi.length === 1 ? label : `${label} ${g.judul}`,
    nilai: g.nilai,
    ...(i > 0 ? { bantu: true } : {}),
  }))
}

/* ------------------------------------------------------------------ *
 * Pola (#tahap 5, dropdown TERPISAH dari indikator). Beda sifat dari
 * indikator dan itu sebabnya menunya dipisah: indikator menghitung satu
 * deret sepanjang data dan menggambarnya apa adanya; pola MENEMUKAN
 * KEJADIAN — nol, satu, atau belasan — lalu menggambar temuannya.
 *
 * Seluruh isi bagian ini menjelaskan APA yang ditemukan dan APA syaratnya.
 * Tidak ada, dan tidak boleh ada, kalimat saran beli/jual di sini maupun di
 * label yang diturunkan darinya.
 * ------------------------------------------------------------------ */

export type JenisPola =
  | 'doubleBottom' | 'lonjakanVolume' | 'musiman' | 'divergensi' | 'wyckoff' | 'harmonik'
export type InstansPola = Instans<JenisPola>

export interface SpekPola {
  label: string
  param: SpekParam[]
}

export const SPEK_POLA: Record<JenisPola, SpekPola> = {
  doubleBottom: {
    label: 'Double Bottom',
    param: [
      { kunci: 'jendela', label: 'Jendela pivot', bawaan: 5, min: 1, maks: 60, bulat: true },
      { kunci: 'atr', label: 'Periode ATR', bawaan: 14, min: 2, maks: 200, bulat: true, bandingLilin: true },
      { kunci: 'toleransi', label: 'Toleransi ×ATR', bawaan: 1, min: 0.05, maks: 10, bulat: false },
      { kunci: 'jarakMin', label: 'Jarak min', bawaan: 10, min: 2, maks: 2000, bulat: true },
      // 60 lilin ≈ tiga bulan bursa. Terukur atas BBCA 1.204 lilin: jarak
      // maksimum 120 dengan kedalaman minimum 2 menghasilkan 41 temuan —
      // benar menurut syaratnya, tapi terlalu padat untuk dibaca; 60 dengan
      // kedalaman 3 menghasilkan 17. Keduanya bisa diubah pengguna, ini cuma
      // titik berangkat yang masih terbaca.
      { kunci: 'jarakMaks', label: 'Jarak maks', bawaan: 60, min: 3, maks: 2000, bulat: true },
      { kunci: 'kedalamanMin', label: 'Kedalaman min ×ATR', bawaan: 3, min: 0.1, maks: 20, bulat: false },
    ],
  },
  lonjakanVolume: {
    label: 'Lonjakan Volume',
    param: [
      { kunci: 'periode', label: 'Periode rata-rata', bawaan: 20, min: 2, maks: 500, bulat: true, bandingLilin: true },
      { kunci: 'ambang', label: 'Ambang RVOL', bawaan: 1.5, min: 1, maks: 50, bulat: false },
      { kunci: 'ambangKuat', label: 'Ambang RVOL kuat', bawaan: 3, min: 1, maks: 100, bulat: false },
      { kunci: 'naikMin', label: 'Kenaikan min %', bawaan: 2, min: 0.1, maks: 50, bulat: false },
    ],
  },
  // Angka bawaannya dan alasan tiap satunya ada di kepala bagian
  // `cariDivergensi` — di sini cuma batas kolomnya.
  divergensi: {
    label: 'Divergensi',
    param: [
      { kunci: 'jendela', label: 'Jendela pivot', bawaan: 5, min: 1, maks: 60, bulat: true },
      { kunci: 'periodeK', label: 'Periode %K', bawaan: 14, min: 1, maks: 1000, bulat: true, bandingLilin: true },
      { kunci: 'smoothK', label: 'Haluskan %K', bawaan: 3, min: 1, maks: 100, bulat: true },
      { kunci: 'jarakMin', label: 'Jarak min', bawaan: 10, min: 2, maks: 2000, bulat: true },
      { kunci: 'jarakMaks', label: 'Jarak maks', bawaan: 60, min: 3, maks: 2000, bulat: true },
      { kunci: 'ayunMin', label: 'Ayun harga min %', bawaan: 3, min: 0.1, maks: 50, bulat: false },
      { kunci: 'stochMin', label: 'Selisih %K min', bawaan: 5, min: 0.5, maks: 100, bulat: false },
      { kunci: 'volJendela', label: 'Jendela volume', bawaan: 5, min: 1, maks: 200, bulat: true },
    ],
  },
  // Angka bawaannya dan alasan tiap satunya ada di kepala bagian
  // `cariWyckoff` — di sini cuma batas kolomnya.
  wyckoff: {
    label: 'Wyckoff Phase',
    param: [
      { kunci: 'pendek', label: 'MA pendek', bawaan: 20, min: 2, maks: 400, bulat: true, bandingLilin: true },
      { kunci: 'panjang', label: 'MA panjang', bawaan: 50, min: 3, maks: 800, bulat: true, bandingLilin: true },
      { kunci: 'volJendela', label: 'Jendela volume', bawaan: 20, min: 1, maks: 500, bulat: true },
      { kunci: 'fnetJendela', label: 'Jendela FNet', bawaan: 5, min: 1, maks: 200, bulat: true },
      // 3 lilin: perpotongan MA kerap berkedip sehari-dua di sekitar
      // titik silangnya, dan tiap kedipan itu menghasilkan satu "pergantian
      // fase" yang tak pernah ada. Terukur di kalibrasi — lihat kepala bagian.
      { kunci: 'minLilin', label: 'Panjang segmen min', bawaan: 3, min: 1, maks: 200, bulat: true },
    ],
  },
  // Rasio bawaannya BUKAN kolom parameter: ia tanda tangan tiap pola
  // (`RASIO_HARMONIK`), bukan selera pengguna. Yang bisa disetel cuma
  // ketelitian pencocokannya dan gerbang kewarasannya.
  harmonik: {
    label: 'Harmonic Pattern',
    param: [
      { kunci: 'jendela', label: 'Jendela pivot', bawaan: 5, min: 1, maks: 60, bulat: true },
      { kunci: 'ayunMin', label: 'Ayun zigzag min %', bawaan: 3, min: 0.1, maks: 50, bulat: false },
      { kunci: 'toleransi', label: 'Toleransi rasio', bawaan: 0.05, min: 0.005, maks: 0.5, bulat: false },
      { kunci: 'bcMin', label: 'BC/AB min', bawaan: 0.382, min: 0.05, maks: 1, bulat: false },
      { kunci: 'bcMaks', label: 'BC/AB maks', bawaan: 0.886, min: 0.1, maks: 2, bulat: false },
    ],
  },
  musiman: {
    label: 'Musiman',
    param: [{
      kunci: 'hari',
      label: 'Hari',
      bawaan: 0,
      min: 0,
      maks: 4,
      bulat: true,
      pilihan: HARI.map((nama, i) => ({ nilai: i, label: nama })),
    }],
  },
}

/** Nama pola untuk legenda. Musiman menyebut HARI yang dipilih — tanpa itu
 *  legendanya cuma berbunyi "Musiman", dan pertanyaan pertama pembacanya
 *  ("musiman apa?") justru tak terjawab oleh baris yang seharusnya
 *  menjawabnya. */
export function labelInstansPola(inst: InstansPola): string {
  const dasar = SPEK_POLA[inst.jenis].label
  return inst.jenis === 'musiman' ? `${dasar} · ${HARI[inst.param.hari] ?? '—'}` : dasar
}

/**
 * ATR (Average True Range) ala Wilder. Dipakai sebagai SATUAN JARAK di
 * seluruh pencarian pola, menggantikan toleransi persen tetap: toleransi
 * "2%" memperlakukan saham 50 rupiah (fraksi 1 = 2% penuh, satu tick sudah
 * memakan seluruh jatah) dan saham 50.000 rupiah (2% = 1.000, puluhan tick)
 * dengan dua ukuran yang salah satunya pasti keliru. ATR mengukur seberapa
 * jauh saham ITU memang biasa bergerak sehari, jadi angka parameternya
 * berarti sama di seluruh papan.
 *
 * True Range = terbesar dari (tinggi-rendah), |tinggi - tutup kemarin|,
 * |rendah - tutup kemarin| — ruas kedua & ketiga yang membuat lompatan
 * pembukaan (gap) ikut terhitung. Bibitnya rata-rata sederhana `periode` TR
 * pertama, lalu pemulusan Wilder.
 */
export function hitungATR(lilin: LilinData[], periode: number): Array<number | null> {
  const hasil: Array<number | null> = new Array(lilin.length).fill(null)
  if (lilin.length <= periode) return hasil
  const tr: number[] = []
  for (let i = 0; i < lilin.length; i++) {
    const l = lilin[i]
    if (i === 0) { tr.push(l.high - l.low); continue }
    const tutupKemarin = lilin[i - 1].close
    tr.push(Math.max(l.high - l.low, Math.abs(l.high - tutupKemarin), Math.abs(l.low - tutupKemarin)))
  }
  let jumlah = 0
  for (let i = 1; i <= periode; i++) jumlah += tr[i]
  let atr = jumlah / periode
  hasil[periode] = atr
  for (let i = periode + 1; i < lilin.length; i++) {
    atr = (atr * (periode - 1) + tr[i]) / periode
    hasil[i] = atr
  }
  return hasil
}

/**
 * Indeks pivot rendah: titik yang `jendela` lilin di kiri DAN kanannya tak
 * ada yang lebih rendah. Dua catatan yang menentukan benar-salahnya:
 *
 * 1. Jendela penuh diwajibkan di kedua sisi, jadi `jendela` lilin terakhir
 *    tak pernah jadi pivot. Itu bukan kekurangan — pivot memang baru bisa
 *    disebut pivot setelah harga terbukti berbalik, dan mengaku menemukan
 *    pivot di lilin paling kanan berarti mengaku tahu hari esok.
 * 2. Dataran datar (beberapa lilin dengan rendah yang persis sama) diambil
 *    yang PERTAMA — kiri diperiksa lebih ketat (harus benar-benar lebih
 *    tinggi) daripada kanan. Tanpa aturan pemutus ini satu dataran lima hari
 *    menghasilkan lima "lembah" yang saling berpasangan jadi pola palsu.
 */
export function cariPivotRendah(rendah: number[], jendela: number): number[] {
  const hasil: number[] = []
  for (let i = jendela; i < rendah.length - jendela; i++) {
    let pivot = true
    for (let j = i - jendela; j < i; j++) if (rendah[j] <= rendah[i]) { pivot = false; break }
    if (pivot) for (let j = i + 1; j <= i + jendela; j++) if (rendah[j] < rendah[i]) { pivot = false; break }
    if (pivot) hasil.push(i)
  }
  return hasil
}

/** Kebalikan `cariPivotRendah` — aturan dataran datar & jendela penuhnya sama. */
export function cariPivotTinggi(tinggi: number[], jendela: number): number[] {
  const hasil: number[] = []
  for (let i = jendela; i < tinggi.length - jendela; i++) {
    let pivot = true
    for (let j = i - jendela; j < i; j++) if (tinggi[j] >= tinggi[i]) { pivot = false; break }
    if (pivot) for (let j = i + 1; j <= i + jendela; j++) if (tinggi[j] > tinggi[i]) { pivot = false; break }
    if (pivot) hasil.push(i)
  }
  return hasil
}

/**
 * Status sebuah pola. Ketiganya ditampilkan, tak ada yang disembunyikan —
 * pola yang batal justru keterangan paling berguna tentang seberapa sering
 * bentuk itu tidak berlanjut.
 */
export type StatusPola = 'terbentuk' | 'terkonfirmasi' | 'batal'

export interface DoubleBottom {
  iLembah1: number
  iLembah2: number
  iLeher: number
  waktuLembah1: string
  waktuLembah2: string
  waktuLeher: string
  hargaLembah1: number
  hargaLembah2: number
  hargaLeher: number
  /** Jarak leher ke lembah terdangkal, dalam satuan ATR di lembah kedua. */
  kedalamanAtr: number
  status: StatusPola
  iKonfirmasi: number | null
  waktuKonfirmasi: string | null
  /**
   * Volume di lilin penembus leher lebih besar dari rata-rata 20 lilin
   * sebelumnya. PENGUAT, bukan syarat: dijadikan syarat wajib, ia membuang
   * pola yang bentuk harganya sudah lengkap hanya karena ruas volume hari
   * itu kebetulan sepi — dan ruas volume adalah ruas yang paling sering
   * cacat di berkas harian.
   */
  volumeMenguat: boolean
}

export interface ParamDoubleBottom {
  jendela: number
  atr: number
  toleransi: number
  jarakMin: number
  jarakMaks: number
  kedalamanMin: number
}

/** Panjang jendela pembanding volume di lilin penembus leher. Angka bulat
 *  yang lazim dipakai sebagai "rata-rata volume sebulan bursa"; dibiarkan
 *  tetap karena volumeMenguat cuma penanda tambahan, bukan syarat lolos. */
const JENDELA_VOLUME = 20

/**
 * Mencari Double Bottom: dua lembah sepadan yang dipisahkan sebuah puncak
 * (leher). Urutan saringannya sengaja dari yang paling murah ke yang paling
 * mahal, dan tiap saringan menolak sesuatu yang nyata:
 *
 * 1. Jarak antar lembah di dalam [jarakMin, jarakMaks] — dua lembah tiga
 *    lilin berjauhan itu satu ayunan yang sama, dua lembah tiga tahun
 *    berjauhan itu dua kejadian yang tak berhubungan.
 * 2. Selisih harga kedua lembah <= toleransi × ATR.
 * 3. Ada pivot TINGGI di antara keduanya (lehernya); yang tertinggi dipakai.
 * 4. Kedalaman leher ke lembah TERDANGKAL >= kedalamanMin × ATR — tanpa
 *    saringan ini, tiap riak kecil di sepanjang tren lolos sebagai pola.
 *
 * `volume` boleh array kosong (mis. di uji); tanpa volume, `volumeMenguat`
 * selalu false — itu penanda tambahan, bukan syarat.
 */
export function cariDoubleBottom(
  lilin: LilinData[],
  volume: number[],
  p: ParamDoubleBottom,
): DoubleBottom[] {
  if (lilin.length === 0) return []
  const atr = hitungATR(lilin, p.atr)
  const pivotRendah = cariPivotRendah(lilin.map((l) => l.low), p.jendela)
  const pivotTinggi = cariPivotTinggi(lilin.map((l) => l.high), p.jendela)

  // Satu lembah kedua bisa berpasangan dengan beberapa lembah pertama yang
  // sama-sama lolos. Yang disimpan cuma pasangan TERDALAM per lembah kedua:
  // menggambar semuanya berarti menumpuk garis leher yang saling menimpa di
  // wilayah yang sama, dan pembaca tak bisa lagi membedakannya.
  const terbaik = new Map<number, DoubleBottom>()

  for (let a = 0; a < pivotRendah.length; a++) {
    for (let b = a + 1; b < pivotRendah.length; b++) {
      const i1 = pivotRendah[a]
      const i2 = pivotRendah[b]
      const jarak = i2 - i1
      if (jarak < p.jarakMin) continue
      // pivotRendah menaik, jadi b berikutnya cuma makin jauh.
      if (jarak > p.jarakMaks) break

      const skala = atr[i2]
      if (skala === null || skala <= 0) continue

      const h1 = lilin[i1].low
      const h2 = lilin[i2].low
      if (Math.abs(h1 - h2) > p.toleransi * skala) continue

      let iLeher = -1
      for (const it of pivotTinggi) {
        if (it <= i1) continue
        if (it >= i2) break
        if (iLeher === -1 || lilin[it].high > lilin[iLeher].high) iLeher = it
      }
      if (iLeher === -1) continue

      const leher = lilin[iLeher].high
      const kedalaman = leher - Math.max(h1, h2)
      if (kedalaman < p.kedalamanMin * skala) continue

      // Status ditentukan dengan menyusuri lilin SESUDAH lembah kedua sampai
      // salah satu batas tersentuh lebih dulu — mana yang duluan, itu yang
      // menentukan. Tak tersentuh sama sekali berarti polanya masih berdiri.
      const dasar = Math.min(h1, h2)
      let status: StatusPola = 'terbentuk'
      let iKonfirmasi: number | null = null
      for (let i = i2 + 1; i < lilin.length; i++) {
        if (lilin[i].close > leher) { status = 'terkonfirmasi'; iKonfirmasi = i; break }
        if (lilin[i].low < dasar) { status = 'batal'; break }
      }

      let volumeMenguat = false
      if (iKonfirmasi !== null && volume.length === lilin.length) {
        const mulai = Math.max(0, iKonfirmasi - JENDELA_VOLUME)
        if (iKonfirmasi > mulai) {
          let jumlah = 0
          for (let i = mulai; i < iKonfirmasi; i++) jumlah += volume[i]
          volumeMenguat = volume[iKonfirmasi] > jumlah / (iKonfirmasi - mulai)
        }
      }

      const temuan: DoubleBottom = {
        iLembah1: i1, iLembah2: i2, iLeher,
        waktuLembah1: lilin[i1].time, waktuLembah2: lilin[i2].time, waktuLeher: lilin[iLeher].time,
        hargaLembah1: h1, hargaLembah2: h2, hargaLeher: leher,
        kedalamanAtr: kedalaman / skala,
        status, iKonfirmasi,
        waktuKonfirmasi: iKonfirmasi === null ? null : lilin[iKonfirmasi].time,
        volumeMenguat,
      }
      const lama = terbaik.get(i2)
      if (!lama || temuan.kedalamanAtr > lama.kedalamanAtr) terbaik.set(i2, temuan)
    }
  }

  return [...terbaik.values()].sort((x, y) => x.iLembah2 - y.iLembah2)
}

/* ------------------------------------------------------------------ *
 * Pola: Lonjakan Volume (`lonjakanVolume`). Johan: "tambahkan 1 pola lagi
 * volume value dimana volume naik, harga ikut naik tapi ada teknikal nya".
 *
 * Dasarnya RVOL (relative volume) — volume hari itu dibagi rata-rata volume
 * `periode` hari SEBELUMNYA. Ambang yang lazim dipakai: 1,5x sebagai batas
 * minimum konfirmasi sebuah tembusan, 3x ke atas sebagai keikutsertaan besar.
 * Rujukan: luxalgo.com/blog/how-volume-confirms-breakouts-in-trading,
 * deepvue.com/technical-analysis/volume-analysis-secrets.
 * ------------------------------------------------------------------ */

/**
 * Tiga keadaan yang ditandai, dan yang KETIGA justru yang paling berharga.
 *
 * `takTerkonfirmasi` — harga naik berarti tapi volumenya JUSTRU di bawah
 * rata-rata — wajib ada dan wajib tampil. Menampilkan hanya kenaikan yang
 * disertai volume akan membuat halaman ini jadi corong sinyal beli; yang
 * membuatnya jujur justru penanda "naiknya tak didukung volume".
 */
export type StatusLonjakan = 'terkonfirmasi' | 'kuat' | 'takTerkonfirmasi'

export interface LonjakanVolume {
  i: number
  waktu: string
  /** Volume hari itu dibagi rata-rata `periode` hari sebelumnya. */
  rvol: number
  /** Perubahan harga tutup terhadap hari sebelumnya, dalam persen. */
  ubahPersen: number
  volume: number
  rataVolume: number
  status: StatusLonjakan
}

export interface ParamLonjakanVolume {
  periode: number
  ambang: number
  ambangKuat: number
  naikMin: number
}

/**
 * Mencari hari-hari yang volumenya menonjol dibanding kebiasaannya sendiri.
 *
 * Rata-rata pembagi diambil dari `periode` hari SEBELUM hari itu, bukan
 * termasuk hari itu: dimasukkan, lonjakan hari ini ikut mengangkat
 * pembaginya sendiri dan RVOL-nya jadi lebih kecil dari yang sebenarnya —
 * makin besar lonjakannya, makin besar peredamannya.
 *
 * `lilin` dan `volume` WAJIB yang sudah tersaring `hariTanpaPerdagangan`
 * (lewat `keDataLilinVolume`). Di pola ini akibatnya lebih tajam daripada di
 * indikator: hari bervolume nol yang ikut terhitung akan MENURUNKAN
 * pembaginya dan melahirkan RVOL palsu yang besar — pola yang tak pernah
 * terjadi, dilaporkan dengan angka yang meyakinkan.
 */
export function cariLonjakanVolume(
  lilin: LilinData[],
  volume: number[],
  p: ParamLonjakanVolume,
): LonjakanVolume[] {
  const hasil: LonjakanVolume[] = []
  if (lilin.length !== volume.length) return hasil
  for (let i = Math.max(1, p.periode); i < lilin.length; i++) {
    let jumlah = 0
    for (let j = i - p.periode; j < i; j++) jumlah += volume[j]
    const rata = jumlah / p.periode
    if (rata <= 0) continue
    const rvol = volume[i] / rata
    const tutupKemarin = lilin[i - 1].close
    if (tutupKemarin <= 0) continue
    const ubahPersen = ((lilin[i].close - tutupKemarin) / tutupKemarin) * 100

    // Kenaikan harga yang BERARTI adalah syarat masuk ketiga keadaan. Tanpa
    // ambang itu, tiap kenaikan setengah tick bervolume tipis ikut ditandai
    // dan yang tersisa cuma kanvas penuh penanda tanpa isi.
    if (ubahPersen < p.naikMin) continue

    let status: StatusLonjakan
    if (rvol >= p.ambangKuat) status = 'kuat'
    else if (rvol >= p.ambang) status = 'terkonfirmasi'
    else if (rvol < 1) status = 'takTerkonfirmasi'
    // Di antara 1 dan ambang: naik, volumenya di atas rata-rata tapi belum
    // sampai ambang konfirmasi. Tak masuk keadaan mana pun — menyebutnya
    // terkonfirmasi berarti menurunkan ambang diam-diam, menyebutnya tak
    // terkonfirmasi tidak benar karena volumenya memang di atas rata-rata.
    else continue

    hasil.push({
      i, waktu: lilin[i].time, rvol, ubahPersen,
      volume: volume[i], rataVolume: rata, status,
    })
  }
  return hasil
}

/* ------------------------------------------------------------------ *
 * Pola: Divergensi tiga lapis (`divergensi`) — backlog #130, definisi Johan
 * 17 Agu 2026: *"lebih kepada teknikal analisis dimana kamu harus bisa
 * tentukan chart itu membentuk pola bearish divergent atau bullish divergen,
 * kolaborasi dengan indikator stochastic, mungkin volume lebih baik dibanding
 * umumnya."*
 *
 * APA YANG DIHITUNG, supaya pembaca berikutnya tak perlu menebak arti kata
 * "divergensi" di berkas ini. Tiga lapis, dan ketiganya punya PERAN BERBEDA:
 *
 *   Lapis 1 · HARGA   — dua pivot ayun sejenis (dua puncak atau dua lembah).
 *                        Menentukan ADA-tidaknya pola. Pivotnya dicari
 *                        `cariPivotTinggi`/`cariPivotRendah` yang sudah ada,
 *                        bukan pencari kedua.
 *   Lapis 2 · STOCHASTIC %K — dibandingkan di dua pivot yang SAMA. Yang
 *                        MENYATAKAN divergensinya: arah harga dan arah
 *                        momentum harus berlawanan.
 *   Lapis 3 · VOLUME  — PENGESAH derajat, bukan syarat lolos. Volume yang
 *                        berlawanan menurunkan derajat, tidak membatalkan.
 *
 * Regular divergence (yang klasik), dua arah:
 *   bearish — harga puncak LEBIH TINGGI, %K puncak LEBIH RENDAH.
 *   bullish — harga lembah LEBIH RENDAH, %K lembah LEBIH TINGGI.
 *
 * Volume sebagai pengesah: puncak/lembah KEDUA terjadi dengan rata-rata
 * volume LEBIH RENDAH daripada yang pertama (naik tanpa dukungan =
 * distribusi; jual yang mengering di lembah kedua).
 *
 * Empat keputusan yang diminta ditulis terang-terangan (`rencana-berjalan.md`
 * bagian #130), beserta angkanya:
 *
 * 1. Pivot: jendela ayun 5 lilin di kiri & kanan (`cariPivotTinggi`), bukan
 *    zigzag persen. Alasannya bukan selera: pencari pivot itu sudah ada,
 *    sudah diuji, dan sudah dipakai Double Bottom — pencari kedua berarti
 *    dua definisi "puncak" di satu kanvas. Ambang persennya tetap dipakai,
 *    tapi sebagai syarat AYUN antar-pivot (`ayunMin`, bawaan 3% mengikuti
 *    riset SPLE), bukan sebagai cara menemukan pivotnya.
 * 2. Stochastic 14/3/3 — bukan 14/1/3 seperti bawaan indikator Stoch di
 *    menu. %K mentah (smoothK 1) berayun penuh 0-100 tiap beberapa lilin,
 *    dan "puncak %K lebih rendah" di deret sekasar itu lebih sering
 *    kebetulan daripada tanda. Angkanya tetap milik pustaka yang sama dengan
 *    garis Stoch di menu (lihat `stochUntukDivergensi`), jadi apa yang
 *    tergambar dan apa yang dihitung pola tak bisa berselisih.
 * 3. Jarak sah antar-pivot: [`jarakMin`, `jarakMaks`] = [10, 60] lilin. Di
 *    bawah 10 keduanya masih satu ayunan yang sama; di atas 60 (± tiga bulan
 *    bursa) keduanya dua kejadian yang tak lagi berhubungan. Di LUAR rentang
 *    itu polanya DITOLAK, bukan diturunkan jadi "lemah" — temuan yang kita
 *    sendiri tak percayai lebih baik tak digambar daripada digambar samar.
 * 4. Volume dibandingkan sebagai RATA-RATA `volJendela` lilin (bawaan 5),
 *    bukan satu batang. Jendelanya menoleh ke BELAKANG (lilin ke-i mundur),
 *    bukan simetris mengelilingi pivot: jendela simetris ikut membaca lilin
 *    sesudah pivot, dan seluruh perhitungan di berkas ini wajib kausal
 *    supaya Bar replay tak menggambar pola yang sudah tahu jawabannya.
 *
 * Derajat keyakinan — `kuat`/`sedang` diputuskan lapis volume, `lemah` adalah
 * penimpa untuk pola yang cuma pas-pasan melewati ambangnya sendiri (lihat
 * `MARGIN_LEMAH`). Ketiganya ditampilkan apa adanya; ini penyajian pola,
 * BUKAN rekomendasi beli/jual.
 * ------------------------------------------------------------------ */

export type ArahDivergensi = 'bearish' | 'bullish'
export type DerajatDivergensi = 'kuat' | 'sedang' | 'lemah'

export interface Divergensi {
  arah: ArahDivergensi
  /** Indeks pivot pertama & kedua pada `lilin` (sudah tersaring). */
  i1: number
  i2: number
  waktu1: string
  waktu2: string
  /** Harga pivot: `high` untuk bearish, `low` untuk bullish. */
  harga1: number
  harga2: number
  stoch1: number
  stoch2: number
  /** Rata-rata volume `volJendela` lilin sampai pivot (inklusif). */
  volume1: number
  volume2: number
  /** Besar ayun harga antar-pivot, persen dari pivot pertama. Selalu positif. */
  ayunPersen: number
  /** `stoch2 - stoch1`. Negatif pada bearish, positif pada bullish. */
  selisihStoch: number
  volumeMendukung: boolean
  /**
   * Seberapa jauh pola ini melewati ambangnya sendiri — yang terkecil dari
   * (ayun ÷ ayunMin) dan (|selisih %K| ÷ stochMin). Selalu >= 1 karena
   * keduanya sudah jadi syarat masuk. Dipakai dua hal: memutuskan `lemah`,
   * dan memilih pasangan terbaik kalau satu pivot kedua cocok dengan
   * beberapa pivot pertama.
   */
  mutu: number
  derajat: DerajatDivergensi
}

export interface ParamDivergensi {
  jendela: number
  periodeK: number
  smoothK: number
  jarakMin: number
  jarakMaks: number
  ayunMin: number
  stochMin: number
  volJendela: number
}

/**
 * Batas `mutu` di bawah mana sebuah divergensi disebut `lemah` — "salah satu
 * pivot ragu" pada tabel derajat Johan, dinyatakan sebagai angka yang bisa
 * diperiksa: pola yang ayun harganya atau selisih momentumnya kurang dari dua
 * kali ambang minimumnya sendiri.
 *
 * 2× bukan angka bulat yang dipungut dari udara: pada ambang minimum, sebuah
 * pola berdiri di atas satu tick harga dan satu poin %K — dua besaran yang
 * sama-sama bisa berubah oleh satu lilin. Pada dua kali ambangnya, keduanya
 * butuh gerakan yang tak bisa lagi dijelaskan oleh satu lilin.
 */
const MARGIN_LEMAH = 2

/** Rata-rata volume `jendela` lilin SAMPAI `i` (inklusif). Menoleh ke
 *  belakang saja — lihat keputusan 4 di kepala bagian ini. */
function rataVolumeSampai(volume: number[], i: number, jendela: number): number {
  const mulai = Math.max(0, i - jendela + 1)
  let jumlah = 0
  for (let j = mulai; j <= i; j++) jumlah += volume[j] ?? 0
  return jumlah / (i - mulai + 1)
}

/**
 * Deret %K Stochastic untuk pola Divergensi.
 *
 * Lewat `hitungInstans` — pintu yang sama persis dengan indikator Stoch di
 * menu. Bukan kerapian: menulis rumus Stochastic kedua di berkas ini berarti
 * garis yang TERGAMBAR di panel bawah dan angka yang DIPAKAI pola boleh
 * berbeda tanpa ada yang tahu mana yang benar — persis alasan `ID_SUDAH_ADA`
 * di `katalogIndikator.ts` menolak dua RSI di satu menu.
 *
 * Katalog belum tiba (`null`) menghasilkan deret KOSONG, dan `cariDivergensi`
 * menjawabnya dengan nol temuan — bukan angka tebakan. Halaman menggambarnya
 * ulang sendiri begitu katalognya sampai, karena katalog ikut jadi dependensi
 * memo pemanggilnya.
 */
export function stochUntukDivergensi(
  lilin: LilinData[],
  volume: number[],
  p: Pick<ParamDivergensi, 'periodeK' | 'smoothK'>,
  katalog?: Katalog | null,
): Array<number | null> {
  const inst: InstansIndikator = {
    id: 'divergensi-stoch',
    jenis: 'stoch',
    // `periodeD` tak ikut disetel pengguna: pola ini cuma membaca %K, dan %D
    // tak mempengaruhi %K sama sekali. Bawaan pustaka (3) dipakai apa adanya.
    param: { periodeK: p.periodeK, smoothK: p.smoothK, periodeD: 3 },
    warna: '--text3',
    tampil: true,
  }
  return hitungInstans(inst, lilin.map((l) => l.close), volume, lilin, katalog)[0]?.nilai ?? []
}

/**
 * Mencari divergensi regular dua arah. `stoch` WAJIB sejajar indeks dengan
 * `lilin` (keluaran `stochUntukDivergensi`); deret kosong = nol temuan.
 *
 * Fungsi MURNI: tak menyentuh katalog, DOM, maupun React — seluruh masukannya
 * datang lewat argumen, jadi ia bisa diuji atas 900-an berkas OHLC di cakram
 * tanpa merender apa pun.
 *
 * Saringannya urut dari yang paling murah ke yang paling mahal, dan tiap
 * saringan menolak sesuatu yang nyata (angka bawaannya di kepala bagian ini):
 *   1. jarak antar-pivot di dalam [jarakMin, jarakMaks];
 *   2. arah harga benar DAN ayunnya >= ayunMin persen;
 *   3. arah %K berlawanan DAN selisihnya >= stochMin poin;
 *   4. volume — cuma menentukan derajat, tak pernah menolak.
 *
 * Satu pivot kedua bisa cocok dengan beberapa pivot pertama; yang disimpan
 * cuma pasangan ber-`mutu` tertinggi per pivot kedua per arah. Menggambar
 * semuanya berarti menumpuk penanda di lilin yang sama.
 */
export function cariDivergensi(
  lilin: LilinData[],
  volume: number[],
  stoch: Array<number | null>,
  p: ParamDivergensi,
): Divergensi[] {
  if (lilin.length === 0 || stoch.length !== lilin.length) return []

  const terbaik = new Map<string, Divergensi>()
  const cari = (
    arah: ArahDivergensi,
    pivot: number[],
    hargaDi: (i: number) => number,
  ) => {
    for (let b = 1; b < pivot.length; b++) {
      const i2 = pivot[b]
      const s2 = stoch[i2]
      if (s2 === null) continue
      for (let a = b - 1; a >= 0; a--) {
        const i1 = pivot[a]
        const jarak = i2 - i1
        if (jarak < p.jarakMin) continue
        // `pivot` menaik, jadi a yang lebih kecil cuma makin jauh.
        if (jarak > p.jarakMaks) break

        const s1 = stoch[i1]
        if (s1 === null) continue
        const h1 = hargaDi(i1)
        const h2 = hargaDi(i2)
        if (h1 <= 0) continue

        // Lapis 1 — arah harga. Bearish butuh puncak lebih TINGGI, bullish
        // butuh lembah lebih RENDAH; keduanya harus berayun cukup jauh.
        const naik = h2 > h1
        if (naik !== (arah === 'bearish')) continue
        const ayunPersen = (Math.abs(h2 - h1) / h1) * 100
        if (ayunPersen < p.ayunMin) continue

        // Lapis 2 — momentum harus melawan. Ini yang MENYATAKAN divergensinya.
        const selisihStoch = s2 - s1
        const melawan = arah === 'bearish' ? selisihStoch < 0 : selisihStoch > 0
        if (!melawan || Math.abs(selisihStoch) < p.stochMin) continue

        // Lapis 3 — volume. Tak pernah menolak, cuma menentukan derajat.
        const v1 = rataVolumeSampai(volume, i1, p.volJendela)
        const v2 = rataVolumeSampai(volume, i2, p.volJendela)
        const volumeMendukung = v1 > 0 && v2 < v1

        const mutu = Math.min(ayunPersen / p.ayunMin, Math.abs(selisihStoch) / p.stochMin)
        const derajat: DerajatDivergensi = mutu < MARGIN_LEMAH
          ? 'lemah'
          : volumeMendukung ? 'kuat' : 'sedang'

        const temuan: Divergensi = {
          arah, i1, i2,
          waktu1: lilin[i1].time, waktu2: lilin[i2].time,
          harga1: h1, harga2: h2,
          stoch1: s1, stoch2: s2,
          volume1: v1, volume2: v2,
          ayunPersen, selisihStoch, volumeMendukung, mutu, derajat,
        }
        const kunci = `${arah}:${i2}`
        const lama = terbaik.get(kunci)
        if (!lama || temuan.mutu > lama.mutu) terbaik.set(kunci, temuan)
      }
    }
  }

  cari('bearish', cariPivotTinggi(lilin.map((l) => l.high), p.jendela), (i) => lilin[i].high)
  cari('bullish', cariPivotRendah(lilin.map((l) => l.low), p.jendela), (i) => lilin[i].low)

  return [...terbaik.values()].sort((x, y) => x.i2 - y.i2 || x.i1 - y.i1)
}

/* ------------------------------------------------------------------ *
 * Pola: Musiman hari-dalam-pekan (`musiman`). Johan 18 Agu 2026: "berikan
 * pola di chart untuk bisa insert seasonality, misal hari senin kan tinggi si
 * BBCA nah di chart nya muncul misal tampilkan selasa, berarti menunjuka ke
 * candle selasa".
 *
 * TIDAK menghitung apa pun sendiri — seluruh angkanya datang dari
 * `ringkasHarian` di `lib/seasonality.ts`, sumber yang sama dengan halaman
 * /seasonality. Kalau kanvas ini menghitung versinya sendiri, dua halaman bisa
 * menyebut angka berbeda untuk hal yang persis sama, dan begitu itu terjadi
 * keduanya berhenti bisa dipercaya — bukan salah satunya.
 * ------------------------------------------------------------------ */

/** 0=Senin … 4=Jumat; akhir pekan menghasilkan -1 atau 5 (tak pernah cocok
 *  dengan hari pilihan yang selalu 0-4). UTC, sama dengan `ringkasHarian` —
 *  waktu lokal akan menggeser tanggal satu hari di zona timur GMT dan penanda
 *  "Selasa" akan jatuh di lilin Senin. */
export function hariPekan(tgl: string): number {
  // `slice(0, 10)` supaya waktu intraday ('2026-08-18 09:30') ikut terbaca —
  // tanpa itu `new Date('2026-08-18 09:30T00:00:00Z')` jadi Invalid Date dan
  // seluruh penanda musiman lenyap tanpa satu pun galat.
  return new Date(`${tgl.slice(0, 10)}T00:00:00Z`).getUTCDay() - 1
}

export interface TemuanMusiman {
  /** 0=Senin … 4=Jumat. */
  hari: number
  /** Ringkasan hari itu APA ADANYA dari `ringkasHarian` — n, peluang mentah,
   *  peluang tersusut, selang Wilson, median, rata-rata, kumulatif. */
  ringkas: RingkasHari
  /** Vonis uji permutasi hari-dalam-pekan; berlaku untuk POLA HARIAN emiten
   *  secara keseluruhan, bukan khusus hari yang dipilih (yang diuji: "apakah
   *  harinya penting sama sekali"). */
  vonis: { kuat: boolean; teks: string }
  /** Seluruh observasi harian di rentang ini, lima hari digabung — pembanding
   *  yang membuat `ringkas.n` bisa dinilai tipis atau tidaknya. */
  totalObservasi: number
  /** Tanggal lilin yang jatuh di hari itu DAN punya imbal (lilin pertama tak
   *  punya hari sebelumnya, jadi tak terhitung — sama persis dengan aturan
   *  `ringkasHarian`, supaya jumlah penanda di kanvas = `ringkas.n`). */
  waktu: string[]
}

/**
 * Ringkasan musiman satu hari, DIHITUNG DARI LILIN YANG SEDANG TERGAMBAR.
 *
 * Keputusan rentang — dan alasannya, karena dua-duanya masuk akal:
 *
 * Pilihan yang diambil: rentang perhitungan = SELURUH lilin yang dimuat,
 * yaitu `lilin` yang dikirim ke sini. Alasannya satu dan menentukan: penanda
 * musiman duduk DI ATAS lilin-lilin itu, dan tooltipnya menyebut sebuah
 * angka. Kalau angkanya dihitung dari rentang lain, pembaca melihat penanda
 * pada 240 lilin sambil membaca statistik dari 1.200 lilin yang tak ada di
 * deret — dan tak ada apa pun di antarmuka yang bisa memberitahunya.
 *
 * Dulu rentang itu mengikuti chip kaki, karena chip kaki memotong deretnya di
 * hulu. Pemotongan itu sudah dibuang (chip = jendela pandang, bukan potongan
 * data), jadi yang tersisa cuma satu deret dan satu angka — dan hubungan
 * "yang tergambar = yang tertulis" justru jadi lebih rapat, bukan longgar.
 *
 * Yang ditolak: mengikuti JENDELA ZOOM. Zoom berubah tiap kali pembaca
 * menggeser grafik, dan statistik yang angkanya bergoyang selagi digeser
 * mengundang orang berhenti di jendela yang angkanya paling disukai.
 *
 * `null` kalau lilinnya terlalu sedikit untuk menghasilkan satu imbal pun.
 */
export function cariMusiman(lilin: LilinData[], hari: number): TemuanMusiman | null {
  if (lilin.length < 2) return null
  // Kerangka waktu INTRADAY ditolak, bukan dihitung diam-diam. `ringkasHarian`
  // memakai kunci tanggal: dengan lilin 5 menit, 78 lilin satu hari yang sama
  // saling menimpa di satu kunci dan yang tersisa cuma lilin terakhir tiap
  // hari — angkanya tetap keluar, tetap terlihat masuk akal, dan menjawab
  // pertanyaan yang sama sekali berbeda dari yang ditanyakan. Kegagalan senyap
  // persis seperti yang dilarang CLAUDE.md; jadi dijegal di sini, bukan di
  // salah satu pemanggilnya.
  if (lilin.some((l) => l.time.length > 10)) return null
  const tutup: Record<string, number> = {}
  for (const l of lilin) tutup[l.time] = l.close
  // Tanpa batas tanggal: `lilin` SUDAH dipotong ke rentang chip di pemanggil.
  // Memotongnya lagi di sini berarti dua tempat yang harus sepakat soal batas.
  const r = ringkasHarian('', tutup)
  const ringkas = r?.perHari[hari]
  if (!r || !ringkas) return null
  const waktu: string[] = []
  for (let i = 1; i < lilin.length; i++) {
    if (!(lilin[i - 1].close > 0)) continue
    if (hariPekan(lilin[i].time) === hari) waktu.push(lilin[i].time)
  }
  return { hari, ringkas, vonis: vonisUji(r.uji), totalObservasi: r.totalObservasi, waktu }
}

/* ------------------------------------------------------------------ *
 * Pola: Wyckoff Phase (`wyckoff`). Johan 20 Agu 2026: "Wyckoff Phase &
 * Harmonic ... di SPLE ada itu". Spek mengikatnya `docs/spek-indikator.md`
 * Grup 3 — enam fase dengan urutan yang sudah ditetapkan di sana:
 * Akumulasi → Markup Awal → Markup → Konsolidasi → Markdown Awal → Markdown.
 *
 * Kenapa DUA SUMBU, bukan daftar aturan berurutan seperti SPLE. Panduan
 * mereka mendaftar enam kondisi yang saling tumpang tindih dan dua di
 * antaranya bernama sama dalam dua bahasa ("Markdown Early" dan "Markdown
 * Awal"); daftar semacam itu tidak menjawab lilin yang memenuhi dua syarat
 * sekaligus, dan jawabannya jadi bergantung pada urutan `if` — hal yang tak
 * terlihat sama sekali dari layar. Di sini fasenya diturunkan dari perkalian
 * dua sumbu yang masing-masing eksklusif dan bersama-sama menutup seluruh
 * kemungkinan, jadi TIAP lilin ber-MA lengkap dapat tepat satu fase:
 *
 *   |            | MA20 > MA50 (struktur naik) | MA20 <= MA50 (struktur turun) |
 *   | harga > keduanya | Markup                | Markup Awal                   |
 *   | harga di antara  | (lihat FNet di bawah) | (lihat FNet di bawah)         |
 *   | harga < keduanya | Markdown Awal         | Markdown                      |
 *
 * Dibaca melingkar, itu persis siklus yang sudah tertulis di spek: dasar
 * terbentuk saat MA masih turun (Akumulasi), harga menembus ke atas lebih
 * dulu daripada MA-nya menyusul (Markup Awal), keduanya sejalan (Markup),
 * harga mundur ke pita sementara MA masih naik (Konsolidasi), harga jatuh di
 * bawah keduanya (Markdown Awal), lalu MA menyusul turun (Markdown).
 *
 * PERAN FNet — dan batasnya, disebut di muka. Pita tengah (harga di antara
 * kedua MA) memang ambigu; di situlah SPLE memakai arah aliran asing, dan
 * kita mengikutinya: jumlah net asing `fnetJendela` lilin ke belakang positif
 * = Akumulasi, negatif = Konsolidasi. Yang WAJIB diingat: berkas `asing/`
 * mulai 2020 sementara `ohlc/` mulai 2016, jadi ada lilin yang FNet-nya tak
 * pernah ada. Untuk lilin itu penentunya jatuh ke struktur MA (naik →
 * Konsolidasi, turun → Akumulasi) — bukan fase "tak diketahui". Ruas
 * `fnetDipakai` menyimpan mana dari dua jalan itu yang terpakai, supaya
 * pembaca tak perlu menebak apakah sebuah label lahir dari data asing atau
 * dari cadangannya.
 *
 * Volume TIDAK ikut menentukan fase (SPLE memakainya sebagai syarat Markup).
 * Ia dilaporkan sebagai RVOL segmen — penguat yang bisa dibaca, bukan
 * saringan yang diam-diam memindahkan sebuah Markup jadi Markup Awal hanya
 * karena ruas volume hari itu sepi. Alasan yang sama dipakai `volumeMenguat`
 * di Double Bottom.
 *
 * Keluarannya SEGMEN (runtun lilin berfase sama), bukan label per lilin: 2.470
 * lilin BBCA akan jadi 2.470 penanda yang mustahil dibaca, sementara yang
 * ditanyakan pembaca sebenarnya "kapan fasenya berganti".
 *
 * KALIBRASI 20 Agu 2026 atas 963 berkas `ohlc/` (1.460.195 lilin ber-MA
 * lengkap), bawaan 20/50/20/5. Sebaran per lilin — Akumulasi 12,8% · Markup
 * Awal 8,4% · Markup 23,8% · Konsolidasi 10,2% · Markdown Awal 9,1% ·
 * Markdown 35,8%. Tak satu pun fase memakan >60% dan yang paling jarang pun
 * masih 8,4%, jadi keenamnya benar-benar terpakai. Markdown yang paling besar
 * bukan cacat ambang: sebagian besar papan IDX memang berada di bawah kedua
 * MA-nya sepanjang 2016-2026, dan ambang yang meratakan angka itu justru akan
 * memaksakan cerita yang tak ada di datanya. Pita tengah berisi 335.569 lilin
 * dan 54,2% di antaranya dilabeli FNet, sisanya cadangan struktur MA (915 dari
 * 963 emiten punya berkas `asing/`, dan berkas itu mulai 2020 sementara OHLC
 * mulai 2016). Segmen rata-rata 9,2 lilin pada `minLilin` 3.
 * ------------------------------------------------------------------ */

export type FaseWyckoff =
  | 'akumulasi' | 'markupAwal' | 'markup' | 'konsolidasi' | 'markdownAwal' | 'markdown'

/** Urutan siklus, dipakai legenda & daftar supaya keenamnya selalu tampil
 *  dalam urutan yang sama dengan spek — bukan urutan abjad. */
export const URUT_FASE: FaseWyckoff[] = [
  'akumulasi', 'markupAwal', 'markup', 'konsolidasi', 'markdownAwal', 'markdown',
]

export interface SegmenWyckoff {
  fase: FaseWyckoff
  iMulai: number
  iAkhir: number
  waktuMulai: string
  waktuAkhir: string
  /** Jumlah lilin di segmen ini. */
  panjang: number
  /** Harga tutup, MA pendek, dan MA panjang di lilin PERTAMA segmen — tiga
   *  angka yang menghasilkan labelnya, supaya bisa diperiksa ulang. */
  harga: number
  maPendek: number
  maPanjang: number
  /** Volume rata-rata segmen dibagi rata-rata `volJendela` lilin sampai lilin
   *  sebelum segmen (menoleh ke belakang). 0 kalau pembaginya nol. */
  rvol: number
  /** Jumlah net asing (LEMBAR, bukan rupiah) `fnetJendela` lilin sampai lilin
   *  pertama segmen. `null` = berkas asing tak punya lilin itu. */
  fnet: number | null
  /** Benar kalau label pita tengah ditentukan FNet; salah kalau jatuh ke
   *  cadangan struktur MA. Selalu salah untuk fase di luar pita. */
  fnetDipakai: boolean
}

export interface ParamWyckoff {
  pendek: number
  panjang: number
  volJendela: number
  fnetJendela: number
  minLilin: number
}

/**
 * Fase satu lilin. Dipisah dari `cariWyckoff` supaya aturannya bisa diuji
 * langsung atas enam kombinasi sumbu tanpa merakit deret.
 *
 * `fnet` null ATAU nol jatuh ke cadangan struktur MA — nol bukan "seimbang
 * yang berarti", ia hampir selalu berarti hari itu tak ada catatan asingnya.
 */
export function faseWyckoffDi(
  harga: number,
  maPendek: number,
  maPanjang: number,
  fnet: number | null,
): { fase: FaseWyckoff; fnetDipakai: boolean } {
  const strukturNaik = maPendek > maPanjang
  const atas = Math.max(maPendek, maPanjang)
  const bawah = Math.min(maPendek, maPanjang)
  if (harga > atas) return { fase: strukturNaik ? 'markup' : 'markupAwal', fnetDipakai: false }
  if (harga < bawah) return { fase: strukturNaik ? 'markdownAwal' : 'markdown', fnetDipakai: false }
  if (fnet !== null && fnet !== 0) {
    return { fase: fnet > 0 ? 'akumulasi' : 'konsolidasi', fnetDipakai: true }
  }
  return { fase: strukturNaik ? 'konsolidasi' : 'akumulasi', fnetDipakai: false }
}

/**
 * Membagi `lilin` jadi segmen berfase sama.
 *
 * Fungsi MURNI: seluruh masukannya lewat argumen — tak menyentuh jaringan,
 * DOM, maupun React, jadi bisa dijalankan atas 900-an berkas OHLC di cakram
 * untuk mengukur sebaran fasenya.
 *
 * KAUSAL di tiap lilin: `hitungMA` menoleh ke belakang, rata-rata volume
 * pembanding memakai `rataVolumeSampai` (menoleh ke belakang, alasannya di
 * kepala bagian Divergensi), dan jumlah FNet dijumlah mundur dari lilin
 * pertama segmen. Satu-satunya ruas yang membaca ke depan adalah `iAkhir` —
 * dan itu memang artinya: "segmen ini bertahan sampai di sini", pernyataan
 * tentang lilin yang sudah lewat. Pada deret terpotong, segmen terakhir cuma
 * berakhir lebih awal; fase tiap lilin di dalamnya tak berubah.
 *
 * `fnet` boleh lebih pendek/kosong — indeks yang tak ada dibaca `null` dan
 * seluruh pita tengah jatuh ke cadangan struktur MA.
 */
export function cariWyckoff(
  lilin: LilinData[],
  volume: number[],
  fnet: Array<number | null>,
  p: ParamWyckoff,
): SegmenWyckoff[] {
  if (lilin.length === 0 || p.pendek >= p.panjang) return []
  const tutup = lilin.map((l) => l.close)
  const maPendek = hitungMA(tutup, p.pendek)
  const maPanjang = hitungMA(tutup, p.panjang)

  /** Jumlah net asing `fnetJendela` lilin sampai `i` (inklusif). `null` kalau
   *  tak ada satu pun lilin bercatatan asing di jendela itu — dibedakan dari
   *  nol, yang berarti beli dan jualnya kebetulan seimbang. */
  const fnetSampai = (i: number): number | null => {
    let jumlah = 0
    let ada = false
    for (let j = Math.max(0, i - p.fnetJendela + 1); j <= i; j++) {
      const v = fnet[j]
      if (v === null || v === undefined) continue
      jumlah += v
      ada = true
    }
    return ada ? jumlah : null
  }

  const hasil: SegmenWyckoff[] = []
  let mulai = -1
  let fase: FaseWyckoff | null = null
  let fnetDipakai = false

  const tutupSegmen = (akhir: number) => {
    if (mulai < 0 || fase === null) return
    const panjang = akhir - mulai + 1
    if (panjang < p.minLilin) return
    let jumlahVol = 0
    for (let j = mulai; j <= akhir; j++) jumlahVol += volume[j] ?? 0
    const dasar = mulai > 0 ? rataVolumeSampai(volume, mulai - 1, p.volJendela) : 0
    hasil.push({
      fase,
      iMulai: mulai,
      iAkhir: akhir,
      waktuMulai: lilin[mulai].time,
      waktuAkhir: lilin[akhir].time,
      panjang,
      harga: lilin[mulai].close,
      maPendek: maPendek[mulai] as number,
      maPanjang: maPanjang[mulai] as number,
      rvol: dasar > 0 ? (jumlahVol / panjang) / dasar : 0,
      fnet: fnetSampai(mulai),
      fnetDipakai,
    })
  }

  for (let i = 0; i < lilin.length; i++) {
    const a = maPendek[i]
    const b = maPanjang[i]
    if (a === null || b === null) continue
    const kini = faseWyckoffDi(lilin[i].close, a, b, fnetSampai(i))
    if (kini.fase !== fase) {
      tutupSegmen(i - 1)
      mulai = i
      fase = kini.fase
      fnetDipakai = kini.fnetDipakai
    }
  }
  tutupSegmen(lilin.length - 1)
  return hasil
}

/* ------------------------------------------------------------------ *
 * Pola: Harmonic Pattern (`harmonik`). Spek `docs/spek-indikator.md` Grup 4 —
 * ditiru dari SPLE dengan DUA koreksi yang sudah diputuskan dan tidak boleh
 * dibatalkan diam-diam:
 *
 *   1. Butterfly memakai standar Carney AD/XA 1,27-1,618. Panduan SPLE sendiri
 *      tak konsisten: bagian Modal menulis 127-161,8%, bagian Screener menulis
 *      1,27-1,42. Yang sempit membuang Butterfly sah yang D-nya melewati 1,42.
 *   2. BC/AB divalidasi 0,382-0,886 LEBIH DULU, sebelum rasio pola diperiksa.
 *      Tanpa gerbang itu muncul "pola" berrasio 4,8x dan 7,4x — mustahil
 *      secara definisi, karena BC adalah KOREKSI atas AB dan koreksi tak bisa
 *      lebih panjang dari yang dikoreksinya. Itu bug yang mereka perbaiki
 *      sendiri (34 pola turun jadi 17). Gerbang ini sekaligus yang menjamin C
 *      tak melewati A, jadi tak perlu syarat geometri terpisah.
 *
 * Yang TIDAK ditiru: jendela 108 hari. Itu batas riwayat mereka, bukan aturan
 * pola; kita punya 10 tahun dan polanya dicari di seluruh rentang tergambar.
 *
 * Fungsi MURNI, seluruh masukan lewat argumen — bisa diuji atas berkas cakram
 * tanpa merender apa pun. KAUSAL: pivot mewajibkan jendela penuh di kedua
 * sisi (lihat `cariPivotRendah`), jadi D tak pernah jatuh di lilin paling
 * kanan dan tiap rasio cuma dihitung dari lima titik yang semuanya sudah
 * lewat.
 *
 * KALIBRASI 20 Agu 2026 atas 963 berkas `ohlc/` (1.505.030 lilin), bawaan
 * jendela 5 · ayun 3% · toleransi 0,05. Corongnya: 131.764 titik zigzag →
 * 128.104 jendela XABCD diperiksa → 2.827 yang rasio polanya cocok → **1.090
 * lolos gerbang BC/AB**, yaitu **0,07 pola per 100 lilin**, tersebar di 597
 * dari 963 emiten.
 *
 * Angka itu memang jauh di bawah Divergensi (2,83) dan Double Bottom (2,43),
 * dan sebabnya bukan ambang yang kelewat ketat melainkan bentuk syaratnya:
 * dua pola itu menuntut DUA kondisi atas DUA pivot, harmonic menuntut EMPAT
 * rasio jatuh bersamaan atas LIMA pivot. Dari 128.104 jendela yang diperiksa,
 * cuma 2,2% rasionya cocok dengan pola mana pun. SPLE sendiri menuliskan hal
 * yang sama tentang hasil mereka: "pola harmonic memang formasi langka, bukan
 * target 'selalu ketemu'". Menaikkan toleransi ke 0,12 memang membawanya ke
 * 0,28 per 100 lilin — tapi pada lebar segitu pita Gartley (AD 0,786) dan Bat
 * (AD 0,886) saling bersentuhan dan namanya berhenti berarti.
 *
 * Bukti kedua koreksi, terukur, bukan sekadar tercatat:
 *   - GERBANG BC/AB membuang **1.737 dari 2.827** kandidat (61,4%) — sebanding
 *     dengan bug yang SPLE perbaiki sendiri (34 → 17). Dan memang ada yang
 *     harus dibuang: BC/AB terbesar yang muncul di zigzag papan IDX **486,8x**,
 *     dengan 56.273 kaki ber-BC/AB > 1. "Koreksi" yang lebih panjang dari yang
 *     dikoreksinya bukan koreksi.
 *   - BUTTERFLY CARNEY menghasilkan 446 pola; dengan ambang Screener SPLE
 *     (AD <= 1,42) tinggal 291. **155 Butterfly sah akan hilang** kalau angka
 *     mereka yang dipakai — jadi koreksi 1 berpengaruh nyata, bukan formalitas.
 *
 * Ayun zigzag nyaris tak menggeser hasil (2% → 1.106 pola, 3% → 1.090, 5% →
 * 1.050, 8% → 858): gerbang BC/AB sudah lebih dulu membuang riak kecil, jadi
 * 3% dipakai apa adanya sesuai spek dan tetap bisa disetel pengguna.
 * ------------------------------------------------------------------ */

export type PolaHarmonik = 'gartley' | 'bat' | 'crab' | 'butterfly'
export type ArahHarmonik = 'bullish' | 'bearish'

/** Titik zigzag: pivot yang sudah dipaksa berselang-seling tinggi-rendah dan
 *  ayunannya sudah melewati ambang minimum. */
export interface TitikZigzag {
  i: number
  harga: number
  jenis: 'tinggi' | 'rendah'
}

export interface Harmonik {
  pola: PolaHarmonik
  arah: ArahHarmonik
  /** Indeks kelima titik pada `lilin`, urut X-A-B-C-D. */
  indeks: [number, number, number, number, number]
  waktu: [string, string, string, string, string]
  harga: [number, number, number, number, number]
  /** AB/XA — kedalaman koreksi pertama. */
  ab: number
  /** BC/AB — gerbang kewarasan, wajib di dalam [bcMin, bcMaks]. */
  bc: number
  /** CD/BC — dilaporkan saja, tak dipakai menyaring (spek tak menyebutnya). */
  cd: number
  /** AD/XA — tanda tangan polanya; >1 berarti D melewati X. */
  ad: number
  /**
   * Simpangan terbesar (dalam satuan rasio) dari pita nominal pola ini, 0
   * kalau kedua rasio jatuh persis di dalamnya. Dipakai memilih pola terbaik
   * saat satu XABCD cocok dengan lebih dari satu nama.
   */
  simpangan: number
}

export interface ParamHarmonik {
  jendela: number
  ayunMin: number
  toleransi: number
  bcMin: number
  bcMaks: number
}

/**
 * Pita rasio nominal tiap pola. Nilai titik ditulis sebagai pita ber-lebar
 * nol dan dilebarkan `toleransi` saat dicocokkan — jadi ada SATU aturan
 * pencocokan, bukan satu untuk nilai titik dan satu lagi untuk rentang.
 */
export const RASIO_HARMONIK: Record<PolaHarmonik, { ab: [number, number]; ad: [number, number] }> = {
  gartley: { ab: [0.618, 0.618], ad: [0.786, 0.786] },
  bat: { ab: [0.382, 0.500], ad: [0.886, 0.886] },
  crab: { ab: [0.382, 0.618], ad: [1.618, 1.618] },
  // Carney, bukan 1,27-1,42 versi Screener SPLE — lihat koreksi 1 di atas.
  butterfly: { ab: [0.786, 0.786], ad: [1.270, 1.618] },
}

/** Jarak sebuah rasio ke luar pitanya, 0 kalau di dalam. */
function simpanganPita(r: number, [lo, hi]: [number, number]): number {
  return r < lo ? lo - r : r > hi ? r - hi : 0
}

/**
 * Zigzag: pivot tinggi & rendah yang dipaksa berselang-seling, dengan ayunan
 * minimal `ayunMin` persen antar titik berturutan.
 *
 * Dua aturan yang menentukan benar-salahnya, dan keduanya lahir dari
 * kegagalan yang nyata kalau dilanggar:
 *
 *   1. Dua pivot sejenis berturutan TIDAK dua-duanya diambil — yang lebih
 *      ekstrem menggantikan yang lain. Diambil dua-duanya, "XABCD" bisa
 *      berisi dua puncak berurutan tanpa lembah di antaranya, dan AB-nya
 *      bukan koreksi apa pun.
 *   2. Ayunan yang terlalu kecil DIBUANG, bukan diterima sebagai titik. Riak
 *      1% di tengah tren menghasilkan puluhan titik palsu dan lewat itu
 *      ratusan kandidat pola yang rasionya kebetulan pas.
 *
 * Pivot-nya dari `cariPivotTinggi`/`cariPivotRendah` — pencari pivot yang
 * sama dengan Double Bottom & Divergensi. Pencari ketiga berarti tiga
 * definisi "lembah" yang boleh berbeda tanpa ada yang tahu mana yang benar.
 */
export function zigzagPivot(lilin: LilinData[], jendela: number, ayunMin: number): TitikZigzag[] {
  const calon: TitikZigzag[] = [
    ...cariPivotTinggi(lilin.map((l) => l.high), jendela)
      .map((i) => ({ i, harga: lilin[i].high, jenis: 'tinggi' as const })),
    ...cariPivotRendah(lilin.map((l) => l.low), jendela)
      .map((i) => ({ i, harga: lilin[i].low, jenis: 'rendah' as const })),
  ].sort((a, b) => a.i - b.i)

  const out: TitikZigzag[] = []
  for (const t of calon) {
    const akhir = out[out.length - 1]
    if (!akhir) { out.push(t); continue }
    if (akhir.jenis === t.jenis) {
      const lebihEkstrem = t.jenis === 'tinggi' ? t.harga > akhir.harga : t.harga < akhir.harga
      if (lebihEkstrem) out[out.length - 1] = t
      continue
    }
    if (akhir.harga <= 0) continue
    const ayun = (Math.abs(t.harga - akhir.harga) / akhir.harga) * 100
    if (ayun >= ayunMin) out.push(t)
  }
  return out
}

/**
 * Mencari Gartley / Bat / Crab / Butterfly pada zigzag.
 *
 * Urutan saringannya dari yang paling murah ke yang paling mahal, dan tiap
 * saringan menolak sesuatu yang nyata:
 *   1. lima titik berselang-seling dengan D bertipe benar (rendah = bullish);
 *   2. panjang tiap kaki > 0 — kaki nol membuat rasionya tak berhingga;
 *   3. GERBANG BC/AB di dalam [bcMin, bcMaks] — koreksi 2 di kepala bagian;
 *   4. AB/XA dan AD/XA di dalam pita polanya, dilebarkan `toleransi`.
 *
 * Satu XABCD yang cocok dengan lebih dari satu nama disimpan sekali saja,
 * dengan nama ber-`simpangan` terkecil: Gartley (AD 0,786) dan Bat (AD 0,886)
 * pitanya bersentuhan pada toleransi lebar, dan menggambar keduanya di lima
 * lilin yang sama cuma menumpuk penanda tanpa menambah keterangan.
 */
export function cariHarmonik(lilin: LilinData[], p: ParamHarmonik): Harmonik[] {
  const zz = zigzagPivot(lilin, p.jendela, p.ayunMin)
  const hasil: Harmonik[] = []

  for (let k = 0; k + 4 < zz.length; k++) {
    const [X, A, B, C, D] = zz.slice(k, k + 5)
    const arah: ArahHarmonik = D.jenis === 'rendah' ? 'bullish' : 'bearish'

    const XA = Math.abs(A.harga - X.harga)
    const AB = Math.abs(B.harga - A.harga)
    const BC = Math.abs(C.harga - B.harga)
    const CD = Math.abs(D.harga - C.harga)
    const AD = Math.abs(D.harga - A.harga)
    if (XA <= 0 || AB <= 0 || BC <= 0) continue

    const bc = BC / AB
    if (bc < p.bcMin || bc > p.bcMaks) continue

    const ab = AB / XA
    const ad = AD / XA
    let terbaik: { pola: PolaHarmonik; simpangan: number } | null = null
    for (const nama of Object.keys(RASIO_HARMONIK) as PolaHarmonik[]) {
      const pita = RASIO_HARMONIK[nama]
      const s = Math.max(simpanganPita(ab, pita.ab), simpanganPita(ad, pita.ad))
      if (s > p.toleransi) continue
      if (!terbaik || s < terbaik.simpangan) terbaik = { pola: nama, simpangan: s }
    }
    if (!terbaik) continue

    hasil.push({
      pola: terbaik.pola,
      arah,
      indeks: [X.i, A.i, B.i, C.i, D.i],
      waktu: [lilin[X.i].time, lilin[A.i].time, lilin[B.i].time, lilin[C.i].time, lilin[D.i].time],
      harga: [X.harga, A.harga, B.harga, C.harga, D.harga],
      ab, bc, cd: CD / BC, ad,
      simpangan: terbaik.simpangan,
    })
  }
  return hasil
}

/**
 * Penanda pola yang harus disebut tooltip saat kursor berada di `waktu`.
 *
 * Kenapa ini bukan sekadar `peta.get(waktu)`: penanda pola duduk di lilin
 * yang bisa berdempetan (lembah 2 dan penembusan lehernya kerap cuma
 * berjarak satu-dua lilin), dan pada rentang bertahun-tahun satu lilin
 * lebarnya kurang dari satu piksel. Crosshair lightweight-charts menempel ke
 * SATU lilin, jadi tooltip yang cuma membaca lilin itu akan diam-diam
 * menyembunyikan penanda tetangganya yang secara visual tepat di bawah
 * kursor — persis "menang-menangan" yang harus dihindari. `radius` diukur
 * dalam INDEKS LILIN, bukan hari kalender: hari libur bursa tak boleh
 * melebarkan jangkauan tooltip.
 *
 * Waktu yang tak ada di `indeksWaktu` (mis. penanda dari rentang yang sudah
 * dipotong) mengembalikan daftar kosong, bukan melempar.
 */
export function penandaDiSekitar<T extends { time: string }>(
  penanda: T[],
  indeksWaktu: Map<string, number>,
  waktu: string,
  radius = 1,
): T[] {
  const pusat = indeksWaktu.get(waktu)
  if (pusat === undefined) return []
  return penanda.filter((p) => {
    const i = indeksWaktu.get(p.time)
    return i !== undefined && Math.abs(i - pusat) <= radius
  })
}

/* ------------------------------------------------------------------ *
 * Template (#tahap 5). Susunan indikator + pola disimpan dengan nama dan
 * bisa dimuat kembali; satu di antaranya boleh ditandai BAWAAN dan dimuat
 * sendiri saat halaman dibuka. Johan: "ada fungsi simpan nya juga, buat
 * template juga sewaktu-waktu di buka bisa load otomatis template tersebut".
 *
 * Disimpan di localStorage, BUKAN Supabase. Ini preferensi tampilan, bukan
 * data bersama: menaruhnya di server menambah satu tabel, satu set aturan
 * RLS, dan satu jalur galat jaringan baru demi sesuatu yang tak perlu
 * berpindah perangkat — dan halaman jadi bisa gagal memuat susunan grafik
 * hanya karena jaringan sedang buruk. Kalau kelak memang perlu ikut akun,
 * yang berganti cukup LAPIS PENYIMPANANNYA: `bacaTemplateTersimpan` dan
 * `tulisTemplateTersimpan` di bawah adalah satu-satunya dua fungsi yang tahu
 * di mana datanya duduk; seluruh aturan pengelolaannya sudah murni dan tak
 * perlu disentuh.
 * ------------------------------------------------------------------ */

export const VERSI_TEMPLATE = 1
export const KUNCI_TEMPLATE = 'papan:grafik-template'

/**
 * Satu template.
 *
 * Yang TIDAK disimpan sama pentingnya dengan yang disimpan: **kode emiten
 * tidak pernah masuk ke sini**. Johan menegaskan bentuknya lewat cara
 * memakainya — "sewaktu-waktu buka lagi itu tinggal ganti saham nya" — jadi
 * satu template "Modelku" harus bisa dipakai untuk BBCA hari ini dan TLKM
 * besok tanpa disimpan ulang. Template yang membawa kode emiten akan
 * memindahkan pembaca ke saham lain tiap kali dimuat, dan itu kebalikan dari
 * yang diminta.
 *
 * `jenisChart` dan `rentang` opsional supaya template yang tersimpan sebelum
 * kedua ruas ini ada tetap terbaca — dilewatkan ke nilai bawaan, bukan
 * ditolak. Menaikkan versi demi dua ruas tambahan akan membuang seluruh
 * template yang sudah dibuat orang, dan itu harga yang jauh lebih mahal.
 */
export interface TemplateGrafik {
  versi: number
  nama: string
  bawaan: boolean
  indikator: InstansIndikator[]
  pola: InstansPola[]
  jenisChart?: string
  rentang?: string
}

function instansSah<J extends string>(v: unknown, jenisDikenal: readonly string[]): v is Instans<J> {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.warna !== 'string' || typeof o.tampil !== 'boolean') return false
  // Jenis yang tak dikenal HARUS ditolak di sini. Dibiarkan lewat, ia baru
  // meledak jauh kemudian saat spek parameternya dicari dan tak ada —
  // menjatuhkan seluruh halaman demi satu baris template usang.
  // Jenis katalog (`p:<id>`) lolos tanpa dicocokkan ke daftar: katalognya
  // dimuat belakangan (impor dinamis), jadi menuntutnya ada DI SINI berarti
  // membuang seluruh template berisi indikator pustaka setiap kali halaman
  // dibuka. Id yang sudah tak ada di versi pustaka berikutnya berakhir sebagai
  // satu baris legenda tanpa garis, bukan sebagai halaman yang jatuh —
  // `spekJenis` & `garisPustaka` sudah menanganinya.
  if (typeof o.jenis !== 'string') return false
  if (!o.jenis.startsWith('p:') && !jenisDikenal.includes(o.jenis)) return false
  if (!o.param || typeof o.param !== 'object') return false
  return Object.values(o.param as Record<string, unknown>).every((x) => typeof x === 'number' && Number.isFinite(x))
}

/**
 * Membaca daftar template dari teks JSON. Segala bentuk yang tak dikenal
 * ditolak DENGAN SOPAN — dilewati, bukan dilempar: template lama yang
 * bentuknya sudah berubah harus berakhir sebagai satu baris yang hilang dari
 * daftar, bukan sebagai halaman kosong yang tak memberi petunjuk apa pun.
 */
export function uraiTemplate(raw: string | null): TemplateGrafik[] {
  if (!raw) return []
  let data: unknown
  try { data = JSON.parse(raw) } catch { return [] }
  if (!Array.isArray(data)) return []
  const jenisIndikator = Object.keys(SPEK_INDIKATOR)
  const jenisPola = Object.keys(SPEK_POLA)
  const hasil: TemplateGrafik[] = []
  for (const t of data) {
    if (!t || typeof t !== 'object') continue
    const o = t as Record<string, unknown>
    if (o.versi !== VERSI_TEMPLATE) continue
    if (typeof o.nama !== 'string' || !o.nama.trim()) continue
    const indikator = Array.isArray(o.indikator) ? o.indikator : []
    const pola = Array.isArray(o.pola) ? o.pola : []
    if (!indikator.every((x) => instansSah<JenisIndikator>(x, jenisIndikator))) continue
    if (!pola.every((x) => instansSah<JenisPola>(x, jenisPola))) continue
    hasil.push({
      versi: VERSI_TEMPLATE,
      nama: o.nama,
      bawaan: o.bawaan === true,
      indikator: indikator as InstansIndikator[],
      pola: pola as InstansPola[],
      // Kode emiten sengaja TIDAK dibaca walau ada di berkas lama — lihat
      // catatan di TemplateGrafik.
      ...(typeof o.jenisChart === 'string' ? { jenisChart: o.jenisChart } : {}),
      ...(typeof o.rentang === 'string' ? { rentang: o.rentang } : {}),
    })
  }
  return hasil
}

/** Simpan (atau timpa, kalau namanya sudah ada) satu template. Nama dipakai
 *  sebagai identitas supaya "simpan lagi dengan nama yang sama" berarti
 *  memperbarui, bukan diam-diam menumpuk kembaran yang tak bisa dibedakan. */
export function simpanTemplate(
  daftar: TemplateGrafik[],
  nama: string,
  isi: Pick<TemplateGrafik, 'indikator' | 'pola' | 'jenisChart' | 'rentang'>,
): TemplateGrafik[] {
  const bersih = nama.trim()
  if (!bersih) return daftar
  const lama = daftar.find((t) => t.nama === bersih)
  const baru: TemplateGrafik = {
    versi: VERSI_TEMPLATE, nama: bersih, bawaan: lama?.bawaan ?? false, ...isi,
  }
  return lama ? daftar.map((t) => (t.nama === bersih ? baru : t)) : [...daftar, baru]
}

export function hapusTemplate(daftar: TemplateGrafik[], nama: string): TemplateGrafik[] {
  return daftar.filter((t) => t.nama !== nama)
}

/** Tandai satu template sebagai bawaan; menandai yang sama sekali lagi
 *  melepasnya. Cuma boleh ada SATU bawaan — kalau tidak, "dimuat otomatis
 *  saat halaman dibuka" jadi pertanyaan yang mana yang menang. */
export function tandaiBawaan(daftar: TemplateGrafik[], nama: string): TemplateGrafik[] {
  const sudah = daftar.find((t) => t.nama === nama)?.bawaan === true
  return daftar.map((t) => ({ ...t, bawaan: !sudah && t.nama === nama }))
}

/** Ganti nama. Nama kosong, atau nama yang sudah dipakai template lain,
 *  ditolak — daftar dikembalikan apa adanya. */
export function ubahNamaTemplate(daftar: TemplateGrafik[], lama: string, baru: string): TemplateGrafik[] {
  const bersih = baru.trim()
  if (!bersih || bersih === lama) return daftar
  if (daftar.some((t) => t.nama === bersih)) return daftar
  return daftar.map((t) => (t.nama === lama ? { ...t, nama: bersih } : t))
}

/* Dua fungsi berikut satu-satunya yang tahu di mana template disimpan —
   lihat catatan panjang di kepala bagian ini. Keduanya menelan galat: kuota
   penuh atau localStorage yang dimatikan (mode privat) tak boleh menjatuhkan
   halaman grafik, cukup berarti templatenya tak bertahan. */

export function bacaTemplateTersimpan(): TemplateGrafik[] {
  try { return uraiTemplate(localStorage.getItem(KUNCI_TEMPLATE)) } catch { return [] }
}

export function tulisTemplateTersimpan(daftar: TemplateGrafik[]): void {
  try { localStorage.setItem(KUNCI_TEMPLATE, JSON.stringify(daftar)) } catch { /* kuota penuh / mode privat */ }
}
