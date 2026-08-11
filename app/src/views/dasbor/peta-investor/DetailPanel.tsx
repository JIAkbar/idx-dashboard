import { holderType, type GraphSelection, type InvestorMapEntry } from '../../../lib/dasbor/petaInvestorData'

interface DetailPanelProps {
  allData: InvestorMapEntry[]
  selected: GraphSelection
  onClose: () => void
}

const TYPE_LABEL: Record<'CORP' | 'IND' | 'OTH', string> = { CORP: 'CORPORATE', IND: 'INDIVIDUAL', OTH: 'TIPE TAK TERISI' }
/* TYPE_COLOR lama (#60a5fa/#4ade80/#a78bfa) dan warna bendera lokal/asing
   (#818cf8/#34d399) dibuang: hijau dikunci untuk arah angka, dan tiga warna
   kategori di panel ini bertabrakan dengan palet graf yang sekarang cuma satu
   aksen. Kedua badge jadi .bchip netral — teksnya sudah menyebutkan kategori. */
const PCT_CLR = 'var(--amber)'

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
            <div className="pi-panel-title" style={{ color: 'var(--amber)' }}>{em.code}</div>
            <div className="pi-panel-sub">{em.issuer}</div>
          </div>
          <button type="button" className="pi-panel-close" onClick={onClose}>×</button>
        </div>
        <div className="pi-panel-body">
          <div className="pi-panel-section-label">IDX 1% SHAREHOLDERS</div>
          {em.holders.map((h) => (
            <div className="pi-panel-row" key={h.name}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="pi-panel-row-name">{h.name}</div>
                <div className="pi-panel-row-badges">
                  <span className="bchip">{TYPE_LABEL[holderType(h.cls)]}</span>
                  <span className="bchip">{h.lf === 'F' ? 'ASING' : 'LOKAL'}</span>
                </div>
              </div>
              <div className="pi-panel-row-pct num" style={{ color: PCT_CLR }}>{h.pct}%</div>
            </div>
          ))}
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
            <span className="bchip" style={{ marginRight: 0 }}>{h.code}</span>
            <div className="pi-panel-row-issuer" title={h.issuer}>{h.issuer}</div>
            <div className="pi-panel-row-pct num" style={{ color: PCT_CLR }}>{h.pct}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}
