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
  hitungInstans, cariDoubleBottom,
  bacaTemplateTersimpan, tulisTemplateTersimpan, simpanTemplate, hapusTemplate,
  tandaiBawaan, ubahNamaTemplate,
  type BerkasOhlcEmiten, type DoubleBottom, type JenisIndikator, type JenisPola,
  type ParamDoubleBottom, type StatusPola, type TemplateGrafik,
} from '../../lib/dasbor/grafikEmiten'
import { Dropdown } from '../../components/dasbor/Dropdown'
import { useDaftarInstans, BarisInstans } from '../../components/dasbor/DaftarInstans'
import { fN } from '../../lib/dasbor/format'
import { pesanGalat } from '../../lib/pesanGalat'
import {
  IkonMenu, IKON_CARI, IKON_SILANG, IKON_GRAFIK_NAIK, IKON_INFO, IKON_TONG, IKON_MATA,
} from '../../components/dasbor/IkonMenu'
import { useTheme } from '../../context/ThemeContext'
import './GrafikEmiten.css'

const DEFAULT_KODE = 'BBCA'

/** Pilihan dropdown "Indikator" — diturunkan dari SPEK_INDIKATOR, bukan
 *  daftar kedua yang ditulis tangan: jenis baru cukup didaftarkan di spek
 *  dan langsung muncul di menu. */
const OPSI_INDIKATOR = (Object.keys(SPEK_INDIKATOR) as JenisIndikator[])
  .map((jenis) => ({ nilai: jenis, label: SPEK_INDIKATOR[jenis].label }))

/** Dropdown POLA berdiri sendiri, terpisah dari indikator (Johan: "jadi
 *  indikator dan pattern dibedakan dropdown nya"). Bukan sekadar rapian
 *  tampilan: indikator menghitung satu deret sepanjang data, pola menemukan
 *  kejadian yang bisa nol, satu, atau belasan — dua hal yang di satu menu
 *  akan terbaca seolah sejenis. */
const JENIS_POLA = Object.keys(SPEK_POLA) as JenisPola[]

const spekIndikator = (jenis: JenisIndikator) => SPEK_INDIKATOR[jenis].param
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
]

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
  // Waktu titik yang sedang disorot kursor ('yyyy-mm-dd') — null berarti
  // "belum digeser, pakai titik TERAKHIR" (legenda tetap berguna sebelum
  // pembaca menyentuh kanvas sama sekali).
  const [waktuSorot, setWaktuSorot] = useState<string | null>(null)

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
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
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
    const candle = chart.addSeries(CandlestickSeries)
    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol' })
    // Volume duduk di 22% bawah panel yang sama; lilin memakai sisanya —
    // pola resmi lightweight-charts utk "volume di panel bawah" tanpa perlu
    // chart terpisah yang harus disinkronkan manual.
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
    candle.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.26 } })
    chartRef.current = chart
    candleRef.current = candle
    volRef.current = vol
    // Plugin penanda dibuat SEKALI di sini; efek pola cuma memanggil
    // setMarkers() di atasnya. Membuatnya ulang tiap kali daftar pola berubah
    // menumpuk beberapa plugin di satu seri, dan yang lama tetap menggambar.
    penandaRef.current = createSeriesMarkers(candle, [])
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
      setWaktuSorot(typeof param.time === 'string' ? param.time : null)
    }
    chart.subscribeCrosshairMove(saatGeserKursor)
    return () => {
      chart.unsubscribeCrosshairMove(saatGeserKursor)
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      volRef.current = null
    }
  }, [])

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
    candleRef.current?.applyOptions({
      upColor: green, downColor: red, borderUpColor: green, borderDownColor: red,
      wickUpColor: green, wickDownColor: red,
    })
  }, [theme])

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
    candleRef.current?.setData(lilin)
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
  }, [lilin, volume])

  // Dua daftar instans, dua dropdown, satu aturan main (lihat DaftarInstans).
  const ind = useDaftarInstans<JenisIndikator>(spekIndikator, lilin.length)
  const pol = useDaftarInstans<JenisPola>(spekPola, lilin.length, true)

  // Jenis pola yang sudah ada di daftar tetap TERLIHAT di menu, tapi tak bisa
  // dipilih lagi — lihat alasan batasnya di useDaftarInstans.
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
    return ind.daftar.map((inst) => ({
      inst,
      garis: hitungInstans(inst, tutup).map((g) => ({ ...g, seri: keSeriGaris(waktu, g.nilai) })),
    }))
  }, [ind.daftar, lilin])

  // Temuan pola per instans. Sama seperti indikator: dihitung dari `lilin`
  // yang sudah tersaring, bukan dari `berkas.d` mentah — kalau tidak, indeks
  // lembah yang ditemukan menunjuk lilin yang berbeda dari yang tergambar.
  const polaPerInstans = useMemo(() => pol.daftar.map((inst) => ({
    inst,
    temuan: inst.jenis === 'doubleBottom'
      ? cariDoubleBottom(lilin, volume.map((v) => v.value), inst.param as unknown as ParamDoubleBottom)
      : ([] as DoubleBottom[]),
  })), [pol.daftar, lilin, volume])

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
      peta.set(inst.id, SPEK_INDIKATOR[inst.jenis].diPanelHarga ? 0 : berikut++)
    }
    return peta
  }, [ind.daftar])

  // Jarak atas tiap pane dari ujung atas bungkus kanvas, dipakai menempatkan
  // legenda di pojok kiri atas pane MASING-MASING (RSI/MACD punya legendanya
  // sendiri, seperti TradingView). Diukur dari DOM pane-nya sendiri
  // (`getHTMLElement`), bukan dijumlah dari tinggi + tebal pemisah yang
  // ditebak — tebakan itu meleset beberapa piksel dan legendanya duduk
  // separuh di luar panenya.
  const [posPane, setPosPane] = useState<number[]>([0])
  const ukurPane = useCallback(() => {
    const chart = chartRef.current
    const bungkus = bungkusRef.current
    if (!chart || !bungkus) return
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
    const waktu = waktuSorot ?? lilin[lilin.length - 1]?.time ?? null
    if (!waktu) return null
    const perPane = new Map<number, Array<{ id: string; warna: string; label: string; nilai: string }>>()
    for (const { inst, peta } of petaLegenda) {
      const pane = panePerInstans.get(inst.id)
      if (pane === undefined) continue
      const baris = perPane.get(pane) ?? []
      baris.push({
        id: inst.id,
        warna: inst.warna,
        label: labelInstansIndikator(inst),
        nilai: peta.map((p) => { const x = p.get(waktu); return x === undefined ? '—' : fN(x) }).join(' / '),
      })
      perPane.set(pane, baris)
    }
    return { waktu, perPane: [...perPane.entries()].sort((a, b) => a[0] - b[0]) }
  }, [waktuSorot, lilin, petaLegenda, panePerInstans])

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

  const muatTemplate = (t: TemplateGrafik) => {
    ind.gantiSemua(t.indikator)
    pol.gantiSemua(t.pola)
    setNamaTemplate(t.nama)
  }

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

  // Gambar pola di kanvas: garis leher mendatar + penanda di lembah, leher,
  // dan lilin penembusnya.
  useEffect(() => {
    const chart = chartRef.current
    const candle = candleRef.current
    const el = containerRef.current
    if (!chart || !candle || !el) return
    const cs = getComputedStyle(el)
    const baca = (nama: string) => cs.getPropertyValue(nama).trim() || '#888D99'

    for (const g of garisLeherRef.current) candle.removePriceLine(g)
    garisLeherRef.current = []

    const penanda: Array<SeriesMarker<Time>> = []
    for (const { inst, temuan } of polaPerInstans) {
      if (!inst.tampil) continue
      for (const db of temuan) {
        const warna = baca(WARNA_STATUS[db.status])
        penanda.push(
          { time: db.waktuLembah1, position: 'belowBar', color: warna, shape: 'circle', text: 'Lembah 1' },
          { time: db.waktuLeher, position: 'aboveBar', color: warna, shape: 'circle', text: `Leher ${fN(db.hargaLeher, 0)}` },
          { time: db.waktuLembah2, position: 'belowBar', color: warna, shape: 'circle', text: `Lembah 2 · ${db.status}` },
        )
        if (db.waktuKonfirmasi) {
          penanda.push({
            time: db.waktuKonfirmasi, position: 'aboveBar', color: warna, shape: 'circle',
            text: db.volumeMenguat ? 'Tembus leher · volume menguat' : 'Tembus leher',
          })
        }
      }
      // Garis leher cuma untuk temuan TERAKHIR tiap instans. `createPriceLine`
      // membentang selebar kanvas — belasan di antaranya saling menimpa dan
      // tak satu pun lagi bisa dibaca sebagai leher milik pola yang mana.
      // Penandanya sendiri tetap dipasang untuk SEMUA temuan; penanda menempel
      // pada lilinnya, jadi banyak pun tak saling menutupi.
      const akhir = temuan[temuan.length - 1]
      if (akhir) {
        garisLeherRef.current.push(candle.createPriceLine({
          price: akhir.hargaLeher,
          color: baca(WARNA_STATUS[akhir.status]),
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `Leher ${labelInstansPola(inst)}`,
        }))
      }
    }
    // lightweight-charts mewajibkan penanda urut menaik menurut waktu; tanpa
    // urutan itu sebagian penanda diam-diam tak digambar.
    penanda.sort((a, b) => String(a.time).localeCompare(String(b.time)))
    penandaRef.current?.setMarkers(penanda)

    // Angka terukur buat verifikasi/QA — kanvas tak punya DOM per-penanda.
    el.dataset.polaDitemukan = String(polaPerInstans.reduce((n, x) => n + x.temuan.length, 0))
  }, [polaPerInstans, theme])

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
          <button type="button" className="bchip bchip-klik" onClick={() => setCari('')} title="Batalkan pencarian">
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
          <span className="lbl"><IkonMenu d={IKON_GRAFIK_NAIK} size={13} /> {kode} — Lilin &amp; Volume</span>
          <div className="grf-rentang">
            {RENTANG_GRAFIK.map(([label]) => (
              <button key={label} type="button"
                className={'bchip bchip-klik' + (rentangLabel === label ? ' on' : '')}
                onClick={() => setRentangLabel(label)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="panel-b">
          {galat && <p className="muted">{galat}</p>}
          {!galat && !berkas && <div className="fd-empty"><p>Memuat data harga {kode}…</p></div>}

          {/* Dua dropdown TERPISAH — indikator dan pola (Johan: "jadi
              indikator dan pattern dibedakan dropdown nya"). Memilih jenis
              MENAMBAH satu instans baru, tak menyalakan sakelar; karena itu
              `nilai` sengaja dibiarkan kosong — tak ada jenis yang "terpilih",
              yang ada cuma daftar instans di bawahnya. */}
          <div className="grf-ind">
            <Dropdown opsi={OPSI_INDIKATOR} nilai="" placeholder="+ Indikator"
              ariaLabel="Tambah indikator" onGanti={ind.tambah} />
            <Dropdown opsi={opsiPola} nilai="" placeholder="+ Pola"
              ariaLabel="Tambah pola" onGanti={pol.tambah} />
          </div>

          <BarisInstans kelola={ind} label={labelInstansIndikator} />
          <BarisInstans kelola={pol} label={labelInstansPola} />

          {/* Template: menyimpan susunan indikator + pola dengan nama, dan
              memuatnya kembali. Disimpan di localStorage — alasannya panjang
              dan ada di grafikEmiten.ts (ringkasnya: ini preferensi tampilan,
              bukan data bersama). */}
          <div className="grf-template">
            <div className="grf-template-simpan">
              <input className="inp grf-template-nama" value={namaTemplate}
                placeholder="Nama template…" aria-label="Nama template"
                onChange={(e) => setNamaTemplate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && namaTemplate.trim()) {
                    simpanDaftarTemplate(simpanTemplate(template, namaTemplate, ind.daftar, pol.daftar))
                  }
                }} />
              <button type="button" className="bchip bchip-klik"
                disabled={!namaTemplate.trim()}
                title={template.some((t) => t.nama === namaTemplate.trim())
                  ? 'Timpa template dengan susunan sekarang'
                  : 'Simpan susunan sekarang sebagai template baru'}
                onClick={() => simpanDaftarTemplate(simpanTemplate(template, namaTemplate, ind.daftar, pol.daftar))}>
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
                      <button type="button" className="bchip bchip-klik grf-template-muat"
                        title={`Muat ${t.nama}`} onClick={() => muatTemplate(t)}>
                        {t.bawaan && <span className="grf-template-tanda" title="Dimuat otomatis saat halaman dibuka">•</span>}
                        {t.nama}
                      </button>
                    )}
                    <span className="grf-template-isi">
                      {t.indikator.length} indikator · {t.pola.length} pola
                    </span>
                    <button type="button" className="bchip bchip-klik"
                      aria-pressed={t.bawaan}
                      title={t.bawaan ? 'Berhenti memuatnya otomatis' : 'Muat otomatis saat halaman dibuka'}
                      onClick={() => simpanDaftarTemplate(tandaiBawaan(template, t.nama))}>Bawaan</button>
                    <button type="button" className="bchip bchip-klik"
                      title={`Ganti nama ${t.nama}`}
                      onClick={() => setNamaDiubah({ lama: t.nama, teks: t.nama })}>Ganti nama</button>
                    <button type="button" className="bchip bchip-klik"
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
              tanggal & harga persisnya tak terbaca dari penanda di kanvas. */}
          {polaPerInstans.some(({ inst }) => inst.tampil) && (
            <div className="grf-pola-hasil">
              {polaPerInstans.filter(({ inst }) => inst.tampil).map(({ inst, temuan }) => (
                <div key={inst.id}>
                  <p className="grf-pola-judul">
                    {labelInstansPola(inst)}: {temuan.length === 0
                      ? 'tak ada yang memenuhi syarat pada rentang ini'
                      : `${temuan.length} ditemukan`}
                  </p>
                  {temuan.length > 0 && (
                    <ul className="grf-pola-daftar">
                      {temuan.slice(-8).reverse().map((db) => (
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
                </div>
              ))}
            </div>
          )}

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
            {legenda?.perPane.map(([pane, baris]) => (
              <div key={pane} className="grf-legenda-kanvas" style={{ top: `${(posPane[pane] ?? 0) + 6}px` }}>
                {pane === 0 && <span className="grf-legenda-tgl">{legenda.waktu}</span>}
                {baris.map((b) => (
                  <span key={b.id} className="grf-legenda-baris"
                    style={{ '--ind-warna': `var(${b.warna})` } as React.CSSProperties}>
                    <span className="grf-legenda-titik" aria-hidden="true" />
                    <span className="grf-legenda-nama">{b.label}</span>
                    <span className="grf-legenda-nilai">{b.nilai}</span>
                    {/* Dua tombol ini satu-satunya yang MENERIMA kursor di
                        legenda (pointer-events:auto di CSS) — sisanya tembus
                        supaya crosshair tak terhalang teks. */}
                    <button type="button" className="grf-legenda-btn"
                      title={`Sembunyikan ${b.label}`} onClick={() => ind.sakelarTampil(b.id)}>
                      <IkonMenu d={IKON_MATA} size={11} />
                    </button>
                    <button type="button" className="grf-legenda-btn"
                      title={`Hapus ${b.label}`} onClick={() => ind.hapus(b.id)}>
                      <IkonMenu d={IKON_SILANG} size={9} />
                    </button>
                  </span>
                ))}
              </div>
            ))}
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
