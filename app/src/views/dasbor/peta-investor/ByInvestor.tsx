import { useEffect, useMemo, useState } from 'react'
import type { GraphSelection, InvestorRow } from '../../../lib/dasbor/petaInvestorData'

interface ByInvestorProps {
  investorMap: InvestorRow[]
  onSelect: (sel: GraphSelection) => void
}

const PAGE = 20
const TYPE_OPTIONS: { value: '' | 'CORP' | 'IND' | 'OTH'; label: string }[] = [
  { value: '', label: 'Semua Tipe' },
  { value: 'CORP', label: 'Institusi (CORP)' },
  { value: 'IND', label: 'Individu (IND)' },
  { value: 'OTH', label: 'Lainnya (OTH)' },
]

/** Tabel "Investor & Portfolio Saham" — dedup dari seluruh holders, render sebagian + "Tampilkan N lagi". Port piRenderInvestor/piFilterInvestor/piInvRow index_live.html baris 384-441. */
export function ByInvestor({ investorMap, onSelect }: ByInvestorProps) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | 'CORP' | 'IND' | 'OTH'>('')
  const [visibleCount, setVisibleCount] = useState(PAGE)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = q
      ? investorMap.filter(
          (inv) =>
            inv.name.toLowerCase().includes(q) ||
            inv.holdings.some((h) => h.code.toLowerCase().includes(q) || h.issuer.toLowerCase().includes(q)),
        )
      : investorMap
    if (typeFilter) list = list.filter((inv) => inv.type === typeFilter)
    return list
  }, [investorMap, query, typeFilter])

  useEffect(() => setVisibleCount(PAGE), [rows])

  const visible = rows.slice(0, visibleCount)
  const remaining = rows.length - visibleCount

  return (
    <div>
      <div className="card pi-tbl-toolbar">
        <span className="pi-tbl-toolbar-title">👤 Investor &amp; Portfolio Saham</span>
        <input
          className="pi-tbl-search"
          placeholder="Cari nama investor..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="pi-tbl-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}>
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span className="pi-tbl-count">{rows.length} investor</span>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="pi-tbl-wrap">
          <table className="pi-tbl">
            <thead>
              <tr>
                <th style={{ width: 260 }}>Investor / Pemegang Saham</th>
                <th style={{ width: 80, textAlign: 'center' }}>Tipe</th>
                <th style={{ width: 70, textAlign: 'center' }}># Saham</th>
                <th>Saham yang Dipegang</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((inv) => {
                const shown = inv.holdings.slice(0, 6)
                const extra = inv.holdings.length - 6
                return (
                  <tr key={inv.name} onClick={() => onSelect({ type: 'investor', name: inv.name, cls: inv.cls, lf: inv.lf })} title="Klik untuk lihat di Grafik Jaringan">
                    <td>
                      <div className="pi-inv-name">{inv.name.length > 40 ? `${inv.name.slice(0, 38)}…` : inv.name}</div>
                      <div className="em-name">{inv.lf === 'F' ? '🌐 Asing' : '🇮🇩 Domestik'}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}><span className={`pi-badge-h ${inv.type}`}>{inv.type}</span></td>
                    <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>{inv.holdings.length}</td>
                    <td>
                      <div className="pi-holder-list">
                        {shown.map((h) => (
                          <span key={h.code} className="pi-badge-h EM" title={`${h.issuer}: ${h.pct.toFixed(2)}%`}>
                            {h.code} <span style={{ opacity: 0.65 }}>{h.pct.toFixed(1)}%</span>
                          </span>
                        ))}
                        {extra > 0 && <span className="pi-badge-more">+{extra} lagi</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {remaining > 0 && (
            <div style={{ textAlign: 'center', padding: 10 }}>
              <button type="button" className="pi-loadmore" onClick={() => setVisibleCount((v) => v + PAGE)}>
                Tampilkan {Math.min(remaining, PAGE)} lagi (sisa {remaining})
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
