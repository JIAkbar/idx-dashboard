import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TradingViewChart } from '../../components/dasbor/TradingViewChart'
import { IkonMenu, IKON_PERLUAS, IKON_GRAFIK_NAIK, IKON_API } from '../../components/dasbor/IkonMenu'
import { useTheme } from '../../context/ThemeContext'

/** Port TV_GROUPS index_live.html baris 3442-3466 — dua simbol dikoreksi
 * setelah verifikasi ke TradingView (BISNIS27→BISNIS_27, SRIKEHATI→SRI_KEHATI;
 * sumber lama salah ketik, halaman TradingView-nya pakai underscore). */
const TV_GROUPS = {
  featured: [
    { sym: 'IDX:COMPOSITE', label: 'IHSG' },
    { sym: 'IDX:LQ45', label: 'LQ45' },
    { sym: 'IDX:IDX30', label: 'IDX30' },
    { sym: 'IDX:IDX80', label: 'IDX80' },
    { sym: 'IDX:IDXHIDIV20', label: 'High Div20' },
    { sym: 'IDX:IDXBUMN20', label: 'BUMN20' },
    { sym: 'IDX:IDXV30', label: 'Value30' },
    { sym: 'IDX:IDXG30', label: 'Growth30' },
    { sym: 'IDX:IDXQ30', label: 'Quality30' },
  ],
  cobranding: [
    { sym: 'IDX:KOMPAS100', label: 'Kompas100' },
    { sym: 'IDX:BISNIS_27', label: 'Bisnis27' },
    { sym: 'IDX:SRI_KEHATI', label: 'Sri-Kehati' },
    { sym: 'IDX:SMINFRA18', label: 'SMinfra18' },
    { sym: 'IDX:MNC36', label: 'MNC36' },
  ],
  sharia: [
    { sym: 'IDX:ISSI', label: 'ISSI' },
    { sym: 'IDX:JII', label: 'JII' },
    { sym: 'IDX:JII70', label: 'JII70' },
  ],
} as const

const GROUP_LABEL: Record<TvGroup, string> = {
  featured: 'Featured',
  cobranding: 'Co-Branding',
  sharia: 'Syariah',
}

type TvGroup = keyof typeof TV_GROUPS

/** Layar penuh lewat Fullscreen API bawaan peramban, bukan simulasi lewat CSS
 * class + state React. ESC-menutup, ukuran layar telepon, dan urutan tumpuk
 * semua ditangani peramban sendiri — satu-satunya glue yang masih perlu kita
 * tulis ada di .lantai .panel:fullscreen (lantai.css) supaya anak yang tinggi
 * pikselnya tetap (.tv-section-inner) ikut melebar mengisi layar. */
function penuh(ref: React.RefObject<HTMLDivElement | null>) {
  ref.current?.requestFullscreen?.()?.catch(() => {})
}

function keluarPenuh() {
  document.exitFullscreen?.().catch(() => {})
}

/** Tombol Layar Penuh yang jadi tombol Keluar (ikon X, bukan emoji) begitu
 * panel ini yang sedang aktif fullscreen — lihat `fullscreenchange` listener
 * di bawah, biar tetap sinkron kalau user keluar lewat Esc. */
function TombolLayarPenuh({ panelRef, aktif }: { panelRef: React.RefObject<HTMLDivElement | null>; aktif: boolean }) {
  return (
    <button
      className="bchip"
      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
      onClick={() => (aktif ? keluarPenuh() : penuh(panelRef))}
      title={aktif ? 'Keluar layar penuh' : 'Layar penuh'}
    >
      {aktif ? <IkonMenu d="M6 6l12 12M18 6L6 18" size={12} /> : <IkonMenu d={IKON_PERLUAS} size={12} />} {aktif ? 'Keluar Layar Penuh' : 'Layar Penuh'}
    </button>
  )
}

/**
 * Menu Chart — port index_live.html baris 1063-1116 (markup) + 3442-3561 (logic).
 * Dua section SELALU tampil bersamaan (bukan tab): Chart Indeks IDX
 * (TradingView Advanced Chart, ganti grup/simbol) & Heatmap Saham IDX
 * (TradingView embed statis). Masing-masing punya tombol Layar Penuh sendiri.
 */
export function ChartIndeks() {
  const { theme } = useTheme()
  const [searchParams] = useSearchParams()
  const symParam = searchParams.get('sym')
  // Normalisasi ?sym=ekad / ?sym=EKAD.JK / ?sym=IDX:EKAD → IDX:EKAD
  const paramSym = symParam ? `IDX:${symParam.trim().toUpperCase().replace(/^IDX:/, '').replace(/\.JK$/, '')}` : null
  const [grp, setGrp] = useState<TvGroup>('featured')
  const [sym, setSym] = useState<string>(() => paramSym ?? TV_GROUPS.featured[0].sym)

  // Router SPA tidak mereset scroll window antar-rute: klik ticker dari tabel
  // panjang di /stocks membawa offset scroll lama, halaman ini "mendarat" di
  // section heatmap. Reset ke atas tiap mount / ganti ?sym= supaya chart utama
  // langsung terlihat. Sekalian sinkronkan sym kalau ?sym= berubah saat sudah
  // ter-mount (useState initializer cuma jalan sekali).
  useEffect(() => {
    if (paramSym) setSym(paramSym)
    window.scrollTo(0, 0)
  }, [paramSym])
  const heatmapRef = useRef<HTMLDivElement>(null)
  const chartPanelRef = useRef<HTMLDivElement>(null)
  const heatPanelRef = useRef<HTMLDivElement>(null)
  // null = tidak ada panel yang fullscreen. Satu listener dokumen dipakai
  // bersama kedua panel (chart & heatmap) — cukup satu yang bisa fullscreen
  // sekaligus lewat Fullscreen API bawaan peramban.
  const [panelFs, setPanelFs] = useState<Element | null>(null)

  useEffect(() => {
    function onFsChange() {
      setPanelFs(document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // Heatmap widget statis — script embed resmi TradingView cuma jalan kalau
  // <script> benar2 dieksekusi browser (JSX/dangerouslySetInnerHTML tidak
  // mengeksekusi <script>). Container ini murni dikelola imperatif oleh efek
  // (bukan React children). Skip kalau sudah pernah diisi (StrictMode dev
  // memanggil efek 2x tanpa unmount DOM beneran) — dan JANGAN wipe innerHTML
  // di cleanup, karena script TradingView load async dan bisa selesai SETELAH
  // wipe, lalu crash saat dia coba manipulasi DOM yang sudah dikosongkan.
  // Widget TradingView tidak reaktif terhadap tema: container diberi
  // key={theme} di JSX supaya React membuang div lama dan memasang div KOSONG
  // saat tema berganti, lalu efek ini (deps [theme]) mengisi ulang dengan
  // colorTheme baru. Div lama yang detached aman dibiarkan — script async yang
  // telat selesai cuma memanipulasi node detached, bukan DOM hidup.
  useEffect(() => {
    const container = heatmapRef.current
    if (!container || container.childElementCount > 0) return

    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'
    widgetDiv.style.height = '100%'
    widgetDiv.style.width = '100%'

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js'
    script.async = true
    script.text = JSON.stringify({
      dataSource: 'AllID',
      blockSize: 'market_cap_basic',
      blockColor: 'change',
      grouping: 'sector',
      locale: 'id',
      symbolUrl: '',
      colorTheme: theme,
      exchanges: [],
      hasTopBar: false,
      isDataSetEnabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: '100%',
      height: '100%',
    })

    container.appendChild(widgetDiv)
    container.appendChild(script)
    // Tanpa cleanup wipe — lihat komentar di atas efek ini.
  }, [theme])

  function handleSetGroup(g: TvGroup) {
    setGrp(g)
    setSym(TV_GROUPS[g][0].sym)
  }

  return (
    <div className="lantai">
      <div className="panel" ref={chartPanelRef}>
        <div className="panel-h">
          <span className="lbl"><IkonMenu d={IKON_GRAFIK_NAIK} size={13} /> Chart Indeks IDX</span>
          <TombolLayarPenuh panelRef={chartPanelRef} aktif={panelFs !== null && panelFs === chartPanelRef.current} />
        </div>
        <div className="panel-b">
          <div className="tabs" role="tablist" aria-label="Grup Indeks">
            {(Object.keys(TV_GROUPS) as TvGroup[]).map((g) => (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={grp === g}
                className={'tab' + (grp === g ? ' on' : '')}
                onClick={() => handleSetGroup(g)}
              >
                {GROUP_LABEL[g]}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, marginBottom: 10 }}>
            {TV_GROUPS[grp].map(({ sym: s, label }) => {
              const aktif = sym === s
              return (
                <button
                  key={s}
                  type="button"
                  className="bchip"
                  style={aktif ? { borderColor: 'var(--amber)', color: 'var(--amber)', cursor: 'pointer' } : { cursor: 'pointer' }}
                  onClick={() => setSym(s)}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <div className="tv-section-inner" style={{ height: 520, borderRadius: 8, overflow: 'hidden', background: 'var(--bg3)' }}>
            <TradingViewChart symbol={sym} theme={theme} />
          </div>
        </div>
      </div>

      <div className="panel" ref={heatPanelRef}>
        <div className="panel-h">
          <span className="lbl"><IkonMenu d={IKON_API} size={13} /> Heatmap Saham IDX</span>
          <TombolLayarPenuh panelRef={heatPanelRef} aktif={panelFs !== null && panelFs === heatPanelRef.current} />
        </div>
        <div className="panel-b">
          <div className="tv-section-inner" style={{ height: 400, borderRadius: 8, overflow: 'hidden' }}>
            <div key={theme} className="tradingview-widget-container" style={{ height: '100%', width: '100%' }} ref={heatmapRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
