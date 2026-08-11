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
  setFeeBeli: (v: number) => void
  setFeeJual: (v: number) => void
}

/** Port panel "Profit & ARA/ARB" — markup index_live.html baris 1308-1387,
 *  objek PROFIT baris 3167-3239. */
export function ProfitAra({ feeBeli, feeJual, setFeeBeli, setFeeJual }: ProfitAraProps) {
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
    <div className="grid2 w-kiri">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="panel">
          <div className="panel-h" style={{ flexWrap: 'wrap', rowGap: 6 }}>
            <span className="lbl">💰 Profit Calculator</span>
            <div
              style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}
              title="Default: Beli 0.15% / Jual 0.25% (standard IDX/Stockbit)"
            >
              <span className="lbl" style={{ textTransform: 'none', letterSpacing: 0 }}>Fee Beli</span>
              <input
                className="inp"
                style={{ width: 72 }}
                type="number"
                min={0}
                max={5}
                step={0.01}
                value={feeBeli}
                onChange={(e) => setFeeBeli(parseFloat(e.target.value) || 0)}
              />
              <span className="lbl" style={{ textTransform: 'none', letterSpacing: 0 }}>Fee Jual</span>
              <input
                className="inp"
                style={{ width: 72 }}
                type="number"
                min={0}
                max={5}
                step={0.01}
                value={feeJual}
                onChange={(e) => setFeeJual(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="panel-b">
            <PosisiBar kode={posKode} onKode={setPosKode} lots={posLots} onLots={setPosLots} avg={posAvg} onAvg={setPosAvg} onFill={handleFill} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
              <div className="field">
                <span className="lbl">Buy Price (IDR/saham)</span>
                <input className="inp" type="number" placeholder="0" min={0} value={buy} onChange={(e) => setBuy(e.target.value)} />
              </div>
              <div className="field">
                <span className="lbl">Sell Target (IDR/saham)</span>
                <input className="inp" type="number" placeholder="0" min={0} value={sell} onChange={(e) => setSell(e.target.value)} />
                <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                  <button className={'tab' + (araArbMode === 'ara' ? ' on' : '')} style={{ flex: 1 }} onClick={() => handleSetMode('ara')}>
                    ARA ▲
                  </button>
                  <button className={'tab' + (araArbMode === 'arb' ? ' on' : '')} style={{ flex: 1 }} onClick={() => handleSetMode('arb')}>
                    ARB ▼
                  </button>
                </div>
              </div>
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <span className="lbl">Lots (1 lot = 100 saham)</span>
              <input className="inp" type="number" placeholder="0" min={0} step={1} value={lots} onChange={(e) => setLots(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <span className="lbl">📈 Proyeksi ARA / ARB</span>
            <span className="num" style={{ fontSize: 10, color: 'var(--text3)' }}>
              ARB = 15% (uniform, April 2025)
            </span>
          </div>
          <div className="panel-b">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Hari</th>
                  <th className="r">ARA (Limit Atas)</th>
                  <th className="r">ARB (Limit Bawah)</th>
                </tr>
              </thead>
              <tbody>
                {araTable ? (
                  araTable.rows.map((row) => (
                    <tr key={row.day}>
                      <td>
                        {row.day} <span style={{ color: 'var(--text3)' }}>T+{row.day}</span>
                      </td>
                      <td className="r num up">
                        {row.ap.toLocaleString('id-ID')}
                        <br />
                        <span style={{ fontSize: 10 }}>+{araTable.ara}%</span>
                      </td>
                      <td className="r num dn">
                        {row.bp.toLocaleString('id-ID')}
                        <br />
                        <span style={{ fontSize: 10 }}>-{araTable.arb}%</span>
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
            <div className="v-note" style={{ marginTop: 8 }}>
              ARA: ≤Rp200 = +35% · Rp200–5000 = +25% · &gt;Rp5000 = +20%
            </div>
          </div>
        </div>
      </div>

      {/* Hasil — menempel, terlihat langsung saat isian kiri berubah */}
      <div style={{ position: 'sticky', top: 60, alignSelf: 'start' }}>
        <div className="panel">
          <div className="panel-h"><span className="lbl">Hasil</span></div>
          <div className="panel-b">
            {profit ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <span className="lbl">Net Profit</span>
                  <div className="num" style={{ fontSize: 26, fontWeight: 600, color: profit.netProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    Rp {fN(profit.netProfit, 0)}
                  </div>
                  <div className="v-note">
                    Return {(profit.ret >= 0 ? '+' : '') + profit.ret.toFixed(2)}% setelah fee
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <div className="bm">
                    <span className="lbl">Total Modal</span>
                    <span className="num">Rp {fN(profit.capital, 0)}</span>
                  </div>
                  <div className="bm">
                    <span className="lbl">Total Nilai Jual</span>
                    <span className="num">Rp {fN(profit.revenue, 0)}</span>
                  </div>
                  <div className="bm">
                    <span className="lbl">Total Fee & Pajak</span>
                    <span className="num dn">-Rp {fN(profit.fee, 0)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="v-note">Isi Buy Price, Sell Target, dan Lots untuk melihat hasil</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
