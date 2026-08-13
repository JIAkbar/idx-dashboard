import type { ReactNode } from 'react'
import type { StockFundamental } from '../../../lib/dasbor/stockDetailData'
import { fB, fMC, fv, fvx } from '../../../lib/dasbor/stockDetailFormat'
import { FdPercent } from '../../../components/dasbor/FdPercent'

/** Baris <tr> label + nilai rata-kanan — port TR() index_live.html baris 4044. */
function TR(lbl: string, val: ReactNode) {
  return (
    <tr>
      <td>{lbl}</td>
      <td className="r">{val}</td>
    </tr>
  )
}

/** "N hari" 1 desimal, null → "—". */
function fHari(v: number | null | undefined): string {
  return v != null ? Number(v).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' hari' : '—'
}

/* ── #93 Key Stats — panel kelompok ala referensi Stockbit, gaya Lantai ── */

/** Panel Valuasi — rasio harga lengkap (annualised + TTM). */
export function PanelValuasi({ fd }: { fd: StockFundamental }) {
  return (
    <div className="panel">
      <div className="panel-h"><span className="lbl">Valuasi</span></div>
      <div className="panel-b">
        <table>
          <tbody>
            {TR('P/E (Annualised)', fvx(fd.pe_annualised))}
            {TR('P/E (TTM)', fvx(fd.pe))}
            {TR('Forward P/E', fvx(fd.forward_pe))}
            {TR('Earnings Yield', <FdPercent v={fd.earn_yield} />)}
            {TR('P/S (TTM)', fvx(fd.ps))}
            {TR('P/BV', fvx(fd.pb))}
            {TR('P/Cash Flow', fvx(fd.price_cf))}
            {TR('P/FCF', fvx(fd.price_fcf))}
            {TR('EV/EBIT', fvx(fd.ev_ebit))}
            {TR('EV/EBITDA', fvx(fd.ev_ebitda))}
            {TR('PEG Ratio', fvx(fd.peg))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Panel Per Saham — semua metrik /share (Rp, hasil konversi backend). */
export function PanelPerSaham({ fd }: { fd: StockFundamental }) {
  const rp = (v: number | null | undefined) => (v != null ? 'Rp ' + fv(v) : '—')
  return (
    <div className="panel">
      <div className="panel-h"><span className="lbl">Per Saham</span></div>
      <div className="panel-b">
        <table>
          <tbody>
            {TR('EPS (TTM)', rp(fd.eps))}
            {TR('EPS Forward', rp(fd.eps_fwd))}
            {TR('Revenue/Share', rp(fd.rev_ps))}
            {TR('Cash/Share', rp(fd.cash_ps))}
            {TR('Book Value/Share', rp(fd.bv))}
            {TR('FCF/Share', rp(fd.fcf_ps))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Badge warna Altman Z" (EM-score): >2.6 aman, 1.1–2.6 abu-abu, <1.1 distress. */
function AltmanBadge({ z }: { z: number | null | undefined }) {
  if (z == null) return <>—</>
  const cls = z > 2.6 ? 'ks-g' : z >= 1.1 ? 'ks-a' : 'ks-r'
  const lbl = z > 2.6 ? 'aman' : z >= 1.1 ? 'abu-abu' : 'distress'
  return (
    <>
      {Number(z).toFixed(2)}<span className={`ks-badge ${cls}`}>{lbl}</span>
    </>
  )
}

/**
 * Panel Solvabilitas — perluasan PanelSolvency lama (#93): + Financial
 * Leverage, Interest Coverage, FCF, Altman Z-Score berbadge warna.
 */
export function PanelSolvency({ fd }: { fd: StockFundamental }) {
  return (
    <div className="panel">
      <div className="panel-h"><span className="lbl">Solvabilitas</span></div>
      <div className="panel-b">
        <table>
          <tbody>
            {TR('Current Ratio', fvx(fd.current_ratio))}
            {TR('Quick Ratio', fvx(fd.quick_ratio))}
            {TR('DER (Q)', fvx(fd.der_q ?? fd.der))}
            {TR('LT Debt/Equity (Q)', fvx(fd.lt_der_q))}
            {TR('Liabilities/Equity (Q)', fvx(fd.tl_eq_q))}
            {TR('Debt/Assets (Q)', fvx(fd.td_ta_q))}
            {TR('Financial Leverage (Q)', fvx(fd.lev_q))}
            {TR('Interest Coverage', fvx(fd.interest_coverage))}
            {TR('Free Cash Flow (TTM)', fB(fd.ttm_fcf))}
            {TR('Altman Z-Score', <AltmanBadge z={fd.altman_z} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Panel Efektivitas Manajemen — return + siklus operasi + turnover. */
export function PanelEfektivitas({ fd }: { fd: StockFundamental }) {
  return (
    <div className="panel">
      <div className="panel-h"><span className="lbl">Efektivitas Manajemen</span></div>
      <div className="panel-b">
        <table>
          <tbody>
            {TR('ROA (TTM)', <FdPercent v={fd.roa != null ? fd.roa * 100 : null} />)}
            {TR('ROE (TTM)', <FdPercent v={fd.roe != null ? fd.roe * 100 : null} />)}
            {TR('ROCE (TTM)', <FdPercent v={fd.roce != null ? fd.roce * 100 : null} />)}
            {TR('ROIC (TTM)', <FdPercent v={fd.roic != null ? fd.roic * 100 : null} />)}
            {TR('Days Sales Outstanding', fHari(fd.days_sales_outstanding))}
            {TR('Days Inventory', fHari(fd.days_inventory))}
            {TR('Days Payables', fHari(fd.days_payables))}
            {TR('Cash Conversion Cycle', fHari(fd.cash_conversion_cycle))}
            {TR('Receivables Turnover', fvx(fd.receivables_turnover))}
            {TR('Inventory Turnover', fvx(fd.inventory_turnover))}
            {TR('Asset Turnover', fvx(fd.asset_turnover))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Badge warna Piotroski F-Score: ≥7 kuat, 4–6 sedang, ≤3 lemah. */
function FScoreBadge({ f, n }: { f: number | null | undefined; n: number | null | undefined }) {
  if (f == null) return <>—</>
  const cls = f >= 7 ? 'ks-g' : f >= 4 ? 'ks-a' : 'ks-r'
  return (
    <>
      {f}/9<span className={`ks-badge ${cls}`}>{f >= 7 ? 'kuat' : f >= 4 ? 'sedang' : 'lemah'}</span>
      {n != null && n < 9 && <span className="ks-note">{n} komponen tersedia</span>}
    </>
  )
}

/** Panel Skor & Struktur — F-Score + struktur kepemilikan/kapitalisasi. */
export function PanelSkor({ fd }: { fd: StockFundamental }) {
  const shares = fd.shares_outstanding ?? fd.shares
  const ff = fd.free_float_pct ?? fd.float_pct
  return (
    <div className="panel">
      <div className="panel-h"><span className="lbl">Skor &amp; Struktur</span></div>
      <div className="panel-b">
        <table>
          <tbody>
            {TR('Piotroski F-Score', <FScoreBadge f={fd.f_score} n={fd.f_score_n} />)}
            {TR('Market Cap', fMC(fd.market_cap))}
            {TR('Enterprise Value', fMC(fd.enterprise_value))}
            {TR('Shares Outstanding', shares != null ? (shares / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' M' : '—')}
            {TR('Free Float', ff != null ? Number(ff).toFixed(2) + '%' : '—')}
          </tbody>
        </table>
      </div>
    </div>
  )
}
