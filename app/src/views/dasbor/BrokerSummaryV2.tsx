import { useEffect, useMemo, useState } from 'react'
import { PemilihRentang } from '../../components/dasbor/PemilihRentang'
import { DatePicker } from '../../components/dasbor/DatePicker'
import { Dropdown, type OpsiDropdown } from '../../components/dasbor/Dropdown'
import { LangkahTanggal } from '../../components/dasbor/LangkahTanggal'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { IkonMenu, IKON_CARI, IKON_ULANG, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'
import { CatatanCakupan } from '../../components/dasbor/CatatanCakupan'
import { LABEL_RENTANG } from '../../lib/dasbor/periode'
import { useStockIndex } from '../../lib/dasbor/stockDetailData'
import { agregatBroker, type ModeTransaksi } from '../../lib/dasbor/brokerEmiten'
import { useArusBrokerEmiten, useOhlcvEmiten, irisOhlcv } from '../../lib/dasbor/brokerEmitenV2'
import { keFraksi } from '../../lib/fraksiHarga'
import { Overview } from './broker-summary-v2/Overview'
import { Inventory } from './broker-summary-v2/Inventory'
import { FlowNetGross } from './broker-summary-v2/FlowNetGross'
import { VsIhsg } from './broker-summary-v2/VsIhsg'
import { TimelineForeign } from './broker-summary-v2/TimelineForeign'
import { Shareholders } from './broker-summary-v2/Shareholders'
import { Nego } from './broker-summary-v2/Nego'

type Tab = 'overview' | 'inventory' | 'flow' | 'vsihsg' | 'foreign' | 'shareholders' | 'nego'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'flow', label: 'Flow Net vs Gross' },
  { id: 'vsihsg', label: 'vs IHSG' },
  { id: 'foreign', label: 'Timeline Foreign' },
  { id: 'shareholders', label: 'Shareholders' },
  { id: 'nego', label: 'NEGO' },
]
// Tab nonaktif mockup — apa adanya (nama + alasan "menyusul"), bukan dihilangkan.
const TABS_NONAKTIF = [
  { label: 'Quadrant', judul: 'menyusul — butuh definisi kuadran' },
  { label: 'Broker Intel', judul: 'menyusul' },
  { label: 'Teknikal', judul: 'menyusul — gabung dengan /grafik' },
]

const MODE_OPSI: { id: ModeTransaksi; label: string }[] = [
  { id: 'net', label: 'Net' },
  { id: 'gross', label: 'Gross' },
]
const UKURAN_OPSI: { id: 'nilai' | 'lot'; label: string }[] = [
  { id: 'nilai', label: 'Nilai' },
  { id: 'lot', label: 'Lot' },
]
// Investor & Market: satu pilihan aktif, sisanya TAMPIL tapi terkunci — persis
// mockup (<option disabled>) — datanya ADA di arsip mentah asing/nego tapi
// belum diagregasi jadi sumbu kendali ini (lihat CLAUDE.md tugas #187).
const INVESTOR_OPSI: OpsiDropdown[] = [
  { nilai: 'semua', label: 'All Investor' },
  { nilai: 'asing', label: 'Foreign — belum tersedia', nonaktif: true },
  { nilai: 'domestik', label: 'Domestic — belum tersedia', nonaktif: true },
]
const MARKET_OPSI: OpsiDropdown[] = [
  { nilai: 'reguler', label: 'Regular' },
  { nilai: 'nego', label: 'Nego — belum tersedia', nonaktif: true },
  { nilai: 'semua', label: 'All — belum tersedia', nonaktif: true },
]

type PresetId = 'hariini' | 'w1' | 'b1' | 'b3' | 'b6' | 'ytd' | 'y1'
const PRESET: { id: PresetId; label: string; hari: number }[] = [
  { id: 'hariini', label: LABEL_RENTANG.hariIni, hari: 0 },
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
  if (id === 'hariini') return akhir
  return mundurIso(akhir, PRESET.find((x) => x.id === id)!.hari)
}

/**
 * Broker Summary v2 (#187) — REBUILD supaya PERSIS mengikuti struktur artifact
 * "Arus Broker BUMI" yang sudah disetujui Johan (bukan versi pilot sebelumnya
 * yang "ngarang" — cuma 3 tab & kelompok broker keliru). Sepuluh tab mockup,
 * tujuh di antaranya sudah bisa diisi data nyata (Overview, Inventory, Flow
 * Net vs Gross, vs IHSG, Timeline Foreign, Shareholders, NEGO); tiga sisanya
 * (Quadrant, Broker Intel, Teknikal) TETAP nonaktif seperti mockup — itu
 * memang belum ada definisinya, bukan lupa dikerjakan.
 *
 * vs IHSG & Timeline Foreign SENGAJA memakai OHLCV UTUH (bukan `hariAktif`
 * hasil kendali tanggal header) — port persis mockup, yang rentang 3M/6M/YTD
 * di kedua tab itu independen dari kendali tanggal atas (`st.vs`/`st.fr`
 * terpisah dari `st.dari/st.sampai`).
 */
export function BrokerSummaryV2() {
  const { index } = useStockIndex()
  const [kode, setKode] = useState('BBCA')
  const [cari, setCari] = useState('')
  const [investor, setInvestor] = useState('semua')
  const [pasar, setPasar] = useState('reguler')
  const [mode, setMode] = useState<ModeTransaksi>('net')
  const [ukuran, setUkuran] = useState<'nilai' | 'lot'>('nilai')
  const [tab, setTab] = useState<Tab>('overview')
  const [preset, setPreset] = useState<PresetId | null>('hariini')
  const [dari, setDari] = useState('')
  const [akhir, setAkhir] = useState('')

  const { hari: semuaHari, loading, error } = useArusBrokerEmiten(kode)
  const ohlcv = useOhlcvEmiten(kode)
  const ihsg = useOhlcvEmiten('IHSG')

  const tanggalTersedia = useMemo(() => semuaHari.map(([t]) => t), [semuaHari])
  const setTersedia = useMemo(() => new Set(tanggalTersedia), [tanggalTersedia])
  // Ketetapan Johan 26 Agu 2026: dibuka ke 2020. Kalau hari ber-data yang
  // termuat memang berawal di 2020+, beri tahu pembaca kenapa pemilih tanggal
  // tak bisa mundur lebih jauh — supaya tak terbaca sebagai "tanggal lama
  // sengaja disembunyikan/rusak".
  const cakupanDitutup = tanggalTersedia.length > 0 && tanggalTersedia[0] >= '2020-01-01'

  useEffect(() => { setDari(''); setAkhir('') }, [kode])
  useEffect(() => {
    if (tanggalTersedia.length === 0 || dari) return
    const akhirData = tanggalTersedia[tanggalTersedia.length - 1]
    setDari(mulaiPreset(preset ?? 'hariini', akhirData))
    setAkhir(akhirData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanggalTersedia, dari])

  function keRentang(p: PresetId) {
    const akhirData = tanggalTersedia[tanggalTersedia.length - 1]
    if (!akhirData) return
    setPreset(p)
    setDari(mulaiPreset(p, akhirData))
    setAkhir(akhirData)
  }
  function keRentangBebas(d: string, a: string) {
    setPreset(null)
    setDari(d)
    setAkhir(a)
  }
  // Port tglPrev/tglNext mockup — geser SELURUH jendela [dari,akhir] satu hari
  // bursa (bukan menggeser salah satu ujung), tetap dalam hari BERDATA.
  function langkahHari(arah: -1 | 1) {
    const iAkhir = tanggalTersedia.indexOf(akhir)
    const iDari = tanggalTersedia.indexOf(dari)
    if (iAkhir < 0 || iDari < 0) return
    const span = iAkhir - iDari
    const j = iAkhir + arah
    if (j < 0 || j >= tanggalTersedia.length) return
    setPreset(null)
    setDari(tanggalTersedia[Math.max(0, j - span)])
    setAkhir(tanggalTersedia[j])
  }

  const hariAktif = useMemo(() => semuaHari.filter(([t]) => t >= dari && t <= akhir), [semuaHari, dari, akhir])
  const agg = useMemo(() => agregatBroker(hariAktif), [hariAktif])
  const ohlcvAktif = useMemo(() => (ohlcv ? irisOhlcv(ohlcv, dari, akhir) : []), [ohlcv, dari, akhir])

  const namaEmiten = index?.stocks.find((s) => s.ticker === kode)?.name ?? ''
  const hargaKini = ohlcvAktif.length ? ohlcvAktif[ohlcvAktif.length - 1].tutup : null
  const gerak = ohlcvAktif.length && ohlcvAktif[0].buka ? (hargaKini! / ohlcvAktif[0].buka - 1) * 100 : null

  return (
    <div className="lantai">
      <div className="vhead">
        <h1>Arus Broker</h1>
        <span className="sub">pasar reguler · semua investor · arsip harian Stockbit</span>
      </div>
      <CatatanCakupan />

      <header className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-b" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <span className="af-cari bsv-cari" style={{ marginBottom: 6, display: 'inline-flex' }}>
              <IkonMenu d={IKON_CARI} size={13} />
              <StockAutocomplete
                stocks={index?.stocks ?? []}
                value={cari}
                onChange={setCari}
                onSelect={(t) => { if (t) { setKode(t.toUpperCase()); setCari('') } }}
                placeholder="Ganti emiten: BUMI, BBCA…"
              />
            </span>
            <h1 style={{ margin: 0, fontSize: 26 }}>{kode} <small className="lbl" style={{ marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>{namaEmiten}</small></h1>
            <div className="num" style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap', marginTop: 4 }}>
              <span style={{ fontSize: 22, fontWeight: 500 }}>{hargaKini !== null ? `Rp ${keFraksi(hargaKini).toLocaleString('id-ID')}` : '—'}</span>
              {gerak !== null && <span className="lbl" style={{ color: gerak >= 0 ? 'var(--green)' : 'var(--red)' }}>{gerak >= 0 ? '+' : ''}{gerak.toFixed(2)}% dalam rentang</span>}
              <span className="lbl">{dari && akhir ? `${dari} – ${akhir} · ${hariAktif.length} hari bursa` : 'memuat rentang…'}</span>
            </div>
          </div>
          <div className="kendali" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Dropdown opsi={INVESTOR_OPSI} nilai={investor} onGanti={setInvestor} ariaLabel="Investor" />
            <Dropdown opsi={MARKET_OPSI} nilai={pasar} onGanti={setPasar} ariaLabel="Market" />
            <PemilihRentang opsi={MODE_OPSI} nilai={mode} onGanti={setMode} ariaLabel="Net atau Gross" />
            <PemilihRentang opsi={UKURAN_OPSI} nilai={ukuran} onGanti={setUkuran} ariaLabel="Ukuran" />
          </div>
        </div>
        <div className="panel-b bs-ctl bs2-ctl" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="bs-preset"><PemilihRentang opsi={PRESET} nilai={preset ?? 'b1'} onGanti={keRentang} /></div>
          <div className="bs-tgl">
            <LangkahTanggal arah="mundur" ukuran="sebaris" label="Rentang satu hari bursa sebelumnya" disabled={!tanggalTersedia.length} onClick={() => langkahHari(-1)} />
            <div className="bilah-rentang">
              <DatePicker value={dari} onChange={(iso) => keRentangBebas(iso, akhir)} tersedia={setTersedia} ariaLabel="Tanggal mulai rentang" rata="kanan" />
              <span className="bilah-rentang-pisah" aria-hidden="true">s.d.</span>
              <DatePicker value={akhir} onChange={(iso) => keRentangBebas(dari, iso)} tersedia={setTersedia} ariaLabel="Tanggal akhir rentang" rata="kanan" />
            </div>
            <LangkahTanggal arah="maju" ukuran="sebaris" label="Rentang satu hari bursa berikutnya" disabled={!tanggalTersedia.length} onClick={() => langkahHari(1)} />
          </div>
        </div>
        {cakupanDitutup && (
          <div className="panel-b" style={{ borderTop: '1px solid var(--line)' }}>
            <div className="chip dn" style={{ display: 'flex', whiteSpace: 'normal', height: 'auto', lineHeight: 1.5 }}>
              <span><IkonMenu d={IKON_PERINGATAN} size={14} /> Rentang tanggal dibatasi sejak 2020 — tahun sebelumnya belum masuk gelombang pengumpulan, jadi belum bisa dipilih di sini.</span>
            </div>
          </div>
        )}
      </header>

      {loading && (
        <div className="panel"><div className="panel-b" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p><IkonMenu d={IKON_ULANG} size={26} /></p>
          <p className="lbl">Memuat arus broker {kode}…</p>
        </div></div>
      )}
      {!loading && error && (
        <div className="panel"><div className="panel-b" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
          <p className="lbl">{error} — coba BUMI, datanya paling lengkap.</p>
        </div></div>
      )}

      {!loading && !error && semuaHari.length > 0 && (
        <div className="panel">
          <div className="panel-h bs-h bs2-h">
            <div className="tabs" role="tablist" aria-label="Analisa Broker Summary v2">
              {TABS.map((t) => (
                <button
                  key={t.id} type="button" role="tab" aria-selected={tab === t.id}
                  className={'tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
              {TABS_NONAKTIF.map((t) => (
                <button key={t.label} type="button" role="tab" className="tab" disabled title={t.judul} style={{ opacity: .5 }}>
                  {t.label} <small style={{ fontSize: 9 }}>menyusul</small>
                </button>
              ))}
            </div>
          </div>
          <div className="panel-b">
            {tab === 'overview' && <Overview hari={hariAktif} agg={agg} mode={mode} ukuran={ukuran} />}
            {tab === 'inventory' && <Inventory hari={hariAktif} agg={agg} ohlcv={ohlcvAktif} />}
            {tab === 'flow' && <FlowNetGross hari={hariAktif} agg={agg} />}
            {tab === 'vsihsg' && <VsIhsg kode={kode} saham={ohlcv ?? []} ihsg={ihsg ?? []} />}
            {tab === 'foreign' && <TimelineForeign bars={ohlcv ?? []} />}
            {tab === 'shareholders' && <Shareholders kode={kode} />}
            {tab === 'nego' && <Nego hari={hariAktif} />}
          </div>
        </div>
      )}
    </div>
  )
}
