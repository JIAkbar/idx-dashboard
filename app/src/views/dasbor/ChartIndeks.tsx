import { useEffect, useRef, useState } from 'react'
import { TradingViewChart } from '../../components/dasbor/TradingViewChart'
import { useTheme } from '../../context/ThemeContext'

/** Port TV_GROUPS index_live.html baris 3442-3466 — salin persis. */
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
    { sym: 'IDX:BISNIS27', label: 'Bisnis27' },
    { sym: 'IDX:SRIKEHATI', label: 'Sri-Kehati' },
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
type ExpandedSection = 'chart' | 'heatmap' | null

const CLOSE_BTN_STYLE = {
  background: 'var(--red-bg)',
  color: 'var(--red-txt)',
  border: '0.5px solid var(--red)',
  borderRadius: 5,
  padding: '4px 12px',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
} as const

/**
 * Menu Chart — port index_live.html baris 1063-1116 (markup) + 3442-3561 (logic).
 * Dua section SELALU tampil bersamaan (bukan tab): Chart Indeks IDX
 * (TradingView Advanced Chart, ganti grup/simbol) & Heatmap Saham IDX
 * (TradingView embed statis). Masing-masing punya expand/collapse fullscreen sendiri.
 */
export function ChartIndeks() {
  const { theme } = useTheme()
  const [grp, setGrp] = useState<TvGroup>('featured')
  const [sym, setSym] = useState<string>(TV_GROUPS.featured[0].sym)
  const [expanded, setExpanded] = useState<ExpandedSection>(null)
  const heatmapRef = useRef<HTMLDivElement>(null)

  // ESC menutup fullscreen — port tvExpand() addEventListener('keydown', ...) baris 3497-3499.
  useEffect(() => {
    if (!expanded) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setExpanded(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [expanded])

  // Heatmap widget statis — script embed resmi TradingView cuma jalan kalau
  // <script> benar2 dieksekusi browser (JSX/dangerouslySetInnerHTML tidak
  // mengeksekusi <script>). Container ini murni dikelola imperatif oleh efek
  // (bukan React children). Skip kalau sudah pernah diisi (StrictMode dev
  // memanggil efek 2x tanpa unmount DOM beneran) — dan JANGAN wipe innerHTML
  // di cleanup, karena script TradingView load async dan bisa selesai SETELAH
  // wipe, lalu crash saat dia coba manipulasi DOM yang sudah dikosongkan.
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
      colorTheme: 'dark',
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
  }, [])

  function handleSetGroup(g: TvGroup) {
    setGrp(g)
    setSym(TV_GROUPS[g][0].sym)
  }

  // Mobile: tinggi eksplisit saat fullscreen agar menutup bottom nav bar —
  // port tvExpand() baris 3494.
  const mobileFsHeight = window.innerWidth <= 768 ? window.innerHeight : undefined

  return (
    <>
      <div
        className={`card${expanded === 'chart' ? ' tv-fullscreen' : ''}`}
        style={{
          padding: 12,
          marginBottom: 12,
          position: 'relative',
          ...(expanded === 'chart' && mobileFsHeight ? { height: mobileFsHeight } : {}),
        }}
      >
        <div className="tv-fs-bar">
          <span className="tv-fs-title">📈 Chart Indeks IDX</span>
          <button style={CLOSE_BTN_STYLE} onClick={() => setExpanded(null)}>✕ Tutup</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8, alignItems: 'center' }}>
          <div className="tv-group-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: 1 }}>
            {(Object.keys(TV_GROUPS) as TvGroup[]).map((g) => (
              <button
                key={g}
                className={`tv-grp-btn${grp === g ? ' active' : ''}`}
                onClick={() => handleSetGroup(g)}
              >
                {GROUP_LABEL[g]}
              </button>
            ))}
          </div>
          <button className="tv-expand-btn" title="Expand fullscreen" onClick={() => setExpanded('chart')}>
            ⛶ Expand
          </button>
        </div>
        <div className="tv-sym-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {TV_GROUPS[grp].map(({ sym: s, label }) => (
            <button
              key={s}
              className={`tv-sym-btn${sym === s ? ' active' : ''}`}
              onClick={() => setSym(s)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="tv-section-inner" style={{ height: 520, borderRadius: 8, overflow: 'hidden', background: 'var(--bg3)' }}>
          <TradingViewChart symbol={sym} theme={theme} />
        </div>
      </div>

      <div
        className={`card${expanded === 'heatmap' ? ' tv-fullscreen' : ''}`}
        style={{
          padding: 12,
          position: 'relative',
          ...(expanded === 'heatmap' && mobileFsHeight ? { height: mobileFsHeight } : {}),
        }}
      >
        <div className="tv-fs-bar">
          <span className="tv-fs-title">🔥 Heatmap Saham IDX</span>
          <button style={CLOSE_BTN_STYLE} onClick={() => setExpanded(null)}>✕ Tutup</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span className="tv-norm-title" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            🔥 Heatmap Saham IDX
          </span>
          <button className="tv-expand-btn" title="Expand fullscreen" onClick={() => setExpanded('heatmap')}>
            ⛶ Expand
          </button>
        </div>
        <div className="tv-section-inner" style={{ height: 400, borderRadius: 8, overflow: 'hidden' }}>
          <div className="tradingview-widget-container" style={{ height: '100%', width: '100%' }} ref={heatmapRef} />
        </div>
      </div>
    </>
  )
}
