import type { ReactNode } from 'react'
import type { StockFundamental } from '../../../lib/dasbor/stockDetailData'
import { fv, fvx, fp2 } from '../../../lib/dasbor/stockDetailFormat'

/** Baris <tr> label + nilai rata-kanan — port TR() index_live.html baris 4044. */
function TR(lbl: string, val: ReactNode) {
  return (
    <tr>
      <td>{lbl}</td>
      <td className="r">{val}</td>
    </tr>
  )
}

/**
 * Kolom KIRI Stock Detail — Current Valuation / Per Share / Solvency.
 * Port index_live.html baris 4111-4145.
 */
export function KolomValuasi({ fd }: { fd: StockFundamental }) {
  const earningsYield = fd.eps && fd.last_price ? fp2((fd.eps / fd.last_price) * 100, 2) : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="panel">
        <div className="panel-h"><span className="lbl">Current Valuation</span></div>
        <div className="panel-b">
          <table>
            <tbody>
              {TR('P/E (Trailing)', fvx(fd.pe))}
              {TR('P/E (Forward)', fvx(fd.forward_pe))}
              {TR('P/B', fvx(fd.pb))}
              {TR('P/S (TTM)', fvx(fd.ps))}
              {TR('EV/EBITDA (TTM)', fvx(fd.ev_ebitda))}
              {TR('Earnings Yield', earningsYield)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h"><span className="lbl">Per Share</span></div>
        <div className="panel-b">
          <table>
            <tbody>
              {TR('EPS (TTM)', fd.eps ? 'Rp ' + fv(fd.eps) : '—')}
              {TR('Book Value', fd.bv ? 'Rp ' + fv(fd.bv) : '—')}
              {TR('Revenue/Share', fd.rev_ps ? 'Rp ' + fv(fd.rev_ps) : '—')}
              {TR('Cash/Share', fd.cash_ps ? 'Rp ' + fv(fd.cash_ps) : '—')}
              {TR('FCF/Share', fd.fcf_ps ? 'Rp ' + fv(fd.fcf_ps) : '—')}
              {TR('Dividen/Share', fd.dividend ? 'Rp ' + fv(fd.dividend) : '—')}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h"><span className="lbl">Solvency</span></div>
        <div className="panel-b">
          <table>
            <tbody>
              {TR('Current Ratio', fvx(fd.current_ratio))}
              {TR('Quick Ratio', fvx(fd.quick_ratio))}
              {TR('DER (Q)', fvx(fd.der_q ?? fd.der))}
              {TR('LT DER (Q)', fvx(fd.lt_der_q))}
              {TR('TL/Equity (Q)', fvx(fd.tl_eq_q))}
              {TR('TD/TA (Q)', fvx(fd.td_ta_q))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
