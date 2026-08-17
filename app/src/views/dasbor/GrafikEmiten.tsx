import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createChart, CandlestickSeries, HistogramSeries, LineSeries, LineStyle,
  type IChartApi, type ISeriesApi, type MouseEventParams, type SeriesType, type Time,
} from 'lightweight-charts'
import { useKamusEmiten } from '../../lib/dasbor/kamusEmiten'
import {
  keDataLilinVolume, batasBawahRentang, potongRentang, RENTANG_GRAFIK, RENTANG_BAWAAN,
  keSeriGaris, SPEK_INDIKATOR, buatInstans, galatInstans, labelInstansIndikator, hitungInstans,
  type BerkasOhlcEmiten, type InstansIndikator, type JenisIndikator, type SpekParam,
} from '../../lib/dasbor/grafikEmiten'
import { Dropdown } from '../../components/dasbor/Dropdown'
import { fN } from '../../lib/dasbor/format'
import { pesanGalat } from '../../lib/pesanGalat'
import {
  IkonMenu, IKON_CARI, IKON_SILANG, IKON_GRAFIK_NAIK, IKON_INFO,
  IKON_MATA, IKON_MATA_CORET, IKON_TONG,
} from '../../components/dasbor/IkonMenu'
import { useTheme } from '../../context/ThemeContext'
import './GrafikEmiten.css'

const DEFAULT_KODE = 'BBCA'

/** Pilihan dropdown "Indikator" — diturunkan dari SPEK_INDIKATOR, bukan
 *  daftar kedua yang ditulis tangan: jenis baru cukup didaftarkan di spek
 *  dan langsung muncul di menu. */
const OPSI_INDIKATOR = (Object.keys(SPEK_INDIKATOR) as JenisIndikator[])
  .map((jenis) => ({ nilai: jenis, label: SPEK_INDIKATOR[jenis].label }))

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

/** Kunci gabungan id instans + nama ruas, dipakai menyimpan TEKS yang sedang
 *  diketik (lihat `paramTeks` di komponen). */
const kunciTeks = (id: string, kunci: string) => `${id}:${kunci}`

/** Id instans baru. `crypto.randomUUID` ada di seluruh peramban yang
 *  didukung; jam + acak sebagai jaring pengaman kalau halaman dibuka lewat
 *  konteks tak-aman (http polos), di mana API itu tak tersedia. */
function idBaru(): string {
  return globalThis.crypto?.randomUUID?.() ?? `i${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
  // Indikator bukan lagi sakelar nyala/mati tapi DAFTAR instans — lihat
  // `InstansIndikator` di grafikEmiten.ts.
  const [indikator, setIndikator] = useState<InstansIndikator[]>([])
  // Teks yang sedang DIKETIK di kolom parameter, terpisah dari angka yang
  // sudah tersimpan di instans. Perlu dipisah karena kolom teks sempat
  // melewati keadaan tak sah di tengah pengetikan (kosong, "2." , "-") dan
  // angka di instans tak boleh ikut melewatinya: yang tergambar selalu nilai
  // sah terakhir, sementara kolomnya menampilkan apa adanya + alasan tolakan.
  const [paramTeks, setParamTeks] = useState<Record<string, string>>({})
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
  // Seri indikator. Dulu satu ref per garis; sekarang jumlahnya mengikuti
  // jumlah instans (tak terbatas), jadi disimpan sebagai daftar dan dibongkar
  // seluruhnya tiap kali disusun ulang. RSI/MACD tetap dapat pane TERPISAH di
  // bawah panel harga (jalur pane native lightweight-charts 5.x,
  // `addSeries(..., paneIndex)` — bukan chart kedua yang sumbu waktunya harus
  // disinkron manual: satu chart, beberapa pane, sumbu waktu otomatis selaras).
  const seriIndRef = useRef<Array<ISeriesApi<SeriesType>>>([])

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

  // Deret tiap instans, dihitung dari `lilin` — SUDAH tersaring
  // hariTanpaPerdagangan lewat keDataLilinVolume di atas, bukan `berkas.d`
  // mentah, supaya angkanya sama dengan yang benar-benar tergambar di lilin.
  // Satu memo dipakai dua pembaca (penggambar seri & legenda) supaya angka
  // yang tergambar dan angka yang terbaca mustahil berbeda.
  const garisPerInstans = useMemo(() => {
    const tutup = lilin.map((l) => l.close)
    const waktu = lilin.map((l) => l.time)
    return indikator.map((inst) => ({
      inst,
      garis: hitungInstans(inst, tutup).map((g) => ({ ...g, seri: keSeriGaris(waktu, g.nilai) })),
    }))
  }, [indikator, lilin])

  // Peta waktu->nilai per garis, dipakai legenda (lookup langsung, tak perlu
  // scan array tiap kursor bergeser). Histogram tak masuk legenda — angkanya
  // cuma selisih dua garis yang sudah tertulis di sebelahnya.
  const petaLegenda = useMemo(() => garisPerInstans.map(({ inst, garis }) => ({
    inst,
    peta: garis.filter((g) => !g.histogram).map((g) => new Map(g.seri.map((p) => [p.time, p.value]))),
  })), [garisPerInstans])

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
    let paneBerikut = 1
    for (const { inst, garis } of garisPerInstans) {
      if (!inst.tampil) continue
      const spek = SPEK_INDIKATOR[inst.jenis]
      const pane = spek.diPanelHarga ? 0 : paneBerikut++
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
  }, [garisPerInstans, theme])

  // Legenda: satu baris per instans yang tampil, menyebut parameternya
  // ("MA 200", bukan "MA"), pada titik yang disorot kursor — jatuh balik ke
  // titik TERAKHIR selagi kursor belum digeser ke kanvas.
  const legenda = useMemo(() => {
    const waktu = waktuSorot ?? lilin[lilin.length - 1]?.time ?? null
    if (!waktu) return null
    const baris = petaLegenda
      .filter(({ inst }) => inst.tampil)
      .map(({ inst, peta }) => ({
        id: inst.id,
        warna: inst.warna,
        label: labelInstansIndikator(inst),
        nilai: peta.map((p) => { const x = p.get(waktu); return x === undefined ? '—' : fN(x) }).join(' / '),
      }))
    return { waktu, baris }
  }, [waktuSorot, lilin, petaLegenda])

  /* ---------------- Kelola daftar instans indikator ---------------- */

  const tambahIndikator = useCallback((jenis: string) => {
    setIndikator((list) => [
      ...list,
      buatInstans(jenis as JenisIndikator, SPEK_INDIKATOR[jenis as JenisIndikator].param, idBaru(), list.length),
    ])
  }, [])

  const hapusIndikator = useCallback((id: string) => {
    setIndikator((list) => list.filter((x) => x.id !== id))
    // Teks yang sedang diketik untuk instans yang sudah tak ada ikut dibuang,
    // kalau tidak ia akan menempel pada instans baru yang kebetulan sama id-nya.
    setParamTeks((t) => Object.fromEntries(Object.entries(t).filter(([k]) => !k.startsWith(`${id}:`))))
  }, [])

  const sakelarTampil = useCallback((id: string) => {
    setIndikator((list) => list.map((x) => (x.id === id ? { ...x, tampil: !x.tampil } : x)))
  }, [])

  /** Teks yang harus TERLIHAT di kolom: yang sedang diketik kalau ada, kalau
   *  tidak angka yang tersimpan di instans. */
  const teksInstans = useCallback(
    (inst: InstansIndikator, param: SpekParam[]): Record<string, string> => Object.fromEntries(
      param.map((s) => [s.kunci, paramTeks[kunciTeks(inst.id, s.kunci)] ?? String(inst.param[s.kunci])]),
    ),
    [paramTeks],
  )

  const galatPerInstans = useMemo(() => {
    const peta: Record<string, Record<string, string>> = {}
    for (const inst of indikator) {
      const param = SPEK_INDIKATOR[inst.jenis].param
      peta[inst.id] = galatInstans(param, teksInstans(inst, param), lilin.length)
    }
    return peta
  }, [indikator, teksInstans, lilin.length])

  /** Ganti satu ruas parameter. Teksnya SELALU tersimpan (kalau tidak, kolom
   *  tak bisa diketik sampai selesai); angkanya cuma ikut berubah kalau lolos
   *  validasi — masukan yang ditolak membiarkan garis lama tetap tergambar
   *  alih-alih menggantinya dengan NaN yang lenyap tanpa galat. */
  const gantiParam = useCallback((inst: InstansIndikator, spek: SpekParam, nilai: string) => {
    setParamTeks((t) => ({ ...t, [kunciTeks(inst.id, spek.kunci)]: nilai }))
    const param = SPEK_INDIKATOR[inst.jenis].param
    const galat = galatInstans(param, { ...teksInstans(inst, param), [spek.kunci]: nilai }, lilin.length)
    if (galat[spek.kunci]) return
    setIndikator((list) => list.map(
      (x) => (x.id === inst.id ? { ...x, param: { ...x.param, [spek.kunci]: Number(nilai) } } : x),
    ))
  }, [teksInstans, lilin.length])

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

          {/* Dropdown "Indikator" (bukan deretan tombol seperti sebelumnya):
              memilih jenis MENAMBAH satu instans baru, tak menyalakan sakelar.
              Karena itu `nilai` sengaja dibiarkan kosong — tak ada jenis yang
              "terpilih", yang ada cuma daftar instans di bawahnya. */}
          <div className="grf-ind">
            <Dropdown opsi={OPSI_INDIKATOR} nilai="" placeholder="+ Indikator"
              ariaLabel="Tambah indikator" onGanti={tambahIndikator} />
          </div>

          {indikator.length > 0 && (
            <ul className="grf-ind-daftar">
              {indikator.map((inst) => {
                const spek = SPEK_INDIKATOR[inst.jenis]
                const teks = teksInstans(inst, spek.param)
                const galat = galatPerInstans[inst.id] ?? {}
                return (
                  <li key={inst.id} className={'grf-ind-baris' + (inst.tampil ? '' : ' redup')}
                    style={{ '--ind-warna': `var(${inst.warna})` } as React.CSSProperties}>
                    <span className="grf-ind-warna" aria-hidden="true" />
                    <span className="grf-ind-nama">{labelInstansIndikator(inst)}</span>
                    {spek.param.map((s) => (
                      <label key={s.kunci} className="grf-ind-param">
                        <span className="grf-ind-param-lbl">{s.label}</span>
                        <input className={'inp grf-ind-inp' + (galat[s.kunci] ? ' salah' : '')}
                          inputMode="decimal" value={teks[s.kunci]}
                          aria-invalid={galat[s.kunci] ? true : undefined}
                          aria-label={`${s.label} ${labelInstansIndikator(inst)}`}
                          onChange={(e) => gantiParam(inst, s, e.target.value)} />
                      </label>
                    ))}
                    <button type="button" className="bchip bchip-klik grf-ind-aksi"
                      aria-pressed={inst.tampil}
                      title={inst.tampil ? 'Sembunyikan sementara' : 'Tampilkan lagi'}
                      onClick={() => sakelarTampil(inst.id)}>
                      <IkonMenu d={inst.tampil ? IKON_MATA : IKON_MATA_CORET} size={12} />
                    </button>
                    <button type="button" className="bchip bchip-klik grf-ind-aksi"
                      title={`Hapus ${labelInstansIndikator(inst)}`}
                      onClick={() => hapusIndikator(inst.id)}>
                      <IkonMenu d={IKON_TONG} size={12} />
                    </button>
                    {/* Alasan tolakan ditulis DI BARIS ITU SENDIRI, bukan di
                        satu kotak galat bersama: dengan beberapa instans hidup
                        bersamaan, pesan yang menggantung jauh dari kolomnya tak
                        memberi tahu kolom mana yang harus diperbaiki. */}
                    {Object.entries(galat).map(([kunci, pesan]) => (
                      <p key={kunci} className="grf-ind-galat">
                        {spek.param.find((s) => s.kunci === kunci)?.label}: {pesan}
                      </p>
                    ))}
                  </li>
                )
              })}
            </ul>
          )}

          {/* Legenda: satu baris per instans yang tampil, di titik yang
              disorot kursor — cuma nama indikator tanpa angka tak banyak
              gunanya (§tahap 4). */}
          {legenda && legenda.baris.length > 0 && (
            <div className="grf-legenda">
              <span className="grf-legenda-tgl">{legenda.waktu}</span>
              {legenda.baris.map((b) => (
                <span key={b.id} className="grf-legenda-it"
                  style={{ '--ind-warna': `var(${b.warna})` } as React.CSSProperties}>
                  {b.label} {b.nilai}
                </span>
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
          <div className="grf-kanvas-bungkus">
            {/* Kanvas SELALU dipasang dengan ukuran final sejak awal (opacity,
                bukan display:none) — lihat komentar .grf-chart-wrap.memuat di
                GrafikEmiten.css: autoSize butuh lebar sungguhan sejak elemen
                dibuat, bukan sejak elemen "muncul". */}
            <div ref={containerRef} className={'grf-chart-wrap' + (berkas ? '' : ' memuat')} />
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
        </div>
      </section>
    </div>
  )
}
