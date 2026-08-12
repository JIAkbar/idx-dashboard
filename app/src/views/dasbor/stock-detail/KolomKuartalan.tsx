import { useState, type ReactNode } from 'react'
import type { QuarterMap, StockFundamental } from '../../../lib/dasbor/stockDetailData'
import { fMC } from '../../../lib/dasbor/stockDetailFormat'
import { FdPercent } from '../../../components/dasbor/FdPercent'

type QMode = 'ni' | 'eps' | 'rev'

const TABS: { id: QMode; label: string }[] = [
  { id: 'ni', label: 'Net Income' },
  { id: 'eps', label: 'EPS' },
  { id: 'rev', label: 'Revenue' },
]

function TR(lbl: string, val: ReactNode) {
  return (
    <tr>
      <td>{lbl}</td>
      <td className="r">{val}</td>
    </tr>
  )
}

/** Port fdQTabBuild() index_live.html baris 3928-3993. */
function QuarterlyTable({ fd, mode }: { fd: StockFundamental; mode: QMode }) {
  const qData: QuarterMap = (mode === 'ni' ? fd.q_net_income : mode === 'eps' ? fd.q_eps : fd.q_revenue) ?? {}
  const fmtCell = (v: number | null | undefined) => {
    if (v == null) return '—'
    return mode === 'eps'
      ? Number(v).toLocaleString('id-ID', { maximumFractionDigits: 0 })
      : (v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 0 })
  }

  const years = Object.keys(qData).map(Number).sort((a, b) => b - a).slice(0, 3)
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
  const blankCols = Math.max(0, years.length - 1)

  // TTM: 4 kuartal terbaru lintas tahun, urut desc (sama seperti sumber).
  const allQ: [number, string, number][] = []
  Object.entries(qData).forEach(([y, qmap]) => {
    Object.entries(qmap).forEach(([q, v]) => { if (v != null) allQ.push([Number(y), q, v]) })
  })
  allQ.sort((a, b) => (a[0] !== b[0] ? b[0] - a[0] : b[1].localeCompare(a[1])))
  const ttmVals = allQ.slice(0, 4).map((r) => r[2])
  const ttmSum = ttmVals.length === 4 ? ttmVals.reduce((a, b) => a + b, 0) : null

  const suffix = mode === 'eps' ? 'IDR' : 'B IDR'
  const sectionHdrStyle = { padding: '2px 8px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5, color: 'var(--text3)' }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="fd-qtab">
        <thead>
          <tr>
            <th>Period</th>
            {years.map((y) => <th key={y} className="r">{y}</th>)}
          </tr>
          <tr>
            <td colSpan={years.length + 1} style={{ fontSize: 9, color: 'var(--text3)', padding: '2px 8px' }}>({suffix})</td>
          </tr>
        </thead>
        <tbody>
          {quarters.map((q) => (
            <tr key={q}>
              <td>{q}</td>
              {years.map((y) => <td key={y} className="r">{fmtCell(qData[String(y)]?.[q])}</td>)}
            </tr>
          ))}
          <tr className="fd-divider">
            <td>Annualised</td>
            {years.map((y) => {
              const ymap = qData[String(y)] || {}
              const vals = Object.values(ymap).filter((v) => v != null)
              const sum = vals.length ? vals.reduce((a, b) => a + b, 0) : null
              return <td key={y} className="r">{fmtCell(sum)}</td>
            })}
          </tr>
          <tr className="ttm-row">
            <td>TTM</td>
            <td className="r">{fmtCell(ttmSum)}</td>
            {blankCols > 0 && <td colSpan={blankCols} />}
          </tr>

          {mode === 'ni' && (
            <>
              <tr className="fd-divider"><td colSpan={years.length + 1} style={sectionHdrStyle}>Dividen &amp; Yield</td></tr>
              <tr>
                <td>Div (TTM)</td>
                <td className="r">{fd.dividend ? Number(fd.dividend).toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '—'}</td>
                {blankCols > 0 && <td colSpan={blankCols} />}
              </tr>
              <tr>
                <td>Payout Ratio</td>
                <td className="r">{fd.payout_ratio ? (fd.payout_ratio * 100).toFixed(2) + '%' : '—'}</td>
                {blankCols > 0 && <td colSpan={blankCols} />}
              </tr>
              <tr>
                <td>Div Yield</td>
                <td className="r">{fd.dividend_yield ? fd.dividend_yield.toFixed(2) + '%' : '—'}</td>
                {blankCols > 0 && <td colSpan={blankCols} />}
              </tr>
              <tr className="fd-divider"><td colSpan={years.length + 1} style={sectionHdrStyle}>Info Pasar</td></tr>
              <tr>
                <td>Market Cap</td>
                <td className="r">{fMC(fd.market_cap)}</td>
                {blankCols > 0 && <td colSpan={blankCols} />}
              </tr>
              <tr>
                <td>Enterprise Value</td>
                <td className="r">{fMC(fd.enterprise_value)}</td>
                {blankCols > 0 && <td colSpan={blankCols} />}
              </tr>
              <tr>
                <td>Shares Outstanding</td>
                <td className="r">{fd.shares ? (fd.shares / 1e9).toFixed(2) + ' M' : '—'}</td>
                {blankCols > 0 && <td colSpan={blankCols} />}
              </tr>
              <tr>
                <td>Free Float</td>
                <td className="r">{fd.float_pct ? fd.float_pct.toFixed(2) + '%' : '—'}</td>
                {blankCols > 0 && <td colSpan={blankCols} />}
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Kolom TENGAH Stock Detail — tab kuartalan, Profitabilitas, Growth,
 * Dividen, Riwayat Dividen. Port index_live.html baris 4148-4190
 * (+ fdQTabSwitch/fdQTabBuild baris 3918-3993).
 *
 * CATATAN: sumber asli (index_live.html baris 4170-4180 & 3975-3980)
 * mengalikan fd.rev_yoy/ni_yoy/gp_yoy/dividend_yield dengan 100 sebelum
 * format — tapi field itu di data JSON SUDAH dalam skala persen (mis.
 * rev_yoy:6.8 = 6,8%, bukan 0,068), jadi dashboard lama menampilkan angka
 * salah (mis. +680% alih-alih +6,8%). Bug data, bukan pilihan desain —
 * diperbaiki di sini (tanpa *100), bukan diport apa adanya. payout_ratio
 * (fraksi asli, *100 benar) tidak kena masalah ini, tetap dikali 100.
 */
export function KolomKuartalan({ fd }: { fd: StockFundamental }) {
  const [mode, setMode] = useState<QMode>('ni')

  const divHistRows = fd.div_history ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="panel">
        <div className="panel-h">
          <div className="tabs" role="tablist" aria-label="Metrik Kuartalan">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={mode === t.id}
                className={`tab${mode === t.id ? ' on' : ''}`}
                onClick={() => setMode(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="panel-b">
          <QuarterlyTable fd={fd} mode={mode} />
        </div>
      </div>

      <div className="panel">
        <div className="panel-h"><span className="lbl">Profitabilitas</span></div>
        <div className="panel-b">
          <table>
            <tbody>
              {TR('Gross Profit Margin', <FdPercent v={fd.gpm != null ? fd.gpm * 100 : null} />)}
              {TR('Operating Margin', <FdPercent v={fd.opm != null ? fd.opm * 100 : null} />)}
              {TR('Net Profit Margin', <FdPercent v={fd.npm != null ? fd.npm * 100 : null} />)}
              {TR('ROE (TTM)', <FdPercent v={fd.roe != null ? fd.roe * 100 : null} />)}
              {TR('ROA (TTM)', <FdPercent v={fd.roa != null ? fd.roa * 100 : null} />)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h"><span className="lbl">Growth (YoY)</span></div>
        <div className="panel-b">
          <table>
            <tbody>
              {TR('Revenue YoY', <FdPercent v={fd.rev_yoy} />)}
              {TR('Gross Profit YoY', <FdPercent v={fd.gp_yoy} />)}
              {TR('Net Income YoY', <FdPercent v={fd.ni_yoy} />)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h"><span className="lbl">Dividen</span></div>
        <div className="panel-b">
          <table>
            <tbody>
              {TR('Dividen/Saham', fd.dividend ? 'Rp ' + Number(fd.dividend).toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '—')}
              {TR('Payout Ratio', <FdPercent v={fd.payout_ratio != null ? fd.payout_ratio * 100 : null} d={1} />)}
              {TR('Div Yield', <FdPercent v={fd.dividend_yield} />)}
              {TR('Ex-Date', fd.ex_dividend_date || '—')}
            </tbody>
          </table>
        </div>
      </div>

      {divHistRows.length > 0 && (
        <div className="panel">
          <div className="panel-h"><span className="lbl">Riwayat Dividen</span></div>
          <div className="panel-b">
            <table>
              <thead>
                <tr><th>Tahun</th><th className="r">Dividen</th><th className="r">Ex-Date</th></tr>
              </thead>
              <tbody>
                {divHistRows.map((d, i) => (
                  <tr key={`${d.year}-${d.ex_date}-${i}`}>
                    <td className="muted">{d.year}</td>
                    <td className="r">Rp {Number(d.amount).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</td>
                    <td className="r muted">{d.ex_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
