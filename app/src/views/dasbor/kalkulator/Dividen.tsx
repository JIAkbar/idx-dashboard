import { useMemo, useState } from 'react'
import { fN } from '../../../lib/dasbor/format'
import { PosisiBar } from './PosisiBar'

interface DividenProps {
  feeBeli: number
}

/** Port panel "Dividen" — markup index_live.html baris 1467-1538, objek
 *  DIVCALC baris 3310-3363. */
export function Dividen({ feeBeli }: DividenProps) {
  const [posKode, setPosKode] = useState('')
  const [posLots, setPosLots] = useState('')
  const [posAvg, setPosAvg] = useState('')

  const [buy, setBuy] = useState('')
  const [lots, setLots] = useState('')
  const [dps, setDps] = useState('')
  const [tax, setTax] = useState('10')
  const [incFee, setIncFee] = useState(true)

  function handleFill() {
    const lotsN = parseFloat(posLots) || 0
    const avgN = parseFloat(posAvg) || 0
    if (lotsN > 0) setLots(String(lotsN))
    if (avgN > 0) setBuy(String(avgN))
  }

  const buyN = parseFloat(buy) || 0
  const lotsN = parseFloat(lots) || 0
  const dpsN = parseFloat(dps) || 0
  const taxN = parseFloat(tax) || 10
  const fb = incFee ? feeBeli / 100 : 0

  const result = useMemo(() => {
    if (!buyN || !lotsN || !dpsN) return null
    const shares = lotsN * 100
    const invest = buyN * shares * (1 + fb)
    const divGross = dpsN * shares
    const taxAmt = (divGross * taxN) / 100
    const divNet = divGross - taxAmt
    const yieldGross = (divGross / invest) * 100
    const yieldNet = (divNet / invest) * 100
    const bep = Math.max(0, (invest - divNet) / shares)

    const scenarios = [
      { label: 'Market @ Break-even', price: bep },
      { label: 'Saham turun 5%', price: buyN * 0.95 },
      { label: 'Saham turun 10%', price: buyN * 0.9 },
      { label: 'ARB (turun 15%)', price: buyN * 0.85 },
      { label: 'Turun 30%', price: buyN * 0.7 },
    ].map((sc) => {
      const mktVal = sc.price * shares
      const netGL = mktVal + divNet - invest
      const netPct = (netGL / invest) * 100
      return { ...sc, netGL, netPct }
    })

    return { invest, divGross, taxAmt, divNet, yieldGross, yieldNet, bep, scenarios }
  }, [buyN, lotsN, dpsN, taxN, fb])

  return (
    <div className="adc-wrap">
      <div className="card adc-section">
        <div className="ct b">💵 Dividend Calculator</div>
        <PosisiBar kode={posKode} onKode={setPosKode} lots={posLots} onLots={setPosLots} avg={posAvg} onAvg={setPosAvg} onFill={handleFill} />
        <div className="pc-grid2" style={{ marginBottom: 8 }}>
          <div className="adc-field">
            <label>Avg Buy Price (IDR/saham)</label>
            <input className="adc-input" type="number" placeholder="0" min={0} value={buy} onChange={(e) => setBuy(e.target.value)} />
          </div>
          <div className="adc-field">
            <label>Lots (1 lot = 100 saham)</label>
            <input className="adc-input" type="number" placeholder="0" min={0} value={lots} onChange={(e) => setLots(e.target.value)} />
          </div>
          <div className="adc-field">
            <label>Dividen / Saham (IDR)</label>
            <input className="adc-input" type="number" placeholder="0" min={0} value={dps} onChange={(e) => setDps(e.target.value)} />
          </div>
          <div className="adc-field">
            <label>Pajak Dividen (%)</label>
            <input className="adc-input" type="number" value={tax} min={0} max={100} step={0.5} onChange={(e) => setTax(e.target.value)} />
            <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>WNI OP: 10% final</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--text2)' }}>Sertakan fee beli dalam modal</label>
          <input type="checkbox" checked={incFee} onChange={(e) => setIncFee(e.target.checked)} />
        </div>
        {result && (
          <div>
            <div className="div-bep">
              <div className="div-bep-l">Break-even Market Price</div>
              <div className="div-bep-v">Rp {fN(result.bep, 0)}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.75)', marginTop: 4 }}>
                Harga saham agar total portfolio = modal awal
              </div>
            </div>
            <div className="pc-res" style={{ marginBottom: 10 }}>
              <div className="pc-ri hl">
                <div className="pc-rl">Total Dividen (Net)</div>
                <div className="pc-rv">Rp {fN(result.divNet, 0)}</div>
                <div className="pc-rs">Gross: Rp {fN(result.divGross, 0)}</div>
              </div>
              <div className="pc-ri hl">
                <div className="pc-rl">Yield Net</div>
                <div className="pc-rv">{result.yieldNet.toFixed(2)}%</div>
                <div className="pc-rs">Gross: {result.yieldGross.toFixed(2)}%</div>
              </div>
              <div className="pc-ri">
                <div className="pc-rl">Total Investasi</div>
                <div className="pc-rv" style={{ fontSize: 13 }}>Rp {fN(result.invest, 0)}</div>
              </div>
              <div className="pc-ri">
                <div className="pc-rl">Pajak Dividen</div>
                <div className="pc-rv" style={{ fontSize: 13, color: 'var(--cal-dn)' }}>-Rp {fN(result.taxAmt, 0)}</div>
              </div>
            </div>
            <div className="ct b" style={{ fontSize: 11, marginBottom: 6 }}>📊 Post-Dividend Scenarios</div>
            <div>
              {result.scenarios.map((sc) => (
                <div className="div-sc" key={sc.label}>
                  <div>
                    <div className="div-sc-l">{sc.label}</div>
                    <div className="div-sc-p">Harga: Rp {fN(sc.price, 0)}</div>
                  </div>
                  <div className="div-sc-v" style={{ color: sc.netGL >= 0 ? 'var(--cal-up)' : 'var(--cal-dn)' }}>
                    {sc.netGL >= 0 ? '+' : ''}Rp {fN(sc.netGL, 0)}
                    <br />
                    <span style={{ fontSize: 10 }}>
                      ({sc.netGL >= 0 ? '+' : ''}
                      {sc.netPct.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
