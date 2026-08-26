import { PemilihRentang } from '../../components/dasbor/PemilihRentang'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  createChart, createSeriesMarkers, createTextWatermark,
  CandlestickSeries, CrosshairMode, HistogramSeries, LineSeries, LineStyle,
  type IChartApi, type IPriceLine, type ISeriesApi, type ISeriesMarkersPluginApi,
  type ITextWatermarkPluginApi, type LineWidth,
  type MouseEventParams, type SeriesMarker, type SeriesType, type Time,
} from 'lightweight-charts'
import { useKamusEmiten } from '../../lib/dasbor/kamusEmiten'
import {
  LABEL_POLA_KLASIK, LABEL_STATUS_POLA, cariPolaKlasik, type ParamPolaKlasik, type PolaKlasik,
} from '../../lib/dasbor/polaKlasik'
import {
  keDataLilinVolume, batasBawahHari, RENTANG_KAKI, RENTANG_KAKI_BAWAAN,
  keSeriGaris, SPEK_INDIKATOR, SPEK_POLA, labelInstansIndikator, labelInstansPola,
  spekJenis, idPustaka,
  hitungInstans, cariDoubleBottom, cariLonjakanVolume, cariMusiman,
  cariDivergensi, stochUntukDivergensi, cariWyckoff, cariHarmonik,
  bacaTemplateTersimpan, tulisTemplateTersimpan, simpanTemplate, hapusTemplate,
  tandaiBawaan, ubahNamaTemplate, tutupSampai, penandaDiSekitar,
  hitungPenandaInstans, type PenandaSiapGambar,
  jenisKlasik, namaPolaDariJenis, RASIO_HARMONIK,
  hitungSegmenInstans, hitungLilinInstans, type LilinSiapGambar,
  warnaGrid, gridDariTemplate, GRID_BAWAAN, type SetelanGrid,
  type BerkasOhlcEmiten, type DoubleBottom, type JenisAsli, type JenisIndikator, type JenisPola,
  type LilinData, type ParamDoubleBottom, type ParamLonjakanVolume, type StatusPola, type StatusLonjakan,
  type LonjakanVolume, type TemplateGrafik, type TemuanMusiman, type VolumeData,
  type Divergensi, type DerajatDivergensi, type ParamDivergensi,
  type SegmenWyckoff, type FaseWyckoff, type ParamWyckoff,
  type Harmonik, type PolaHarmonik, type ParamHarmonik,
} from '../../lib/dasbor/grafikEmiten'
import {
  ambilIntraday, dariEpoch, dariWaktuChart, intraday, keEpoch, keWaktuChart,
  kunciBulan, kunciPekan, rakitBar, KERANGKA, KERANGKA_BAWAAN, type IdKerangka,
} from '../../lib/dasbor/kerangkaWaktu'
import { Dropdown } from '../../components/dasbor/Dropdown'
import {
  muatKatalog, KATEGORI, ID_SUDAH_ADA, POPULER, type Katalog,
} from '../../lib/dasbor/katalogIndikator'
import { useDaftarInstans } from '../../components/dasbor/DaftarInstans'
import { ModalSetelanInstans } from '../../components/dasbor/ModalSetelanInstans'
import { ModalKecil } from '../../components/dasbor/ModalKecil'
import { TombolIkon } from '../../components/dasbor/TombolIkon'
import { LangkahTanggal } from '../../components/dasbor/LangkahTanggal'
import { DatePicker } from '../../components/dasbor/DatePicker'
import { TombolLayarPenuh } from '../../components/dasbor/TombolLayarPenuh'
import { CatatanCakupan } from '../../components/dasbor/CatatanCakupan'
import { AlatGambar } from '../../components/dasbor/AlatGambar'
import { useAlatGambar } from '../../lib/dasbor/useAlatGambar'
import { gayaDariDash, type GayaGaris } from '../../lib/dasbor/gambarGrafik'
import { fN } from '../../lib/dasbor/format'
import { pesanGalat } from '../../lib/pesanGalat'
import { keFraksi } from '../../lib/fraksiHarga'
import { arahStruktur, cariPatahan, cariSwing, hitungPrz, type Patahan, type Swing } from '../../lib/dasbor/strukturPasar'
import {
  IkonMenu, IKON_CARI, IKON_SILANG, IKON_INFO, IKON_TONG, IKON_MATA,
  IKON_MATA_CORET, IKON_GIR, IKON_LILIN, IKON_GRAFIK_NAIK, IKON_KAMERA,
  IKON_ULANG, IKON_PUTAR, IKON_JEDA, IKON_KOTAK_ARSIP, IKON_PANAH_ATAS, IKON_PANAH_BAWAH,
} from '../../components/dasbor/IkonMenu'
import { useTheme } from '../../context/ThemeContext'
import { useOhlcvKaya } from '../../lib/dasbor/ohlcvKaya'
import { fmtB, fmtRingkas } from '../../lib/dasbor/brokerSummaryFormat'
import './GrafikEmiten.css'

const DEFAULT_KODE = 'BBCA'

/** Pilihan dropdown "Indikator" bagian ATAS — sepuluh kurasi PAPAN,
 *  diturunkan dari SPEK_INDIKATOR (bukan daftar kedua yang ditulis tangan).
 *  Katalog pustaka menyusul di bawahnya, dari registry, begitu dimuat. */
const OPSI_KURASI = (Object.keys(SPEK_INDIKATOR) as JenisAsli[])
  .map((jenis) => ({ nilai: jenis as string, label: SPEK_INDIKATOR[jenis].label, grup: 'Pilihan PAPAN' }))

/** Dropdown POLA berdiri sendiri, terpisah dari indikator (Johan: "jadi
 *  indikator dan pattern dibedakan dropdown nya"). Bukan sekadar rapian
 *  tampilan: indikator menghitung satu deret sepanjang data, pola menemukan
 *  kejadian yang bisa nol, satu, atau belasan — dua hal yang di satu menu
 *  akan terbaca seolah sejenis. */
// Dua jenis disembunyikan dari menu tapi JENISNYA tetap hidup (template
// tersimpan wajib tetap tergambar):
//   - `polaKlasik` — gabungan lama; enam belas polanya kini entri sendiri.
//   - `doubleBottom` — detektor generasi pertama; namanya PERSIS sama dengan
//     `pk-double-bottom`, dan dua entri "Double Bottom" berdampingan di menu
//     berarti salah satu akan dipilih orang tanpa tahu bedanya. Yang menang
//     yang punya target & status.
// `polaKlasik` (gabungan) KEMBALI tampil — Johan 21 Agu 2026: "jadi ada yang
// terpisah ada 1 gabungan dari semua nya". Yang tetap disembunyikan cuma
// `doubleBottom` generasi pertama (kembarannya pk-double-bottom).
const JENIS_POLA = (Object.keys(SPEK_POLA) as JenisPola[])
  .filter((j) => j !== 'doubleBottom')

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/**
 * Berapa temuan pola TERBARU yang digambar penandanya di kanvas.
 *
 * Bukan pembatasan pencarian — seluruh temuan tetap dihitung dan jumlah
 * penuhnya tetap disebut. Yang dibatasi cuma yang digambar. BBCA rentang
 * Semua dengan parameter bawaan menghasilkan 17 pola; 17 x 4 penanda saling
 * bertindihan sampai tak satu pun labelnya terbaca, dan gambar yang tak
 * terbaca lebih buruk daripada gambar yang mengaku cuma menampilkan sebagian.
 * Yang ingin melihat lebih lama ke belakang bisa mempersempit rentang.
 */
const MAKS_PENANDA_POLA = 6

/**
 * Berapa lilin TERAKHIR yang ditandai pola Musiman.
 *
 * Batas ini lahir dari layar, bukan dari teori: BBCA rentang Semua punya 490
 * hari Selasa, dan 490 kotak di kanvas selebar 1.600 piksel berjarak tiga
 * piksel satu sama lain — hasilnya satu pita pekat yang MENUTUPI garis
 * harganya sendiri (terlihat di tangkapan layar verifikasi pertama, 18 Agu
 * 2026). Menandai "semua Selasa" jadi tak menunjukkan satu Selasa pun.
 *
 * 60 kira-kira setahun perdagangan hari itu: pada rentang 1 Tahun hampir
 * seluruhnya tergambar, pada rentang panjang yang tergambar bagian terbaru dan
 * sisanya disebut angkanya di bawah kanvas. Yang TIDAK ikut dibatasi:
 * statistiknya — n, selang, dan uji tetap dihitung dari SELURUH hari di
 * rentang itu. Yang dibatasi cuma yang digambar, sama seperti MAKS_PENANDA_POLA.
 */
const MAKS_PENANDA_MUSIMAN = 60

/** Dua jenis gambar harga, cukup dua. Heikin Ashi / Bar / Area sengaja tak
 *  ditambahkan — Johan: "ada seperti untuk chart chandles dan line saja dulu".
 *  Sejak tata letak mengikuti TradingView, keduanya jadi TOMBOL IKON di bilah
 *  atas (bukan chip berteks) — di bilah yang juga memuat delapan kerangka
 *  waktu, dua kata "Lilin"/"Garis" memakan tempat yang justru dibutuhkan
 *  kerangka waktunya. */
export type JenisChart = 'lilin' | 'garis'
const JENIS_CHART: Array<[JenisChart, string, string]> = [
  ['lilin', 'Lilin', IKON_LILIN],
  ['garis', 'Garis', IKON_GRAFIK_NAIK],
]

/** Mode skala harga sumbu kanan — padanan `%` / `log` di kaki chart acuan.
 *  Nilainya angka `PriceScaleMode` lightweight-charts (0 Normal, 1 Logarithmic,
 *  2 Percentage). */
const MODE_SKALA: Array<[string, string, number, string]> = [
  ['persen', '%', 2, 'Skala persentase — semua diukur dari titik pertama yang terlihat'],
  ['log', 'log', 1, 'Skala logaritmik — jarak yang sama berarti persentase yang sama'],
]

/**
 * Compare symbols (#187) — berapa emiten pembanding boleh ditumpuk sekaligus.
 *
 * Tiga, bukan "sebanyak yang mau". Kanvas ini sudah memuat lilin + volume +
 * beberapa indikator; garis pembanding keempat berarti warna keempat yang
 * harus berbeda dari SEMUA warna indikator sekaligus, dan di titik itu
 * pembeda warnanya sudah lebih tipis daripada gunanya.
 */
const MAKS_BANDING = 3

/** Warna garis pembanding — token khusus di `.lantai`, sengaja DI LUAR
 *  `PALET_INDIKATOR`. Garis pembanding dan garis indikator duduk di kanvas
 *  yang sama; dua garis sewarna di situ tak bisa dibedakan sama sekali. */
const WARNA_BANDING = ['--bnd1', '--bnd2', '--bnd3']

/** Swatch warna modal setelan gambar (#185 lanjutan) — enam token PERSIS
 *  seperti diminta spek tugas, bukan `PALET_INDIKATOR` (itu delapan warna
 *  indikator, dua di antaranya nyaris tak kebaca sebagai garis GAMBAR di
 *  atas lilin). Nilainya nama token CSS — di-resolve ke warna literal lewat
 *  `getComputedStyle` cuma di titik klik (lihat pemakaiannya di bawah),
 *  sama pola dengan `WARNA_BANDING`/tema chart: pustaka gambar butuh warna
 *  sungguhan buat digambar canvas, bukan `var(--x)` mentah. */
const PALET_GAYA_GAMBAR = ['--green', '--red', '--blue', '--amber', '--text2', '--accent']

/** Gaya garis pilihan modal setelan gambar — domainnya `GayaGaris`
 *  (`gambarGrafik.ts`, dipetakan ke `lineDash` pustaka gambar), BUKAN
 *  `LineStyle` numerik lightweight-charts yang dipakai `ModalSetelanInstans`
 *  (indikator/pola beda pustaka sama sekali dari alat gambar). */
const GAYA_GARIS_GAMBAR: Array<[GayaGaris, string]> = [
  ['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted'],
]

/** Kode berkas OHLC indeks komposit — sama bentuknya dengan berkas emiten
 *  (`ohlc/IHSG.json`, 8.849 baris sejak 1990), jadi tak perlu jalur muat
 *  kedua. Ini pertanyaan yang paling sering dijawab salah tanpa pembanding:
 *  "naiknya karena emitennya, atau karena pasarnya?" */
const KODE_IHSG = 'IHSG'

/**
 * Kecepatan putar-otomatis Bar replay, dalam LILIN PER DETIK.
 *
 * Ditulis sebagai lilin/detik (bukan "×") karena itu yang benar-benar diatur —
 * "2×" tak punya arti sebelum ada kecepatan dasar yang disepakati, dan chart
 * ini tak punya satu pun.
 */
const KECEPATAN_REPLAY: Array<{ id: string; label: string }> = [
  { id: '1', label: '1/dtk' },
  { id: '2', label: '2/dtk' },
  { id: '5', label: '5/dtk' },
  { id: '10', label: '10/dtk' },
]

/** Satu baris legenda dalam-kanvas. `ranah` menentukan daftar mana yang
 *  dipanggil saat tombol mata/hapus/gir ditekan — indikator dan pola punya
 *  dua `useDaftarInstans` terpisah, dan barisnya duduk berdampingan. */
interface BarisLegenda {
  id: string
  ranah: 'ind' | 'pol'
  tampil: boolean
  warna: string
  label: string
  nilai: string
}

/**
 * Satu penanda pola di kanvas, beserta KETERANGANNYA.
 *
 * Keterangan itu dulu ditulis langsung di `text` penanda lightweight-charts,
 * dan di situlah keluhan Johan 18 Agu 2026 lahir: *"Pola nya juga tembus
 * harusnya dibuat tooltips saja, pola nya tembus"*. Penanda pola berdempetan
 * secara alami (lembah kedua dan penembusan lehernya kerap cuma berjarak
 * satu-dua lilin), dan label yang menempel padanya saling menimpa sampai tak
 * satu pun terbaca. Penandanya tetap — yang pindah teksnya.
 *
 * `token` disimpan sebagai NAMA VARIABEL CSS (mis. `--amber`), bukan warna
 * yang sudah dibaca: penanda kanvas butuh nilai heksadesimalnya (kanvas tak
 * mengenal variabel CSS) sedangkan tooltip berupa DOM yang justru harus ikut
 * berganti sendiri saat tema ditukar. Satu daftar, dua pembaca, nol
 * kemungkinan warna tooltip dan warna penandanya berbeda.
 */
interface PenandaPola {
  time: string
  /** Penanda volume duduk di seri volume, bukan seri harga — dua plugin
   *  penanda terpisah supaya tak berebut tempat. */
  seri: 'harga' | 'volume'
  posisi: 'aboveBar' | 'belowBar'
  token: string
  teks: string
  /** Bentuk penanda. Bawaan lingkaran (Double Bottom & Lonjakan Volume sudah
   *  memakainya); Musiman memakai KOTAK supaya "hari yang ditunjuk" tak
   *  tertukar dengan "kejadian yang ditemukan" — dua hal yang sangat berbeda
   *  walau sama-sama tergambar di bawah lilin. */
  bentuk?: 'circle' | 'square'
  /**
   * Teks PENDEK yang dicetak DI KANVAS di sebelah penandanya — 'HH', 'X',
   * 'BOS'. Beda peran dengan `teks` (keterangan panjang untuk tooltip/menu
   * konteks): ini label yang terbaca tanpa disentuh, meniru label swing
   * berkotak di chart-chart acuan Johan. Kosong = penanda tanpa tulisan,
   * perilaku lama.
   */
  labelKanvas?: string
}

const spekPola = (jenis: JenisPola) => SPEK_POLA[jenis].param

/** 'yyyy-mm-dd[ HH:mm]' -> '12 Agu 2026'. Dipakai menyebut basis normalisasi
 *  persen di legenda pembanding — di situ yang dibutuhkan tanggal yang bisa
 *  dibaca sekilas, bukan ISO. */
function tglPendek(waktu: string): string {
  const bln = Number(waktu.slice(5, 7)) - 1
  if (!BULAN[bln]) return waktu
  return `${Number(waktu.slice(8, 10))} ${BULAN[bln]} ${waktu.slice(0, 4)}`
}

/**
 * Token warna heksadesimal -> rgba dengan alfa. Watermark lightweight-charts
 * menerima satu string warna dan tak punya ruas opacity sendiri, sementara
 * token `.lantai` semuanya heksadesimal pekat — jadi alfanya harus dijahitkan
 * di sini. Nilai yang tak dikenali dikembalikan apa adanya: lebih baik
 * watermark yang kelewat pekat daripada kanvas yang gagal digambar.
 */
function warnaSamar(hex: string, alfa: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`
}

/**
 * Salin teks — dan JANGAN gagal diam-diam.
 *
 * `navigator.clipboard` cuma ada di konteks aman (https atau localhost).
 * Dibuka lewat alamat IP di jaringan rumah — persis cara halaman ini dilihat
 * dari ponsel saat verifikasi — ia `undefined`, dan bentuk `navigator
 * .clipboard?.writeText(...)` menelan itu tanpa jejak: menunya menutup seperti
 * berhasil dan papan tempel tetap berisi yang lama.
 *
 * Jadi ada dua cadangan, dan yang terakhir tak bisa gagal: `execCommand`
 * (usang tapi masih bekerja di konteks tak aman), lalu `prompt` yang
 * memajang teksnya supaya bisa disalin tangan.
 */
function salinTeks(teks: string): void {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(teks).catch(() => cadanganSalin(teks))
    return
  }
  cadanganSalin(teks)
}

function cadanganSalin(teks: string): void {
  const ta = document.createElement('textarea')
  ta.value = teks
  // Di luar layar, bukan `display:none` — elemen tersembunyi tak bisa dipilih,
  // dan `execCommand('copy')` menyalin dari PILIHAN.
  ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'
  document.body.appendChild(ta)
  ta.select()
  let ok = false
  try { ok = document.execCommand('copy') } catch { ok = false }
  ta.remove()
  if (!ok) window.prompt('Salin manual:', teks)
}

/** Keterangan status — MENJELASKAN apa yang ditemukan dan apa syaratnya,
 *  bukan apa yang harus dilakukan. Tak ada, dan tak boleh ada, kalimat saran
 *  beli/jual di sini (aturan mengikat CLAUDE.md, berlaku seluruh situs). */
const ARTI_STATUS: Record<StatusPola, string> = {
  terbentuk: 'kedua lembah dan lehernya lengkap, harga belum menutup di atas leher',
  terkonfirmasi: 'ada penutupan di atas leher sesudah lembah kedua',
  batal: 'harga jatuh di bawah lembah terendah sebelum menembus leher',
}

/** Warna penanda pola per status. Sengaja BUKAN hijau/merah: di halaman yang
 *  seluruh lilinnya sudah memakai hijau/merah sebagai naik/turun, dua warna
 *  itu akan terbaca sebagai penilaian bagus/buruk atas polanya. */
const WARNA_STATUS: Record<StatusPola, string> = {
  terbentuk: '--amber',
  terkonfirmasi: '--blue',
  batal: '--text3',
}

/** Keterangan tiga keadaan Lonjakan Volume — menjelaskan apa yang DIUKUR,
 *  bukan apa yang harus dilakukan. */
const ARTI_LONJAKAN: Record<StatusLonjakan, string> = {
  terkonfirmasi: 'harga naik dan volumenya di atas ambang RVOL',
  kuat: 'sama, tapi RVOL-nya melewati ambang kuat — keikutsertaan besar',
  takTerkonfirmasi: 'harga naik tapi volumenya justru DI BAWAH rata-rata',
}

/** Warna keadaan Lonjakan Volume. `takTerkonfirmasi` sengaja abu netral, bukan
 *  hijau: ia menandai kenaikan yang TIDAK didukung volume, dan hijau di
 *  halaman ini terbaca sebagai kabar baik. */
const WARNA_LONJAKAN: Record<StatusLonjakan, string> = {
  terkonfirmasi: '--blue',
  kuat: '--amber',
  takTerkonfirmasi: '--text3',
}

/** Keterangan tiga derajat Divergensi — MENJELASKAN apa yang membuat sebuah
 *  temuan naik/turun derajat, bukan apa yang harus dilakukan atasnya. */
const ARTI_DERAJAT: Record<DerajatDivergensi, string> = {
  kuat: 'harga, Stochastic, dan volume ketiganya sejalan',
  sedang: 'harga dan Stochastic sejalan, volume tidak mendukung',
  lemah: 'ayun harga atau selisih %K cuma pas-pasan melewati ambangnya sendiri',
}

/** Warna derajat Divergensi. Sengaja BUKAN hijau/merah walau polanya punya
 *  arah bearish/bullish: warna di sini menyatakan seberapa kuat BUKTINYA,
 *  dan hijau/merah di kanvas yang lilinnya sudah hijau/merah akan terbaca
 *  sebagai penilaian bagus/buruk atas sahamnya. Arahnya dibedakan lewat
 *  posisi penanda (di atas lilin untuk bearish, di bawah untuk bullish) dan
 *  lewat teks tooltipnya. */
const WARNA_DERAJAT: Record<DerajatDivergensi, string> = {
  kuat: '--blue',
  sedang: '--amber',
  lemah: '--text3',
}

/** Nama enam fase Wyckoff di layar. Ruas kodenya berbahasa camelCase supaya
 *  aman jadi kunci; yang dibaca orang ditulis di sini sekali saja. */
const NAMA_FASE: Record<FaseWyckoff, string> = {
  akumulasi: 'Akumulasi',
  markupAwal: 'Markup Awal',
  markup: 'Markup',
  konsolidasi: 'Konsolidasi',
  markdownAwal: 'Markdown Awal',
  markdown: 'Markdown',
}

/** Apa yang MEMBUAT sebuah lilin masuk fase itu — dua sumbu, bukan tafsir.
 *  Kalimatnya sengaja menyebut syaratnya, bukan akibatnya bagi pemegang
 *  saham: fase adalah ukuran posisi harga terhadap dua MA, bukan vonis. */
const ARTI_FASE: Record<FaseWyckoff, string> = {
  akumulasi: 'harga di antara kedua MA sementara MA pendek masih di bawah MA panjang',
  markupAwal: 'harga sudah di atas kedua MA tapi MA pendek belum melewati MA panjang',
  markup: 'harga di atas kedua MA dan MA pendek sudah di atas MA panjang',
  konsolidasi: 'harga mundur ke antara kedua MA sementara MA pendek masih di atas MA panjang',
  markdownAwal: 'harga jatuh di bawah kedua MA padahal MA pendek masih di atas MA panjang',
  markdown: 'harga di bawah kedua MA dan MA pendek sudah di bawah MA panjang',
}

/** Warna fase. Tiga nada saja, dipakai bergantian menurut posisi harga
 *  terhadap kedua MA (di atas / di antara / di bawah) — BUKAN hijau-merah:
 *  di kanvas yang lilinnya sudah hijau-merah, dua warna itu akan terbaca
 *  sebagai penilaian bagus-buruk atas sahamnya, dan fase bukan penilaian. */
const WARNA_FASE: Record<FaseWyckoff, string> = {
  akumulasi: '--text3',
  markupAwal: '--amber',
  markup: '--blue',
  konsolidasi: '--text3',
  markdownAwal: '--amber',
  markdown: '--text2',
}

/** Nama empat pola harmonic + rasio penanda tangannya, ditulis di layar
 *  supaya angka yang menghasilkan namanya bisa dicocokkan sendiri. */
const NAMA_HARMONIK: Record<PolaHarmonik, string> = {
  gartley: 'Gartley',
  bat: 'Bat',
  crab: 'Crab',
  butterfly: 'Butterfly',
}

/** Warna per pola harmonic — membedakan NAMA polanya, bukan arahnya (arah
 *  terbaca dari posisi penanda: bullish di bawah lilin, bearish di atas).
 *  Sengaja bukan hijau/merah, alasan yang sama dengan WARNA_DERAJAT. */
const WARNA_HARMONIK: Record<PolaHarmonik, string> = {
  gartley: '--blue',
  bat: '--amber',
  crab: '--text2',
  butterfly: '--text3',
}

const PANDUAN_INDIKATOR: Array<{ label: string; teks: string }> = [
  { label: 'MA (Moving Average)',
    teks: 'Rata-rata harga tutup selama sekian hari terakhir, diperbarui tiap hari. Mengikuti arah harga dengan jeda — makin panjang periodenya, makin lambat mengikuti.' },
  { label: 'EMA (Exponential Moving Average)',
    teks: 'Sama seperti MA, tapi hari-hari terakhir dibobot lebih berat. Bereaksi lebih cepat ke perubahan harga, juga lebih cepat berbalik saat harga berbalik.' },
  { label: 'BB (Bollinger Bands)',
    teks: 'Pita di atas dan bawah rata-rata harga, lebarnya mengikuti seberapa liar harga bergerak belakangan (simpangan baku). Pita melebar saat harga bergejolak, menyempit saat tenang — bukan penanda murah/mahal.' },
  { label: 'RSI (Relative Strength Index)',
    teks: 'Mengukur seberapa cepat harga bergerak belakangan, bukan seberapa murah sahamnya. Bergerak antara 0-100; makin dekat ke ujung, makin cepat pergerakan searah baru-baru ini.' },
  { label: 'MACD',
    teks: 'Selisih dua rata-rata bergerak (EMA cepat dan lambat) beserta garis sinyalnya. Menunjukkan perubahan momentum, bukan level harga — angkanya tak sebanding antar saham berharga beda.' },
  { label: 'Stochastic (%K dan %D)',
    teks: 'Menempatkan harga tutup hari ini di dalam rentang tertinggi-terendah sekian hari terakhir: 0 berarti persis di dasar rentang, 100 di puncaknya. %D adalah versi %K yang sudah dihaluskan. Mengukur posisi di dalam rentang, bukan arah tren.' },
  { label: 'StochRSI',
    teks: 'Rumus Stochastic yang diterapkan pada nilai RSI, bukan pada harga. Karena itu ia bergerak jauh lebih cepat dan lebih sering menyentuh ujung 0/100 daripada RSI biasa — lebih peka, dan sekaligus lebih sering berteriak.' },
  { label: 'W%R (Williams %R)',
    teks: 'Jarak harga tutup dari harga TERTINGGI sekian hari terakhir, dinyatakan −100 sampai 0. Isi ukurannya sama dengan Stochastic %K, cuma dibalik dan digeser skalanya.' },
  { label: 'VWAP (Volume Weighted Average Price)',
    teks: 'Harga rata-rata yang dibobot volume, dihitung menumpuk sejak awal pekan atau awal bulan lalu dimulai ulang di batas berikutnya. Menjawab "berapa harga rata-rata yang benar-benar dibayar orang sejauh ini", bukan sekadar rata-rata harga penutupan. Jangkar harian sengaja tidak disediakan: pada data harian ia dimulai ulang tiap lilin dan hasilnya cuma harga lilin itu sendiri.' },
  { label: 'Katalog pustaka — ratusan indikator lain',
    teks: 'Di bawah "Pilihan PAPAN" pada menu ƒx Indikator ada katalog penuh pustaka lightweight-charts-indicators (MIT), dikelompokkan menurut kategori pustakanya sendiri: rata-rata bergerak, osilator, momentum, tren, volatilitas, pita & kanal, volume, pola lilin. Ketik di kotak cari untuk menyaringnya. Daftarnya dibaca dari registry pustaka, bukan disalin — versi pustaka berikutnya langsung terbaca apa adanya.' },
  { label: 'Katalog: apa yang tidak ikut, dan kenapa',
    teks: 'Indikator yang keluarannya bukan deret angka (kebanyakan pola lilin yang menggambar penanda) tidak dimasukkan — kanvas ini menggambar deret, dan indikator yang menyala tapi tak menggambar apa pun lebih membingungkan daripada indikator yang jujur tak ada. Penempatannya (menumpang di panel harga atau panel sendiri di bawah) juga dibaca dari registry, bukan ditebak. Sebagian parameter yang bukan angka — pilihan sumber harga, sakelar ya/tidak — memakai bawaan pustaka.' },
  { label: 'Sepuluh yang dikurasi, dan pemeriksaan silangnya',
    teks: 'MA, EMA, BB, RSI, MACD, dan OBV dihitung kode PAPAN sendiri; Stochastic, StochRSI, W%R, dan VWAP memakai rumus pustaka tapi dengan label dan parameter yang sudah dirapikan. Kesepuluhnya muncul paling atas di menu, dan versi pustaka dari enam yang pertama sengaja tidak ikut di katalog supaya tak ada dua garis bernama sama yang boleh berbeda. Sebagai pemeriksaan silang, RSI PAPAN diadu dengan RSI pustaka pada data yang sama di dalam uji otomatis.' },
  { label: 'Beberapa instans sekaligus',
    teks: 'Satu jenis boleh dimasukkan berkali-kali dengan parameter berbeda — MA 20, MA 50, dan MA 200 bisa hidup bersamaan, masing-masing punya warna, parameter, dan sakelar tampilnya sendiri. Warna, gaya garis, dan ketebalan tiap plot diatur di tab Style pada modal setelan (ikon gir di baris legenda).' },
]

const PANDUAN_POLA: Array<{ label: string; teks: string }> = [
  { label: 'Double Bottom — apa yang dicari',
    teks: 'Dua lembah yang harganya sepadan, dipisahkan sebuah puncak di antaranya (leher). Lembah dicari sebagai pivot: titik yang sekian lilin di kiri dan kanannya tak ada yang lebih rendah — karena itu beberapa lilin terakhir tak pernah menghasilkan pivot, sebuah pivot baru bisa disebut pivot setelah harga terbukti berbalik.' },
  { label: 'Kenapa toleransinya dihitung dari ATR, bukan persen',
    teks: 'ATR mengukur seberapa jauh saham itu memang biasa bergerak dalam sehari. Toleransi persen tetap memperlakukan saham 50 rupiah dan saham 50.000 rupiah dengan ukuran yang salah satunya pasti keliru; "1 × ATR" berarti hal yang sama di seluruh papan.' },
  { label: 'Kedalaman minimum',
    teks: 'Jarak dari leher turun ke lembah terdangkal harus melebihi sekian kali ATR. Tanpa syarat ini, tiap riak kecil di sepanjang tren ikut lolos sebagai pola.' },
  { label: 'Tiga status',
    teks: `Terbentuk — ${ARTI_STATUS.terbentuk}. Terkonfirmasi — ${ARTI_STATUS.terkonfirmasi}. Batal — ${ARTI_STATUS.batal}. Ketiganya ditampilkan; yang batal justru keterangan paling berguna tentang seberapa sering bentuk itu tidak berlanjut.` },
  { label: 'Volume saat menembus leher',
    teks: 'Ditandai terpisah sebagai penguat, bukan syarat. Dijadikan syarat wajib, ia membuang pola yang bentuk harganya sudah lengkap hanya karena ruas volume hari itu kebetulan sepi — dan ruas volume adalah ruas yang paling sering cacat.' },
  { label: 'Lonjakan Volume — apa yang diukur',
    teks: 'RVOL (relative volume) membandingkan volume hari itu dengan rata-rata volume 20 hari sebelumnya. RVOL 2 berarti hari itu diperdagangkan dua kali lebih ramai dari kebiasaannya sendiri. Rata-rata pembaginya sengaja tidak memasukkan hari itu — dimasukkan, lonjakannya ikut mengangkat pembaginya sendiri dan angkanya jadi lebih kecil dari yang sebenarnya.' },
  { label: 'Tiga keadaan Lonjakan Volume',
    teks: `Terkonfirmasi — ${ARTI_LONJAKAN.terkonfirmasi}. Kuat — ${ARTI_LONJAKAN.kuat}. Tak terkonfirmasi — ${ARTI_LONJAKAN.takTerkonfirmasi}. Kenaikan harga tanpa kenaikan volume berarti sedikit pihak yang ikut; keadaan ketiga itu justru yang membuat daftar ini bukan sekadar kumpulan hari yang menyenangkan.` },
  { label: 'Pola Klasik — enam belas pola, satu mesin',
    teks: 'Sembilan reversal — Double/Triple Top & Bottom, Head & Shoulders (+inverted), Rising/Falling Wedge, Expanding Triangle — plus tujuh continuation: Bullish/Bearish Flag, Bullish/Bearish Pennant, Ascending/Descending/Symmetrical Triangle. Semuanya dicari di atas pivot zigzag yang sama dengan Harmonic. Flag & Pennant tambahan mensyaratkan TIANG (pole) — gerak kuat searah sebelum kanalnya — supaya beda dari baji/expanding yang bentuknya mirip tapi tanpa tiang. Sebuah pola baru dihitung SELESAI saat lehernya (atau garis trennya) ditembus penutupan, bukan saat bentuknya kelihatan; penanda dan garisnya berdiri di lilin patahan itu.' },
  { label: 'Pola Klasik — angka backtest-nya, jujur',
    teks: 'Diukur atas 18 emiten beragam watak, bebas bocor masa depan, dibandingkan peluang dasar arah yang sama: harian −2,4pp pada 5 lilin naik jadi +2,7pp pada 20 lilin, 4 jam mendekati nol di ketiga jendela, pekanan +6,9pp pada 5 lilin (sampel pekanan kecil). Per pola TIDAK sama kuat — Head & Shoulders +18pp dan Double Bottom +12pp di harian tetap paling teruji; dari continuation, Bearish Flag harian +35pp di 20 lilin (n=7) paling menjanjikan tapi sampelnya kecil, sementara Bullish Flag negatif di ketiga jendela harian (n=13). Angka ini dicetak supaya polanya ditimbang, bukan dipercaya buta.' },
  { label: 'Pola Klasik — target harga & statusnya',
    teks: 'Mengikuti spek Auto Chart Patterns TradingView (dibaca langsung dari dokumentasinya): sesudah patahan, harga diharapkan berjalan kira-kira SETINGGI POLANYA searah patahan — garis putus-putus mendatar menandai level itu. Status tiap pola dinilai dari lilin yang sudah terjadi: tercapai (ekstrem menyentuh target), gagal (penutupan melewati ekstrem pola di sisi berlawanan sebelum target), atau menunggu. Ini label atas masa lalu, bukan ramalan — dan backtest di atas tidak memakainya.' },
  { label: 'Divergensi — tiga lapis, tiga peran berbeda',
    teks: 'Lapis harga menentukan ADA-tidaknya pola: dua puncak (bearish) atau dua lembah (bullish) yang dicari dengan pivot yang sama seperti Double Bottom. Lapis Stochastic %K dibandingkan di dua pivot yang sama dan itulah yang MENYATAKAN divergensinya — arah harga dan arah momentum harus berlawanan. Lapis volume tidak pernah menolak apa pun; ia cuma mengesahkan derajatnya.' },
  { label: 'Divergensi — dua arah dan artinya',
    teks: 'Bearish: harga membentuk puncak lebih tinggi sementara %K membentuk puncak lebih rendah — naiknya kehilangan tenaga. Bullish: harga membentuk lembah lebih rendah sementara %K membentuk lembah lebih tinggi — turunnya kehilangan tenaga. Penanda bearish duduk di atas lilin, bullish di bawahnya. Ini penyajian pola, bukan saran beli atau jual.' },
  { label: 'Divergensi — kenapa volume ikut dihitung',
    teks: 'Puncak kedua yang terbentuk dengan rata-rata volume lebih rendah dari puncak pertama berarti kenaikan tanpa dukungan; lembah kedua yang volumenya mengering berarti tekanan jual yang habis. Volume dibandingkan sebagai rata-rata beberapa lilin sampai pivot, bukan satu batang — satu batang terlalu berisik. Volume yang bergerak berlawanan menurunkan derajat, tidak membatalkan polanya.' },
  { label: 'Divergensi — tiga derajat',
    teks: `Kuat — ${ARTI_DERAJAT.kuat}. Sedang — ${ARTI_DERAJAT.sedang}. Lemah — ${ARTI_DERAJAT.lemah}. Dua pivot yang jaraknya di luar batas justru tidak ditampilkan sama sekali: terlalu dekat berarti masih satu ayunan yang sama, terlalu jauh berarti dua kejadian yang tak lagi berhubungan.` },
  { label: 'Divergensi — Stochastic-nya yang mana',
    teks: 'Deret %K yang sama persis dengan indikator Stoch di menu ƒx, lewat jalur perhitungan yang sama — jadi garis yang tergambar di panel bawah dan angka yang dipakai pola tak bisa berselisih. Bawaannya 14 dengan penghalusan 3 (bukan 1 seperti indikatornya): %K mentah berayun penuh 0–100 tiap beberapa lilin, dan "puncak %K lebih rendah" pada deret sekasar itu lebih sering kebetulan daripada tanda.' },
  { label: 'Musiman — apa yang ditandai',
    teks: 'Pilih satu hari (Senin–Jumat) dan lilin hari itu ditandai kotak di kanvas. Kotaknya menunjuk "ini hari yang dimaksud", bukan menyarankan apa pun; angkanya ada di tooltip dan di daftar bawah. Yang ditandai 60 lilin terakhir saja — pada rentang bertahun-tahun, menandai semuanya menghasilkan satu pita pekat yang justru menutupi harganya. Angka statistiknya tetap dihitung dari seluruh hari di rentang itu.' },
  { label: 'Musiman — kenapa cuma di kerangka harian ke atas',
    teks: 'Pada kerangka intraday (5m sampai 4h) pola ini sengaja tidak dihitung sama sekali. Perhitungannya berkunci TANGGAL, jadi 78 lilin lima menit di hari yang sama akan saling menimpa di satu kunci dan yang tersisa cuma lilin terakhir tiap hari — angkanya tetap keluar dan tetap terlihat masuk akal, padahal menjawab pertanyaan yang sama sekali lain.' },
  { label: 'Musiman — kenapa n selalu ikut disebut',
    teks: 'Peluang naik 60% dari 12 hari dan dari 240 hari terlihat sama meyakinkannya di layar, padahal yang pertama hampir pasti kebetulan. Karena itu jumlah observasi (n), selang kepercayaan 95%, dan hasil uji permutasi selalu menempel pada angkanya — di legenda, di tooltip, dan di daftar.' },
  { label: 'Musiman — rentang perhitungannya',
    teks: 'Persis rentang yang sedang tergambar (chip di kaki kanvas). Mengganti chip berarti menghitung ulang pola harinya pada rentang itu — angka yang tertulis selalu berasal dari lilin yang terlihat, tak pernah dari data yang tak ada di layar. Angkanya sendiri datang dari perhitungan yang sama dengan halaman Seasonality, bukan hitungan kedua.' },
  { label: 'Wyckoff Phase — dua sumbu, enam fase',
    teks: 'Fase diturunkan dari perkalian dua hal yang masing-masing cuma punya sedikit kemungkinan: struktur MA (MA pendek di atas atau di bawah MA panjang) dan posisi harga (di atas kedua MA, di antaranya, atau di bawah keduanya). Dua kali tiga = enam, jadi tiap lilin yang MA-nya sudah lengkap dapat tepat satu fase — tak ada lilin yang memenuhi dua fase sekaligus, dan tak ada yang tak kebagian. Dibaca melingkar, keenamnya membentuk satu siklus: Akumulasi, Markup Awal, Markup, Konsolidasi, Markdown Awal, Markdown, lalu kembali.' },
  { label: 'Wyckoff Phase — peran aliran asing, dan batasnya',
    teks: 'Pita tengah (harga di antara kedua MA) memang ambigu, dan di situlah arah aliran asing dipakai memisahkannya: net asing beberapa lilin terakhir positif berarti Akumulasi, negatif berarti Konsolidasi. Yang wajib diketahui pembaca: catatan asing baru ada sejak 2020 sementara harga tersedia sejak 2016, jadi untuk lilin yang tak punya catatan asing penentunya jatuh ke struktur MA. Terukur di seluruh papan, 54% lilin pita tengah dilabeli aliran asing dan sisanya lewat cadangan itu — daftar di bawah menyebutkan yang mana untuk tiap segmen. Angka net asing satuannya LEMBAR, bukan rupiah; IDX tidak melaporkan aliran asing dalam rupiah.' },
  { label: 'Wyckoff Phase — kenapa volume tidak ikut menentukan',
    teks: 'Sebagian panduan menjadikan "volume di atas rata-rata" syarat wajib fase Markup. Di sini volume dilaporkan sebagai RVOL segmen dan tidak pernah memindahkan fase, karena syarat semacam itu diam-diam menurunkan sebuah Markup jadi Markup Awal hanya gara-gara ruas volume beberapa hari itu kebetulan sepi — dan ruas volume adalah ruas yang paling sering cacat. Alasan yang sama dipakai penanda volume di Double Bottom.' },
  { label: 'Wyckoff Phase — kenapa segmen, bukan label harian',
    teks: 'Yang ditandai di kanvas adalah lilin PERTAMA tiap segmen, yaitu hari fasenya berganti. Menandai tiap lilin berarti ribuan penanda yang menutupi harganya sendiri, sementara pertanyaan pembacanya justru "kapan bergantinya". Segmen yang lebih pendek dari ambang panjang minimum tidak dilaporkan: di sekitar titik silang MA, fasenya kerap berkedip sehari-dua dan kedipan itu bukan pergantian fase.' },
  { label: 'Harmonic Pattern — lima titik dan empat rasio',
    teks: 'Pola harmonic adalah lima titik balik berselang-seling (X-A-B-C-D) yang perbandingan panjang kakinya jatuh di angka Fibonacci tertentu. Gartley: AB/XA 0,618 dan AD/XA 0,786. Bat: AB/XA 0,382-0,50 dan AD/XA 0,886. Crab: AB/XA 0,382-0,618 dan AD/XA 1,618. Butterfly: AB/XA 0,786 dan AD/XA 1,27-1,618. Toleransi pencocokannya bisa disetel; makin lebar, makin sering dua nama pola berebut lima titik yang sama.' },
  { label: 'Harmonic Pattern — gerbang BC/AB, dan kenapa ia lebih dulu',
    teks: 'BC adalah koreksi atas AB, jadi ia tak bisa lebih panjang dari yang dikoreksinya. Perbandingan BC/AB diperiksa berada di 0,382-0,886 SEBELUM rasio pola dicek sama sekali. Tanpa gerbang itu muncul "pola" berrasio berkali-kali lipat yang mustahil secara definisi — terukur di papan IDX, BC/AB terbesar yang pernah muncul mencapai 486 kali dan puluhan ribu kaki punya BC/AB di atas 1. Gerbangnya membuang sekitar 61% kandidat, dan sekaligus menjamin titik C tak melewati A tanpa perlu syarat geometri tambahan.' },
  { label: 'Harmonic Pattern — kenapa jauh lebih jarang dari pola lain',
    teks: 'Terukur di seluruh papan: sekitar 0,07 pola per 100 lilin, sementara Divergensi 2,83 dan Double Bottom 2,43. Sebabnya bukan ambang yang kelewat ketat melainkan bentuk syaratnya — dua pola itu menuntut dua kondisi atas dua titik, harmonic menuntut empat rasio jatuh bersamaan atas lima titik. Dari seluruh jendela lima titik yang diperiksa, cuma 2% rasionya cocok dengan pola mana pun. Pola harmonic memang formasi langka; daftar yang selalu penuh justru tanda ambangnya terlalu longgar.' },
  { label: 'Harmonic Pattern — zigzag, bukan pivot mentah',
    teks: 'Kelima titiknya diambil dari zigzag: pivot tinggi dan rendah yang dipaksa berselang-seling, dan dua pivot sejenis berturutan digantikan yang lebih ekstrem. Tanpa pemaksaan itu, "XABCD" bisa berisi dua puncak berurutan tanpa lembah di antaranya dan kaki AB-nya bukan koreksi apa pun. Ayunan yang lebih kecil dari ambang dibuang, bukan diterima sebagai titik.' },
  { label: 'OBV melengkapi, bukan mengulang',
    teks: 'Pola Lonjakan Volume melihat SATU hari. Indikator OBV (On-Balance Volume, ada di menu ƒx Indikator) menumpuk arah volume sepanjang riwayat: ditambah saat harga tutup naik, dikurangi saat turun. Angka mutlaknya tak berarti — yang dibaca arahnya. Satu hari saja bukti yang tipis.' },
]

/**
 * Angka musiman hari terpilih, di bawah kanvas — tempat angka yang tak muat di
 * tooltip: selang Wilson, median, rata-rata, dan kumulatifnya.
 *
 * Peluang MENTAH dan TERSUSUT ditulis berdampingan, bukan salah satunya.
 * Mentah itu yang dilihat orang di aplikasi sekuritas ("naik 62%"); tersusut
 * itu angka yang sudah ditarik ke peluang dasar emiten sesuai ketipisan
 * sampel. Menampilkan yang mentah saja mengulang persis kesalahan yang
 * seharusnya ditambal halaman ini; menampilkan yang tersusut saja membuat
 * angkanya tak bisa dicocokkan dengan sumber mana pun di luar.
 */
function RingkasanMusiman({ m, warna }: { m: TemuanMusiman; warna: string }) {
  const r = m.ringkas
  return (
    <ul className="grf-pola-daftar">
      <li style={{ '--ind-warna': `var(${warna})` } as React.CSSProperties}>
        <span className="grf-pola-status">peluang naik</span>
        <span>
          {fN(r.mentah, 1)}% mentah · {fN(r.tersusut, 1)}% tersusut
          {' · '}selang 95% {fN(r.bawah, 1)}–{fN(r.atas, 1)}%
          {' · '}n={r.n} dari {m.totalObservasi} hari bursa
        </span>
      </li>
      <li style={{ '--ind-warna': `var(${warna})` } as React.CSSProperties}>
        <span className="grf-pola-status">besaran</span>
        <span>
          median {fN(r.median, 2)}% · rata-rata {fN(r.rata2, 2)}%
          {' · '}kumulatif {fN(r.kumulatif, 1)}% (hasil mengalikan seluruh imbal hari itu)
        </span>
      </li>
      <li style={{ '--ind-warna': `var(${m.vonis.kuat ? '--amber' : '--text3'})` } as React.CSSProperties}>
        <span className="grf-pola-status">uji</span>
        <span>{m.vonis.teks}</span>
      </li>
    </ul>
  )
}

/**
 * Grafik Emiten (chart PAPAN) — lilin + volume, digambar `lightweight-charts`.
 *
 * Tata letaknya mengikuti acuan Stockbit/TradingView yang ditetapkan Johan:
 * bilah atas (cari · kerangka waktu · jenis chart · ƒx Indikator · layar penuh
 * & kamera), kanvas bertingkat dengan legenda per panel di pojok kiri atas,
 * dan bilah bawah (rentang · UTC+7 · % / log / auto).
 *
 * BEDA dari /chart (`ChartIndeks.tsx`): itu widget TradingView yang menggambar
 * data TradingView sendiri; ini kanvas milik PAPAN — perlu supaya overlay khas
 * PAPAN (pola musiman, Double Bottom, Lonjakan Volume) bisa dipasang di
 * atasnya.
 *
 * Yang SENGAJA tidak ada, walau ada di gambar acuan: bilah alat gambar di kiri
 * (garis tren, Fibonacci, kuas, penggaris, magnet). Tiap alat itu subsistem
 * sendiri — primitive gambar, titik pegangan, uji-kena, seret-ubah, simpan
 * per emiten — dan bilah yang tombolnya tak melakukan apa-apa lebih buruk
 * daripada tak ada bilahnya.
 */
export function GrafikEmiten() {
  const { theme } = useTheme()
  const kamus = useKamusEmiten()
  /**
   * Emiten & kerangka boleh datang dari URL (`/grafik?kode=BBRI&tf=1h`).
   *
   * Johan 18 Agu 2026: *"semua kode emiten on click nya ke chart"* — seluruh
   * kode emiten di aplikasi menaut ke halaman ini, jadi tautannya HARUS bisa
   * membawa emiten yang diklik. Tanpa ruas ini, tiap tautan mendarat di BBCA
   * dan pembacanya menyimpulkan tautannya rusak.
   *
   * Dibaca SEKALI lewat penginisialisasi useState, bukan disinkronkan dua arah
   * tiap render: URL yang mengejar state yang mengejar URL adalah lingkaran
   * yang berhenti di tempat yang sulit ditebak.
   */
  const [param, setParam] = useSearchParams()
  const [kode, setKode] = useState(() => {
    const q = (param.get('kode') ?? '').trim().toUpperCase()
    // Disaring BENTUKNYA di sini (huruf/angka, 2–6 aksara). Kecocokan dengan
    // emiten yang benar-benar ada diperiksa belakangan, saat kamus tiba —
    // kamusnya belum ada pada saat render pertama.
    return /^[A-Z0-9]{2,6}$/.test(q) ? q : DEFAULT_KODE
  })
  /** Kode di URL yang ternyata bukan emiten mana pun. Disebut di layar, bukan
   *  diganti diam-diam: pembaca yang mengetik "BBRII" harus tahu kenapa yang
   *  terbuka BBCA. */
  const [kodeAsing, setKodeAsing] = useState<string | null>(null)
  const [cari, setCari] = useState('')
  const [berkas, setBerkas] = useState<BerkasOhlcEmiten | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [rentangLabel, setRentangLabel] = useState<string>(RENTANG_KAKI_BAWAAN)
  const [jenisChart, setJenisChart] = useState<JenisChart>('lilin')
  const [kerangka, setKerangka] = useState<IdKerangka>(() => {
    const q = param.get('tf')
    return KERANGKA.some((k) => k.id === q) ? (q as IdKerangka) : KERANGKA_BAWAAN
  })
  /** Mode skala sumbu kanan: '' normal, 'persen', atau 'log'. Tiga keadaan,
   *  bukan dua sakelar bebas — `%` dan `log` di lightweight-charts satu ruas
   *  `mode` yang sama, jadi dua sakelar terpisah akan menjanjikan kombinasi
   *  yang mustahil. */
  const [modeSkala, setModeSkala] = useState('')
  const [autoSkala, setAutoSkala] = useState(true)

  /* ---------------- Compare symbols (#187) ---------------- */

  /** Kode emiten/indeks pembanding, maksimal `MAKS_BANDING`. Urutannya
   *  menentukan warnanya (`WARNA_BANDING[i]`) — jadi menghapus yang tengah
   *  memang menggeser warna yang di bawahnya, dan itu disengaja: warna
   *  mengikuti POSISI di legenda, bukan menempel selamanya pada satu kode. */
  const [banding, setBanding] = useState<string[]>([])
  /** Lilin pembanding yang sudah diunduh, per kode. Array kosong = sudah
   *  dicoba tapi gagal — bukan "belum dicoba", supaya efek pengunduh tak
   *  mengulang permintaan yang sama tanpa henti. */
  const [dataBanding, setDataBanding] = useState<Record<string, LilinData[]>>({})
  /**
   * Tanggal lilin PERTAMA yang terlihat — basis normalisasi persen.
   *
   * Wajib disebut di legenda. Skala persentase lightweight-charts mengukur
   * tiap seri dari titik pertama yang TERLIHAT, jadi angkanya berubah begitu
   * pembacanya menggeser atau memperbesar sumbu waktu. "+18%" tanpa keterangan
   * "relatif terhadap kapan" adalah angka yang tak bisa ditafsirkan sama
   * sekali — dan tetap terlihat masuk akal, yang justru membuatnya berbahaya.
   */
  const [basisPersen, setBasisPersen] = useState<string | null>(null)

  /* ---------------- Bar replay (#187) ---------------- */

  /**
   * Berapa lilin PERTAMA yang ditampilkan saat replay hidup; `null` = replay
   * mati (seluruh rentang tergambar).
   *
   * Ini satu-satunya tuas replay, dan letaknya sengaja di HULU: pemotongan
   * dilakukan pada `lilin`/`volume` sebelum indikator, pola, legenda, dan
   * penanda dihitung — semuanya turunan dari dua array itu. Memotong di
   * hilir (mis. cuma di `setData` seri harga) akan membuat MA 20 tetap
   * dihitung dari data penuh sementara lilinnya mundur: seluruh guna replay
   * hilang, dan TIDAK ADA satu pun galat yang menandainya.
   */
  const [replay, setReplay] = useState<number | null>(null)
  const [putar, setPutar] = useState(false)
  const [kecepatan, setKecepatan] = useState<string>('2')
  /** Panel indikator (pane > 0) yang sedang dilipat — tanda `^` di legendanya. */
  /**
   * Panel yang sedang dilipat — berkunci **id instans**, bukan indeks pane.
   *
   * Versi pertama menyimpan indeks, dan indeks panel bergeser terus: hapus
   * satu indikator, sembunyikan lewat ikon mata, gabungkan ke panel harga,
   * atau kembalikan volume — semuanya menomori ulang panel di bawahnya.
   * Seorang agen penyanggah menemukan tiga gejalanya, semuanya terlihat di
   * layar: panel yang MEMBUKA SENDIRI, panel baru yang LAHIR terlipat, dan —
   * yang terburuk — panel %K pola yang terkunci jadi bilah tipis 18% padahal
   * panel pola tak punya baris legenda, jadi tombol bukanya tak pernah ada.
   *
   * Ironisnya alasan untuk tidak menyimpan nomor panel sudah ditulis panjang
   * lebar di `DaftarInstans.tsx` — lalu `lipat` menyimpannya.
   */
  const [lipat, setLipat] = useState<string[]>([])
  // Bertambah tiap seri harga dibuat ulang. Efek-efek yang MENEMPEL pada seri
  // harga (data, warna, garis leher pola) memakainya sebagai dependensi:
  // tanpa itu mereka tak tahu serinya sudah berganti dan tetap memegang seri
  // yang sudah dibongkar — grafiknya kosong tanpa satu pun galat.
  const [versiSeriHarga, setVersiSeriHarga] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  // Bungkus kanvas — acuan posisi legenda dalam-kanvas (lihat `posPane`).
  const bungkusRef = useRef<HTMLDivElement>(null)
  // Panel utuh (bilah atas + kanvas + kaki) — sasaran tombol layar penuh.
  const panelRef = useRef<HTMLElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  /**
   * Perbesar/perkecil rentang waktu yang terlihat, berpusat di TENGAH layar.
   * Tombol nyata, bukan cuma roda tikus — di telepon roda tikus tak ada, dan
   * cubit dua jari tak selalu terbaca sebagai zoom di dalam kanvas yang juga
   * menangkap geseran. `faktor > 1` memperkecil (rentang melebar).
   */
  const zoom = useCallback((faktor: number) => {
    const skala = chartRef.current?.timeScale()
    const r = skala?.getVisibleLogicalRange()
    if (!skala || !r) return
    const tengah = (r.from + r.to) / 2
    const separuh = ((r.to - r.from) / 2) * faktor
    // Rentang logis boleh melewati ujung data (itu yang membuat ada ruang
    // kosong di kanan seperti bawaan chart), jadi tak perlu dijepit ke
    // [0, jumlahLilin] — menjepitnya justru membuat zoom terasa mentok.
    skala.setVisibleLogicalRange({ from: tengah - separuh, to: tengah + separuh })
  }, [])

  // Titik yang sedang disorot kursor: waktunya (waktu internal) DAN letaknya
  // di dalam kanvas. `null` berarti "belum disentuh, pakai titik TERAKHIR"
  // (legenda tetap berguna sebelum pembaca menyentuh kanvas sama sekali).
  //
  // Letaknya ikut disimpan karena tooltip pola harus muncul DI DEKAT
  // penandanya; tooltip yang selalu di pojok memaksa mata bolak-balik antara
  // penanda dan keterangannya, dan itu persis kerja yang tooltipnya harusnya
  // hilangkan.
  // B33 — garis bantu kanvas. Disimpan sebagai satu objek, bukan dua state
  // terpisah, karena keduanya berjalan bersama ke template dan ke chart.
  /**
   * Menu klik kanan di kanvas (B32).
   *
   * Sebelum ini, klik kanan di kanvas memunculkan menu bawaan peramban —
   * "Save image as / Copy image / Inspect" — yaitu menu untuk sebuah GAMBAR,
   * bukan untuk sebuah chart.
   *
   * Isinya diturunkan dari menu TradingView yang dibaca langsung 21 Agu 2026,
   * tapi hanya butir yang punya arti di sini: reset tampilan, salin harga di
   * titik klik, hapus objek di titik itu, dan sakelar garis bantu. Butir
   * TradingView yang lain menuntut akun broker (Buy/Sell/Add order), sistem
   * peringatan (Add alert), atau fitur yang belum kita punya — memajangnya
   * sebagai butir mati akan membuat menunya berbohong.
   *
   * Yang ditiru bukan daftarnya melainkan SIFATNYA: menu itu tahu apa yang
   * ada di titik yang diklik dan menyebut jumlahnya ("Remove 2 indicators"),
   * bukan menu statis yang sama di mana pun diklik.
   */
  const [menuKonteks, setMenuKonteks] = useState<{ x: number; y: number; waktu: string | null; harga: number | null } | null>(null)

  /**
   * Volume: menempel di dasar panel harga, atau panel sendiri.
   *
   * Johan 21 Agu 2026: "panel 2 sudah ada? volumen sendiri, stochastic juga
   * sendiri". Bawaannya tetap menempel — itu perilaku yang sudah berjalan,
   * dan mengubahnya diam-diam akan menggeser tinggi kanvas semua orang.
   */
  const [volumePanel, setVolumePanel] = useState<'harga' | 'sendiri'>('harga')

  const [grid, setGrid] = useState<SetelanGrid>(GRID_BAWAAN)
  // Template pindah ke dalam modal (Johan 21 Agu 2026: "jadikan icon saja").
  const [templateBuka, setTemplateBuka] = useState(false)

  const [sorot, setSorot] = useState<{ waktu: string; x: number; y: number } | null>(null)
  /** Instans mana yang MODAL setelannya sedang terbuka (id), null = tak ada. */
  const [setelanTerbuka, setSetelanTerbuka] = useState<string | null>(null)
  /** Modal setelan gambar (warna/tebal/gaya garis) TERPILIH — #185 lanjutan,
   *  Johan: "line gak ada setup modal warna ketebalan ketipisan". Terpisah
   *  dari `setelanTerbuka` (itu punya instans indikator/pola, tipe & sumber
   *  datanya beda sama sekali). */
  const [setelanGambarBuka, setSetelanGambarBuka] = useState(false)

  /**
   * Katalog indikator pustaka — `null` selagi belum dimuat.
   *
   * Dimuat SESUAI PERMINTAAN, bukan saat halaman dibuka: bundelnya 1,9 MB dan
   * sebagian besar pembaca /grafik tak pernah membuka menu indikator sama
   * sekali. Pemicunya dua, dan keduanya perlu:
   * 1. pembaca menyentuh menu ƒx Indikator (menunya memang butuh isinya), dan
   * 2. template yang dimuat membawa instans `p:` (garisnya harus tergambar
   *    tanpa pembacanya perlu membuka menu apa pun).
   */
  const [katalog, setKatalog] = useState<Katalog | null>(null)
  const mintaKatalog = useCallback(() => {
    // `muatKatalog` sendiri sudah menyimpan janjinya, jadi memanggilnya
    // berkali-kali (tiap sentuhan menu) tak mengunduh berkali-kali.
    //
    // Katalog KOSONG tak pernah disimpan. `muatKatalog()` menjawab dengan Map
    // kosong kalau impor dinamisnya gagal — dan itu benar-benar terjadi di
    // produksi: berkas program dipecah per-chunk dengan hash, jadi tab yang
    // sudah terbuka sebelum sebuah rilis meminta chunk yang tak ada lagi.
    // Ia sendiri sudah melepas janjinya supaya percobaan berikutnya benar-benar
    // mencoba lagi; yang tak ikut dilepas adalah state di sini. Begitu Map
    // kosong tersimpan, `lama ?? k` membuat SETIAP percobaan berikutnya
    // ditolak oleh nilai gagal itu — menu berhenti di "Memuat katalog
    // pustaka…" selamanya dan indikator pustaka tak pernah tergambar, tanpa
    // satu pun galat di layar. Dilaporkan Johan 20 Agu 2026 sebagai "pakai
    // indikator apa gak muncul".
    void muatKatalog().then((k) => { if (k.size > 0) setKatalog((lama) => lama ?? k) })
  }, [])

  // Ruas kaya (nilai transaksi, frekuensi, aliran asing, saham beredar) —
  // fetch TERPISAH dari `ohlc/` (lihat `ohlcvKaya.ts`). Cakupannya lebih
  // pendek (sejak ±2004, IHSG sejak 1997-07-01); baris status di bawah
  // menjatuhkan balik dengan jujur kalau tanggal yang disorot lebih tua.
  const kaya = useOhlcvKaya(kode)

  // Satu emiten, satu fetch — sama seperti SeasonalityHarian, BUKAN memuat
  // seluruh 963 berkas OHLC sekaligus.
  useEffect(() => {
    let batal = false
    setBerkas(null)
    setGalat(null)
    fetch(`/data-idx/json/ohlc/${kode}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: BerkasOhlcEmiten) => { if (!batal) setBerkas(d) })
      .catch((e: unknown) => { if (!batal) setGalat(pesanGalat(e, `Gagal memuat data harga ${kode}.`)) })
    return () => { batal = true }
  }, [kode])

  /**
   * Lilin emiten PEMBANDING — berkas yang sama dengan emiten utama
   * (`ohlc/<KODE>.json`), termasuk `ohlc/IHSG.json` untuk indeks komposit.
   *
   * Kode yang sudah ada isinya dilewati, jadi menghapus lalu menambahkan lagi
   * pembanding yang sama tidak mengunduh ulang. Kegagalan disimpan sebagai
   * array KOSONG, bukan dibiarkan tak terisi: tanpa itu efek ini mencoba
   * berulang kali kode yang memang tak punya berkas.
   */
  useEffect(() => {
    let batal = false
    for (const k of banding) {
      if (dataBanding[k]) continue
      fetch(`/data-idx/json/ohlc/${k}.json`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((d: BerkasOhlcEmiten) => {
          // Warna volume tak dipakai di sini (pembanding digambar sebagai
          // garis harga saja), jadi keduanya kosong.
          if (!batal) setDataBanding((x) => ({ ...x, [k]: keDataLilinVolume(d.d, '', '').lilin }))
        })
        .catch(() => { if (!batal) setDataBanding((x) => ({ ...x, [k]: [] })) })
    }
    return () => { batal = true }
  }, [banding, dataBanding])

  /**
   * Lilin INTRADAY — ditarik saat emiten/kerangka intraday dipilih, bukan
   * dipanen massal: halaman ini membuka SATU emiten pada satu waktu, dan
   * memanen 963 emiten × empat kerangka dari sumber pihak ketiga demi satu
   * yang sedang dibaca adalah biaya yang tak pernah kembali.
   *
   * Warnanya diisi netral di sini dan ditimpa mengikuti tema di memo `lilin`
   * di bawah — kalau warna ditentukan di sini, menukar tema akan memaksa
   * unduhan ulang seluruh riwayat intradaynya.
   */
  const [intra, setIntra] = useState<{ lilin: LilinData[]; volume: VolumeData[] } | null>(null)
  const [galatIntra, setGalatIntra] = useState<string | null>(null)
  const [muatIntra, setMuatIntra] = useState(false)
  useEffect(() => {
    if (!intraday(kerangka)) { setIntra(null); setGalatIntra(null); setMuatIntra(false); return }
    let batal = false
    // Audit #10: pembatalnya SUNGGUHAN — permintaan jaringan ikut diputus
    // saat kode/kerangka berganti, bukan cuma hasilnya yang dibuang.
    const kontrol = new AbortController()
    setIntra(null)
    setGalatIntra(null)
    setMuatIntra(true)
    ambilIntraday(kode, kerangka, '#38B77E', '#E6635A', kontrol.signal)
      .then((d) => { if (!batal) setIntra(d) })
      .catch((e: unknown) => {
        if (!batal) setGalatIntra(pesanGalat(e, `Gagal memuat lilin ${kerangka} untuk ${kode}.`))
      })
      .finally(() => { if (!batal) setMuatIntra(false) })
    return () => { batal = true; kontrol.abort() }
  }, [kode, kerangka])

  /**
   * URL menyusul keadaan halaman — `replace`, BUKAN `push`.
   *
   * Dengan `push`, tombol Kembali peramban berubah jadi riwayat tiap emiten
   * yang pernah dibuka: menekan Kembali sekali dari BBRI tidak mengembalikan
   * pembaca ke halaman asalnya, melainkan ke emiten sebelumnya di halaman yang
   * sama. Enam emiten dilihat berarti enam kali Kembali sebelum benar-benar
   * keluar.
   */
  // Audit 21 Agu 2026 (#9): pembanding yang sama dengan emiten UTAMA dibuang
  // saat `kode` berganti — guard di menu cuma mencegah MENAMBAH, tak menjaga
  // ulang setelah pindah saham. Tanpa ini, membandingkan BBCA vs TLKM lalu
  // pindah utama ke TLKM menggambar TLKM dua kali: garis 0% dobel dan
  // legendanya tampil kembar.
  useEffect(() => {
    setBanding((x) => (x.includes(kode) ? x.filter((k) => k !== kode) : x))
  }, [kode])

  useEffect(() => {
    setParam((lama) => {
      const baru = new URLSearchParams(lama)
      baru.set('kode', kode)
      // Kerangka bawaan tak ditulis: URL terpendek yang tetap tepat, dan
      // tautan '?kode=BBRI' yang dibagikan orang tetap terbaca apa adanya.
      if (kerangka === KERANGKA_BAWAAN) baru.delete('tf')
      else baru.set('tf', kerangka)
      return baru
    }, { replace: true })
    // `setParam` sengaja tak masuk deps: identitasnya berganti tiap render
    // react-router, dan efek yang bergantung padanya berjalan tanpa henti.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kode, kerangka])

  /**
   * Kode dari URL yang bukan emiten mana pun — dijatuhkan ke bawaan DAN
   * disebut di layar. Diperiksa di sini, bukan saat membaca URL, karena kamus
   * emiten tiba belakangan (fetch tersendiri).
   *
   * Yang TIDAK dilakukan: membiarkan fetch OHLC-nya gagal dan menampilkan
   * "Gagal memuat data harga". Pesan itu terbaca sebagai gangguan jaringan,
   * padahal yang salah kodenya — dua masalah yang penanganannya berbeda.
   */
  useEffect(() => {
    if (!kamus || kamus.emiten.length === 0) return
    if (kamus.emiten.some((e) => e.kode === kode)) return
    setKodeAsing(kode)
    setKode(DEFAULT_KODE)
  }, [kamus, kode])

  /** Pembaca memilih emiten dari kotak cari. Di sinilah pemberitahuan "kode
   *  tak dikenal" dibuang — BUKAN di efek pemeriksa di atas: efek itu berjalan
   *  lagi sesaat setelah jatuh ke bawaan, dan membuang pemberitahuannya di
   *  sana berarti pemberitahuan itu tak pernah sempat terlihat sama sekali
   *  (terukur 18 Agu 2026: `?kode=ZZZZ` diam-diam membuka BBCA). */
  const pilihEmiten = useCallback((k: string) => {
    setKode(k)
    setCari('')
    setKodeAsing(null)
  }, [])

  // Pola kotak cari + saran — disalin dari SeasonalityHarian.tsx, sumbernya
  // kamusEmiten.ts (963 emiten, sudah dimuat halaman lain juga lewat hook
  // yang sama, jadi tak ada unduhan berlipat kalau kedua halaman dibuka).
  const saran = useMemo(() => {
    const q = cari.trim().toUpperCase()
    if (!kamus || q.length < 1) return []
    return kamus.emiten.filter((e) => e.kode.startsWith(q) || e.nama.toUpperCase().includes(q)).slice(0, 8)
  }, [kamus, cari])

  // Seri harga: lilin ATAU garis, ditukar lewat `jenisChart`. Disimpan
  // sebagai ISeriesApi<SeriesType> karena jenisnya berganti saat berjalan;
  // yang butuh jenis pastinya menanyakannya lewat `seriesType()`, bukan
  // menebak dari state di sebelahnya.
  const hargaRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  // Seri indikator. Dulu satu ref per garis; sekarang jumlahnya mengikuti
  // jumlah instans (tak terbatas), jadi disimpan sebagai daftar dan dibongkar
  // seluruhnya tiap kali disusun ulang. RSI/MACD tetap dapat pane TERPISAH di
  // bawah panel harga (jalur pane native lightweight-charts 5.x,
  // `addSeries(..., paneIndex)` — bukan chart kedua yang sumbu waktunya harus
  // disinkron manual: satu chart, beberapa pane, sumbu waktu otomatis selaras).
  const seriIndRef = useRef<Array<ISeriesApi<SeriesType>>>([])
  // Garis emiten pembanding (#187) — dibongkar-pasang seluruhnya tiap daftar/
  // data berubah, sama polanya dengan seri indikator di atas.
  const seriBandingRef = useRef<Array<ISeriesApi<'Line'>>>([])
  // Apakah replay SUDAH aktif pada render sebelumnya — dipakai memutuskan
  // kapan `fitContent()` boleh dipanggil (lihat efek setData).
  const replayAktifRef = useRef(false)
  // Gambar pola: garis leher (price line) + penanda di lembah/leher/penembusan.
  // Keduanya API bawaan lightweight-charts, BUKAN <div> melayang yang
  // posisinya dihitung sendiri — posisi hitungan sendiri langsung meleset
  // begitu pembaca menggeser atau memperbesar sumbu waktunya.
  const garisLeherRef = useRef<IPriceLine[]>([])
  const penandaRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  // Penanda pola berbasis volume duduk di seri VOLUME — plugin sendiri,
  // supaya tak berebut tempat dengan penanda pola berbasis harga.
  const penandaVolRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  // Watermark kode emiten di latar area harga. Dipakai plugin BAWAAN
  // lightweight-charts v5 (`createTextWatermark`) — sudah menggambar di
  // lapisan kanvas yang benar, di belakang lilin, dan ikut berpindah sendiri
  // saat pane berubah ukuran.
  const watermarkRef = useRef<ITextWatermarkPluginApi<Time> | null>(null)

  // Chart dibuat SEKALI saat mount (bukan tiap ganti emiten/rentang) — data &
  // warnanya diperbarui lewat setData()/applyOptions() di efek-efek di bawah.
  // autoSize:true memasang ResizeObserver sendiri di containerRef, jadi tak
  // perlu listener resize manual.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const chart = createChart(el, {
      autoSize: true,
      // Bawaan lightweight-charts memberi label bulan berbahasa Inggris
      // ("Oct", "Dec", "May") — di situs yang seluruhnya berbahasa Indonesia
      // itu terbaca seperti komponen pinjaman yang lupa diterjemahkan.
      // `locale` mengurus tooltip & harga; label sumbu waktu punya jalurnya
      // sendiri lewat `tickMarkFormatter`, jadi keduanya perlu disetel.
      localization: {
        locale: 'id-ID',
        dateFormat: 'dd MMM yyyy',
      },
      // attributionLogo:false MEMATIKAN logo TradingView bawaan di pojok
      // kanvas — chart ini gambar data PAPAN sendiri, bukan produk
      // TradingView. INI BUKAN sekadar hiasan yang bebas dihapus: lisensi
      // Apache 2.0 lightweight-charts MEWAJIBKAN atribusi ("This license
      // requires specifying TradingView as the product creator... You shall
      // add the attribution notice... and a link to
      // https://www.tradingview.com/ to the page... available to your
      // users" — README.md lightweight-charts). `attributionLogo` cuma
      // salah satu CARA memenuhi syarat itu; mematikannya TANPA mengganti
      // = melanggar lisensi. Gantinya: baris atribusi di kaki situs global
      // (DasborLayout.tsx) — jangan hapus baris itu juga.
      layout: { background: { color: 'transparent' }, attributionLogo: false },
      // Bawaan crosshair = Magnet: garis horizontal MELEKAT ke close bar
      // terdekat, bukan mengikuti kursor. Normal membebaskan garisnya;
      // pembacaan O/H/L/C/V di header tetap snap ke bar karena datang dari
      // subscribeCrosshairMove, jadi hasilnya garis-bebas + data-snap.
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { labelVisible: true },
        horzLine: { labelVisible: true },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        tickMarkFormatter: (waktu: unknown, tipe?: number) => {
          // Intraday datang sebagai epoch detik. `tipe` (TickMarkType) 0–2
          // berarti "ini pergantian tahun/bulan/hari" — di situ tanggalnya
          // yang berguna, di antaranya jamnya. Tanpa pembedaan ini, sumbu
          // kerangka 5 menit cuma berisi deretan jam tanpa satu pun petunjuk
          // hari apa yang sedang dilihat.
          if (typeof waktu === 'number') {
            const s = dariEpoch(waktu)
            return tipe !== undefined && tipe <= 2
              ? `${s.slice(8, 10)} ${BULAN[Number(s.slice(5, 7)) - 1]}`
              : s.slice(11)
          }
          const d = typeof waktu === 'string' ? new Date(waktu) : new Date(Number(waktu) * 1000)
          if (Number.isNaN(d.getTime())) return ''
          // Januari menampilkan tahunnya — penanda pergantian tahun di sumbu
          // yang rentangnya bertahun-tahun.
          return d.getMonth() === 0 ? String(d.getFullYear()) : BULAN[d.getMonth()]
        },
      },
      // vertTouchDrag:false — geser jari VERTIKAL di atas kanvas tetap
      // menggulung HALAMAN, bukan ditelan chart. Sama dengan alasan
      // `touch-action: pan-y` di hit-rect SVG SeasonalityHarian (#172):
      // horizontal (zoom/geser rentang waktu) tetap milik chart, vertikal
      // milik halaman.
      handleScroll: { vertTouchDrag: false },
    })
    // Volume duduk di 22% bawah panel yang sama; seri harga memakai sisanya —
    // pola resmi lightweight-charts utk "volume di panel bawah" tanpa perlu
    // chart terpisah yang harus disinkronkan manual. Volume dibuat DI SINI
    // (bukan bersama seri harga) supaya pane 0 tak pernah kosong saat jenis
    // chart ditukar: pane yang kehilangan seri terakhirnya ikut dibongkar,
    // dan bersamanya watermark yang menempel padanya.
    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol' })
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
    chartRef.current = chart
    volRef.current = vol
    penandaVolRef.current = createSeriesMarkers(vol, [])
    const pane0 = chart.panes()[0]
    if (pane0) watermarkRef.current = createTextWatermark(pane0, { horzAlign: 'center', vertAlign: 'center', lines: [] })
    // Hook QA dev-only — verifikasi zoom/geser butuh rentang waktu yang
    // TERLIHAT (bukan cuma data yang di-setData), dan lightweight-charts
    // menggambar lewat canvas (tak ada teks DOM buat dibaca devtools).
    // `import.meta.env.DEV` di-tree-shake Vite di build produksi.
    if (import.meta.env.DEV) (el as HTMLDivElement & { __papanChart?: unknown }).__papanChart = chart
    // Legenda ikut kursor: waktu titik yang disorot dipakai mencari nilai
    // tiap indikator aktif (lihat `legenda` di bawah). `param.time` kosong
    // saat kursor keluar dari kanvas — dibiarkan `null` supaya legenda jatuh
    // balik ke titik TERAKHIR, bukan hilang.
    // crosshairMove menembak per gerakan pointer (bisa >100 Hz di mouse
    // gaming), dan setState langsung di situ me-render ulang seluruh komponen
    // per gerakan. Ditampung dulu, ditulis sekali per frame lewat rAF —
    // gerakan di dalam satu frame yang sama digabung jadi satu render.
    let sorotTunda: { waktu: string; x: number; y: number } | null = null
    let sorotRaf = 0
    const saatGeserKursor = (param: MouseEventParams<Time>) => {
      // `dariWaktuChart` mengembalikan waktu INTERNAL — untuk intraday, epoch
      // yang dilaporkan chart dikembalikan ke bentuk 'yyyy-mm-dd HH:mm' yang
      // dipakai seluruh peta legenda & pencarian penanda.
      const w = dariWaktuChart(param.time)
      if (w && param.point) {
        sorotTunda = { waktu: w, x: param.point.x, y: param.point.y }
      } else if (window.matchMedia('(hover: hover)').matches) {
        // Sorotan DIBUANG hanya di perangkat ber-hover. Di telepon, crosshair
        // ikut hilang begitu jari diangkat — membuang sorotan di situ berarti
        // tooltip lenyap sepersekian detik sesudah diketuk, tanpa pernah
        // sempat dibaca. Di sana ia bertahan sampai ketukan berikutnya.
        sorotTunda = null
      } else {
        return
      }
      if (!sorotRaf) {
        sorotRaf = requestAnimationFrame(() => {
          sorotRaf = 0
          setSorot(sorotTunda)
        })
      }
    }
    chart.subscribeCrosshairMove(saatGeserKursor)
    // Klik/ketuk ikut dilanggan supaya tooltip pola punya jalur SENTUH: di
    // telepon tak ada hover sama sekali, dan crosshair cuma bergerak selagi
    // jari menempel — sekali diangkat, keterangannya lenyap sebelum sempat
    // dibaca. Ketukan menahannya sampai ketukan berikutnya.
    chart.subscribeClick(saatGeserKursor)
    return () => {
      if (sorotRaf) cancelAnimationFrame(sorotRaf)
      chart.unsubscribeCrosshairMove(saatGeserKursor)
      chart.unsubscribeClick(saatGeserKursor)
      chart.remove()
      chartRef.current = null
      hargaRef.current = null
      volRef.current = null
      penandaRef.current = null
      penandaVolRef.current = null
    }
  }, [])

  /**
   * Seri harga — dibuat ulang tiap kali jenis chart ditukar. Urutannya
   * menentukan: seri BARU dipasang dulu, baru yang lama dibongkar. Terbalik,
   * pane 0 sempat kehilangan seluruh seri harganya, dan pane yang kosong
   * ikut dibongkar lightweight-charts bersama apa pun yang menempel padanya.
   */
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const lama = hargaRef.current
    const baru: ISeriesApi<SeriesType> = jenisChart === 'lilin'
      ? chart.addSeries(CandlestickSeries)
      : chart.addSeries(LineSeries, { lineWidth: 2, priceLineVisible: false })
    baru.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.26 } })
    hargaRef.current = baru
    if (lama) {
      // Garis leher milik seri lama ikut mati bersamanya — dilepas dari
      // daftar TANPA removePriceLine (serinya sudah tak ada; memanggilnya di
      // atas seri mati itu galat). Efek pola menggambarnya ulang.
      garisLeherRef.current = []
      chart.removeSeries(lama)
    }
    // Plugin penanda menempel pada SERI, bukan chart — harus dipasang ulang
    // di seri yang baru, kalau tidak penanda pola lenyap begitu jenis chart
    // ditukar dan tak pernah kembali sampai halaman dimuat ulang.
    penandaRef.current = createSeriesMarkers(baru, [])
    setVersiSeriHarga((v) => v + 1)
  }, [jenisChart])

  /**
   * Alat gambar (#185) — bilah kiri kanvas ala TradingView. Seluruh orkestrasi
   * (pustaka dinamis, manager, klik-klik tempel titik, kuas, penyimpanan per
   * emiten) ada di `useAlatGambar.ts`; berkas ini cuma menyerahkan ref chart/
   * seri/kontainer yang SUDAH ADA dan merender `<AlatGambar>`. Diletakkan
   * SESUDAH efek pembuatan chart & seri harga (di atas) supaya begitu efek
   * internal hook ini berjalan, `chartRef.current`/`hargaRef.current` sudah
   * terisi — urutan efek React mengikuti urutan pemanggilan hook di sini.
   */
  const alatGambar = useAlatGambar({
    chartRef, seriesRef: hargaRef, containerRef, kode, versiSeriHarga,
  })
  // Modal setelan gambar wajib tertutup begitu tak ada lagi yang terpilih —
  // gambar bisa lepas terpilih dari luar modal (klik kanvas kosong, Escape,
  // hapus lewat Delete), dan modal yang tetap terbuka menyetel gambar yang
  // sudah tak ada akan diam-diam menerapkan patch ke `getSelectedDrawing()`
  // berikutnya yang kebetulan terpilih — bukan yang pembaca kira sedang diatur.
  useEffect(() => {
    if (!alatGambar.adaTerpilih) setSetelanGambarBuka(false)
  }, [alatGambar.adaTerpilih])

  // Sumbu waktu menampilkan JAM hanya pada kerangka intraday. Disetel di efek
  // sendiri (bukan di opsi pembuatan chart) karena kerangkanya bisa ditukar
  // kapan saja tanpa membangun ulang chart-nya.
  useEffect(() => {
    chartRef.current?.applyOptions({
      timeScale: { timeVisible: intraday(kerangka), secondsVisible: false },
    })
  }, [kerangka])

  // Mode skala sumbu kanan (`%` / `log`) + auto-fit. Ikut `versiSeriHarga`
  // supaya setelan bertahan saat jenis chart ditukar — seri barunya memakai
  // skala 'right' yang sama, tapi opsinya harus dipasang ulang sesudah seri
  // lama dibongkar.
  //
  // Selagi ada pembanding, mode DIPAKSA persentase — bukan disarankan.
  // Menumpuk BBCA (6.300) dan INET (288) di sumbu rupiah membuat yang kecil
  // jadi garis rata di dasar kanvas: perbandingannya bukan cuma sulit dibaca,
  // ia salah. Chip `%`/`log` ikut dikunci di kaki supaya keadaan yang
  // tergambar dan chip yang tersorot mustahil berbeda.
  useEffect(() => {
    const mode = banding.length > 0 ? 2 : (MODE_SKALA.find(([id]) => id === modeSkala)?.[2] ?? 0)
    chartRef.current?.priceScale('right').applyOptions({ mode, autoScale: autoSkala })
  }, [modeSkala, autoSkala, versiSeriHarga, banding.length])

  // Warna dibaca dari getComputedStyle DI DALAM .lantai (containerRef ada di
  // bawah wrapper .lantai) — token --green/--red/--line/--text2 didefinisikan
  // di situ, BUKAN di :root (lantai.css §Bagian 2), jadi document.documentElement
  // tidak akan punya nilainya. lightweight-charts tidak reaktif ke CSS sendiri,
  // jadi diterapkan ulang tiap `theme` berganti lewat applyOptions().
  useEffect(() => {
    const chart = chartRef.current
    const el = containerRef.current
    if (!chart || !el) return
    const cs = getComputedStyle(el)
    const baca = (nama: string) => cs.getPropertyValue(nama).trim()
    const line = baca('--line')
    const text2 = baca('--text2')
    const green = baca('--green')
    const red = baca('--red')
    chart.applyOptions({
      layout: { textColor: text2 },
      // `visible` DAN warna beralfa dipakai bersama, bukan salah satu:
      // menyembunyikan grid dengan alfa 0 tetap membuat lightweight-charts
      // menggambar garisnya (kerja sia-sia tiap frame), sementara `visible`
      // saja tak bisa memberi tingkat transparansi di antaranya.
      grid: {
        vertLines: { color: warnaGrid(line, grid.alfa), visible: grid.tampil },
        horzLines: { color: warnaGrid(line, grid.alfa), visible: grid.tampil },
      },
      rightPriceScale: { borderColor: line },
      timeScale: { borderColor: line },
    })
    const harga = hargaRef.current
    if (harga?.seriesType() === 'Candlestick') {
      (harga as ISeriesApi<'Candlestick'>).applyOptions({
        upColor: green, downColor: red, borderUpColor: green, borderDownColor: red,
        wickUpColor: green, wickDownColor: red,
      })
    } else if (harga?.seriesType() === 'Line') {
      // Garis harga tunggal tak punya arah naik/turun per titik — dipakai
      // token --amber, warna aksen situs, bukan hijau atau merah yang di sini
      // akan mengaku tahu sesuatu yang tak diketahuinya.
      (harga as ISeriesApi<'Line'>).applyOptions({ color: baca('--amber') })
    }
  }, [theme, versiSeriHarga, grid])

  // Watermark kode emiten — ikut berganti saat emiten diganti, dan warnanya
  // dibaca ulang tiap tema ditukar.
  useEffect(() => {
    const el = containerRef.current
    if (!el || !watermarkRef.current) return
    const teks = getComputedStyle(el).getPropertyValue('--text').trim() || '#888D99'
    watermarkRef.current.applyOptions({
      visible: true,
      lines: [{
        text: kode,
        // Sangat redup: watermark ini duduk persis di belakang lilin, dan
        // apa pun yang lebih pekat mulai mengganggu isi yang justru datang
        // untuk dibaca.
        color: warnaSamar(teks, 0.08),
        fontSize: 76,
        fontFamily: "'IBM Plex Mono', Consolas, ui-monospace, monospace",
        fontStyle: 'bold',
      }],
    })
  }, [kode, theme])

  /**
   * SELURUH lilin + volume yang dimuat, dari tiga jalur yang menyatu di satu
   * bentuk: intraday dari Yahoo, harian dari berkas lokal, pekanan/bulanan
   * DIRAKIT dari harian.
   *
   * TIDAK dipotong chip rentang kaki. Dulu dipotong di sini, dan itu membuat
   * chip rentang mengubah ANGKA, bukan cuma pandangan: RSI/EMA/MACD/ATR
   * menyemai bibitnya di batas rentang, jadi RSI 14 pada tanggal yang sama
   * membaca beda di "1M" dan di "Semua"; MA 200 lenyap tanpa pesan di rentang
   * pendek; pencarian pola menemukan pola yang berbeda per chip karena ATR-nya
   * ikut bergeser. Chip rentang sekarang murni jendela pandang —
   * `setVisibleLogicalRange` di bawah, bukan `slice`.
   *
   * Ikut `theme` di deps supaya warna volume (dihitung per-batang, beda dari
   * upColor/downColor seri lilin yang cukup lewat applyOptions) ikut berubah
   * saat tema diganti — termasuk untuk lilin intraday yang tak boleh diunduh
   * ulang cuma karena temanya ditukar.
   */
  const penuh = useMemo(() => {
    const cs = containerRef.current ? getComputedStyle(containerRef.current) : null
    const green = cs?.getPropertyValue('--green').trim() || '#38B77E'
    const red = cs?.getPropertyValue('--red').trim() || '#E6635A'
    let dasar: { lilin: LilinData[]; volume: VolumeData[] } | null = null
    if (intraday(kerangka)) {
      dasar = intra
    } else if (berkas) {
      dasar = keDataLilinVolume(berkas.d, green, red)
      if (kerangka === 'W') dasar = rakitBar(dasar.lilin, dasar.volume, kunciPekan, green, red)
      else if (kerangka === 'M') dasar = rakitBar(dasar.lilin, dasar.volume, kunciBulan, green, red)
    }
    if (!dasar || dasar.lilin.length === 0) return { lilin: [], volume: [] }
    const d = dasar
    const vol = d.volume.map((v, i) => ({
      ...v, color: d.lilin[i].close >= d.lilin[i].open ? green : red,
    }))
    return { lilin: d.lilin, volume: vol }
  }, [berkas, intra, kerangka, theme])

  /**
   * Indeks lilin PERTAMA yang masuk chip rentang kaki — satu-satunya bekas
   * chip rentang di sisi data, dan ia cuma dipakai sebagai batas kiri jendela
   * pandang (`setVisibleLogicalRange`) serta titik awal Bar replay.
   *
   * Batasnya dihitung dari lilin TERAKHIR yang ada, bukan dari hari ini: data
   * berhenti beberapa hari sebelum "sekarang" kalau panen belum jalan, dan
   * menghitung dari hari ini memotong lilin terbaru yang masih ada.
   */
  const awalRentang = useMemo(() => {
    const n = penuh.lilin.length
    if (n === 0) return 0
    const akhir = penuh.lilin[n - 1].time.slice(0, 10)
    const [, hari] = RENTANG_KAKI.find(([l]) => l === rentangLabel) ?? RENTANG_KAKI[RENTANG_KAKI.length - 1]
    const batas = batasBawahHari(akhir, hari)
    if (!batas) return 0
    const i = penuh.lilin.findIndex((b) => b.time >= batas)
    return i === -1 ? 0 : i
  }, [penuh.lilin, rentangLabel])

  /**
   * Chip rentang yang tak punya riwayat untuk ditampilkan — DINONAKTIFKAN,
   * bukan disembunyikan, dengan alasannya di `title` (pola yang sama dengan
   * `title` batas riwayat di tombol kerangka).
   *
   * Yang dimatikan: setiap chip yang batas bawahnya sudah jatuh sebelum lilin
   * pertama SETELAH chip terkecil yang begitu — chip pertama yang mencakup
   * seluruh riwayat tetap bisa ditekan, yang di atasnya cuma menggambar
   * gambar yang sama persis. "Semua" tak pernah dimatikan: ia jujur apa
   * adanya, berapa pun riwayatnya. Tanpa ini, 5m/15m/30m menerima klik pada
   * 1Y/5Y lalu menggambar satu bulan tanpa satu kata pun.
   */
  const rentangOpsi = useMemo(() => {
    const n = penuh.lilin.length
    const akhir = n ? penuh.lilin[n - 1].time.slice(0, 10) : ''
    const awal = n ? penuh.lilin[0].time.slice(0, 10) : ''
    const cukup = (hari: number | null) => hari === null || batasBawahHari(akhir, hari) <= awal
    const iCukup = n ? RENTANG_KAKI.findIndex(([, hari]) => cukup(hari)) : -1
    return RENTANG_KAKI.map(([label, hari], i) => {
      const mati = iCukup !== -1 && hari !== null && i > iCukup
      return {
        id: label,
        label,
        nonaktif: mati,
        judul: mati
          ? `Riwayat ${kerangka} cuma sampai ${awal} — rentang ${label} tak punya data tambahan di luar itu`
          : undefined,
      }
    })
  }, [penuh.lilin, kerangka])

  /**
   * Lilin & volume yang benar-benar dipakai SELURUH halaman — `penuh` di atas,
   * dipotong di ujung kanan saat Bar replay hidup.
   *
   * SATU potongan, di hulu. Indikator (`garisPerInstans`), pola
   * (`polaPerInstans`), penanda, legenda, tooltip, dan garis pembanding
   * semuanya diturunkan dari dua array ini — jadi mundur di sini berarti
   * mundur di semuanya sekaligus, dan mustahil ada satu turunan yang lupa
   * ikut mundur. Itu justru kegagalan senyap yang paling mungkin di fitur ini:
   * MA 20 yang tetap dihitung dari data penuh terlihat sempurna wajar di
   * layar.
   */
  const { lilin, volume } = useMemo(() => (
    replay === null
      ? penuh
      : { lilin: penuh.lilin.slice(0, replay), volume: penuh.volume.slice(0, replay) }
  ), [penuh, replay])

  /** Waktu internal -> tipe `Time` lightweight-charts. Dipakai di SETIAP
   *  `setData`/penanda: satu-satunya tempat bentuk waktu berpindah dunia. */
  const keChart = useCallback(
    <T extends { time: string }>(arr: T[]) => arr.map((d) => ({ ...d, time: keWaktuChart(d.time) as Time })),
    [],
  )

  /**
   * EKOR WHITESPACE — 60 waktu kosong sesudah lilin terakhir (Johan 21 Agu
   * 2026: "saya seret fibo melebihi candle gak bisa").
   *
   * lightweight-charts hanya memberi `time` pada koordinat yang PUNYA bar,
   * jadi klik di area kosong kanan mengembalikan `time: null` dan alat
   * gambar menolaknya — Fibonacci tak pernah bisa berlabuh di masa depan.
   * Cara resminya persis yang dipakai TradingView: deret diberi ekor
   * whitespace ({time} tanpa harga) supaya area itu ADA di sumbu waktu.
   * Autoscale mengabaikannya, jadi skala harga tak berubah sedikit pun.
   *
   * Harian melompati akhir pekan (waktu bursa, bukan kalender); intraday
   * melangkah sebesar jarak dua bar terakhirnya.
   */
  const ekorWhitespace = useMemo(() => {
    if (lilin.length < 2) return []
    const keluar: Array<{ time: string }> = []
    const akhir = lilin[lilin.length - 1].time
    if (akhir.length <= 10) {
      const d = new Date(`${akhir}T00:00:00Z`)
      while (keluar.length < 60) {
        d.setUTCDate(d.getUTCDate() + 1)
        const hari = d.getUTCDay()
        if (hari === 0 || hari === 6) continue
        keluar.push({ time: d.toISOString().slice(0, 10) })
      }
    } else {
      const detik = (t: string) => keEpoch(t)
      const jarak = Math.max(60, detik(akhir) - detik(lilin[lilin.length - 2].time))
      let t = detik(akhir)
      for (let i = 0; i < 60; i++) { t += jarak; keluar.push({ time: dariEpoch(t) }) }
    }
    return keluar
  }, [lilin])

  useEffect(() => {
    const harga = hargaRef.current
    if (harga?.seriesType() === 'Candlestick') {
      (harga as ISeriesApi<'Candlestick'>).setData([...keChart(lilin), ...keChart(ekorWhitespace)] as never)
    } else if (harga?.seriesType() === 'Line') {
      (harga as ISeriesApi<'Line'>).setData(
        [...keChart(lilin.map((l) => ({ time: l.time, value: l.close }))), ...keChart(ekorWhitespace)] as never)
    }
    volRef.current?.setData(keChart(volume))
    // Selama replay BERJALAN, jangan pasang ulang rentang terlihat: satu
    // pemasangan per lilin membuat sumbu waktu melompat-lompat tiap langkah
    // dan lilin yang baru muncul justru tak pernah sempat dilihat. Yang tetap
    // dipasang: saat replay tak aktif (perilaku lama), dan SEKALI saat replay
    // baru dinyalakan.
    const replayAktif = replay !== null
    if (!replayAktif || !replayAktifRef.current) {
      const ts = chartRef.current?.timeScale()
      // Chip rentang = JENDELA PANDANG, bukan potongan data. Logical range
      // (indeks lilin), bukan `setVisibleRange` (waktu): batas bawah rentang
      // kerap jatuh di akhir pekan/libur bursa dan tak punya lilin sendiri,
      // dan indeksnya sudah kita punya persis.
      if (awalRentang > 0 && awalRentang < lilin.length) {
        ts?.setVisibleLogicalRange({ from: awalRentang - 0.5, to: lilin.length - 0.5 })
      } else {
        // BUKAN fitContent(): sejak ada ekor whitespace, fitContent ikut
        // memuat 60 bar kosong di kanan dan "Semua" terbuka dengan lubang.
        ts?.setVisibleLogicalRange({ from: -0.5, to: lilin.length - 0.5 })
      }
    }
    replayAktifRef.current = replayAktif
    // Angka terukur buat verifikasi/QA (bukan data sensitif — cuma jumlah &
    // rentang tanggal yang sudah tampak di sumbu chart-nya sendiri). Canvas
    // tak punya DOM per-lilin buat dibaca lewat devtools, jadi ini jalan
    // paling murah utk mengecek "berapa yang sebenarnya terpasang" tanpa
    // menambah dependency baru.
    //
    // DUA RUAS, bukan satu: sejak chip rentang jadi jendela pandang, "yang
    // dimuat" dan "yang terlihat" berbeda — dan satu nama yang menanggung dua
    // makna persis inilah yang membuat kerusakan kemarin tak terlihat.
    // `jumlahLilin`/`tglPertama`/`tglAkhir` = yang DISERAHKAN ke setData
    // (dasar seluruh indikator); `*Terlihat` = jendela yang sedang dipandang.
    const el = containerRef.current
    if (el) {
      el.dataset.jumlahLilin = String(lilin.length)
      el.dataset.tglPertama = lilin[0]?.time ?? ''
      el.dataset.tglAkhir = lilin[lilin.length - 1]?.time ?? ''
      el.dataset.jumlahTerlihat = String(Math.max(0, lilin.length - awalRentang))
      el.dataset.tglTerlihatAwal = lilin[awalRentang]?.time ?? lilin[0]?.time ?? ''
      el.dataset.tglTerlihatAkhir = lilin[lilin.length - 1]?.time ?? ''
      el.dataset.rentang = rentangLabel
      el.dataset.kerangka = kerangka
      // Jarak antar-lilin dalam DETIK — bukti bahwa tombol "5m" benar-benar
      // menarik lilin lima menit dan bukan sekadar tak melempar galat; jumlah
      // bar saja tak bisa membedakannya dari data harian yang kebetulan banyak.
      //
      // MEDIAN dari 20 jarak terakhir, bukan jarak dua lilin terakhir: lilin
      // paling ujung hampir selalu SETENGAH JADI (bursa masih buka), jadi
      // ukuran dari sana melaporkan 240 detik untuk kerangka 5 menit — angka
      // yang terlihat salah padahal datanya benar.
      const detik = (t: string) => new Date(`${t.replace(' ', 'T')}Z`).getTime() / 1000
      const jarak = lilin.slice(-21).slice(1).map((l, i) => detik(l.time) - detik(lilin.slice(-21)[i].time))
      el.dataset.jarakBar = jarak.length
        ? String(Math.round([...jarak].sort((a, b) => a - b)[Math.floor(jarak.length / 2)]))
        : ''
      // Bukti terukur bahwa replay benar-benar memotong DATA, bukan cuma
      // menyembunyikan sesuatu di layar: jumlah lilin yang terpasang dan
      // tanggal ujung kanannya ikut mundur (dua dataset di atas), dan ini
      // menyebut berapa dari total yang sedang ditampilkan.
      el.dataset.replay = replay === null ? '' : `${replay}/${penuh.lilin.length}`
    }
  }, [lilin, volume, versiSeriHarga, keChart, kerangka, replay, penuh.lilin.length,
      awalRentang, rentangLabel])

  /**
   * Garis emiten pembanding di panel harga (#187).
   *
   * Duduk di skala harga yang SAMA ('right') dengan seri utama — itu syarat
   * mode persentase lightweight-charts bekerja seperti yang dijanjikan:
   * setiap seri di skala itu dinormalkan ke titik pertamanya yang terlihat,
   * jadi keduanya berangkat dari 0% di tepi kiri jendela. Skala terpisah akan
   * menggambar dua garis yang kelihatan bisa dibandingkan padahal tidak.
   *
   * KERANGKA INTRADAY DILEWATI. Berkas pembanding harian; sumbu intraday
   * memakai epoch detik. Selain waktunya bentuk lain, membandingkan satu
   * tutup harian dengan 78 lilin lima menit menjawab pertanyaan yang sama
   * sekali berbeda. Legendanya menyebut alasannya, bukan diam.
   */
  useEffect(() => {
    const chart = chartRef.current
    const el = containerRef.current
    if (!chart || !el) return
    for (const s of seriBandingRef.current) chart.removeSeries(s)
    seriBandingRef.current = []
    if (intraday(kerangka) || lilin.length === 0) return
    const cs = getComputedStyle(el)
    banding.forEach((k, i) => {
      const d = dataBanding[k]
      if (!d || d.length === 0) return
      // Titiknya dipasang pada WAKTU LILIN UTAMA, bukan pada tanggal harian
      // pembandingnya sendiri. Dua sebab, keduanya terlihat langsung di layar:
      //
      // 1. Rentangnya otomatis ikut — termasuk ujung kanan yang sudah mundur
      //    saat Bar replay hidup. Garis pembanding yang tetap menjulur ke
      //    masa depan justru membocorkan apa yang sedang disembunyikan.
      // 2. Kerangka W/M tak jadi berlubang. Seri dengan waktu di luar waktu
      //    lilin utama MENAMBAH titik ke sumbu waktu chart, dan pada kerangka
      //    pekanan itu berarti lilin mingguan tersebar renggang di antara
      //    ~4 tanggal harian kosong milik pembandingnya.
      //
      // `tutupSampai` (bukan pencocokan persis) karena kunci lilin pekanan
      // jatuh di hari SENIN dan bulanan di TANGGAL 1 — keduanya kerap libur
      // bursa, jadi tak ada barisnya di deret harian pembanding.
      const titik: Array<{ time: Time; value: number }> = []
      for (const l of lilin) {
        const v = tutupSampai(d, l.time)
        // `null` = pembandingnya belum listing pada tanggal itu. Titiknya
        // dilewati, bukan diisi nol: nol akan tergambar sebagai jurang.
        if (v !== null) titik.push({ time: keWaktuChart(l.time) as Time, value: v })
      }
      if (titik.length === 0) return
      const s = chart.addSeries(LineSeries, {
        color: cs.getPropertyValue(WARNA_BANDING[i]).trim() || '#B48AE2',
        lineWidth: 2,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        title: k,
      }, 0)
      s.setData(titik)
      seriBandingRef.current.push(s)
    })
  }, [banding, dataBanding, lilin, kerangka, theme, versiSeriHarga])

  /**
   * Basis normalisasi persen = lilin PERTAMA yang terlihat.
   *
   * Dilanggan hanya selagi ada pembanding: tanpa pembanding tak ada yang
   * membacanya, dan langganan perubahan rentang menyala di tiap geseran
   * sumbu waktu.
   */
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || banding.length === 0) { setBasisPersen(null); return }
    const skala = chart.timeScale()
    const perbarui = () => {
      const dari = dariWaktuChart(skala.getVisibleRange()?.from)
      // Lilin pertama yang waktunya >= tepi kiri jendela — bukan tepi kirinya
      // sendiri: tepi itu bisa jatuh di akhir pekan atau di ruang kosong
      // sebelum data dimulai, dan tanggal yang tak punya lilin bukan basis
      // apa pun.
      setBasisPersen(dari ? (lilin.find((l) => l.time >= dari)?.time ?? null) : lilin[0]?.time ?? null)
    }
    skala.subscribeVisibleTimeRangeChange(perbarui)
    perbarui()
    return () => skala.unsubscribeVisibleTimeRangeChange(perbarui)
  }, [banding.length, lilin])

  // Dua daftar instans, dua menu, satu aturan main (lihat DaftarInstans).
  // Spek parameter sebuah jenis — kurasi ATAU entri katalog. Ikut `katalog` di
  // deps supaya kolom setelan instans pustaka muncul begitu katalognya tiba,
  // bukan tetap kosong sampai halaman dimuat ulang.
  const spekIndikator = useCallback(
    (jenis: JenisIndikator) => spekJenis(jenis, katalog)?.param ?? [],
    [katalog],
  )
  const ind = useDaftarInstans<JenisIndikator>(spekIndikator)
  const pol = useDaftarInstans<JenisPola>(spekPola, true)

  /**
   * Sebuah instans digambar sekarang atau tidak.
   *
   * Dua syarat, dua asal: sakelar mata di baris legenda (`tampil`) dan tab
   * Visibility di modal setelan (`sembunyiDi`). Dipisah karena artinya memang
   * berbeda — mata itu "sembunyikan sebentar", Visibility itu "jenis ini tak
   * masuk akal di kerangka ini" (mis. MA 200 di kerangka 5 menit = 16 jam
   * perdagangan, bukan 200 hari).
   */
  const digambar = useCallback(
    (inst: { tampil: boolean; sembunyiDi?: string[] }) =>
      inst.tampil && !(inst.sembunyiDi ?? []).includes(kerangka),
    [kerangka],
  )

  /**
   * Isi menu "ƒx Indikator": sepuluh kurasi PAPAN di atas, lalu seluruh
   * katalog pustaka dikelompokkan per KATEGORI REGISTRY.
   *
   * Kategorinya milik pustaka (`entri.kategori`) — bukan taksonomi karangan
   * sendiri yang harus dijaga tetap sinkron tiap kali pustakanya naik versi.
   * Urutan kelompoknya yang kita tentukan (`KATEGORI`), dan kategori yang tak
   * terdaftar di situ tetap muncul di bawah dengan namanya sendiri: kategori
   * baru tak boleh membuat indikatornya lenyap dari menu tanpa ada yang tahu.
   */
  const opsiIndikator = useMemo(() => {
    if (!katalog) {
      // `nilai` sengaja BUKAN string kosong: Dropdown menampilkan label opsi
      // yang nilainya cocok dengan prop `nilai`, dan `nilai=""` di sini membuat
      // tombolnya berbunyi "Memuat katalog pustaka…" alih-alih "ƒx Indikator" —
      // menu yang seolah macet padahal isinya siap dipakai (terlihat di
      // tangkapan layar verifikasi, 18 Agu 2026).
      return [...OPSI_KURASI, {
        nilai: '__memuat', label: 'Memuat katalog pustaka…', nonaktif: true, grup: 'Katalog pustaka',
      }]
    }
    const urutan = new Map(KATEGORI.map(([ing], i) => [ing, i]))
    const semua = [...katalog.values()].filter((e) => !ID_SUDAH_ADA.has(e.id))
    const label = (e: { nama: string; singkat: string }) =>
      // Nama panjang + pendek keduanya ikut supaya kotak cari menemukannya
      // lewat singkatan ("ADX") maupun kata lengkapnya ("Directional").
      e.nama === e.singkat ? e.nama : `${e.nama} · ${e.singkat}`
    // Kelompok "Populer (TradingView)" tampil TEPAT sesudah "Pilihan PAPAN" —
    // entri yang masuk sini DISARING dari kelompok kategorinya di bawah,
    // supaya tak dobel (Johan 21 Agu 2026: lihat catatan di `POPULER`).
    const populer = semua.filter((e) => POPULER.has(e.id))
      .sort((a, b) => a.nama.localeCompare(b.nama))
    const entri = semua.filter((e) => !POPULER.has(e.id))
      .sort((a, b) => (urutan.get(a.kategori) ?? 99) - (urutan.get(b.kategori) ?? 99)
        || a.nama.localeCompare(b.nama))
    return [
      ...OPSI_KURASI,
      ...populer.map((e) => ({ nilai: `p:${e.id}`, label: label(e), grup: 'Populer (TradingView)' })),
      ...entri.map((e) => ({
        nilai: `p:${e.id}`,
        label: label(e),
        grup: KATEGORI.find(([ing]) => ing === e.kategori)?.[1] ?? e.kategori,
      })),
    ]
  }, [katalog])

  const opsiPola = useMemo(() => JENIS_POLA.map((jenis) => {
    const sudah = pol.daftar.some((x) => x.jenis === jenis)
    return {
      nilai: jenis,
      label: sudah ? `${SPEK_POLA[jenis].label} · sudah ada` : SPEK_POLA[jenis].label,
      nonaktif: sudah,
    }
  }), [pol.daftar])

  /** Isi menu "+ Banding" — IHSG di kelompok sendiri paling atas, lalu
   *  seluruh emiten. Yang sudah ditumpuk dan emiten yang sedang dibuka tetap
   *  TERLIHAT tapi mati (pola `nonaktif` yang sama dengan menu Pola): daftar
   *  yang menyusut diam-diam terbaca sebagai pilihan yang hilang. */
  const opsiBanding = useMemo(() => {
    const sudahPenuh = banding.length >= MAKS_BANDING
    const dasar = [
      { kode: KODE_IHSG, nama: 'Indeks Harga Saham Gabungan', grup: 'Indeks' },
      ...(kamus?.emiten ?? []).map((e) => ({ kode: e.kode, nama: e.nama, grup: 'Emiten' })),
    ]
    return dasar.map((e) => ({
      nilai: e.kode,
      label: e.kode === kode ? `${e.kode} · sedang dibuka` : `${e.kode} · ${e.nama}`,
      nonaktif: e.kode === kode || banding.includes(e.kode) || sudahPenuh,
      grup: e.grup,
    }))
  }, [kamus, banding, kode])

  // Deret tiap instans, dihitung dari `lilin` — SUDAH tersaring
  // hariTanpaPerdagangan lewat keDataLilinVolume di atas, bukan `berkas.d`
  // mentah, supaya angkanya sama dengan yang benar-benar tergambar di lilin.
  // Satu memo dipakai tiga pembaca (penggambar seri, legenda, dan daftar plot
  // di modal setelan) supaya angka yang tergambar dan angka yang terbaca
  // mustahil berbeda.
  const garisPerInstans = useMemo(() => {
    const tutup = lilin.map((l) => l.close)
    const waktu = lilin.map((l) => l.time)
    const vol = volume.map((v) => v.value)
    return ind.daftar.map((inst) => ({
      inst,
      // `lilin` ikut dikirim: Stochastic/StochRSI/W%R/VWAP tak bisa dihitung
      // dari harga tutup saja (butuh tinggi/rendah, dan VWAP butuh tanggalnya).
      garis: hitungInstans(inst, tutup, vol, lilin, katalog).map((g) => ({ ...g, seri: keSeriGaris(waktu, g.nilai) })),
    }))
  }, [ind.daftar, lilin, volume, katalog])

  /**
   * Penanda dari indikator PUSTAKA yang keluarannya bukan deret angka
   * melainkan penanda per lilin — hari ini cuma Williams Fractals (B30).
   *
   * Entri semacam ini `plotConfig`-nya kosong, jadi jalur garis biasa
   * melewatkannya begitu saja: ia masuk menu, dipilih, lalu tak menggambar
   * apa pun. Dua entri lain yang senasib — Volume Delta dan Zig Zag — punya
   * bentuk keluaran yang BERBEDA (deret lilin dan segmen garis dua titik),
   * jadi mereka lewat dua memo di bawah, bukan dipaksakan jadi penanda titik.
   */
  const penandaIndikator = useMemo<PenandaSiapGambar[]>(() => {
    const vol = volume.map((v) => v.value)
    const out: PenandaSiapGambar[] = []
    for (const inst of ind.daftar) {
      if (!digambar(inst)) continue
      out.push(...hitungPenandaInstans(inst, lilin, vol, katalog))
    }
    return out
  }, [ind.daftar, lilin, volume, katalog, digambar])

  /**
   * Zig Zag: segmen pivot dirangkai jadi SATU deret titik berlubang (B30).
   *
   * Lubangnya disengaja — `LineSeries` menyambung dua titik berjauhan dengan
   * garis lurus, dan justru itu bentuk zigzag. Menggambar tiap segmen sebagai
   * seri sendiri akan benar rupanya dan mahal ongkosnya: 145 seri untuk satu
   * indikator.
   */
  const segmenIndikator = useMemo(() => {
    const vol = volume.map((v) => v.value)
    return ind.daftar
      .filter((inst) => digambar(inst))
      .map((inst) => ({ inst, titik: hitungSegmenInstans(inst, lilin, vol, katalog) }))
      .filter((x) => x.titik.length > 0)
  }, [ind.daftar, lilin, volume, katalog, digambar])

  /** Volume Delta: deret LILIN berskala volume, digambar sebagai seri
   *  candlestick di panelnya sendiri. */
  const lilinIndikator = useMemo(() => {
    const vol = volume.map((v) => v.value)
    return ind.daftar
      .filter((inst) => digambar(inst))
      .map((inst) => ({ inst, data: hitungLilinInstans(inst, lilin, vol, katalog) }))
      .filter((x): x is { inst: typeof x.inst; data: LilinSiapGambar[] } => x.data.length > 0)
  }, [ind.daftar, lilin, volume, katalog, digambar])

  /**
   * Net asing harian (LEMBAR, bukan rupiah — IDX tak melaporkan aliran asing
   * dalam rupiah) untuk pola Wyckoff, berkunci tanggal.
   *
   * Ditarik HANYA kalau ada instans Wyckoff yang hidup. Ikut di fetch OHLC di
   * atas, ia menambah satu unduhan per emiten untuk seluruh pengunjung
   * termasuk yang tak pernah membuka pola ini — dan berkas `asing/` bukan
   * berkas kecil (1.594 baris untuk BBCA).
   *
   * Gagal, tak ada berkasnya (48 dari 963 emiten), atau belum sampai =
   * peta KOSONG, bukan angka tebakan: `cariWyckoff` menjawabnya dengan jatuh
   * ke cadangan struktur MA dan ruas `fnetDipakai` menyebutkannya di layar.
   * Kunci petanya tanggal, jadi pada kerangka pekanan/bulanan/intraday ia
   * memang tak cocok dengan `lilin[i].time` dan hasilnya cadangan itu juga —
   * benar apa adanya, karena net asing memang tercatat harian.
   */
  // Menu bukan satu-satunya jalan masuk. Template yang memuat pola Divergensi
  // menggambarnya tanpa pembaca menyentuh menu apa pun, dan jalur itu butuh
  // katalog yang sama. Tanpa ini, template lama membuka halaman dengan pola
  // yang selamanya nol temuan.
  const perluKatalogPola = pol.daftar.some((i) => i.jenis === 'divergensi')
  useEffect(() => {
    if (perluKatalogPola && !katalog) mintaKatalog()
  }, [perluKatalogPola, katalog, mintaKatalog])

  const perluFnet = pol.daftar.some((i) => i.jenis === 'wyckoff')
  const [fnetPeta, setFnetPeta] = useState<Map<string, number>>(() => new Map())
  useEffect(() => {
    if (!perluFnet) return
    let batal = false
    // Emiten berganti = peta lama HARUS dibuang lebih dulu. Dibiarkan, fase
    // emiten baru sempat dihitung dari aliran asing emiten lama — dan hasilnya
    // tetap terlihat masuk akal di layar.
    setFnetPeta(new Map())
    fetch(`/data-idx/json/asing/${kode}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { d?: Array<[string, number, number, number, number, number]> }) => {
        if (batal || !Array.isArray(d.d)) return
        setFnetPeta(new Map(d.d.map(([tgl, beli, jual]) => [tgl, beli - jual])))
      })
      .catch(() => { if (!batal) setFnetPeta(new Map()) })
    return () => { batal = true }
  }, [kode, perluFnet])

  // Temuan pola per instans. Sama seperti indikator: dihitung dari `lilin`
  // yang sudah tersaring, bukan dari `berkas.d` mentah — kalau tidak, indeks
  // lembah yang ditemukan menunjuk lilin yang berbeda dari yang tergambar.
  const polaPerInstans = useMemo(() => {
    const vol = volume.map((v) => v.value)
    // Dua jenis pola disimpan di dua ruas terpisah, bukan satu array bertipe
    // gabungan: bentuk temuannya memang berbeda (Double Bottom punya dua
    // lembah dan sebuah leher, Lonjakan Volume punya satu hari dan sebuah
    // rasio), dan memaksanya jadi satu bentuk cuma memindahkan percabangan
    // ke tiap pembacanya.
    return pol.daftar.map((inst) => ({
      inst,
      doubleBottom: inst.jenis === 'doubleBottom'
        ? cariDoubleBottom(lilin, vol, inst.param as unknown as ParamDoubleBottom)
        : ([] as DoubleBottom[]),
      lonjakan: inst.jenis === 'lonjakanVolume'
        ? cariLonjakanVolume(lilin, vol, inst.param as unknown as ParamLonjakanVolume)
        : ([] as LonjakanVolume[]),
      // Musiman dihitung dari `lilin` yang sama — jadi rentang perhitungannya
      // persis rentang yang tergambar. `null` pada kerangka intraday, dijegal
      // di dalam `cariMusiman` sendiri (lihat alasannya di sana).
      musiman: inst.jenis === 'musiman' ? cariMusiman(lilin, inst.param.hari) : null,
      // Deret %K-nya diambil lewat `stochUntukDivergensi` — jalur yang sama
      // dengan indikator Stoch di menu, jadi katalog ikut jadi dependensi memo
      // ini. Tanpa itu, pola digambar kosong sekali lalu tak pernah dihitung
      // ulang saat katalognya akhirnya tiba, dan tak ada satu pun galat.
      // Deret %K disimpan, bukan dibuang sesudah dipakai mencari: sejak
      // 21 Agu 2026 ia ikut DIGAMBAR di panel bawah, dan menghitungnya dua
      // kali berarti dua jawaban yang bisa menyimpang tanpa ada yang tahu —
      // penanda bilang %K 25,6 sementara garis di panel menggambar angka lain.
      stoch: inst.jenis === 'divergensi'
        ? stochUntukDivergensi(lilin, vol, inst.param as unknown as ParamDivergensi, katalog)
        : ([] as Array<number | null>),
      divergensi: [] as Divergensi[],
      // Wyckoff: satu-satunya pola yang butuh sumber di luar berkas OHLC.
      // Peta FNet kosong bukan kegagalan — lihat keterangan di efek fetch-nya.
      wyckoff: inst.jenis === 'wyckoff'
        ? cariWyckoff(
          lilin, vol,
          lilin.map((l) => fnetPeta.get(l.time) ?? null),
          inst.param as unknown as ParamWyckoff,
        )
        : ([] as SegmenWyckoff[]),
      harmonik: inst.jenis === 'harmonik'
        ? cariHarmonik(lilin, inst.param as unknown as ParamHarmonik)
        : ([] as Harmonik[]),
      // Pola klasik (B35): enam belas pola (reversal + continuation), mesin
      // & angka backtest-nya di `polaKlasik.ts`. Garisnya digambar efek seri
      // pola di bawah.
      klasik: jenisKlasik(inst.jenis)
        ? (() => {
          const semua = cariPolaKlasik(lilin, inst.param as unknown as ParamPolaKlasik)
          const nama = namaPolaDariJenis(inst.jenis)
          // `pk-*` = satu pola saja; `polaKlasik` lama = semua enam belas.
          return nama ? semua.filter((q) => q.nama === nama) : semua
        })()
        : ([] as PolaKlasik[]),
      // Struktur pasar (21 Agu 2026). Swing dan patahannya dihitung
      // BERSAMAAN karena patahan membaca swing — memisahkannya berarti dua
      // memo yang bisa memakai `N` berbeda selama satu render.
      swing: inst.jenis === 'struktur' ? cariSwing(lilin, inst.param.n) : ([] as Swing[]),
    })).map((x) => ({
      ...x,
      patahan: x.inst.jenis === 'struktur' ? cariPatahan(lilin, x.swing, x.inst.param.n) : ([] as Patahan[]),
    })).map((x) => ({
      ...x,
      divergensi: x.inst.jenis === 'divergensi'
        ? cariDivergensi(lilin, vol, x.stoch, x.inst.param as unknown as ParamDivergensi)
        : x.divergensi,
    }))
  }, [pol.daftar, lilin, volume, katalog, fnetPeta])

  // Peta waktu->nilai per garis, dipakai legenda (lookup langsung, tak perlu
  // scan array tiap kursor bergeser). Histogram tak masuk legenda — angkanya
  // cuma selisih dua garis yang sudah tertulis di sebelahnya.
  const petaLegenda = useMemo(() => garisPerInstans.map(({ inst, garis }) => ({
    inst,
    peta: garis.filter((g) => !g.histogram).map((g) => new Map(g.seri.map((p) => [p.time, p.value]))),
  })), [garisPerInstans])

  // Pane mana yang dipakai tiap instans. Dihitung SEKALI di sini lalu dibaca
  // dua tempat (penggambar seri & legenda dalam-kanvas) — dihitung sendiri
  // di masing-masing, legendanya bisa muncul di pane yang bukan miliknya
  // begitu salah satu urutannya berubah.
  /**
   * SATU rencana panel untuk seluruh penggambar.
   *
   * Sebelum ini tiga tempat menghitung nomornya sendiri-sendiri — indikator di
   * sini, volume di efeknya, panel %K divergensi dengan `max(...)+1` — dan
   * ketiganya bisa tak sepakat. Seorang agen penyanggah menelusuri akibatnya
   * dan menemukan dua tabrakan yang nyata:
   *
   *   * Volume dipindah ke panel sendiri SESUDAH ada RSI -> volume mendarat di
   *     panel RSI. Sebabnya halus: efek indikator membongkar seluruh serinya
   *     lebih dulu, pane 1 jadi kosong dan lightweight-charts membuangnya,
   *     lalu `addSeries(..., 2)` DIJEPIT jadi 1 karena pustaka membatasi
   *     indeks ke `panes.length`.
   *   * Panel %K divergensi memakai `max(nomor indikator) + 1` yang tak
   *     melihat volume sama sekali — dengan volume berdiri sendiri dan
   *     indikator yang semuanya menumpang panel harga, ia menghitung 1 dan
   *     menindih histogram volume.
   *
   * Karena itu nomornya dihitung SEKALI di sini, berurutan tanpa lubang, dan
   * `pastikanPane()` menciptakan pane yang belum ada sebelum seri dipasang —
   * penjepitan indeks pustaka cuma menggigit kalau kita meminta pane yang
   * belum lahir.
   */
  const panePerInstans = useMemo(() => {
    const peta = new Map<string, number>()
    // Volume mengambil pane 1 kalau ia berdiri sendiri — tepat di bawah harga,
    // seperti di chart mana pun. Indikator mulai dari 2 supaya tak menabraknya.
    let berikut = volumePanel === 'sendiri' ? 2 : 1
    for (const inst of ind.daftar) {
      if (!digambar(inst)) continue
      // Jenis pustaka yang katalognya belum tiba dianggap PANEL SENDIRI
      // (bukan menumpang di panel harga): salah menaruh osilator 0-100 di
      // skala rupiah membuatnya rata di dasar kanvas dan terlihat seperti
      // indikator rusak; sebaliknya panel kosong sesaat cuma terlihat lengang.
      // Pilihan pembaca menang atas bawaan pustaka (B29). `panel` yang tak
      // disetel berarti belum pernah diputuskan — di situ `overlay` registry
      // yang berlaku, persis seperti sebelum fitur ini ada.
      const diHarga = inst.panel === 'harga'
        ? true
        : inst.panel === 'sendiri'
          ? false
          : spekJenis(inst.jenis, katalog)?.diPanelHarga === true
      peta.set(inst.id, diHarga ? 0 : berikut++)
    }
    return peta
  }, [ind.daftar, katalog, digambar, volumePanel])

  // Jarak atas tiap pane dari ujung atas bungkus kanvas, dipakai menempatkan
  // legenda di pojok kiri atas pane MASING-MASING (RSI/MACD punya legendanya
  // sendiri, seperti TradingView). Diukur dari DOM pane-nya sendiri
  // (`getHTMLElement`), bukan dijumlah dari tinggi + tebal pemisah yang
  // ditebak — tebakan itu meleset beberapa piksel dan legendanya duduk
  // separuh di luar panenya.
  const [posPane, setPosPane] = useState<number[]>([0])
  /** Buat pane kosong sampai indeks `i` ADA. lightweight-charts menjepit
   *  `addSeries(..., i)` ke `panes.length`, jadi meminta pane yang belum lahir
   *  diam-diam menaruh serinya di pane orang lain. */
  const pastikanPane = useCallback((i: number) => {
    const chart = chartRef.current
    if (!chart) return
    while (chart.panes().length <= i) chart.addPane(true)
  }, [])

  /**
   * Bongkar pane KOSONG dari ekor — pasangan wajibnya `pastikanPane`.
   *
   * lightweight-charts hanya membuang pane yang kehilangan seri TERAKHIRNYA;
   * pane yang lahir lewat `addPane(true)` tak pernah punya seri, jadi ia
   * abadi. Johan menangkap gejalanya di layar (21 Agu 2026): "ada layer
   * kosong dibawahnya meskipun pola sudah di hapus" — strip kosong bekas
   * panel %K/volume yang instansnya sudah lama pergi. Dipanggil di ujung
   * setiap efek yang menggambar panel.
   */
  const bersihkanPaneKosong = useCallback(() => {
    const chart = chartRef.current
    if (!chart) return
    const panes = chart.panes()
    for (let i = panes.length - 1; i >= 1; i--) {
      if (panes[i].getSeries().length === 0) chart.removePane(i)
    }
  }, [])

  /** Pane mana yang sedang terlipat, diturunkan dari id yang disimpan.
   *  Panel milik POLA tak pernah bisa terlipat: ia tak punya baris legenda,
   *  jadi tak akan pernah ada tombol untuk membukanya lagi. */
  const paneTerlipat = useMemo(() => {
    const set = new Set<number>()
    for (const [id, pane] of panePerInstans) {
      if (pane > 0 && lipat.includes(id)) set.add(pane)
    }
    if (volumePanel === 'sendiri' && lipat.includes('__volume')) set.add(1)
    return set
  }, [lipat, panePerInstans, volumePanel])

  /**
   * Shortcut keyboard (B38, gap termurah terhadap TradingView):
   *   ←/→  geser sumbu waktu   +/-  zoom   Esc  keluar Bar replay
   * Dipasang di WINDOW tapi hanya berlaku saat fokus TIDAK di kolom isian —
   * panah di kotak cari harus tetap menggerakkan kursor teks, bukan chart.
   * Esc untuk layar penuh tak perlu ditangani: peramban sudah melakukannya.
   */
  useEffect(() => {
    const tombol = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const chart = chartRef.current
      if (!chart) return
      const ts = chart.timeScale()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const arah = e.key === 'ArrowLeft' ? -1 : 1
        ts.scrollToPosition(ts.scrollPosition() + arah * 10, false)
        e.preventDefault()
      } else if (e.key === '+' || e.key === '=' || e.key === '-') {
        const r = ts.getVisibleLogicalRange()
        if (!r) return
        const lebar = r.to - r.from
        // Zoom berjangkar di UJUNG KANAN — lilin terbaru tetap di tempatnya,
        // sejarah yang melebar/menyempit. Itu perilaku zoom TradingView.
        const faktor = e.key === '-' ? 1.25 : 0.8
        ts.setVisibleLogicalRange({ from: r.to - lebar * faktor, to: r.to })
        e.preventDefault()
      } else if (e.key === 'Escape' && replay !== null) {
        setReplay(null)
      }
    }
    window.addEventListener('keydown', tombol)
    return () => window.removeEventListener('keydown', tombol)
  }, [replay])

  /**
   * Dobel-klik gambar = buka setelannya (Johan 21 Agu 2026: "berikan fungsi
   * double klik untuk setup modal apapun itu"), meniru TradingView. Klik
   * pertama dari pasangan dobel sudah MEMILIH gambarnya (manager pustaka),
   * jadi di sini cukup bertanya "ada yang terpilih?" — lewat
   * `terpilihSekarang()` yang membaca manager langsung, karena state React
   * belum tentu menyusul di sela dua klik.
   */
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const dobel = () => { if (alatGambar.terpilihSekarang()) setSetelanGambarBuka(true) }
    chart.subscribeDblClick(dobel)
    return () => chart.unsubscribeDblClick(dobel)
  }, [alatGambar.terpilihSekarang])

  // Menu klik kanan: Escape menutupnya, dan begitu juga gulir/ubah ukuran.
  //
  // Latar tak-terlihat di bawah menu cuma menutupi KANVAS, jadi menu tetap
  // menggantung saat orang menekan tombol di bilah atas, membuka panduan, atau
  // menggulir halaman — dan karena posisinya piksel mutlak terhadap bungkus,
  // ia lalu melayang di atas isi yang sudah bukan miliknya. Escape juga satu-
  // satunya jalan keluar bagi yang tak memakai tetikus.
  useEffect(() => {
    if (!menuKonteks) return
    const tutup = () => setMenuKonteks(null)
    const tombol = (e: KeyboardEvent) => { if (e.key === 'Escape') tutup() }
    window.addEventListener('keydown', tombol)
    window.addEventListener('resize', tutup)
    // `capture` supaya gulir di dalam panel mana pun ikut terbaca, bukan cuma
    // gulir dokumen — kanvas menahan wheel-nya sendiri.
    window.addEventListener('wheel', tutup, { capture: true, passive: true })
    return () => {
      window.removeEventListener('keydown', tombol)
      window.removeEventListener('resize', tutup)
      window.removeEventListener('wheel', tutup, { capture: true })
    }
  }, [menuKonteks])

  const ukurPane = useCallback(() => {
    const chart = chartRef.current
    const bungkus = bungkusRef.current
    if (!chart || !bungkus) return
    // Ukuran bungkus dulu ikut disimpan di sini — tooltip pola memakainya
    // untuk memutuskan membuka ke kiri atau ke kanan. Tooltipnya dimatikan
    // 20 Agu 2026, jadi state itu ikut dibuang; yang tersisa cuma posisi
    // pane, yang dipakai legenda dalam-kanvas.
    const atasBungkus = bungkus.getBoundingClientRect().top
    const pos = chart.panes().map((p) => {
      const el = p.getHTMLElement()
      return el ? el.getBoundingClientRect().top - atasBungkus : 0
    })
    // Dibandingkan dulu supaya tak memicu render ulang tanpa perubahan nyata —
    // fungsi ini dipanggil dari ResizeObserver, dan render yang memicu ukur
    // yang memicu render adalah lingkaran yang tak berhenti sendiri.
    setPosPane((lama) => (lama.length === pos.length && lama.every((v, i) => Math.abs(v - pos[i]) < 1) ? lama : pos))
  }, [])

  useEffect(() => {
    const bungkus = bungkusRef.current
    if (!bungkus) return
    const pengamat = new ResizeObserver(() => ukurPane())
    pengamat.observe(bungkus)
    return () => pengamat.disconnect()
  }, [ukurPane])

  // Susun ulang seluruh seri indikator dari nol tiap kali daftar/data/tema
  // berubah — membongkar-pasang beberapa belas seri jauh lebih murah daripada
  // melacak instans mana yang berubah, dan tak bisa hanyut dari state-nya.
  useEffect(() => {
    const chart = chartRef.current
    const el = containerRef.current
    if (!chart || !el) return
    const cs = getComputedStyle(el)
    const baca = (nama: string, fallback = '#888D99') => cs.getPropertyValue(nama).trim() || fallback
    const green = baca('--green', '#38B77E')
    const red = baca('--red', '#E6635A')

    for (const s of seriIndRef.current) chart.removeSeries(s)
    seriIndRef.current = []

    for (const { inst, garis } of garisPerInstans) {
      const pane = panePerInstans.get(inst.id)
      if (pane === undefined) continue // tak tampil di kerangka ini
      pastikanPane(pane)
      // Presisi & lencana sumbu datang dari ruas OUTPUTS modal setelan.
      // `undefined` = ikut format bawaan lightweight-charts.
      const format = inst.presisi === undefined
        ? undefined
        : { type: 'price' as const, precision: inst.presisi, minMove: 10 ** -inst.presisi }
      const lencana = inst.labelSumbu !== false
      for (let i = 0; i < garis.length; i++) {
        const g = garis[i]
        const gy = inst.gaya?.[i] ?? {}
        // Plot yang dimatikan di tab Style dilewati — bukan digambar
        // transparan: seri transparan tetap ikut menghitung skala pane dan
        // diam-diam memipihkan garis yang justru sedang dilihat.
        if (gy.tampil === false) continue
        const warna = baca(gy.warna ?? inst.warna)
        if (g.histogram) {
          const s = chart.addSeries(
            HistogramSeries,
            { priceLineVisible: false, lastValueVisible: lencana, ...(format ? { priceFormat: format } : {}) },
            pane,
          )
          s.setData(keChart(g.seri).map((p) => ({ ...p, color: p.value >= 0 ? green : red })))
          seriIndRef.current.push(s)
        } else {
          const s = chart.addSeries(
            LineSeries,
            {
              color: warna,
              lineWidth: (gy.tebal ?? 1) as LineWidth,
              lineStyle: gy.garis ?? (g.bantu ? LineStyle.Dashed : LineStyle.Solid),
              priceLineVisible: false,
              lastValueVisible: lencana,
              crosshairMarkerVisible: false,
              ...(format ? { priceFormat: format } : {}),
            },
            pane,
          )
          s.setData(keChart(g.seri))
          seriIndRef.current.push(s)
        }
      }
    }

    // Zig Zag — satu garis per instans, di panel yang sama dengan indikator
    // lainnya. `lastValueVisible` mati: nilai terakhir zigzag itu pivot, bukan
    // harga berjalan, dan lencananya akan berdesakan dengan lencana harga.
    for (const { inst, titik } of segmenIndikator) {
      const pane = panePerInstans.get(inst.id)
      if (pane === undefined) continue
      pastikanPane(pane)
      const s = chart.addSeries(
        LineSeries,
        {
          color: baca(inst.warna),
          lineWidth: (inst.gaya?.[0]?.tebal ?? 2) as LineWidth,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        },
        pane,
      )
      s.setData(keChart(titik))
      seriIndRef.current.push(s)
    }

    // Volume Delta — seri lilin di panelnya sendiri. Warnanya diambil dari
    // TEMA kita (naik/turun), bukan dari `color` bawaan pustaka: warna pustaka
    // tetap merah/hijau versinya sendiri dan akan menabrak palet halaman di
    // tema terang.
    for (const { inst, data } of lilinIndikator) {
      const pane = panePerInstans.get(inst.id)
      if (pane === undefined) continue
      pastikanPane(pane)
      const s = chart.addSeries(
        CandlestickSeries,
        {
          upColor: green, downColor: red, borderVisible: false,
          wickUpColor: green, wickDownColor: red,
          priceLineVisible: false,
        },
        pane,
      )
      s.setData(keChart(data))
      seriIndRef.current.push(s)
    }

    bersihkanPaneKosong()
    // Panel harga tetap yang paling besar — tanpa ini pane RSI/MACD sama
    // tingginya dengan panel harga (stretch factor bawaan sama-sama 1).
    // Panel yang DILIPAT (`^` di legendanya) dikecilkan jadi bilah tipis,
    // bukan dibongkar: membongkarnya berarti kehilangan baris legendanya juga,
    // dan bersamanya satu-satunya tombol untuk membukanya lagi.
    const panes = chart.panes()
    panes[0]?.setStretchFactor(3)
    for (let i = 1; i < panes.length; i++) panes[i]?.setStretchFactor(paneTerlipat.has(i) ? 0.18 : 1.1)
    // Diukur SESUDAH tata letak dihitung ulang, bukan di baris yang sama —
    // tinggi pane baru belum berlaku pada saat setStretchFactor kembali.
    requestAnimationFrame(ukurPane)
  }, [garisPerInstans, segmenIndikator, lilinIndikator, panePerInstans, theme, ukurPane, keChart,
      paneTerlipat, pastikanPane, bersihkanPaneKosong])

  // Volume dipindah, BUKAN dibuat ulang: `moveToPane` memindahkan seri beserta
  // datanya, sementara membuat ulang berarti mengunduh & menyusun 900-an titik
  // lagi tiap kali sakelarnya disentuh — dan seri baru kehilangan penanda pola
  // yang menempel padanya (`penandaVolRef`).
  useEffect(() => {
    const vol = volRef.current
    if (!vol) return
    const tujuan = volumePanel === 'sendiri' ? 1 : 0
    pastikanPane(tujuan)
    try {
      vol.moveToPane(tujuan)
    } catch {
      // Pane tujuan belum ada pada render pertama; efek berikutnya menutupnya.
    }
    bersihkanPaneKosong()
    requestAnimationFrame(ukurPane)
  }, [volumePanel, versiSeriHarga, ukurPane, pastikanPane, bersihkanPaneKosong])

  /**
   * Divergensi digambar, bukan cuma ditandai (Johan 21 Agu 2026: "buktikan
   * divergensi ini berarti muncul stohastic ada line nya juga").
   *
   * Dua hal yang tak bisa dibaca dari penanda titik, dan keduanya justru inti
   * divergensinya:
   *   1. GARIS penghubung dua pivot di panel harga — mata perlu melihat harga
   *      membuat lembah lebih rendah / puncak lebih tinggi.
   *   2. Panel %K di bawahnya dengan garis penghubung yang BERLAWANAN arah.
   *      Tanpa panel itu, "momentum melawan" cuma klaim di tooltip.
   *
   * Panelnya milik instans pola, bukan indikator: pembaca tak perlu menambah
   * Stochastic sendiri lalu menebak apakah parameternya sama. Deret yang
   * digambar PERSIS deret yang dipakai mencari (`stoch` di `polaPerInstans`),
   * jadi angka di penanda dan garis di panel mustahil menyimpang.
   *
   * Nomor panenya diambil SESUDAH panel indikator (`panePerInstans`), bukan
   * angka tetap: RSI/MACD yang sedang hidup sudah memakai 1, 2, dst, dan
   * menabraknya berarti dua deret berbeda skala di satu panel — garis %K 0-100
   * rata di dasar panel MACD, atau sebaliknya.
   */
  const seriPolaRef = useRef<Array<ISeriesApi<SeriesType>>>([])
  useEffect(() => {
    const chart = chartRef.current
    const el = containerRef.current
    if (!chart || !el) return
    const cs = getComputedStyle(el)
    const baca = (nama: string, fallback = '#888D99') => cs.getPropertyValue(nama).trim() || fallback

    for (const s of seriPolaRef.current) chart.removeSeries(s)
    seriPolaRef.current = []

    // Volume ikut diperhitungkan: `max(nomor indikator)` bernilai 0 kalau
    // seluruh indikator menumpang panel harga, dan panel %K akan mendarat di
    // panel volume.
    const dipakai = [...panePerInstans.values(), volumePanel === 'sendiri' ? 1 : 0]
    let paneBerikut = Math.max(0, ...dipakai) + 1
    const waktu = lilin.map((l) => l.time)

    for (const { inst, divergensi, stoch } of polaPerInstans) {
      if (inst.jenis !== 'divergensi' || !digambar(inst)) continue
      if (divergensi.length === 0 || stoch.length !== lilin.length) continue
      const pane = paneBerikut++
      pastikanPane(pane)

      // Deret %K penuh — konteks untuk garisnya. Tanpa ini panelnya cuma
      // berisi potongan garis melayang tanpa acuan.
      const sK = chart.addSeries(LineSeries, {
        color: baca('--text3'), lineWidth: 1, priceLineVisible: false,
        lastValueVisible: true, crosshairMarkerVisible: false,
        priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
      }, pane)
      sK.setData(keChart(keSeriGaris(waktu, stoch)))
      seriPolaRef.current.push(sK)

      // Ambang 20/80 sebagai garis putus-putus. Bukan hiasan: derajat
      // divergensi tak melihat ambang sama sekali, jadi pembaca butuh
      // patokan sendiri untuk menilai apakah pivotnya di wilayah jenuh.
      for (const nilai of [20, 80]) {
        const sA = chart.addSeries(LineSeries, {
          color: baca('--line2'), lineWidth: 1, lineStyle: LineStyle.Dashed,
          priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
        }, pane)
        sA.setData(keChart(waktu.map((t) => ({ time: t, value: nilai }))))
        seriPolaRef.current.push(sA)
      }

      // Garis penghubung — hanya untuk temuan yang penandanya ikut tergambar,
      // supaya garis dan penanda tak pernah bercerita beda.
      for (const dv of divergensi.slice(-MAKS_PENANDA_POLA)) {
        const warna = baca(WARNA_DERAJAT[dv.derajat])
        const opsi = {
          color: warna, lineWidth: 2 as LineWidth, priceLineVisible: false,
          lastValueVisible: false, crosshairMarkerVisible: false,
        }
        const gHarga = chart.addSeries(LineSeries, opsi, 0)
        gHarga.setData(keChart([
          { time: dv.waktu1, value: dv.harga1 },
          { time: dv.waktu2, value: dv.harga2 },
        ]))
        const gStoch = chart.addSeries(LineSeries, opsi, pane)
        gStoch.setData(keChart([
          { time: dv.waktu1, value: dv.stoch1 },
          { time: dv.waktu2, value: dv.stoch2 },
        ]))
        seriPolaRef.current.push(gHarga, gStoch)
      }
    }

    // Pola klasik: SEMUA garisnya di panel harga — kerangka pivot tipis
    // bertitik, leher/garis tren tebal, warna ikut arah polanya. Dibatasi
    // yang terbaru (MAKS_PENANDA_POLA) sama seperti penandanya: dua belas
    // pola sekaligus cuma menutupi harga yang justru sedang dibaca.
    for (const { inst, klasik } of polaPerInstans) {
      if (!jenisKlasik(inst.jenis) || !digambar(inst) || klasik.length === 0) continue
      for (const q of klasik.slice(-MAKS_PENANDA_POLA)) {
        const warna = baca(q.arah === 'bullish' ? '--green' : '--red')
        q.garis.forEach((g, gi) => {
          const seri = chart.addSeries(LineSeries, {
            color: warna,
            lineWidth: (gi === 0 ? 1 : 2) as LineWidth,
            lineStyle: gi === 0 ? LineStyle.Dotted : LineStyle.Solid,
            priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
          }, 0)
          seri.setData(keChart(g.map((t) => ({ time: lilin[t.i].time, value: t.harga }))))
          seriPolaRef.current.push(seri)
        })
        // Garis TARGET (spek TradingView): putus-putus mendatar dari lilin
        // sinyal sampai lilin tempat statusnya diputuskan — atau sampai
        // lilin terakhir selagi masih menunggu. Warnanya bercerita:
        // menunggu = kuning, tercapai = warna arah, gagal = pudar.
        const ujung = q.iStatus ?? lilin.length - 1
        if (ujung > q.iSinyal) {
          const wTarget = q.status === 'menunggu' ? baca('--amber')
            : q.status === 'tercapai' ? warna : baca('--text3')
          const sT = chart.addSeries(LineSeries, {
            color: wTarget, lineWidth: 1, lineStyle: LineStyle.Dashed,
            priceLineVisible: false, lastValueVisible: q.status === 'menunggu',
            crosshairMarkerVisible: false,
          }, 0)
          sT.setData(keChart([
            { time: lilin[q.iSinyal].time, value: q.target },
            { time: lilin[ujung].time, value: q.target },
          ]))
          seriPolaRef.current.push(sT)
        }
      }
    }

    // Harmonic: kerangka XABCD digambar sebagai garis + zona PRZ (Johan
    // 21 Agu 2026: "coba perbaiki supaya muncul drawing nya"). Konvensinya
    // dari literatur harmonic (riset web, lihat Papan Pekerjaan): kaki-kaki
    // zigzag X-A-B-C-D tergambar utuh, dan PRZ — zona tempat beberapa
    // proyeksi Fibonacci bertumpu — dipetakan sebagai DUA garis putus-putus
    // di sekitar titik D, ditarik sedikit ke kanan sebagai area, bukan titik.
    for (const { inst, harmonik } of polaPerInstans) {
      if (inst.jenis !== 'harmonik' || !digambar(inst) || harmonik.length === 0) continue
      for (const h of harmonik.slice(-MAKS_PENANDA_POLA)) {
        const warna = baca(WARNA_HARMONIK[h.pola])
        const kerangka = chart.addSeries(LineSeries, {
          color: warna, lineWidth: 2, priceLineVisible: false,
          lastValueVisible: false, crosshairMarkerVisible: false,
        }, 0)
        kerangka.setData(keChart(h.indeks.map((iL, t) => ({ time: lilin[iL].time, value: h.harga[t] }))))
        seriPolaRef.current.push(kerangka)

        // Dua TALI BUSUR — X→B dan B→D — pelengkap konvensi TradingView
        // (Johan 21 Agu 2026: "harmonic pattern nya kurang siip"): zigzag
        // XABCD saja terbaca seperti garis tren biasa, tali busurnya yang
        // membentuk dua segitiga khas (XAB & BCD) sehingga polanya terkenali
        // sekilas. Putus-putus & tipis supaya kerangka utamanya tetap dominan.
        for (const [i1, i2] of [[0, 2], [2, 4]] as const) {
          const tali = chart.addSeries(LineSeries, {
            color: warna, lineWidth: 1, lineStyle: LineStyle.Dashed,
            priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
          }, 0)
          tali.setData(keChart([
            { time: lilin[h.indeks[i1]].time, value: h.harga[i1] },
            { time: lilin[h.indeks[i2]].time, value: h.harga[i2] },
          ]))
          seriPolaRef.current.push(tali)
        }

        const prz = hitungPrz(h.harga[0], h.harga[1], h.harga[2], h.harga[3], RASIO_HARMONIK[h.pola].ad[0])
        if (prz) {
          // Zona ditarik dari C sampai beberapa lilin melewati D: PRZ adalah
          // AREA tempat D diharapkan berbalik, bukan garis di D-nya sendiri.
          const iAkhir = Math.min(h.indeks[4] + 10, lilin.length - 1)
          for (const nilai of [prz.bawah, prz.atas]) {
            const g = chart.addSeries(LineSeries, {
              color: baca('--amber'), lineWidth: 2, lineStyle: LineStyle.Dashed,
              // Nilai PRZ tercetak di sumbu harga — zona pembalikan yang tak
              // bisa dibaca angkanya cuma hiasan (upgrade 21 Agu 2026).
              priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false,
            }, 0)
            g.setData(keChart([
              { time: lilin[h.indeks[3]].time, value: nilai },
              { time: lilin[iAkhir].time, value: nilai },
            ]))
            seriPolaRef.current.push(g)
          }
        }
      }
    }

    bersihkanPaneKosong()
    if (seriPolaRef.current.length) {
      const panes = chart.panes()
      panes[0]?.setStretchFactor(3)
      for (let i = 1; i < panes.length; i++) panes[i]?.setStretchFactor(paneTerlipat.has(i) ? 0.18 : 1.1)
      requestAnimationFrame(ukurPane)
    }
  }, [polaPerInstans, panePerInstans, lilin, theme, digambar, keChart, ukurPane, paneTerlipat, volumePanel, pastikanPane, bersihkanPaneKosong])

  // Indeks waktu -> posisi lilin. Dipakai baris status (OHLC yang mengikuti
  // kursor) dan tooltip pola.
  const indeksWaktu = useMemo(() => new Map(lilin.map((l, i) => [l.time, i])), [lilin])

  /**
   * Baris status di kepala panel harga — `O H L C ±selisih (±persen) Vol`
   * pada lilin yang sedang disorot, jatuh balik ke lilin TERAKHIR selagi
   * kursor belum menyentuh kanvas.
   */
  const status = useMemo(() => {
    const i = (sorot ? indeksWaktu.get(sorot.waktu) : undefined) ?? lilin.length - 1
    const l = lilin[i]
    if (!l) return null
    const sebelum = lilin[i - 1]
    const selisih = sebelum ? l.close - sebelum.close : l.close - l.open
    const dasar = sebelum ? sebelum.close : l.open
    return {
      l,
      volume: volume[i]?.value ?? 0,
      selisih,
      persen: dasar ? (selisih / dasar) * 100 : 0,
      naik: selisih >= 0,
    }
  }, [sorot, lilin, volume, indeksWaktu])

  // Legenda: satu baris pendek per instans yang tampil, menyebut parameternya
  // ("MA 200", bukan "MA"), pada titik yang disorot kursor — jatuh balik ke
  // titik TERAKHIR selagi kursor belum digeser ke kanvas. Dikelompokkan per
  // pane: yang menumpang di panel harga muncul di pojok kiri atas panel
  // harga, RSI/MACD di pojok kiri atas pane-nya sendiri.
  const legenda = useMemo(() => {
    const waktu = sorot?.waktu ?? lilin[lilin.length - 1]?.time ?? null
    // Pane 0 SELALU ada walau belum ada satu pun instans — ia yang memuat
    // baris status emiten.
    const perPane = new Map<number, BarisLegenda[]>([[0, []]])
    const dorong = (pane: number, b: BarisLegenda) => {
      const baris = perPane.get(pane) ?? []
      baris.push(b)
      perPane.set(pane, baris)
    }
    for (const { inst, peta } of petaLegenda) {
      // Instans yang SEDANG DISEMBUNYIKAN tetap didaftar (redup, di pane 0):
      // tombol "tampilkan lagi" cuma ada di baris ini, jadi tanpa itu
      // menyembunyikan sebuah indikator sama dengan menguncinya.
      const pane = panePerInstans.get(inst.id) ?? 0
      const tampil = digambar(inst)
      dorong(pane, {
        id: inst.id,
        ranah: 'ind',
        tampil,
        warna: inst.warna,
        label: labelInstansIndikator(inst, katalog),
        nilai: !tampil || !waktu || inst.nilaiStatus === false
          ? ''
          : peta.map((p) => { const x = p.get(waktu); return x === undefined ? '—' : fN(x) }).join(' / '),
      })
    }
    // Pola selalu di pane 0: temuannya digambar di panel harga & volume, tak
    // pernah punya pane sendiri.
    for (const { inst, doubleBottom, lonjakan, musiman, divergensi, wyckoff, harmonik, swing, patahan, klasik } of polaPerInstans) {
      // `klasik` sempat TIDAK ikut dijumlah di sini, dan akibatnya persis
      // jenis kegagalan yang paling mahal: legenda menulis "tak ada" untuk
      // instans yang sedang menggambar 40 pola di kanvas yang sama. Johan
      // menangkapnya dari layar, bukan dari galat — memang tak ada galat.
      const jumlah = doubleBottom.length + lonjakan.length + divergensi.length
        + harmonik.length + patahan.length + klasik.length
      // Pola klasik dilaporkan seperti struktur pasar, bukan sebagai angka
      // telanjang: yang dicari orang saat melihat legendanya adalah berapa
      // yang masih HIDUP (menunggu target), bukan berapa yang pernah ada.
      const klasikMenunggu = klasik.filter((q) => q.status === 'menunggu').length
      // Wyckoff tak dilaporkan sebagai "sekian temuan": yang ditanyakan orang
      // saat melihat legendanya bukan berapa kali fasenya berganti melainkan
      // fase mana yang sedang berjalan di lilin paling kanan.
      const faseKini = inst.jenis === 'wyckoff' ? wyckoff[wyckoff.length - 1] ?? null : null
      dorong(0, {
        id: inst.id,
        ranah: 'pol',
        tampil: digambar(inst),
        warna: inst.warna,
        label: labelInstansPola(inst),
        // Musiman bukan "temuan": ia satu ringkasan, bukan daftar kejadian.
        // `n` ikut disebut di legenda — angka peluang tanpa jumlah observasi
        // di sebelahnya terlihat sama meyakinkannya dari 12 maupun 240 hari.
        nilai: musiman
          ? `naik ${fN(musiman.ringkas.tersusut, 0)}% · n=${musiman.ringkas.n}`
          : inst.jenis === 'musiman'
            ? 'tak berlaku di kerangka ini'
            : inst.jenis === 'wyckoff'
              ? faseKini
                ? `${NAMA_FASE[faseKini.fase]} sejak ${faseKini.waktuMulai}`
                : 'rentangnya terlalu pendek untuk MA-nya'
              // Struktur pasar juga bukan "sekian temuan": yang dicari orang
              // adalah ARAH strukturnya sekarang, bukan berapa kali ia patah.
              : inst.jenis === 'struktur'
                ? swing.length === 0
                  ? 'rentangnya terlalu pendek'
                  : `struktur ${arahStruktur(swing)} · ${swing.length} swing · ${patahan.length} patahan`
                : jenisKlasik(inst.jenis)
                  ? klasik.length === 0
                    ? 'tak ada di rentang ini'
                    : `${klasik.length} pola · ${klasikMenunggu} menunggu target`
                  : jumlah === 0 ? 'tak ada di rentang ini' : `${jumlah} temuan`,
      })
    }
    return { waktu, perPane: [...perPane.entries()].sort((a, b) => a[0] - b[0]) }
  }, [sorot, lilin, petaLegenda, panePerInstans, polaPerInstans, katalog, digambar])

  /**
   * Legenda pembanding — satu baris per emiten yang ditumpuk, ditambah baris
   * emiten UTAMA di paling atas.
   *
   * Emiten utama ikut didaftar walau garisnya sudah jelas terlihat: yang
   * ditanyakan bukan "berapa harga BBCA" melainkan "BBCA naik berapa persen
   * DIBANDING IHSG", dan pertanyaan itu tak terjawab kalau salah satu
   * angkanya harus dihitung sendiri di kepala.
   *
   * Semua persen diukur dari `basisPersen` — tanggal yang sama untuk semua
   * baris, dan tanggal itu tertulis di baris keterangan di bawahnya.
   */
  const bandingLegenda = useMemo(() => {
    if (banding.length === 0) return []
    const waktu = sorot?.waktu ?? lilin[lilin.length - 1]?.time ?? null
    const persen = (d: LilinData[]): string => {
      if (!basisPersen || !waktu) return '—'
      const dasar = tutupSampai(d, basisPersen)
      const kini = tutupSampai(d, waktu)
      if (!dasar || kini === null) return '—'
      const p = (kini / dasar - 1) * 100
      return `${p >= 0 ? '+' : '−'}${fN(Math.abs(p), 2)}%`
    }
    const takIntraday = !intraday(kerangka)
    return [
      { kode, warna: '--text', utama: true, nilai: takIntraday ? persen(lilin) : '' },
      ...banding.map((k, i) => {
        const d = dataBanding[k]
        return {
          kode: k,
          warna: WARNA_BANDING[i],
          utama: false,
          nilai: !takIntraday
            ? 'tak berlaku di kerangka intraday'
            : !d ? 'memuat…' : d.length === 0 ? 'data tak ada' : persen(d),
        }
      }),
    ]
  }, [banding, dataBanding, basisPersen, sorot, lilin, kerangka, kode])

  /* ---------------- Bar replay ---------------- */

  /** Emiten/kerangka berganti = data di bawah replay berganti seluruh
   *  bentuknya. Replay dimatikan, bukan dipindahkan diam-diam ke posisi ke-n
   *  di deret yang sama sekali lain — posisi itu tak berarti apa pun di sana.
   *
   *  `rentangLabel` ikut walau chip rentang tak lagi memotong data: titik awal
   *  replay diletakkan pada 70% JENDELA yang sedang dipandang, jadi menggeser
   *  jendelanya selagi replay jalan meninggalkan penunjuk di tempat yang tak
   *  lagi ada hubungannya dengan apa yang terlihat. */
  useEffect(() => {
    setReplay(null)
    setPutar(false)
  }, [kode, kerangka, rentangLabel])

  /** Chip aktif yang ternyata melampaui riwayat kerangka yang baru dipilih
   *  (mis. pindah D -> 5m selagi "1Y" aktif) dikembalikan ke bawaan. Tanpa
   *  ini chip yang mati tetap tersorot dan tak bisa ditekan untuk keluar. */
  useEffect(() => {
    if (rentangOpsi.some((o) => o.id === rentangLabel && o.nonaktif)) setRentangLabel(RENTANG_KAKI_BAWAAN)
  }, [rentangOpsi, rentangLabel])

  /** Putar otomatis. Berhenti sendiri di lilin terakhir — tanpa itu, interval
   *  tetap berdetak selamanya di ujung deret tanpa ada yang berubah di layar. */
  useEffect(() => {
    if (!putar || replay === null) return
    const total = penuh.lilin.length
    if (replay >= total) { setPutar(false); return }
    const id = window.setInterval(() => {
      setReplay((n) => {
        if (n === null) return n
        if (n + 1 >= total) { setPutar(false); return total }
        return n + 1
      })
    }, 1000 / Number(kecepatan))
    return () => window.clearInterval(id)
  }, [putar, replay, kecepatan, penuh.lilin.length])

  /** Tanggal lilin terakhir yang sedang ditampilkan replay — nilai DatePicker
   *  dan judul bilah replay. */
  const tglReplay = replay === null ? '' : (penuh.lilin[replay - 1]?.time.slice(0, 10) ?? '')

  /** Mulai replay pada tanggal `iso` — lilin tanggal itu jadi lilin terakhir
   *  yang terlihat. */
  const mulaiReplayDi = useCallback((iso: string) => {
    const i = penuh.lilin.findIndex((l) => l.time.slice(0, 10) >= iso)
    setReplay(i === -1 ? penuh.lilin.length : Math.max(1, i + 1))
  }, [penuh.lilin])

  /* ---------------- Template ---------------- */

  // Dibaca SEKALI lewat penginisialisasi useState — bukan di dalam useEffect
  // yang jalan sesudah render pertama. Bedanya terasa: dengan useEffect,
  // halaman sempat tampil kosong dulu lalu tiba-tiba terisi.
  const [template, setTemplate] = useState<TemplateGrafik[]>(bacaTemplateTersimpan)
  const [namaTemplate, setNamaTemplate] = useState('')
  const [namaDiubah, setNamaDiubah] = useState<{ lama: string; teks: string } | null>(null)

  const simpanDaftarTemplate = (baru: TemplateGrafik[]) => {
    setTemplate(baru)
    tulisTemplateTersimpan(baru)
  }

  /** Muat template. Kode emiten SENGAJA tak ikut — yang sedang dibuka tetap
   *  yang sedang dibuka. Itu justru inti bentuknya: "sewaktu-waktu buka lagi
   *  itu tinggal ganti saham nya". */
  const muatTemplate = (t: TemplateGrafik) => {
    // Template yang membawa instans katalog (`p:`) memicu unduhan katalognya
    // sendiri — kalau tidak, garis-garisnya diam kosong sampai pembacanya
    // kebetulan membuka menu Indikator, dan dari layar itu terbaca sebagai
    // template yang rusak.
    if (t.indikator.some((x) => idPustaka(x.jenis) !== null)) mintaKatalog()
    ind.gantiSemua(t.indikator)
    pol.gantiSemua(t.pola)
    if (t.jenisChart === 'lilin' || t.jenisChart === 'garis') setJenisChart(t.jenisChart)
    // Rentang yang tak dikenal dilewati, bukan disetel ke label yang tak ada —
    // chip yang tak cocok apa pun akan membuat seluruh pemilih rentang tampak
    // mati. Termasuk label lama berbahasa Indonesia ("1 Tahun") dari template
    // yang disimpan sebelum kaki kanvas memakai label pendek gaya chart.
    if (t.rentang && RENTANG_KAKI.some(([label]) => label === t.rentang)) setRentangLabel(t.rentang)
    // Template lama tak punya ruas `grid` — `gridDariTemplate` mengembalikan
    // bawaannya, bukan menolak templatenya.
    setGrid(gridDariTemplate(t.grid))
    setNamaTemplate(t.nama)
  }

  const isiTemplate = () => ({ indikator: ind.daftar, pola: pol.daftar, jenisChart, rentang: rentangLabel, grid })

  // Template bawaan dimuat sendiri saat halaman dibuka (Johan: "sewaktu-waktu
  // di buka bisa load otomatis template tersebut"). Deps sengaja kosong: ini
  // sekali seumur mount, bukan tiap kali daftar template berubah — kalau
  // tidak, menandai bawaan yang lain akan langsung menimpa susunan yang
  // sedang dikerjakan.
  const bawaanRef = useRef(template.find((t) => t.bawaan))
  useEffect(() => {
    if (bawaanRef.current) muatTemplate(bawaanRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Penanda pola + keterangannya, dihitung SEKALI lalu dipakai dua pembaca:
   * penggambar kanvas di bawah ini dan tooltip di JSX. Dipisah jadi dua
   * perhitungan, penanda yang tergambar dan keterangan yang terbaca bisa
   * berbeda tanpa satu pun galat — jenis kesalahan yang paling mahal karena
   * hasilnya tetap terlihat masuk akal.
   *
   * Sudah urut menaik menurut waktu di sini: lightweight-charts mewajibkannya
   * dan diam-diam tak menggambar sebagian penanda kalau dilanggar.
   */
  const penandaPola = useMemo<PenandaPola[]>(() => {
    const out: PenandaPola[] = []
    for (const { inst, doubleBottom, lonjakan, musiman, divergensi, wyckoff, harmonik, swing, patahan, klasik } of polaPerInstans) {
      if (!digambar(inst)) continue
      const nama = labelInstansPola(inst)
      // Struktur pasar: label HH/HL/LH/LL di tiap swing, plus penanda di
      // lilin yang MEMATAHKAN struktur. Yang digambar cuma yang terbaru —
      // 300 swing di rentang penuh akan menutupi harganya sendiri, dan pada
      // titik itu labelnya berhenti memberi tahu apa pun.
      for (const sw of swing.slice(-MAKS_PENANDA_POLA * 2)) {
        out.push({
          time: sw.waktu, seri: 'harga',
          posisi: sw.jenis === 'high' ? 'aboveBar' : 'belowBar',
          token: sw.label === 'HH' || sw.label === 'HL' ? '--green'
            : sw.label === 'LH' || sw.label === 'LL' ? '--red' : '--text3',
          bentuk: 'circle',
          // Kodenya DICETAK di kanvas (Johan 21 Agu 2026: "Higher High jadi
          // HH... kan sudah ada contoh nya") — persis konvensi label swing di
          // chart acuan. Swing pertama tanpa pembanding diberi SH/SL, bukan
          // dikosongkan: titik tak berlabel di antara yang berlabel terbaca
          // sebagai penanda rusak.
          labelKanvas: sw.label ?? (sw.jenis === 'high' ? 'SH' : 'SL'),
          teks: `${nama} · ${sw.jenis === 'high' ? 'Swing High' : 'Swing Low'} ${fN(sw.harga, 0)}`
            + (sw.label ? ` · ${sw.label}` : ' · swing pertama, belum ada pembanding'),
        })
      }
      // Pola klasik: satu penanda di lilin SINYAL — tempat leher/garis
      // trennya patah, bukan di puncak yang kelihatannya menarik.
      for (const q of klasik.slice(-MAKS_PENANDA_POLA)) {
        out.push({
          time: lilin[q.iSinyal].time, seri: 'harga',
          posisi: q.arah === 'bullish' ? 'belowBar' : 'aboveBar',
          token: q.arah === 'bullish' ? '--green' : '--red',
          bentuk: 'square',
          // Singkatan dari huruf kapital labelnya: Double Top -> DT,
          // Inverted Head & Shoulders -> IHS — cukup pendek untuk kanvas,
          // cukup khas untuk dibedakan; kepanjangannya di tooltip.
          labelKanvas: LABEL_POLA_KLASIK[q.nama].replace(/[^A-Z]/g, ''),
          teks: `${nama} · ${LABEL_POLA_KLASIK[q.nama]} ${q.arah}`
            + ` · patah di ${fN(q.hargaSinyal, 0)} · target ${fN(q.target, 0)}`
            + ` · ${LABEL_STATUS_POLA[q.status]}`,
        })
      }
      for (const pt of patahan.slice(-MAKS_PENANDA_POLA)) {
        out.push({
          time: pt.waktu, seri: 'harga',
          posisi: pt.arah === 'naik' ? 'belowBar' : 'aboveBar',
          token: pt.jenis === 'CHoCH' ? '--amber' : '--blue',
          bentuk: 'square',
          labelKanvas: pt.jenis,
          teks: `${nama} · ${pt.jenis} ${pt.arah} · menutup melewati ${fN(pt.harga, 0)}`
            + (pt.jenis === 'CHoCH' ? ' — struktur berbalik' : ' — struktur berlanjut'),
        })
      }
      // Wyckoff: satu penanda di lilin PERTAMA tiap segmen — hari fasenya
      // berganti. Menandai tiap lilin berarti ribuan penanda yang menutupi
      // harganya sendiri (2.470 lilin untuk BBCA rentang penuh).
      for (const w of wyckoff.slice(-MAKS_PENANDA_POLA)) {
        const asal = w.fnetDipakai
          ? `net asing ${fN(w.fnet ?? 0, 0)} lembar`
          : 'struktur MA (tak ada catatan asing di lilin ini)'
        out.push({
          time: w.waktuMulai, seri: 'harga', posisi: 'aboveBar', token: WARNA_FASE[w.fase], bentuk: 'square',
          teks: `${nama} · ${NAMA_FASE[w.fase]} mulai · tutup ${fN(w.harga, 0)} vs MA ${fN(w.maPendek, 0)}/${fN(w.maPanjang, 0)}`
            + ` · ${w.panjang} lilin · RVOL ${fN(w.rvol, 2)}× · dasar label: ${asal}`,
        })
      }
      // Harmonic: kelima titiknya ditandai, dan huruf yang bersangkutan ikut
      // di keterangannya — tanpa itu penanda X, A, B, C, D tak terbedakan dan
      // rasio di daftar bawah tak bisa dicocokkan ke lilin yang mana.
      for (const h of harmonik.slice(-MAKS_PENANDA_POLA)) {
        const ekor = `AB/XA ${fN(h.ab, 3)} · BC/AB ${fN(h.bc, 3)} · CD/BC ${fN(h.cd, 3)} · AD/XA ${fN(h.ad, 3)}`
        for (let t = 0; t < 5; t++) {
          out.push({
            time: h.waktu[t], seri: 'harga',
            // Bullish berakhir di lembah, jadi penandanya di bawah lilin;
            // bearish sebaliknya. Sama seperti Divergensi — arah terbaca dari
            // posisi, warna bebas dipakai untuk hal lain.
            posisi: h.arah === 'bullish' ? 'belowBar' : 'aboveBar',
            token: WARNA_HARMONIK[h.pola], bentuk: 'circle',
            labelKanvas: 'XABCD'[t],
            teks: `${nama} · ${NAMA_HARMONIK[h.pola]} ${h.arah} · titik ${'XABCD'[t]} ${fN(h.harga[t], 0)} · ${ekor}`,
          })
        }
      }
      for (const dv of divergensi.slice(-MAKS_PENANDA_POLA)) {
        const token = WARNA_DERAJAT[dv.derajat]
        // Bearish di ATAS lilin, bullish di BAWAH — arahnya terbaca dari
        // posisi penanda, jadi warna bebas dipakai menyatakan derajat.
        const posisi = dv.arah === 'bearish' ? 'aboveBar' : 'belowBar'
        const ekor = `${dv.arah} ${dv.derajat} · ${dv.volumeMendukung ? 'volume mengering' : 'volume tak mendukung'}`
        out.push(
          {
            time: dv.waktu1, seri: 'harga', posisi, token,
            teks: `${nama} · ${dv.arah === 'bearish' ? 'Puncak' : 'Lembah'} 1 ${fN(dv.harga1, 0)} · %K ${fN(dv.stoch1, 1)}`,
          },
          {
            time: dv.waktu2, seri: 'harga', posisi, token,
            // Angka kedua lapis ikut di keterangan — itu yang membuat
            // penandanya bisa DIPERIKSA, bukan dipercaya.
            teks: `${nama} · ${dv.arah === 'bearish' ? 'Puncak' : 'Lembah'} 2 ${fN(dv.harga2, 0)}`
              + ` · %K ${fN(dv.stoch2, 1)} (${dv.selisihStoch > 0 ? '+' : ''}${fN(dv.selisihStoch, 1)})`
              + ` · ayun ${fN(dv.ayunPersen, 1)}% · ${ekor}`,
          },
          // Lapis ketiga duduk di seri VOLUME, di lilin pivot kedua: di situlah
          // pembaca bisa melihat sendiri batang volumenya sambil membaca
          // rasionya, dan di sana ia tak berebut tempat dengan penanda harga.
          {
            time: dv.waktu2, seri: 'volume', posisi: 'belowBar', token,
            teks: `${nama} · volume ${fN(dv.volume2 / dv.volume1, 2)}× rata-rata di pivot pertama · ${ekor}`,
          },
        )
      }
      if (musiman) {
        // Dipotong ke MAKS_PENANDA_MUSIMAN lilin terakhir (bukan
        // MAKS_PENANDA_POLA yang cuma 6 — di sini penandanya label hari, bukan
        // temuan, dan enam Selasa terakhir bukan jawaban atas "tampilkan
        // Selasa"). Alasan angkanya ada di konstantanya.
        const r = musiman.ringkas
        const teks = [
          `${nama} · naik ${fN(r.mentah, 0)}% mentah, ${fN(r.tersusut, 0)}% tersusut`,
          `n=${r.n} dari ${musiman.totalObservasi} hari · selang ${fN(r.bawah, 0)}–${fN(r.atas, 0)}%`,
          // Vonis uji WAJIB ikut. Peluang 60% dari 12 observasi dan dari 240
          // observasi terlihat sama meyakinkannya di layar, dan cuma kalimat
          // ini yang membedakannya.
          musiman.vonis.teks,
        ].join(' · ')
        for (const t of musiman.waktu.slice(-MAKS_PENANDA_MUSIMAN)) {
          out.push({ time: t, seri: 'harga', posisi: 'belowBar', token: inst.warna, bentuk: 'square', teks })
        }
      }
      for (const lv of lonjakan.slice(-MAKS_PENANDA_POLA)) {
        out.push({
          time: lv.waktu, seri: 'volume', posisi: 'belowBar', token: WARNA_LONJAKAN[lv.status],
          // Angka RVOL ikut di keterangan — itu yang membuat penandanya bisa
          // DIPERIKSA, bukan dipercaya.
          teks: `${nama} · RVOL ${fN(lv.rvol, 1)}× · ${lv.status === 'takTerkonfirmasi' ? 'tak terkonfirmasi' : lv.status}`,
        })
      }
      for (const db of doubleBottom.slice(-MAKS_PENANDA_POLA)) {
        const token = WARNA_STATUS[db.status]
        out.push(
          { time: db.waktuLembah1, seri: 'harga', posisi: 'belowBar', token, teks: `${nama} · Lembah 1 ${fN(db.hargaLembah1, 0)}` },
          { time: db.waktuLeher, seri: 'harga', posisi: 'aboveBar', token, teks: `${nama} · Leher ${fN(db.hargaLeher, 0)}` },
          { time: db.waktuLembah2, seri: 'harga', posisi: 'belowBar', token, teks: `${nama} · Lembah 2 ${fN(db.hargaLembah2, 0)} · ${db.status}` },
        )
        if (db.waktuKonfirmasi) {
          out.push({
            time: db.waktuKonfirmasi, seri: 'harga', posisi: 'aboveBar', token,
            teks: `${nama} · Tembus leher${db.volumeMenguat ? ' · volume menguat' : ''}`,
          })
        }
      }
    }
    return out.sort((a, b) => a.time.localeCompare(b.time))
  }, [polaPerInstans, lilin, digambar])

  // Gambar pola di kanvas: garis leher mendatar + penanda di lembah, leher,
  // dan lilin penembusnya. Penanda TANPA `text` — keterangannya pindah ke
  // tooltip (lihat PenandaPola).
  useEffect(() => {
    const chart = chartRef.current
    const harga = hargaRef.current
    const el = containerRef.current
    if (!chart || !harga || !el) return
    const cs = getComputedStyle(el)
    const baca = (nama: string) => cs.getPropertyValue(nama).trim() || '#888D99'

    for (const g of garisLeherRef.current) harga.removePriceLine(g)
    garisLeherRef.current = []

    const keMarker = (p: PenandaPola): SeriesMarker<Time> => ({
      time: keWaktuChart(p.time) as Time, position: p.posisi, shape: p.bentuk ?? 'circle', color: baca(p.token),
      ...(p.labelKanvas ? { text: p.labelKanvas } : {}),
    })
    // Penanda indikator (Williams Fractals) digabung ke seri harga bersama
    // penanda pola. Wajib urut menaik menurut waktu — lightweight-charts
    // mewajibkannya dan diam-diam tak menggambar sebagian kalau dilanggar,
    // dan dua sumber yang masing-masing sudah urut tak otomatis urut setelah
    // digabung.
    const penandaHarga: SeriesMarker<Time>[] = [
      ...penandaPola.filter((p) => p.seri === 'harga').map(keMarker),
      ...penandaIndikator.map((p) => ({
        time: keWaktuChart(p.time) as Time,
        position: p.position,
        shape: (p.shape === 'arrowUp' || p.shape === 'arrowDown' || p.shape === 'square'
          ? p.shape : 'circle') as SeriesMarker<Time>['shape'],
        color: p.color,
      })),
    ].sort((a, b) => {
      const ta = typeof a.time === 'number' ? a.time : String(a.time)
      const tb = typeof b.time === 'number' ? b.time : String(b.time)
      return ta < tb ? -1 : ta > tb ? 1 : 0
    })
    penandaRef.current?.setMarkers(penandaHarga)
    // Penanda Lonjakan Volume dipasang di seri VOLUME, bukan seri harga: di
    // seri harga ia berebut tempat dengan penanda Double Bottom, dan di bawah
    // batang volume justru di situ angkanya berarti.
    penandaVolRef.current?.setMarkers(penandaPola.filter((p) => p.seri === 'volume').map(keMarker))

    for (const { inst, doubleBottom } of polaPerInstans) {
      if (!digambar(inst)) continue
      // Garis leher cuma untuk temuan TERAKHIR tiap instans. `createPriceLine`
      // membentang selebar kanvas — belasan di antaranya saling menimpa dan
      // tak satu pun lagi bisa dibaca sebagai leher milik pola yang mana.
      const akhir = doubleBottom[doubleBottom.length - 1]
      if (!akhir) continue
      garisLeherRef.current.push(harga.createPriceLine({
        price: akhir.hargaLeher,
        color: baca(WARNA_STATUS[akhir.status]),
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `Leher ${labelInstansPola(inst)}`,
      }))
    }

    // Angka terukur buat verifikasi/QA — kanvas tak punya DOM per-penanda.
    el.dataset.polaDitemukan = String(
      polaPerInstans.reduce(
        (n, x) => n + x.doubleBottom.length + x.lonjakan.length + x.divergensi.length
          + x.wyckoff.length + x.harmonik.length,
        0,
      ),
    )
    el.dataset.penandaPola = String(penandaPola.length)
    // Tanggal seluruh penanda Musiman, HANYA di dev — dipakai membuktikan
    // penandanya benar-benar jatuh di hari yang dipilih (tiap tanggal dicek
    // getUTCDay-nya di devtools). Kanvas tak punya DOM per-penanda, jadi tanpa
    // ini "sudah dicek" cuma berarti "sudah dilihat sekilas".
    // `import.meta.env.DEV` di-tree-shake Vite di build produksi.
    if (import.meta.env.DEV) {
      el.dataset.musimanTgl = penandaPola.filter((p) => p.bentuk === 'square').map((p) => p.time).join(',')
    }
  }, [penandaPola, penandaIndikator, polaPerInstans, theme, versiSeriHarga, digambar])

  /* ---------------- Bilah atas ---------------- */

  // Kerangka waktu aktif digulirkan ke dalam pandangan — di 412px cuma
  // sebagian dari delapan tombol yang muat, dan tombol aktif di luar layar
  // membuat pembaca melihat "D" tersorot padahal yang terbuka "4h". Dihitung
  // sendiri, BUKAN `scrollIntoView`: bilah ini punya pudaran di tepi kanan,
  // dan scrollIntoView menempelkan tombolnya tepat di tepi sehingga pudarannya
  // sendiri yang menyembunyikannya (pola yang sama dengan AdminLayout.tsx).
  const bilahKerangkaRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const bar = bilahKerangkaRef.current
    const aktif = bar?.querySelector<HTMLElement>('.chip-t.on')
    if (!bar || !aktif) return
    const TEPI = 28
    const kiri = aktif.offsetLeft - TEPI
    const kanan = aktif.offsetLeft + aktif.offsetWidth + TEPI - bar.clientWidth
    if (bar.scrollLeft > kiri) bar.scrollLeft = Math.max(0, kiri)
    else if (bar.scrollLeft < kanan) bar.scrollLeft = kanan
  }, [kerangka])

  /**
   * Tinggi kanvas = sisa layar, bukan 460px tetap (Johan 20 Agu 2026:
   * "tambahkan height nya sampai mentok bawah itu ... supaya lebih luas
   * chart nya").
   *
   * Diukur, bukan ditulis sebagai `calc(100dvh - Npx)`: pengurangnya adalah
   * jarak kanvas dari puncak halaman, dan jarak itu BERUBAH — bilah atas
   * membungkus jadi dua baris di lebar tertentu, pita peringatan emiten tak
   * dikenal muncul-hilang, bilah Bar replay menambah satu baris lagi. Angka
   * tetap di CSS akan benar di satu lebar dan meleset di semua lebar lain.
   *
   * Yang disisakan di bawah kanvas: bilah rentang (±51px) plus napas — kalau
   * tidak, chip "1D/5D/1M…" jatuh persis di garis lipat dan halaman terlihat
   * seperti terpotong. Layar penuh tak diukur di sini: CSS `:fullscreen`
   * sudah punya rantai flex-nya sendiri.
   */
  const [layarPenuh, setLayarPenuh] = useState(false)
  const ukurTinggiKanvas = useCallback(() => {
    const b = bungkusRef.current
    const p = panelRef.current
    if (!b || !p) return
    if (document.fullscreenElement) { p.style.removeProperty('--grf-tinggi'); return }
    const atasDokumen = b.getBoundingClientRect().top + window.scrollY
    const sisa = window.innerHeight - atasDokumen - 84
    const nilai = `${Math.max(360, Math.round(sisa))}px`
    // Ditulis hanya kalau BERUBAH. ResizeObserver di bawah mengamati <body>,
    // dan tinggi body ikut berubah tiap kali nilai ini berubah — menulis
    // nilai yang sama berulang akan memicu putaran pemberitahuan yang tak
    // pernah selesai.
    if (p.style.getPropertyValue('--grf-tinggi') !== nilai) p.style.setProperty('--grf-tinggi', nilai)
  }, [])
  useEffect(() => {
    ukurTinggiKanvas()
    // Diukur lagi di frame berikutnya: pada muat pertama, bilah atas belum
    // tentu sudah membungkus ke bentuk finalnya dan pita "Memuat…" masih
    // menempati satu baris — pengukuran saat itu memberi kanvas 459px di
    // tempat yang sebenarnya menyediakan 624px (terukur 20 Agu 2026).
    const raf = requestAnimationFrame(ukurTinggiKanvas)
    // <body>, bukan panel: yang menggeser kanvas ke bawah sering berada DI
    // LUAR panel (pita kurs, pita peringatan). Perubahan di situ tak mengubah
    // ukuran panel sama sekali, jadi mengamati panel saja melewatkannya.
    const ro = new ResizeObserver(ukurTinggiKanvas)
    ro.observe(document.body)
    if (panelRef.current) ro.observe(panelRef.current)
    window.addEventListener('resize', ukurTinggiKanvas)
    document.addEventListener('fullscreenchange', ukurTinggiKanvas)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', ukurTinggiKanvas)
      document.removeEventListener('fullscreenchange', ukurTinggiKanvas)
    }
    // Diukur ulang tiap kali sesuatu DI ATAS kanvas boleh berganti tinggi:
    // pita "Memuat…"/galat/emiten tak dikenal muncul-hilang, dan bilah Bar
    // replay menambah satu baris penuh. ResizeObserver saja tak menangkapnya —
    // yang berubah posisi kanvas, bukan ukuran elemen yang diamati.
  }, [ukurTinggiKanvas, lilin.length, galat, galatIntra, kodeAsing, replay, layarPenuh])
  useEffect(() => {
    const saatGanti = () => setLayarPenuh(document.fullscreenElement === panelRef.current)
    document.addEventListener('fullscreenchange', saatGanti)
    return () => document.removeEventListener('fullscreenchange', saatGanti)
  }, [])

  /** Simpan kanvas jadi PNG. `takeScreenshot()` API bawaan lightweight-charts
   *  — menggambar ulang seluruh pane ke satu kanvas lepas, jadi hasilnya ikut
   *  memuat panel indikator di bawahnya, bukan cuma yang terlihat di layar. */
  const simpanGambar = useCallback(() => {
    const kanvas = chartRef.current?.takeScreenshot()
    if (!kanvas) return
    const a = document.createElement('a')
    a.download = `PAPAN-${kode}-${kerangka}-${new Date().toISOString().slice(0, 10)}.png`
    a.href = kanvas.toDataURL('image/png')
    a.click()
  }, [kode, kerangka])

  /* ---------------- Modal setelan ---------------- */

  const instTerbuka = setelanTerbuka
    ? ind.daftar.find((x) => x.id === setelanTerbuka) ?? null
    : null
  const polTerbuka = setelanTerbuka && !instTerbuka
    ? pol.daftar.find((x) => x.id === setelanTerbuka) ?? null
    : null

  const siap = lilin.length > 0
  const kerangkaAktif = KERANGKA.find((k) => k.id === kerangka)

  return (
    <div className="lantai">
      <CatatanCakupan />
      {/* Penanda jahitan riwayat. Muncul HANYA untuk 49 emiten yang bar
          paling awalnya berasal dari sumber pembanding — sumber utama tak
          menyimpan periode itu. Wajib ada: pembaca yang menghitung return
          jangka panjang berhak tahu potongan awal grafiknya bukan dari sumber
          yang sama, karena konvensi penyesuaian aksi korporasi antar sumber
          tidak selalu cocok. Justru itu sebabnya 117 emiten lain DITOLAK dari
          penjahitan — yang lolos pun tetap dinyatakan, bukan disembunyikan. */}
      {berkas?.jahitan && (
        <p className="grf-jahitan" role="note">
          Riwayat sebelum <strong>{berkas.jahitan.sampai}</strong> (
          {berkas.jahitan.bar.toLocaleString('id-ID')} hari) berasal dari sumber pembanding —
          bagian itu disambungkan karena sumber utama tak menyimpan periode tersebut.
          Harga di rentang tumpang tindih keduanya sudah diadu dan cocok.
        </p>
      )}
      <section className="panel grf-panel" ref={panelRef}>
        {/* Bilah atas — susunan acuan Stockbit/TradingView: cari · kerangka
            waktu · jenis chart · ƒx Indikator · (kanan) layar penuh & kamera.
            Menggulung MENDATAR di telepon; tombol kerangka aktif digulirkan
            sendiri ke dalam pandangan (lihat efek di atas). */}
        <div className="grf-toolbar">
          <div className="grf-cari sea-cari">
            <IkonMenu d={IKON_CARI} size={13} />
            <span className="grf-kode-aktif">{kode}</span>
            <input className="inp" value={cari} placeholder="Cari emiten…"
              aria-label="Cari emiten"
              onChange={(e) => setCari(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && saran[0]) pilihEmiten(saran[0].kode) }} />
            {cari && (
              <button type="button" className="grf-cari-x" title="Batalkan pencarian"
                aria-label="Batalkan pencarian" onClick={() => setCari('')}>
                <IkonMenu d={IKON_SILANG} size={9} />
              </button>
            )}
            {saran.length > 0 && (
              <ul className="sea-saran" role="listbox">
                {saran.map((e) => (
                  <li key={e.kode}>
                    <button type="button" className="sea-saran-it" onClick={() => pilihEmiten(e.kode)}>
                      <span className="kd">{e.kode}</span>
                      <span className="nm">{e.nama}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <span className="grf-pisah" aria-hidden="true" />

          {/* Kerangka waktu. `title` tiap tombol menyebut BATAS RIWAYATNYA —
              tanpa itu pembaca menyangka 5m punya riwayat sepuluh tahun seperti
              D, lalu menyimpulkan datanya rusak saat grafiknya berhenti sebulan
              lalu. 1 menit sengaja tak ada (lihat KERANGKA). */}
          <div className="grf-kerangka" ref={bilahKerangkaRef} role="group" aria-label="Kerangka waktu">
            {KERANGKA.map((k) => (
              <button key={k.id} type="button"
                className={`chip-t${kerangka === k.id ? ' on' : ''}`}
                aria-pressed={kerangka === k.id} title={k.judul}
                onClick={() => setKerangka(k.id)}>{k.label}</button>
            ))}
          </div>

          <span className="grf-pisah" aria-hidden="true" />

          {/* Jenis gambar harga. Menukarnya membangun ulang seri harga tapi
              TIDAK menyentuh indikator & pola — lihat efek `jenisChart`. */}
          <span className="ti-grup grf-jenis">
            {JENIS_CHART.map(([nilai, label, ikon]) => (
              <TombolIkon key={nilai} d={ikon} ukuranIkon={14} label={`Gambar sebagai ${label}`}
                className={jenisChart === nilai ? 'on' : ''}
                onClick={() => setJenisChart(nilai)} />
            ))}
          </span>

          <span className="grf-pisah" aria-hidden="true" />

          {/* Dua menu TERPISAH — indikator dan pola (Johan: "jadi indikator
              dan pattern dibedakan dropdown nya"). Memilih jenis MENAMBAH satu
              instans baru, tak menyalakan sakelar; karena itu `nilai` sengaja
              dibiarkan kosong — tak ada jenis yang "terpilih", yang ada cuma
              daftar instans di legenda kanvas. */}
          <span className="grf-menu">
            {/* Sentuhan APA PUN pada menu ini memulai unduhan katalog (1,9 MB,
                sekali seumur sesi). Ditaruh di pembungkusnya, bukan sebagai
                prop baru di Dropdown: yang perlu diketahui cuma "pembaca menuju
                menu ini", dan itu sudah terjawab pointer/fokus. */}
            <span onPointerDownCapture={mintaKatalog} onFocusCapture={mintaKatalog}>
              <Dropdown opsi={opsiIndikator} nilai="" placeholder="ƒx Indikator"
                ariaLabel="Tambah indikator" onGanti={ind.tambah} />
            </span>
            {/* Menu Pola ikut memicu unduhan katalog, dan itu BUKAN kehati-hatian
                berlebih: pola Divergensi menghitung %K lewat entri Stochastic
                milik pustaka (`stochUntukDivergensi`). Tanpa katalog, deret %K
                kosong, nol pivot lolos, dan hasilnya dilaporkan sebagai "tak
                ada yang memenuhi syarat pada rentang ini" — kalimat yang
                berbohong, karena syaratnya tak pernah sempat diuji. Terukur
                20 Agu 2026 pada BBCA rentang Semua: 0 temuan sebelum menu
                Indikator disentuh, 62 temuan sesudahnya, tanpa satu pun
                parameter berubah. */}
            <span onPointerDownCapture={mintaKatalog} onFocusCapture={mintaKatalog}>
              <Dropdown opsi={opsiPola} nilai="" placeholder="+ Pola"
                ariaLabel="Tambah pola" onGanti={pol.tambah} />
            </span>
            {/* Compare symbols (#187). Menambah pembanding MEMAKSA skala
                persen — lihat efek mode skala. */}
            <Dropdown opsi={opsiBanding} nilai="" placeholder="+ Banding"
              ariaLabel="Tambah emiten pembanding"
              onGanti={(k) => setBanding((x) => (x.includes(k) || x.length >= MAKS_BANDING ? x : [...x, k]))} />
          </span>

          <span className="grf-pisah" aria-hidden="true" />

          {/* Bar replay (#187) — menyalakannya memundurkan chart ke 70% JENDELA
              yang sedang dipandang (bukan 70% seluruh riwayat: dengan chip
              "1M" di atas data 10 tahun, titik itu mendarat bertahun-tahun di
              luar layar dan replay-nya terlihat tak melakukan apa-apa) lalu
              memberi kendali maju satu lilin per klik di bilah bawah.
              Mematikannya mengembalikan seluruh rentang apa adanya. */}
          <TombolIkon d={IKON_ULANG} ukuranIkon={14}
            className={replay !== null ? 'on' : ''}
            label={replay !== null ? 'Keluar dari Bar replay' : 'Bar replay — mundurkan chart lalu maju selilin per klik'}
            onClick={() => {
              if (replay !== null) { setReplay(null); setPutar(false); return }
              setReplay(Math.max(1, awalRentang + Math.ceil((penuh.lilin.length - awalRentang) * 0.7)))
            }} />

          <span className="grf-pisah" aria-hidden="true" />

          {/* Template jadi SATU IKON (Johan 21 Agu 2026: "jadikan icon saja").
              Kotak nama + tombol Simpan memakan satu baris penuh di ponsel dan
              mendorong "Layar Penuh" ke baris kedua di laptop — mahal untuk
              kendali yang dipakai sesekali. Isinya pindah ke modal, berikut
              DAFTAR template yang tadinya menggantung di bawah kanvas; itu
              sekaligus mengembalikan ruang tegak ke chart. */}
          <TombolIkon d={IKON_KOTAK_ARSIP} ukuranIkon={14}
            className={template.length > 0 ? 'on' : ''}
            label={template.length > 0
              ? `Template — ${template.length} tersimpan`
              : 'Template — simpan susunan indikator & pola'}
            onClick={() => setTemplateBuka(true)} />

          <span className="grf-toolbar-isi" />

          <TombolIkon d={IKON_KAMERA} ukuranIkon={14} label="Simpan gambar kanvas (PNG)"
            onClick={simpanGambar} />
          <TombolLayarPenuh target={panelRef} aktif={layarPenuh} labelKeluar="Keluar" />
        </div>

        <div className="panel-b">
          {kodeAsing && (
            <p className="muted">
              Kode <strong>{kodeAsing}</strong> tidak ada di daftar emiten — yang
              ditampilkan {DEFAULT_KODE}. Periksa lagi kodenya, atau cari lewat kotak
              di atas.
            </p>
          )}
          {galat && <p className="muted">{galat}</p>}
          {galatIntra && (
            <p className="muted">
              {galatIntra} Lilin intraday ditarik dari sumber luar dan bisa menolak
              kapan saja. Kerangka D, W, dan M memakai data PAPAN sendiri — keduanya
              tak pernah bergantung padanya.
            </p>
          )}
          {!galat && !galatIntra && !siap && (
            <div className="fd-empty">
              <p>{muatIntra ? `Memuat lilin ${kerangkaAktif?.label} ${kode}…` : `Memuat data harga ${kode}…`}</p>
            </div>
          )}

          {/* Area kanvas: bilah alat gambar (kiri, desktop) + bungkus kanvas.
              Row di desktop, kolom di telepon (bilah jadi baris mendatar yang
              bisa disembunyikan — lihat AlatGambar.tsx & blok telepon di CSS).
              Tinggi kanvas TAK berubah karena bilah ini — cuma lebar yang
              dibagi, sama seperti legenda dalam-kanvas tak menambah tinggi. */}
          <div className="grf-kanvas-area">
            <AlatGambar
              pustaka={alatGambar.pustaka}
              galat={alatGambar.galat}
              alatAktif={alatGambar.alatAktif}
              onPilihAlat={alatGambar.pilihAlat}
              adaTerpilih={alatGambar.adaTerpilih}
              onHapusTerpilih={alatGambar.hapusTerpilih}
              onSentuh={alatGambar.mintaPustaka}
              magnet={alatGambar.magnet}
              onSiklusMagnet={alatGambar.sikluskanMagnet}
              onBukaSetelan={() => setSetelanGambarBuka(true)}
            />
          {/* Bungkus TERPISAH dari containerRef — lightweight-charts mengisi
              containerRef dengan kanvasnya sendiri; tanda PAPAN dipasang
              sebagai SAUDARA di bungkus ini (bukan anak containerRef) supaya
              React tak pernah rebutan anak elemen dengan DOM yang dikelola
              lightweight-charts secara imperatif. */}
          <div
            className="grf-kanvas-bungkus"
            ref={bungkusRef}
            onContextMenu={(e) => {
              // Menu peramban dicegah HANYA di dalam kanvas. Di luar itu
              // (daftar temuan, kaki, panduan) klik kanan tetap milik
              // peramban — menyalin teks temuan pola adalah hal yang wajar
              // dilakukan orang di halaman ini.
              e.preventDefault()
              const chart = chartRef.current
              const bungkus = bungkusRef.current
              const harga = hargaRef.current
              if (!chart || !bungkus) return
              const r = bungkus.getBoundingClientRect()
              const x = e.clientX - r.left
              const y = e.clientY - r.top
              // Harga & waktu DI TITIK KLIK, bukan harga terakhir: itu yang
              // membuat menunya menjawab "di sini", bukan "di chart ini".
              const t = chart.timeScale().coordinateToTime(x)
              // `coordinateToPrice` seri harga menerima koordinat DALAM PANEL
              // HARGA. `y` di sini relatif ke seluruh bungkus, jadi klik kanan
              // di panel volume atau RSI menyerahkan angka yang sudah lewat
              // ujung bawah skala harga — hasilnya butir "Salin harga 0", yang
              // bukan cuma salah tapi terlihat seperti data rusak.
              //
              // Di luar panel harga butir itu TIDAK ditawarkan sama sekali.
              // Menu tanpa "salin harga" jujur; menu dengan angka salah tidak.
              const tinggiPaneHarga = chart.panes()[0]?.getHeight() ?? 0
              const p = y >= 0 && y <= tinggiPaneHarga ? (harga?.coordinateToPrice(y) ?? null) : null
              setMenuKonteks({
                x, y,
                waktu: dariWaktuChart(t),
                harga: typeof p === 'number' && Number.isFinite(p) && p > 0 ? p : null,
              })
            }}
          >
            {/* Kanvas SELALU dipasang dengan ukuran final sejak awal (opacity,
                bukan display:none) — lihat komentar .grf-chart-wrap.memuat di
                GrafikEmiten.css: autoSize butuh lebar sungguhan sejak elemen
                dibuat, bukan sejak elemen "muncul". */}
            <div ref={containerRef} className={'grf-chart-wrap' + (siap ? '' : ' memuat')} />

            {/* Dot tooltip (Johan 21 Agu 2026: "keterangan di chart nya
                munculkan dot tooltips") — keterangan penanda MENGIKUTI
                kursor, bukan menunggu klik kanan. Dibatasi tiga baris: dot
                yang bertumpuk di satu lilin (swing + pola + patahan) tetap
                terbaca tanpa menutupi harga di belakangnya. */}
            {sorot && (() => {
              const dekat = penandaDiSekitar(penandaPola, indeksWaktu, sorot.waktu, 0)
              if (dekat.length === 0) return null
              // Lebar bungkus diukur langsung — tak ada state ukuran yang
              // disimpan, dan tooltip hanya butuh keputusan kiri/kanan.
              const lebar = bungkusRef.current?.clientWidth ?? 0
              const kanan = lebar > 0 && sorot.x > lebar / 2
              return (
                <div
                  className="grf-dot-tip"
                  style={{
                    left: kanan ? undefined : sorot.x + 14,
                    right: kanan ? lebar - sorot.x + 14 : undefined,
                    top: Math.max(8, sorot.y - 10),
                  }}
                >
                  {dekat.slice(0, 3).map((o, i) => <div key={i}>{o.teks}</div>)}
                  {dekat.length > 3 && <div className="muted">+{dekat.length - 3} lagi — klik kanan untuk semua</div>}
                </div>
              )
            })()}

            {/* Menu klik kanan (B32). Ditutup lewat latar tak terlihat yang
                menutupi kanvas — bukan `blur`, karena kanvas bukan elemen
                yang bisa difokus dan menunya akan menggantung selamanya.

                Butir yang tak punya arti di titik ini TIDAK dipajang mati:
                menu yang menyebut "Hapus 0 objek" lebih membingungkan
                daripada menu yang tak menyebutnya sama sekali. */}
            {menuKonteks && (() => {
              const objek = penandaDiSekitar(penandaPola, indeksWaktu, menuKonteks.waktu ?? '', 1)
              const gambar = alatGambar.adaTerpilih
              // Arah buka dihitung dari ukuran bungkus SAAT ITU, bukan dari
              // state ukuran yang disimpan: menu yang membuka ke kanan di
              // separuh kanan kanvas akan keluar layar.
              const rb = bungkusRef.current?.getBoundingClientRect()
              const kanan = !!rb && menuKonteks.x > rb.width / 2
              const bawah = !!rb && menuKonteks.y > rb.height / 2
              const tutup = () => setMenuKonteks(null)
              return (
                <>
                  <div className="grf-menu-latar" onClick={tutup} onContextMenu={(e) => { e.preventDefault(); tutup() }} />
                  <div className="dd-menu grf-menu-konteks" role="menu" style={{
                    left: menuKonteks.x, top: menuKonteks.y,
                    transform: `translate(${kanan ? '-100%' : '0'}, ${bawah ? '-100%' : '0'})`,
                  }}>
                    <button type="button" className="dd-it" role="menuitem"
                      onClick={() => { chartRef.current?.timeScale().fitContent(); tutup() }}>
                      Reset tampilan chart
                    </button>
                    {menuKonteks.harga !== null && (
                      <button type="button" className="dd-it" role="menuitem"
                        onClick={() => {
                          // Dibulatkan ke fraksi bursa: harga di titik kursor
                          // itu bilangan pecahan hasil skala piksel, dan
                          // "1.372,84" bukan harga yang bisa dipesan di papan.
                          salinTeks(String(keFraksi(menuKonteks.harga as number, 'dekat')))
                          tutup()
                        }}>
                        Salin harga {fN(keFraksi(menuKonteks.harga, 'dekat'), 0)}
                      </button>
                    )}
                    {menuKonteks.waktu && (
                      <button type="button" className="dd-it" role="menuitem"
                        onClick={() => { salinTeks(menuKonteks.waktu as string); tutup() }}>
                        Salin tanggal {menuKonteks.waktu}
                      </button>
                    )}
                    {objek.length > 0 && (
                      <span className="dd-grup" role="presentation">
                        {objek.length} penanda pola di titik ini
                      </span>
                    )}
                    {objek.slice(0, 4).map((o, i) => (
                      <span key={`${o.time}-${i}`} className="dd-it grf-menu-info" role="presentation">
                        {o.teks}
                      </span>
                    ))}
                    {gambar && (
                      <button type="button" className="dd-it merah" role="menuitem"
                        onClick={() => { alatGambar.hapusTerpilih(); tutup() }}>
                        Hapus gambar terpilih
                      </button>
                    )}
                    <button type="button" className="dd-it" role="menuitem"
                      onClick={() => { setGrid((g) => ({ ...g, tampil: !g.tampil })); tutup() }}>
                      {grid.tampil ? 'Sembunyikan garis bantu' : 'Tampilkan garis bantu'}
                    </button>
                  </div>
                </>
              )
            })()}

            {/* Tombol zoom — pojok kanan bawah kanvas, di atas sumbu waktu.
                Roda tikus & cubit tetap jalan; ini yang membuatnya terjangkau
                di telepon, tempat roda tikus tak ada sama sekali. */}
            <div className="grf-zoom">
              {/* aria-label wajib: isinya glyph telanjang (+, −, ⤢), dan pembaca
                  layar mengumumkan simbolnya, bukan maksudnya. `title` saja
                  tak cukup — ia bantuan untuk tetikus, bukan nama elemen. */}
              <button type="button" className="grf-zoom-btn" title="Perbesar" aria-label="Perbesar"
                onClick={() => zoom(1 / 1.3)}>+</button>
              <button type="button" className="grf-zoom-btn" title="Perkecil" aria-label="Perkecil"
                onClick={() => zoom(1.3)}>−</button>
              <button type="button" className="grf-zoom-btn grf-zoom-muat" title="Muat semua data" aria-label="Muat semua data"
                onClick={() => chartRef.current?.timeScale().fitContent()}>⤢</button>
            </div>

            {/* Legenda DI DALAM kanvas, pojok kiri atas tiap pane — seperti
                TradingView, dan sebabnya bukan sekadar mirip-miripan: di luar
                kanvas tiap indikator memakan satu baris penuh dan mendorong
                grafiknya turun terus seiring instans bertambah. Posisi atasnya
                diukur dari DOM pane-nya sendiri (lihat `ukurPane`). */}
            {legenda.perPane.map(([pane, baris]) => (
              <div key={pane} className="grf-legenda-kanvas" style={{ top: `${(posPane[pane] ?? 0) + 6}px` }}>
                {pane === 0 && status && (
                  // Baris status: emiten · kerangka · OHLC lilin yang disorot.
                  // Persis baris judul panel harga di chart acuan.
                  <span className="grf-status">
                    <span className="grf-status-kode">{kode}</span>
                    <span className="grf-status-tf">{kerangkaAktif?.label}</span>
                    <span>O {fN(status.l.open)}</span>
                    <span>H {fN(status.l.high)}</span>
                    <span>L {fN(status.l.low)}</span>
                    <span>C {fN(status.l.close)}</span>
                    <span className={status.naik ? 'grf-naik' : 'grf-turun'}>
                      {status.naik ? '+' : '−'}{fN(Math.abs(status.selisih))}
                      {' ('}{status.naik ? '+' : '−'}{fN(Math.abs(status.persen), 2)}%)
                    </span>
                    <span className="grf-status-vol">Vol {fN(status.volume, 0)}</span>
                    <span className="grf-legenda-tgl">{legenda.waktu}</span>
                  </span>
                )}
                {/* Ruas kaya (nilai transaksi, frekuensi, asing, saham
                    beredar) — baris KEDUA, dari `ohlcv_stockbit/` (bukan
                    `ohlc/`). Ditampilkan hanya kalau bar tanggal yang sedang
                    disorot benar-benar punya datanya; kalau tidak (lilin
                    dari jahitan Yahoo pra-2004), baris caption di bawahnya
                    mengatakan sejak kapan datanya ada — bukan diam-diam
                    menampilkan nol. */}
                {pane === 0 && status && (() => {
                  const k = kaya.byDate.get(status.l.time)
                  if (k) {
                    const netAsing = k.foreignBeli - k.foreignJual
                    return (
                      <span className="grf-status grf-status-kaya">
                        <span>Nilai {fmtB(k.nilai)}</span>
                        <span>Frek {fmtRingkas(k.frekuensi)}</span>
                        <span className={netAsing >= 0 ? 'grf-naik' : 'grf-turun'}>
                          Asing {netAsing >= 0 ? '+' : ''}{fmtB(netAsing)}
                        </span>
                        <span>Saham beredar {fmtRingkas(k.sahamBeredar)}</span>
                      </span>
                    )
                  }
                  // Tak ada bar — cuma disebut kalau memang tanggal yang
                  // disorot lebih tua dari cakupan ruas kaya (bukan sekadar
                  // belum termuat).
                  if (kaya.mulai && status.l.time < kaya.mulai) {
                    return (
                      <span className="grf-status grf-status-kaya muted">
                        Nilai transaksi, frekuensi, dan aliran asing tersedia sejak {tglPendek(kaya.mulai)}.
                      </span>
                    )
                  }
                  return null
                })()}
                {/* Legenda pembanding (#187) — persen SEMUA baris diukur dari
                    satu tanggal yang sama, dan tanggal itu disebut di baris
                    terakhir. Tanpa penyebutan itu "+18%" adalah angka yang
                    tak bisa ditafsirkan sama sekali, karena basisnya bergeser
                    sendiri tiap sumbu waktu digeser. */}
                {pane === 0 && bandingLegenda.length > 0 && (
                  <>
                    {bandingLegenda.map((b, i) => (
                      <span key={b.kode} className="grf-legenda-baris grf-banding-baris"
                        style={{ '--ind-warna': `var(${b.warna})` } as React.CSSProperties}>
                        <span className="grf-legenda-titik" aria-hidden="true" />
                        <span className="grf-legenda-nama">{b.kode}</span>
                        <span className="grf-legenda-nilai">{b.nilai}</span>
                        {!b.utama && (
                          <span className="ti-grup grf-legenda-aksi">
                            <TombolIkon d={IKON_SILANG} ukuranIkon={12}
                              label={`Buang pembanding ${b.kode}`}
                              onClick={() => setBanding((x) => x.filter((k) => k !== b.kode))} />
                          </span>
                        )}
                        {i === 0 && <span className="grf-banding-utama">utama</span>}
                      </span>
                    ))}
                    <span className="grf-banding-basis">
                      % relatif terhadap {basisPersen ? tglPendek(basisPersen) : 'lilin pertama yang terlihat'}
                      <span className="grf-banding-ket"> — bergeser sendiri saat sumbu waktu digeser</span>
                    </span>
                  </>
                )}
                {(() => {
                  // Lipat panel indikator. Cuma pane > 0: melipat panel HARGA
                  // berarti menyembunyikan isi yang justru datang untuk dilihat.
                  //
                  // Kuncinya id instans penghuni panel ini — bukan nomor
                  // panelnya, yang bergeser tiap kali panel lain lahir/mati.
                  if (pane === 0) return null
                  const idPanel = [...panePerInstans].find(([, p]) => p === pane)?.[0]
                    ?? (volumePanel === 'sendiri' && pane === 1 ? '__volume' : null)
                  if (!idPanel) return null
                  const terlipat = lipat.includes(idPanel)
                  return (
                    <button type="button" className="grf-lipat"
                      aria-expanded={!terlipat}
                      title={terlipat ? 'Buka panel' : 'Lipat panel'}
                      aria-label={terlipat ? `Buka panel ${pane}` : `Lipat panel ${pane}`}
                      onClick={() => setLipat((x) => (x.includes(idPanel) ? x.filter((i) => i !== idPanel) : [...x, idPanel]))}>
                      {terlipat ? 'v' : '^'}
                    </button>
                  )
                })()}
                {/* Mata MASTER (ala TradingView): satu klik memadamkan SEMUA
                    indikator & pola — chart kembali telanjang tanpa harus
                    mematikan satu-satu; klik lagi menyalakan semuanya.
                    Hanya di pane 0 dan hanya kalau ada >= 2 baris: satu baris
                    tak butuh sakelar massal. */}
                {pane === 0 && baris.length >= 2 && (() => {
                  const adaTampil = [...ind.daftar, ...pol.daftar].some((x) => x.tampil)
                  return (
                    <TombolIkon d={adaTampil ? IKON_MATA : IKON_MATA_CORET} ukuranIkon={12}
                      className="grf-mata-master"
                      label={adaTampil ? 'Sembunyikan SEMUA indikator & pola' : 'Tampilkan kembali semua indikator & pola'}
                      onClick={() => { ind.setSemuaTampil(!adaTampil); pol.setSemuaTampil(!adaTampil) }} />
                  )
                })()}
                {baris.map((b) => {
                  // `sakelarTampil`/`hapus` sama bentuknya di kedua daftar, jadi
                  // boleh dipanggil lewat gabungan keduanya.
                  const kelola = b.ranah === 'ind' ? ind : pol
                  return (
                    <span key={b.id} className={'grf-legenda-baris' + (b.tampil ? '' : ' redup')}
                      style={{ '--ind-warna': `var(${b.warna})` } as React.CSSProperties}>
                      <span className="grf-legenda-titik" aria-hidden="true" />
                      {/* B38: klik NAMANYA = sakelar tampil, seperti klik
                          label seri di TradingView — ikon mata tetap ada
                          untuk yang tak tahu konvensi itu. Tombol, bukan
                          onClick di span: fokus keyboard & pembaca layar. */}
                      <button type="button" className="grf-legenda-nama"
                        title={b.tampil
                          ? `Klik: sembunyikan ${b.label} · dobel-klik: setelan`
                          : `Klik: tampilkan ${b.label} · dobel-klik: setelan`}
                        onClick={() => kelola.sakelarTampil(b.id)}
                        /* Dua klik cepat memicu onClick DUA KALI sebelum
                           onDoubleClick — sakelarnya bolak-balik dan pulih
                           sendiri, jadi tak perlu debounce; yang tersisa
                           cuma modalnya terbuka. */
                        onDoubleClick={() => setSetelanTerbuka(b.id)}>
                        {b.label}
                      </button>
                      <span className="grf-legenda-nilai">{b.nilai}</span>
                      {/* Kelompok tombol ini satu-satunya yang MENERIMA kursor
                          di legenda (pointer-events:auto di CSS) — sisanya
                          tembus supaya crosshair tak terhalang teks. Ikonnya
                          MUNCUL saat baris disentuh (CSS), bukan permanen:
                          enam instans × tiga ikon menyala terus-menerus di atas
                          gambar harga membuat legendanya sendiri jadi hiasan
                          yang menutupi isinya. */}
                      <span className="ti-grup grf-legenda-aksi">
                        {/* B29 — pindah panel & urutkan. Hanya untuk INDIKATOR:
                            pola tak punya panel sendiri, penandanya menempel di
                            seri harga dan volume.

                            Naik/turun menukar posisi di daftar, dan urutan
                            daftar itulah yang menentukan nomor panel — jadi
                            tak ada nomor panel yang disimpan dan bisa basi. */}
                        {b.ranah === 'ind' && (
                          <>
                            <TombolIkon d={IKON_LILIN} ukuranIkon={12}
                              label={panePerInstans.get(b.id) === 0
                                ? `Pindahkan ${b.label} ke panel sendiri`
                                : `Gabungkan ${b.label} ke panel harga`}
                              onClick={() => ind.pindahPanel(b.id, panePerInstans.get(b.id) === 0 ? 'sendiri' : 'harga')} />
                            <TombolIkon d={IKON_PANAH_ATAS} ukuranIkon={12}
                              label={`Naikkan ${b.label}`}
                              onClick={() => ind.geser(b.id, -1, (x) => panePerInstans.get(x.id) !== 0)} />
                            <TombolIkon d={IKON_PANAH_BAWAH} ukuranIkon={12}
                              label={`Turunkan ${b.label}`}
                              onClick={() => ind.geser(b.id, 1, (x) => panePerInstans.get(x.id) !== 0)} />
                          </>
                        )}
                        <TombolIkon d={IKON_GIR} ukuranIkon={12}
                          label={`Setelan ${b.label}`}
                          onClick={() => setSetelanTerbuka(b.id)} />
                        <TombolIkon d={b.tampil ? IKON_MATA : IKON_MATA_CORET} ukuranIkon={12}
                          label={b.tampil ? `Sembunyikan ${b.label}` : `Tampilkan ${b.label}`}
                          onClick={() => kelola.sakelarTampil(b.id)} />
                        {/* Sengaja BUKAN nada="merah": modifier itu memberi
                            garis tepi merah permanen, dan tiga kotak merah
                            menyala di atas gambar harga terbaca sebagai
                            peringatan tentang sahamnya, bukan tentang tombol. */}
                        <TombolIkon d={IKON_TONG} ukuranIkon={12}
                          label={`Hapus ${b.label}`}
                          onClick={() => { kelola.hapus(b.id); setSetelanTerbuka(null) }} />
                      </span>
                    </span>
                  )
                })}
              </div>
            ))}

            {/* Tooltip pola DIMATIKAN 20 Agu 2026 atas permintaan Johan
                ("disable fungsi ini, repoti aja"). Ia mengambang mengikuti
                kursor di atas kanvas dan menutupi lilin yang justru sedang
                dibaca; keterangan yang sama — tanggal, harga, %K, ayun, rasio
                volume — sudah ada di daftar hasil pola di bawah kanvas, dalam
                bentuk yang bisa dibaca tenang dan disalin.

                Yang dibuang cuma penyajinya. `penandaDiSekitar()` di
                `lib/dasbor/grafikEmiten.ts` beserta ujinya sengaja DIBIARKAN:
                ia jawaban untuk "penanda mana yang ada di dekat titik ini",
                dan menu klik kanan yang sedang dibahas membutuhkan jawaban
                yang persis sama. */}
            {/* Tanda PAPAN — pengganti logo TradingView yang dimatikan lewat
                attributionLogo:false di atas (lihat komentar lisensi di situ).
                Atribusi lisensinya sendiri PINDAH ke kaki situs global
                (DasborLayout.tsx), BUKAN dihapus. Bentuknya SAMA dengan
                favicon.svg (bukan lambang baru) — SVG inline supaya warnanya
                ikut token tema. Pojok kiri bawah & kecil, persis tempat
                TradingView menaruh miliknya (Johan, putaran ketiga: "logo ini
                di telakkan persis tradingview yaa, jelek terlalu besar juga"). */}
            <svg className="grf-tanda-papan" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
              <rect x="4" y="4" width="56" height="56" rx="10" fill="var(--amber)" />
              <text x="32" y="33" textAnchor="middle" dominantBaseline="central"
                fontFamily="Consolas, 'Cascadia Mono', ui-monospace, monospace"
                fontSize="38" fontWeight="700" fill="var(--amber-ink)">P</text>
              <rect x="4" y="31" width="56" height="2" fill="var(--amber-ink)" opacity="0.32" />
            </svg>
          </div>
          </div>

          {/* Bilah bawah — rentang tampil, zona waktu, mode skala. Sama seperti
              kaki chart acuan: yang mengubah APA yang terlihat ada di bawah
              kanvas, yang mengubah APA yang digambar ada di atasnya. */}
          <div className="grf-kaki">
            <PemilihRentang
              className="grf-kaki-rentang"
              opsi={rentangOpsi}
              nilai={rentangLabel}
              onGanti={setRentangLabel}
            />
            <span className="grf-kaki-isi" />
            <span className="grf-kaki-jam" title="Seluruh waktu di halaman ini WIB (UTC+7), termasuk lilin intraday">UTC+7</span>
            {/* B33 — garis bantu. Duduk di bilah BAWAH, bukan di bilah atas:
                yang mengubah APA YANG TERLIHAT memang tempatnya di sini,
                sejajar skala dan rentang; yang mengubah APA YANG DIGAMBAR
                (emiten, kerangka, indikator) tetap di atas kanvas. */}
            <button type="button"
              className={`chip-t grf-kaki-chip${volumePanel === 'sendiri' ? ' on' : ''}`}
              aria-pressed={volumePanel === 'sendiri'}
              title={volumePanel === 'sendiri'
                ? 'Kembalikan volume ke dasar panel harga'
                : 'Pindahkan volume ke panel sendiri'}
              onClick={() => setVolumePanel((v) => (v === 'sendiri' ? 'harga' : 'sendiri'))}>vol</button>
            <button type="button"
              className={`chip-t grf-kaki-chip${grid.tampil ? ' on' : ''}`}
              aria-pressed={grid.tampil}
              title={grid.tampil ? 'Sembunyikan garis bantu' : 'Tampilkan garis bantu'}
              onClick={() => setGrid((g) => ({ ...g, tampil: !g.tampil }))}>grid</button>
            {grid.tampil && (
              <label className="grf-kaki-alfa" title="Keburaman garis bantu">
                <input
                  type="range" min={10} max={100} step={5}
                  value={Math.round(grid.alfa * 100)}
                  aria-label="Keburaman garis bantu, persen"
                  onChange={(e) => setGrid((g) => ({ ...g, alfa: Number(e.target.value) / 100 }))} />
                <span className="grf-kaki-alfa-nilai">{Math.round(grid.alfa * 100)}%</span>
              </label>
            )}
            {MODE_SKALA.map(([id, label, , judul]) => {
              // Selagi ada pembanding, skala DIKUNCI persen. Chip-nya tetap
              // terlihat (bukan hilang) supaya jelas keadaan mana yang sedang
              // berlaku dan kenapa ia tak bisa ditukar.
              const dikunci = banding.length > 0
              const on = dikunci ? id === 'persen' : modeSkala === id
              return (
                <button key={id} type="button"
                  className={`chip-t grf-kaki-chip${on ? ' on' : ''}`}
                  aria-pressed={on} disabled={dikunci}
                  title={dikunci
                    ? 'Dikunci persen selama ada emiten pembanding — pada sumbu rupiah, emiten berharga kecil jadi garis rata di dasar kanvas dan perbandingannya tak berarti'
                    : judul}
                  onClick={() => setModeSkala((x) => (x === id ? '' : id))}>{label}</button>
              )
            })}
            <button type="button"
              className={`chip-t grf-kaki-chip${autoSkala ? ' on' : ''}`}
              aria-pressed={autoSkala}
              title="Skala harga menyesuaikan sendiri ke lilin yang terlihat"
              onClick={() => setAutoSkala((x) => !x)}>auto</button>
          </div>

          {/* Bilah Bar replay (#187) — muncul hanya selagi replay hidup, tepat
              di bawah kaki: sama seperti chip rentang, ia mengubah APA YANG
              TERLIHAT, bukan apa yang digambar. Tombol ikonnya dibungkus
              `.ti-grup` (jarak 12px) — dua tombol ikon berdempetan punya area
              klik 44px yang saling tindih, dan di pasangan putar/keluar yang
              satu itu membatalkan seluruh sesi replay. */}
          {replay !== null && (
            <div className="grf-replay" role="group" aria-label="Bar replay">
              <span className="grf-replay-judul">Bar replay</span>
              {/* `tersedia` sengaja TIDAK diisi. Mengisinya menyalakan sepasang
                  panah bawaan DatePicker, dan panah itu duduk persis di
                  sebelah panah maju/mundur-selilin di bawah — empat panah
                  berjajar yang dua di antaranya melangkah per TANGGAL dan dua
                  per LILIN. Tanggal libur/akhir pekan tetap aman: DatePicker
                  sudah meredupkannya, dan `mulaiReplayDi` menjatuhkannya ke
                  lilin pertama sesudah tanggal itu. */}
              <DatePicker
                value={tglReplay}
                onChange={mulaiReplayDi}
                maks={penuh.lilin[penuh.lilin.length - 1]?.time.slice(0, 10)}
                ariaLabel="Tanggal lilin terakhir yang ditampilkan replay"
              />
              <span className="ti-grup">
                <LangkahTanggal arah="mundur" ukuran="sebaris" label="Mundur satu lilin"
                  disabled={replay <= 1}
                  onClick={() => { setPutar(false); setReplay((n) => Math.max(1, (n ?? 1) - 1)) }} />
                <LangkahTanggal arah="maju" ukuran="sebaris" label="Maju satu lilin"
                  disabled={replay >= penuh.lilin.length}
                  onClick={() => { setPutar(false); setReplay((n) => Math.min(penuh.lilin.length, (n ?? 0) + 1)) }} />
              </span>
              <span className="ti-grup">
                <TombolIkon d={putar ? IKON_JEDA : IKON_PUTAR} ukuranIkon={13}
                  className={putar ? 'on' : ''}
                  disabled={replay >= penuh.lilin.length}
                  label={putar ? 'Hentikan putar otomatis' : 'Putar otomatis'}
                  onClick={() => setPutar((x) => !x)} />
                <TombolIkon d={IKON_SILANG} ukuranIkon={13}
                  label="Keluar dari Bar replay — seluruh rentang tergambar lagi"
                  onClick={() => { setReplay(null); setPutar(false) }} />
              </span>
              <PemilihRentang
                className="grf-replay-cepat"
                opsi={KECEPATAN_REPLAY}
                nilai={kecepatan}
                onGanti={setKecepatan}
                ariaLabel="Kecepatan putar otomatis"
              />
              <span className="grf-replay-posisi">
                lilin {replay} dari {penuh.lilin.length}
                {tglReplay ? ` · ${tglPendek(tglReplay)}` : ''}
              </span>
            </div>
          )}


          {/* Hasil pencarian pola: apa yang ditemukan, di tanggal berapa, dan
              atas dasar apa. Berupa daftar teks di samping gambarnya karena
              tanggal, harga, dan rasio persisnya tak terbaca dari penanda di
              kanvas — dan angka itulah yang membuat temuannya bisa diperiksa. */}
          {polaPerInstans.some(({ inst }) => digambar(inst)) && (
            <div className="grf-pola-hasil">
              {polaPerInstans.filter(({ inst }) => digambar(inst)).map(({ inst, doubleBottom, lonjakan, musiman, divergensi, wyckoff, harmonik, swing, patahan, klasik }) => {
                const jumlah = doubleBottom.length + lonjakan.length + divergensi.length
                  + wyckoff.length + harmonik.length + patahan.length + klasik.length
                if (inst.jenis === 'musiman') {
                  return (
                    <div key={inst.id}>
                      <p className="grf-pola-judul">
                        {labelInstansPola(inst)}: {musiman
                          ? `${musiman.ringkas.n} hari di rentang ini`
                          : intraday(kerangka)
                            ? 'tidak dihitung pada kerangka intraday — perhitungannya berkunci tanggal, dan lilin dalam satu hari akan saling menimpa'
                            : 'rentangnya terlalu pendek untuk dihitung'}
                        {musiman && musiman.ringkas.n > MAKS_PENANDA_MUSIMAN
                          && ` — ${MAKS_PENANDA_MUSIMAN} terakhir ditandai di kanvas (angka di bawah tetap dari seluruh ${musiman.ringkas.n} hari); persempit rentang untuk melihat lebih ke belakang`}
                      </p>
                      {musiman && <RingkasanMusiman m={musiman} warna={inst.warna} />}
                    </div>
                  )
                }
                return (
                  <div key={inst.id}>
                    <p className="grf-pola-judul">
                      {labelInstansPola(inst)}: {jumlah === 0
                        ? inst.jenis === 'wyckoff'
                          ? 'rentangnya terlalu pendek untuk kedua MA-nya'
                          : 'tak ada yang memenuhi syarat pada rentang ini'
                        : inst.jenis === 'wyckoff'
                          ? `${jumlah} segmen fase`
                          : `${jumlah} ditemukan`}
                      {jumlah > MAKS_PENANDA_POLA
                        && ` — ${MAKS_PENANDA_POLA} terbaru digambar di kanvas`}
                    </p>
                    {wyckoff.length > 0 && (
                      <ul className="grf-pola-daftar">
                        {wyckoff.slice(-MAKS_PENANDA_POLA).reverse().map((w) => (
                          <li key={w.iMulai}
                            style={{ '--ind-warna': `var(${WARNA_FASE[w.fase]})` } as React.CSSProperties}>
                            <span className="grf-pola-status" title={ARTI_FASE[w.fase]}>{NAMA_FASE[w.fase]}</span>
                            <span>
                              {w.waktuMulai} &rarr; {w.waktuAkhir} ({w.panjang} lilin)
                              {' · '}tutup {fN(w.harga, 0)} vs MA {fN(w.maPendek, 0)}/{fN(w.maPanjang, 0)}
                              {' · '}RVOL {fN(w.rvol, 2)}&times;
                              {/* Dari mana label ini datang — FNet atau cadangan struktur
                                  MA — ikut ditulis, karena tanpa itu pembaca tak bisa tahu
                                  bahwa lilin sebelum 2020 memang tak punya catatan asing. */}
                              {' · '}{w.fnetDipakai
                                ? `net asing 5 lilin ${fN(w.fnet ?? 0, 0)} lembar`
                                : 'tanpa catatan asing — label dari struktur MA'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {jenisKlasik(inst.jenis) && klasik.length > 0 && (
                      <ul className="grf-pola-daftar">
                        {klasik.slice(-MAKS_PENANDA_POLA).reverse().map((q) => (
                          <li key={`k-${q.iSinyal}-${q.nama}`}
                            style={{ '--ind-warna': `var(${q.arah === 'bullish' ? '--green' : '--red'})` } as React.CSSProperties}>
                            <span className="grf-pola-status">{q.arah}</span>
                            <span>
                              {LABEL_POLA_KLASIK[q.nama]}
                              {' · '}{lilin[q.pivot[0].i]?.time} &rarr; {lilin[q.iSinyal]?.time}
                              {' · '}patah di {fN(q.hargaSinyal, 0)}
                              {' · '}target {fN(q.target, 0)} &middot; batal &gt; {fN(q.batal, 0)}
                              {' · '}<b>{LABEL_STATUS_POLA[q.status]}</b>
                              {q.iStatus !== null && ` (${lilin[q.iStatus]?.time})`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {jenisKlasik(inst.jenis) && (
                      // Angka backtest-nya DICETAK, bukan disembunyikan di
                      // balik kata "teruji" — permintaan eksplisit Johan:
                      // "bukan asal tebak berdasarkan hasil benchmark dan
                      // backtesting". Rinciannya di kepala polaKlasik.ts.
                      <p className="grf-pola-judul">
                        Backtest <b>seluruh 915 emiten berpola</b> (22.046 pola, arah benar vs peluang
                        dasar, bebas bocor): harian <b>−2,5pp</b> @20 lilin, pekanan ≈0pp. Sebagian besar
                        pola berada di sekitar atau di bawah peluang dasar — sampel 18 emiten likuid yang
                        dipakai lebih dulu memberi +4,2pp, dan ternyata tidak mewakili pasar.
                        Yang bertahan positif di kedua sapuan cuma dua: <b>Double Bottom</b> (+3,5…+8,6pp)
                        dan <b>Ascending Triangle</b> (+3,5…+5,9pp). Garisnya tetap berguna membaca
                        struktur; angkanya dicetak apa adanya supaya ditimbang, bukan dipercaya.
                      </p>
                    )}
                    {inst.jenis === 'struktur' && swing.length > 0 && (
                      <ul className="grf-pola-daftar">
                        {/* Patahan dulu, baru swing. Yang dicari orang lebih
                            sering "kapan strukturnya berubah" daripada daftar
                            ayunannya sendiri. */}
                        {patahan.slice(-MAKS_PENANDA_POLA).reverse().map((pt) => (
                          <li key={`p-${pt.i}`}
                            style={{ '--ind-warna': `var(${pt.jenis === 'CHoCH' ? '--amber' : '--blue'})` } as React.CSSProperties}>
                            <span className="grf-pola-status">{pt.jenis} {pt.arah}</span>
                            <span>
                              {pt.waktu} · penutupan melewati {fN(pt.harga, 0)}
                              {' · '}{pt.jenis === 'CHoCH' ? 'struktur berbalik' : 'struktur berlanjut'}
                            </span>
                          </li>
                        ))}
                        {swing.slice(-MAKS_PENANDA_POLA).reverse().map((sw) => (
                          <li key={`s-${sw.i}-${sw.jenis}`}
                            style={{ '--ind-warna': `var(${sw.label === 'HH' || sw.label === 'HL' ? '--green' : sw.label ? '--red' : '--text3'})` } as React.CSSProperties}>
                            <span className="grf-pola-status">{sw.label ?? (sw.jenis === 'high' ? 'SH' : 'SL')}</span>
                            <span>
                              {sw.waktu} · {sw.jenis === 'high' ? 'swing high' : 'swing low'} {fN(sw.harga, 0)}
                              {sw.label ? '' : ' · swing pertama, belum ada pembanding'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {harmonik.length > 0 && (
                      <ul className="grf-pola-daftar">
                        {harmonik.slice(-MAKS_PENANDA_POLA).reverse().map((h) => (
                          <li key={h.indeks.join('-')}
                            style={{ '--ind-warna': `var(${WARNA_HARMONIK[h.pola]})` } as React.CSSProperties}>
                            <span className="grf-pola-status">{NAMA_HARMONIK[h.pola]} {h.arah}</span>
                            <span>
                              X {h.waktu[0]} &rarr; D {h.waktu[4]} ({fN(h.harga[0], 0)} &rarr; {fN(h.harga[4], 0)})
                              {' · '}AB/XA {fN(h.ab, 3)} · BC/AB {fN(h.bc, 3)}
                              {' · '}CD/BC {fN(h.cd, 3)} · AD/XA {fN(h.ad, 3)}
                              {' · '}simpangan {fN(h.simpangan, 3)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {doubleBottom.length > 0 && (
                      <ul className="grf-pola-daftar">
                        {doubleBottom.slice(-MAKS_PENANDA_POLA).reverse().map((db) => (
                          <li key={`${db.iLembah1}-${db.iLembah2}`}
                            style={{ '--ind-warna': `var(${WARNA_STATUS[db.status]})` } as React.CSSProperties}>
                            <span className="grf-pola-status">{db.status}</span>
                            <span>
                              lembah {db.waktuLembah1} ({fN(db.hargaLembah1, 0)}) &amp; {db.waktuLembah2} ({fN(db.hargaLembah2, 0)})
                              {' · '}leher {db.waktuLeher} ({fN(db.hargaLeher, 0)})
                              {' · '}kedalaman {fN(db.kedalamanAtr, 1)}× ATR
                              {db.waktuKonfirmasi ? ` · tembus ${db.waktuKonfirmasi}` : ''}
                              {db.volumeMenguat ? ' · volume menguat' : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {divergensi.length > 0 && (
                      <ul className="grf-pola-daftar">
                        {divergensi.slice(-MAKS_PENANDA_POLA).reverse().map((dv) => (
                          <li key={`${dv.arah}-${dv.i1}-${dv.i2}`}
                            style={{ '--ind-warna': `var(${WARNA_DERAJAT[dv.derajat]})` } as React.CSSProperties}>
                            <span className="grf-pola-status">{dv.arah} {dv.derajat}</span>
                            <span>
                              {dv.arah === 'bearish' ? 'puncak' : 'lembah'} {dv.waktu1} ({fN(dv.harga1, 0)})
                              {' & '}{dv.waktu2} ({fN(dv.harga2, 0)}) · ayun {fN(dv.ayunPersen, 1)}%
                              {' · '}%K {fN(dv.stoch1, 1)} &rarr; {fN(dv.stoch2, 1)}
                              {' · volume '}{fN(dv.volume2 / dv.volume1, 2)}×
                              {dv.volumeMendukung ? ' (mengering)' : ' (tak mendukung)'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {lonjakan.length > 0 && (
                      <ul className="grf-pola-daftar">
                        {lonjakan.slice(-MAKS_PENANDA_POLA).reverse().map((lv) => (
                          <li key={lv.i}
                            style={{ '--ind-warna': `var(${WARNA_LONJAKAN[lv.status]})` } as React.CSSProperties}>
                            <span className="grf-pola-status">
                              {lv.status === 'takTerkonfirmasi' ? 'tak terkonfirmasi' : lv.status}
                            </span>
                            <span>
                              {lv.waktu} · harga +{fN(lv.ubahPersen, 2)}%
                              {' · '}RVOL {fN(lv.rvol, 1)}× (volume {fN(lv.volume, 0)} vs rata-rata {fN(lv.rataVolume, 0)})
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <details className="grf-panduan">
            <summary><IkonMenu d={IKON_INFO} size={12} /> Apa arti indikator-indikator ini?</summary>
            <dl className="grf-panduan-daftar">
              {PANDUAN_INDIKATOR.map(({ label, teks }) => (
                <div key={label} className="grf-panduan-item">
                  <dt>{label}</dt>
                  <dd>{teks}</dd>
                </div>
              ))}
            </dl>
          </details>

          <details className="grf-panduan">
            <summary><IkonMenu d={IKON_INFO} size={12} /> Bagaimana pola dicari?</summary>
            <dl className="grf-panduan-daftar">
              {PANDUAN_POLA.map(({ label, teks }) => (
                <div key={label} className="grf-panduan-item">
                  <dt>{label}</dt>
                  <dd>{teks}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      </section>

      {/* Template: menyimpan susunan indikator + pola dengan nama, dan
          memuatnya kembali. Disimpan di localStorage — alasannya panjang dan
          ada di grafikEmiten.ts (ringkasnya: ini preferensi tampilan, bukan
          data bersama).

          Sejak 21 Agu 2026 isinya di dalam modal, bukan menggantung di bawah
          kanvas: kotak nama + tombol Simpan memakan satu baris penuh di ponsel
          untuk kendali yang dipakai sesekali, dan daftarnya memakan ruang
          tegak yang lebih berguna untuk chart. */}
      {templateBuka && (
        <ModalKecil label="Template grafik" onClose={() => setTemplateBuka(false)}>
          <div className="grf-template-simpan">
            <input className="inp grf-template-nama" value={namaTemplate}
              placeholder="Nama template…" aria-label="Nama template" autoFocus
              onChange={(e) => setNamaTemplate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && namaTemplate.trim()) {
                  simpanDaftarTemplate(simpanTemplate(template, namaTemplate, isiTemplate()))
                }
              }} />
            <button type="button" className="dd-btn"
              disabled={!namaTemplate.trim()}
              title={template.some((t) => t.nama === namaTemplate.trim())
                ? 'Timpa template dengan susunan sekarang'
                : 'Simpan susunan sekarang sebagai template baru'}
              onClick={() => simpanDaftarTemplate(simpanTemplate(template, namaTemplate, isiTemplate()))}>
              {template.some((t) => t.nama === namaTemplate.trim()) ? 'Timpa' : 'Simpan'}
            </button>
          </div>

          {template.length === 0 && (
            <p className="muted" style={{ margin: 0, fontSize: 11.5 }}>
              Belum ada template. Susun indikator &amp; pola di kanvas, lalu beri nama di atas —
              emiten sengaja tidak ikut disimpan, jadi satu template bisa dipakai untuk saham mana pun.
            </p>
          )}
{template.length > 0 && (
            <ul className="grf-template-daftar">
              {template.map((t) => (
                <li key={t.nama} className="grf-template-baris">
                  {namaDiubah?.lama === t.nama ? (
                    <input className="inp grf-template-nama" autoFocus value={namaDiubah.teks}
                      aria-label={`Nama baru untuk ${t.nama}`}
                      onChange={(e) => setNamaDiubah({ lama: t.nama, teks: e.target.value })}
                      onBlur={() => {
                        simpanDaftarTemplate(ubahNamaTemplate(template, t.nama, namaDiubah.teks))
                        setNamaDiubah(null)
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }} />
                  ) : (
                    <button type="button" className="dd-btn grf-template-muat"
                      title={`Muat ${t.nama}`} onClick={() => muatTemplate(t)}>
                      {t.bawaan && <span className="grf-template-tanda" title="Dimuat otomatis saat halaman dibuka">•</span>}
                      {t.nama}
                    </button>
                  )}
                  <span className="grf-template-isi">
                    {t.indikator.length} indikator · {t.pola.length} pola
                    {t.jenisChart ? ` · ${t.jenisChart}` : ''}{t.rentang ? ` · ${t.rentang}` : ''}
                    {' · emiten tak ikut disimpan'}
                  </span>
                  <button type="button" className="dd-btn"
                    aria-pressed={t.bawaan}
                    title={t.bawaan ? 'Berhenti memuatnya otomatis' : 'Muat otomatis saat halaman dibuka'}
                    onClick={() => simpanDaftarTemplate(tandaiBawaan(template, t.nama))}>Bawaan</button>
                  <button type="button" className="dd-btn"
                    title={`Ganti nama ${t.nama}`}
                    onClick={() => setNamaDiubah({ lama: t.nama, teks: t.nama })}>Ganti nama</button>
                  <button type="button" className="dd-btn"
                    title={`Hapus ${t.nama}`}
                    onClick={() => simpanDaftarTemplate(hapusTemplate(template, t.nama))}>
                    <IkonMenu d={IKON_TONG} size={11} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ModalKecil>
      )}

      {/* Modal setelan GAMBAR terpilih (#185 lanjutan, Johan: "line gak ada
          setup modal warna ketebalan ketipisan ... selalu berat bawaan
          nya"). Jalur API: `IDrawing.updateStyle` LANGSUNG (pustaka gambar
          memang menyediakannya, publik — lihat komentar `terapkanGaya` di
          `useAlatGambar.ts`), bukan tulis-ulang localStorage. Warna disimpan
          sebagai token (`--green` dst) di sini SAJA — begitu diklik,
          di-resolve ke warna literal lewat `getComputedStyle(containerRef)`
          (pola sama dengan efek tema chart di atas) sebelum diteruskan ke
          hook; `gayaTerpilih.lineColor` yang datang balik dari pustaka
          karena itu SELALU literal, tak pernah nama token — dibandingkan
          apa adanya, bukan di-resolve balik. */}
      {setelanGambarBuka && alatGambar.gayaTerpilih && (() => {
        const gaya = alatGambar.gayaTerpilih
        const tebalSekarang = gaya.lineWidth ?? 1
        const gayaGarisSekarang = gayaDariDash(gaya.lineDash)
        const resolveToken = (token: string) => {
          const el = containerRef.current
          const v = el ? getComputedStyle(el).getPropertyValue(token).trim() : ''
          return v || token
        }
        const warnaBebasSah = /^#[0-9a-f]{6}$/i.test(gaya.lineColor ?? '')
        return (
          <ModalKecil label="Setelan gambar" onClose={() => setSetelanGambarBuka(false)}>
            <div className="grf-setel-baris" role="group" aria-label="Warna gambar">
              <span className="grf-setel-lbl">Warna</span>
              <span className="grf-setel-warna">
                {PALET_GAYA_GAMBAR.map((tok) => {
                  const terpakai = resolveToken(tok).toLowerCase() === (gaya.lineColor ?? '').toLowerCase()
                  return (
                    <button key={tok} type="button"
                      className={`grf-swatch${terpakai ? ' on' : ''}`}
                      style={{ background: `var(${tok})` }}
                      aria-pressed={terpakai}
                      title={tok.replace('--', '')} aria-label={`Warna ${tok.replace('--', '')}`}
                      onClick={() => alatGambar.terapkanGaya({ warna: resolveToken(tok) })} />
                  )
                })}
                {/* Warna bebas — <input type=color> native, sudah literal
                    (tak perlu resolusi token). */}
                <input type="color" aria-label="Warna gambar bebas"
                  value={warnaBebasSah ? (gaya.lineColor as string) : '#000000'}
                  onChange={(e) => alatGambar.terapkanGaya({ warna: e.target.value })} />
              </span>
            </div>

            <div className="grf-setel-baris" role="group" aria-label="Ketebalan garis gambar">
              <span className="grf-setel-lbl">Ketebalan</span>
              <span className="grf-setel-garis">
                {[1, 2, 3, 4].map((t) => (
                  <button key={t} type="button" className={`chip-t${tebalSekarang === t ? ' on' : ''}`}
                    aria-pressed={tebalSekarang === t} title={`Tebal ${t}px`}
                    onClick={() => alatGambar.terapkanGaya({ tebal: t })}>{t}px</button>
                ))}
              </span>
            </div>

            <div className="grf-setel-baris" role="group" aria-label="Gaya garis gambar">
              <span className="grf-setel-lbl">Gaya</span>
              <span className="grf-setel-garis">
                {GAYA_GARIS_GAMBAR.map(([nilai, label]) => (
                  <button key={nilai} type="button" className={`chip-t${gayaGarisSekarang === nilai ? ' on' : ''}`}
                    aria-pressed={gayaGarisSekarang === nilai}
                    onClick={() => alatGambar.terapkanGaya({ gaya: nilai })}>{label}</button>
                ))}
              </span>
            </div>

            {/* Keluarga Fibonacci: editor level, meniru dialog TV (dipelajari
                langsung 21 Agu 2026 lewat remote Chrome) — tiap baris nilai
                EDITABLE + bisa dihapus, dan level baru bebas ditambah, bukan
                daftar baku. Beda sadar dari TV: tanpa warna per level
                (pustaka menerima `levels: number[]` saja) dan tanpa 24 slot
                tetap — daftarnya tumbuh sesuai isi. */}
            {alatGambar.opsiFibTerpilih && (() => {
              const of = alatGambar.opsiFibTerpilih
              const ubahLevel = (i: number, v: number) => {
                if (!Number.isFinite(v)) return
                const levels = of.levels.slice()
                levels[i] = v
                alatGambar.terapkanOpsiFib({ levels })
              }
              const tambahLevel = (v: number) => {
                if (!Number.isFinite(v) || of.levels.includes(v)) return
                alatGambar.terapkanOpsiFib({ levels: [...of.levels, v].sort((a, b) => a - b) })
              }
              const CEPAT = [1.272, 1.414, 2, 3.618, 4.236].filter((v) => !of.levels.includes(v))
              return (
                <>
                  <div className="grf-setel-baris" role="group" aria-label="Level Fibonacci">
                    <span className="grf-setel-lbl">Level</span>
                    <span className="grf-fib-level">
                      {of.levels.map((lv, i) => (
                        /* key ikut NILAI: input uncontrolled (defaultValue)
                           supaya "1.272" bisa diketik utuh tanpa direbut
                           render; commit di blur/Enter, dan key baru me-
                           remount input dengan nilai yang sudah sah. */
                        <span key={`${i}-${lv}`} className="grf-fib-item">
                          <input className="inp" type="number" step="0.001" defaultValue={lv}
                            aria-label={`Level Fibonacci ${lv}`}
                            onBlur={(e) => { const v = Number(e.target.value); if (v !== lv) ubahLevel(i, v) }}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                          <button type="button" className="chip-t" title={`Hapus level ${lv}`}
                            aria-label={`Hapus level ${lv}`}
                            onClick={() => alatGambar.terapkanOpsiFib({ levels: of.levels.filter((_, j) => j !== i) })}>
                            ×
                          </button>
                        </span>
                      ))}
                    </span>
                  </div>
                  <div className="grf-setel-baris" role="group" aria-label="Tambah level Fibonacci">
                    <span className="grf-setel-lbl">Tambah</span>
                    <span className="grf-fib-level">
                      <input className="inp" type="number" step="0.001" placeholder="mis. 1.13"
                        aria-label="Nilai level Fibonacci baru"
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return
                          const el = e.target as HTMLInputElement
                          tambahLevel(Number(el.value))
                          el.value = ''
                        }} />
                      {CEPAT.map((v) => (
                        <button key={v} type="button" className="chip-t" title={`Tambah level ${v}`}
                          onClick={() => tambahLevel(v)}>+{v}</button>
                      ))}
                    </span>
                  </div>
                  <div className="grf-setel-baris" role="group" aria-label="Opsi Fibonacci">
                    <span className="grf-setel-lbl">Opsi</span>
                    <span className="grf-setel-garis">
                      {([
                        ['extendLines', 'Perpanjang garis'],
                        ['reverseDirection', 'Balik arah'],
                        ['showPrices', 'Harga'],
                        ['showPercentages', 'Persen'],
                      ] as const).map(([k, label]) => (
                        <button key={k} type="button" className={`chip-t${of[k] ? ' on' : ''}`}
                          aria-pressed={of[k]}
                          onClick={() => alatGambar.terapkanOpsiFib({ [k]: !of[k] })}>{label}</button>
                      ))}
                    </span>
                  </div>
                </>
              )
            })()}
          </ModalKecil>
        )
      })()}

      {/* Modal setelan — dua cabang terpisah, bukan satu bercabang tipe:
          `ModalSetelanInstans` ber-generik pada jenisnya, dan gabungan dua
          daftar bertipe beda tak bisa memuaskan satu generik. */}
      {instTerbuka && (
        <ModalSetelanInstans
          inst={instTerbuka}
          nama={labelInstansIndikator(instTerbuka, katalog)}
          param={ind.paramSpek(instTerbuka.jenis)}
          plot={garisPerInstans.find((x) => x.inst.id === instTerbuka.id)?.garis.map((g) => g.nama) ?? []}
          jumlahLilin={lilin.length}
          onSimpan={ind.terapkan}
          onTutup={() => setSetelanTerbuka(null)}
          onBawaan={() => ind.bawaan(instTerbuka.jenis)}
        />
      )}
      {polTerbuka && (
        <ModalSetelanInstans
          inst={polTerbuka}
          nama={labelInstansPola(polTerbuka)}
          param={pol.paramSpek(polTerbuka.jenis)}
          plot={[]}
          jumlahLilin={lilin.length}
          onSimpan={pol.terapkan}
          onTutup={() => setSetelanTerbuka(null)}
          onBawaan={() => pol.bawaan(polTerbuka.jenis)}
        />
      )}
    </div>
  )
}
