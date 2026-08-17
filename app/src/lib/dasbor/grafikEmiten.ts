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

/** Rentang yang aktif saat halaman pertama dibuka. Johan 17 Agu 2026: "buat
 *  default nya semua". Ditulis sebagai konstanta (bukan angka indeks) supaya
 *  chip yang tersorot dan data yang tergambar mustahil berbeda. */
export const RENTANG_BAWAAN = 'Semua'

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

/* ------------------------------------------------------------------ *
 * Instans indikator (#tahap 5). Indikator berhenti jadi sakelar nyala/mati
 * dan jadi DAFTAR instans: MA 20, MA 50, dan MA 200 bisa hidup bersamaan,
 * masing-masing dengan parameter, warna, dan sakelar tampilnya sendiri.
 * Johan 17 Agu 2026: "setiap indikator bisa di masukkan berkali-kali".
 * ------------------------------------------------------------------ */

export type JenisIndikator = 'ma' | 'ema' | 'bb' | 'rsi' | 'macd'

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

export const SPEK_INDIKATOR: Record<JenisIndikator, SpekIndikator> = {
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

/** Label layar sebuah instans indikator, LENGKAP dengan parameternya — "MA
 *  200", bukan "MA". Dengan beberapa instans jenis yang sama hidup bersamaan,
 *  label tanpa angka tak lagi bisa membedakan barisnya. */
export function labelInstansIndikator(inst: InstansIndikator): string {
  const p = inst.param
  switch (inst.jenis) {
    case 'ma': return `MA ${p.periode}`
    case 'ema': return `EMA ${p.periode}`
    case 'bb': return `BB ${p.periode}±${p.k}`
    case 'rsi': return `RSI ${p.periode}`
    case 'macd': return `MACD ${p.cepat}/${p.lambat}/${p.sinyal}`
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
export function hitungInstans(inst: InstansIndikator, tutup: number[]): GarisIndikator[] {
  const p = inst.param
  const label = labelInstansIndikator(inst)
  switch (inst.jenis) {
    case 'ma': return [{ nama: label, nilai: hitungMA(tutup, p.periode) }]
    case 'ema': return [{ nama: label, nilai: hitungEMA(tutup, p.periode) }]
    case 'rsi': return [{ nama: label, nilai: hitungRSI(tutup, p.periode) }]
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
  }
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

export type JenisPola = 'doubleBottom'
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
}

export function labelInstansPola(inst: InstansPola): string {
  return SPEK_POLA[inst.jenis].label
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
