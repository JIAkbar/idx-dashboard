import { useEffect, useMemo, useState } from 'react'
import { PemilihRentang } from '../../components/dasbor/PemilihRentang'
import { DatePicker } from '../../components/dasbor/DatePicker'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { IkonMenu, IKON_CARI, IKON_ULANG, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'
import { LABEL_RENTANG } from '../../lib/dasbor/periode'
import { useStockIndex } from '../../lib/dasbor/stockDetailData'
import { agregatBroker, tabelDuaSisi, type ModeTransaksi, type SisiTabel } from '../../lib/dasbor/brokerEmiten'
import {
  useArusBrokerEmiten, useOhlcvEmiten, irisOhlcv, vwapRentang, ringkasSB,
} from '../../lib/dasbor/brokerEmitenV2'
import { kelompokBroker, warnaBroker, LABEL_KELOMPOK } from '../../lib/dasbor/kelompokBroker'
import { fmtB, fmtLot } from '../../lib/dasbor/brokerSummaryFormat'
import { keFraksi } from '../../lib/fraksiHarga'
import { Inventory } from './broker-summary-v2/Inventory'
import { Kuadran } from './broker-summary-v2/Kuadran'
import { FloorPrice } from './broker-summary-v2/FloorPrice'

type Tab = 'inventory' | 'kuadran' | 'floor'
const TABS: { id: Tab; label: string }[] = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'kuadran', label: '⊞ Kuadran' },
  { id: 'floor', label: 'Floor Price' },
]

const MODE_OPSI: { id: ModeTransaksi; label: string }[] = [
  { id: 'net', label: 'Net' },
  { id: 'gross', label: 'Gross' },
]

// Data asing/nego BUMI ADA di arsip mentah (_arsip-mentah/broker-harian/…
// .asing.json/.nego.json) tapi belum diagregasi ke broker_tahunan/ (lihat
// brokerEmiten.ts) — pilihan tetap tampil (bukan disembunyikan) tapi
// dikunci, sama seperti mockup rancangan (<option disabled>).
type Pasar = 'reguler' | 'asing' | 'nego'
const PASAR_OPSI: { id: Pasar; label: string; nonaktif?: boolean; judul?: string }[] = [
  { id: 'reguler', label: 'Reguler' },
  { id: 'asing', label: 'Asing', nonaktif: true, judul: 'Backfill berjalan — belum diagregasi' },
  { id: 'nego', label: 'Nego', nonaktif: true, judul: 'Backfill berjalan — belum diagregasi' },
]

type PresetId = 'w1' | 'b1' | 'b3' | 'b6' | 'ytd' | 'y1'
const PRESET: { id: PresetId; label: string; hari: number }[] = [
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
  return mundurIso(akhir, PRESET.find((x) => x.id === id)!.hari)
}

function BarisSisi({ r }: { r: SisiTabel }) {
  const warna = warnaBroker(r.broker)
  return (
    <tr>
      <td>
        <span className="bchip" style={{ borderColor: warna, color: warna }} title={LABEL_KELOMPOK[kelompokBroker(r.broker)]}>
          {r.broker}
        </span>
      </td>
      <td className="r num">{fmtB(r.nilai)}</td>
      <td className="r num">{fmtLot(r.lot)}</td>
      <td className="r num">{r.avg ? Math.round(r.avg).toLocaleString('id-ID') : '—'}</td>
    </tr>
  )
}

/**
 * Broker Summary v2 (#187) — arus broker PER EMITEN dari arsip harian
 * Stockbit (`broker_tahunan/`, lihat brokerEmiten.ts), berdampingan dengan
 * /broker-summary lama (broker level PASAR, dari IDX) yang SENGAJA tidak
 * disentuh — Johan ingin membandingkan keduanya sebelum memutuskan mana yang
 * dipertahankan. Baru BUMI yang lengkap (pilot); kode lain otomatis
 * menampilkan pesan "belum ada arsip" begitu backfill emiten lain jalan,
 * tanpa perlu ubah kode di sini.
 */
export function BrokerSummaryV2() {
  const { index } = useStockIndex()
  const [kode, setKode] = useState('BUMI')
  const [cari, setCari] = useState('')
  const [mode, setMode] = useState<ModeTransaksi>('net')
  const [pasar, setPasar] = useState<Pasar>('reguler')
  const [tab, setTab] = useState<Tab>('inventory')
  const [preset, setPreset] = useState<PresetId | null>('b1')
  const [dari, setDari] = useState('')
  const [akhir, setAkhir] = useState('')

  const { hari: semuaHari, loading, error } = useArusBrokerEmiten(kode)
  const ohlcv = useOhlcvEmiten(kode)

  const tanggalTersedia = useMemo(() => semuaHari.map(([t]) => t), [semuaHari])
  const setTersedia = useMemo(() => new Set(tanggalTersedia), [tanggalTersedia])

  // Begitu arsip kode aktif datang (atau kode berganti): pasang rentang
  // preset bawaan di ujung data terbarunya. `dari`/`akhir` direset ke ''
  // oleh efek di bawah setiap `kode` berubah, jadi guard `!dari` di sini
  // cukup — tak menimpa rentang yang sudah dipilih user di kode yang sama.
  useEffect(() => { setDari(''); setAkhir('') }, [kode])
  useEffect(() => {
    if (tanggalTersedia.length === 0 || dari) return
    const akhirData = tanggalTersedia[tanggalTersedia.length - 1]
    setDari(mulaiPreset(preset ?? 'b1', akhirData))
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

  const hariAktif = useMemo(() => semuaHari.filter(([t]) => t >= dari && t <= akhir), [semuaHari, dari, akhir])
  const agg = useMemo(() => agregatBroker(hariAktif), [hariAktif])
  const { beli, jual } = useMemo(() => tabelDuaSisi(agg, mode), [agg, mode])
  const ringkas = useMemo(() => ringkasSB(agg), [agg])
  const ohlcvAktif = useMemo(() => (ohlcv ? irisOhlcv(ohlcv, dari, akhir) : []), [ohlcv, dari, akhir])
  const vwap = useMemo(() => vwapRentang(ohlcvAktif), [ohlcvAktif])
  const hargaTerakhir = ohlcvAktif.length ? ohlcvAktif[ohlcvAktif.length - 1].tutup : null

  const rataLot = [1, 2, 3, 4, 5].reduce((s, n) => s + ringkas.topLot(n), 0) / 5
  const rataVal = [1, 2, 3, 4, 5].reduce((s, n) => s + ringkas.topVal(n), 0) / 5

  return (
    <div className="lantai">
      <div className="vhead">
        <h1>Broker Summary v2 · {kode}</h1>
        <span className="sub">arus broker per emiten · arsip harian Stockbit · pilot BUMI, emiten lain menyusul</span>
      </div>

      <div className="panel">
        <div className="panel-h bs-h">
          <span className="af-cari bsv-cari">
            <IkonMenu d={IKON_CARI} size={13} />
            <StockAutocomplete
              stocks={index?.stocks ?? []}
              value={cari}
              onChange={setCari}
              onSelect={(t) => { if (t) { setKode(t.toUpperCase()); setCari('') } }}
              placeholder="Ganti kode: BUMI, BBCA…"
            />
          </span>
          <div className="bs-ctl">
            <PemilihRentang opsi={MODE_OPSI} nilai={mode} onGanti={setMode} ariaLabel="Net atau Gross" />
            <PemilihRentang opsi={PASAR_OPSI} nilai={pasar} onGanti={setPasar} ariaLabel="Pasar" />
            <div className="bs-tgl">
              <PemilihRentang className="bs-preset" opsi={PRESET} nilai={preset ?? 'b1'} onGanti={keRentang} />
              <div className="bilah-rentang">
                <DatePicker value={dari} onChange={(iso) => keRentangBebas(iso, akhir)} tersedia={setTersedia} ariaLabel="Tanggal mulai rentang" rata="kanan" />
                <span className="bilah-rentang-pisah" aria-hidden="true">s.d.</span>
                <DatePicker value={akhir} onChange={(iso) => keRentangBebas(dari, iso)} tersedia={setTersedia} ariaLabel="Tanggal akhir rentang" rata="kanan" />
              </div>
            </div>
          </div>
        </div>

        <div className="panel-b">
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <p><IkonMenu d={IKON_ULANG} size={26} /></p>
              <p className="lbl">Memuat arus broker {kode}…</p>
            </div>
          )}
          {!loading && error && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
              <p className="lbl">{error} — coba BUMI (pilot yang sudah lengkap).</p>
            </div>
          )}
          {!loading && !error && semuaHari.length > 0 && (
            <>
              <div className="chip warn" style={{ marginBottom: 12 }}>
                {dari && akhir ? `${dari} – ${akhir} (${hariAktif.length} hari bursa)` : 'memuat rentang…'}
                {hargaTerakhir ? ` · harga tutup terakhir Rp ${keFraksi(hargaTerakhir).toLocaleString('id-ID')}` : ''}
                {vwap ? ` · VWAP periode Rp ${Math.round(vwap).toLocaleString('id-ID')}` : ''}
              </div>

              <div className="grid3" style={{ marginBottom: 14 }}>
                <div className="vcard">
                  <span className="lbl">Net Volume</span>
                  <span className="v-num num">{fmtLot(ringkas.netVol)}</span>
                  <span className="v-note">Σ net pembeli</span>
                </div>
                <div className="vcard">
                  <span className="lbl">Net Value</span>
                  <span className="v-num num">Rp {fmtB(ringkas.netVal)}</span>
                  <span className="v-note">Σ nilai net pembeli</span>
                </div>
                <div className="vcard">
                  <span className="lbl">Average</span>
                  <span className="v-num num">{ringkas.netVol ? `Rp ${Math.round(ringkas.avg).toLocaleString('id-ID')}` : '—'}</span>
                  <span className="v-note">net value ÷ net volume</span>
                </div>
              </div>

              <div className="board-tbl-wrap" style={{ marginBottom: 16 }}>
                <table className="tbl">
                  <thead>
                    <tr><th>Pembeli − penjual</th><th className="r">Lot</th><th className="r">%</th><th className="r">Nilai net</th></tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5].map((n) => {
                      const lot = ringkas.topLot(n)
                      const val = ringkas.topVal(n)
                      const pct = ringkas.netVol ? (lot / ringkas.netVol) * 100 : 0
                      return (
                        <tr key={n}>
                          <td>Top {n}</td>
                          <td className="r num">{fmtLot(lot)}</td>
                          <td className="r num">{pct.toFixed(1)}%</td>
                          <td className="r num">Rp {fmtB(val)}</td>
                        </tr>
                      )
                    })}
                    <tr>
                      <td title="rata-rata Top 1–5">Average</td>
                      <td className="r num">{fmtLot(rataLot)}</td>
                      <td className="r num">{ringkas.netVol ? ((rataLot / ringkas.netVol) * 100).toFixed(1) : '0.0'}%</td>
                      <td className="r num">Rp {fmtB(rataVal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="grid2">
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="lbl green">Beli</span>
                    <span className="lbl">{beli.length} broker</span>
                  </div>
                  <div className="board-tbl-wrap">
                    <table className="tbl">
                      <thead><tr><th>BY</th><th className="r">Nilai</th><th className="r">Lot</th><th className="r">Avg</th></tr></thead>
                      <tbody>{beli.map((r) => <BarisSisi key={r.broker} r={r} />)}</tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="lbl red">Jual</span>
                    <span className="lbl">{jual.length} broker</span>
                  </div>
                  <div className="board-tbl-wrap">
                    <table className="tbl">
                      <thead><tr><th>SL</th><th className="r">Nilai</th><th className="r">Lot</th><th className="r">Avg</th></tr></thead>
                      <tbody>{jual.map((r) => <BarisSisi key={r.broker} r={r} />)}</tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {!loading && !error && semuaHari.length > 0 && (
        <div className="panel" style={{ marginTop: 14 }}>
          <div className="panel-h bs-h">
            <div className="tabs" role="tablist" aria-label="Analisa Broker Summary v2">
              {TABS.map((t) => (
                <button
                  key={t.id} type="button" role="tab" aria-selected={tab === t.id}
                  className={'tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="panel-b">
            {tab === 'inventory' && <Inventory hari={hariAktif} agg={agg} ohlcv={ohlcvAktif} />}
            {tab === 'kuadran' && <Kuadran agg={agg} vwap={vwap} />}
            {tab === 'floor' && <FloorPrice hari={hariAktif} />}
          </div>
        </div>
      )}
    </div>
  )
}
