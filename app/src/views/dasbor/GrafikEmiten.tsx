import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createChart, CandlestickSeries, HistogramSeries, LineSeries, LineStyle,
  type IChartApi, type ISeriesApi, type MouseEventParams, type Time,
} from 'lightweight-charts'
import { useKamusEmiten } from '../../lib/dasbor/kamusEmiten'
import {
  keDataLilinVolume, batasBawahRentang, potongRentang, RENTANG_GRAFIK,
  hitungMA, hitungEMA, hitungRSI, hitungMACD, hitungBollinger, keSeriGaris,
  INDIKATOR_DEFAULT, type BerkasOhlcEmiten, type TitikGaris,
} from '../../lib/dasbor/grafikEmiten'
import { fN } from '../../lib/dasbor/format'
import { pesanGalat } from '../../lib/pesanGalat'
import { IkonMenu, IKON_CARI, IKON_SILANG, IKON_GRAFIK_NAIK, IKON_INFO } from '../../components/dasbor/IkonMenu'
import { useTheme } from '../../context/ThemeContext'
import './GrafikEmiten.css'

const DEFAULT_KODE = 'BBCA'

/** Satu sakelar indikator: kunci state, label layar (dengan periode —
 *  "MA 20" bukan cuma "MA", pembaca tak bisa menebak periodenya), dan token
 *  warna CSS yang dipakai buat garisnya. Dipakai dua tempat: render tombol
 *  sakelar & susun ulang seri chart, supaya keduanya tak bisa tak sinkron. */
const IKS = INDIKATOR_DEFAULT
type KunciIndikator = 'ma20' | 'ma50' | 'ema20' | 'ema50' | 'bb' | 'rsi' | 'macd'
const DAFTAR_INDIKATOR: Array<{ kunci: KunciIndikator; label: string }> = [
  { kunci: 'ma20', label: `MA ${IKS.ma[0]}` },
  { kunci: 'ma50', label: `MA ${IKS.ma[1]}` },
  { kunci: 'ema20', label: `EMA ${IKS.ema[0]}` },
  { kunci: 'ema50', label: `EMA ${IKS.ema[1]}` },
  { kunci: 'bb', label: `BB ${IKS.bollinger.periode}` },
  { kunci: 'rsi', label: `RSI ${IKS.rsi}` },
  { kunci: 'macd', label: `MACD ${IKS.macd.cepat}/${IKS.macd.lambat}/${IKS.macd.sinyal}` },
]
const IND_AWAL: Record<KunciIndikator, boolean> =
  { ma20: false, ma50: false, ema20: false, ema50: false, bb: false, rsi: false, macd: false }

const PANDUAN_INDIKATOR: Array<{ label: string; teks: string }> = [
  { label: `MA ${IKS.ma[0]} / MA ${IKS.ma[1]}`,
    teks: 'Rata-rata harga tutup selama 20/50 hari terakhir, diperbarui tiap hari. Mengikuti arah harga dengan jeda — makin panjang periodenya, makin lambat mengikuti.' },
  { label: `EMA ${IKS.ema[0]} / EMA ${IKS.ema[1]}`,
    teks: 'Sama seperti MA, tapi hari-hari terakhir dibobot lebih berat. Bereaksi lebih cepat ke perubahan harga, juga lebih cepat berbalik saat harga berbalik.' },
  { label: 'Bollinger Bands',
    teks: 'Pita di atas dan bawah rata-rata harga, lebarnya mengikuti seberapa liar harga bergerak belakangan (simpangan baku). Pita melebar saat harga bergejolak, menyempit saat tenang — bukan penanda murah/mahal.' },
  { label: `RSI ${IKS.rsi}`,
    teks: 'Mengukur seberapa cepat harga bergerak belakangan, bukan seberapa murah sahamnya. Bergerak antara 0-100; makin dekat ke ujung, makin cepat pergerakan searah baru-baru ini.' },
  { label: 'MACD',
    teks: 'Selisih dua rata-rata bergerak (EMA cepat dan lambat) beserta garis sinyalnya. Menunjukkan perubahan momentum, bukan level harga — angkanya tak sebanding antar saham berharga beda.' },
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
  const [rentangLabel, setRentangLabel] = useState<string>('1 thn')
  const [ind, setInd] = useState(IND_AWAL)
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
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  // Seri indikator overlay (panel harga, pane 0) — satu ref per garis.
  const ma20Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const ma50Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const ema20Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const ema50Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const bbAtasRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bbTengahRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bbBawahRef = useRef<ISeriesApi<'Line'> | null>(null)
  // Seri RSI/MACD — pane TERPISAH di bawah panel harga (jalur pane native
  // lightweight-charts 5.x, `addSeries(..., paneIndex)` — bukan chart kedua
  // yang sumbu waktunya harus disinkron manual: satu chart, beberapa pane,
  // sumbu waktu otomatis selaras).
  const rsiRef = useRef<ISeriesApi<'Line'> | null>(null)
  const macdRef = useRef<ISeriesApi<'Line'> | null>(null)
  const macdSinyalRef = useRef<ISeriesApi<'Line'> | null>(null)
  const macdHistRef = useRef<ISeriesApi<'Histogram'> | null>(null)

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
      layout: { background: { color: 'transparent' } },
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

  // Nilai mentah tiap indikator, dihitung dari `lilin` — SUDAH tersaring
  // hariTanpaPerdagangan lewat keDataLilinVolume di atas, bukan `berkas.d`
  // mentah, supaya angkanya sama dengan yang benar-benar tergambar di lilin.
  const seriIndikator = useMemo(() => {
    const tutup = lilin.map((l) => l.close)
    const waktu = lilin.map((l) => l.time)
    const bb = hitungBollinger(tutup, IKS.bollinger.periode, IKS.bollinger.k)
    const macd = hitungMACD(tutup, IKS.macd.cepat, IKS.macd.lambat, IKS.macd.sinyal)
    return {
      ma20: keSeriGaris(waktu, hitungMA(tutup, IKS.ma[0])),
      ma50: keSeriGaris(waktu, hitungMA(tutup, IKS.ma[1])),
      ema20: keSeriGaris(waktu, hitungEMA(tutup, IKS.ema[0])),
      ema50: keSeriGaris(waktu, hitungEMA(tutup, IKS.ema[1])),
      bbAtas: keSeriGaris(waktu, bb.atas),
      bbTengah: keSeriGaris(waktu, bb.tengah),
      bbBawah: keSeriGaris(waktu, bb.bawah),
      rsi: keSeriGaris(waktu, hitungRSI(tutup, IKS.rsi)),
      macd: keSeriGaris(waktu, macd.macd),
      macdSinyal: keSeriGaris(waktu, macd.sinyal),
      macdHist: keSeriGaris(waktu, macd.histogram),
    }
  }, [lilin])

  // Peta waktu->nilai per indikator, dipakai legenda (lookup langsung, tak
  // perlu scan array tiap kursor bergeser).
  const petaIndikator = useMemo(() => {
    const peta = (s: TitikGaris[]) => new Map(s.map((p) => [p.time, p.value]))
    return {
      ma20: peta(seriIndikator.ma20), ma50: peta(seriIndikator.ma50),
      ema20: peta(seriIndikator.ema20), ema50: peta(seriIndikator.ema50),
      bbAtas: peta(seriIndikator.bbAtas), bbTengah: peta(seriIndikator.bbTengah), bbBawah: peta(seriIndikator.bbBawah),
      rsi: peta(seriIndikator.rsi), macd: peta(seriIndikator.macd), macdSinyal: peta(seriIndikator.macdSinyal),
    }
  }, [seriIndikator])

  // Susun ulang seluruh seri indikator dari nol tiap kali sakelar/data/tema
  // berubah — jumlahnya kecil (maks 11 seri), jadi diff per-indikator cuma
  // menambah kerumitan tanpa manfaat terukur.
  useEffect(() => {
    const chart = chartRef.current
    const el = containerRef.current
    if (!chart || !el) return
    const cs = getComputedStyle(el)
    const baca = (nama: string, fallback: string) => cs.getPropertyValue(nama).trim() || fallback
    const amber = baca('--amber', '#D9A441')
    const text2 = baca('--text2', '#9AA5B1')
    const text3 = baca('--text3', '#6B7684')
    const green = baca('--green', '#38B77E')
    const red = baca('--red', '#E6635A')

    const buang = <T extends 'Line' | 'Histogram'>(r: React.MutableRefObject<ISeriesApi<T> | null>) => {
      if (r.current) { chart.removeSeries(r.current); r.current = null }
    }
    buang(ma20Ref); buang(ma50Ref); buang(ema20Ref); buang(ema50Ref)
    buang(bbAtasRef); buang(bbTengahRef); buang(bbBawahRef)
    buang(rsiRef); buang(macdRef); buang(macdSinyalRef); buang(macdHistRef)

    const opsiGaris = { lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }
    if (ind.ma20) { ma20Ref.current = chart.addSeries(LineSeries, { ...opsiGaris, color: amber }); ma20Ref.current.setData(seriIndikator.ma20) }
    if (ind.ma50) { ma50Ref.current = chart.addSeries(LineSeries, { ...opsiGaris, color: text2 }); ma50Ref.current.setData(seriIndikator.ma50) }
    if (ind.ema20) { ema20Ref.current = chart.addSeries(LineSeries, { ...opsiGaris, color: green }); ema20Ref.current.setData(seriIndikator.ema20) }
    if (ind.ema50) { ema50Ref.current = chart.addSeries(LineSeries, { ...opsiGaris, color: red }); ema50Ref.current.setData(seriIndikator.ema50) }
    if (ind.bb) {
      bbTengahRef.current = chart.addSeries(LineSeries, { ...opsiGaris, color: text2 })
      bbAtasRef.current = chart.addSeries(LineSeries, { ...opsiGaris, color: text3, lineStyle: LineStyle.Dashed })
      bbBawahRef.current = chart.addSeries(LineSeries, { ...opsiGaris, color: text3, lineStyle: LineStyle.Dashed })
      bbTengahRef.current.setData(seriIndikator.bbTengah)
      bbAtasRef.current.setData(seriIndikator.bbAtas)
      bbBawahRef.current.setData(seriIndikator.bbBawah)
    }

    // RSI & MACD: pane baru di bawah panel harga (pane 0), bukan chart
    // kedua — sumbu waktunya otomatis selaras dengan panel harga karena
    // masih satu chart yang sama.
    let paneBerikut = 1
    if (ind.rsi) {
      rsiRef.current = chart.addSeries(LineSeries, { ...opsiGaris, color: amber }, paneBerikut)
      rsiRef.current.setData(seriIndikator.rsi)
      paneBerikut++
    }
    if (ind.macd) {
      macdHistRef.current = chart.addSeries(
        HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, paneBerikut,
      )
      macdHistRef.current.setData(
        seriIndikator.macdHist.map((p) => ({ ...p, color: p.value >= 0 ? green : red })),
      )
      macdRef.current = chart.addSeries(LineSeries, { ...opsiGaris, color: amber }, paneBerikut)
      macdRef.current.setData(seriIndikator.macd)
      macdSinyalRef.current = chart.addSeries(LineSeries, { ...opsiGaris, color: red }, paneBerikut)
      macdSinyalRef.current.setData(seriIndikator.macdSinyal)
      paneBerikut++
    }

    // Panel harga tetap yang paling besar — tanpa ini pane RSI/MACD sama
    // tingginya dengan panel harga (stretch factor bawaan sama-sama 1).
    const panes = chart.panes()
    panes[0]?.setStretchFactor(3)
    for (let i = 1; i < panes.length; i++) panes[i]?.setStretchFactor(1.1)
  }, [ind, seriIndikator, theme])

  // Legenda: nilai indikator aktif pada titik yang disorot kursor, jatuh
  // balik ke titik TERAKHIR selagi kursor belum digeser ke kanvas.
  const legenda = useMemo(() => {
    const waktu = waktuSorot ?? lilin[lilin.length - 1]?.time ?? null
    if (!waktu) return null
    const v = (peta: Map<string, number>) => { const x = peta.get(waktu); return x === undefined ? '—' : fN(x) }
    const bagian: string[] = []
    if (ind.ma20) bagian.push(`MA ${IKS.ma[0]} ${v(petaIndikator.ma20)}`)
    if (ind.ma50) bagian.push(`MA ${IKS.ma[1]} ${v(petaIndikator.ma50)}`)
    if (ind.ema20) bagian.push(`EMA ${IKS.ema[0]} ${v(petaIndikator.ema20)}`)
    if (ind.ema50) bagian.push(`EMA ${IKS.ema[1]} ${v(petaIndikator.ema50)}`)
    if (ind.bb) bagian.push(`BB ${IKS.bollinger.periode} ${v(petaIndikator.bbAtas)}/${v(petaIndikator.bbTengah)}/${v(petaIndikator.bbBawah)}`)
    if (ind.rsi) bagian.push(`RSI ${IKS.rsi} ${v(petaIndikator.rsi)}`)
    if (ind.macd) bagian.push(`MACD ${v(petaIndikator.macd)} · Sinyal ${v(petaIndikator.macdSinyal)}`)
    return { waktu, teks: bagian.join(' · ') }
  }, [waktuSorot, lilin, ind, petaIndikator])

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

          <div className="grf-ind">
            {DAFTAR_INDIKATOR.map(({ kunci, label }) => (
              <button key={kunci} type="button"
                className={'bchip bchip-klik' + (ind[kunci] ? ' on' : '')}
                onClick={() => setInd((s) => ({ ...s, [kunci]: !s[kunci] }))}>{label}</button>
            ))}
          </div>

          {/* Legenda: nilai indikator AKTIF di titik yang disorot kursor —
              cuma nama indikator tanpa angka tak banyak gunanya (§tahap 4). */}
          {legenda && legenda.teks && (
            <div className="grf-legenda">
              <span className="grf-legenda-tgl">{legenda.waktu}</span>
              <span>{legenda.teks}</span>
            </div>
          )}

          {/* Kanvas SELALU dipasang dengan ukuran final sejak awal (opacity,
              bukan display:none) — lihat komentar .grf-chart-wrap.memuat di
              GrafikEmiten.css: autoSize butuh lebar sungguhan sejak elemen
              dibuat, bukan sejak elemen "muncul". */}
          <div ref={containerRef} className={'grf-chart-wrap' + (berkas ? '' : ' memuat')} />

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
        </div>
      </section>
    </div>
  )
}
