import { useEffect, useMemo, useState } from 'react'
import type { ChartConfiguration } from 'chart.js/auto'
import { useChartCanvas, bacaTokenTema } from '../../../lib/dasbor/useChartJs'
import { muatOhlcv, muatBrokerHarian, type BarHarga, type BrokerHarianEmiten } from '../../../lib/dasbor/neoPapanData'
import { moneyFlowAsing } from '../../../lib/dasbor/neoPapan'
import { fmtB, Kosong, Kv, KvGrid, Sumber, potongRentang, type RentangNp } from './bersama'

/**
 * Transaction Chart — candle diganti garis harga tutup (bukan candlestick
 * asli: proyek belum punya plugin candlestick Chart.js, pola sama dengan
 * Broker Summary v2), overlay IHSG dinormalkan ke basis 100, volume & money
 * flow asing sebagai bar. KV kanan dari rincian broker HARI TERAKHIR yang
 * ada arsipnya — kosong (bukan nol) kalau emiten ini belum dipanen.
 */
export function TransaksiTab({ kode, rentang }: { kode: string; rentang: RentangNp }) {
  const [bars, setBars] = useState<BarHarga[] | null>(null)
  const [ihsg, setIhsg] = useState<BarHarga[] | null>(null)
  const [broker, setBroker] = useState<BrokerHarianEmiten | null | undefined>(undefined)

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

  const hariTerakhirBroker = useMemo(() => {
    if (!broker) return null
    const tgl = Object.keys(broker.hari).sort().pop()
    return tgl ? { tanggal: tgl, ringkas: broker.hari[tgl].ringkas } : null
  }, [broker])

  const configHarga = useMemo<ChartConfiguration<'bar' | 'line'> | null>(() => {
    if (!rows.length) return null
    const naik = bacaTokenTema('--green'), turun = bacaTokenTema('--red')
    const biru = bacaTokenTema('--blue'), amber = bacaTokenTema('--amber'), abu = bacaTokenTema('--text2')
    const labels = rows.map((r) => r.t)
    const ihsgAwal = ihsgMap.get(labels.find((t) => ihsgMap.has(t)) ?? '') || null
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'line', label: 'Harga tutup', data: rows.map((r) => r.c),
            borderColor: amber, borderWidth: 2, pointRadius: 0, yAxisID: 'y', order: 0,
          },
          {
            type: 'line', label: 'IHSG (basis 100)', data: rows.map((r) => {
              const v = ihsgMap.get(r.t)
              return v != null && ihsgAwal ? (v / ihsgAwal) * 100 : null
            }),
            borderColor: biru, borderWidth: 1.5, pointRadius: 0, yAxisID: 'y1', order: 1, spanGaps: true,
          },
          {
            type: 'bar', label: 'Volume', data: rows.map((r) => r.v),
            backgroundColor: rows.map((r) => (r.c >= r.o ? naik : turun)), yAxisID: 'y2', order: 2,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom', labels: { color: abu, boxWidth: 12, font: { size: 10 } } } },
        scales: {
          x: { ticks: { color: abu, maxTicksLimit: 10 }, grid: { display: false } },
          y: { position: 'left', ticks: { color: abu }, grid: { color: 'rgba(128,128,128,.1)' } },
          y1: { position: 'right', ticks: { color: abu }, grid: { display: false }, title: { display: true, text: 'IHSG (basis 100)', color: abu, font: { size: 10 } } },
          y2: { display: false, min: 0, suggestedMax: rows.length ? Math.max(...rows.map((r) => r.v)) * 4 : undefined },
        },
      },
    }
  }, [rows, ihsgMap])
  const refHarga = useChartCanvas(configHarga)

  const configFlow = useMemo<ChartConfiguration<'bar'> | null>(() => {
    if (!rows.length) return null
    const biru = bacaTokenTema('--blue'), abu = bacaTokenTema('--text2')
    return {
      type: 'bar',
      data: { labels: rows.map((r) => r.t), datasets: [{ label: 'Net asing harian (Rp)', data: rows.map(moneyFlowAsing), backgroundColor: biru }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: abu, maxTicksLimit: 8 }, grid: { display: false } },
          y: { ticks: { color: abu, callback: (v) => fmtB(Number(v)) }, grid: { color: 'rgba(128,128,128,.1)' } },
        },
      },
    }
  }, [rows])
  const refFlow = useChartCanvas(configFlow)

  if (bars === null) return <Kosong>Memuat…</Kosong>
  if (!bars.length) return <Kosong>Riwayat harga emiten ini belum ada di arsip.</Kosong>

  const last = rows[rows.length - 1]

  return (
    <section className="panel panel-b">
      <h2>{kode} — Transaction Chart</h2>
      <p className="np-sub">Harga tutup &amp; volume, dengan garis IHSG dinormalkan (basis 100) dan money flow asing harian.</p>
      <div className="chart-wrap" style={{ height: 380 }}><canvas ref={refHarga} /></div>
      <div className="chart-wrap" style={{ height: 140, marginTop: 10 }}><canvas ref={refFlow} /></div>

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

      <Sumber>
        Harga, volume, dan net asing harian dari arsip transaksi Stockbit. IHSG dari arsip yang sama.
        {hariTerakhirBroker && ` Kecenderungan broker & Top1/3/5 dari rincian broker ${hariTerakhirBroker.tanggal}.`}
      </Sumber>
    </section>
  )
}

function num2(n: number): string {
  return n.toLocaleString('id-ID', { maximumFractionDigits: 1 })
}
