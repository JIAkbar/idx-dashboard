import { useEffect, useMemo, useRef, useState } from 'react'
import { TAHUN_AWAL } from '../../lib/dasbor/brokerEmitenV2'
import {
  CandlestickSeries, CrosshairMode, HistogramSeries, createChart,
  type IChartApi, type ISeriesApi, type SeriesType, type Time,
} from 'lightweight-charts'
import { muatCandle, type DataCandle } from '../../lib/dasbor/candleStockbit'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { ModalKecil } from '../../components/dasbor/ModalKecil'
import { CatatanCakupan } from '../../components/dasbor/CatatanCakupan'
import { LencanaBeku, tidakDiperdagangkan } from '../../components/dasbor/LencanaBeku'
import { useStockIndex } from '../../lib/dasbor/stockDetailData'
import { useBrokerTahunan } from '../../lib/dasbor/brokerTahunanData'
import { useRingkasKartu } from '../../lib/dasbor/kartuRingkas'
import { warnaBrokerCanvas } from '../../lib/dasbor/kelompokBroker'
import { bacaTokenTema } from '../../lib/dasbor/useChartJs'
import { warnaGrid, gridDariTemplate, GRID_BAWAAN, type SetelanGrid } from '../../lib/dasbor/grafikEmiten'
import { useTheme } from '../../context/ThemeContext'
import { SeleksiAreaChart } from '../../lib/dasbor/seleksiAreaChart'
import { GarisAvgBroker } from '../../lib/dasbor/garisAvgBroker'
import { BubbleBroker, bubbleOutlierHarian, type BubbleHari } from '../../lib/dasbor/bubbleBroker'
import { ProfilHargaChart } from '../../lib/dasbor/profilHargaChart'
import {
  BAR_SPACING_MIN, binFootprint, FootprintHarian,
  type BrokerSel, type KolomFootprint, type SelFootprintWarna,
} from '../../lib/dasbor/footprintHarian'
import {
  agregasi4h, agregatSeleksiIntraday, jamWib, muatIntraday1h, tanggalWib,
  type Bar1H, type GalatIntraday, type RingkasIntraday,
} from '../../lib/dasbor/intradayWhales'
import {
  agregatArea, profilHarga, saringSignifikan,
  type RingkasBroker, type SeleksiArea,
} from '../../lib/dasbor/whalesPapan'
import { InfoIndikator, type ItemInfoIndikator } from '../../components/dasbor/InfoIndikator'
import { keFraksi } from '../../lib/fraksiHarga'
import './WhalesPapan.css'

/** Modal "i" — penjelasan tiap kendali di baris alat (permintaan Johan
 *  27 Agu). Bahasa pembaca, tanpa nama sumber/jalur internal. */
const INFO_WHALES: ItemInfoIndikator[] = [
  { nama: 'Pilih area', isi: 'Seret persegi di chart untuk memilih rentang harga & waktu. Panel Hasil Seleksi lalu memecah broker yang bertransaksi pada rentang itu — siapa menampung, siapa melepas.' },
  { nama: 'Garis AVG', isi: 'Garis putus-putus harga rata-rata tiap broker besar sepanjang rentang, dengan kode broker dan porsinya. Harga rata-rata yang jauh di bawah harga kini = broker itu menampung murah.' },
  { nama: 'Profil', isi: 'Tumpukan lot per pita harga di tepi kanan: tiap hari dikelompokkan menurut harga rata-ratanya, lalu total lot hari itu dijumlahkan ke pitanya. Emas = pita teramai (POC), terang = area nilai yang menampung 70% lot, redup = sisanya. POC dan tepi area nilai lazim berperilaku seperti magnet/support-resistance.' },
  { nama: 'Bubble', isi: 'Lingkaran pada broker yang net beli/jualnya MENYIMPANG jauh dari kebiasaan pasar hari itu (outlier; ambang diatur slider z). Hijau = net beli, merah = net jual; makin besar lingkaran makin besar uangnya. Pada zoom bertahun-tahun hanya outlier terbesar yang digambar supaya tidak jadi kabut.' },
  { nama: 'Footprint', isi: 'Sel per level harga per hari — tiap broker ditempatkan di harga rata-rata beli/jualnya hari itu. Ini hampiran dari data harian, bukan rincian transaksi per level. Hanya tersedia di mode Harian.' },
  { nama: 'Grid', isi: 'Garis bantu chart. Slider persen di sampingnya mengatur keburamannya; matikan bila terasa ramai.' },
  { nama: 'Auto', isi: 'Satu klik kembali ke pandangan bawaan ±1 tahun terakhir (saat Footprint aktif: menyempit ke jendela yang selnya terbaca). Riwayat lama tetap termuat — geser chart ke kiri untuk melihatnya. Skala harga ikut dikembalikan ke otomatis.' },
]

/**
 * Whales Papan — papan bandarmologi harian (spek: `spek_whales_papan.md`).
 *
 * Arsitektur HYBRID (keputusan Johan 26 Agu 2026): candle asli dari
 * `lightweight-charts` + primitive khas halaman ini (kotak seleksi W1, garis
 * rata-rata broker W2) yang digambar DI DALAM render-loop chart yang sama —
 * kotak seleksi disimpan sebagai nilai (tanggal × harga), jadi zoom/pan
 * membuatnya tetap menempel. Komentar versi lama yang menolak
 * lightweight-charts ("butuh seret-pilih 2D, bukan deret lilin") gugur oleh
 * Plugin API — dan "titik harian" yang dulu terbaca sebagai butiran debu
 * diganti candle sungguhan.
 *
 * Seret persegi (tombol "Pilih area") → panel kanan memecah siapa menampung
 * dan siapa melepas di rentang harga × waktu itu. Logika agregasinya TIDAK
 * berubah dari versi lama (`whalesPapan.ts`) — yang diganti hanya lapisan
 * penggambaran.
 */

const PANEL_AWAL = 8
/** Bar terakhir yang dipandang saat halaman dibuka — ±1 tahun bursa. */
const JENDELA_AWAL = 250

function rupiahRingkas(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e12) return `${(n / 1e12).toFixed(2)} T`
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)} M`
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)} jt`
  return n.toLocaleString('id-ID')
}
const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
/** '2026-05-12' → '12 Mei 2026' — tanpa Date() (zona waktu tak ikut campur). */
function tglPendek(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${Number(d)} ${BULAN_PENDEK[Number(m) - 1] ?? m} ${y}`
}

function lotRingkas(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)} jt`
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}rb`
  return String(Math.round(n))
}

// Pemuat candle pindah ke lib bersama `candleStockbit.ts` — dipakai juga
// Inventory Neo Papan; satu sumber, bukan dua salinan.

/** Palet garis AVG — LIMA token seri paling kontras satu sama lain (subset
 *  TOKEN_SERI Neo), satu warna per GARIS. */
const WARNA_GARIS_AVG = ['--blue', '--amber', '--k-smart', '--red', '--green'] as const

/** Seleksi "seluruh riwayat" — dipakai garis avg broker saat belum ada kotak. */
const SEMUA: SeleksiArea = { tglMulai: '0000-01-01', tglAkhir: '9999-12-31', hargaMin: -Infinity, hargaMax: Infinity }

type Tf = 'harian' | '4h' | '1h'

/**
 * lightweight-charts menampilkan epoch numerik sebagai UTC — bar 09:00 WIB
 * akan tercetak 02:00 tanpa ini. Epoch DIGESER +7 jam saat masuk chart dan
 * dikembalikan saat keluar (seleksi), supaya sumbu terbaca WIB sementara
 * seluruh lib intraday tetap epoch sungguhan.
 */
const GESER_WIB = 7 * 3600

/** Seleksi mode intraday — epoch sungguhan (bukan yang tergeser). */
interface SelIntra {
  dariEpoch: number
  sampaiEpoch: number
  hargaMin: number
  hargaMax: number
}

export default function WhalesPapan() {
  const { index: indeks } = useStockIndex()
  const { theme } = useTheme()
  const [ketik, setKetik] = useState('BBCA')
  const [kode, setKode] = useState('BBCA')
  const { hari, tahunAda, muat, galat } = useBrokerTahunan(kode)

  const ringkasKartu = useRingkasKartu()
  const barisKartu = useMemo(
    () => ringkasKartu?.emiten.find((b) => b.kode === kode) ?? null,
    [ringkasKartu, kode],
  )

  const [sel, setSel] = useState<SeleksiArea | null>(null)
  const [selIntra, setSelIntra] = useState<SelIntra | null>(null)
  /** Broker yang pill AVG-nya diklik — kartu rinciannya tampil di panel. */
  const [brokerPilih, setBrokerPilih] = useState<string | null>(null)
  const [modeSeleksi, setModeSeleksi] = useState(false)
  // setTf ikut dicabut bersama tombol TF (#413) — build produksi (tsc -b,
  // noUnusedLocals) MENOLAK variabel yatim; dev tsc --noEmit meloloskannya,
  // dan itulah akar 10 deploy Vercel gagal beruntun 27 Agu.
  const [tf] = useState<Tf>('harian')
  const [candle, setCandle] = useState<DataCandle>({ lilin: [], volume: [] })
  const [intra, setIntra] = useState<{ bar: Bar1H[]; galat: GalatIntraday }>({ bar: [], galat: null })
  const [avgAktif, setAvgAktif] = useState(true)
  const [profilAktif, setProfilAktif] = useState(true)
  const [bubbleAktif, setBubbleAktif] = useState(false)
  /** Ambang z-score bubble outlier — slider 1–4, bawaan 2,5 (ala whales.id). */
  const [ambangZ, setAmbangZ] = useState(2.5)
  // W7 footprint — default MATI, hanya mode Harian (spek §1).
  const [footprintAktif, setFootprintAktif] = useState(false)
  /** Sel footprint yang sedang di-hover/tap — isi tooltip (spek §1). */
  const [fpHover, setFpHover] = useState<{ tanggal: string; sel: SelFootprintWarna; x: number; y: number } | null>(null)
  /** Bubble yang di-hover/tap — tooltip penjelas (Johan 28 Agu: "bubble ini
   *  fungsi nya kurang jelas ... tooltips nya lebih di yakinkan lagi"). */
  const [bubHover, setBubHover] = useState<{ b: BubbleHari; x: number; y: number } | null>(null)
  /** Menu klik-kanan kanvas (Johan 28 Agu: "kenapa masih ada klik kanan
   *  seperti ini" — menu peramban Save image/Inspect muncul di atas chart,
   *  terbaca seperti halaman yang belum jadi). Pola sama Grafik Emiten. */
  const [menuKanan, setMenuKanan] = useState<{ x: number; y: number; harga: number | null; tanggal: string | null } | null>(null)
  // Empat kuadran, empat batas "tampilkan lagi" — memperluas satu tak boleh
  // ikut memperluas yang lain, keduanya baris broker tapi peringkat berbeda.
  const [batasGrossBeli, setBatasGrossBeli] = useState(PANEL_AWAL)
  const [batasGrossJual, setBatasGrossJual] = useState(PANEL_AWAL)
  const [batasNetBeli, setBatasNetBeli] = useState(PANEL_AWAL)
  const [batasNetJual, setBatasNetJual] = useState(PANEL_AWAL)
  // Significant (default, pola whales.id) menyembunyikan broker recehan lewat
  // AMBANG_SIGNIFIKAN; Full menampilkan semua yang pernah bertransaksi.
  const [modeBaris, setModeBaris] = useState<'signifikan' | 'penuh'>('signifikan')
  /** Kuadran yang ditampilkan panel — Gross atau Net, bukan dua-duanya
   *  sekaligus (Johan 28 Agu: "munculkan juga aksi untuk memilih gross atau
   *  net"). */
  const [kuadran, setKuadran] = useState<'gross' | 'net'>('gross')
  // Grid chart — pola sama dengan GrafikEmiten (B33): sakelar + keburaman,
  // bawaan lebih redup (30%) dari acuannya (100%) karena chart di sini sudah
  // padat lapisan lain (AVG, profil, bubble, footprint). Preferensi per
  // halaman, disimpan localStorage.
  const [grid, setGrid] = useState<SetelanGrid>(() => {
    try {
      const v = localStorage.getItem('papan-grid-whales')
      return v ? gridDariTemplate(JSON.parse(v)) : { ...GRID_BAWAAN, alfa: 0.3 }
    } catch { return { ...GRID_BAWAAN, alfa: 0.3 } }
  })
  useEffect(() => {
    try { localStorage.setItem('papan-grid-whales', JSON.stringify(grid)) } catch { /* storage penuh/privat */ }
  }, [grid])

  const bungkusRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const lilinRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const volRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const seleksiRef = useRef<SeleksiAreaChart | null>(null)
  const avgRef = useRef<GarisAvgBroker | null>(null)
  const profilRef = useRef<ProfilHargaChart | null>(null)
  const bubbleRef = useRef<BubbleBroker | null>(null)
  const footprintRef = useRef<FootprintHarian | null>(null)
  const seretRef = useRef<{ x0: number; y0: number } | null>(null)

  // Zoom pas satu klik (masukan Johan 27 Agu: "berikan tombol auto ... gak
  // zoom in zoom out manual"). Footprint aktif → sempitkan ke jendela yang
  // selnya terbaca (jumlah bar DIHITUNG dari lebar nyata pane — konstanta
  // 45 bar gagal di ponsel: 330px ÷ 46 ≈ 7px < ambang). Selain itu → fit
  // seluruh riwayat.
  const zoomOtomatis = (fp: boolean, hanyaBilaSempit = false) => {
    const chart = chartRef.current
    if (!chart) return
    // Auto juga mengembalikan SKALA HARGA, bukan cuma jendela waktu (Johan:
    // "fungsi auto hanya ke candle tapi tidak di chart").
    lilinRef.current?.priceScale().applyOptions({ autoScale: true })
    const skala = chart.timeScale()
    const n = candle.lilin.length
    if (fp && n > 0) {
      // `hanyaBilaSempit`: jalur toggle Footprint — jangan sentuh pandangan
      // yang sudah cukup dekat. Tombol Auto memaksa, apa pun zoom-nya.
      if (hanyaBilaSempit && skala.options().barSpacing >= BAR_SPACING_MIN) return
      const muat = Math.max(10, Math.floor(skala.width() / (BAR_SPACING_MIN * 1.3)) - 2)
      skala.setVisibleLogicalRange({ from: Math.max(0, n - muat), to: n + 2 })
    } else if (n > 0) {
      // BUKAN fitContent (Johan 28 Agu: "buat default view nya 1Y supaya
      // tidak memanjang, tapi bisa user geser untuk lihat tahun-tahun
      // sebelumnya") — Auto kembali ke jendela default ±1 tahun bursa;
      // riwayat penuh tetap termuat, tinggal digeser ke kiri.
      skala.setVisibleLogicalRange({ from: Math.max(0, n - JENDELA_AWAL), to: n + 2 })
    }
  }

  /** Panel kanan kontekstual (tata C+A): berisi saat ada seleksi, atau saat
   *  ada pesan gating intraday yang wajib dibaca. */
  const panelBerisi = tf === 'harian' ? sel !== null : (selIntra !== null || intra.galat !== null)

  const resetBatas = () => {
    setBatasGrossBeli(PANEL_AWAL)
    setBatasGrossJual(PANEL_AWAL)
    setBatasNetBeli(PANEL_AWAL)
    setBatasNetJual(PANEL_AWAL)
  }

  // Ganti emiten ATAU mode = buang seleksi lama. Tanpa ini, kotak yang
  // diseret di emiten/mode sebelumnya tetap hidup dan panelnya memecah angka
  // pada rentang milik konteks LAIN — angkanya sah, kepalanya berbohong.
  useEffect(() => {
    setSel(null)
    setSelIntra(null)
    setModeSeleksi(false)
    setFpHover(null)
    setBubHover(null)
    resetBatas()
  }, [kode, tf])

  const hasil = useMemo(() => (sel ? agregatArea(hari, sel) : null), [hari, sel])

  // Buang kartu broker saat konteksnya berganti — angka lamanya milik
  // emiten/seleksi lain.
  useEffect(() => { setBrokerPilih(null) }, [kode, tf, sel])

  /** Rincian broker yang pill-nya diklik, pada cakupan garis AVG (seleksi
   *  bila ada, seluruh riwayat bila tidak). */
  const rinciBroker = useMemo(() => {
    if (!brokerPilih || hari.length === 0) return null
    const agg = agregatArea(hari, sel ?? SEMUA)
    const r = [...agg.grossBeli, ...agg.grossJual, ...agg.netBeli, ...agg.netJual]
      .find((x) => x.kode === brokerPilih)
    if (!r) return null
    const hariAktif = hari.filter((h) =>
      (!sel || (h.tanggal >= sel.tglMulai && h.tanggal <= sel.tglAkhir
        && h.avg != null && h.avg >= sel.hargaMin && h.avg <= sel.hargaMax))
      && h.broker.some((b) => b[0] === brokerPilih && (b[1] || b[3]))).length
    return { r, hariAktif }
  }, [brokerPilih, hari, sel])

  /** Bar intraday untuk TF terpilih — 4H diagregasi dari 1H saat baca. */
  const barIntra = useMemo(
    () => (tf === '4h' ? agregasi4h(intra.bar) : intra.bar),
    [tf, intra.bar],
  )
  const hasilIntra: RingkasIntraday | null = useMemo(
    () => (tf !== 'harian' && selIntra
      ? agregatSeleksiIntraday(barIntra, selIntra.dariEpoch, selIntra.sampaiEpoch, selIntra.hargaMin, selIntra.hargaMax)
      : null),
    [tf, selIntra, barIntra],
  )

  // Hook QA dev-only (pola `__papanChart`): verifikasi angka panel butuh tahu
  // rentang seleksi persisnya, dan kotak digambar di canvas — tak ada teks DOM
  // yang memuat tanggalnya.
  useEffect(() => {
    if (import.meta.env.DEV && bungkusRef.current) {
      (bungkusRef.current as HTMLDivElement & { __papanSel?: unknown }).__papanSel = sel
    }
  }, [sel])

  // ── chart ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = bungkusRef.current
    if (!el) return
    const chart = createChart(el, {
      autoSize: true,
      localization: { locale: 'id-ID', dateFormat: 'dd MMM yyyy' },
      // Atribusi lightweight-charts dipenuhi lewat kaki situs global
      // (DasborLayout.tsx) — sama dengan GrafikEmiten; jangan hapus baris itu.
      layout: { background: { color: 'transparent' }, attributionLogo: false },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      // Magnet melekatkan garis ke close — Normal membebaskannya (spek §2,
      // konsisten dengan GrafikEmiten).
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { labelVisible: true },
        horzLine: { labelVisible: true },
      },
    })
    const lilin = chart.addSeries(CandlestickSeries)
    lilin.priceScale().applyOptions({ scaleMargins: { top: 0.06, bottom: 0.24 } })
    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol' })
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
    chartRef.current = chart
    lilinRef.current = lilin
    volRef.current = vol
    const pane0 = chart.panes()[0]
    if (pane0) {
      const seleksi = new SeleksiAreaChart(
        () => lilinRef.current,
        () => (getComputedStyle(el).getPropertyValue('--accent') || '').trim() || '#F2C230',
      )
      pane0.attachPrimitive(seleksi)
      seleksiRef.current = seleksi
      const avg = new GarisAvgBroker(() => lilinRef.current)
      pane0.attachPrimitive(avg)
      avgRef.current = avg
      const profil = new ProfilHargaChart(() => lilinRef.current)
      pane0.attachPrimitive(profil)
      profilRef.current = profil
      const bubble = new BubbleBroker(() => lilinRef.current)
      pane0.attachPrimitive(bubble)
      bubbleRef.current = bubble
      const footprint = new FootprintHarian(() => lilinRef.current)
      pane0.attachPrimitive(footprint)
      footprintRef.current = footprint
    }
    if (import.meta.env.DEV) (el as HTMLDivElement & { __papanChart?: unknown }).__papanChart = chart
    // Pill AVG clickable (Johan 26 Agu: "mgkn clickable"): hitTest primitive
    // menyetorkan `avg:<broker>` ke hoveredObjectId; klik membuka kartu
    // rincian broker itu di panel. Sel footprint (`fp:<tanggal>:<i>`) memakai
    // ID yang sama lewat crosshair-move (hover desktop) DAN klik (tap ponsel).
    const bacaFp = (id: string) => {
      const m = id.startsWith('fp:') ? footprintRef.current?.getSel(id) : null
      return m ?? null
    }
    const saatGeser = (p: { hoveredObjectId?: unknown; point?: { x: number; y: number } }) => {
      const id = typeof p.hoveredObjectId === 'string' ? p.hoveredObjectId : ''
      const m = bacaFp(id)
      if (m && p.point) setFpHover({ ...m, x: p.point.x, y: p.point.y })
      else setFpHover((cur) => (cur ? null : cur))
      const bub = id.startsWith('bub:') ? bubbleRef.current?.getBubble(id) : null
      if (bub && p.point) setBubHover({ b: bub, x: p.point.x, y: p.point.y })
      else setBubHover((cur) => (cur ? null : cur))
    }
    const saatKlik = (p: { hoveredObjectId?: unknown; point?: { x: number; y: number } }) => {
      const id = typeof p.hoveredObjectId === 'string' ? p.hoveredObjectId : ''
      if (id.startsWith('avg:')) { setBrokerPilih(id.slice(4)); return }
      const m = bacaFp(id)
      if (m && p.point) setFpHover({ ...m, x: p.point.x, y: p.point.y })
      const bub = id.startsWith('bub:') ? bubbleRef.current?.getBubble(id) : null
      if (bub && p.point) setBubHover({ b: bub, x: p.point.x, y: p.point.y })
    }
    chart.subscribeCrosshairMove(saatGeser)
    chart.subscribeClick(saatKlik)
    return () => {
      chart.unsubscribeCrosshairMove(saatGeser)
      chart.unsubscribeClick(saatKlik)
      chart.remove()
      chartRef.current = null
      lilinRef.current = null
      volRef.current = null
      seleksiRef.current = null
      avgRef.current = null
      profilRef.current = null
      bubbleRef.current = null
      footprintRef.current = null
    }
  }, [])

  // Warna teks & kisi ikut tema — dibaca dari CSS var yang sama dengan
  // seluruh lantai, disetel ulang tiap tema berganti.
  useEffect(() => {
    const el = bungkusRef.current
    const chart = chartRef.current
    if (!el || !chart) return
    const gaya = getComputedStyle(el)
    const c = (v: string, cad: string) => (gaya.getPropertyValue(v) || '').trim() || cad
    const line = c('--line', '#24262E')
    chart.applyOptions({
      layout: { textColor: c('--text2', '#9CA0AC') },
      // `visible` DAN warna beralfa dipakai bersama (pola GrafikEmiten) —
      // alfa 0 saja tetap membuat lightweight-charts menggambar garisnya.
      grid: {
        vertLines: { color: warnaGrid(line, grid.alfa), visible: grid.tampil },
        horzLines: { color: warnaGrid(line, grid.alfa), visible: grid.tampil },
      },
    })
  }, [theme, grid])

  // Data candle harian per emiten.
  useEffect(() => {
    let batal = false
    setCandle({ lilin: [], volume: [] })
    muatCandle(kode).then((d) => { if (!batal) setCandle(d) })
    return () => { batal = true }
  }, [kode])

  // Data intraday 1H (olahan `bangun_intraday_1h.py`) — dimuat saat masuk
  // mode intraday saja; 4H diagregasi klien, tak ada berkas kedua.
  useEffect(() => {
    if (tf === 'harian') return
    let batal = false
    setIntra({ bar: [], galat: null })
    muatIntraday1h(kode).then((d) => { if (!batal) setIntra(d) })
    return () => { batal = true }
  }, [kode, tf])

  useEffect(() => {
    const lilin = lilinRef.current
    const vol = volRef.current
    const chart = chartRef.current
    if (!lilin || !vol || !chart) return
    // Skala harga WAJIB dinyalakan ulang tiap data berganti (temuan Johan
    // 27 Agu "setelah ganti emiten tidak reset ke harga nya"): pinch/drag di
    // sumbu harga mematikan autoScale PERMANEN di lightweight-charts, dan
    // tanpa baris ini kisaran emiten lama menetap — candle emiten baru jatuh
    // di luar jendela (volume tetap tampak karena skalanya terpisah).
    lilin.priceScale().applyOptions({ autoScale: true })
    if (tf === 'harian') {
      lilin.setData(candle.lilin)
      vol.setData(candle.volume)
      const n = candle.lilin.length
      if (n > 0) {
        // Footprint yang SUDAH menyala harus tetap terlihat di emiten baru
        // (temuan Johan 28 Agu "jika ganti emiten dia tidak aktif langsung
        // meskipun sebelumnya sudah di aktifkan"): jendela awal 250 bar
        // lebih lebar dari ambang keterbacaan sel. JANGAN cek barSpacing
        // pasca-set (nilainya masih milik emiten lama saat efek ini jalan —
        // race yang membuat perbaikan pertama tak bekerja); hitung jendela
        // langsung dari lebar pane.
        const skala = chart.timeScale()
        const muatFp = Math.max(10, Math.floor(skala.width() / (BAR_SPACING_MIN * 1.3)) - 2)
        const jendela = footprintAktif ? Math.min(JENDELA_AWAL, muatFp) : JENDELA_AWAL
        skala.setVisibleLogicalRange({ from: Math.max(0, n - jendela), to: n + 2 })
      }
      return
    }
    lilin.setData(barIntra.map((b) => ({
      time: (b.epoch + GESER_WIB) as Time,
      open: b.open, high: b.high, low: b.low, close: b.close,
    })))
    vol.setData(barIntra.map((b) => ({
      time: (b.epoch + GESER_WIB) as Time,
      value: b.volume,
      color: b.close >= b.open ? 'rgba(48, 164, 108, 0.5)' : 'rgba(229, 72, 77, 0.5)',
    })))
    if (barIntra.length > 0) chart.timeScale().fitContent()
  }, [tf, candle, barIntra])

  // Kotak terkunci digambar primitive dari NILAI — ikut zoom/pan.
  useEffect(() => {
    if (tf === 'harian') {
      seleksiRef.current?.setKotak(
        sel ? { t0: sel.tglMulai, t1: sel.tglAkhir, harga0: sel.hargaMin, harga1: sel.hargaMax } : null,
      )
    } else {
      seleksiRef.current?.setKotak(
        selIntra
          ? {
              t0: selIntra.dariEpoch + GESER_WIB, t1: selIntra.sampaiEpoch + GESER_WIB,
              harga0: selIntra.hargaMin, harga1: selIntra.hargaMax,
            }
          : null,
      )
    }
  }, [tf, sel, selIntra])

  // W2 — garis rata-rata beli broker: 5 penampung (net beli) terbesar; dari
  // area seleksi bila ada, dari seluruh riwayat bila belum.
  useEffect(() => {
    const prim = avgRef.current
    if (!prim) return
    if (tf !== 'harian' || !avgAktif || hari.length === 0) { prim.setGaris([]); return }
    const agg = agregatArea(hari, sel ?? SEMUA)
    const totalBeli = agg.grossBeli.reduce((s, r) => s + r.beliNilai, 0)
    prim.setGaris(
      agg.netBeli
        .filter((r) => r.beliLot > 0)
        .slice(0, 5)
        // Warna per GARIS dari palet seri DISTINCT, bukan warna kelompok
        // broker (Johan 28 Agu: "warna pada average tolong di bedakan biar
        // jelas" — tiga dari lima garis kebetulan sekelompok = tiga teal
        // kembar). Preseden sama: Inventory Neo 26 Agu "warna nya masak
        // mirip-mirip". Identitas kelompok tetap terbaca di panel/tooltip.
        .map((r, i) => ({
          broker: r.kode,
          harga: r.beliNilai / (r.beliLot * 100),
          pct: totalBeli ? r.beliNilai / totalBeli : 0,
          warna: bacaTokenTema(WARNA_GARIS_AVG[i % WARNA_GARIS_AVG.length]),
        })),
    )
  }, [tf, avgAktif, hari, sel, theme])

  // W4 — profil harga (lot per pita dari broker harian), lapisan bawah candle.
  // Hanya mode Harian: sumbernya broker harian, tak punya pecahan intraday.
  useEffect(() => {
    profilRef.current?.setData(tf === 'harian' && profilAktif ? profilHarga(hari, 28) : [])
  }, [tf, profilAktif, hari])

  // W3 — bubble broker outlier harian, ambang z dari slider. Hanya Harian.
  useEffect(() => {
    const prim = bubbleRef.current
    if (!prim) return
    prim.setData(tf === 'harian' && bubbleAktif ? bubbleOutlierHarian(hari, ambangZ) : [])
  }, [tf, bubbleAktif, ambangZ, hari])

  // W7 — footprint harian: satu kolom per hari, low–high DARI CANDLE (spek
  // §1) dipecah `binFootprint` per hari broker. Hanya Harian; digambar sekali
  // per perubahan data, bukan tiap frame (frame hanya memetakan koordinat).
  useEffect(() => {
    const prim = footprintRef.current
    if (!prim) return
    if (tf !== 'harian' || !footprintAktif || hari.length === 0 || candle.lilin.length === 0) {
      prim.setData([])
      return
    }
    const petaCandle = new Map(candle.lilin.map((c) => [c.time as string, c]))
    const data: KolomFootprint[] = []
    for (const h of hari) {
      const c = petaCandle.get(h.tanggal)
      if (!c || h.broker.length === 0) continue
      // Varian ASING hari yang sama di-bin dengan tepi harga yang SAMA
      // (low/high candle) supaya indeks selnya sejajar — hasilnya porsi
      // asing per sel. Hari tanpa varian asing dibiarkan undefined, bukan 0
      // (temuan audit whales 28 Agu §7d: yang jujur untuk data agregat
      // harian adalah PORSI, bukan tag [F]/[D] per broker).
      const selAsing = h.brokerAsing?.length
        ? binFootprint(h.brokerAsing, c.low, c.high)
        : null
      const sel = binFootprint(h.broker, c.low, c.high).map((s, iSel) => {
        const dominanBeli = s.broker.reduce<BrokerSel | null>(
          (m, b) => (b.beliLot > (m?.beliLot ?? 0) ? b : m), null)
        const dominanJual = s.broker.reduce<BrokerSel | null>(
          (m, b) => (b.jualLot > (m?.jualLot ?? 0) ? b : m), null)
        const a = selAsing?.[iSel]
        return {
          ...s,
          beliLotAsing: a?.beliLot,
          jualLotAsing: a?.jualLot,
          warnaBeli: dominanBeli ? warnaBrokerCanvas(dominanBeli.kode) : 'rgba(48,164,108,0.7)',
          warnaJual: dominanJual ? warnaBrokerCanvas(dominanJual.kode) : 'rgba(229,72,77,0.7)',
        }
      })
      data.push({ tanggal: h.tanggal, sel })
    }
    prim.setData(data)
  }, [tf, footprintAktif, hari, candle])

  // ── seret memilih (hanya saat mode seleksi aktif) ────────────────────────
  const keNilai = (x: number, y: number): { t: string | number; harga: number } | null => {
    const chart = chartRef.current
    const lilin = lilinRef.current
    const deret: Array<string | number> = tf === 'harian'
      ? candle.lilin.map((b) => b.time as string)
      : barIntra.map((b) => b.epoch + GESER_WIB)
    if (!chart || !lilin || deret.length === 0) return null
    const harga = lilin.coordinateToPrice(y)
    if (harga === null) return null
    // Di luar bar pertama/terakhir chart menjawab null — dijatuhkan ke ujung
    // riwayat sesuai sisinya supaya seret sampai tepi tetap sah.
    let t = chart.timeScale().coordinateToTime(x) as string | number | null
    if (t === null) {
      const el = bungkusRef.current
      const tengah = el ? el.clientWidth / 2 : 0
      t = x < tengah ? deret[0] : deret[deret.length - 1]
    }
    return { t, harga: harga as number }
  }

  const posisi = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // try/catch pola CompareTab: pointerId yang sudah lepas (sentuhan sangat
    // singkat) atau event uji membuat setPointerCapture melempar — seleksinya
    // sendiri tetap sah tanpa capture.
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* lanjut */ }
    const p = posisi(e)
    seretRef.current = { x0: p.x, y0: p.y }
  }
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = seretRef.current
    if (!s) return
    const p = posisi(e)
    const a = keNilai(s.x0, s.y0)
    const b = keNilai(p.x, p.y)
    // Kotak live disetor ke primitive langsung (requestUpdate), BUKAN setState
    // per gerakan — spek §3 W1.
    if (a && b) seleksiRef.current?.setKotak({ t0: a.t, t1: b.t, harga0: a.harga, harga1: b.harga })
  }
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = seretRef.current
    if (!s) return
    seretRef.current = null
    const p = posisi(e)
    // Seret sangat kecil dianggap klik, bukan seleksi — kalau tidak, satu
    // ketukan tak sengaja akan mengosongkan panel tanpa sebab yang terlihat.
    const cukup = Math.abs(p.x - s.x0) > 6 && Math.abs(p.y - s.y0) > 6
    if (cukup) {
      const a = keNilai(s.x0, s.y0)
      const b = keNilai(p.x, p.y)
      if (a && b) {
        if (tf === 'harian') {
          const t0 = String(a.t), t1 = String(b.t)
          setSel({
            tglMulai: t0 <= t1 ? t0 : t1,
            tglAkhir: t0 <= t1 ? t1 : t0,
            hargaMin: Math.min(a.harga, b.harga),
            hargaMax: Math.max(a.harga, b.harga),
          })
        } else {
          const e0 = Number(a.t) - GESER_WIB, e1 = Number(b.t) - GESER_WIB
          setSelIntra({
            dariEpoch: Math.min(e0, e1),
            sampaiEpoch: Math.max(e0, e1),
            hargaMin: Math.min(a.harga, b.harga),
            hargaMax: Math.max(a.harga, b.harga),
          })
        }
        resetBatas()
      }
    } else {
      // batal — kembalikan kotak terkunci sebelumnya (kalau ada)
      const k = tf === 'harian'
        ? (sel ? { t0: sel.tglMulai, t1: sel.tglAkhir, harga0: sel.hargaMin, harga1: sel.hargaMax } : null)
        : (selIntra ? {
            t0: selIntra.dariEpoch + GESER_WIB, t1: selIntra.sampaiEpoch + GESER_WIB,
            harga0: selIntra.hargaMin, harga1: selIntra.hargaMax,
          } : null)
      seleksiRef.current?.setKotak(k)
    }
    setModeSeleksi(false)
  }

  // `nilai` memilih ruas dipakai untuk lebar bar & urutan; `nilaiRp` ruas Rp
  // dicetak di sebelahnya — beda per kuadran (gross pakai beliNilai/jualNilai
  // sisi itu sendiri, net pakai netNilai).
  const daftar = (
    baris: RingkasBroker[],
    batasTampil: number,
    setBatas: (n: number) => void,
    nilai: (r: RingkasBroker) => number,
    nilaiRp: (r: RingkasBroker) => number,
  ) => {
    const maks = Math.max(1, ...baris.map((r) => Math.abs(nilai(r))))
    // Avg per baris (masukan Johan 27 Agu: "bisa ditambahi avg broker juga
    // sih harusnya, kan data juga udh ada") — harga rata-rata dari sisi yang
    // sedang ditampilkan barisnya: nilaiRp ÷ (lot × 100). Lot 0 → tanpa avg.
    const avgBaris = (r: RingkasBroker) => {
      const lot = Math.abs(nilai(r))
      return lot > 0 ? Math.abs(nilaiRp(r)) / (lot * 100) : null
    }
    return baris.slice(0, batasTampil).map((r) => {
      const avg = avgBaris(r)
      return (
        <div className="wp-baris" key={r.kode}>
          <span className="wp-kode">{r.kode}</span>
          <span className="wp-bar" style={{ width: `${Math.max(4, (Math.abs(nilai(r)) / maks) * 100)}%` }} />
          <span className="wp-nilai">
            {lotRingkas(Math.abs(nilai(r)))} · Rp {rupiahRingkas(Math.abs(nilaiRp(r)))}
            {avg !== null && <> · avg {Math.round(avg).toLocaleString('id-ID')}</>}
          </span>
        </div>
      )
    }).concat(
      baris.length > batasTampil
        ? [
            <button key="lagi" type="button" className="wp-lagi" onClick={() => setBatas(baris.length)}>
              +{baris.length - batasTampil} broker lain
            </button>,
          ]
        : [],
    )
  }

  // Toggle Significant/Full: baris broker recehan disaring di mode Significant
  // (bawaan), ditampilkan semua di Full. Ambang & fungsinya di whalesPapan.ts
  // supaya bisa diuji tanpa render.
  const saring = (baris: RingkasBroker[], nilai: (r: RingkasBroker) => number) =>
    modeBaris === 'signifikan' ? saringSignifikan(baris, nilai) : baris

  return (
    <div className="lantai">
      <div className="vhead">
        <h1>Whales Papan</h1>
        <span className="sub">jejak bandar harian — pilih rentang harga &amp; waktu, lihat siapa menampung</span>
        <CatatanCakupan inline />
      </div>


      {/* Bilah kendali berkelompok — sistem tata C+A (keputusan Johan 28 Agu,
          artifact "Re-Layout PAPAN"; Whales = halaman percontohan chart).
          Kelompok EMITEN · LAPISAN · TAMPILAN, membungkus per kelompok. */}
      <div className="bilah-kendali wp-atur">
        <div className="grup-k">
          <div className="wp-emiten">
            <StockAutocomplete
              stocks={indeks?.stocks || []}
              value={ketik}
              onChange={setKetik}
              onSelect={(v) => { setKetik(v); setKode(v.toUpperCase()) }}
              placeholder="Cari emiten: BUMI, BBCA…"
            />
          </div>
          {/* Kode TIDAK diulang di samping input (Johan 28 Agu: "kode Emiten
              cukup 1 saja yang di kolom yang di tampilkan"). */}
          {tidakDiperdagangkan(barisKartu) && (
            <LencanaBeku beku={barisKartu?.beku} sejak={barisKartu?.beku_sejak} />
          )}
          {tahunAda.length > 0 && (
            <span className="muted" style={{ fontSize: 12 }}>
              broker {tahunAda[0]}–{tahunAda[tahunAda.length - 1]} · {hari.length.toLocaleString('id-ID')} hari
            </span>
          )}
          {muat && <span className="muted" style={{ fontSize: 12 }}>memuat…</span>}
        </div>
        <span className="pemisah-v" aria-hidden="true" />
        {/* Pemilih TF Harian/4H/1H DICABUT (Johan 27 Agu: "di hapus saja ini
            ... cukup pakai harian dlu") — mode intraday tetap di kode (tf
            selalu 'harian'), tinggal mengembalikan tombol ini bila diminta. */}
        {/* Label "Lapisan" dibuang: kelima chipnya menamai lapisannya
            sendiri (Pilih area · Garis AVG · Profil · Bubble · Footprint).
            Label "Tampilan" di kelompok sebelahnya TETAP — chipnya berbunyi
            "Grid · 30% · Auto", dan angka telanjang tanpa label tak berarti
            apa-apa. */}
        <div className="grup-k">
        <button
          type="button"
          className={`chip-t${modeSeleksi ? ' on' : ''}`}
          aria-pressed={modeSeleksi}
          title="Seret persegi di chart untuk memilih rentang harga × waktu"
          onClick={() => setModeSeleksi((v) => !v)}
        >
          Pilih area
        </button>
        <button
          type="button"
          className={`chip-t${avgAktif && tf === 'harian' ? ' on' : ''}`}
          aria-pressed={avgAktif && tf === 'harian'}
          disabled={tf !== 'harian'}
          title={tf !== 'harian'
            ? 'Hanya mode Harian — datanya dari broker harian'
            : 'Garis harga beli rata-rata 5 penampung terbesar (seluruh riwayat, atau area seleksi bila ada)'}
          onClick={() => setAvgAktif((v) => !v)}
        >
          Garis AVG
        </button>
        <button
          type="button"
          className={`chip-t${profilAktif && tf === 'harian' ? ' on' : ''}`}
          aria-pressed={profilAktif && tf === 'harian'}
          disabled={tf !== 'harian'}
          title={tf !== 'harian'
            ? 'Hanya mode Harian — datanya dari broker harian'
            : 'Total lot per pita harga (hari dikelompokkan menurut harga rata-ratanya). Emas = pita teramai (POC), terang = area nilai 70% lot, redup = sisanya'}
          onClick={() => setProfilAktif((v) => !v)}
        >
          Profil
        </button>
        <button
          type="button"
          className={`chip-t${bubbleAktif && tf === 'harian' ? ' on' : ''}`}
          aria-pressed={bubbleAktif && tf === 'harian'}
          disabled={tf !== 'harian'}
          title={tf !== 'harian'
            ? 'Hanya mode Harian — datanya dari broker harian'
            : 'Lingkaran = broker yang net beli/jualnya MENYIMPANG jauh dari kebiasaan pasar hari itu (ambang slider z). Duduk di harga rata-rata transaksinya — bisa di luar badan candle. Arahkan kursor/ketuk lingkarannya untuk rincian'}
          onClick={() => setBubbleAktif((v) => !v)}
        >
          Bubble
        </button>
        {/* W7 footprint — HANYA mode Harian, disembunyikan (bukan disabled)
            di intraday karena datanya memang tak ada di sana (spek §1). */}
        {tf === 'harian' && (
          <button
            type="button"
            className={`chip-t${footprintAktif ? ' on' : ''}`}
            aria-pressed={footprintAktif}
            title="Sel per level harga: broker ditempatkan di harga rata-rata beli/jualnya hari itu — hampiran, bukan rincian transaksi per level"
            onClick={() => setFootprintAktif((v) => {
              const nyala = !v
              // Sel footprint baru terbaca saat kolom cukup lebar; pada zoom
              // setahun tingginya < 1px (primitive memang menolak menggambar
              // di bawah BAR_SPACING_MIN). Saat dinyalakan dari zoom jauh,
              // sempitkan pandangan ke ±45 bar terakhir supaya yang menyala
              // langsung TERLIHAT — bukan toggle yang tampak mati.
              if (nyala) zoomOtomatis(true, true)
              return nyala
            })}
          >
            Footprint
          </button>
        )}
        {bubbleAktif && tf === 'harian' && (
          <label className="wp-z muted">
            z ≥ {ambangZ.toFixed(1)}
            <input
              type="range"
              min={1}
              max={4}
              step={0.5}
              value={ambangZ}
              onChange={(e) => setAmbangZ(Number(e.target.value))}
              aria-label="Ambang z-score bubble outlier"
            />
          </label>
        )}
        </div>
        <span className="pemisah-v" aria-hidden="true" />
        <div className="grup-k grup-kanan">
        <span className="grup-lbl">Tampilan</span>
        <button
          type="button"
          className={`chip-t${grid.tampil ? ' on' : ''}`}
          aria-pressed={grid.tampil}
          title={grid.tampil ? 'Sembunyikan garis bantu' : 'Tampilkan garis bantu'}
          onClick={() => setGrid((g) => ({ ...g, tampil: !g.tampil }))}
        >
          Grid
        </button>
        {grid.tampil && (
          <label className="wp-z muted" title="Keburaman garis bantu">
            {Math.round(grid.alfa * 100)}%
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={Math.round(grid.alfa * 100)}
              onChange={(e) => setGrid((g) => ({ ...g, alfa: Number(e.target.value) / 100 }))}
              aria-label="Keburaman garis bantu, persen"
            />
          </label>
        )}
        <button
          type="button"
          className="chip-t"
          title={footprintAktif
            ? 'Zoom otomatis ke jendela terakhir yang sel footprint-nya terbaca'
            : 'Kembali ke pandangan 1 tahun terakhir — geser kiri untuk riwayat lama'}
          onClick={() => zoomOtomatis(footprintAktif)}
        >
          Auto
        </button>
        <InfoIndikator judul="Indikator Whales Papan" item={INFO_WHALES} />
        {(tf === 'harian' ? sel : selIntra) && (
          <button type="button" className="btn-p"
            onClick={() => { setSel(null); setSelIntra(null) }}>
            Hapus seleksi
          </button>
        )}
        </div>
      </div>

      {galat === 'belum-ada' || galat === 'kosong' ? (
        <div className="wp-kosong">
          Riwayat broker bertahun untuk <strong>{kode}</strong> belum tersedia.
          <br />
          Arsip broker mencakup {TAHUN_AWAL} sampai sekarang; emiten ini belum punya
          rincian broker di dalamnya.
        </div>
      ) : (
        /* Panel kanan KONTEKSTUAL (sistem tata C+A): tanpa seleksi ia kolaps
           jadi strip tipis yang bisa ditekan (chart memakai seluruh lebar);
           ada seleksi/pesan → kolom penuh. */
        <div className={`wp-panggung tata-2${panelBerisi ? '' : ' ctx-kosong'}`}>
          <div
            className="wp-kanvas-bungkus wp-chart"
            ref={bungkusRef}
            onContextMenu={(e) => {
              // Dicegah HANYA di kanvas; di panel hasil & metodologi klik
              // kanan tetap milik peramban (menyalin angka itu wajar).
              e.preventDefault()
              const bungkus = bungkusRef.current
              const chart = chartRef.current
              const seri = lilinRef.current
              if (!bungkus || !chart || !seri) return
              const r = bungkus.getBoundingClientRect()
              const x = e.clientX - r.left
              const y = e.clientY - r.top
              const hargaMentah = seri.coordinateToPrice(y)
              const waktu = chart.timeScale().coordinateToTime(x)
              setMenuKanan({
                x, y,
                harga: hargaMentah == null ? null : keFraksi(Number(hargaMentah)),
                tanggal: typeof waktu === 'string' ? waktu : null,
              })
            }}
          >
            {modeSeleksi && (
              <div
                className="wp-overlay"
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              />
            )}
            {/* Tooltip sel footprint (spek §1: hover desktop, tap ponsel —
                dua-duanya menyetor lewat hoveredObjectId chart). */}
            {footprintAktif && fpHover && (() => {
              const lebar = bungkusRef.current?.clientWidth ?? 0
              const kanan = lebar > 0 && fpHover.x > lebar / 2
              const s = fpHover.sel
              return (
                <div
                  className="wp-fp-tip"
                  style={{
                    left: kanan ? undefined : fpHover.x + 14,
                    right: kanan ? lebar - fpHover.x + 14 : undefined,
                    top: Math.max(8, fpHover.y - 10),
                  }}
                >
                  <div className="wp-fp-tip-judul">
                    {fpHover.tanggal} · {Math.round(s.hargaBawah).toLocaleString('id-ID')}–{Math.round(s.hargaAtas).toLocaleString('id-ID')}
                  </div>
                  {/* DUA KOLOM beli|jual (Johan 28 Agu, menunjuk "Gross Broker
                      Breakdown" whales.id). Kolom kita GROSS BELI|GROSS JUAL —
                      BUKAN agresif/pasif: data harian tak menyimpan sisi
                      agresor, dan mengarang kolomnya berarti berbohong.
                      Tag (a) = porsi lot broker itu yang datang dari investor
                      asing di sel ini; absen kalau varian asing belum ada. */}
                  <div className="wp-fp-duo">
                    {([
                      ['Beli', 'beliLot', 'wp-plus', s.beliLot, s.beliLotAsing],
                      ['Jual', 'jualLot', 'wp-minus', s.jualLot, s.jualLotAsing],
                    ] as const).map(([judul, ruas, nada, total, totalAsing]) => {
                      const baris = s.broker
                        .filter((b) => (b[ruas as 'beliLot' | 'jualLot'] ?? 0) > 0)
                        .sort((a, b) => (b[ruas as 'beliLot' | 'jualLot'] ?? 0) - (a[ruas as 'beliLot' | 'jualLot'] ?? 0))
                      const tampil = baris.slice(0, 10)
                      return (
                        <div key={judul}>
                          <div className="wp-fp-kol-h">
                            <span className={nada}>{judul}</span>
                            <b className={nada}>
                              {lotRingkas(total)} lot
                              {totalAsing != null && total > 0
                                ? ` · a ${Math.round((totalAsing / total) * 100)}%`
                                : ''}
                            </b>
                          </div>
                          {tampil.map((b) => (
                            <div className="wp-fp-b" key={b.kode}>
                              <span className="kd" style={{ color: warnaBrokerCanvas(b.kode) }}>{b.kode}</span>
                              <span className={`nl ${nada}`}>{lotRingkas(b[ruas as 'beliLot' | 'jualLot'])}</span>
                            </div>
                          ))}
                          {baris.length > tampil.length && (
                            <div className="wp-fp-sisa">+{baris.length - tampil.length} broker lain</div>
                          )}
                          {baris.length === 0 && <div className="wp-fp-sisa">tak ada</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
            {/* Tooltip bubble — menjelaskan APA yang ditandai lingkaran itu
                (Johan 28 Agu: fungsinya kurang jelas, posisinya bisa di luar
                badan candle karena duduk di harga rata-rata transaksi). */}
            {bubbleAktif && bubHover && (() => {
              const lebar = bungkusRef.current?.clientWidth ?? 0
              const kanan = lebar > 0 && bubHover.x > lebar / 2
              const b = bubHover.b
              return (
                <div
                  className="wp-fp-tip"
                  style={{
                    left: kanan ? undefined : bubHover.x + 14,
                    right: kanan ? lebar - bubHover.x + 14 : undefined,
                    top: Math.max(8, bubHover.y - 10),
                  }}
                >
                  <div className="wp-fp-tip-judul">
                    <span style={{ color: warnaBrokerCanvas(b.broker) }}>{b.broker}</span> · {b.waktu}
                  </div>
                  <div className="wp-fp-tip-total">
                    <span className={b.netNilai >= 0 ? 'wp-plus' : 'wp-minus'}>
                      net {b.netNilai >= 0 ? 'beli' : 'jual'} Rp {rupiahRingkas(Math.abs(b.netNilai))}
                    </span>
                  </div>
                  <div className="muted">
                    Menyimpang jauh dari kebiasaan pasar hari itu (outlier, ambang slider z).
                    Lingkaran duduk di harga rata-rata transaksinya ±{Math.round(b.harga).toLocaleString('id-ID')} —
                    bisa di luar badan candle.
                  </div>
                </div>
              )
            })()}
            {menuKanan && (
              <>
                <div className="wp-menu-latar" onClick={() => setMenuKanan(null)}
                  onContextMenu={(ev) => { ev.preventDefault(); setMenuKanan(null) }} />
                <div className="wp-menu" style={{ left: menuKanan.x, top: menuKanan.y }} role="menu">
                  <button type="button" onClick={() => { zoomOtomatis(footprintAktif); setMenuKanan(null) }}>
                    Kembali ke pandangan 1 tahun
                  </button>
                  {menuKanan.harga != null && (
                    <button type="button" onClick={() => {
                      void navigator.clipboard?.writeText(String(menuKanan.harga)); setMenuKanan(null)
                    }}>
                      Salin harga {menuKanan.harga.toLocaleString('id-ID')}
                    </button>
                  )}
                  {menuKanan.tanggal && (
                    <button type="button" onClick={() => {
                      void navigator.clipboard?.writeText(menuKanan.tanggal!); setMenuKanan(null)
                    }}>
                      Salin tanggal {tglPendek(menuKanan.tanggal)}
                    </button>
                  )}
                  <button type="button" onClick={() => { setGrid((g) => ({ ...g, tampil: !g.tampil })); setMenuKanan(null) }}>
                    {grid.tampil ? 'Sembunyikan garis bantu' : 'Tampilkan garis bantu'}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Rincian broker dari klik pill AVG — modal kanonis, bukan kartu
              menyisip (Johan: "di jadikan modal ... biar rapi"). Hanya mode
              Harian, karena data broker bursa memang terbit harian. */}
          {rinciBroker && brokerPilih && (
            <ModalKecil label={`Broker ${brokerPilih}`} onClose={() => setBrokerPilih(null)} className="wp-modal-broker">
              <div className="wp-kartu-judul">
                <span className="wp-titik-broker" style={{ background: warnaBrokerCanvas(brokerPilih) }} />
                <strong>{brokerPilih}</strong>
                <span className="muted">
                  {sel ? 'area seleksi' : 'seluruh riwayat'} · aktif {rinciBroker.hariAktif.toLocaleString('id-ID')} hari
                </span>
              </div>
              <div className="wp-kartu-isi">
                <span>Rata beli</span>
                <span>{rinciBroker.r.beliLot ? Math.round(rinciBroker.r.beliNilai / (rinciBroker.r.beliLot * 100)).toLocaleString('id-ID') : '—'}</span>
                <span>Rata jual</span>
                <span>{rinciBroker.r.jualLot ? Math.round(rinciBroker.r.jualNilai / (rinciBroker.r.jualLot * 100)).toLocaleString('id-ID') : '—'}</span>
                <span>Gross beli</span>
                <span>{lotRingkas(rinciBroker.r.beliLot)} lot · Rp {rupiahRingkas(rinciBroker.r.beliNilai)}</span>
                <span>Gross jual</span>
                <span>{lotRingkas(rinciBroker.r.jualLot)} lot · Rp {rupiahRingkas(rinciBroker.r.jualNilai)}</span>
                <span>Net</span>
                <span className={rinciBroker.r.netNilai >= 0 ? 'wp-plus' : 'wp-minus'}>
                  {lotRingkas(rinciBroker.r.netLot)} lot · Rp {rupiahRingkas(rinciBroker.r.netNilai)}
                </span>
              </div>
              <p className="wp-sub" style={{ marginTop: 8 }}>
                Rata-rata tertimbang seluruh transaksi broker ini di cakupan terpilih —
                bukan modal posisi yang masih dipegang.
              </p>
            </ModalKecil>
          )}
          {!panelBerisi ? (
            <button
              type="button"
              className="ctx-strip"
              title="Aktifkan mode pilih area"
              onClick={() => setModeSeleksi(true)}
            >
              Hasil Seleksi — tekan lalu seret area di chart
            </button>
          ) : (
          <div className="wp-hasil">
            <h3>Hasil seleksi</h3>
            {tf !== 'harian' && intra.galat ? (
              // Gating jujur (spek §1B): mode dikunci dengan sebabnya, bukan
              // dibiarkan kosong tanpa keterangan.
              <p className="wp-sub">
                Data intraday <strong>{kode}</strong> belum tersedia. Sumbernya hanya
                menyimpan ±90 hari terakhir, dan emiten ini tak punya transaksi di
                jendela olahan terakhir. Pakai mode <strong>Harian</strong> untuk
                riwayat penuh.
              </p>
            ) : tf !== 'harian' && hasilIntra && selIntra ? (
              <>
                <p className="wp-sub">
                  {tanggalWib(selIntra.dariEpoch)} {String(jamWib(selIntra.dariEpoch)).padStart(2, '0')}:00
                  {' – '}
                  {tanggalWib(selIntra.sampaiEpoch)} {String(jamWib(selIntra.sampaiEpoch)).padStart(2, '0')}:00
                  {' · '}{hasilIntra.nBar} bar {tf.toUpperCase()} · {hasilIntra.nHari} hari bursa
                </p>
                <div className="wp-sisi">
                  <div className="wp-sisi-judul"><span>Volume</span><span>{lotRingkas(hasilIntra.volume / 100)} lot</span></div>
                  <div className="wp-sisi-judul"><span>Nilai</span><span>Rp {rupiahRingkas(hasilIntra.value)}</span></div>
                  <div className="wp-sisi-judul"><span>Frekuensi</span><span>{hasilIntra.frequency.toLocaleString('id-ID')}×</span></div>
                  <div className="wp-sisi-judul"><span>Rentang harga</span>
                    <span>{Math.round(hasilIntra.hargaMin).toLocaleString('id-ID')}–{Math.round(hasilIntra.hargaMax).toLocaleString('id-ID')}</span></div>
                </div>
                <div className="wp-batas">
                  Pecahan per broker <strong>tidak tersedia</strong> di timeframe
                  intraday — data broker IDX hanya terbit harian setelah pasar
                  tutup. Pindah ke mode Harian untuk melihat siapa menampung.
                </div>
              </>
            ) : tf !== 'harian' ? (
              <p className="wp-sub">
                Tekan <strong>Pilih area</strong> lalu seret persegi di chart —
                panelnya berisi volume, nilai, dan frekuensi rentang itu
                (tanpa pecahan broker; data broker hanya harian).
              </p>
            ) : hasil ? (
              <>
                <p className="wp-sub">
                  {hasil.tglPertama && hasil.tglTerakhir && (
                    <>{tglPendek(hasil.tglPertama)} – {tglPendek(hasil.tglTerakhir)} · </>
                  )}
                  {hasil.nHari.toLocaleString('id-ID')} hari bursa · {hasil.nBroker} broker ·{' '}
                  {Math.round(sel!.hargaMin).toLocaleString('id-ID')}–
                  {Math.round(sel!.hargaMax).toLocaleString('id-ID')}
                </p>

                {/* Grid 2×2 rapi (Johan 28 Agu: "4 tombol ... di rapikan grd
                    nya gak asal") — dua pasang toggle, semua chip selebar
                    kolomnya sehingga sejajar atas-bawah. */}
                <div className="wp-toggle-duo">
                  <div className="wp-toggle" role="group" aria-label="Baris broker">
                    <button type="button" className={`chip-t${modeBaris === 'signifikan' ? ' on' : ''}`}
                      aria-pressed={modeBaris === 'signifikan'}
                      title="Sembunyikan broker yang porsinya di bawah 1% dari sisi ini"
                      onClick={() => setModeBaris('signifikan')}>Significant</button>
                    <button type="button" className={`chip-t${modeBaris === 'penuh' ? ' on' : ''}`}
                      aria-pressed={modeBaris === 'penuh'}
                      title="Tampilkan semua broker yang bertransaksi"
                      onClick={() => setModeBaris('penuh')}>Full</button>
                  </div>
                  {/* Pilih kuadran — dua-duanya sekaligus membuat panel
                      panjang menggulung. */}
                  <div className="wp-toggle" role="group" aria-label="Kuadran">
                    <button type="button" className={`chip-t${kuadran === 'gross' ? ' on' : ''}`}
                      aria-pressed={kuadran === 'gross'}
                      title="Total transaksi per broker, tanpa dikurangi lawannya"
                      onClick={() => setKuadran('gross')}>Gross</button>
                    <button type="button" className={`chip-t${kuadran === 'net' ? ' on' : ''}`}
                      aria-pressed={kuadran === 'net'}
                      title="Beli dikurangi jual per broker"
                      onClick={() => setKuadran('net')}>Net</button>
                  </div>
                </div>

                {kuadran === 'gross' && (<>
                <div className="wp-kuadran">GROSS — tanpa dikurangi lawannya</div>
                <div className="wp-sisi wp-beli">
                  <div className="wp-sisi-judul">
                    <span>Gross Beli</span>
                    <span>+{lotRingkas(hasil.totalGrossBeliLot)} lot</span>
                  </div>
                  {(() => {
                    const b = saring(hasil.grossBeli, (r) => r.beliLot)
                    return b.length
                      ? daftar(b, batasGrossBeli, setBatasGrossBeli, (r) => r.beliLot, (r) => r.beliNilai)
                      : <p className="wp-sub">tak ada</p>
                  })()}
                </div>
                <div className="wp-sisi wp-jual">
                  <div className="wp-sisi-judul">
                    <span>Gross Jual</span>
                    <span>{lotRingkas(hasil.totalGrossJualLot)} lot</span>
                  </div>
                  {(() => {
                    const b = saring(hasil.grossJual, (r) => r.jualLot)
                    return b.length
                      ? daftar(b, batasGrossJual, setBatasGrossJual, (r) => r.jualLot, (r) => r.jualNilai)
                      : <p className="wp-sub">tak ada</p>
                  })()}
                </div>
                </>)}

                {kuadran === 'net' && (<>
                <div className="wp-kuadran">NET — beli dikurangi jual</div>
                <div className="wp-sisi wp-beli">
                  <div className="wp-sisi-judul">
                    <span>Net Beli</span>
                    <span>+{lotRingkas(hasil.totalNetBeliLot)} lot</span>
                  </div>
                  {(() => {
                    const b = saring(hasil.netBeli, (r) => r.netLot)
                    return b.length
                      ? daftar(b, batasNetBeli, setBatasNetBeli, (r) => r.netLot, (r) => r.netNilai)
                      : <p className="wp-sub">tak ada</p>
                  })()}
                </div>
                <div className="wp-sisi wp-jual">
                  <div className="wp-sisi-judul">
                    <span>Net Jual</span>
                    <span>{lotRingkas(hasil.totalNetJualLot)} lot</span>
                  </div>
                  {(() => {
                    const b = saring(hasil.netJual, (r) => r.netLot)
                    return b.length
                      ? daftar(b, batasNetJual, setBatasNetJual, (r) => r.netLot, (r) => r.netNilai)
                      : <p className="wp-sub">tak ada</p>
                  })()}
                </div>
                </>)}
              </>
            ) : (
              <p className="wp-sub">
                Tekan <strong>Pilih area</strong> lalu seret persegi di chart untuk memilih rentang.
              </p>
            )}

            <div className="wp-batas">
              Empat kuadran di sini <strong>GROSS/NET</strong> (total transaksi vs. beli dikurangi
              jual), <strong>bukan</strong> agresif/pasif — sisi mana yang menyerang harga tak
              tersedia pada data harian.
              <br />
              Rentang harga menyaring <strong>hari yang harga rata-ratanya</strong> jatuh di situ,
              bukan lot yang tereksekusi persis di harga itu.
            </div>

            {/* §7 spek: batas jujur halaman ini, apa adanya — supaya tak ada
                yang menebak fitur yang datanya memang tidak kita miliki. */}
            <details className="wp-metodologi">
              <summary>Metodologi &amp; batas</summary>
              <ul>
                <li>
                  Rincian per broker hanya tersedia <strong>harian</strong> — dilaporkan
                  setelah pasar tutup. Tidak ada pecahan broker per jam.
                </li>
                <li>
                  Profil harga adalah <strong>hampiran</strong> dari data harian (lot
                  dibagi ke pita harga rata-rata hari itu), bukan catatan per transaksi.
                </li>
                <li>
                  Tidak ada antrean order, replay transaksi, maupun arah agresor —
                  datanya tidak tersedia untuk publik, jadi tidak kami tampilkan
                  tiruannya.
                </li>
                <li>
                  Bubble menandai broker yang net hariannya menyimpang jauh dari
                  sebaran seluruh broker hari itu; ambangnya kendali di tanganmu,
                  bukan penilaian kami.
                </li>
                <li>
                  Footprint harian menempatkan tiap broker di harga rata-rata
                  belinya/jualnya hari itu — bukan rincian transaksi per level
                  harga. Hanya papan reguler; tidak ada sisi agresor (bukan
                  HAKA/HAKI).
                </li>
                <li>
                  Mode <strong>4H/1H</strong> hanya mencakup ±90 hari terakhir —
                  batas penyimpanan sumbernya; arsip kami mulai 29 Mei 2026 dan
                  bertambah tiap hari sejak itu. Candle-nya agregasi bar 1 menit
                  (lelang pembuka/penutup digabung ke jam sesi terdekat).
                </li>
                <li>
                  Aliran asing per jam <strong>tidak ditampilkan</strong> — kami
                  mengukurnya di seluruh arsip dan sumbernya memang tak mengisi
                  angka itu di tingkat menit. Aliran asing tetap tersedia harian.
                </li>
                <li>
                  Halaman ini <strong>deskriptif</strong> — memetakan siapa bertransaksi
                  di mana, bukan rekomendasi beli/jual.
                </li>
              </ul>
            </details>
          </div>
          )}
        </div>
      )}
    </div>
  )
}
