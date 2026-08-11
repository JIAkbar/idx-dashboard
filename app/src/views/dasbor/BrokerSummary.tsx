import { useState } from 'react'
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

// Range aktif SELALU seluruh BS_AVAIL — angkanya identik dengan default lama
// (bsInit(): BS_FROM=BS_AVAIL[0], BS_TO=BS_AVAIL[last]), tapi sekarang konstan
// modul-level (bukan state) karena pemilih tanggal yang tampak hidup sudah
// dicopot (Task 10 Step 3) dan diganti chip status jujur di panel-h. Aman
// dihitung sekali di sini (bukan useMemo) — BS_DATA statis, tidak pernah berubah.
const BROKERS = bsAggBrokers(FIRST, LAST)
const FOREIGN = bsAggForeign(FIRST, LAST)
const NEGO_ROWS = BS_DATA.nego[LAST] ?? []

/**
 * Panel "Broker Summary (ALPHA)" — port index_live.html baris 5272-6037 +
 * bsInit()/bsRenderAll() dkk baris 5745-6037. Modul MANDIRI: data hardcode
 * (BS_DATA, cuma 3 hari 2026-06-02..04) — BEDA dari 7 menu lain yang fetch
 * /data/*.json. JANGAN sambungkan ke data live di sini (backlog terpisah,
 * lihat docs/RENCANA-REFACTOR-REACT.md).
 *
 * Task 10 gaya "Lantai Bursa": verifikasi sumber ringkasan broker harian IDX
 * dijalankan lebih dulu (scripts/cek_broker_summary.py) — kedua endpoint
 * kandidat diblokir Cloudflare (403 "Attention Required"), BUKAN data 88
 * broker yang ditemukan. Konsekuensi: reskin saja, TIDAK pindah ke data
 * live. Pemilih tanggal-range yang tampak "hidup" (BsDatePicker, dihapus)
 * diganti chip status tetap yang jujur soal data 3-hari-tak-diperbarui.
 */
export function BrokerSummary() {
  const [tab, setTab] = useState<Tab>('inventory')

  const totalNilai = BROKERS.reduce((s, b) => s + b.nilai, 0)
  const totalVol = BROKERS.reduce((s, b) => s + b.vol, 0)
  const totalFreq = BROKERS.reduce((s, b) => s + b.freq, 0)
  const activeBroker = BROKERS.filter((b) => b.nilai > 0).length
  const fgnUp = FOREIGN.net >= 0

  return (
    <div className="lantai">
      <div className="vhead">
        <h1>Broker Summary</h1>
        <span className="sub">ALPHA · akumulasi vs distribusi</span>
      </div>

      <div className="grid3">
        <div className="vcard">
          <span className="lbl">Total Broker Aktif</span>
          <span className="v-num num">{activeBroker}</span>
          <span className="v-note">dari {BROKERS.length} terdaftar</span>
        </div>
        <div className="vcard">
          <span className="lbl">Total Nilai Transaksi</span>
          <span className="v-num num">Rp {fmtB(totalNilai)}</span>
          <span className="v-note">{fmtLot(totalVol)}</span>
        </div>
        <div className="vcard">
          <span className="lbl">Foreign Net (Lot)</span>
          <span className={`v-num num ${fgnUp ? 'up' : 'dn'}`}>{fmtLot(FOREIGN.net)}</span>
          <span className="v-note">Buy {fmtLot(FOREIGN.buy)} / Sell {fmtLot(FOREIGN.sell)}</span>
        </div>
        <div className="vcard">
          <span className="lbl">Total Frekuensi</span>
          <span className="v-num num">{(totalFreq / 1e3).toFixed(0)}K</span>
          <span className="v-note">transaksi</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h">
          <div className="tabs" role="tablist" aria-label="Tab Broker Summary">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={'tab' + (tab === t.id ? ' on' : '')}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <span className="chip warn">Data contoh {dateLabel(FIRST)} – {dateLabel(LAST)} · tidak diperbarui</span>
        </div>
        <div className="panel-b">
          {tab === 'inventory' && <Inventory brokers={BROKERS} />}
          {tab === 'quadrant' && <Quadrant brokers={BROKERS} />}
          {tab === 'nego' && <Nego rows={NEGO_ROWS} />}
          {tab === 'flow' && <Flow />}
        </div>
      </div>
    </div>
  )
}
