import { PemilihRentang } from '../../components/dasbor/PemilihRentang'
import { LABEL_RENTANG } from '../../lib/dasbor/periode'
import { useMemo, useState, type ReactNode } from 'react'
import { useBrokerHarian, labelTanggal } from '../../lib/dasbor/brokerHarian'
import { useDsIso } from '../../lib/dasbor/flowNego'
import { fmtB, fmtLot } from '../../lib/dasbor/brokerSummaryFormat'
import { Inventory } from './broker-summary/Inventory'
import { Quadrant } from './broker-summary/Quadrant'
import { Nego } from './broker-summary/Nego'
import { Flow } from './broker-summary/Flow'
import { IkonMenu, IKON_GRAFIK_BATANG, IKON_KUADRAN, IKON_ULANG, IKON_OMBAK, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'
import { DatePicker } from '../../components/dasbor/DatePicker'
import { KonteksData } from '../../components/dasbor/KonteksData'
import { CatatanCakupan } from '../../components/dasbor/CatatanCakupan'

type Tab = 'inventory' | 'quadrant' | 'nego' | 'flow'

const TABS: { id: Tab; label: ReactNode }[] = [
  { id: 'inventory', label: <><IkonMenu d={IKON_GRAFIK_BATANG} size={13} /> Inventory</> },
  { id: 'quadrant', label: <><IkonMenu d={IKON_KUADRAN} size={13} /> Kuadran</> },
  { id: 'nego', label: <><IkonMenu d={IKON_ULANG} size={13} /> NEGO</> },
  { id: 'flow', label: <><IkonMenu d={IKON_OMBAK} size={13} /> Flow</> },
]

/** Tab yang konsumsi data broker agregat harian (bs_*.json, 2023–kini);
 * NEGO/Flow konsumsi ds_*.json (2026–kini, lihat flowNego.ts) — pemilih
 * tanggal sama, tapi set hari ber-data DatePicker beda per kelompok tab. */
const TAB_HARIAN: Record<Tab, boolean> = { inventory: true, quadrant: true, nego: false, flow: false }

/** Preset mode Rentang (#79C — data 750 hari bursa, rentang tak dibatasi):
 * mundur hari kalender dari tanggal berdata terakhir; YTD = 1 Januari tahun
 * berjalan. pilihRentang otomatis snap ke hari berdata di dalamnya. */
type PresetId = 'w1' | 'b1' | 'b3' | 'b6' | 'ytd' | 'y1'
/* Labelnya dari LABEL_RENTANG (#170): daftar ini dulu mengeja sendiri empat
   kata yang sudah dieja PRESET_RENTANG, jadi keduanya bisa menyimpang tanpa
   ada yang menyadarinya. Yang khas di sini cuma jumlah harinya. */
const PRESET_BROKER: { id: PresetId; label: string; hari: number }[] = [
  { id: 'w1', label: LABEL_RENTANG.w1, hari: 7 },
  { id: 'b1', label: LABEL_RENTANG.b1, hari: 30 },
  { id: 'b3', label: LABEL_RENTANG.b3, hari: 91 },
  { id: 'b6', label: LABEL_RENTANG.b6, hari: 182 },
  { id: 'ytd', label: LABEL_RENTANG.ytd, hari: 0 },
  { id: 'y1', label: LABEL_RENTANG.y1, hari: 365 },
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
 * Panel "Broker Summary" — tab Inventory & Kuadran pakai data broker HARIAN
 * dari harvester (/data-idx/json/broker/index.json + bs_YYMMDD.json, lihat
 * lib/dasbor/brokerHarian.ts); tab NEGO & Flow (#99) pakai data harian pasar
 * ds_YYMMDD.json (net foreign & papan NG, lihat lib/dasbor/flowNego.ts).
 * Semua tab mengikuti tanggal/rentang aktif yang sama.
 */
export function BrokerSummary() {
  const [tab, setTab] = useState<Tab>('inventory')
  const { tanggalTersedia, tanggalAktif, rows, rentang, pilihTanggal, pilihRentang, loading, error, selesai, total } = useBrokerHarian()
  const setBroker = useMemo(() => new Set(tanggalTersedia), [tanggalTersedia])
  // Tab NEGO/Flow: DatePicker hanya menawarkan hari ber-data ds (cakupan
  // lebih pendek dari data broker) — mencegah memilih tanggal kosong.
  const dsIso = useDsIso()
  const setDs = useMemo(() => new Set(dsIso), [dsIso])

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
  const tersedia = harian ? setBroker : setDs

  return (
    <div className="lantai">
      <div className="vhead">
        <h1>Broker Summary</h1>
        <span className="sub">akumulasi vs distribusi · sumber idx.co.id, harian otomatis</span>
        <CatatanCakupan inline />
        <KonteksData tanggal={tanggalAktif} />
      </div>

      <div className="grid3 bs-stat">
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
          <span className={'v-num num v-tgl' + (rentang ? ' rentang' : '')}>
            {rentang
              ? `${labelTanggal(rentang.mulai)} – ${labelTanggal(rentang.akhir)}`
              : tanggalAktif ? labelTanggal(tanggalAktif) : '—'}
          </span>
          <span className="v-note">{rentang ? `agregat ${rentang.nHari} hari bursa` : `${tanggalTersedia.length} hari tersedia`}</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h bs-h">
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
          {/* #98: inline style → kelas .bs-ctl supaya media query mobile bisa
              menata ulang (inline selalu menang atas CSS). #99: kontrol tampil
              di SEMUA tab — NEGO/Flow ikut tanggal/rentang aktif halaman.
              #4/#5 (revisi 14 Agu): baris kontrol jadi grup sendiri — mode
              toggle KIRI, preset TENGAH (boleh wrap), tanggal KANAN — via
              .bs-ctl justify-content:space-between (3 grup flex, lihat
              lantai.css). Ini juga mengunci posisi toggle & tanggal supaya
              tak "gerak-gerak" saat Harian⇄Rentang (#5): toggle selalu grup
              pertama/kiri, tanggal selalu grup terakhir/kanan, terlepas dari
              preset ada/tidak. */}
          <div className="bs-ctl">
              {/* Toggle mode + pemilih: Harian → DatePicker (hanya hari
                  ber-data); Rentang → preset + rentang bebas dua DatePicker
                  (snap ke hari berdata, lihat pilihRentang). */}
              <div className="tabs" role="tablist" aria-label="Mode data broker">
                <button type="button" role="tab" aria-selected={!modeRentang} className={'tab' + (modeRentang ? '' : ' on')} onClick={keHarian}>Harian</button>
                <button type="button" role="tab" aria-selected={modeRentang} className={'tab' + (modeRentang ? ' on' : '')} onClick={() => keRentang(preset ?? 'w1')}>Rentang</button>
              </div>
              {modeRentang && (
                <PemilihRentang
                  className="bs-preset"
                  opsi={PRESET_BROKER}
                  nilai={preset ?? 'w1'}
                  onGanti={keRentang}
                />
              )}
              <div className="bs-tgl">
                {modeRentang ? (
                  // Rentang bebas — SATU DatePicker mode rentang (29 Agu):
                  // satu kalender dua klik, bukan dua popover mulai/akhir yang
                  // harus dibuka bergantian. keRentangBebas tetap yang
                  // memvalidasi & memuat, jadi urutan terbalik tetap otomatis
                  // ditukar di sana.
                  <DatePicker
                    value={mulaiIso}
                    // `onChange` di kalender RENTANG berarti "pilih satu hari",
                    // bukan "ganti ujung awal": komponen memanggilnya saat orang
                    // mengklik tanggal yang sama dua kali, dan saat stepper ‹ ›
                    // dipakai. Memetakannya ke (iso, akhirLama) membuat klik-ganda
                    // menghasilkan rentang panjang yang tak diminta siapa pun.
                    onChange={(iso) => keRentangBebas(iso, iso)}
                    tersedia={tersedia}
                    ariaLabel="Rentang tanggal data broker"
                    rata="kanan"
                    rentang={mulaiIso && akhirIso ? { dari: mulaiIso, sampai: akhirIso } : null}
                    onGantiRentang={keRentangBebas}
                  />
                ) : (
                  <DatePicker
                    value={tanggalAktif ?? ''}
                    onChange={pilihTanggal}
                    tersedia={tersedia}
                    ariaLabel="Pilih tanggal data broker"
                    rata="kanan"
                  />
                )}
              </div>
          </div>
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
          {tab === 'nego' && <Nego tanggalAktif={tanggalAktif} rentang={rentang} />}
          {tab === 'flow' && <Flow tanggalAktif={tanggalAktif} rentang={rentang} />}
        </div>
      </div>
    </div>
  )
}
