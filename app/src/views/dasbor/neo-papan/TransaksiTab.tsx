import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CandlestickSeries, CrosshairMode, HistogramSeries, LineSeries, createChart,
  type IChartApi, type ISeriesApi, type SeriesType, type Time,
} from 'lightweight-charts'
import { muatOhlcv, muatBrokerHarian, type BarHarga, type BrokerHarianEmiten } from '../../../lib/dasbor/neoPapanData'
import { moneyFlowAsing } from '../../../lib/dasbor/neoPapan'
import { useTheme } from '../../../context/ThemeContext'
import { fmtB, Kosong, Kv, KvGrid, Sumber, potongRentang, type RentangNp } from './bersama'

/**
 * Transaction Chart V2 (spek §8 + PENAJAMAN2 §6) — lightweight-charts:
 * candle SUNGGUHAN (alasan lama "belum punya plugin candlestick Chart.js"
 * gugur oleh migrasi ini), IHSG basis-100 di sumbu kiri, volume, lalu tiga
 * pane di bawahnya: Foreign Net Flow, bar investor 2-kategori JUJUR
 * (Asing = fb+fs vs Total nilai — sisanya domestik ASUMSI, bukan ukur
 * langsung), dan Participation.
 *
 * 🔴 Participation TIDAK memakai (fb+fs)/value — fb dan fs masing-masing
 * sisi independen 0..value, jumlahnya bisa 2×value (ingat top5_pct 200 di
 * arsip). Dipisah DUA rasio per sisi, masing-masing berskala 0–100%:
 * beli = fb/value, jual = fs/value.
 *
 * Klasifikasi 4-kategori Retail/Institution/Zombie NeoBDM DI LUAR CAKUPAN —
 * butuh klasifikasi perilaku broker yang belum diriset; dua kategori di sini
 * adalah yang benar-benar terukur.
 */
export function TransaksiTab({ kode, rentang }: { kode: string; rentang: RentangNp }) {
  const { theme } = useTheme()
  const [bars, setBars] = useState<BarHarga[] | null>(null)
  const [ihsg, setIhsg] = useState<BarHarga[] | null>(null)
  const [broker, setBroker] = useState<BrokerHarianEmiten | null | undefined>(undefined)

  const bungkusRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriRef = useRef<Record<string, ISeriesApi<SeriesType> | null>>({})

  useEffect(() => {
    let batal = false
    setBars(null); setBroker(undefined)
    Promise.all([muatOhlcv(kode), muatOhlcv('IHSG'), muatBrokerHarian(kode)]).then(([b, i, br]) => {
      if (batal) return
      setBars(b); setIhsg(i); setBroker(br)
    })
    return () => { batal = true }
  }, [kode])

  const rows = useMemo(() => potongRentang(bars ?? [], rentang), [bars, rentang])
  const ihsgMap = useMemo(() => new Map((ihsg ?? []).map((b) => [b.t, b.c])), [ihsg])

  useEffect(() => {
    const el = bungkusRef.current
    if (!el) return
    const chart = createChart(el, {
      autoSize: true,
      localization: { locale: 'id-ID', dateFormat: 'dd MMM yyyy' },
      layout: { background: { color: 'transparent' }, attributionLogo: false, panes: { separatorColor: 'rgba(128,128,128,.25)' } },
      rightPriceScale: { borderVisible: false },
      leftPriceScale: { visible: true, borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { labelVisible: true }, horzLine: { labelVisible: true } },
    })
    const s = seriRef.current
    s.lilin = chart.addSeries(CandlestickSeries)
    s.lilin.priceScale().applyOptions({ scaleMargins: { top: 0.05, bottom: 0.3 } })
    s.ihsg = chart.addSeries(LineSeries, {
      priceScaleId: 'left', color: '#5B94E8', lineWidth: 1, priceLineVisible: false, title: 'IHSG=100',
    })
    s.vol = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol' })
    s.vol.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })
    // pane 1: Foreign Net Flow (hijau/merah per tanda)
    s.flow = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'custom', formatter: (v: number) => fmtB(v), minMove: 1 },
    }, 1)
    // pane 2: bar investor 2-kategori jujur — Total nilai (redup, di belakang)
    // + Asing fb+fs (pekat, di depan) pada SKALA yang sama → porsi terbaca.
    s.total = chart.addSeries(HistogramSeries, {
      color: 'rgba(128, 140, 155, 0.45)',
      priceFormat: { type: 'custom', formatter: (v: number) => fmtB(v), minMove: 1 },
    }, 2)
    s.asing = chart.addSeries(HistogramSeries, { color: 'rgba(91, 148, 232, 0.9)' }, 2)
    // pane 3: Participation dua rasio per sisi, 0–100% masing-masing
    s.partBeli = chart.addSeries(LineSeries, {
      color: '#30a46c', lineWidth: 2, priceLineVisible: false, title: 'Beli asing %',
      priceFormat: { type: 'custom', formatter: (v: number) => `${v.toFixed(0)}%`, minMove: 0.1 },
    }, 3)
    s.partJual = chart.addSeries(LineSeries, {
      color: '#e5484d', lineWidth: 2, priceLineVisible: false, title: 'Jual asing %',
    }, 3)
    chartRef.current = chart
    if (import.meta.env.DEV) (el as HTMLDivElement & { __papanChart?: unknown }).__papanChart = chart
    return () => {
      chart.remove()
      chartRef.current = null
      seriRef.current = {}
    }
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
    const s = seriRef.current
    if (!chart || !s.lilin) return
    const t = (r: BarHarga) => r.t as Time
    s.lilin.setData(rows.map((r) => ({ time: t(r), open: r.o, high: r.h, low: r.l, close: r.c })))
    const ihsgAwal = ihsgMap.get(rows.find((r) => ihsgMap.has(r.t))?.t ?? '') || null
    s.ihsg?.setData(rows.flatMap((r) => {
      const v = ihsgMap.get(r.t)
      return v != null && ihsgAwal ? [{ time: t(r), value: (v / ihsgAwal) * 100 }] : []
    }))
    s.vol?.setData(rows.map((r) => ({ time: t(r), value: r.v, color: r.c >= r.o ? 'rgba(48,164,108,.5)' : 'rgba(229,72,77,.5)' })))
    s.flow?.setData(rows.map((r) => {
      const f = moneyFlowAsing(r)
      return { time: t(r), value: f, color: f >= 0 ? 'rgba(48,164,108,.8)' : 'rgba(229,72,77,.8)' }
    }))
    s.total?.setData(rows.map((r) => ({ time: t(r), value: r.val })))
    s.asing?.setData(rows.map((r) => ({ time: t(r), value: r.fb + r.fs })))
    s.partBeli?.setData(rows.flatMap((r) => (r.val ? [{ time: t(r), value: (r.fb / r.val) * 100 }] : [])))
    s.partJual?.setData(rows.flatMap((r) => (r.val ? [{ time: t(r), value: (r.fs / r.val) * 100 }] : [])))
    chart.timeScale().fitContent()
  }, [rows, ihsgMap])

  const hariTerakhirBroker = useMemo(() => {
    if (!broker) return null
    const tgl = Object.keys(broker.hari).sort().pop()
    return tgl ? { tanggal: tgl, ringkas: broker.hari[tgl].ringkas } : null
  }, [broker])

  const last = rows[rows.length - 1]

  return (
    <section className="panel panel-b">
      <h2>{kode} — Transaction Chart</h2>
      <p className="np-sub">
        Candle + IHSG basis-100 (kiri) + volume; di bawahnya net asing harian, nilai Asing vs Total,
        dan Participation per sisi (beli/jual asing ÷ total nilai — dua rasio TERPISAH, masing-masing
        0–100%; menjumlahkannya bisa 200% karena tiap sisi dihitung sendiri).
      </p>
      <div className="chart-wrap" style={{ height: 560 }}><div ref={bungkusRef} style={{ height: '100%' }} /></div>

      {bars === null && <Kosong>Memuat…</Kosong>}
      {bars !== null && !bars.length && <Kosong>Riwayat harga emiten ini belum ada di arsip.</Kosong>}

      {last && (
        <KvGrid>
          <Kv label={`Tutup ${last.t}`} value={num2(last.c)} />
          <Kv label="Saham beredar" value={fmtB(last.so)} />
          <Kv label="Kapitalisasi pasar" value={fmtB(last.so * last.c)} />
          {broker === undefined ? null : hariTerakhirBroker?.ringkas ? (
            <>
              <Kv label="Kecenderungan broker" value={hariTerakhirBroker.ringkas.accdist} warna={/Acc/i.test(hariTerakhirBroker.ringkas.accdist) ? 'up' : 'dn'} />
              <Kv label="Top1 / Top3 / Top5" value={`${num2(hariTerakhirBroker.ringkas.top1Pct)}% / ${num2(hariTerakhirBroker.ringkas.top3Pct)}% / ${num2(hariTerakhirBroker.ringkas.top5Pct)}%`} />
              <Kv label="Broker beli / jual" value={`${hariTerakhirBroker.ringkas.nBeli} / ${hariTerakhirBroker.ringkas.nJual}`} />
            </>
          ) : (
            <div className="np-peringatan" style={{ gridColumn: '1 / -1' }}>
              Rincian broker emiten ini belum tersedia — panen arsip broker masih berjalan.
            </div>
          )}
        </KvGrid>
      )}

      <Sumber>
        Harga, volume, dan net asing harian dari arsip transaksi. Bar "Asing" = nilai beli+jual
        asing; sisanya domestik sebagai ASUMSI (total − asing), bukan ukur langsung. Klasifikasi
        perilaku 4-kategori tidak disediakan — butuh riset klasifikasi broker tersendiri.
        {hariTerakhirBroker && ` Kecenderungan broker & Top1/3/5 dari rincian broker ${hariTerakhirBroker.tanggal} (Top3/Top5 bisa >100% — dua sisi dihitung sendiri).`}
      </Sumber>
    </section>
  )
}

function num2(n: number): string {
  return n.toLocaleString('id-ID', { maximumFractionDigits: 1 })
}
