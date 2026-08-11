import { useEffect, useMemo, useState } from 'react'
import { holderType, type GraphSelection, type InvestorMapEntry } from '../../../lib/dasbor/petaInvestorData'

interface ByStockProps {
  data: InvestorMapEntry[]
  onSelect: (sel: GraphSelection) => void
}

const PAGE = 20
const TYPE_OPTIONS: { value: '' | 'CORP' | 'IND' | 'OTH'; label: string }[] = [
  { value: '', label: 'Semua Tipe Holder' },
  { value: 'CORP', label: 'Institusi (CORP)' },
  { value: 'IND', label: 'Individu (IND)' },
  { value: 'OTH', label: 'Lainnya (OTH)' },
]

function sumPct(em: InvestorMapEntry, type: 'CORP' | 'IND' | 'OTH'): number {
  return em.holders.filter((h) => holderType(h.cls) === type).reduce((s, h) => s + h.pct, 0)
}

/** Tabel "Emiten & Pemegang Saham >=1%" — 952 baris, render sebagian + "Tampilkan N lagi". Port piRenderStock/piFilterStock/piStockRow index_live.html baris 320-383. */
export function ByStock({ data, onSelect }: ByStockProps) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | 'CORP' | 'IND' | 'OTH'>('')
  const [visibleCount, setVisibleCount] = useState(PAGE)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = q
      ? data.filter(
          (em) =>
            em.code.toLowerCase().includes(q) ||
            em.issuer.toLowerCase().includes(q) ||
            em.holders.some((h) => h.name.toLowerCase().includes(q)),
        )
      : data
    if (typeFilter) list = list.filter((em) => em.holders.some((h) => holderType(h.cls) === typeFilter))
    return list
  }, [data, query, typeFilter])

  useEffect(() => setVisibleCount(PAGE), [rows])

  const visible = rows.slice(0, visibleCount)
  const remaining = rows.length - visibleCount

  return (
    <div>
      <div className="card pi-tbl-toolbar">
        <span className="pi-tbl-toolbar-title">📋 Emiten &amp; Pemegang Saham ≥1%</span>
        <input
          className="pi-tbl-search"
          placeholder="Cari kode/nama emiten..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="pi-tbl-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}>
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span className="pi-tbl-count">{rows.length} emiten</span>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="pi-tbl-wrap">
          <table className="pi-tbl">
            <thead>
              <tr>
                <th style={{ width: 120 }}>Emiten</th>
                <th style={{ width: 60, textAlign: 'center' }}>Holder</th>
                <th style={{ width: 80, textAlign: 'center' }}>CORP %</th>
                <th style={{ width: 80, textAlign: 'center' }}>IND %</th>
                <th style={{ width: 80, textAlign: 'center' }}>OTH %</th>
                <th>Pemegang Saham (≥1%)</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((em) => {
                const corpPct = sumPct(em, 'CORP')
                const indPct = sumPct(em, 'IND')
                const othPct = sumPct(em, 'OTH')
                const shown = em.holders.slice(0, 5)
                const extra = em.holders.length - 5
                return (
                  <tr key={em.code} onClick={() => onSelect({ type: 'emiten', code: em.code })} title="Klik untuk lihat di Grafik Jaringan">
                    <td>
                      <div className="em-code">{em.code}</div>
                      <div className="em-name">{em.issuer.slice(0, 30)}</div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{em.holders.length}</td>
                    <td style={{ textAlign: 'center', color: '#3b82f6' }}>{corpPct > 0 ? `${corpPct.toFixed(1)}%` : '—'}</td>
                    <td style={{ textAlign: 'center', color: '#22c55e' }}>{indPct > 0 ? `${indPct.toFixed(1)}%` : '—'}</td>
                    <td style={{ textAlign: 'center', color: '#a855f7' }}>{othPct > 0 ? `${othPct.toFixed(1)}%` : '—'}</td>
                    <td>
                      <div className="pi-holder-list">
                        {shown.map((h) => (
                          <span key={h.name} className={`pi-badge-h ${holderType(h.cls)}`} title={`${h.pct.toFixed(2)}%`}>
                            {h.name.length > 24 ? `${h.name.slice(0, 22)}...` : h.name} <span style={{ opacity: 0.65 }}>{h.pct.toFixed(1)}%</span>
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
