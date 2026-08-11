import { useState } from 'react'
import type { StockFundamental } from '../../../lib/dasbor/stockDetailData'
import { fp2 } from '../../../lib/dasbor/stockDetailFormat'
import { FdPercent } from '../../../components/dasbor/FdPercent'

/** "Rp "+angka bulat — port fv() lokal fdValuationCalc() baris 4397. */
function rp(v: number | null): string {
  return v != null ? 'Rp ' + Math.round(v).toLocaleString('id-ID') : '—'
}

/** Port mosBadge() index_live.html baris 4398-4404. */
function MosBadge({ val, price }: { val: number | null; price: number }) {
  if (!val || !price || price <= 0) return <>—</>
  const mos = (val / price - 1) * 100
  const color = mos > 0 ? 'var(--green)' : 'var(--red)'
  const label = mos > 20 ? 'Undervalued' : mos < -20 ? 'Overvalued' : 'Wajar'
  return (
    <>
      <span style={{ color, fontWeight: 700 }}>{mos >= 0 ? '+' : ''}{mos.toFixed(1)}%</span>{' '}
      <span style={{ fontSize: 9, color }}>{label}</span>
    </>
  )
}

function pctPlain(v: number | null, d = 1): string {
  return v != null ? v.toFixed(d) + '%' : '—'
}

/** Satu baris tabel Relative Valuation — port relRow() index_live.html baris 4254-4265. */
function RelRow({ label, val, secMed, fmt, invert }: {
  label: string; val: number | null; secMed: number | null; fmt: (v: number | null) => string; invert: boolean
}) {
  if (val == null || secMed == null) {
    return <tr><td>{label}</td><td className="r">{fmt(val)}</td><td className="r muted">—</td><td className="r muted">—</td></tr>
  }
  const diff = (val / secMed - 1) * 100
  const isCheap = invert ? diff > 5 : diff < -5
  const isPricey = invert ? diff < -5 : diff > 5
  const badge = isCheap
    ? <span style={{ color: 'var(--green)', fontSize: 9, fontWeight: 700 }}>▼ Murah</span>
    : isPricey
      ? <span style={{ color: 'var(--red)', fontSize: 9, fontWeight: 700 }}>▲ Mahal</span>
      : <span style={{ color: 'var(--text3)', fontSize: 9 }}>≈ Wajar</span>
  const diffColor = isCheap ? 'var(--green)' : isPricey ? 'var(--red)' : 'var(--text3)'
  return (
    <tr>
      <td>{label}</td>
      <td className="r">{fmt(val)}</td>
      <td className="r">{fmt(secMed)}</td>
      <td className="r"><span style={{ color: diffColor }}>{fp2(diff)}</span> {badge}</td>
    </tr>
  )
}

/**
 * Modul valuasi interaktif — Graham Calculator, Relative Valuation, DDM,
 * Tren Historis per Saham. Port fdValuationHtml()/fdValuationCalc()
 * index_live.html baris 4247-4442. RUMUS DIPORT PERSIS, TIDAK DIUBAH:
 *   - Graham Classic  : √(22.5 × EPS × BV)
 *   - Graham Growth   : EPS × (8.5 + 2g) × 4.4 / Y   (Y = yield SBN 10th, default 6.75%)
 *   - NCAV/Net-Net    : (Aset Lancar − Total Liabilitas) / Saham Beredar (statis, bukan interaktif — sama seperti sumber)
 *   - DDM Gordon Growth: D1 / (r − g), D1 = DPS terakhir × (1+g), g = fd.ddm_g_rate (diklem 0..r-1)
 * Dipasang dengan `key={fd.ticker}` oleh pemanggil (StockDetail.tsx) supaya
 * input reset ke default saham baru tiap ganti kode — sama seperti sumber
 * yang me-rebuild seluruh innerHTML tiap fdRender() dipanggil.
 */
export function PanelValuasiInteraktif({ fd }: { fd: StockFundamental }) {
  const epsDefault = fd.eps || 0
  const bvDefault = fd.bv || 0
  const gDefault = fd.eps_cagr_3y ?? fd.eps_cagr_2y ?? 5
  const gClamped = Number(Math.max(0, Math.min(gDefault, 20)).toFixed(1))
  const priceDefault = fd.last_price || 0

  const [eps, setEps] = useState(epsDefault)
  const [bv, setBv] = useState(bvDefault)
  const [g, setG] = useState(gClamped)
  const [Y, setY] = useState(6.75)
  const [price, setPrice] = useState(priceDefault)
  const [ddmR, setDdmR] = useState(12)

  const num = (v: string) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

  // ── Graham Classic & Growth ──
  const classic = eps > 0 && bv > 0 ? Math.sqrt(22.5 * eps * bv) : null
  const growth = eps > 0 && Y > 0 ? (eps * (8.5 + 2 * Math.max(0, Math.min(g, 20))) * 4.4) / Y : null

  // ── NCAV — statis, bukan interaktif, sama seperti sumber ──
  const ncav = fd.lq_assets && fd.lq_tot_liab && fd.shares
    ? 'Rp ' + Number((fd.lq_assets - fd.lq_tot_liab) / fd.shares).toLocaleString('id-ID', { maximumFractionDigits: 0 })
    : fd.lq_cash && fd.shares
      ? 'Rp ' + Number(fd.lq_cash / fd.shares).toLocaleString('id-ID', { maximumFractionDigits: 0 })
      : '—'

  // ── Relative Valuation ──
  const secPE = fd.sector_pe_median ?? null
  const secPB = fd.sector_pb_median ?? null
  const secNPM = fd.sector_npm_median ?? null
  const secROE = fd.sector_roe_median ?? null
  const secCnt = fd.sector_stock_count || 0
  const hasRel = Boolean(secPE || secPB || secNPM || secROE)

  // ── DDM (Gordon Growth) ──
  const hSorted = fd.hist_dps ? Object.entries(fd.hist_dps).sort((a, b) => Number(b[0]) - Number(a[0])) : []
  const latestDPS = hSorted[0]?.[1] ?? null
  const ddmYears = fd.div_years || 0
  const showDdm = latestDPS != null && ddmYears >= 2
  const gDdm = Math.min(Math.max(fd.ddm_g_rate || 5, 0), ddmR - 1)
  const ddmVal = latestDPS != null && ddmR > gDdm ? (latestDPS * (1 + gDdm / 100)) / ((ddmR - gDdm) / 100) : null

  // ── Tren Historis per Saham ──
  const hEps = fd.hist_eps ?? {}
  const hFcf = fd.hist_fcf ?? {}
  const hBv = fd.hist_bv ?? {}
  const hRoe = fd.hist_roe ?? {}
  const hYrs = [...new Set([...Object.keys(hEps), ...Object.keys(hFcf), ...Object.keys(hBv)])].sort().slice(-4)

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>📐</span> Analisis Valuasi — Estimasi Fair Value
        <span style={{ fontSize: 9, fontWeight: 400, background: 'var(--red-bg)', color: 'var(--red-txt)', padding: '2px 7px', borderRadius: 10 }}>Bukan rekomendasi investasi</span>
      </div>

      <div className="panel" style={{ marginBottom: 8 }}>
        <div className="panel-h"><span className="lbl">🧮 Graham Valuation Calculator</span></div>
        <div className="panel-b">
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
            <div className="field"><span className="lbl">EPS (Rp/saham)</span>
              <input className="inp" type="number" value={eps} step="any" style={{ width: 90 }} onChange={(e) => setEps(num(e.target.value))} /></div>
            <div className="field"><span className="lbl">BV/Saham (Rp)</span>
              <input className="inp" type="number" value={bv} step="any" style={{ width: 100 }} onChange={(e) => setBv(num(e.target.value))} /></div>
            <div className="field"><span className="lbl">Growth EPS (g%/tahun)</span>
              <input className="inp" type="number" value={g} min={0} max={30} step={0.5} style={{ width: 75 }} onChange={(e) => setG(num(e.target.value))} /></div>
            <div className="field"><span className="lbl">Risk-free (Y%)</span>
              <input className="inp" type="number" value={Y} min={1} max={20} step={0.25} style={{ width: 65 }} onChange={(e) => setY(num(e.target.value))} /></div>
            <div className="field"><span className="lbl">Harga saat ini</span>
              <input className="inp" type="number" value={price} step="any" style={{ width: 90 }} onChange={(e) => setPrice(num(e.target.value))} /></div>
          </div>
          <div className="grid3">
            <div className="vcard">
              <span className="lbl">Graham Classic</span>
              <span className="v-num num">
                {classic != null ? rp(classic) : <span style={{ color: 'var(--text3)', fontSize: 13 }}>EPS atau BV = 0</span>}
              </span>
              <span style={{ fontSize: 11 }}><MosBadge val={classic} price={price} /></span>
              <span className="v-note">√(22.5 × EPS × BV)</span>
            </div>
            <div className="vcard">
              <span className="lbl">Graham Growth</span>
              <span className="v-num num">
                {growth != null ? rp(growth) : <span style={{ color: 'var(--text3)', fontSize: 13 }}>EPS = 0</span>}
              </span>
              <span style={{ fontSize: 11 }}><MosBadge val={growth} price={price} /></span>
              <span className="v-note">EPS × (8.5 + 2g) × 4.4/Y</span>
            </div>
            <div className="vcard">
              <span className="lbl">NCAV / Net-Net</span>
              <span className="v-num num">{ncav}</span>
              <span className="v-note">(Aset Lancar − Utang Total) / Saham · Nilai likuidasi konservatif</span>
            </div>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 8 }}>
            💡 Ubah angka di atas untuk simulasi skenario berbeda. g default dari CAGR EPS historis
            {fd.eps_cagr_3y != null ? ` (3Y: ${fd.eps_cagr_3y.toFixed(1)}%)` : fd.eps_cagr_2y != null ? ` (2Y: ${fd.eps_cagr_2y.toFixed(1)}%)` : ''}.
            {' '}Y = yield SBN 10 tahun Indonesia (default 6.75%).
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {hasRel && (
          <div className="panel" style={{ flex: 1, minWidth: 260 }}>
            <div className="panel-h">
              <span className="lbl">📊 Relative Valuation</span>
              <span style={{ fontSize: 9, color: 'var(--text3)' }}>vs median sektor ({secCnt} saham)</span>
            </div>
            <div className="panel-b" style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 260 }}>
                <thead><tr><th>Metrik</th><th className="r">Saham</th><th className="r">Sektor</th><th className="r">Status</th></tr></thead>
                <tbody>
                  <RelRow label="P/E Ratio" val={fd.pe ?? null} secMed={secPE} fmt={(v) => v != null ? v.toFixed(1) + 'x' : '—'} invert={false} />
                  <RelRow label="P/B Ratio" val={fd.pb ?? null} secMed={secPB} fmt={(v) => v != null ? v.toFixed(2) + 'x' : '—'} invert={false} />
                  <RelRow label="Net Margin" val={fd.npm != null ? fd.npm * 100 : null} secMed={secNPM != null ? secNPM * 100 : null} fmt={(v) => pctPlain(v)} invert={true} />
                  <RelRow label="ROE" val={fd.roe != null ? fd.roe * 100 : null} secMed={secROE != null ? secROE * 100 : null} fmt={(v) => pctPlain(v)} invert={true} />
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showDdm ? (
          <div className="panel" style={{ flex: 1, minWidth: 220 }}>
            <div className="panel-h"><span className="lbl">💰 DDM — Dividend Discount</span></div>
            <div className="panel-b">
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8 }}>
                Gordon Growth Model · Required Return ={' '}
                <input className="inp" type="number" value={ddmR} min={5} max={25} step={0.5} style={{ width: 44, padding: '1px 3px', textAlign: 'center', fontSize: 10 }} onChange={(e) => setDdmR(num(e.target.value))} />%
              </div>
              <table>
                <tbody>
                  <tr><td>DPS Terakhir</td><td className="r" style={{ color: 'var(--text)' }}>Rp {latestDPS != null ? Number(latestDPS).toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '—'}</td></tr>
                  <tr><td>Growth DPS ({ddmYears}Y)</td><td className="r"><FdPercent v={fd.ddm_g_rate ?? null} d={1} /></td></tr>
                  <tr><td>DDM Value</td><td className="r" style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>{rp(ddmVal)}</td></tr>
                  <tr><td>MOS vs Harga</td><td className="r"><MosBadge val={ddmVal} price={price} /></td></tr>
                </tbody>
              </table>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 6 }}>⚠️ DDM hanya akurat untuk saham rutin dividen</div>
            </div>
          </div>
        ) : (
          <div className="panel" style={{ flex: 1, minWidth: 220, opacity: 0.5 }}>
            <div className="panel-h"><span className="lbl">💰 DDM</span></div>
            <div className="panel-b">
              <p style={{ fontSize: 11, color: 'var(--text3)' }}>Data dividen tidak cukup (minimal 2 tahun)</p>
            </div>
          </div>
        )}

        {hYrs.length > 0 && (
          <div className="panel" style={{ flex: 1, minWidth: 260 }}>
            <div className="panel-h"><span className="lbl">📈 Tren Historis per Saham</span></div>
            <div className="panel-b" style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 240 }}>
                <thead><tr><th>Metrik</th>{hYrs.map((y) => <th key={y} className="r">{y}</th>)}</tr></thead>
                <tbody>
                  <tr><td>EPS (Rp)</td>{hYrs.map((y) => <td key={y} className="r">{hEps[y] != null ? Number(hEps[y]).toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '—'}</td>)}</tr>
                  <tr><td>BV/Saham</td>{hYrs.map((y) => <td key={y} className="r">{hBv[y] != null ? Number(hBv[y]).toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '—'}</td>)}</tr>
                  <tr><td>FCF (B IDR)</td>{hYrs.map((y) => <td key={y} className="r">{hFcf[y] != null ? (hFcf[y] / 1e9).toFixed(0) : '—'}</td>)}</tr>
                  <tr><td>ROE (%)</td>{hYrs.map((y) => <td key={y} className="r">{hRoe[y] != null ? Number(hRoe[y]).toFixed(1) + '%' : '—'}</td>)}</tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
