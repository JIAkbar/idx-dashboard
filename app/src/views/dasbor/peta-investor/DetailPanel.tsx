import { holderType, type GraphSelection, type InvestorMapEntry } from '../../../lib/dasbor/petaInvestorData'

interface DetailPanelProps {
  allData: InvestorMapEntry[]
  selected: GraphSelection
  onClose: () => void
}

const TYPE_COLOR: Record<'CORP' | 'IND' | 'OTH', string> = { CORP: '#60a5fa', IND: '#4ade80', OTH: '#a78bfa' }
const TYPE_LABEL: Record<'CORP' | 'IND' | 'OTH', string> = { CORP: 'CORPORATE', IND: 'INDIVIDUAL', OTH: 'OTHER' }
const PCT_CLR = '#fbbf24'

/** Panel detail di sisi kanan graf (desktop) / bawah (mobile). Port piShowPanel() index_live.html baris 162-231, sebagai JSX bukan string-innerHTML. */
export function DetailPanel({ allData, selected, onClose }: DetailPanelProps) {
  if (selected.type === 'emiten') {
    const em = allData.find((x) => x.code === selected.code)
    if (!em) return null
    return (
      <div className="pi-panel">
        <div className="pi-panel-head">
          <div>
            <div className="pi-panel-eyebrow">EMITEN</div>
            <div className="pi-panel-title" style={{ color: '#f97316' }}>{em.code}</div>
            <div className="pi-panel-sub">{em.issuer}</div>
          </div>
          <button type="button" className="pi-panel-close" onClick={onClose}>×</button>
        </div>
        <div className="pi-panel-body">
          <div className="pi-panel-section-label">IDX 1% SHAREHOLDERS</div>
          {em.holders.map((h) => {
            const type = holderType(h.cls)
            const flag = h.lf === 'F' ? 'ASING' : 'LOKAL'
            const flagClr = h.lf === 'F' ? '#818cf8' : '#34d399'
            return (
              <div className="pi-panel-row" key={h.name}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="pi-panel-row-name">{h.name}</div>
                  <div className="pi-panel-row-badges">
                    <span className="pi-panel-chip" style={{ color: TYPE_COLOR[type], background: `${TYPE_COLOR[type]}22` }}>{TYPE_LABEL[type]}</span>
                    <span className="pi-panel-chip" style={{ color: flagClr, background: `${flagClr}22` }}>{flag}</span>
                  </div>
                </div>
                <div className="pi-panel-row-pct" style={{ color: PCT_CLR }}>{h.pct}%</div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const holdings = allData
    .filter((e) => e.holders.some((h) => h.name === selected.name))
    .map((e) => ({ code: e.code, issuer: e.issuer, pct: e.holders.find((h) => h.name === selected.name)?.pct ?? 0 }))
    .sort((a, b) => b.pct - a.pct)
  const flag = selected.lf === 'F' ? '🌐 Asing' : '🇮🇩 Domestik'

  return (
    <div className="pi-panel">
      <div className="pi-panel-head">
        <div>
          <div className="pi-panel-eyebrow">INVESTOR</div>
          <div className="pi-panel-title">{selected.name}</div>
          <div className="pi-panel-sub">{selected.cls || '—'} · {flag}</div>
        </div>
        <button type="button" className="pi-panel-close" onClick={onClose}>×</button>
      </div>
      <div className="pi-panel-body">
        <div className="pi-panel-section-label">PORTOFOLIO SAHAM ({holdings.length} emiten)</div>
        {holdings.map((h) => (
          <div className="pi-panel-row" key={h.code}>
            <span className="pi-panel-code-chip">{h.code}</span>
            <div className="pi-panel-row-issuer" title={h.issuer}>{h.issuer}</div>
            <div className="pi-panel-row-pct" style={{ color: PCT_CLR }}>{h.pct}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}
