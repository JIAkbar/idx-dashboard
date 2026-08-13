import { useMemo, useState } from 'react'
import type { GraphSelection, InvestorRow } from '../../../lib/dasbor/petaInvestorData'
import { IkonMenu, IKON_GLOBE, IKON_LOKASI } from '../../../components/dasbor/IkonMenu'
import { Dropdown } from '../../../components/dasbor/Dropdown'
import { PilRow } from '../../../components/dasbor/PilRow'
import { useMuatBertahap } from './useMuatBertahap'

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

  // #91: infinite scroll dalam wrapper; reset batch saat filter berubah ada di hook.
  const { visible, habis, ioGagal, sentinelRef, muatLagi } = useMuatBertahap(rows, PAGE)

  return (
    <div className="panel">
      <div className="panel-h" style={{ flexWrap: 'wrap' }}>
        <span className="lbl">Investor &amp; Portofolio Saham</span>
        <input
          className="inp"
          style={{ width: 200 }}
          placeholder="Cari nama investor…"
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
                {/* #91c: lebar kolom pindah ke kelas CSS (tabel table-layout fixed,
                    kolom chip = sisa lebar panel — tanpa scroll horizontal). */}
                <th className="pi-c-nama">Investor / Pemegang Saham</th>
                <th className="pi-c-tipe" style={{ textAlign: 'center' }}>Tipe</th>
                <th className="pi-c-jml" style={{ textAlign: 'center' }}># Saham</th>
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
          {/* #91: sentinel = baris "Memuat…" — diamati IO; fallback tombol lama bila IO gagal. */}
          {!habis && !ioGagal && (
            <div ref={sentinelRef} style={{ textAlign: 'center', padding: 8, fontSize: 11, color: 'var(--text3)' }}>
              Memuat…
            </div>
          )}
          {!habis && ioGagal && (
            <div style={{ textAlign: 'center', padding: 10 }}>
              <button type="button" className="bchip" style={{ cursor: 'pointer' }} onClick={muatLagi}>
                Tampilkan {Math.min(rows.length - visible.length, PAGE)} lagi (sisa {rows.length - visible.length})
              </button>
            </div>
          )}
      </div>
      {/* #91: kaki tabel — info jumlah baris terpakai. */}
      <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text3)', padding: '7px 14px', borderTop: '1px solid var(--line)' }}>
        <span className="num">{visible.length} dari {rows.length}</span>
      </div>
    </div>
  )
}
