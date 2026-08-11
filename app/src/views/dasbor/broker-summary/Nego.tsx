import type { NegoRow } from '../../../lib/dasbor/brokerSummaryData'
import { fmtB } from '../../../lib/dasbor/brokerSummaryFormat'

interface NegoProps {
  rows: NegoRow[]
}

/**
 * Tab "NEGO" — port bsRenderNego() index_live.html baris 5994-6009. Snapshot
 * 1 hari (BS_DATE = akhir range aktif) — TIDAK diagregasi seperti Inventory.
 */
export function Nego({ rows }: NegoProps) {
  const top = rows.slice(0, 15)
  const maxVal = top[0]?.nilai ?? 1

  return (
    <div className="bs-chart-card">
      <div className="bs-chart-title">🔄 Top Non-Regular (NEGO) by Nilai</div>
      {top.length === 0 ? (
        <div style={{ color: 'var(--text2)', padding: 20, textAlign: 'center' }}>Tidak ada data NEGO</div>
      ) : (
        <div>
          {top.map((n, i) => {
            const barW = Math.round((n.nilai / maxVal) * 90)
            return (
              <div className="bs-nego-row" key={n.ticker}>
                <div className="bs-nego-rank">{i + 1}</div>
                <div className="bs-nego-ticker">{n.ticker}</div>
                <div className="bs-nego-name">{n.nama}</div>
                <div className="bs-nego-val">{fmtB(n.nilai)}</div>
                <div className="bs-nego-bar-wrap">
                  <div className="bs-nego-bar" style={{ width: `${barW}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div className="bs-chart-sub" style={{ marginTop: 10 }}>* Non-Regular Board: NEGO, crossing, dll.</div>
    </div>
  )
}
