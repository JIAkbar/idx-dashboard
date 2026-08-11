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
    <div className="lantai">
      <div className="vhead">
        <h1>Kalkulator JIA</h1>
        <span className="sub">alat hitung posisi</span>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={'tab' + (tab === t.id ? ' on' : '')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'avgdown' && <AvgDown />}
      {tab === 'profit' && (
        <ProfitAra feeBeli={feeBeli} feeJual={feeJual} setFeeBeli={setFeeBeli} setFeeJual={setFeeJual} />
      )}
      {tab === 'rr' && <RiskReward />}
      {tab === 'div' && <Dividen feeBeli={feeBeli} setFeeBeli={setFeeBeli} />}
    </div>
  )
}
