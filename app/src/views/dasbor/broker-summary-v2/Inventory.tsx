import { useMemo } from 'react'
import type { ChartConfiguration, Plugin } from 'chart.js/auto'
import { useChartCanvas } from '../../../lib/dasbor/useChartJs'
import { useTheme } from '../../../context/ThemeContext'
import { kumulatifBroker, type AgregatBroker, type HariBroker } from '../../../lib/dasbor/brokerEmiten'
import { pilihTopInventaris, type BarisOhlcv } from '../../../lib/dasbor/brokerEmitenV2'
import { warnaBrokerCanvas } from '../../../lib/dasbor/kelompokBroker'
import { fmtB, fmtLot } from '../../../lib/dasbor/brokerSummaryFormat'

interface InventoryProps {
  hari: Array<[string, HariBroker]>
  agg: AgregatBroker[]
  ohlcv: BarisOhlcv[]
  /** Nilai (Rp) atau lot — prop header BSv2 diteruskan (§B.6 wiring). */
  ukuran: 'nilai' | 'lot'
}

/**
 * Tab "Inventory" — net kumulatif per broker (`kumulatifBroker`,
 * brokerEmiten.ts) untuk 4 pembeli & 4 penjual bersih terbesar
 * (`pilihTopInventaris`), overlay harga tutup di sumbu kanan. Warna garis
 * ikut kelompok identitas broker (`kelompokBroker.ts`, #170 aturan warna) —
 * garis putus-putus menandai sisi penjual supaya tak perlu warna kedua.
 */
export function Inventory({ hari, agg, ohlcv, ukuran }: InventoryProps) {
  const { theme } = useTheme()
  const { pembeli, penjual } = useMemo(() => pilihTopInventaris(agg, 4, ukuran), [agg, ukuran])
  const brokers = useMemo(() => [...pembeli, ...penjual], [pembeli, penjual])
  const fmt = ukuran === 'nilai' ? fmtB : fmtLot

  const config = useMemo<ChartConfiguration<'line'> | null>(() => {
    if (hari.length === 0 || brokers.length === 0) return null
    const isDark = theme === 'dark'
    const textColor = isDark ? '#cfd8e3' : '#1a2733'
    const text2Color = isDark ? '#8494a8' : '#4b6070'
    const gridColor = 'rgba(128,128,128,.1)'
    const deret = kumulatifBroker(hari, brokers, ukuran)
    const labels = deret.map((d) => d.tanggal)
    const hargaPerTanggal = new Map(ohlcv.map((o) => [o.tanggal, o.tutup]))

    const datasetsBroker = brokers.map((k) => ({
      label: k,
      data: deret.map((d) => d.nilai[k] ?? 0),
      borderColor: warnaBrokerCanvas(k),
      backgroundColor: warnaBrokerCanvas(k),
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

    // Badge kode broker (+ "Harga tutup") di ujung kanan tiap garis, di titik
    // data TERAKHIR — supaya identitas garis tak cuma terbaca lewat tooltip
    // (Johan, 23 Agu 2026). Plugin Chart.js kecil sendiri, bukan dependensi
    // baru (proyek belum punya chartjs-plugin-datalabels): canvas fillText
    // juga tak bisa mengurai var(...), jadi warnanya diambil langsung dari
    // borderColor dataset (sudah hex nyata lewat warnaBrokerCanvas di atas).
    const labelUjungPlugin: Plugin<'line'> = {
      id: 'labelUjung',
      afterDatasetsDraw(chart) {
        const { ctx, chartArea } = chart
        if (!chartArea) return
        const kecil = chart.width < 480
        const ukuranFont = kecil ? 8 : 9.5
        const tinggiBaris = kecil ? 11 : 13

        const entri: { y: number; label: string; color: string }[] = []
        chart.data.datasets.forEach((ds, i) => {
          const meta = chart.getDatasetMeta(i)
          if (meta.hidden) return
          const data = ds.data as Array<number | null>
          let idx = data.length - 1
          while (idx >= 0 && (data[idx] === null || data[idx] === undefined)) idx--
          if (idx < 0) return
          const titik = meta.data[idx] as unknown as { y: number } | undefined
          if (!titik) return
          entri.push({ y: titik.y, label: String(ds.label ?? ''), color: String(ds.borderColor ?? '#8F98A6') })
        })
        if (entri.length === 0) return

        // Sisir tumpang tindih: urutkan dari atas, jaga jarak minimum, lalu
        // geser semuanya balik ke dalam area kalau yang terbawah kelebihan.
        entri.sort((a, b) => a.y - b.y)
        for (let i = 1; i < entri.length; i++) {
          if (entri[i].y - entri[i - 1].y < tinggiBaris) entri[i].y = entri[i - 1].y + tinggiBaris
        }
        const kelebihan = entri[entri.length - 1].y - chartArea.bottom
        if (kelebihan > 0) entri.forEach((e) => { e.y -= kelebihan })

        ctx.save()
        ctx.font = `700 ${ukuranFont}px "IBM Plex Mono", Consolas, monospace`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        const latar = isDark ? 'rgba(10,11,14,.72)' : 'rgba(255,255,255,.82)'
        const x = chartArea.right - 3
        entri.forEach(({ y, label, color }) => {
          const lebar = ctx.measureText(label).width
          ctx.fillStyle = latar
          ctx.fillRect(x - lebar - 6, y - tinggiBaris / 2, lebar + 8, tinggiBaris)
          ctx.fillStyle = color
          ctx.fillText(label, x, y + 0.5)
        })
        ctx.restore()
      },
    }

    return {
      type: 'line',
      data: { labels, datasets: [...datasetsBroker, datasetHarga] },
      plugins: [labelUjungPlugin],
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
                : `${ctx.dataset.label}: ${fmt(Number(ctx.raw))}`,
            },
          },
        },
        scales: {
          x: { ticks: { color: text2Color, maxTicksLimit: 10 }, grid: { color: gridColor } },
          y: {
            position: 'left', grid: { color: gridColor },
            title: { display: true, text: `Net kumulatif (${ukuran === 'nilai' ? 'Rp' : 'lot'})`, color: text2Color, font: { size: 11 } },
            ticks: { color: text2Color, callback: (v) => fmt(Number(v)) },
          },
          y1: {
            position: 'right', grid: { display: false },
            title: { display: true, text: 'Harga tutup (Rp)', color: text2Color, font: { size: 11 } },
            ticks: { color: text2Color },
          },
        },
      },
    }
  }, [hari, brokers, pembeli, penjual, ohlcv, theme, ukuran, fmt])

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
