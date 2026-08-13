import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BS_AVAIL, BS_DATA } from '../../lib/dasbor/brokerSummaryData'
import { useBrokerHarian, labelTanggal } from '../../lib/dasbor/brokerHarian'
import { dateLabel, fmtB, fmtLot } from '../../lib/dasbor/brokerSummaryFormat'
import { Inventory } from './broker-summary/Inventory'
import { Quadrant } from './broker-summary/Quadrant'
import { Nego } from './broker-summary/Nego'
import { Flow } from './broker-summary/Flow'
import { IkonMenu, IKON_GRAFIK_BATANG, IKON_ULANG, IKON_OMBAK, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'

type Tab = 'inventory' | 'quadrant' | 'nego' | 'flow'

const TABS: { id: Tab; label: ReactNode }[] = [
  { id: 'inventory', label: <><IkonMenu d={IKON_GRAFIK_BATANG} size={13} /> Inventory</> },
  { id: 'quadrant', label: '⊞ Kuadran' },
  { id: 'nego', label: <><IkonMenu d={IKON_ULANG} size={13} /> NEGO</> },
  { id: 'flow', label: <><IkonMenu d={IKON_OMBAK} size={13} /> Flow</> },
]

/** Tab yang konsumsi data broker agregat harian (dari harvester). */
const TAB_HARIAN: Record<Tab, boolean> = { inventory: true, quadrant: true, nego: false, flow: false }

const SAMPLE_FIRST = BS_AVAIL[0]
const SAMPLE_LAST = BS_AVAIL[BS_AVAIL.length - 1]
const NEGO_ROWS = BS_DATA.nego[SAMPLE_LAST] ?? []

/**
 * Panel "Broker Summary" — tab Inventory & Kuadran sekarang pakai data broker
 * HARIAN dari harvester (/data-idx/json/broker/index.json + bs_YYMMDD.json,
 * lihat lib/dasbor/brokerHarian.ts) dengan pemilih tanggal. Tab NEGO & Flow
 * masih data contoh tertanam 3 hari (BS_DATA, Jun 2026) karena jenis datanya
 * beda (per-saham nego & foreign flow) dan belum ada sumber hariannya —
 * chip status per tab jujur soal itu.
 */
export function BrokerSummary() {
  const [tab, setTab] = useState<Tab>('inventory')
  const { tanggalTersedia, tanggalAktif, rows, pilihTanggal, loading, error } = useBrokerHarian()

  // Dropdown tanggal (.dd) — pola buka/tutup sama dengan Kalender.tsx.
  const [ddOpen, setDdOpen] = useState(false)
  const ddRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setDdOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  const brokers = rows ?? []
  const totalNilai = brokers.reduce((s, b) => s + b.nilai, 0)
  const totalVol = brokers.reduce((s, b) => s + b.vol, 0)
  const totalFreq = brokers.reduce((s, b) => s + b.freq, 0)
  const activeBroker = brokers.filter((b) => b.nilai > 0).length
  const harian = TAB_HARIAN[tab]

  return (
    <div className="lantai">
      <div className="vhead">
        <h1>Broker Summary</h1>
        <span className="sub">akumulasi vs distribusi · sumber idx.co.id, harian otomatis</span>
      </div>

      <div className="grid3">
        <div className="vcard">
          <span className="lbl">Total Broker Aktif</span>
          <span className="v-num num">{rows ? activeBroker : '—'}</span>
          <span className="v-note">{rows ? `dari ${brokers.length} terdaftar` : 'memuat...'}</span>
        </div>
        <div className="vcard">
          <span className="lbl">Total Nilai Transaksi</span>
          <span className="v-num num">{rows ? `Rp ${fmtB(totalNilai)}` : '—'}</span>
          <span className="v-note">{rows ? fmtLot(totalVol) : 'memuat...'}</span>
        </div>
        <div className="vcard">
          <span className="lbl">Total Frekuensi</span>
          <span className="v-num num">{rows ? `${(totalFreq / 1e3).toFixed(0)}K` : '—'}</span>
          <span className="v-note">transaksi</span>
        </div>
        <div className="vcard">
          <span className="lbl">Tanggal Data</span>
          <span className="v-num num" style={{ fontSize: 20 }}>{tanggalAktif ? labelTanggal(tanggalAktif) : '—'}</span>
          <span className="v-note">{tanggalTersedia.length} hari tersedia</span>
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
          {harian ? (
            <div className={`dd${ddOpen ? ' open' : ''}`} ref={ddRef}>
              <button type="button" className="dd-btn" onClick={() => setDdOpen((v) => !v)}>
                {tanggalAktif ? labelTanggal(tanggalAktif) : 'Pilih tanggal'}
                <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
              </button>
              <div className="dd-menu">
                {[...tanggalTersedia].reverse().map((iso) => (
                  <button
                    key={iso}
                    type="button"
                    className={`dd-it${iso === tanggalAktif ? ' sel' : ''}`}
                    onClick={() => { pilihTanggal(iso); setDdOpen(false) }}
                  >
                    {labelTanggal(iso)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <span className="chip warn">Data contoh {dateLabel(SAMPLE_FIRST)} – {dateLabel(SAMPLE_LAST)} · tidak diperbarui</span>
          )}
        </div>
        <div className="panel-b">
          {harian && loading && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <p style={{ fontSize: 28 }}>⏳</p>
              <p className="lbl">Memuat data broker...</p>
            </div>
          )}
          {harian && !loading && (error || brokers.length === 0) && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
              <p className="lbl">{error ? `Gagal memuat data broker (${error})` : 'Belum ada data broker harian'}</p>
            </div>
          )}
          {harian && !loading && !error && brokers.length > 0 && (
            <>
              {tab === 'inventory' && <Inventory brokers={brokers} />}
              {tab === 'quadrant' && <Quadrant brokers={brokers} />}
            </>
          )}
          {tab === 'nego' && <Nego rows={NEGO_ROWS} />}
          {tab === 'flow' && <Flow />}
        </div>
      </div>
    </div>
  )
}
