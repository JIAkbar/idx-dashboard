import type { NegoRow } from '../../../lib/dasbor/brokerSummaryData'
import { fmtB } from '../../../lib/dasbor/brokerSummaryFormat'

interface NegoProps {
  rows: NegoRow[]
}

const COLS = '24px 60px 1fr 100px 90px'

/**
 * Tab "NEGO" — port bsRenderNego() index_live.html baris 5994-6009. Snapshot
 * 1 hari (BS_DATE = akhir range aktif) — TIDAK diagregasi seperti Inventory.
 * Gaya Lantai Bursa (Task 10): ticker `.tick`, batang nilai `.bar-tr`/`.bar-fl`
 * (Step 4 papan pekerjaan). Chrome kartu dipegang parent BrokerSummary.tsx.
 */
export function Nego({ rows }: NegoProps) {
  const top = rows.slice(0, 15)
  const maxVal = top[0]?.nilai ?? 1

  return (
    <div>
      <div className="lbl" style={{ marginBottom: 10 }}>🔄 Top Non-Regular (NEGO) by Nilai</div>
      {top.length === 0 ? (
        <div style={{ color: 'var(--text2)', padding: 20, textAlign: 'center' }}>Tidak ada data NEGO</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {top.map((n, i) => {
            const barPct = Math.round((n.nilai / maxVal) * 100)
            return (
              <div key={n.ticker} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, alignItems: 'center' }}>
                <span className="num" style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>{i + 1}</span>
                <span className="tick">{n.ticker}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.nama}</span>
                <div className="bar-tr"><div className="bar-fl" style={{ width: `${barPct}%` }} /></div>
                <span className="r num">{fmtB(n.nilai)}</span>
              </div>
            )
          })}
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)' }}>* Non-Regular Board: NEGO, crossing, dll.</div>
    </div>
  )
}
