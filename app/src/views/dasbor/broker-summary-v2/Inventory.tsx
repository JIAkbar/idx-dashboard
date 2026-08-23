import { useMemo } from 'react'
import type { ChartConfiguration } from 'chart.js/auto'
import { useChartCanvas } from '../../../lib/dasbor/useChartJs'
import { useTheme } from '../../../context/ThemeContext'
import { kumulatifBroker, type AgregatBroker, type HariBroker } from '../../../lib/dasbor/brokerEmiten'
import { pilihTopInventaris, type BarisOhlcv } from '../../../lib/dasbor/brokerEmitenV2'
import { warnaBroker } from '../../../lib/dasbor/kelompokBroker'
import { fmtB } from '../../../lib/dasbor/brokerSummaryFormat'

interface InventoryProps {
  hari: Array<[string, HariBroker]>
  agg: AgregatBroker[]
  ohlcv: BarisOhlcv[]
}

/**
 * Tab "Inventory" — net kumulatif per broker (`kumulatifBroker`,
 * brokerEmiten.ts) untuk 4 pembeli & 4 penjual bersih terbesar
 * (`pilihTopInventaris`), overlay harga tutup di sumbu kanan. Warna garis
 * ikut kelompok identitas broker (`kelompokBroker.ts`, #170 aturan warna) —
 * garis putus-putus menandai sisi penjual supaya tak perlu warna kedua.
 */
export function Inventory({ hari, agg, ohlcv }: InventoryProps) {
  const { theme } = useTheme()
  const { pembeli, penjual } = useMemo(() => pilihTopInventaris(agg, 4), [agg])
  const brokers = useMemo(() => [...pembeli, ...penjual], [pembeli, penjual])

  const config = useMemo<ChartConfiguration<'line'> | null>(() => {
    if (hari.length === 0 || brokers.length === 0) return null
    const isDark = theme === 'dark'
    const textColor = isDark ? '#cfd8e3' : '#1a2733'
    const text2Color = isDark ? '#8494a8' : '#4b6070'
    const gridColor = 'rgba(128,128,128,.1)'
    const deret = kumulatifBroker(hari, brokers, 'nilai')
    const labels = deret.map((d) => d.tanggal)
    const hargaPerTanggal = new Map(ohlcv.map((o) => [o.tanggal, o.tutup]))

    const datasetsBroker = brokers.map((k) => ({
      label: k,
      data: deret.map((d) => d.nilai[k] ?? 0),
      borderColor: warnaBroker(k),
      backgroundColor: warnaBroker(k),
      borderWidth: pembeli.includes(k) ? 2 : 1.5,
      borderDash: penjual.includes(k) ? [4, 3] : [],
      pointRadius: 0,
      yAxisID: 'y' as const,
      tension: 0.1,
    }))

    const datasetHarga = {
      label: 'Harga tutup',
      data: labels.map((t) => hargaPerTanggal.get(t) ?? null),
      borderColor: textColor,
      borderWidth: 2,
      pointRadius: 0,
      yAxisID: 'y1' as const,
      spanGaps: true,
    }

    return {
      type: 'line',
      data: { labels, datasets: [...datasetsBroker, datasetHarga] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor, boxWidth: 12, font: { size: 10 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.dataset.yAxisID === 'y1'
                ? `Harga tutup: Rp ${Math.round(Number(ctx.raw)).toLocaleString('id-ID')}`
                : `${ctx.dataset.label}: ${fmtB(Number(ctx.raw))}`,
            },
          },
        },
        scales: {
          x: { ticks: { color: text2Color, maxTicksLimit: 10 }, grid: { color: gridColor } },
          y: {
            position: 'left', grid: { color: gridColor },
            title: { display: true, text: 'Net kumulatif (Rp)', color: text2Color, font: { size: 11 } },
            ticks: { color: text2Color, callback: (v) => fmtB(Number(v)) },
          },
          y1: {
            position: 'right', grid: { display: false },
            title: { display: true, text: 'Harga tutup (Rp)', color: text2Color, font: { size: 11 } },
            ticks: { color: text2Color },
          },
        },
      },
    }
  }, [hari, brokers, pembeli, penjual, ohlcv, theme])

  const canvasRef = useChartCanvas(config)

  if (!config) {
    return <p className="lbl" style={{ padding: '20px 0', textAlign: 'center' }}>Tak ada broker aktif dalam rentang ini.</p>
  }

  return (
    <div>
      <div className="lbl" style={{ marginBottom: 8 }}>
        4 pembeli &amp; 4 penjual bersih terbesar · garis solid = pembeli, putus-putus = penjual · garis tebal = harga tutup
      </div>
      <div className="chart-wrap chart-tinggi">
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}
