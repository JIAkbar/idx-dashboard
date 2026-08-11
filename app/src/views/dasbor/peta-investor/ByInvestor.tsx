import { useEffect, useMemo, useState } from 'react'
import type { GraphSelection, InvestorRow } from '../../../lib/dasbor/petaInvestorData'

interface ByInvestorProps {
  investorMap: InvestorRow[]
  onSelect: (sel: GraphSelection) => void
}

const PAGE = 20
/** Sama dengan ByStock: 3 pil supaya tinggi baris seragam (portofolio investor bisa 1..ratusan emiten). */
const PIL = 3
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
    <div className="panel">
      <div className="panel-h" style={{ flexWrap: 'wrap' }}>
        <span className="lbl">Investor &amp; Portofolio Saham</span>
        <input
          className="inp"
          style={{ width: 200 }}
          placeholder="Cari nama investor..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="inp" style={{ width: 'auto' }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}>
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span className="num" style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>{rows.length} investor</span>
      </div>
      <div className="pi-tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
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
                const shown = inv.holdings.slice(0, PIL)
                const extra = inv.holdings.length - PIL
                return (
                  <tr key={inv.name} onClick={() => onSelect({ type: 'investor', name: inv.name, cls: inv.cls, lf: inv.lf })} title="Klik untuk lihat di Grafik Jaringan">
                    <td>
                      <div className="pi-inv-name satu-baris" title={inv.name}>{inv.name}</div>
                      <div className="em-name">{inv.lf === 'F' ? '🌐 Asing' : '🇮🇩 Domestik'}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}><span className="bchip" style={{ marginRight: 0 }}>{inv.type}</span></td>
                    <td className="num" style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, color: 'var(--amber)' }}>{inv.holdings.length}</td>
                    <td>
                      <div className="pil-row">
                        {shown.map((h) => (
                          <span key={h.code} className="bchip" title={`${h.issuer} · ${h.pct.toFixed(2)}%`}>
                            <span className="pil-nm">{h.code}</span>
                            <span className="pil-pct">{h.pct.toFixed(1)}%</span>
                          </span>
                        ))}
                        {extra > 0 && <span className="lbl">+{extra} lagi</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {remaining > 0 && (
            <div style={{ textAlign: 'center', padding: 10 }}>
              <button type="button" className="bchip" style={{ color: 'var(--text2)', cursor: 'pointer' }} onClick={() => setVisibleCount((v) => v + PAGE)}>
                Tampilkan {Math.min(remaining, PAGE)} lagi (sisa {remaining})
              </button>
            </div>
          )}
      </div>
    </div>
  )
}
