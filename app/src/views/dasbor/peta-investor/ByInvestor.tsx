import { useEffect, useMemo, useState } from 'react'
import type { GraphSelection, InvestorRow } from '../../../lib/dasbor/petaInvestorData'
import { IkonMenu, IKON_GLOBE, IKON_LOKASI } from '../../../components/dasbor/IkonMenu'
import { Dropdown } from '../../../components/dasbor/Dropdown'
import { PilRow } from '../../../components/dasbor/PilRow'

interface ByInvestorProps {
  investorMap: InvestorRow[]
  onSelect: (sel: GraphSelection) => void
}

const PAGE = 20
const TYPE_OPTIONS: { nilai: '' | 'CORP' | 'IND' | 'OTH'; label: string }[] = [
  { nilai: '', label: 'Semua Tipe' },
  { nilai: 'CORP', label: 'Institusi (CORP)' },
  { nilai: 'IND', label: 'Individu (IND)' },
  { nilai: 'OTH', label: 'Lainnya (OTH)' },
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
        <Dropdown opsi={TYPE_OPTIONS} nilai={typeFilter} onGanti={(v) => setTypeFilter(v as typeof typeFilter)} ariaLabel="Filter tipe investor" />
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
                return (
                  <tr key={inv.name} onClick={() => onSelect({ type: 'investor', name: inv.name, cls: inv.cls, lf: inv.lf })} title="Klik untuk lihat di Grafik Jaringan">
                    <td>
                      <div className="pi-inv-name satu-baris" title={inv.name}>{inv.name}</div>
                      <div className="em-name">
                        {inv.lf === 'F' ? <><IkonMenu d={IKON_GLOBE} size={11} /> Asing</> : <><IkonMenu d={IKON_LOKASI} size={11} /> Domestik</>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><span className="bchip" style={{ marginRight: 0 }}>{inv.type}</span></td>
                    <td className="num" style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, color: 'var(--amber)' }}>{inv.holdings.length}</td>
                    {/* #77b: jumlah chip adaptif lebar kolom (PilRow ukur nyata),
                        bukan angka tetap — "+N lagi" hanya saat benar tak muat. */}
                    <td>
                      <PilRow
                        total={inv.holdings.length}
                        items={inv.holdings.map((h) => ({ key: h.code, nama: h.code, pct: h.pct, title: `${h.issuer} · ${h.pct.toFixed(2)}%` }))}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {remaining > 0 && (
            <div style={{ textAlign: 'center', padding: 10 }}>
              <button type="button" className="bchip" style={{ cursor: 'pointer' }} onClick={() => setVisibleCount((v) => v + PAGE)}>
                Tampilkan {Math.min(remaining, PAGE)} lagi (sisa {remaining})
              </button>
            </div>
          )}
      </div>
    </div>
  )
}
