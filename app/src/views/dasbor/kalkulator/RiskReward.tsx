import { useMemo, useState } from 'react'
import { fN } from '../../../lib/dasbor/format'
import { PosisiBar } from './PosisiBar'

const PRESETS = [1, 2, 3, 4, 5]

/** Port panel "Risk/Reward" — markup index_live.html baris 1390-1464, objek RR
 *  baris 3242-3307. */
export function RiskReward() {
  const [posKode, setPosKode] = useState('')
  const [posLots, setPosLots] = useState('')
  const [posAvg, setPosAvg] = useState('')

  const [entry, setEntry] = useState('')
  const [sl, setSl] = useState('')
  const [tp, setTp] = useState('')
  const [lots, setLots] = useState('')
  const [preset, setPreset] = useState(3)

  function handleFill() {
    const lotsN = parseFloat(posLots) || 0
    const avgN = parseFloat(posAvg) || 0
    // Sumber asli (POSISI.fill('rr')) menulis ke id 'rr-pos' yang tidak ada di markup RR
    // (bug: field lots tidak pernah terisi). Di sini diisi dua-duanya sesuai maksud tombolnya.
    if (avgN > 0) setEntry(String(avgN))
    if (lotsN > 0) setLots(String(lotsN))
  }

  function handlePreset(r: number) {
    setPreset(r)
    const entryN = parseFloat(entry) || 0
    const slN = parseFloat(sl) || 0
    if (entryN > 0 && slN > 0 && slN < entryN) {
      const risk = entryN - slN
      setTp((entryN + risk * r).toFixed(0))
    }
  }

  const entryN = parseFloat(entry) || 0
  const slN = parseFloat(sl) || 0
  const tpN = parseFloat(tp) || 0
  const lotsN = parseFloat(lots) || 0

  const slNote = entryN > 0 && slN > 0 ? `Risk: Rp ${fN(entryN - slN, 0)} per saham` : ''
  const tpNote = entryN > 0 && tpN > 0 ? `Reward: Rp ${fN(tpN - entryN, 0)} per saham` : ''

  const result = useMemo(() => {
    if (!entryN || !slN || !tpN || slN >= entryN || tpN <= entryN) return null
    const risk = entryN - slN
    const reward = tpN - entryN
    const ratio = reward / risk
    const shares = lotsN > 0 ? lotsN * 100 : 100
    const total = risk + reward
    return {
      ratio,
      slPct: (risk / total) * 100,
      tpPct: (reward / total) * 100,
      riskIdr: risk * shares,
      profitIdr: reward * shares,
      riskPctPerSaham: (risk / entryN) * 100,
      rewardPctPerSaham: (reward / entryN) * 100,
    }
  }, [entryN, slN, tpN, lotsN])

  const verdictText = result
    ? result.ratio >= 2
      ? '✅ Setup bagus (R:R ≥ 1:2)'
      : result.ratio >= 1
        ? '⚠️ Minimal (R:R 1:1 – 1:2)'
        : '❌ Kurang ideal (R:R < 1:1)'
    : ''
  const verdictColor = result ? (result.ratio >= 2 ? 'var(--cal-up)' : result.ratio >= 1 ? '#f59e0b' : 'var(--cal-dn)') : 'var(--text3)'

  return (
    <div className="adc-wrap">
      <div className="card adc-section">
        <div className="ct b">⚖️ Risk/Reward Calculator</div>
        <PosisiBar kode={posKode} onKode={setPosKode} lots={posLots} onLots={setPosLots} avg={posAvg} onAvg={setPosAvg} onFill={handleFill} />
        <div className="pc-grid2" style={{ marginBottom: 8 }}>
          <div className="adc-field">
            <label>Entry Price (IDR)</label>
            <input className="adc-input" type="number" placeholder="0" min={0} value={entry} onChange={(e) => setEntry(e.target.value)} />
          </div>
          <div className="adc-field">
            <label>Stop Loss (IDR)</label>
            <input className="adc-input" type="number" placeholder="0" min={0} value={sl} onChange={(e) => setSl(e.target.value)} />
            <div style={{ fontSize: 10, color: 'var(--cal-dn)', marginTop: 3 }}>{slNote}</div>
          </div>
          <div className="adc-field">
            <label>Target Profit (IDR)</label>
            <input className="adc-input" type="number" placeholder="0" min={0} value={tp} onChange={(e) => setTp(e.target.value)} />
            <div style={{ fontSize: 10, color: 'var(--cal-up)', marginTop: 3 }}>{tpNote}</div>
          </div>
          <div className="adc-field">
            <label>Posisi (Lot) — opsional</label>
            <input className="adc-input" type="number" placeholder="0" min={0} value={lots} onChange={(e) => setLots(e.target.value)} />
          </div>
        </div>
        <div className="rr-preset-row">
          <span style={{ fontSize: 10, color: 'var(--text3)', alignSelf: 'center' }}>Target R:R</span>
          {PRESETS.map((r) => (
            <button key={r} className={`rr-preset${preset === r ? ' active' : ''}`} onClick={() => handlePreset(r)}>
              1:{r}
            </button>
          ))}
        </div>
        {result && (
          <div>
            <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 12, marginBottom: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                Risk : Reward Ratio
              </div>
              <div className="rr-big">1 : {result.ratio.toFixed(2)}</div>
              <div style={{ fontSize: 11, marginTop: 4, color: verdictColor }}>{verdictText}</div>
            </div>
            <div className="rr-bar-wrap">
              <div className="rr-bar-sl" style={{ width: `${result.slPct}%` }} />
              <div className="rr-bar-mid" />
              <div className="rr-bar-tp" style={{ width: `${result.tpPct}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text3)', marginBottom: 8 }}>
              <span>Stop Loss</span>
              <span>Entry</span>
              <span>Target</span>
            </div>
            <div className="pc-res">
              <div className="pc-ri" style={{ background: 'rgba(220,38,38,.12)' }}>
                <div className="pc-rl">Total Risiko</div>
                <div className="pc-rv" style={{ color: '#dc2626', fontSize: 13 }}>
                  Rp {fN(result.riskIdr, 0)}
                </div>
                <div className="pc-rs">
                  {lotsN > 0 ? `${lotsN} lot · ${result.riskPctPerSaham.toFixed(2)}% per saham` : `${result.riskPctPerSaham.toFixed(2)}% per saham`}
                </div>
              </div>
              <div className="pc-ri" style={{ background: 'rgba(22,163,74,.12)' }}>
                <div className="pc-rl">Potensi Profit</div>
                <div className="pc-rv" style={{ color: '#16a34a', fontSize: 13 }}>
                  Rp {fN(result.profitIdr, 0)}
                </div>
                <div className="pc-rs">
                  {lotsN > 0 ? `${lotsN} lot · ${result.rewardPctPerSaham.toFixed(2)}% per saham` : `${result.rewardPctPerSaham.toFixed(2)}% per saham`}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
