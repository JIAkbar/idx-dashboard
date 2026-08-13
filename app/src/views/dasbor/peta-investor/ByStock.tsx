import { useEffect, useMemo, useState } from 'react'
import { holderType, type GraphSelection, type InvestorMapEntry } from '../../../lib/dasbor/petaInvestorData'
import { Dropdown } from '../../../components/dasbor/Dropdown'
import { PilRow } from '../../../components/dasbor/PilRow'

interface ByStockProps {
  data: InvestorMapEntry[]
  onSelect: (sel: GraphSelection) => void
}

const PAGE = 20
const TYPE_OPTIONS: { nilai: '' | 'CORP' | 'IND' | 'OTH'; label: string }[] = [
  { nilai: '', label: 'Semua Tipe Holder' },
  { nilai: 'CORP', label: 'Institusi (CORP)' },
  { nilai: 'IND', label: 'Individu (IND)' },
  { nilai: 'OTH', label: 'Lainnya (OTH)' },
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
    <div className="panel">
      <div className="panel-h" style={{ flexWrap: 'wrap' }}>
        <span className="lbl">Emiten &amp; Pemegang Saham ≥1%</span>
        <input
          className="inp"
          style={{ width: 200 }}
          placeholder="Cari kode/nama emiten..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Dropdown opsi={TYPE_OPTIONS} nilai={typeFilter} onGanti={(v) => setTypeFilter(v as typeof typeFilter)} ariaLabel="Filter tipe holder" />
        <span className="num" style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>{rows.length} emiten</span>
      </div>
      <div className="pi-tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="pi-tbl">
            <thead>
              <tr>
                <th style={{ width: 120 }}>Emiten</th>
                <th style={{ width: 60, textAlign: 'center' }}>Holder</th>
                <th style={{ width: 80, textAlign: 'center' }}>CORP %</th>
                <th style={{ width: 80, textAlign: 'center' }}>IND %</th>
                <th style={{ width: 80, textAlign: 'center' }} title="OTH = tipe tak terisi — tipe holder diturunkan dari teks bebas KSEI">OTH %</th>
                <th>Pemegang Saham (≥1%)</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((em) => {
                const corpPct = sumPct(em, 'CORP')
                const indPct = sumPct(em, 'IND')
                const othPct = sumPct(em, 'OTH')
                return (
                  <tr key={em.code} onClick={() => onSelect({ type: 'emiten', code: em.code })} title="Klik untuk lihat di Grafik Jaringan">
                    <td>
                      <div className="em-code">{em.code}</div>
                      {/* 199 dari 952 emiten tidak punya nama perusahaan di data KSEI; tanpa
                          pengganti, barisnya kehilangan satu baris teks dan tinggi baris tabel
                          jadi tidak seragam lagi. */}
                      <div className="em-name satu-baris" title={em.issuer}>{em.issuer || '—'}</div>
                    </td>
                    {/* Persentase = data utama tabel — warna teks utama (var(--text)
                        dari .pi-tbl td), bukan text2/text3 yang redup di dark (#83). */}
                    <td className="num" style={{ textAlign: 'center', fontWeight: 700 }}>{em.holders.length}</td>
                    <td className="num" style={{ textAlign: 'center' }}>{corpPct > 0 ? `${corpPct.toFixed(1)}%` : '—'}</td>
                    <td className="num" style={{ textAlign: 'center' }}>{indPct > 0 ? `${indPct.toFixed(1)}%` : '—'}</td>
                    <td className="num" style={{ textAlign: 'center' }}>{othPct > 0 ? `${othPct.toFixed(1)}%` : '—'}</td>
                    {/* #77b: jumlah chip adaptif lebar kolom (PilRow ukur nyata),
                        bukan angka tetap — "+N lagi" hanya saat benar tak muat. */}
                    <td>
                      <PilRow
                        total={em.holders.length}
                        items={em.holders.map((h) => ({ key: h.name, nama: h.name, pct: h.pct, title: `${h.name} · ${holderType(h.cls)} · ${h.pct.toFixed(2)}%` }))}
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
      {/* Dulu banner .chip warn mencolok sebaris kontrol (#83) — diciutkan jadi
          keterangan kecil di bawah tabel + title di header kolom OTH %.
          Substansi tetap: holder tanpa `cls` (1.138 dari 6.728 baris) jatuh ke
          OTH, jadi "OTH" berarti "tipe tidak terisi", bukan "tipe lain". */}
      <div style={{ fontSize: 10, color: 'var(--text3)', padding: '7px 14px', borderTop: '1px solid var(--line)' }}>
        Tipe holder diturunkan dari teks bebas KSEI · OTH = tipe tak terisi
      </div>
    </div>
  )
}
