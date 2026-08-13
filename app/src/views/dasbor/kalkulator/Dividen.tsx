import { useMemo, useState } from 'react'
import { fN } from '../../../lib/dasbor/format'
import { PosisiBar } from './PosisiBar'
import { IkonMenu, IKON_UANG_KERTAS, IKON_GRAFIK_BATANG } from '../../../components/dasbor/IkonMenu'

interface DividenProps {
  feeBeli: number
  setFeeBeli: (v: number) => void
}

/** Port panel "Dividen" — markup index_live.html baris 1467-1538, objek
 *  DIVCALC baris 3310-3363. */
export function Dividen({ feeBeli, setFeeBeli }: DividenProps) {
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
    <div className="grid2 w-kiri">
      <div>
        <div className="panel">
          <div className="panel-h" style={{ flexWrap: 'wrap', rowGap: 6 }}>
            <span className="lbl"><IkonMenu d={IKON_UANG_KERTAS} size={13} /> Dividend Calculator</span>
            <div
              style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}
              title="Default: Beli 0.15% (standard IDX/Stockbit)"
            >
              <span className="lbl" style={{ textTransform: 'none', letterSpacing: 0 }}>Fee Beli</span>
              <input
                className="inp"
                style={{ width: 72 }}
                type="number"
                min={0}
                max={5}
                step={0.01}
                name="feeBeli" value={feeBeli}
                aria-label="Fee beli (persen)"
                onChange={(e) => setFeeBeli(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="panel-b">
            <PosisiBar kode={posKode} onKode={setPosKode} lots={posLots} onLots={setPosLots} avg={posAvg} onAvg={setPosAvg} onFill={handleFill} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10, marginBottom: 8 }}>
              <div className="field">
                <span className="lbl">Avg Buy Price (IDR/saham)</span>
                <input className="inp" type="number" name="buy" placeholder="0" min={0} value={buy} onChange={(e) => setBuy(e.target.value)} />
              </div>
              <div className="field">
                <span className="lbl">Lots (1 lot = 100 saham)</span>
                <input className="inp" type="number" name="lots" placeholder="0" min={0} value={lots} onChange={(e) => setLots(e.target.value)} />
              </div>
              <div className="field">
                <span className="lbl">Dividen / Saham (IDR)</span>
                <input className="inp" type="number" name="dps" placeholder="0" min={0} value={dps} onChange={(e) => setDps(e.target.value)} />
              </div>
              <div className="field">
                <span className="lbl">Pajak Dividen (%)</span>
                <input className="inp" type="number" name="tax" value={tax} min={0} max={100} step={0.5} onChange={(e) => setTax(e.target.value)} />
                <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>WNI OP: 10% final</div>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text2)', cursor: 'pointer' }}>
              Sertakan fee beli dalam modal
              <input type="checkbox" name="incFee" checked={incFee} onChange={(e) => setIncFee(e.target.checked)} />
            </label>
          </div>
        </div>
      </div>

      {/* Hasil — menempel, terlihat langsung saat isian kiri berubah */}
      <div style={{ position: 'sticky', top: 60, alignSelf: 'start' }}>
        <div className="panel">
          <div className="panel-h"><span className="lbl">Hasil</span></div>
          <div className="panel-b">
            {result ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="vcard">
                  <span className="lbl">Break-even Market Price</span>
                  <div className="num" style={{ fontSize: 26, fontWeight: 600, color: 'var(--amber)' }}>Rp {fN(result.bep, 0)}</div>
                  <div className="v-note">Harga saham agar total portfolio = modal awal</div>
                </div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <div className="bm">
                    <span className="lbl">Total Dividen (Net)</span>
                    <span className="num">Rp {fN(result.divNet, 0)}</span>
                    <div className="v-note">Gross: Rp {fN(result.divGross, 0)}</div>
                  </div>
                  <div className="bm">
                    <span className="lbl">Yield Net</span>
                    <span className="num">{result.yieldNet.toFixed(2)}%</span>
                    <div className="v-note">Gross: {result.yieldGross.toFixed(2)}%</div>
                  </div>
                  <div className="bm">
                    <span className="lbl">Total Investasi</span>
                    <span className="num">Rp {fN(result.invest, 0)}</span>
                  </div>
                  <div className="bm">
                    <span className="lbl">Pajak Dividen</span>
                    <span className="num dn">-Rp {fN(result.taxAmt, 0)}</span>
                  </div>
                </div>
                <div>
                  <span className="lbl"><IkonMenu d={IKON_GRAFIK_BATANG} size={13} /> Post-Dividend Scenarios</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                    {result.scenarios.map((sc) => (
                      <div
                        key={sc.label}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line)' }}
                      >
                        <div>
                          <div style={{ fontSize: 12 }}>{sc.label}</div>
                          <div className="v-note">Harga: Rp {fN(sc.price, 0)}</div>
                        </div>
                        <div className={`num ${sc.netGL >= 0 ? 'up' : 'dn'}`} style={{ textAlign: 'right' }}>
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
              </div>
            ) : (
              <div className="v-note">Isi Avg Buy Price, Lots, dan Dividen/Saham untuk melihat hasil</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
