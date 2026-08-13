import { useState, type ReactNode } from 'react'
import { BS_AVAIL, BS_DATA } from '../../lib/dasbor/brokerSummaryData'
import { useBrokerHarian, labelTanggal } from '../../lib/dasbor/brokerHarian'
import { dateLabel, fmtB, fmtLot } from '../../lib/dasbor/brokerSummaryFormat'
import { Inventory } from './broker-summary/Inventory'
import { Quadrant } from './broker-summary/Quadrant'
import { Nego } from './broker-summary/Nego'
import { Flow } from './broker-summary/Flow'
import { IkonMenu, IKON_GRAFIK_BATANG, IKON_ULANG, IKON_OMBAK, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'
import { Dropdown } from '../../components/dasbor/Dropdown'

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

/** Preset mode Rentang: mundur hari kalender dari tanggal berdata terakhir —
 * pilihRentang otomatis snap ke hari berdata di dalamnya. */
const PRESET_BROKER: { id: 'w1' | 'b1'; label: string; hari: number }[] = [
  { id: 'w1', label: '1 Minggu', hari: 7 },
  { id: 'b1', label: '1 Bulan', hari: 30 },
]

function mundurIso(iso: string, hari: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() - hari)
  return d.toISOString().slice(0, 10)
}

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
  const { tanggalTersedia, tanggalAktif, rows, rentang, pilihTanggal, pilihRentang, loading, error } = useBrokerHarian()

  // ─── Mode Rentang (#75): agregat SUM 88 broker sepanjang hari-berdata ──
  const [modeRentang, setModeRentang] = useState(false)
  const [preset, setPreset] = useState<'w1' | 'b1'>('w1')

  function keRentang(p: 'w1' | 'b1') {
    const akhir = tanggalTersedia[tanggalTersedia.length - 1]
    if (!akhir) return
    setModeRentang(true)
    setPreset(p)
    pilihRentang(mundurIso(akhir, PRESET_BROKER.find((x) => x.id === p)!.hari), akhir)
  }

  function keHarian() {
    setModeRentang(false)
    // pilihTanggal sekalian membersihkan state rentang di hook.
    const iso = tanggalAktif ?? tanggalTersedia[tanggalTersedia.length - 1]
    if (iso) pilihTanggal(iso)
  }

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
          <span className="lbl">{rentang ? 'Rentang Data' : 'Tanggal Data'}</span>
          <span className="v-num num" style={{ fontSize: rentang ? 15 : 20 }}>
            {rentang
              ? `${labelTanggal(rentang.mulai)} – ${labelTanggal(rentang.akhir)}`
              : tanggalAktif ? labelTanggal(tanggalAktif) : '—'}
          </span>
          <span className="v-note">{rentang ? `agregat ${rentang.nHari} hari bursa` : `${tanggalTersedia.length} hari tersedia`}</span>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {/* Toggle mode + pemilih: Harian → Dropdown tanggal; Rentang →
                  preset agregat (snap ke hari berdata, lihat pilihRentang). */}
              <div className="tabs" role="tablist" aria-label="Mode data broker">
                <button type="button" role="tab" aria-selected={!modeRentang} className={'tab' + (modeRentang ? '' : ' on')} onClick={keHarian}>Harian</button>
                <button type="button" role="tab" aria-selected={modeRentang} className={'tab' + (modeRentang ? ' on' : '')} onClick={() => keRentang(preset)}>Rentang</button>
              </div>
              {modeRentang ? (
                PRESET_BROKER.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`chip-t${preset === p.id && rentang ? ' on' : ''}`}
                    onClick={() => keRentang(p.id)}
                  >
                    {p.label}
                  </button>
                ))
              ) : (
                <Dropdown
                  opsi={[...tanggalTersedia].reverse().map((iso) => ({ nilai: iso, label: labelTanggal(iso) }))}
                  nilai={tanggalAktif ?? ''}
                  placeholder="Pilih tanggal"
                  ariaLabel="Pilih tanggal data broker"
                  onGanti={pilihTanggal}
                />
              )}
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
              {rentang && (
                <div className="chip warn" style={{ marginBottom: 12 }}>
                  Agregat {labelTanggal(rentang.mulai)} – {labelTanggal(rentang.akhir)} ({rentang.nHari} hari bursa) · jumlah vol/nilai/frekuensi per broker
                </div>
              )}
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
