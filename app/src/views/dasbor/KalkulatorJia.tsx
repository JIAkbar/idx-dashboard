import { useState } from 'react'
import { AvgDown } from './kalkulator/AvgDown'
import { ProfitAra } from './kalkulator/ProfitAra'
import { RiskReward } from './kalkulator/RiskReward'
import { Dividen } from './kalkulator/Dividen'

type Tab = 'avgdown' | 'profit' | 'rr' | 'div'

const TABS: { id: Tab; label: string }[] = [
  { id: 'avgdown', label: '📉 Avg Down' },
  { id: 'profit', label: '💰 Profit & ARA' },
  { id: 'rr', label: '⚖️ Risk/Reward' },
  { id: 'div', label: '💵 Dividen' },
]

/**
 * Port panel "Kalkulator JIA" — markup index_live.html baris 1119-1538, objek
 * JIA (fee bar + tab switch) baris 3100-3115. Murni kalkulator client-side +
 * localStorage (ADC saja) — TIDAK ada fetch data harian di sini.
 */
export function KalkulatorJia() {
  const [tab, setTab] = useState<Tab>('avgdown')
  const [feeBeli, setFeeBeli] = useState(0.15)
  const [feeJual, setFeeJual] = useState(0.25)

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="jia-fee-bar">
        <label>💸 Fee Beli</label>
        <input
          className="jia-fee-in"
          type="number"
          min={0}
          max={5}
          step={0.01}
          value={feeBeli}
          onChange={(e) => setFeeBeli(parseFloat(e.target.value) || 0)}
        />
        <label>%</label>
        <label style={{ marginLeft: 8 }}>Fee Jual</label>
        <input
          className="jia-fee-in"
          type="number"
          min={0}
          max={5}
          step={0.01}
          value={feeJual}
          onChange={(e) => setFeeJual(parseFloat(e.target.value) || 0)}
        />
        <label>%</label>
        <span className="jia-fee-note">Default: Beli 0.15% / Jual 0.25% (standard IDX/Stockbit)</span>
      </div>

      <div className="jia-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`jia-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="jia-content active">
        {tab === 'avgdown' && <AvgDown />}
        {tab === 'profit' && <ProfitAra feeBeli={feeBeli} feeJual={feeJual} />}
        {tab === 'rr' && <RiskReward />}
        {tab === 'div' && <Dividen feeBeli={feeBeli} />}
      </div>
    </div>
  )
}
