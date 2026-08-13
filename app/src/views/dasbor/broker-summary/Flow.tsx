import { useMemo } from 'react'
import type { ChartConfiguration, ChartDataset } from 'chart.js/auto'
import { useChartCanvas } from '../../../lib/dasbor/useChartJs'
import { useTheme } from '../../../context/ThemeContext'
import { fmtLot } from '../../../lib/dasbor/brokerSummaryFormat'
import { BS_DATA } from '../../../lib/dasbor/brokerSummaryData'
import { IkonMenu, IKON_OMBAK } from '../../../components/dasbor/IkonMenu'

/**
 * Tab "Flow" — port bsRenderFlow() index_live.html baris 6012-6037. Chart
 * mixed bar (Foreign Buy/Sell) + line (Net) — historis PENUH atas semua
 * BS_DATA.dates, TIDAK ikut filter range tab lain.
 *
 * Tipe hook `useChartCanvas<TType>` cuma menerima satu ChartType — untuk
 * chart campuran, config diketik `ChartConfiguration<'bar' | 'line', ...>`
 * (union tipe, bukan `any`); tiap dataset menyatakan `type` sendiri.
 *
 * Gaya Lantai Bursa (Task 10): chrome kartu (panel/panel-h) dipegang parent
 * BrokerSummary.tsx, komponen ini cuma judul `.lbl` + chart + catatan kaki.
 */
export function Flow() {
  const { theme } = useTheme()

  const config = useMemo<ChartConfiguration<'bar' | 'line', number[], string>>(() => {
    const isDark = theme === 'dark'
    const textColor = isDark ? '#cfd8e3' : '#1a2733'
    const text2Color = isDark ? '#8494a8' : '#4b6070' // #77: dark 4.19→5.74:1
    const gridColor = 'rgba(128,128,128,.1)'

    const labels = BS_DATA.dates.map((d) => d.label)
    const buy = BS_DATA.dates.map((d) => BS_DATA.foreign[d.key]?.buy ?? 0)
    const sell = BS_DATA.dates.map((d) => BS_DATA.foreign[d.key]?.sell ?? 0)
    const net = BS_DATA.dates.map((d) => BS_DATA.foreign[d.key]?.net ?? 0)

    const datasets: ChartDataset<'bar' | 'line', number[]>[] = [
      { type: 'bar', label: 'Foreign Buy', data: buy, backgroundColor: 'rgba(34,197,94,.7)', order: 2 },
      { type: 'bar', label: 'Foreign Sell', data: sell, backgroundColor: 'rgba(239,68,68,.7)', order: 2 },
      { type: 'line', label: 'Net', data: net, borderColor: '#facc15', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 5, order: 1 },
    ]

    return {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: textColor, font: { size: 11 } } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtLot(ctx.parsed.y ?? 0)}` } },
        },
        scales: {
          x: { ticks: { color: text2Color }, grid: { color: gridColor } },
          y: { ticks: { color: text2Color, callback: (v) => fmtLot(Number(v)) }, grid: { color: gridColor } },
        },
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])

  const canvasRef = useChartCanvas(config)

  return (
    <>
      <div className="lbl" style={{ marginBottom: 8 }}><IkonMenu d={IKON_OMBAK} size={13} /> Foreign Flow Agregat — Buy / Sell / Net (lot, semua saham)</div>
      <div className="chart-wrap" style={{ height: 260 }}>
        <canvas ref={canvasRef} />
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>* Dihitung dari agregat Foreign Buy/Sell seluruh emiten IDX per tanggal</div>
    </>
  )
}
