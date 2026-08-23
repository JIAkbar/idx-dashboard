import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChartConfiguration, Plugin } from 'chart.js/auto'
import { useChartCanvas } from '../../../lib/dasbor/useChartJs'
import { useTheme } from '../../../context/ThemeContext'
import { TombolLayarPenuh } from '../../../components/dasbor/TombolLayarPenuh'
import { titikKuadran, type TitikKuadran } from '../../../lib/dasbor/brokerEmitenV2'
import { warnaBroker } from '../../../lib/dasbor/kelompokBroker'
import { fmtB } from '../../../lib/dasbor/brokerSummaryFormat'
import type { AgregatBroker } from '../../../lib/dasbor/brokerEmiten'

interface KuadranProps {
  agg: AgregatBroker[]
  vwap: number | null
}

interface Bubble extends TitikKuadran {
  x: number
  y: number
  r: number
}

/**
 * Tab "Kuadran" v2 — BEDA definisi dari /broker-summary lama (yang pakai
 * frekuensi×nilai): sumbu X = harga rata-rata broker vs VWAP periode
 * (persen), sumbu Y = net value, ukuran gelembung = nilai kotor dua sisi.
 * Broker di kiri-bawah = akumulasi di bawah VWAP (murah); kanan-atas =
 * mengejar di atas VWAP. Definisi kita sendiri, belum ada padanan Stockbit.
 */
export function Kuadran({ agg, vwap }: KuadranProps) {
  const { theme } = useTheme()

  const config = useMemo<ChartConfiguration<'bubble', Bubble[]> | null>(() => {
    const titik = titikKuadran(agg, vwap)
    if (titik.length === 0) return null
    const isDark = theme === 'dark'
    const textColor = isDark ? '#cfd8e3' : '#1a2733'
    const text2Color = isDark ? '#8494a8' : '#4b6070'
    const gridColor = 'rgba(128,128,128,.1)'
    const maxGross = titik.reduce((m, t) => Math.max(m, t.grossNilai), 1)

    const points: Bubble[] = titik.map((t) => ({
      ...t,
      x: t.deltaVwapPct,
      y: t.netNilai,
      r: Math.min(18, 4 + Math.sqrt(t.grossNilai / maxGross) * 14),
    }))
    const colors = points.map((p) => warnaBroker(p.broker))

    const plugin: Plugin<'bubble'> = {
      id: 'kuadranV2Overlay',
      afterDatasetsDraw(chart) {
        const { ctx, chartArea: a, scales } = chart
        const px = scales.x.getPixelForValue(0)
        const py = scales.y.getPixelForValue(0)
        ctx.save()
        ctx.strokeStyle = isDark ? 'rgba(148,163,184,.45)' : 'rgba(71,85,105,.4)'
        ctx.setLineDash([5, 5])
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom)
        ctx.moveTo(a.left, py); ctx.lineTo(a.right, py)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.font = 'bold 9px sans-serif'
        ctx.fillStyle = textColor
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        const meta = chart.getDatasetMeta(0)
        const urutBesar = [...points].sort((x, y) => y.grossNilai - x.grossNilai).slice(0, 12).map((p) => p.broker)
        points.forEach((p, i) => {
          if (!urutBesar.includes(p.broker)) return
          const el = meta.data[i]
          if (el) ctx.fillText(p.broker, el.x, el.y - p.r - 2)
        })
        ctx.restore()
      },
    }

    return {
      type: 'bubble',
      data: { datasets: [{ data: points, backgroundColor: colors.map((c) => c + 'BF'), borderColor: colors, borderWidth: 1 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const p = ctx.raw as Bubble
                return [
                  `${p.broker}`,
                  `vs VWAP: ${p.deltaVwapPct >= 0 ? '+' : ''}${p.deltaVwapPct.toFixed(2)}%`,
                  `Net value: Rp ${fmtB(p.netNilai)}`,
                  `Nilai kotor: Rp ${fmtB(p.grossNilai)}`,
                ]
              },
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'Harga rata-rata broker vs VWAP (%) →', color: text2Color, font: { size: 11 } },
            grid: { color: gridColor },
            ticks: { color: text2Color, callback: (v) => `${v}%` },
          },
          y: {
            title: { display: true, text: 'Net value (Rp) →', color: text2Color, font: { size: 11 } },
            grid: { color: gridColor },
            ticks: { color: text2Color, callback: (v) => fmtB(Number(v)) },
          },
        },
      },
      plugins: [plugin],
    }
  }, [agg, vwap, theme])

  const canvasRef = useChartCanvas(config)

  const wrapRef = useRef<HTMLDivElement>(null)
  const [fs, setFs] = useState(false)
  useEffect(() => {
    const onFsChange = () => setFs(document.fullscreenElement === wrapRef.current)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  if (!config) {
    return <p className="lbl" style={{ padding: '20px 0', textAlign: 'center' }}>Belum ada harga VWAP (OHLCV kosong) atau tak ada broker aktif dalam rentang ini.</p>
  }

  return (
    <div ref={wrapRef} className="quad-fs">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div className="lbl" style={{ flex: 1, minWidth: 0 }}>⊞ X: harga broker vs VWAP · Y: net value · ukuran: nilai kotor</div>
        {typeof document !== 'undefined' && document.fullscreenEnabled && (
          <TombolLayarPenuh target={wrapRef} aktif={fs} labelKeluar="Keluar" />
        )}
      </div>
      <div className="chart-wrap chart-tinggi">
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}
