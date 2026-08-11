import { useCallback, useMemo, useState } from 'react'
import { GrafikJaringan } from '../../components/dasbor/GrafikJaringan'
import { getInvestorMap, usePetaInvestor, type GraphSelection, type InvestorMapEntry } from '../../lib/dasbor/petaInvestorData'
import { ByStock } from './peta-investor/ByStock'
import { ByInvestor } from './peta-investor/ByInvestor'
import { DetailPanel } from './peta-investor/DetailPanel'
import { PetaInvestorSearch } from './peta-investor/PetaInvestorSearch'

type ViewTab = 'grafik' | 'stock' | 'investor'

const DEFAULT_NODE_COUNT = 10
const INVESTOR_FOCUS_LIMIT = 60

/**
 * Panel "Peta Investor" — network graph kepemilikan saham IDX. Port markup
 * baris 2219-2369 + piInit/piSwitchView/piClickNode index_live.html
 * baris 4452-5141. Klik node graf, baris tabel By Stock/By Investor, atau
 * hasil pencarian semua lewat satu handleSelect (bukan pindah halaman —
 * semua switch ke sub-view Grafik Jaringan ter-fokus).
 */
export function PetaInvestor() {
  const { data, loading, error, retry } = usePetaInvestor()
  const [activeView, setActiveView] = useState<ViewTab>('grafik')
  const [searchValue, setSearchValue] = useState('')
  const [focusCode, setFocusCode] = useState<string | null>(null)
  /** Override daftar node graf umum saat investor diklik (portofolionya, s.d. 60 emiten). null = pakai default (10 emiten pertama). */
  const [investorFocusList, setInvestorFocusList] = useState<InvestorMapEntry[] | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<GraphSelection | null>(null)

  const defaultEmitenList = useMemo(() => (data ? data.slice(0, DEFAULT_NODE_COUNT) : []), [data])
  const emitenList = investorFocusList ?? defaultEmitenList
  const investorMap = useMemo(() => (data ? getInvestorMap(data) : []), [data])

  const handleSelect = useCallback(
    (sel: GraphSelection | null) => {
      if (!sel) {
        setSelectedDetail(null)
        return
      }
      setSelectedDetail(sel)
      setActiveView('grafik')
      if (sel.type === 'emiten') {
        setSearchValue(sel.code)
        setFocusCode(sel.code)
      } else {
        setSearchValue(sel.name.slice(0, 30))
        setFocusCode(null)
        if (data) {
          const theirs = data.filter((e) => e.holders.some((h) => h.name === sel.name)).slice(0, INVESTOR_FOCUS_LIMIT)
          setInvestorFocusList(theirs)
        }
      }
    },
    [data],
  )

  const handleClear = useCallback(() => {
    setSearchValue('')
    setFocusCode(null)
    setSelectedDetail(null)
    setInvestorFocusList(null)
  }, [])

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18 }}>🕸️</span>
          <div>
            <div className="ct b">Peta Investor — Kepemilikan Saham IDX</div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>
              Data KSEI · Pemegang saham ≥1% · {data?.length ?? 0} emiten
            </div>
          </div>
          {data && (
            <PetaInvestorSearch data={data} value={searchValue} onChange={setSearchValue} onSelect={handleSelect} onClear={handleClear} />
          )}
        </div>
      </div>

      {loading && (
        <div className="fd-empty">
          <p style={{ fontSize: 28 }}>⏳</p>
          <p>Memuat data jaringan investor...</p>
        </div>
      )}

      {!loading && error && (
        <div className="fd-empty">
          <p style={{ fontSize: 28 }}>⚠️</p>
          <p>Gagal memuat data investor.</p>
          <p style={{ fontSize: 11, marginTop: 4 }}>{error}</p>
          <button
            type="button"
            className="pi-search-go"
            style={{ marginTop: 12 }}
            onClick={retry}
          >
            🔄 Coba lagi
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="pi-view-tabs">
            <button type="button" className={`pi-view-tab${activeView === 'grafik' ? ' active' : ''}`} onClick={() => setActiveView('grafik')}>🕸️ Grafik Jaringan</button>
            <button type="button" className={`pi-view-tab${activeView === 'stock' ? ' active' : ''}`} onClick={() => setActiveView('stock')}>📋 By Stock</button>
            <button type="button" className={`pi-view-tab${activeView === 'investor' ? ' active' : ''}`} onClick={() => setActiveView('investor')}>👤 By Investor</button>
          </div>

          {activeView === 'grafik' && (
            <>
              <div className="card pi-legend">
                <span className="pi-legend-title">Legenda:</span>
                <span><span className="pi-legend-dot" style={{ background: '#f97316' }} />Emiten</span>
                <span><span className="pi-legend-dot" style={{ background: '#3b82f6' }} />Institusi Domestik</span>
                <span><span className="pi-legend-dot" style={{ background: '#a855f7', borderRadius: 4 }} />Institusi Asing</span>
                <span><span className="pi-legend-dot" style={{ background: '#22c55e' }} />Individu Lokal</span>
                <span><span className="pi-legend-dot" style={{ background: '#ec4899' }} />Individu Asing</span>
                <span className="pi-legend-hint">Ukuran node = % kepemilikan · 👆 Klik node untuk detail</span>
              </div>
              <div className="card pi-graph-card">
                <GrafikJaringan allData={data} emitenList={emitenList} focusCode={focusCode} onSelect={handleSelect} />
                {selectedDetail && <DetailPanel allData={data} selected={selectedDetail} onClose={() => setSelectedDetail(null)} />}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 8, textAlign: 'center' }}>
                Data bersumber dari KSEI (Kustodian Sentral Efek Indonesia) · Kepemilikan ≥1% · Bukan saran investasi
              </div>
            </>
          )}

          {activeView === 'stock' && <ByStock data={data} onSelect={handleSelect} />}
          {activeView === 'investor' && <ByInvestor investorMap={investorMap} onSelect={handleSelect} />}
        </>
      )}
    </div>
  )
}
