import { useMemo, useState, type ReactNode } from 'react'
import { BS_AVAIL, BS_DATA } from '../../lib/dasbor/brokerSummaryData'
import { useBrokerHarian, labelTanggal } from '../../lib/dasbor/brokerHarian'
import { dateLabel, fmtB, fmtLot } from '../../lib/dasbor/brokerSummaryFormat'
import { Inventory } from './broker-summary/Inventory'
import { Quadrant } from './broker-summary/Quadrant'
import { Nego } from './broker-summary/Nego'
import { Flow } from './broker-summary/Flow'
import { IkonMenu, IKON_GRAFIK_BATANG, IKON_ULANG, IKON_OMBAK, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'
import { DatePicker } from '../../components/dasbor/DatePicker'

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

/** Preset mode Rentang (#79C — data 750 hari bursa, rentang tak dibatasi):
 * mundur hari kalender dari tanggal berdata terakhir; YTD = 1 Januari tahun
 * berjalan. pilihRentang otomatis snap ke hari berdata di dalamnya. */
type PresetId = 'w1' | 'b1' | 'b3' | 'b6' | 'ytd' | 'y1'
const PRESET_BROKER: { id: PresetId; label: string; hari: number }[] = [
  { id: 'w1', label: '1 Minggu', hari: 7 },
  { id: 'b1', label: '1 Bulan', hari: 30 },
  { id: 'b3', label: '3 Bulan', hari: 91 },
  { id: 'b6', label: '6 Bulan', hari: 182 },
  { id: 'ytd', label: 'YTD', hari: 0 },
  { id: 'y1', label: '1 Tahun', hari: 365 },
]

function mundurIso(iso: string, hari: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() - hari)
  return d.toISOString().slice(0, 10)
}

function mulaiPreset(id: PresetId, akhir: string): string {
  if (id === 'ytd') return `${akhir.slice(0, 4)}-01-01`
  return mundurIso(akhir, PRESET_BROKER.find((x) => x.id === id)!.hari)
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
  const { tanggalTersedia, tanggalAktif, rows, rentang, pilihTanggal, pilihRentang, loading, error, selesai, total } = useBrokerHarian()
  const setTersedia = useMemo(() => new Set(tanggalTersedia), [tanggalTersedia])

  // ─── Mode Rentang (#75/#79C): agregat SUM 88 broker sepanjang hari-berdata.
  // Preset ATAU rentang bebas (dua DatePicker) — preset cuma jalan pintas
  // mengisi pasangan mulai/akhir yang sama-sama memanggil pilihRentang. ──
  const [modeRentang, setModeRentang] = useState(false)
  const [preset, setPreset] = useState<PresetId | null>('w1')
  const [mulaiIso, setMulaiIso] = useState('')
  const [akhirIso, setAkhirIso] = useState('')

  function keRentang(p: PresetId) {
    const akhir = tanggalTersedia[tanggalTersedia.length - 1]
    if (!akhir) return
    setModeRentang(true)
    setPreset(p)
    const mulai = mulaiPreset(p, akhir)
    setMulaiIso(mulai)
    setAkhirIso(akhir)
    pilihRentang(mulai, akhir)
  }

  /** Rentang bebas: ganti salah satu ujung — preset dilepas, langsung dimuat. */
  function keRentangBebas(mulai: string, akhir: string) {
    if (!mulai || !akhir) {
      setMulaiIso(mulai)
      setAkhirIso(akhir)
      return
    }
    setPreset(null)
    setMulaiIso(mulai)
    setAkhirIso(akhir)
    pilihRentang(mulai, akhir)
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
          <span className="v-note">{rows ? `dari ${brokers.length} terdaftar` : 'memuat…'}</span>
        </div>
        <div className="vcard">
          <span className="lbl">Total Nilai Transaksi</span>
          <span className="v-num num">{rows ? `Rp ${fmtB(totalNilai)}` : '—'}</span>
          <span className="v-note">{rows ? fmtLot(totalVol) : 'memuat…'}</span>
        </div>
        <div className="vcard">
          <span className="lbl">Total Frekuensi</span>
          {/* Skala menyesuaikan: harian ~ribuan K, agregat 1 tahun tembus
              miliaran — "1218432K" tak terbaca, naik ke Jt/M. */}
          <span className="v-num num">
            {!rows ? '—'
              : totalFreq >= 1e9 ? `${(totalFreq / 1e9).toFixed(2)} M`
              : totalFreq >= 1e6 ? `${(totalFreq / 1e6).toFixed(1)} Jt`
              : `${(totalFreq / 1e3).toFixed(0)}K`}
          </span>
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
              {/* Toggle mode + pemilih: Harian → DatePicker (hanya hari
                  ber-data); Rentang → preset + rentang bebas dua DatePicker
                  (snap ke hari berdata, lihat pilihRentang). */}
              <div className="tabs" role="tablist" aria-label="Mode data broker">
                <button type="button" role="tab" aria-selected={!modeRentang} className={'tab' + (modeRentang ? '' : ' on')} onClick={keHarian}>Harian</button>
                <button type="button" role="tab" aria-selected={modeRentang} className={'tab' + (modeRentang ? ' on' : '')} onClick={() => keRentang(preset ?? 'w1')}>Rentang</button>
              </div>
              {modeRentang ? (
                <>
                  {PRESET_BROKER.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`chip-t${preset === p.id ? ' on' : ''}`}
                      onClick={() => keRentang(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                  {/* Rentang bebas — dua DatePicker mulai/akhir, hanya hari
                      ber-data yang bisa dipilih; urutan terbalik otomatis
                      ditukar di pilihRentang. */}
                  <DatePicker value={mulaiIso} onChange={(iso) => keRentangBebas(iso, akhirIso)} tersedia={setTersedia} ariaLabel="Tanggal mulai rentang" rata="kanan" />
                  <span className="lbl" aria-hidden="true">s.d.</span>
                  <DatePicker value={akhirIso} onChange={(iso) => keRentangBebas(mulaiIso, iso)} tersedia={setTersedia} ariaLabel="Tanggal akhir rentang" rata="kanan" />
                </>
              ) : (
                <DatePicker
                  value={tanggalAktif ?? ''}
                  onChange={pilihTanggal}
                  tersedia={setTersedia}
                  ariaLabel="Pilih tanggal data broker"
                  rata="kanan"
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
              <p><IkonMenu d={IKON_ULANG} size={26} /></p>
              <p className="lbl">{total > 1 ? `Memuat ${selesai}/${total} hari bursa…` : 'Memuat data broker…'}</p>
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
