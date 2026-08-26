import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CandlestickSeries, CrosshairMode, HistogramSeries, createChart,
  type CandlestickData, type HistogramData, type IChartApi, type ISeriesApi,
  type SeriesType, type Time,
} from 'lightweight-charts'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { ModalKecil } from '../../components/dasbor/ModalKecil'
import { CatatanCakupan } from '../../components/dasbor/CatatanCakupan'
import { LencanaBeku, tidakDiperdagangkan } from '../../components/dasbor/LencanaBeku'
import { useStockIndex } from '../../lib/dasbor/stockDetailData'
import { useBrokerTahunan } from '../../lib/dasbor/brokerTahunanData'
import { useRingkasKartu } from '../../lib/dasbor/kartuRingkas'
import { warnaBrokerCanvas } from '../../lib/dasbor/kelompokBroker'
import { useTheme } from '../../context/ThemeContext'
import { SeleksiAreaChart } from '../../lib/dasbor/seleksiAreaChart'
import { GarisAvgBroker } from '../../lib/dasbor/garisAvgBroker'
import { BubbleBroker, bubbleOutlierHarian } from '../../lib/dasbor/bubbleBroker'
import { ProfilHargaChart } from '../../lib/dasbor/profilHargaChart'
import {
  agregasi4h, agregatSeleksiIntraday, jamWib, muatIntraday1h, tanggalWib,
  type Bar1H, type GalatIntraday, type RingkasIntraday,
} from '../../lib/dasbor/intradayWhales'
import {
  agregatArea, profilHarga, saringSignifikan,
  type RingkasBroker, type SeleksiArea,
} from '../../lib/dasbor/whalesPapan'
import './WhalesPapan.css'

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
function lotRingkas(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)} jt`
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}rb`
  return String(Math.round(n))
}

interface DataCandle {
  lilin: CandlestickData[]
  volume: HistogramData[]
}

/** Kolom `ohlcv_stockbit`: tanggal,unixdate,o,h,l,c,volume,… (lihat
 *  `ohlcvKaya.ts`). Harian tersesuaikan aksi korporasi — konvensi yang benar
 *  untuk BENTUK grafik (aturan dua-konvensi di CLAUDE.md). */
async function muatCandle(kode: string): Promise<DataCandle> {
  const r = await fetch(`/data-idx/json/ohlcv_stockbit/${kode}.json`)
  if (!r.ok) return { lilin: [], volume: [] }
  try {
    const j = (await r.json()) as { bar?: (string | number)[][] }
    const lilin: CandlestickData[] = []
    const volume: HistogramData[] = []
    for (const b of j.bar ?? []) {
      const time = b[0] as Time
      const open = Number(b[2]); const high = Number(b[3])
      const low = Number(b[4]); const close = Number(b[5])
      if (!Number.isFinite(open) || !Number.isFinite(close)) continue
      lilin.push({ time, open, high, low, close })
      volume.push({
        time,
        value: Number(b[6]) || 0,
        color: close >= open ? 'rgba(48, 164, 108, 0.5)' : 'rgba(229, 72, 77, 0.5)',
      })
    }
    return { lilin, volume }
  } catch {
    return { lilin: [], volume: [] }
  }
}

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
  const [tf, setTf] = useState<Tf>('harian')
  const [candle, setCandle] = useState<DataCandle>({ lilin: [], volume: [] })
  const [intra, setIntra] = useState<{ bar: Bar1H[]; galat: GalatIntraday }>({ bar: [], galat: null })
  const [avgAktif, setAvgAktif] = useState(true)
  const [profilAktif, setProfilAktif] = useState(true)
  const [bubbleAktif, setBubbleAktif] = useState(false)
  /** Ambang z-score bubble outlier — slider 1–4, bawaan 2,5 (ala whales.id). */
  const [ambangZ, setAmbangZ] = useState(2.5)
  // Empat kuadran, empat batas "tampilkan lagi" — memperluas satu tak boleh
  // ikut memperluas yang lain, keduanya baris broker tapi peringkat berbeda.
  const [batasGrossBeli, setBatasGrossBeli] = useState(PANEL_AWAL)
  const [batasGrossJual, setBatasGrossJual] = useState(PANEL_AWAL)
  const [batasNetBeli, setBatasNetBeli] = useState(PANEL_AWAL)
  const [batasNetJual, setBatasNetJual] = useState(PANEL_AWAL)
  // Significant (default, pola whales.id) menyembunyikan broker recehan lewat
  // AMBANG_SIGNIFIKAN; Full menampilkan semua yang pernah bertransaksi.
  const [modeBaris, setModeBaris] = useState<'signifikan' | 'penuh'>('signifikan')

  const bungkusRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const lilinRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const volRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const seleksiRef = useRef<SeleksiAreaChart | null>(null)
  const avgRef = useRef<GarisAvgBroker | null>(null)
  const profilRef = useRef<ProfilHargaChart | null>(null)
  const bubbleRef = useRef<BubbleBroker | null>(null)
  const seretRef = useRef<{ x0: number; y0: number } | null>(null)

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
    }
    if (import.meta.env.DEV) (el as HTMLDivElement & { __papanChart?: unknown }).__papanChart = chart
    // Pill AVG clickable (Johan 26 Agu: "mgkn clickable"): hitTest primitive
    // menyetorkan `avg:<broker>` ke hoveredObjectId; klik membuka kartu
    // rincian broker itu di panel.
    const saatKlik = (p: { hoveredObjectId?: unknown }) => {
      const id = typeof p.hoveredObjectId === 'string' ? p.hoveredObjectId : ''
      if (id.startsWith('avg:')) setBrokerPilih(id.slice(4))
    }
    chart.subscribeClick(saatKlik)
    return () => {
      chart.unsubscribeClick(saatKlik)
      chart.remove()
      chartRef.current = null
      lilinRef.current = null
      volRef.current = null
      seleksiRef.current = null
      avgRef.current = null
      profilRef.current = null
      bubbleRef.current = null
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
    chart.applyOptions({
      layout: { textColor: c('--text2', '#9CA0AC') },
      grid: {
        vertLines: { color: c('--line', '#24262E') },
        horzLines: { color: c('--line', '#24262E') },
      },
    })
  }, [theme])

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
    if (tf === 'harian') {
      lilin.setData(candle.lilin)
      vol.setData(candle.volume)
      const n = candle.lilin.length
      if (n > 0) {
        chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - JENDELA_AWAL), to: n + 2 })
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
        .map((r) => ({
          broker: r.kode,
          harga: r.beliNilai / (r.beliLot * 100),
          pct: totalBeli ? r.beliNilai / totalBeli : 0,
          warna: warnaBrokerCanvas(r.kode),
        })),
    )
  }, [tf, avgAktif, hari, sel])

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
    e.currentTarget.setPointerCapture(e.pointerId)
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
    return baris.slice(0, batasTampil).map((r) => (
      <div className="wp-baris" key={r.kode}>
        <span className="wp-kode">{r.kode}</span>
        <span className="wp-bar" style={{ width: `${Math.max(4, (Math.abs(nilai(r)) / maks) * 100)}%` }} />
        <span className="wp-nilai">
          {lotRingkas(Math.abs(nilai(r)))} · Rp {rupiahRingkas(Math.abs(nilaiRp(r)))}
        </span>
      </div>
    )).concat(
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
      </div>

      <CatatanCakupan />

      <div className="wp-atur">
        <div className="wp-emiten">
          <StockAutocomplete
            stocks={indeks?.stocks || []}
            value={ketik}
            onChange={setKetik}
            onSelect={(v) => { setKetik(v); setKode(v.toUpperCase()) }}
            placeholder="Cari emiten: BUMI, BBCA…"
          />
        </div>
        <strong>{kode}</strong>
        {tidakDiperdagangkan(barisKartu) && (
          <LencanaBeku beku={barisKartu?.beku} sejak={barisKartu?.beku_sejak} />
        )}
        {tahunAda.length > 0 && (
          <span className="muted" style={{ fontSize: 12 }}>
            broker {tahunAda[0]}–{tahunAda[tahunAda.length - 1]} · {hari.length.toLocaleString('id-ID')} hari
          </span>
        )}
        {muat && <span className="muted" style={{ fontSize: 12 }}>memuat…</span>}
        {/* Dua mode (spek §1): Harian = pecahan broker penuh (unggulan);
            Intraday 4H/1H = harga+volume ±90 hari, TANPA broker. */}
        <span className="wp-toggle" role="group" aria-label="Kerangka waktu">
          {(['harian', '4h', '1h'] as const).map((t) => (
            <button key={t} type="button"
              className={`chip-t${tf === t ? ' on' : ''}`}
              aria-pressed={tf === t}
              title={t === 'harian'
                ? 'Candle harian + pecahan broker (riwayat penuh)'
                : 'Candle intraday ±90 hari terakhir — tanpa pecahan broker (data broker hanya terbit harian)'}
              onClick={() => setTf(t)}>
              {t === 'harian' ? 'Harian' : t.toUpperCase()}
            </button>
          ))}
        </span>
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
            : 'Bar lot per pita harga di tepi kanan plot — dari broker harian'}
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
            : 'Lingkaran broker yang net-nya menyimpang dari pasar hari itu; ambangnya disetel slider z'}
          onClick={() => setBubbleAktif((v) => !v)}
        >
          Bubble
        </button>
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
        {(tf === 'harian' ? sel : selIntra) && (
          <button type="button" className="btn-p wp-sisa"
            onClick={() => { setSel(null); setSelIntra(null) }}>
            Hapus seleksi
          </button>
        )}
      </div>

      {galat === 'belum-ada' || galat === 'kosong' ? (
        <div className="wp-kosong">
          Riwayat broker bertahun untuk <strong>{kode}</strong> belum tersedia.
          <br />
          Data yang sudah tervalidasi baru sejak 2020, dan emiten ini belum masuk
          gelombang pengumpulannya.
        </div>
      ) : (
        <div className="wp-panggung">
          <div className="wp-kanvas-bungkus wp-chart" ref={bungkusRef}>
            {modeSeleksi && (
              <div
                className="wp-overlay"
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              />
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
                  {hasil.nHari.toLocaleString('id-ID')} hari bursa · {hasil.nBroker} broker ·{' '}
                  {Math.round(sel!.hargaMin).toLocaleString('id-ID')}–
                  {Math.round(sel!.hargaMax).toLocaleString('id-ID')}
                </p>

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
        </div>
      )}
    </div>
  )
}
