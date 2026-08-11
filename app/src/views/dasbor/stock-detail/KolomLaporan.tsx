import type { ReactNode } from 'react'
import type { PricePerf, StockFundamental } from '../../../lib/dasbor/stockDetailData'
import { fB } from '../../../lib/dasbor/stockDetailFormat'

function TR(lbl: string, val: ReactNode) {
  return (
    <tr>
      <td>{lbl}</td>
      <td className="r">{val}</td>
    </tr>
  )
}

const PERF_KEYS: [string, string][] = [['1D', '1d'], ['1W', '1w'], ['1M', '1m'], ['3M', '3m'], ['6M', '6m'], ['YTD', 'ytd']]

/** Satu baris price performance — port fdPerfRow() index_live.html baris 3996-4016. */
function PerfRow({ label, pct, low, high, cur }: { label: string; pct?: number; low?: number; high?: number; cur?: number }) {
  if (pct == null) {
    return (
      <div className="fd-perf-row">
        <span className="fd-perf-lbl">{label}</span>
        <span className="fd-perf-pct muted">—</span>
        <div className="fd-perf-bar" />
        <span className="fd-range">—</span>
      </div>
    )
  }
  const isUp = pct >= 0
  let dotPct = 50
  if (low != null && high != null && high !== low && cur != null) {
    dotPct = Math.max(2, Math.min(98, ((cur - low) / (high - low)) * 100))
  }
  const rangeStr = low != null && high != null
    ? `${Number(low).toLocaleString('id-ID', { maximumFractionDigits: 0 })} – ${Number(high).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
    : ''
  return (
    <div className="fd-perf-row">
      <span className="fd-perf-lbl">{label}</span>
      <span className={`fd-perf-pct ${isUp ? 'green' : 'red'}`}>{isUp ? '+' : ''}{pct.toFixed(2)}%</span>
      <div className="fd-perf-bar"><div className="fd-perf-dot" style={{ left: `${dotPct}%`, background: isUp ? 'var(--green)' : 'var(--red)' }} /></div>
      <span className="fd-range" style={{ color: 'var(--text3)' }}>{rangeStr}</span>
    </div>
  )
}

/** Port histTR() index_live.html baris 4071-4078 — baris tabel Historis (B IDR), 1 baris per metrik. */
function HistRow({ label, obj, years }: { label: string; obj?: Record<string, number>; years: string[] }) {
  if (!obj || !years.length) return null
  return (
    <tr>
      <td>{label}</td>
      {years.map((y) => (
        <td key={y} className="r">{obj[y] != null ? (obj[y] / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '—'}</td>
      ))}
    </tr>
  )
}

/**
 * Kolom KANAN Stock Detail — Income Statement TTM, Balance Sheet LQ, Cash
 * Flow TTM, Price Performance, Historis (B IDR). Port index_live.html
 * baris 4046-4054 (derived TTM/LQ) & 4194-4234.
 */
export function KolomLaporan({ fd }: { fd: StockFundamental }) {
  const ttmRev = fd.ttm_revenue ?? Object.values(fd.hist_revenue ?? {}).slice(-1)[0] ?? null
  const ttmNI = fd.ttm_net_income ?? Object.values(fd.hist_net_income ?? {}).slice(-1)[0] ?? null
  const ttmGP = fd.ttm_gross ?? Object.values(fd.hist_gross_profit ?? {}).slice(-1)[0] ?? null
  const ttmOI = fd.ttm_op_income ?? Object.values(fd.hist_operating_income ?? {}).slice(-1)[0] ?? null
  // Sumber asli baca fd.lq_debt/fd.total_debt — field itu tidak pernah ada di
  // data/fundamental/*.json (nama field sebenarnya lq_total_debt), jadi "Total
  // Debt" di dashboard lama selalu tampil "—". Bug data, bukan pilihan desain
  // — diperbaiki di sini, bukan diport apa adanya.
  const lqCash = fd.lq_cash ?? (fd.total_cash as number | undefined) ?? null
  const lqAsset = fd.lq_assets ?? Object.values(fd.hist_total_assets ?? {}).slice(-1)[0] ?? null
  const lqEq = fd.lq_equity ?? Object.values(fd.hist_total_equity ?? {}).slice(-1)[0] ?? null
  const lqDebt = fd.lq_total_debt ?? null

  const pp: PricePerf = fd.price_perf ?? {}
  const hasPerf = Object.keys(pp).length > 0

  const histSrc = fd.hist_revenue ?? fd.hist_net_income ?? {}
  const histYears = Object.keys(histSrc).sort().reverse().slice(0, 4)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="panel">
        <div className="panel-h"><span className="lbl">Income Statement (TTM)</span></div>
        <div className="panel-b">
          <table>
            <tbody>
              {TR('Revenue', fB(ttmRev))}
              {TR('Gross Profit', fB(ttmGP))}
              {TR('Op. Income', fB(ttmOI))}
              {TR('Net Income', fB(ttmNI))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h"><span className="lbl">Balance Sheet (Latest Q)</span></div>
        <div className="panel-b">
          <table>
            <tbody>
              {TR('Cash & Equiv.', fB(lqCash))}
              {TR('Total Assets', fB(lqAsset))}
              {TR('Total Equity', fB(lqEq))}
              {TR('Total Debt', fB(lqDebt))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h"><span className="lbl">Cash Flow (TTM)</span></div>
        <div className="panel-b">
          <table>
            <tbody>
              {TR('Dari Operasi', fB(fd.ttm_ocf))}
              {TR('Free Cash Flow', fB(fd.ttm_fcf))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h"><span className="lbl">Price Performance</span></div>
        <div className="panel-b">
          {hasPerf ? (
            PERF_KEYS.map(([lbl, k]) => (
              <PerfRow
                key={k}
                label={lbl}
                pct={pp[`${k}_pct` as keyof PricePerf] as number | undefined}
                low={pp[`${k}_low` as keyof PricePerf] as number | undefined}
                high={pp[`${k}_high` as keyof PricePerf] as number | undefined}
                cur={pp.current}
              />
            ))
          ) : (
            <p style={{ fontSize: 11, color: 'var(--text3)', padding: '8px 0' }}>
              Belum ada data. Jalankan <b>GitHub Actions</b> untuk memperbarui data fundamental.
            </p>
          )}
        </div>
      </div>

      {histYears.length > 0 && (
        <div className="panel">
          <div className="panel-h"><span className="lbl">Historis (B IDR)</span></div>
          <div className="panel-b" style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: 240 }}>
              <thead>
                <tr><th>Metrik</th>{histYears.map((y) => <th key={y} className="r">{y}</th>)}</tr>
              </thead>
              <tbody>
                <HistRow label="Revenue" obj={fd.hist_revenue} years={histYears} />
                <HistRow label="Net Income" obj={fd.hist_net_income} years={histYears} />
                <HistRow label="Equity" obj={fd.hist_total_equity} years={histYears} />
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
