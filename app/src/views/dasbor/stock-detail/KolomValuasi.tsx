import type { ReactNode } from 'react'
import type { StockFundamental } from '../../../lib/dasbor/stockDetailData'
import { fvx } from '../../../lib/dasbor/stockDetailFormat'

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
 * Panel Solvency — sisa dari kolom kiri lama Stock Detail. Panel "Current
 * Valuation" & "Per Share" dihapus di re-layout mockup
 * stock-detail-relayout.html: seluruh isinya (P/E±fwd, P/B±BV, P/S±Rev/shr,
 * Earnings Yield±EPS, Div Yield, FCF/Cash/Dividen per share) sekarang tampil
 * permanen di strip .rasio + panel Dividen; satu-satunya metrik yang tidak
 * tercakup, EV/EBITDA, dipindah ke tabel Relative Valuation tab Valuasi
 * (PanelValuasiInteraktif) yang memang sudah punya sector_ev_ebitda_median.
 */
export function PanelSolvency({ fd }: { fd: StockFundamental }) {
  return (
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
  )
}
