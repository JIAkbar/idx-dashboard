import { useMemo, useState } from 'react'
import { BsDatePicker } from '../../components/dasbor/BsDatePicker'
import { BS_AVAIL, BS_DATA } from '../../lib/dasbor/brokerSummaryData'
import { bsAggBrokers, bsAggForeign } from '../../lib/dasbor/brokerSummaryAgg'
import { dateLabel, fmtB, fmtLot } from '../../lib/dasbor/brokerSummaryFormat'
import { Inventory } from './broker-summary/Inventory'
import { Quadrant } from './broker-summary/Quadrant'
import { Nego } from './broker-summary/Nego'
import { Flow } from './broker-summary/Flow'

type Tab = 'inventory' | 'quadrant' | 'nego' | 'flow'

const TABS: { id: Tab; label: string }[] = [
  { id: 'inventory', label: '📊 Inventory' },
  { id: 'quadrant', label: '⊞ Kuadran' },
  { id: 'nego', label: '🔄 NEGO' },
  { id: 'flow', label: '🌊 Flow' },
]

const FIRST = BS_AVAIL[0]
const LAST = BS_AVAIL[BS_AVAIL.length - 1]

/**
 * Panel "Broker Summary (ALPHA)" — port index_live.html baris 5272-6037 +
 * bsInit()/bsRenderAll() dkk baris 5745-6037. Modul MANDIRI: data hardcode
 * (BS_DATA, cuma 3 hari 2026-06-02..04) — BEDA dari 7 menu lain yang fetch
 * /data/*.json. Preset 3M/6M/1Y sengaja terkunci di BsDatePicker karena data
 * asli cuma 3 hari; JANGAN sambungkan ke data live di sini (backlog terpisah).
 *
 * Default range aktif = seluruh BS_AVAIL (bukan cuma 1 hari), sama seperti
 * bsInit(): BS_FROM=BS_AVAIL[0], BS_TO=BS_AVAIL[last].
 */
export function BrokerSummary() {
  const [from, setFrom] = useState(FIRST)
  const [to, setTo] = useState(LAST)
  const [tab, setTab] = useState<Tab>('inventory')
  const [pickerOpen, setPickerOpen] = useState(false)

  const brokers = useMemo(() => bsAggBrokers(from, to), [from, to])
  const foreign = useMemo(() => bsAggForeign(from, to), [from, to])
  // NEGO tidak diagregasi range — snapshot BS_DATE = akhir range aktif.
  const negoRows = BS_DATA.nego[to] ?? []

  const totalNilai = brokers.reduce((s, b) => s + b.nilai, 0)
  const totalVol = brokers.reduce((s, b) => s + b.vol, 0)
  const totalFreq = brokers.reduce((s, b) => s + b.freq, 0)
  const activeBroker = brokers.filter((b) => b.nilai > 0).length
  const fgnColor = foreign.net >= 0 ? '#22c55e' : '#ef4444'

  const dateRangeLabel = `${BS_DATA.dates[0].label} – ${BS_DATA.dates[BS_DATA.dates.length - 1].label} 2026`
  const activeLabel = from === to ? dateLabel(from) : `${dateLabel(from)} → ${dateLabel(to)}`

  return (
    <div className="bs-wrap">
      <div className="bs-hdr">
        <div className="bs-hdr-left">
          <span className="bs-hdr-title">Broker Summary</span>
          <span className="bs-alpha">ALPHA</span>
          <span style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 4 }}>Data IDX: {dateRangeLabel}</span>
        </div>
        <button type="button" className="bs-date-btn" onClick={() => setPickerOpen(true)}>
          <span>📅</span> <span>{activeLabel}</span> <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
        </button>
      </div>

      <div className="bs-cards">
        <div className="bs-card">
          <div className="bs-card-label">Total Broker Aktif</div>
          <div className="bs-card-value">{activeBroker}</div>
          <div className="bs-card-sub">dari {brokers.length} terdaftar</div>
        </div>
        <div className="bs-card">
          <div className="bs-card-label">Total Nilai Transaksi</div>
          <div className="bs-card-value">Rp {fmtB(totalNilai)}</div>
          <div className="bs-card-sub">{fmtLot(totalVol)}</div>
        </div>
        <div className="bs-card">
          <div className="bs-card-label">Foreign Net (Lot)</div>
          <div className="bs-card-value" style={{ color: fgnColor }}>{fmtLot(foreign.net)}</div>
          <div className="bs-card-sub">Buy {fmtLot(foreign.buy)} / Sell {fmtLot(foreign.sell)}</div>
        </div>
        <div className="bs-card">
          <div className="bs-card-label">Total Frekuensi</div>
          <div className="bs-card-value">{(totalFreq / 1e3).toFixed(0)}K</div>
          <div className="bs-card-sub">transaksi</div>
        </div>
      </div>

      <div className="bs-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`bs-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'inventory' && <Inventory brokers={brokers} />}
      {tab === 'quadrant' && <Quadrant brokers={brokers} />}
      {tab === 'nego' && <Nego rows={negoRows} />}
      {tab === 'flow' && <Flow />}

      <div style={{ height: 20 }} />

      <BsDatePicker
        open={pickerOpen}
        activeFrom={from}
        activeTo={to}
        onApply={(f, t) => { setFrom(f); setTo(t); setPickerOpen(false) }}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  )
}
