import { useState, type ReactNode } from 'react'
import { AvgDown } from './kalkulator/AvgDown'
import { ProfitAra } from './kalkulator/ProfitAra'
import { RiskReward } from './kalkulator/RiskReward'
import { Dividen } from './kalkulator/Dividen'
import { Pemulihan } from './kalkulator/Pemulihan'
import { Piramida } from './kalkulator/Piramida'
import { Blender } from './kalkulator/Blender'
import { Bunga } from './kalkulator/Bunga'
import { IkonMenu, IKON_GRAFIK_TURUN, IKON_UANG, IKON_TIMBANGAN, IKON_UANG_KERTAS, IKON_ULANG, IKON_KUADRAN, IKON_TONG, IKON_GRAFIK_NAIK } from '../../components/dasbor/IkonMenu'

type Tab = 'avgdown' | 'profit' | 'rr' | 'div' | 'pulih' | 'piramida' | 'blender' | 'bunga'

const TABS: { id: Tab; label: ReactNode }[] = [
  { id: 'avgdown', label: <><IkonMenu d={IKON_GRAFIK_TURUN} size={13} /> Avg Down</> },
  { id: 'profit', label: <><IkonMenu d={IKON_UANG} size={13} /> Profit & ARA</> },
  { id: 'rr', label: <><IkonMenu d={IKON_TIMBANGAN} size={13} /> Risk/Reward</> },
  { id: 'div', label: <><IkonMenu d={IKON_UANG_KERTAS} size={13} /> Dividen</> },
  { id: 'pulih', label: <><IkonMenu d={IKON_ULANG} size={13} /> Pemulihan</> },
  { id: 'piramida', label: <><IkonMenu d={IKON_KUADRAN} size={13} /> Piramida</> },
  { id: 'blender', label: <><IkonMenu d={IKON_TONG} size={13} /> Blender Posisi</> },
  { id: 'bunga', label: <><IkonMenu d={IKON_GRAFIK_NAIK} size={13} /> Bunga-Berbunga</> },
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
    <div className="lantai kalkulator-view">
      <div className="vhead">
        <h1>Kalkulator</h1>
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
      {tab === 'div' && (
        <Dividen feeBeli={feeBeli} setFeeBeli={setFeeBeli} feeJual={feeJual} setFeeJual={setFeeJual} />
      )}
      {tab === 'pulih' && <Pemulihan />}
      {tab === 'piramida' && <Piramida />}
      {tab === 'blender' && <Blender />}
      {tab === 'bunga' && <Bunga />}
    </div>
  )
}
