import { useEffect, useMemo, useRef, useState } from 'react'
import { TAHUN_AWAL } from '../../../lib/dasbor/brokerEmitenV2'
import {
  CandlestickSeries, CrosshairMode, createChart,
  type IChartApi, type ISeriesApi, type SeriesType,
} from 'lightweight-charts'
import { muatCandle, type DataCandle } from '../../../lib/dasbor/candleStockbit'
import { muatRentang, type HariBroker as HariTahunan } from '../../../lib/dasbor/brokerEmiten'
import { SeleksiRentangChart } from '../../../lib/dasbor/seleksiRentangChart'
import { agregasiBroker, avgHarga, type AgregatBroker } from '../../../lib/dasbor/neoPapan'
import { PemilihRentang } from '../../../components/dasbor/PemilihRentang'
import { DatePicker } from '../../../components/dasbor/DatePicker'
import { useTheme } from '../../../context/ThemeContext'
import { fmtB, num, Kosong, Sumber } from './bersama'
import { InfoIndikator, type ItemInfoIndikator } from '../../../components/dasbor/InfoIndikator'

/** Modal "i" — penjelasan kendali & kolom pembanding (sweep Johan 27 Agu). */
const INFO_COMPARE: ItemInfoIndikator[] = [
  { nama: 'Seret pita', isi: 'Seret pada chart kiri/kanan untuk memilih sub-rentang tanggal; klik singkat mengembalikan ke seluruh jendela (tanggal akhir dikurangi lebar preset).' },
  { nama: '1 Bulan / 3 Bulan / 6 Bulan / 1 Tahun', isi: 'Tanggal akhir dan lebar jendela tiap sisi — kiri dan kanan bebas beda periode, termasuk beda tahun.' },
  { nama: 'Clear', isi: 'Menghapus pilihan sub-rentang (pita) di kedua sisi, kembali ke seluruh jendela.' },
  { nama: 'Change from A', isi: 'Perubahan net broker dari periode A ke B. "≫" berarti |Net A| terlalu kecil sebagai basis — persentasenya benar aritmetika tapi tak bermakna. "↺ balik akumulasi/distribusi" berarti A dan B berlawanan tanda — broker berbalik dari melepas jadi menampung (atau sebaliknya), persentase perubahan tak bermakna meski basisnya besar.' },
]

/**
 * Compare Inventory V2 (spek §4 + PENAJAMAN2): dua chart candle LEFT/RIGHT
 * dengan BRUSH pita waktu (`SeleksiRentangChart` — primitive rentang-waktu
 * yang lebih sederhana dari seleksi-area Whales). Periode A dan B boleh BEDA
 * TAHUN (jalur tahunan lengkap 2020–2026) — bandingkan Agustus 2025 vs
 * Agustus 2026; NeoBDM tak bisa.
 *
 * Pan/zoom chart DIMATIKAN — di sini seret = memilih rentang, satu gerakan
 * tanpa mode. `CHANGE FROM A %` pada basis mendekati nol tak ditampilkan
 * sebagai angka raksasa (+2773% ala NeoBDM) — diganti "≫" berketerangan.
 */

const LEBAR = [
  { id: 'b1', label: '1 Bulan' },
  { id: 'b3', label: '3 Bulan' },
  { id: 'b6', label: '6 Bulan' },
  { id: 'y1', label: '1 Tahun' },
] as const
type IdLebar = (typeof LEBAR)[number]['id']
const HARI_LEBAR: Record<IdLebar, number> = { b1: 31, b3: 92, b6: 183, y1: 366 }

/** |Net A| di bawah ini → CHANGE% tak bermakna, tampilkan "≫". */
const AMBANG_BASIS = 50_000_000

interface Sisi {
  akhir: string
  lebar: IdLebar
  /** Sub-rentang brush; null = seluruh jendela. */
  brush: { t0: string; t1: string } | null
}

function mundur(iso: string, hari: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - hari)).toISOString().slice(0, 10)
}

/** Chart candle mini ber-brush untuk satu sisi. */
function ChartSisi({ candle, sisi, warna, onBrush }: {
  candle: DataCandle
  sisi: Sisi
  warna: string
  onBrush: (b: { t0: string; t1: string } | null) => void
}) {
  const { theme } = useTheme()
  const bungkusRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const lilinRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const bandRef = useRef<SeleksiRentangChart | null>(null)
  const seretRef = useRef<{ x0: number } | null>(null)

  const dari = mundur(sisi.akhir, HARI_LEBAR[sisi.lebar])
  const lilinJendela = useMemo(
    () => candle.lilin.filter((b) => String(b.time) >= dari && String(b.time) <= sisi.akhir),
    [candle, dari, sisi.akhir],
  )

  useEffect(() => {
    const el = bungkusRef.current
    if (!el) return
    const chart = createChart(el, {
      autoSize: true,
      localization: { locale: 'id-ID', dateFormat: 'dd MMM yyyy' },
      layout: { background: { color: 'transparent' }, attributionLogo: false },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
      // seret = brush, bukan pan — chart mini ini alat pilih rentang
      handleScroll: false,
      handleScale: false,
    })
    const lilin = chart.addSeries(CandlestickSeries)
    chartRef.current = chart
    lilinRef.current = lilin
    const pane0 = chart.panes()[0]
    if (pane0) {
      const band = new SeleksiRentangChart(() => warna)
      pane0.attachPrimitive(band)
      bandRef.current = band
    }
    return () => {
      chart.remove()
      chartRef.current = null
      lilinRef.current = null
      bandRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = bungkusRef.current
    const chart = chartRef.current
    if (!el || !chart) return
    const gaya = getComputedStyle(el)
    const c = (v: string, cad: string) => (gaya.getPropertyValue(v) || '').trim() || cad
    chart.applyOptions({
      layout: { textColor: c('--text2', '#9CA0AC') },
      grid: { vertLines: { color: c('--line', '#24262E') }, horzLines: { color: c('--line', '#24262E') } },
    })
  }, [theme])

  useEffect(() => {
    const chart = chartRef.current
    const lilin = lilinRef.current
    if (!chart || !lilin) return
    // Nyalakan ulang autoScale tiap data berganti — pinch/drag di sumbu harga
    // mematikannya permanen dan kisaran emiten lama menetap (bug 27 Agu).
    lilin.priceScale().applyOptions({ autoScale: true })
    lilin.setData(lilinJendela)
    chart.timeScale().fitContent()
  }, [lilinJendela])

  useEffect(() => {
    bandRef.current?.setRentang(sisi.brush)
  }, [sisi.brush])

  const keTanggal = (x: number): string | null => {
    const chart = chartRef.current
    if (!chart || lilinJendela.length === 0) return null
    const t = chart.timeScale().coordinateToTime(x) as string | null
    if (t !== null) return t
    const el = bungkusRef.current
    const tengah = el ? el.clientWidth / 2 : 0
    return String(x < tengah ? lilinJendela[0].time : lilinJendela[lilinJendela.length - 1].time)
  }
  const posX = (e: React.PointerEvent<HTMLDivElement>) => e.clientX - e.currentTarget.getBoundingClientRect().left

  return (
    <div
      ref={bungkusRef}
      className="np-cmp-chart"
      onPointerDown={(e) => {
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* pointer sintetis/teruji */ }
        seretRef.current = { x0: posX(e) }
      }}
      onPointerMove={(e) => {
        const s = seretRef.current
        if (!s) return
        const a = keTanggal(s.x0)
        const b = keTanggal(posX(e))
        if (a && b) bandRef.current?.setRentang({ t0: a <= b ? a : b, t1: a <= b ? b : a })
      }}
      onPointerUp={(e) => {
        const s = seretRef.current
        seretRef.current = null
        if (!s) return
        const x1 = posX(e)
        if (Math.abs(x1 - s.x0) <= 4) {
          // klik = bersihkan brush (kembali seluruh jendela)
          onBrush(null)
          bandRef.current?.setRentang(null)
          return
        }
        const a = keTanggal(s.x0)
        const b = keTanggal(x1)
        if (a && b) onBrush({ t0: a <= b ? a : b, t1: a <= b ? b : a })
      }}
    />
  )
}

export function CompareTab({ kode }: { kode: string }) {
  const [candle, setCandle] = useState<DataCandle | null>(null)
  const [a, setA] = useState<Sisi | null>(null)
  const [b, setB] = useState<Sisi | null>(null)
  const [hariA, setHariA] = useState<Array<[string, HariTahunan]> | null>(null)
  const [hariB, setHariB] = useState<Array<[string, HariTahunan]> | null>(null)

  useEffect(() => {
    let batal = false
    setCandle(null); setA(null); setB(null)
    muatCandle(kode).then((d) => {
      if (batal) return
      setCandle(d)
      const akhir = d.lilin.length ? String(d.lilin[d.lilin.length - 1].time) : ''
      if (akhir) {
        setA({ akhir, lebar: 'b3', brush: null })
        setB({ akhir, lebar: 'b1', brush: null })
      }
    })
    return () => { batal = true }
  }, [kode])

  const rentangEfektif = (s: Sisi | null) => {
    if (!s) return null
    const dari = s.brush?.t0 ?? mundur(s.akhir, HARI_LEBAR[s.lebar])
    const sampai = s.brush?.t1 ?? s.akhir
    return { dari, sampai }
  }
  const reA = rentangEfektif(a)
  const reB = rentangEfektif(b)

  useEffect(() => {
    if (!reA) return
    let batal = false
    setHariA(null)
    muatRentang(kode, reA.dari, reA.sampai).then((h) => { if (!batal) setHariA(h) })
    return () => { batal = true }
  }, [kode, reA?.dari, reA?.sampai]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!reB) return
    let batal = false
    setHariB(null)
    muatRentang(kode, reB.dari, reB.sampai).then((h) => { if (!batal) setHariB(h) })
    return () => { batal = true }
  }, [kode, reB?.dari, reB?.sampai]) // eslint-disable-line react-hooks/exhaustive-deps

  const keAgg = (hari: Array<[string, HariTahunan]> | null): AgregatBroker[] => {
    if (!hari) return []
    const rec: Record<string, { broker: Array<{ kode: string; beliLot: number; beliNilai: number; jualLot: number; jualNilai: number }> }> = {}
    for (const [t, h] of hari) {
      rec[t] = { broker: h.broker.map(([kd, beliLot, beliNilai, jualLot, jualNilai]) => ({ kode: kd, beliLot, beliNilai, jualLot, jualNilai })) }
    }
    return agregasiBroker(rec, Object.keys(rec).sort())
  }
  const aggA = useMemo(() => keAgg(hariA), [hariA])
  const aggB = useMemo(() => keAgg(hariB), [hariB])

  const gabung = useMemo(() => {
    const mA = new Map(aggA.map((x) => [x.kode, x]))
    const mB = new Map(aggB.map((x) => [x.kode, x]))
    const kode2 = new Set([...mA.keys(), ...mB.keys()])
    return [...kode2].map((k) => {
      const l = mA.get(k)
      const r = mB.get(k)
      return {
        kode: k,
        netA: l?.net ?? 0, netB: r?.net ?? 0,
        bavgA: l ? avgHarga(l.beliNilai, l.beliLot) : null, savgA: l ? avgHarga(l.jualNilai, l.jualLot) : null,
        bavgB: r ? avgHarga(r.beliNilai, r.beliLot) : null, savgB: r ? avgHarga(r.jualNilai, r.jualLot) : null,
      }
    }).sort((x, y) => (Math.abs(y.netA) + Math.abs(y.netB)) - (Math.abs(x.netA) + Math.abs(x.netB)))
  }, [aggA, aggB])

  const total = useMemo(() => gabung.reduce((s, x) => ({ netA: s.netA + x.netA, netB: s.netB + x.netB }), { netA: 0, netB: 0 }), [gabung])

  const nA = hariA?.length ?? 0
  const nB = hariB?.length ?? 0

  const ubah = (x: { netA: number; netB: number }) => {
    if (Math.abs(x.netA) < AMBANG_BASIS) {
      return (
        <span className="muted" title={`Basis kiri terlalu kecil (|Net A| < Rp ${(AMBANG_BASIS / 1e6).toFixed(0)} jt) — persentasenya benar aritmetika tapi tak bermakna`}>
          ≫ basis kecil
        </span>
      )
    }
    // A dan B BERLAWANAN TANDA → persentase tak bermakna meski basisnya besar
    // (PENAJAMAN3): broker berbalik dari melepas jadi menampung (atau
    // sebaliknya) — itu justru informasi terpentingnya, bukan "−250%".
    if (x.netA * x.netB < 0) {
      return (
        <span className={x.netB >= 0 ? 'up' : 'dn'}
          title="Berlawanan tanda antara periode A dan B — persentase perubahan tak bermakna; baca nilai absolutnya">
          {x.netB >= 0 ? '↺ balik akumulasi' : '↺ balik distribusi'}
        </span>
      )
    }
    const p = ((x.netB - x.netA) / Math.abs(x.netA)) * 100
    return <span className={p >= 0 ? 'up' : 'dn'}>{p >= 0 ? '+' : ''}{num(p, 1)}%</span>
  }

  if (!candle || !a || !b) return <Kosong>Memuat…</Kosong>
  if (!candle.lilin.length) return <Kosong>Riwayat harga emiten ini belum ada di arsip.</Kosong>

  const Kontrol = ({ sisi, set, label }: { sisi: Sisi; set: (s: Sisi) => void; label: string }) => (
    <div className="np-baris">
      <span className="np-lbl">{label}</span>
      <DatePicker value={sisi.akhir} onChange={(iso) => set({ ...sisi, akhir: iso, brush: null })}
        maks={String(candle.lilin[candle.lilin.length - 1].time)} ariaLabel={`Tanggal akhir ${label}`} />
      <PemilihRentang opsi={LEBAR.map((l) => ({ id: l.id, label: l.label }))} nilai={sisi.lebar}
        onGanti={(id) => set({ ...sisi, lebar: id as IdLebar, brush: null })} />
    </div>
  )

  return (
    <section className="panel panel-b">
      <h2>{kode} — Compare Inventory</h2>
      <p className="np-sub">
        Seret pita di chart untuk memilih sub-rentang (klik = seluruh jendela). Periode kiri dan
        kanan bebas — termasuk beda tahun.
      </p>
      <div className="np-sub">
        <b>Left:</b> {reA?.dari} → {reA?.sampai} ({nA} hari bursa) · <b>Right:</b> {reB?.dari} → {reB?.sampai} ({nB} hari)
        {(a.brush || b.brush) && (
          <button type="button" className="chip-t" style={{ marginLeft: 8 }}
            onClick={() => { setA({ ...a, brush: null }); setB({ ...b, brush: null }) }}>Clear</button>
        )}
        {' '}<InfoIndikator judul="Indikator Compare Inventory" item={INFO_COMPARE} />
      </div>

      <div className="np-2kol">
        <div>
          <Kontrol sisi={a} set={setA} label="Kiri (A)" />
          <ChartSisi candle={candle} sisi={a} warna="#5B94E8" onBrush={(br) => setA({ ...a, brush: br })} />
        </div>
        <div>
          <Kontrol sisi={b} set={setB} label="Kanan (B)" />
          <ChartSisi candle={candle} sisi={b} warna="#F2C230" onBrush={(br) => setB({ ...b, brush: br })} />
        </div>
      </div>

      {(hariA === null || hariB === null) ? <Kosong>Memuat arsip broker…</Kosong> : (
        <div className="tbl" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Broker</th>
                <th className="r">Net A</th><th className="r">B.Avg A</th><th className="r">S.Avg A</th>
                <th className="r">Net B</th><th className="r">B.Avg B</th><th className="r">S.Avg B</th>
                <th className="r">Change from A</th><th className="r">Total</th>
              </tr>
            </thead>
            <tbody>
              {gabung.slice(0, 30).map((x) => (
                <tr key={x.kode}>
                  <td><b>{x.kode}</b></td>
                  <td className={'r' + (x.netA >= 0 ? ' up' : ' dn')}>{fmtB(x.netA)}</td>
                  <td className="r">{x.bavgA != null ? num(x.bavgA) : '—'}</td>
                  <td className="r">{x.savgA != null ? num(x.savgA) : '—'}</td>
                  <td className={'r' + (x.netB >= 0 ? ' up' : ' dn')}>{fmtB(x.netB)}</td>
                  <td className="r">{x.bavgB != null ? num(x.bavgB) : '—'}</td>
                  <td className="r">{x.savgB != null ? num(x.savgB) : '—'}</td>
                  <td className="r">{ubah(x)}</td>
                  <td className={'r' + (x.netA + x.netB >= 0 ? ' up' : ' dn')}>{fmtB(x.netA + x.netB)}</td>
                </tr>
              ))}
              <tr>
                <td><b>Total</b></td>
                <td className={'r' + (total.netA >= 0 ? ' up' : ' dn')}><b>{fmtB(total.netA)}</b></td>
                <td className="r" colSpan={2}></td>
                <td className={'r' + (total.netB >= 0 ? ' up' : ' dn')}><b>{fmtB(total.netB)}</b></td>
                <td className="r" colSpan={2}></td>
                <td className="r">{ubah(total)}</td>
                <td className={'r' + (total.netA + total.netB >= 0 ? ' up' : ' dn')}><b>{fmtB(total.netA + total.netB)}</b></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <Sumber>Rincian broker dari arsip tahunan (sejak {TAHUN_AWAL}), pasar reguler seluruh investor.</Sumber>
    </section>
  )
}
