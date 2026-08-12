import { useMemo, useState } from 'react'
import { fN } from '../../../lib/dasbor/format'
import { PosisiBar } from './PosisiBar'
import { IkonMenu, IKON_TIMBANGAN, IKON_CENTANG, IKON_PERINGATAN, IKON_SILANG } from '../../../components/dasbor/IkonMenu'

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
      ? <><IkonMenu d={IKON_CENTANG} size={11} /> Setup bagus (R:R ≥ 1:2)</>
      : result.ratio >= 1
        ? <><IkonMenu d={IKON_PERINGATAN} size={11} /> Minimal (R:R 1:1 – 1:2)</>
        : <><IkonMenu d={IKON_SILANG} size={11} /> Kurang ideal (R:R {'<'} 1:1)</>
    : ''
  const verdictColor = result ? (result.ratio >= 2 ? 'var(--cal-up)' : result.ratio >= 1 ? '#f59e0b' : 'var(--cal-dn)') : 'var(--text3)'

  return (
    <div className="grid2 w-kiri">
      <div>
        <div className="panel">
          <div className="panel-h"><span className="lbl"><IkonMenu d={IKON_TIMBANGAN} size={13} /> Risk/Reward Calculator</span></div>
          <div className="panel-b">
            <PosisiBar kode={posKode} onKode={setPosKode} lots={posLots} onLots={setPosLots} avg={posAvg} onAvg={setPosAvg} onFill={handleFill} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10, marginBottom: 8 }}>
              <div className="field">
                <span className="lbl">Entry Price (IDR)</span>
                <input className="inp" type="number" placeholder="0" min={0} value={entry} onChange={(e) => setEntry(e.target.value)} />
              </div>
              <div className="field">
                <span className="lbl">Stop Loss (IDR)</span>
                <input className="inp" type="number" placeholder="0" min={0} value={sl} onChange={(e) => setSl(e.target.value)} />
                <div className="v-note" style={{ color: 'var(--red)', marginTop: 3 }}>{slNote}</div>
              </div>
              <div className="field">
                <span className="lbl">Target Profit (IDR)</span>
                <input className="inp" type="number" placeholder="0" min={0} value={tp} onChange={(e) => setTp(e.target.value)} />
                <div className="v-note" style={{ color: 'var(--green)', marginTop: 3 }}>{tpNote}</div>
              </div>
              <div className="field">
                <span className="lbl">Posisi (Lot) — opsional</span>
                <input className="inp" type="number" placeholder="0" min={0} value={lots} onChange={(e) => setLots(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="lbl">Target R:R</span>
              {PRESETS.map((r) => (
                <button key={r} className={'tab' + (preset === r ? ' on' : '')} onClick={() => handlePreset(r)}>
                  1:{r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Hasil — menempel, terlihat langsung saat isian kiri berubah */}
      <div style={{ position: 'sticky', top: 60, alignSelf: 'start' }}>
        <div className="panel">
          <div className="panel-h"><span className="lbl">Hasil</span></div>
          <div className="panel-b">
            {result ? (
              <div>
                <div className="vcard" style={{ alignItems: 'center', textAlign: 'center' }}>
                  <span className="lbl">Risk : Reward Ratio</span>
                  <div className="num" style={{ fontSize: 28, fontWeight: 600, color: 'var(--amber)' }}>
                    1 : {result.ratio.toFixed(2)}
                  </div>
                  <div className="v-note" style={{ color: verdictColor }}>{verdictText}</div>
                </div>
                <div className="rr-bar-wrap" style={{ marginTop: 10 }}>
                  <div className="rr-bar-sl" style={{ width: `${result.slPct}%` }} />
                  <div className="rr-bar-mid" />
                  <div className="rr-bar-tp" style={{ width: `${result.tpPct}%` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text3)', marginBottom: 10 }}>
                  <span>Stop Loss</span>
                  <span>Entry</span>
                  <span>Target</span>
                </div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <div className="bm">
                    <span className="lbl">Total Risiko</span>
                    <span className="num dn">Rp {fN(result.riskIdr, 0)}</span>
                    <div className="v-note">
                      {lotsN > 0 ? `${lotsN} lot · ${result.riskPctPerSaham.toFixed(2)}% per saham` : `${result.riskPctPerSaham.toFixed(2)}% per saham`}
                    </div>
                  </div>
                  <div className="bm">
                    <span className="lbl">Potensi Profit</span>
                    <span className="num up">Rp {fN(result.profitIdr, 0)}</span>
                    <div className="v-note">
                      {lotsN > 0 ? `${lotsN} lot · ${result.rewardPctPerSaham.toFixed(2)}% per saham` : `${result.rewardPctPerSaham.toFixed(2)}% per saham`}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="v-note">Isi Entry, Stop Loss, dan Target Profit untuk melihat hasil</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
