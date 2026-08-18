import { PemilihRentang } from '../../components/dasbor/PemilihRentang'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createChart, createSeriesMarkers, createTextWatermark,
  CandlestickSeries, HistogramSeries, LineSeries, LineStyle,
  type IChartApi, type IPriceLine, type ISeriesApi, type ISeriesMarkersPluginApi,
  type ITextWatermarkPluginApi,
  type MouseEventParams, type SeriesMarker, type SeriesType, type Time,
} from 'lightweight-charts'
import { useKamusEmiten } from '../../lib/dasbor/kamusEmiten'
import {
  keDataLilinVolume, batasBawahRentang, potongRentang, RENTANG_GRAFIK, RENTANG_BAWAAN,
  keSeriGaris, SPEK_INDIKATOR, SPEK_POLA, labelInstansIndikator, labelInstansPola,
  spekJenis, idPustaka,
  hitungInstans, cariDoubleBottom, cariLonjakanVolume, cariMusiman,
  bacaTemplateTersimpan, tulisTemplateTersimpan, simpanTemplate, hapusTemplate,
  tandaiBawaan, ubahNamaTemplate, penandaDiSekitar,
  type BerkasOhlcEmiten, type DoubleBottom, type JenisAsli, type JenisIndikator, type JenisPola,
  type ParamDoubleBottom, type ParamLonjakanVolume, type StatusPola, type StatusLonjakan,
  type LonjakanVolume, type TemplateGrafik, type TemuanMusiman,
} from '../../lib/dasbor/grafikEmiten'
import { Dropdown } from '../../components/dasbor/Dropdown'
import {
  muatKatalog, KATEGORI, ID_SUDAH_ADA, type Katalog,
} from '../../lib/dasbor/katalogIndikator'
import { useDaftarInstans, SetelanInstans } from '../../components/dasbor/DaftarInstans'
import { TombolIkon } from '../../components/dasbor/TombolIkon'
import { fN } from '../../lib/dasbor/format'
import { pesanGalat } from '../../lib/pesanGalat'
import {
  IkonMenu, IKON_CARI, IKON_SILANG, IKON_GRAFIK_NAIK, IKON_INFO, IKON_TONG, IKON_MATA,
  IKON_MATA_CORET, IKON_GIR,
} from '../../components/dasbor/IkonMenu'
import { useTheme } from '../../context/ThemeContext'
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
const JENIS_POLA = Object.keys(SPEK_POLA) as JenisPola[]

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
 *  ditambahkan — Johan: "ada seperti untuk chart chandles dan line saja dulu". */
export type JenisChart = 'lilin' | 'garis'
const JENIS_CHART: Array<[JenisChart, string]> = [['lilin', 'Lilin'], ['garis', 'Garis']]

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
}

const spekPola = (jenis: JenisPola) => SPEK_POLA[jenis].param

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
    teks: 'Di bawah "Pilihan PAPAN" pada menu Indikator ada katalog penuh pustaka lightweight-charts-indicators (MIT), dikelompokkan menurut kategori pustakanya sendiri: rata-rata bergerak, osilator, momentum, tren, volatilitas, pita & kanal, volume, pola lilin. Ketik di kotak cari untuk menyaringnya. Daftarnya dibaca dari registry pustaka, bukan disalin — versi pustaka berikutnya langsung terbaca apa adanya.' },
  { label: 'Katalog: apa yang tidak ikut, dan kenapa',
    teks: 'Indikator yang keluarannya bukan deret angka (kebanyakan pola lilin yang menggambar penanda) tidak dimasukkan — kanvas ini menggambar deret, dan indikator yang menyala tapi tak menggambar apa pun lebih membingungkan daripada indikator yang jujur tak ada. Penempatannya (menumpang di panel harga atau panel sendiri di bawah) juga dibaca dari registry, bukan ditebak. Sebagian parameter yang bukan angka — pilihan sumber harga, sakelar ya/tidak — memakai bawaan pustaka.' },
  { label: 'Sepuluh yang dikurasi, dan pemeriksaan silangnya',
    teks: 'MA, EMA, BB, RSI, MACD, dan OBV dihitung kode PAPAN sendiri; Stochastic, StochRSI, W%R, dan VWAP memakai rumus pustaka tapi dengan label dan parameter yang sudah dirapikan. Kesepuluhnya muncul paling atas di menu, dan versi pustaka dari enam yang pertama sengaja tidak ikut di katalog supaya tak ada dua garis bernama sama yang boleh berbeda. Sebagai pemeriksaan silang, RSI PAPAN diadu dengan RSI pustaka pada data yang sama di dalam uji otomatis.' },
  { label: 'Beberapa instans sekaligus',
    teks: 'Satu jenis boleh dimasukkan berkali-kali dengan parameter berbeda — MA 20, MA 50, dan MA 200 bisa hidup bersamaan, masing-masing punya warna, kolom parameter, dan sakelar tampilnya sendiri.' },
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
  { label: 'Musiman — apa yang ditandai',
    teks: 'Pilih satu hari (Senin–Jumat) dan lilin hari itu ditandai kotak di kanvas. Kotaknya menunjuk "ini hari yang dimaksud", bukan menyarankan apa pun; angkanya ada di tooltip dan di daftar bawah. Yang ditandai 60 lilin terakhir saja — pada rentang bertahun-tahun, menandai semuanya menghasilkan satu pita pekat yang justru menutupi harganya. Angka statistiknya tetap dihitung dari seluruh hari di rentang itu.' },
  { label: 'Musiman — kenapa n selalu ikut disebut',
    teks: 'Peluang naik 60% dari 12 hari dan dari 240 hari terlihat sama meyakinkannya di layar, padahal yang pertama hampir pasti kebetulan. Karena itu jumlah observasi (n), selang kepercayaan 95%, dan hasil uji permutasi selalu menempel pada angkanya — di legenda, di tooltip, dan di daftar.' },
  { label: 'Musiman — rentang perhitungannya',
    teks: 'Persis rentang yang sedang tergambar (chip 1T/3T/5T/Semua). Mengganti chip berarti menghitung ulang pola harinya pada rentang itu — angka yang tertulis selalu berasal dari lilin yang terlihat, tak pernah dari data yang tak ada di layar. Angkanya sendiri datang dari perhitungan yang sama dengan halaman Seasonality, bukan hitungan kedua.' },
  { label: 'OBV melengkapi, bukan mengulang',
    teks: 'Pola Lonjakan Volume melihat SATU hari. Indikator OBV (On-Balance Volume, ada di dropdown Indikator) menumpuk arah volume sepanjang riwayat: ditambah saat harga tutup naik, dikurangi saat turun. Angka mutlaknya tak berarti — yang dibaca arahnya. Satu hari saja bukti yang tipis.' },
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
 * Grafik Emiten (chart PAPAN tahap 3) — lilin + volume dari OHLC lokal
 * (`data-idx/json/ohlc/<KODE>.json`, tahap 1/2), digambar `lightweight-charts`
 * (opsi A, keputusan Johan). BEDA dari /chart (`ChartIndeks.tsx`): itu widget
 * TradingView yang menggambar data TradingView sendiri; ini kanvas milik
 * PAPAN sendiri — perlu supaya overlay khas PAPAN (pita musiman, akumulasi
 * broker, penanda Radar — tahap berikutnya) bisa dipasang.
 */
export function GrafikEmiten() {
  const { theme } = useTheme()
  const kamus = useKamusEmiten()
  const [kode, setKode] = useState(DEFAULT_KODE)
  const [cari, setCari] = useState('')
  const [berkas, setBerkas] = useState<BerkasOhlcEmiten | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [rentangLabel, setRentangLabel] = useState<string>(RENTANG_BAWAAN)
  const [jenisChart, setJenisChart] = useState<JenisChart>('lilin')
  // Bertambah tiap seri harga dibuat ulang. Efek-efek yang MENEMPEL pada seri
  // harga (data, warna, garis leher pola) memakainya sebagai dependensi:
  // tanpa itu mereka tak tahu serinya sudah berganti dan tetap memegang seri
  // yang sudah dibongkar — grafiknya kosong tanpa satu pun galat.
  const [versiSeriHarga, setVersiSeriHarga] = useState(0)
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

  // Titik yang sedang disorot kursor: waktunya ('yyyy-mm-dd') DAN letaknya di
  // dalam kanvas. `null` berarti "belum disentuh, pakai titik TERAKHIR"
  // (legenda tetap berguna sebelum pembaca menyentuh kanvas sama sekali).
  //
  // Letaknya ikut disimpan karena tooltip pola harus muncul DI DEKAT
  // penandanya; tooltip yang selalu di pojok memaksa mata bolak-balik antara
  // penanda dan keterangannya, dan itu persis kerja yang tooltipnya harusnya
  // hilangkan.
  const [sorot, setSorot] = useState<{ waktu: string; x: number; y: number } | null>(null)
  /** Instans mana yang panel setelannya sedang terbuka (id), null = tak ada.
   *  Satu saja pada satu waktu: dua panel melayang bersamaan akan saling
   *  menutupi di kanvas telepon yang lebarnya cuma 380-an piksel. */
  const [setelanTerbuka, setSetelanTerbuka] = useState<string | null>(null)

  /**
   * Katalog indikator pustaka (457 entri) — `null` selagi belum dimuat.
   *
   * Dimuat SESUAI PERMINTAAN, bukan saat halaman dibuka: bundelnya 1,9 MB dan
   * sebagian besar pembaca /grafik tak pernah membuka menu indikator sama
   * sekali. Pemicunya dua, dan keduanya perlu:
   * 1. pembaca menyentuh dropdown Indikator (menunya memang butuh isinya), dan
   * 2. template yang dimuat membawa instans `p:` (garisnya harus tergambar
   *    tanpa pembacanya perlu membuka menu apa pun).
   */
  const [katalog, setKatalog] = useState<Katalog | null>(null)
  const mintaKatalog = useCallback(() => {
    // `muatKatalog` sendiri sudah menyimpan janjinya, jadi memanggilnya
    // berkali-kali (tiap sentuhan menu) tak mengunduh berkali-kali.
    void muatKatalog().then((k) => setKatalog((lama) => lama ?? k))
  }, [])

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

  // Pola kotak cari + saran — disalin dari SeasonalityHarian.tsx, sumbernya
  // kamusEmiten.ts (963 emiten, sudah dimuat halaman lain juga lewat hook
  // yang sama, jadi tak ada unduhan berlipat kalau kedua halaman dibuka).
  const saran = useMemo(() => {
    const q = cari.trim().toUpperCase()
    if (!kamus || q.length < 1) return []
    return kamus.emiten.filter((e) => e.kode.startsWith(q) || e.nama.toUpperCase().includes(q)).slice(0, 8)
  }, [kamus, cari])

  const containerRef = useRef<HTMLDivElement>(null)
  // Bungkus kanvas — acuan posisi legenda dalam-kanvas (lihat `posPane`).
  const bungkusRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
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
  // saat pane berubah ukuran. Elemen CSS di belakang kanvas akan menuntut
  // pengukuran ulang yang sama dengan legenda, untuk hasil yang lebih buruk.
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
      // = melanggar lisensi. Gantinya: baris atribusi di kaki halaman
      // (lihat JSX, dekat "Sumber data") — jangan hapus baris itu juga.
      layout: { background: { color: 'transparent' }, attributionLogo: false },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        tickMarkFormatter: (waktu: unknown) => {
          // `time` bisa berupa string 'YYYY-MM-DD' (yang kita pakai) atau
          // detik epoch — ditangani keduanya supaya tak diam-diam kosong.
          const d = typeof waktu === 'string' ? new Date(waktu) : new Date(Number(waktu) * 1000)
          if (Number.isNaN(d.getTime())) return ''
          const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
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
    const saatGeserKursor = (param: MouseEventParams<Time>) => {
      if (typeof param.time === 'string' && param.point) {
        setSorot({ waktu: param.time, x: param.point.x, y: param.point.y })
        return
      }
      // Sorotan DIBUANG hanya di perangkat ber-hover. Di telepon, crosshair
      // ikut hilang begitu jari diangkat — membuang sorotan di situ berarti
      // tooltip lenyap sepersekian detik sesudah diketuk, tanpa pernah sempat
      // dibaca. Di sana ia bertahan sampai ketukan berikutnya.
      if (window.matchMedia('(hover: hover)').matches) setSorot(null)
    }
    chart.subscribeCrosshairMove(saatGeserKursor)
    // Klik/ketuk ikut dilanggan supaya tooltip pola punya jalur SENTUH: di
    // telepon tak ada hover sama sekali, dan crosshair cuma bergerak selagi
    // jari menempel — sekali diangkat, keterangannya lenyap sebelum sempat
    // dibaca. Ketukan menahannya sampai ketukan berikutnya.
    chart.subscribeClick(saatGeserKursor)
    return () => {
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
   *
   * Seri indikator TIDAK ikut terhapus: masing-masing berdiri sendiri di
   * `seriIndRef` dan tak punya hubungan induk-anak dengan seri harga. Yang
   * memang menempel pada seri harga cuma dua — plugin penanda dan garis
   * leher pola — dan keduanya dipasang ulang di sini / di efek pola.
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
      grid: { vertLines: { color: line }, horzLines: { color: line } },
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
  }, [theme, versiSeriHarga])

  // Watermark kode emiten — ikut berganti saat emiten diganti, dan warnanya
  // dibaca ulang tiap tema ditukar. BEDA dari tanda PAPAN di pojok kiri
  // bawah; keduanya hidup bersamaan, satu menandai emitennya, satu menandai
  // siapa yang menggambar.
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
        fontFamily: "'Red Hat Mono', Consolas, ui-monospace, monospace",
        fontStyle: 'bold',
      }],
    })
  }, [kode, theme])

  // Lilin + volume dipotong ke rentang terpilih. Ikut `theme` di deps supaya
  // warna volume (dihitung per-batang, beda dari upColor/downColor series
  // lilin yang cukup lewat applyOptions) ikut berubah saat tema diganti.
  const { lilin, volume } = useMemo(() => {
    if (!berkas) return { lilin: [], volume: [] }
    const cs = containerRef.current ? getComputedStyle(containerRef.current) : null
    const green = cs?.getPropertyValue('--green').trim() || '#38B77E'
    const red = cs?.getPropertyValue('--red').trim() || '#E6635A'
    const semua = keDataLilinVolume(berkas.d, green, red)
    const [, tahun] = RENTANG_GRAFIK.find(([label]) => label === rentangLabel) ?? RENTANG_GRAFIK[0]
    const batas = batasBawahRentang(berkas.akhir, tahun)
    return { lilin: potongRentang(semua.lilin, batas), volume: potongRentang(semua.volume, batas) }
  }, [berkas, rentangLabel, theme])

  useEffect(() => {
    const harga = hargaRef.current
    if (harga?.seriesType() === 'Candlestick') {
      (harga as ISeriesApi<'Candlestick'>).setData(lilin)
    } else if (harga?.seriesType() === 'Line') {
      (harga as ISeriesApi<'Line'>).setData(lilin.map((l) => ({ time: l.time, value: l.close })))
    }
    volRef.current?.setData(volume)
    chartRef.current?.timeScale().fitContent()
    // Angka terukur buat verifikasi/QA (bukan data sensitif — cuma jumlah &
    // rentang tanggal yang sudah tampak di sumbu chart-nya sendiri). Canvas
    // tak punya DOM per-lilin buat dibaca lewat devtools, jadi ini jalan
    // paling murah utk mengecek "berapa yang sebenarnya terpasang" tanpa
    // menambah dependency baru.
    const el = containerRef.current
    if (el) {
      el.dataset.jumlahLilin = String(lilin.length)
      el.dataset.tglPertama = lilin[0]?.time ?? ''
      el.dataset.tglAkhir = lilin[lilin.length - 1]?.time ?? ''
    }
  }, [lilin, volume, versiSeriHarga])

  // Dua daftar instans, dua dropdown, satu aturan main (lihat DaftarInstans).
  // Spek parameter sebuah jenis — kurasi ATAU entri katalog. Ikut `katalog` di
  // deps supaya kolom setelan instans pustaka muncul begitu katalognya tiba,
  // bukan tetap kosong sampai halaman dimuat ulang.
  const spekIndikator = useCallback(
    (jenis: JenisIndikator) => spekJenis(jenis, katalog)?.param ?? [],
    [katalog],
  )
  const ind = useDaftarInstans<JenisIndikator>(spekIndikator, lilin.length)
  const pol = useDaftarInstans<JenisPola>(spekPola, lilin.length, true)

  // Jenis pola yang sudah ada di daftar tetap TERLIHAT di menu, tapi tak bisa
  // dipilih lagi — lihat alasan batasnya di useDaftarInstans.
  /**
   * Isi dropdown "+ Indikator": sepuluh kurasi PAPAN di atas, lalu seluruh
   * katalog pustaka dikelompokkan per KATEGORI REGISTRY.
   *
   * Kategorinya milik pustaka (`entri.kategori`) — bukan taksonomi karangan
   * sendiri yang harus dijaga tetap sinkron tiap kali pustakanya naik versi.
   * Urutan kelompoknya yang kita tentukan (`KATEGORI`), dan kategori yang tak
   * terdaftar di situ tetap muncul di bawah dengan namanya sendiri: kategori
   * baru tak boleh membuat indikatornya lenyap dari menu tanpa ada yang tahu.
   *
   * Yang tak masuk: entri yang rumusnya sudah kita punya (`ID_SUDAH_ADA`) —
   * dua "RSI" di satu menu berarti dua garis yang boleh berbeda tanpa ada yang
   * tahu mana yang benar.
   */
  const opsiIndikator = useMemo(() => {
    if (!katalog) {
      return [...OPSI_KURASI, {
        nilai: '', label: 'Memuat katalog pustaka…', nonaktif: true, grup: 'Katalog pustaka',
      }]
    }
    const urutan = new Map(KATEGORI.map(([ing], i) => [ing, i]))
    const entri = [...katalog.values()]
      .filter((e) => !ID_SUDAH_ADA.has(e.id))
      .sort((a, b) => (urutan.get(a.kategori) ?? 99) - (urutan.get(b.kategori) ?? 99)
        || a.nama.localeCompare(b.nama))
    return [...OPSI_KURASI, ...entri.map((e) => ({
      nilai: `p:${e.id}`,
      // Nama panjang + pendek keduanya ikut supaya kotak cari menemukannya
      // lewat singkatan ("ADX") maupun kata lengkapnya ("Directional").
      label: e.nama === e.singkat ? e.nama : `${e.nama} · ${e.singkat}`,
      grup: KATEGORI.find(([ing]) => ing === e.kategori)?.[1] ?? e.kategori,
    }))]
  }, [katalog])

  const opsiPola = useMemo(() => JENIS_POLA.map((jenis) => {
    const sudah = pol.daftar.some((x) => x.jenis === jenis)
    return {
      nilai: jenis,
      label: sudah ? `${SPEK_POLA[jenis].label} · sudah ada` : SPEK_POLA[jenis].label,
      nonaktif: sudah,
    }
  }), [pol.daftar])

  // Deret tiap instans, dihitung dari `lilin` — SUDAH tersaring
  // hariTanpaPerdagangan lewat keDataLilinVolume di atas, bukan `berkas.d`
  // mentah, supaya angkanya sama dengan yang benar-benar tergambar di lilin.
  // Satu memo dipakai dua pembaca (penggambar seri & legenda) supaya angka
  // yang tergambar dan angka yang terbaca mustahil berbeda.
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
      // persis rentang yang tergambar (alasan lengkapnya di `cariMusiman`).
      musiman: inst.jenis === 'musiman' ? cariMusiman(lilin, inst.param.hari) : null,
    }))
  }, [pol.daftar, lilin, volume])

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
  const panePerInstans = useMemo(() => {
    const peta = new Map<string, number>()
    let berikut = 1
    for (const inst of ind.daftar) {
      if (!inst.tampil) continue
      // Jenis pustaka yang katalognya belum tiba dianggap PANEL SENDIRI
      // (bukan menumpang di panel harga): salah menaruh osilator 0-100 di
      // skala rupiah membuatnya rata di dasar kanvas dan terlihat seperti
      // indikator rusak; sebaliknya panel kosong sesaat cuma terlihat lengang.
      peta.set(inst.id, spekJenis(inst.jenis, katalog)?.diPanelHarga ? 0 : berikut++)
    }
    return peta
  }, [ind.daftar, katalog])

  // Jarak atas tiap pane dari ujung atas bungkus kanvas, dipakai menempatkan
  // legenda di pojok kiri atas pane MASING-MASING (RSI/MACD punya legendanya
  // sendiri, seperti TradingView). Diukur dari DOM pane-nya sendiri
  // (`getHTMLElement`), bukan dijumlah dari tinggi + tebal pemisah yang
  // ditebak — tebakan itu meleset beberapa piksel dan legendanya duduk
  // separuh di luar panenya.
  const [posPane, setPosPane] = useState<number[]>([0])
  // Ukuran bungkus kanvas — dipakai tooltip pola memutuskan ke arah mana ia
  // dibuka: di separuh kanan kanvas ia harus membuka ke KIRI, kalau tidak
  // isinya terpotong tepi kanvas justru saat penandanya paling baru (dan
  // penanda terbaru selalu di kanan).
  const [ukuranBungkus, setUkuranBungkus] = useState({ w: 0, h: 0 })
  const ukurPane = useCallback(() => {
    const chart = chartRef.current
    const bungkus = bungkusRef.current
    if (!chart || !bungkus) return
    const rBungkus = bungkus.getBoundingClientRect()
    setUkuranBungkus((lama) => (Math.abs(lama.w - rBungkus.width) < 1 && Math.abs(lama.h - rBungkus.height) < 1
      ? lama : { w: rBungkus.width, h: rBungkus.height }))
    const atasBungkus = rBungkus.top
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

    const opsiGaris = { lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }
    for (const { inst, garis } of garisPerInstans) {
      const pane = panePerInstans.get(inst.id)
      if (pane === undefined) continue // tak tampil
      const warna = baca(inst.warna)
      for (const g of garis) {
        if (g.histogram) {
          const s = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, pane)
          s.setData(g.seri.map((p) => ({ ...p, color: p.value >= 0 ? green : red })))
          seriIndRef.current.push(s)
        } else {
          const s = chart.addSeries(
            LineSeries,
            { ...opsiGaris, color: warna, lineStyle: g.bantu ? LineStyle.Dashed : LineStyle.Solid },
            pane,
          )
          s.setData(g.seri)
          seriIndRef.current.push(s)
        }
      }
    }

    // Panel harga tetap yang paling besar — tanpa ini pane RSI/MACD sama
    // tingginya dengan panel harga (stretch factor bawaan sama-sama 1).
    const panes = chart.panes()
    panes[0]?.setStretchFactor(3)
    for (let i = 1; i < panes.length; i++) panes[i]?.setStretchFactor(1.1)
    // Diukur SESUDAH tata letak dihitung ulang, bukan di baris yang sama —
    // tinggi pane baru belum berlaku pada saat setStretchFactor kembali.
    requestAnimationFrame(ukurPane)
  }, [garisPerInstans, panePerInstans, theme, ukurPane])

  // Legenda: satu baris pendek per instans yang tampil, menyebut parameternya
  // ("MA 200", bukan "MA"), pada titik yang disorot kursor — jatuh balik ke
  // titik TERAKHIR selagi kursor belum digeser ke kanvas. Dikelompokkan per
  // pane: yang menumpang di panel harga muncul di pojok kiri atas panel
  // harga, RSI/MACD di pojok kiri atas pane-nya sendiri.
  const legenda = useMemo(() => {
    const waktu = sorot?.waktu ?? lilin[lilin.length - 1]?.time ?? null
    // Pane 0 SELALU ada walau belum ada satu pun instans — ia yang memuat
    // tombol "+ Indikator"/"+ Pola". Tanpa itu, kendali penambahnya cuma
    // muncul setelah ada yang ditambahkan, yaitu setelah tak diperlukan lagi.
    const perPane = new Map<number, BarisLegenda[]>([[0, []]])
    const dorong = (pane: number, b: BarisLegenda) => {
      const baris = perPane.get(pane) ?? []
      baris.push(b)
      perPane.set(pane, baris)
    }
    for (const { inst, peta } of petaLegenda) {
      // Instans yang SEDANG DISEMBUNYIKAN tetap didaftar (redup, di pane 0):
      // tombol "tampilkan lagi" dulu ada di baris bawah kanvas yang kini
      // sudah tak ada, jadi tanpa ini menyembunyikan sebuah indikator sama
      // dengan menguncinya — tak ada lagi pintu untuk mengembalikannya.
      const pane = panePerInstans.get(inst.id) ?? 0
      dorong(pane, {
        id: inst.id,
        ranah: 'ind',
        tampil: inst.tampil,
        warna: inst.warna,
        label: labelInstansIndikator(inst, katalog),
        nilai: !inst.tampil || !waktu
          ? ''
          : peta.map((p) => { const x = p.get(waktu); return x === undefined ? '—' : fN(x) }).join(' / '),
      })
    }
    // Pola selalu di pane 0: temuannya digambar di panel harga & volume, tak
    // pernah punya pane sendiri.
    for (const { inst, doubleBottom, lonjakan, musiman } of polaPerInstans) {
      const jumlah = doubleBottom.length + lonjakan.length
      dorong(0, {
        id: inst.id,
        ranah: 'pol',
        tampil: inst.tampil,
        warna: inst.warna,
        label: labelInstansPola(inst),
        // Musiman bukan "temuan": ia satu ringkasan, bukan daftar kejadian.
        // `n` ikut disebut di legenda — angka peluang tanpa jumlah observasi
        // di sebelahnya terlihat sama meyakinkannya dari 12 maupun 240 hari.
        nilai: musiman
          ? `naik ${fN(musiman.ringkas.tersusut, 0)}% · n=${musiman.ringkas.n}`
          : jumlah === 0 ? 'tak ada' : `${jumlah} temuan`,
      })
    }
    return { waktu, perPane: [...perPane.entries()].sort((a, b) => a[0] - b[0]) }
  }, [sorot, lilin, petaLegenda, panePerInstans, polaPerInstans, katalog])

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
    // Rentang yang tak dikenal (label pernah berubah) dilewati, bukan disetel
    // ke label yang tak ada — chip yang tak cocok apa pun akan membuat seluruh
    // pemilih rentang tampak mati.
    if (t.rentang && RENTANG_GRAFIK.some(([label]) => label === t.rentang)) setRentangLabel(t.rentang)
    setNamaTemplate(t.nama)
  }

  const isiTemplate = () => ({ indikator: ind.daftar, pola: pol.daftar, jenisChart, rentang: rentangLabel })

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
    for (const { inst, doubleBottom, lonjakan, musiman } of polaPerInstans) {
      if (!inst.tampil) continue
      const nama = labelInstansPola(inst)
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
  }, [polaPerInstans])

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
      time: p.time, position: p.posisi, shape: p.bentuk ?? 'circle', color: baca(p.token),
    })
    penandaRef.current?.setMarkers(penandaPola.filter((p) => p.seri === 'harga').map(keMarker))
    // Penanda Lonjakan Volume dipasang di seri VOLUME, bukan seri harga: di
    // seri harga ia berebut tempat dengan penanda Double Bottom, dan di bawah
    // batang volume justru di situ angkanya berarti.
    penandaVolRef.current?.setMarkers(penandaPola.filter((p) => p.seri === 'volume').map(keMarker))

    for (const { inst, doubleBottom } of polaPerInstans) {
      if (!inst.tampil) continue
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
      polaPerInstans.reduce((n, x) => n + x.doubleBottom.length + x.lonjakan.length, 0),
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
  }, [penandaPola, polaPerInstans, theme, versiSeriHarga])

  // Isi tooltip pola: penanda di lilin yang sedang disorot DAN satu lilin di
  // kiri-kanannya (lihat `penandaDiSekitar` — dua penanda berdempetan wajib
  // disebut keduanya, bukan menang-menangan).
  const indeksWaktu = useMemo(() => new Map(lilin.map((l, i) => [l.time, i])), [lilin])
  const isiTip = useMemo(
    () => (sorot ? penandaDiSekitar(penandaPola, indeksWaktu, sorot.waktu, 1) : []),
    [sorot, penandaPola, indeksWaktu],
  )

  const pemilih = (
    <div className="panel">
      <div className="panel-b grf-cari-baris">
        <span className="lbl">Emiten</span>
        <span className="grf-kode-aktif">{kode}</span>
        <div className="sea-cari" style={{ flex: '1 1 220px', maxWidth: 320 }}>
          <IkonMenu d={IKON_CARI} size={14} />
          <input className="inp" value={cari} placeholder="Cari kode atau nama emiten…"
            onChange={(e) => setCari(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && saran[0]) { setKode(saran[0].kode); setCari('') } }} />
          {saran.length > 0 && (
            <ul className="sea-saran" role="listbox">
              {saran.map((e) => (
                <li key={e.kode}>
                  <button type="button" className="sea-saran-it" onClick={() => { setKode(e.kode); setCari('') }}>
                    <span className="kd">{e.kode}</span>
                    <span className="nm">{e.nama}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {cari && (
          <button type="button" className="dd-btn" onClick={() => setCari('')} title="Batalkan pencarian">
            <IkonMenu d={IKON_SILANG} size={9} />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="lantai">
      {pemilih}
      <section className="panel">
        <div className="panel-h">
          <span className="lbl"><IkonMenu d={IKON_GRAFIK_NAIK} size={13} /> {kode} — Harga &amp; Volume</span>
          <div className="grf-rentang">
            {/* Jenis gambar harga. Menukarnya membangun ulang seri harga tapi
                TIDAK menyentuh indikator & pola — lihat efek `jenisChart`. */}
            {JENIS_CHART.map(([nilai, label]) => (
              <button key={nilai} type="button"
                className={`chip-t${jenisChart === nilai ? ' on' : ''}`}
                aria-pressed={jenisChart === nilai}
                onClick={() => setJenisChart(nilai)}>{label}</button>
            ))}
            <span className="grf-pisah" aria-hidden="true" />
            <PemilihRentang
              opsi={RENTANG_GRAFIK.map(([label]) => ({ id: label, label }))}
              nilai={rentangLabel}
              onGanti={setRentangLabel}
            />
          </div>
        </div>
        <div className="panel-b">
          {galat && <p className="muted">{galat}</p>}
          {!galat && !berkas && <div className="fd-empty"><p>Memuat data harga {kode}…</p></div>}

          {/* Bungkus TERPISAH dari containerRef — lightweight-charts mengisi
              containerRef dengan kanvasnya sendiri; tanda PAPAN dipasang
              sebagai SAUDARA di bungkus ini (bukan anak containerRef) supaya
              React tak pernah rebutan anak elemen dengan DOM yang dikelola
              lightweight-charts secara imperatif. Hover DI WADAH INI
              (bukan di tanda sendiri — tandanya pointer-events:none, tak
              bisa di-hover) yang mempertegas tanda lewat CSS
              `.grf-kanvas-bungkus:hover .grf-tanda-papan` di GrafikEmiten.css. */}
          <div className="grf-kanvas-bungkus" ref={bungkusRef}>
            {/* Kanvas SELALU dipasang dengan ukuran final sejak awal (opacity,
                bukan display:none) — lihat komentar .grf-chart-wrap.memuat di
                GrafikEmiten.css: autoSize butuh lebar sungguhan sejak elemen
                dibuat, bukan sejak elemen "muncul". */}
            <div ref={containerRef} className={'grf-chart-wrap' + (berkas ? '' : ' memuat')} />

            {/* Legenda DI DALAM kanvas, pojok kiri atas tiap pane — seperti
                TradingView, dan sebabnya bukan sekadar mirip-miripan: di luar
                kanvas tiap indikator memakan satu baris penuh dan mendorong
                grafiknya turun terus seiring instans bertambah. Dipasang
                sebagai SAUDARA kanvas (bukan anaknya) dengan alasan yang sama
                dengan tanda PAPAN di bawah: React tak pernah rebutan anak
                elemen dengan DOM yang dikelola lightweight-charts. Posisi
                atasnya diukur dari DOM pane-nya sendiri (lihat `ukurPane`). */}
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

            {legenda.perPane.map(([pane, baris]) => (
              <div key={pane} className="grf-legenda-kanvas" style={{ top: `${(posPane[pane] ?? 0) + 6}px` }}>
                {pane === 0 && (
                  <>
                    {/* Dua dropdown TERPISAH — indikator dan pola (Johan:
                        "jadi indikator dan pattern dibedakan dropdown nya").
                        Memilih jenis MENAMBAH satu instans baru, tak
                        menyalakan sakelar; karena itu `nilai` sengaja
                        dibiarkan kosong — tak ada jenis yang "terpilih", yang
                        ada cuma daftar instans di bawahnya. Duduk DI DALAM
                        kanvas sejak 18 Agu 2026, bersama legendanya. */}
                    <span className="grf-kendali-kanvas">
                      {/* Sentuhan APA PUN pada dropdown ini memulai unduhan
                          katalog (1,9 MB, sekali seumur sesi). Ditaruh di
                          pembungkusnya, bukan sebagai prop baru di Dropdown:
                          yang perlu diketahui cuma "pembaca menuju menu ini",
                          dan itu sudah terjawab pointer/fokus — tanpa menambah
                          satu lagi tanggung jawab ke komponen yang dipakai
                          belasan halaman lain. */}
                      <span onPointerDownCapture={mintaKatalog} onFocusCapture={mintaKatalog}>
                        <Dropdown opsi={opsiIndikator} nilai="" placeholder="+ Indikator"
                          ariaLabel="Tambah indikator" onGanti={ind.tambah} />
                      </span>
                      <Dropdown opsi={opsiPola} nilai="" placeholder="+ Pola"
                        ariaLabel="Tambah pola" onGanti={pol.tambah} />
                    </span>
                    <span className="grf-legenda-tgl">{legenda.waktu}</span>
                  </>
                )}
                {baris.map((b) => {
                  // `sakelarTampil`/`hapus` sama bentuknya di kedua daftar, jadi
                  // boleh dipanggil lewat gabungan keduanya. Instansnya TIDAK:
                  // `SetelanInstans` ber-generik pada jenisnya, dan gabungan
                  // dua daftar bertipe beda tak bisa memuaskan satu generik —
                  // karena itu panelnya dipasang di dua cabang terpisah di
                  // bawah, bukan satu cabang bertipe gabungan.
                  const kelola = b.ranah === 'ind' ? ind : pol
                  const instInd = b.ranah === 'ind' ? ind.daftar.find((x) => x.id === b.id) : undefined
                  const instPol = b.ranah === 'pol' ? pol.daftar.find((x) => x.id === b.id) : undefined
                  return (
                    <span key={b.id} className={'grf-legenda-baris' + (b.tampil ? '' : ' redup')}
                      style={{ '--ind-warna': `var(${b.warna})` } as React.CSSProperties}>
                      <span className="grf-legenda-titik" aria-hidden="true" />
                      <span className="grf-legenda-nama">{b.label}</span>
                      <span className="grf-legenda-nilai">{b.nilai}</span>
                      {/* Kelompok tombol ini satu-satunya yang MENERIMA kursor
                          di legenda (pointer-events:auto di CSS) — sisanya
                          tembus supaya crosshair tak terhalang teks. */}
                      <span className="ti-grup grf-legenda-aksi">
                        <TombolIkon d={IKON_GIR} ukuranIkon={12}
                          label={`Setelan ${b.label}`}
                          onClick={() => setSetelanTerbuka((x) => (x === b.id ? null : b.id))} />
                        <TombolIkon d={b.tampil ? IKON_MATA : IKON_MATA_CORET} ukuranIkon={12}
                          label={b.tampil ? `Sembunyikan ${b.label}` : `Tampilkan ${b.label}`}
                          onClick={() => kelola.sakelarTampil(b.id)} />
                        {/* Sengaja BUKAN nada="merah": modifier itu memberi
                            garis tepi merah permanen, dan tiga kotak merah
                            menyala di atas gambar harga terbaca sebagai
                            peringatan tentang sahamnya, bukan tentang tombol.
                            Warnanya muncul saat disorot, seperti tombol ikon
                            lain di kanvas. */}
                        <TombolIkon d={IKON_TONG} ukuranIkon={12}
                          label={`Hapus ${b.label}`}
                          onClick={() => { kelola.hapus(b.id); setSetelanTerbuka(null) }} />
                      </span>
                      {setelanTerbuka === b.id && instInd && (
                        <SetelanInstans kelola={ind} inst={instInd} nama={b.label}
                          onTutup={() => setSetelanTerbuka(null)} />
                      )}
                      {setelanTerbuka === b.id && instPol && (
                        <SetelanInstans kelola={pol} inst={instPol} nama={b.label}
                          onTutup={() => setSetelanTerbuka(null)} />
                      )}
                    </span>
                  )
                })}
              </div>
            ))}

            {/* Tooltip pola — menggantikan teks yang dulu menempel di tiap
                penanda dan saling menimpa. Muncul di dekat kursor/ketukan,
                menyebut SEMUA penanda di sekitarnya (lihat `penandaDiSekitar`).
                pointer-events:none supaya ia tak pernah merebut kursor dari
                kanvas yang justru sedang menghitung crosshair-nya. */}
            {sorot && isiTip.length > 0 && (
              <div className="grf-pola-tip" role="status" style={{
                left: sorot.x,
                top: sorot.y,
                transform: `translate(${sorot.x > ukuranBungkus.w / 2 ? 'calc(-100% - 14px)' : '14px'}, ${sorot.y > ukuranBungkus.h / 2 ? 'calc(-100% - 14px)' : '14px'})`,
              }}>
                {isiTip.map((p) => (
                  <span key={`${p.time}-${p.teks}`} className="grf-pola-tip-baris"
                    style={{ '--ind-warna': `var(${p.token})` } as React.CSSProperties}>
                    <span className="grf-legenda-titik" aria-hidden="true" />
                    <span className="grf-pola-tip-tgl">{p.time}</span>
                    <span>{p.teks}</span>
                  </span>
                ))}
              </div>
            )}
            {/* Tanda PAPAN — pengganti logo TradingView yang dimatikan lewat
                attributionLogo:false di atas (lihat komentar lisensi di situ).
                Atribusi lisensinya sendiri PINDAH ke kaki situs global
                (DasborLayout.tsx), BUKAN dihapus — lihat komentar di sana.
                Bentuknya SAMA dengan favicon.svg yang sudah ada (bukan
                lambang baru) — ditulis ulang sebagai SVG inline (bukan
                <img src="/favicon.svg">) supaya warnanya bisa ikut token
                tema (--amber/--amber-ink) alih-alih heksadesimal tetap
                bawaan berkas SVG-nya. Watermark BESAR (lihat ukuran di CSS,
                Johan minta "terpampang nyata") di TENGAH kanvas — bukan
                pojok kiri bawah seperti versi pertama, karena di ukuran
                besar pojok itu menabrak label sumbu waktu & batang volume.
                Menguat saat wadahnya di-hover (lihat CSS), tak menghalangi
                kursor/crosshair. */}
            <svg className="grf-tanda-papan" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
              <rect x="4" y="4" width="56" height="56" rx="10" fill="var(--amber)" />
              <text x="32" y="33" textAnchor="middle" dominantBaseline="central"
                fontFamily="Consolas, 'Cascadia Mono', ui-monospace, monospace"
                fontSize="38" fontWeight="700" fill="var(--amber-ink)">P</text>
              <rect x="4" y="31" width="56" height="2" fill="var(--amber-ink)" opacity="0.32" />
            </svg>
          </div>

          {/* Template: menyimpan susunan indikator + pola dengan nama, dan
              memuatnya kembali. Disimpan di localStorage — alasannya panjang
              dan ada di grafikEmiten.ts (ringkasnya: ini preferensi tampilan,
              bukan data bersama). DI BAWAH kanvas sejak 18 Agu 2026: di atas
              kanvas ia mendorong grafiknya turun sejauh tinggi daftarnya
              sendiri, dan itu bagian dari keluhan yang sama dengan indikator. */}
          <div className="grf-template">
            <div className="grf-template-simpan">
              <input className="inp grf-template-nama" value={namaTemplate}
                placeholder="Nama template…" aria-label="Nama template"
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
          </div>

          {/* Hasil pencarian pola: apa yang ditemukan, di tanggal berapa, dan
              atas dasar apa. Berupa daftar teks di samping gambarnya karena
              tanggal, harga, dan rasio persisnya tak terbaca dari penanda di
              kanvas — dan angka itulah yang membuat temuannya bisa diperiksa. */}
          {polaPerInstans.some(({ inst }) => inst.tampil) && (
            <div className="grf-pola-hasil">
              {polaPerInstans.filter(({ inst }) => inst.tampil).map(({ inst, doubleBottom, lonjakan, musiman }) => {
                const jumlah = doubleBottom.length + lonjakan.length
                if (inst.jenis === 'musiman') {
                  return (
                    <div key={inst.id}>
                      <p className="grf-pola-judul">
                        {labelInstansPola(inst)}: {musiman
                          ? `${musiman.ringkas.n} hari di rentang ini`
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
                        ? 'tak ada yang memenuhi syarat pada rentang ini'
                        : `${jumlah} ditemukan`}
                      {jumlah > MAKS_PENANDA_POLA
                        && ` — ${MAKS_PENANDA_POLA} terbaru digambar di kanvas`}
                    </p>
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
    </div>
  )
}
