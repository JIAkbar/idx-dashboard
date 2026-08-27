import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChartConfiguration, Plugin } from 'chart.js/auto'
import { useChartCanvas } from '../../../lib/dasbor/useChartJs'
import { useTheme } from '../../../context/ThemeContext'
import { TombolLayarPenuh } from '../../../components/dasbor/TombolLayarPenuh'
import { fmtB, fmtLot } from '../../../lib/dasbor/brokerSummaryFormat'
import { titikKuadran, labelKuadran, type TitikKuadran, type LabelKuadran } from '../../../lib/dasbor/brokerEmitenV2'
import type { AgregatBroker } from '../../../lib/dasbor/brokerEmiten'
import { warnaBrokerCanvas, namaBroker } from '../../../lib/dasbor/kelompokBroker'
import { EmptyState } from './Overview'

interface QuadrantProps {
  agg: AgregatBroker[]
  /** VWAP rentang aktif (`vwapRentang`, OHLCV) — null kalau harga belum termuat. */
  vwap: number | null
  ukuran: 'nilai' | 'lot'
}

interface Titik {
  x: number
  y: number
  r: number
  broker: string
  netNilai: number
  netLot: number
  kuadran: LabelKuadran
}

const WARNA_KUADRAN: Record<LabelKuadran, string> = {
  'Akumulasi Cerdas': 'var(--green)',
  'Beli Agresif': 'var(--green)',
  'Jual Panik': 'var(--red)',
  Distribusi: 'var(--red)',
}

/**
 * Tab "Quadrant" (§B.1 spek C2) — X = harga rata-rata broker vs VWAP rentang
 * (persen), Y = net (nilai atau lot, ikut toggle Ukuran header), gelembung
 * = |net| ÷ maks, warna = kelompok identitas broker (bukan warna kuadran —
 * kuadrannya sendiri dibaca dari posisi, bukan dari warna titik). Beda dari
 * "Kuadran" v1 (`broker-summary/Quadrant.tsx`, sumbu frekuensi/nilai log
 * selalu positif): di sini X & Y bisa negatif (harga bisa di bawah VWAP, net
 * bisa jual), jadi skala LINEAR menyilang nol — bukan log.
 */
export function Quadrant({ agg, vwap, ukuran }: QuadrantProps) {
  const { theme } = useTheme()
  const titik = useMemo(() => titikKuadran(agg, vwap), [agg, vwap])

  const config = useMemo<ChartConfiguration<'bubble', Titik[]> | null>(() => {
    if (titik.length === 0) return null
    const isDark = theme === 'dark'
    const textColor = isDark ? '#cfd8e3' : '#1a2733'
    const text2Color = isDark ? '#8494a8' : '#4b6070'
    const gridColor = 'rgba(128,128,128,.1)'

    const nilaiY = (t: TitikKuadran) => (ukuran === 'nilai' ? t.netNilai : t.netLot)
    const maxAbsY = titik.reduce((m, t) => Math.max(m, Math.abs(nilaiY(t))), 1)
    const maxAbsX = titik.reduce((m, t) => Math.max(m, Math.abs(t.deltaVwapPct)), 1)

    const points: Titik[] = titik.map((t) => ({
      x: t.deltaVwapPct,
      y: nilaiY(t),
      r: Math.min(18, 4 + Math.sqrt(Math.abs(nilaiY(t)) / maxAbsY) * 14),
      broker: t.broker,
      netNilai: t.netNilai,
      netLot: t.netLot,
      kuadran: labelKuadran(t),
    }))
    const colors = points.map((p) => warnaBrokerCanvas(p.broker))

    /** Garis nol (bukan median — nol itu sendiri batas kuadran di sini) +
     *  label kuadran di 4 pojok + kode broker permanen. */
    const plugin: Plugin<'bubble'> = {
      id: 'kuadranOverlayV2',
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
        ctx.font = '10px sans-serif'
        ctx.fillStyle = text2Color
        ctx.textBaseline = 'top'
        ctx.textAlign = 'left'
        ctx.fillText('AKUMULASI CERDAS', a.left + 6, a.top + 6)
        ctx.textAlign = 'right'
        ctx.fillText('BELI AGRESIF', a.right - 6, a.top + 6)
        ctx.textBaseline = 'bottom'
        ctx.fillText('DISTRIBUSI', a.right - 6, a.bottom - 6)
        ctx.textAlign = 'left'
        ctx.fillText('JUAL PANIK', a.left + 6, a.bottom - 6)
        ctx.font = 'bold 9px sans-serif'
        ctx.fillStyle = textColor
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        const meta = chart.getDatasetMeta(0)
        for (let i = 0; i < points.length; i++) {
          const el = meta.data[i]
          if (el) ctx.fillText(points[i].broker, el.x, el.y - points[i].r - 2)
        }
        ctx.restore()
      },
    }

    const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    return {
      type: 'bubble',
      data: { datasets: [{ data: points, backgroundColor: colors, borderColor: colors, borderWidth: 1, hoverBorderWidth: 2, hoverBorderColor: textColor }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: reduceMotion ? false : undefined,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const p = ctx.raw as Titik
                return [
                  `${p.broker} — ${namaBroker(p.broker)}`,
                  `Kuadran: ${p.kuadran}`,
                  `Harga vs VWAP: ${p.x >= 0 ? '+' : ''}${p.x.toFixed(2)}%`,
                  `Net: ${ukuran === 'nilai' ? `Rp ${fmtB(p.netNilai)}` : fmtLot(p.netLot)}`,
                ]
              },
            },
          },
        },
        scales: {
          x: {
            min: -maxAbsX * 1.1, max: maxAbsX * 1.1,
            title: { display: true, text: 'Harga rata-rata broker vs VWAP (%) →', color: text2Color, font: { size: 11 } },
            grid: { color: gridColor },
            ticks: { color: text2Color, maxTicksLimit: 8, callback: (v) => `${v}%` },
          },
          y: {
            min: -maxAbsY * 1.1, max: maxAbsY * 1.1,
            title: { display: true, text: `Net ${ukuran === 'nilai' ? 'nilai (Rp)' : 'lot'} →`, color: text2Color, font: { size: 11 } },
            grid: { color: gridColor },
            ticks: { color: text2Color, maxTicksLimit: 8, callback: (v) => (ukuran === 'nilai' ? fmtB(Number(v)) : fmtLot(Number(v))) },
          },
        },
      },
      plugins: [plugin],
    }
  }, [titik, ukuran, theme])

  const canvasRef = useChartCanvas(config)

  const wrapRef = useRef<HTMLDivElement>(null)
  const [fs, setFs] = useState(false)
  useEffect(() => {
    const onFsChange = () => setFs(document.fullscreenElement === wrapRef.current)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  if (!config) {
    return <EmptyState>Tak ada broker aktif dalam rentang ini, atau harga (VWAP) belum termuat.</EmptyState>
  }

  return (
    <div ref={wrapRef} className="quad-fs">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div className="lbl" style={{ flex: 1, minWidth: 0 }}>
          X: harga rata-rata broker vs VWAP · Y: net {ukuran === 'nilai' ? 'nilai' : 'lot'} · ukuran gelembung: |net| · garis putus = nol
        </div>
        {typeof document !== 'undefined' && document.fullscreenEnabled && (
          <TombolLayarPenuh target={wrapRef} aktif={fs} labelKeluar="Keluar" />
        )}
      </div>
      <div className="chart-wrap chart-tinggi">
        <canvas ref={canvasRef} />
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, fontSize: 11, color: 'var(--text2)' }}>
        <span><span style={{ color: WARNA_KUADRAN['Akumulasi Cerdas'] }}>●</span> Akumulasi Cerdas (beli di bawah VWAP)</span>
        <span><span style={{ color: WARNA_KUADRAN['Beli Agresif'] }}>●</span> Beli Agresif (beli di atas VWAP)</span>
        <span><span style={{ color: WARNA_KUADRAN.Distribusi }}>●</span> Distribusi (jual di atas VWAP)</span>
        <span><span style={{ color: WARNA_KUADRAN['Jual Panik'] }}>●</span> Jual Panik (jual di bawah VWAP)</span>
      </div>
      <p className="lbl" style={{ marginTop: 8, textTransform: 'none', letterSpacing: 0 }}>
        Warna titik mengikuti kelompok identitas broker (legenda Overview), bukan warna kuadran — kuadrannya dibaca dari posisi (kiri/kanan garis nol = harga vs VWAP, atas/bawah = net beli/jual).
      </p>
    </div>
  )
}
