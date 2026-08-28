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
import { TAHUN_AWAL, useArusBrokerEmiten, useOhlcvEmiten, irisOhlcv, vwapRentang } from '../../lib/dasbor/brokerEmitenV2'
import { keFraksi } from '../../lib/fraksiHarga'
import { Overview } from './broker-summary-v2/Overview'
import { Inventory } from './broker-summary-v2/Inventory'
import { FlowNetGross } from './broker-summary-v2/FlowNetGross'
import { VsIhsg } from './broker-summary-v2/VsIhsg'
import { TimelineForeign } from './broker-summary-v2/TimelineForeign'
import { Shareholders } from './broker-summary-v2/Shareholders'
import { Nego } from './broker-summary-v2/Nego'
import { Quadrant } from './broker-summary-v2/Quadrant'
import { InfoIndikator, type ItemInfoIndikator } from '../../components/dasbor/InfoIndikator'

type Tab = 'overview' | 'quadrant' | 'inventory' | 'flow' | 'vsihsg' | 'foreign' | 'shareholders' | 'nego'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'quadrant', label: 'Quadrant' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'flow', label: 'Flow Net vs Gross' },
  { id: 'vsihsg', label: 'vs IHSG' },
  { id: 'foreign', label: 'Timeline Foreign' },
  { id: 'shareholders', label: 'Shareholders' },
  { id: 'nego', label: 'NEGO' },
]
// Tab nonaktif mockup — apa adanya (nama + alasan "menyusul"), bukan dihilangkan.
const TABS_NONAKTIF = [
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
  // ⚠ JANGAN dinyalakan sebelum `pasar` benar-benar DIPAKAI agregasi
  // (state-nya sekarang tak dibaca siapa pun — menyalakan opsi ini berarti
  // kendali yang mengaku mengganti pasar tapi tak mengubah apa pun, gagal
  // senyap). Datanya SUDAH ada (nego 100% hari 2020–2026, ukur 26 Agu);
  // yang kurang wiring sumbunya. Tab NEGO di halaman ini sudah hidup dan
  // itu jalur baca nego yang benar hari ini — labelnya bilang itu (§B.6
  // "beri keterangan title kenapa terkunci ATAU singkirkan", Dropdown di
  // luar cakupan berkas ini jadi keterangannya ditulis di label sendiri).
  { nilai: 'nego', label: 'Nego — lihat tab NEGO', nonaktif: true },
  { nilai: 'semua', label: 'All — gabungan pasar belum dihitung', nonaktif: true },
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

/** Modal "i" — penjelasan kendali & tab halaman ini (permintaan Johan 27 Agu
 *  2026: "sweep semua page setiap ada indikator seperti ini berikan modal
 *  informasi terkait fungsi nya"). Bahasa pembaca, tanpa nama sumber/jalur
 *  internal — diambil dari komentar di atas tiap kendali & tab. */
const INFO_BSV2: ItemInfoIndikator[] = [
  { nama: 'All Investor', isi: 'Menyaring transaksi menurut tipe investor. Baru "All Investor" (seluruh investor) yang tersedia di sini — pemecahan asing/domestik menyusul.' },
  { nama: 'Regular', isi: 'Menyaring menurut jenis pasar transaksi. Baru pasar reguler yang tersedia di sini; transaksi pasar negosiasi punya tab tersendiri (NEGO).' },
  { nama: 'Net / Gross', isi: 'Net menjumlahkan beli dikurangi jual tiap broker (bisa positif/negatif); Gross menampilkan total transaksi (beli+jual) tanpa saling meniadakan.' },
  { nama: 'Nilai / Lot', isi: 'Satuan seluruh tabel dan chart di halaman ini: Nilai dalam rupiah, Lot dalam lembar saham (1 lot = 100 lembar).' },
  { nama: 'Rentang tanggal', isi: 'Pintasan cepat (Hari Ini, 1 Minggu, 1/3/6 Bulan, YTD, 1 Tahun), panah kiri/kanan yang menggeser seluruh rentang satu hari bursa, atau dua kolom tanggal untuk rentang bebas.' },
  { nama: 'Overview', isi: 'Peringkat broker net beli dan net jual terbesar pada rentang terpilih, plus jumlah hari akumulasi vs distribusi emiten ini — dihitung dari label per hari, bukan sekadar selisih jumlah broker beli/jual.' },
  { nama: 'Quadrant', isi: 'Posisi tiap broker: sumbu mendatar seberapa jauh harga rata-ratanya dari harga acuan rentang (rata-rata tertimbang volume), sumbu tegak besar net beli/jualnya. Ukuran gelembung mengikuti besar net, warna mengikuti kelompok identitas broker.' },
  { nama: 'Inventory', isi: 'Akumulasi net (menumpuk dari hari ke hari) empat pembeli bersih dan empat penjual bersih terbesar sepanjang rentang, dengan garis harga tutup sebagai pembanding.' },
  { nama: 'Flow Net vs Gross', isi: 'Tabel dua sisi per broker: total transaksi kotor, net-nya, dan persentase net terhadap kotor — makin tinggi persentasenya, makin satu arah transaksi broker itu.' },
  { nama: 'vs IHSG', isi: 'Membandingkan pergerakan harga emiten ini terhadap IHSG pada rentang yang sama, titik awalnya disamakan (rebased) supaya bentuk pergerakannya bisa dibandingkan langsung.' },
  { nama: 'Timeline Foreign', isi: 'Aliran dana asing harian dalam rupiah, dilaporkan bursa, sepanjang rentang yang dipilih.' },
  { nama: 'Shareholders', isi: 'Pemegang saham ≥5% dan pengendali, anak usaha, jajaran pengurus, serta komposisi kepemilikan bulanan — dari data resmi emiten dan KSEI.' },
  { nama: 'NEGO', isi: 'Transaksi pasar negosiasi per broker, dengan penanda broker yang arahnya berlawanan dengan transaksi reguler-nya hari itu (kandidat akumulasi/distribusi tersembunyi) versus yang searah.' },
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
  const cakupanDitutup = tanggalTersedia.length > 0 && tanggalTersedia[0] >= `${TAHUN_AWAL}-01-01`

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
  const vwap = useMemo(() => vwapRentang(ohlcvAktif), [ohlcvAktif])

  const namaEmiten = index?.stocks.find((s) => s.ticker === kode)?.name ?? ''
  const hargaKini = ohlcvAktif.length ? ohlcvAktif[ohlcvAktif.length - 1].tutup : null
  const gerak = ohlcvAktif.length && ohlcvAktif[0].buka ? (hargaKini! / ohlcvAktif[0].buka - 1) * 100 : null

  return (
    <div className="lantai">
      <div className="vhead">
        <h1>Arus Broker</h1>
        <span className="sub">pasar reguler · semua investor · arsip harian Stockbit</span>
        <CatatanCakupan inline />
      </div>

      <header className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-b">
          <h1 style={{ margin: 0, fontSize: 26 }}>{kode} <small className="lbl" style={{ marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>{namaEmiten}</small></h1>
          <div className="num" style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap', marginTop: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 500 }}>{hargaKini !== null ? `Rp ${keFraksi(hargaKini).toLocaleString('id-ID')}` : '—'}</span>
            {gerak !== null && <span className="lbl" style={{ color: gerak >= 0 ? 'var(--green)' : 'var(--red)' }}>{gerak >= 0 ? '+' : ''}{gerak.toFixed(2)}% dalam rentang</span>}
            <span className="lbl">{dari && akhir ? `${dari} – ${akhir} · ${hariAktif.length} hari bursa` : 'memuat rentang…'}</span>
          </div>
        </div>
        {/* Bilah kendali berkelompok — sistem tata C+A (lantai.css), pola sama
            Whales/Harian Papan: EMITEN · CAKUPAN (investor/market) · UKURAN
            (Net-Gross/Nilai-Lot) · TANGGAL (preset+navigasi); i ke grup-kanan. */}
        <div className="panel-b" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="bilah-kendali bsv-atur">
            <div className="grup-k">
              <span className="grup-lbl">Emiten</span>
              <span className="af-cari bsv-cari">
                <IkonMenu d={IKON_CARI} size={13} />
                <StockAutocomplete
                  stocks={index?.stocks ?? []}
                  value={cari}
                  onChange={setCari}
                  onSelect={(t) => { if (t) { setKode(t.toUpperCase()); setCari('') } }}
                  placeholder="Ganti emiten: BUMI, BBCA…"
                />
              </span>
            </div>
            <span className="pemisah-v" aria-hidden="true" />
            <div className="grup-k">
              <span className="grup-lbl">Cakupan</span>
              <Dropdown opsi={INVESTOR_OPSI} nilai={investor} onGanti={setInvestor} ariaLabel="Investor" />
              <Dropdown opsi={MARKET_OPSI} nilai={pasar} onGanti={setPasar} ariaLabel="Market" />
            </div>
            <span className="pemisah-v" aria-hidden="true" />
            <div className="grup-k">
              <span className="grup-lbl">Ukuran</span>
              <PemilihRentang opsi={MODE_OPSI} nilai={mode} onGanti={setMode} ariaLabel="Net atau Gross" />
              <PemilihRentang opsi={UKURAN_OPSI} nilai={ukuran} onGanti={setUkuran} ariaLabel="Ukuran" />
            </div>
            <span className="pemisah-v" aria-hidden="true" />
            <div className="grup-k">
              <span className="grup-lbl">Tanggal</span>
              <div className="bs-preset"><PemilihRentang opsi={PRESET} nilai={preset ?? 'b1'} onGanti={keRentang} /></div>
              <div className="bs-tgl">
                <LangkahTanggal arah="mundur" ukuran="sebaris" label="Rentang satu hari bursa sebelumnya" disabled={!tanggalTersedia.length} onClick={() => langkahHari(-1)} />
                {/* Satu kalender mode rentang (klik awal lalu akhir) menggantikan
                    dua DatePicker terpisah — dulu dua popover harus dibuka
                    bergantian untuk satu rentang, sekarang cukup dua klik di
                    kalender yang sama. */}
                <DatePicker
                  value={dari}
                  // `onChange` di kalender RENTANG berarti "pilih satu hari",
                  // bukan "ganti ujung awal": komponen memanggilnya saat orang
                  // mengklik tanggal yang sama dua kali, dan saat stepper ‹ ›
                  // dipakai. Memetakannya ke (iso, akhirLama) membuat klik-ganda
                  // menghasilkan rentang panjang yang tak diminta siapa pun.
                  onChange={(iso) => keRentangBebas(iso, iso)}
                  tersedia={setTersedia}
                  ariaLabel="Rentang tanggal"
                  rata="kanan"
                  rentang={{ dari, sampai: akhir }}
                  onGantiRentang={keRentangBebas}
                />
                <LangkahTanggal arah="maju" ukuran="sebaris" label="Rentang satu hari bursa berikutnya" disabled={!tanggalTersedia.length} onClick={() => langkahHari(1)} />
              </div>
            </div>
            <div className="grup-k grup-kanan">
              <InfoIndikator judul="Indikator Arus Broker" item={INFO_BSV2} />
            </div>
          </div>
        </div>
        {cakupanDitutup && (
          <div className="panel-b" style={{ borderTop: '1px solid var(--line)' }}>
            <div className="chip dn" style={{ display: 'flex', whiteSpace: 'normal', height: 'auto', lineHeight: 1.5 }}>
              <span><IkonMenu d={IKON_PERINGATAN} size={14} /> Rentang tanggal dibatasi sejak {TAHUN_AWAL} — tahun sebelumnya belum masuk gelombang pengumpulan, jadi belum bisa dipilih di sini.</span>
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
            {tab === 'quadrant' && <Quadrant agg={agg} vwap={vwap} ukuran={ukuran} />}
            {tab === 'inventory' && <Inventory hari={hariAktif} agg={agg} ohlcv={ohlcvAktif} ukuran={ukuran} />}
            {tab === 'flow' && <FlowNetGross hari={hariAktif} agg={agg} mode={mode} ukuran={ukuran} />}
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
