import { useMemo, useState } from 'react'
import { fN } from '../../../lib/dasbor/format'
import { PosisiBar } from './PosisiBar'

/** Tick size IDX — port PROFIT.tick() index_live.html baris 3184-3188. */
function tick(p: number): number {
  const t = p < 200 ? 1 : p < 500 ? 2 : p < 2000 ? 5 : p < 5000 ? 10 : 25
  return Math.round(p / t) * t
}

/** Persentase ARA berdasar harga — port PROFIT.araRate() baris 3189. */
function araRate(p: number): number {
  return p < 200 ? 35 : p <= 5000 ? 25 : 20
}

interface ProfitAraProps {
  feeBeli: number
  feeJual: number
}

/** Port panel "Profit & ARA/ARB" — markup index_live.html baris 1308-1387,
 *  objek PROFIT baris 3167-3239. */
export function ProfitAra({ feeBeli, feeJual }: ProfitAraProps) {
  const [posKode, setPosKode] = useState('')
  const [posLots, setPosLots] = useState('')
  const [posAvg, setPosAvg] = useState('')

  const [buy, setBuy] = useState('')
  const [sell, setSell] = useState('')
  const [lots, setLots] = useState('')
  const [araArbMode, setAraArbMode] = useState<'ara' | 'arb' | null>(null)

  function handleFill() {
    const lotsN = parseFloat(posLots) || 0
    const avgN = parseFloat(posAvg) || 0
    if (lotsN > 0) setLots(String(lotsN))
    if (avgN > 0) setBuy(String(avgN))
  }

  function handleSetMode(m: 'ara' | 'arb') {
    const buyN = parseFloat(buy) || 0
    if (!buyN) return
    const price = m === 'ara' ? tick(buyN * (1 + araRate(buyN) / 100)) : tick(buyN * (1 - 0.15))
    setSell(String(price))
    setAraArbMode(m)
  }

  const buyN = parseFloat(buy) || 0
  const sellN = parseFloat(sell) || 0
  const lotsN = parseFloat(lots) || 0
  const fb = feeBeli / 100
  const fs = feeJual / 100

  // Port PROFIT.calc() bagian profit — hanya tampil (grid) kalau sell>0, sama seperti sumber.
  const profit = useMemo(() => {
    if (!(buyN > 0 && lotsN > 0 && sellN > 0)) return null
    const shares = lotsN * 100
    const capital = buyN * shares * (1 + fb)
    const revenue = sellN * shares * (1 - fs)
    const fee = buyN * shares * fb + sellN * shares * fs
    const netProfit = revenue - capital
    const ret = capital > 0 ? (netProfit / capital) * 100 : 0
    return { capital, revenue, fee, netProfit, ret }
  }, [buyN, sellN, lotsN, fb, fs])

  // Port PROFIT.calc() bagian tabel ARA/ARB (baris 3221-3237).
  const araTable = useMemo(() => {
    if (!(buyN > 0)) return null
    const ara = araRate(buyN)
    const arb = 15
    const rows: { day: number; ap: number; bp: number }[] = []
    let ap = buyN
    let bp = buyN
    for (let d = 1; d <= 5; d++) {
      ap = tick(ap * (1 + ara / 100))
      bp = tick(bp * (1 - arb / 100))
      rows.push({ day: d, ap, bp })
    }
    return { ara, arb, rows }
  }, [buyN])

  return (
    <div className="adc-wrap">
      <div className="card adc-section">
        <div className="ct b">💰 Profit Calculator</div>
        <PosisiBar kode={posKode} onKode={setPosKode} lots={posLots} onLots={setPosLots} avg={posAvg} onAvg={setPosAvg} onFill={handleFill} />
        <div className="pc-grid2">
          <div className="adc-field">
            <label>Buy Price (IDR/saham)</label>
            <input className="adc-input" type="number" placeholder="0" min={0} value={buy} onChange={(e) => setBuy(e.target.value)} />
          </div>
          <div className="adc-field">
            <label>Sell Target (IDR/saham)</label>
            <input className="adc-input" type="number" placeholder="0" min={0} value={sell} onChange={(e) => setSell(e.target.value)} />
            <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
              <button className={`rr-preset${araArbMode === 'ara' ? ' active' : ''}`} style={{ flex: 1, fontSize: 10 }} onClick={() => handleSetMode('ara')}>
                ARA ▲
              </button>
              <button className={`rr-preset${araArbMode === 'arb' ? ' active' : ''}`} style={{ flex: 1, fontSize: 10 }} onClick={() => handleSetMode('arb')}>
                ARB ▼
              </button>
            </div>
          </div>
        </div>
        <div className="adc-field" style={{ marginBottom: 10 }}>
          <label>Lots (1 lot = 100 saham)</label>
          <input className="adc-input" type="number" placeholder="0" min={0} step={1} value={lots} onChange={(e) => setLots(e.target.value)} />
        </div>
        {profit && (
          <div className="pc-res">
            <div className="pc-ri hl">
              <div className="pc-rl">Net Profit</div>
              <div className="pc-rv" style={{ color: profit.netProfit >= 0 ? 'var(--cal-up)' : 'var(--cal-dn)' }}>
                Rp {fN(profit.netProfit, 0)}
              </div>
              <div className="pc-rs">IDR</div>
            </div>
            <div className="pc-ri hl">
              <div className="pc-rl">Return</div>
              <div className="pc-rv" style={{ color: profit.ret >= 0 ? 'var(--cal-up)' : 'var(--cal-dn)' }}>
                {(profit.ret >= 0 ? '+' : '') + profit.ret.toFixed(2)}%
              </div>
              <div className="pc-rs">setelah fee</div>
            </div>
            <div className="pc-ri">
              <div className="pc-rl">Total Modal</div>
              <div className="pc-rv">Rp {fN(profit.capital, 0)}</div>
              <div className="pc-rs">IDR (incl. fee beli)</div>
            </div>
            <div className="pc-ri">
              <div className="pc-rl">Total Nilai Jual</div>
              <div className="pc-rv">Rp {fN(profit.revenue, 0)}</div>
              <div className="pc-rs">IDR (setelah fee jual)</div>
            </div>
            <div className="pc-ri" style={{ gridColumn: '1/-1' }}>
              <div className="pc-rl">Total Fee & Pajak</div>
              <div className="pc-rv" style={{ fontSize: 13, color: 'var(--cal-dn)' }}>
                -Rp {fN(profit.fee, 0)}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card adc-section">
        <div className="ct b">
          📈 Proyeksi ARA / ARB
          <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--text3)', marginLeft: 6 }}>
            Berdasarkan harga beli · ARB = 15% (uniform, April 2025)
          </span>
        </div>
        <table className="ara-tbl">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Hari</th>
              <th>ARA (Limit Atas)</th>
              <th>ARB (Limit Bawah)</th>
            </tr>
          </thead>
          <tbody>
            {araTable ? (
              araTable.rows.map((row) => (
                <tr key={row.day}>
                  <td>
                    {row.day} <span style={{ color: 'var(--text3)' }}>T+{row.day}</span>
                  </td>
                  <td>
                    <span className="c-up">{row.ap.toLocaleString('id-ID')}</span>
                    <br />
                    <span className="pct-sm">+{araTable.ara}%</span>
                  </td>
                  <td>
                    <span className="c-dn">{row.bp.toLocaleString('id-ID')}</span>
                    <br />
                    <span className="pct-sm">-{araTable.arb}%</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} style={{ color: 'var(--text3)', textAlign: 'center', padding: 14 }}>
                  Isi Buy Price untuk melihat proyeksi
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="adc-disclaimer" style={{ marginTop: 8 }}>
          ARA: ≤Rp200 = +35% · Rp200–5000 = +25% · &gt;Rp5000 = +20% &nbsp;|&nbsp; ARB: 15% untuk semua harga
        </div>
      </div>
    </div>
  )
}
