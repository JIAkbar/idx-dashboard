import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChartConfiguration, Plugin } from 'chart.js/auto'
import { useChartCanvas } from '../../../lib/dasbor/useChartJs'
import { useTheme } from '../../../context/ThemeContext'
import { fmtB } from '../../../lib/dasbor/brokerSummaryFormat'
import type { BrokerRow } from '../../../lib/dasbor/brokerSummaryData'
import { IkonMenu, IKON_PERLUAS } from '../../../components/dasbor/IkonMenu'

interface QuadrantProps {
  brokers: BrokerRow[]
}

interface QuadPoint {
  x: number
  y: number
  r: number
  label: string
  nilai: number
  freq: number
  kategori: string
}

/** Median array angka TERURUT naik. */
function median(sorted: number[]): number {
  const n = sorted.length
  return n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
}

/** Jumlah bubble terbesar (by nilai) yang diberi label kode permanen. */
const N_LABEL = 12

/**
 * Tab "Kuadran" (#99 rombak): sumbu pakai NILAI & FREKUENSI NYATA skala log
 * (bukan rank 1..88 linear yang bikin semua bubble menggumpal di satu pojok —
 * nilai broker terbentang beberapa orde magnitudo, log menyebarkannya).
 * Garis median (putus-putus) membagi 4 kuadran + label kuadran di pojok area
 * chart; kode broker tampil permanen untuk N_LABEL terbesar, sisanya lewat
 * tooltip hover/tap (kode, nilai, frekuensi, kategori). Ukuran bubble sqrt
 * nilai di-cap (4..16px). Broker tanpa transaksi (nilai/frek 0) disaring —
 * log(0) tak terdefinisi dan mereka memang tidak bermakna di kuadran.
 * Animasi mati saat prefers-reduced-motion.
 */
export function Quadrant({ brokers }: QuadrantProps) {
  const { theme } = useTheme()

  const config = useMemo<ChartConfiguration<'bubble', QuadPoint[]> | null>(() => {
    const aktif = brokers.filter((b) => b.nilai > 0 && b.freq > 0)
    if (aktif.length === 0) return null
    const isDark = theme === 'dark'
    const textColor = isDark ? '#cfd8e3' : '#1a2733'
    const text2Color = isDark ? '#8494a8' : '#4b6070'
    const gridColor = 'rgba(128,128,128,.1)'

    const medNilai = median(aktif.map((b) => b.nilai).sort((a, b) => a - b))
    const medFreq = median(aktif.map((b) => b.freq).sort((a, b) => a - b))
    const maxNilai = aktif.reduce((m, b) => Math.max(m, b.nilai), 1)

    // aktif sudah terurut nilai turun (rankRows) → N_LABEL pertama = terbesar.
    const points: QuadPoint[] = aktif.map((b) => {
      const highNilai = b.nilai >= medNilai
      const highFreq = b.freq >= medFreq
      const kategori =
        highNilai && !highFreq ? 'Smart Accumulation'
        : highNilai && highFreq ? 'Agresif'
        : !highNilai && highFreq ? 'Distribusi Ritel'
        : 'Pasif'
      return {
        x: b.freq,
        y: b.nilai,
        r: Math.min(16, 4 + Math.sqrt(b.nilai / maxNilai) * 12),
        label: b.kode,
        nilai: b.nilai,
        freq: b.freq,
        kategori,
      }
    })
    const warnaKategori: Record<string, string> = {
      'Smart Accumulation': 'rgba(59,130,246,.75)',
      Agresif: 'rgba(34,197,94,.75)',
      'Distribusi Ritel': 'rgba(239,68,68,.75)',
      Pasif: 'rgba(156,163,175,.5)',
    }
    const colors = points.map((p) => warnaKategori[p.kategori])

    /** Garis median + label kuadran di pojok + kode broker N terbesar —
     * digambar langsung di canvas (Chart.js tak punya primitif ini). */
    const plugin: Plugin<'bubble'> = {
      id: 'kuadranOverlay',
      afterDatasetsDraw(chart) {
        const { ctx, chartArea: a, scales } = chart
        const px = scales.x.getPixelForValue(medFreq)
        const py = scales.y.getPixelForValue(medNilai)
        ctx.save()
        // garis median putus-putus
        ctx.strokeStyle = isDark ? 'rgba(148,163,184,.45)' : 'rgba(71,85,105,.4)'
        ctx.setLineDash([5, 5])
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(px, a.top)
        ctx.lineTo(px, a.bottom)
        ctx.moveTo(a.left, py)
        ctx.lineTo(a.right, py)
        ctx.stroke()
        ctx.setLineDash([])
        // label kuadran di 4 pojok area chart
        ctx.font = '10px sans-serif'
        ctx.fillStyle = text2Color
        ctx.textBaseline = 'top'
        ctx.textAlign = 'left'
        ctx.fillText('SMART ACCUMULATION', a.left + 6, a.top + 6)
        ctx.textAlign = 'right'
        ctx.fillText('AGRESIF', a.right - 6, a.top + 6)
        ctx.textBaseline = 'bottom'
        ctx.fillText('DISTRIBUSI RITEL', a.right - 6, a.bottom - 6)
        ctx.textAlign = 'left'
        ctx.fillText('PASIF', a.left + 6, a.bottom - 6)
        // kode broker untuk N bubble terbesar
        ctx.font = 'bold 9px sans-serif'
        ctx.fillStyle = textColor
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        const meta = chart.getDatasetMeta(0)
        for (let i = 0; i < Math.min(N_LABEL, points.length); i++) {
          const el = meta.data[i]
          if (el) ctx.fillText(points[i].label, el.x, el.y - points[i].r - 2)
        }
        ctx.restore()
      },
    }

    const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    return {
      type: 'bubble',
      data: {
        datasets: [{
          data: points,
          backgroundColor: colors,
          borderColor: colors.map((c) => c.replace('.75', '1').replace('.5', '1')),
          borderWidth: 1,
          hoverBorderWidth: 2,
          hoverBorderColor: textColor,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: reduceMotion ? false : undefined,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const p = ctx.raw as QuadPoint
                return [
                  `${p.label} — ${p.kategori}`,
                  `Nilai: Rp ${fmtB(p.nilai)}`,
                  `Frekuensi: ${p.freq.toLocaleString('id-ID')}x`,
                ]
              },
            },
          },
        },
        scales: {
          x: {
            type: 'logarithmic',
            title: { display: true, text: 'Frekuensi transaksi (log) →', color: text2Color, font: { size: 11 } },
            grid: { color: gridColor },
            ticks: { color: text2Color, maxTicksLimit: 6, callback: (v) => fmtB(Number(v)) },
          },
          y: {
            type: 'logarithmic',
            title: { display: true, text: 'Nilai transaksi (log) →', color: text2Color, font: { size: 11 } },
            grid: { color: gridColor },
            ticks: { color: text2Color, maxTicksLimit: 6, callback: (v) => fmtB(Number(v)) },
          },
        },
      },
      plugins: [plugin],
    }
  }, [brokers, theme])

  const canvasRef = useChartCanvas(config)

  // Layar penuh — pola Fullscreen API ChartIndeks (#51): peramban urus ESC,
  // tumpukan, dan ukuran; glue CSS di .lantai .quad-fs:fullscreen (lantai.css).
  const wrapRef = useRef<HTMLDivElement>(null)
  const [fs, setFs] = useState(false)
  useEffect(() => {
    const onFsChange = () => setFs(document.fullscreenElement === wrapRef.current)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  return (
    <div ref={wrapRef} className="quad-fs">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div className="lbl" style={{ flex: 1, minWidth: 0 }}>⊞ Kuadran Broker — X: Frekuensi (log), Y: Nilai (log), Ukuran: Nilai · garis putus = median</div>
        {typeof document !== 'undefined' && document.fullscreenEnabled && (
          <button
            className="bchip"
            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
            onClick={() => {
              if (fs) document.exitFullscreen?.().catch(() => {})
              else wrapRef.current?.requestFullscreen?.()?.catch(() => {})
            }}
            title={fs ? 'Keluar layar penuh' : 'Layar penuh'}
          >
            {fs ? <IkonMenu d="M6 6l12 12M18 6L6 18" size={12} /> : <IkonMenu d={IKON_PERLUAS} size={12} />} {fs ? 'Keluar' : 'Layar Penuh'}
          </button>
        )}
      </div>
      <div className="chart-wrap" style={{ height: 420 }}>
        <canvas ref={canvasRef} />
      </div>
      {/* #77 kontras: warna domain cuma di titik ●, teks legenda ikut warna
          teks tema (hex mentah 2.3–3.8:1 di light, tak terbaca). */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, fontSize: 11, color: 'var(--text2)' }}>
        <span><span style={{ color: '#3b82f6' }}>●</span> Smart Accumulation (nilai besar, frekuensi rendah)</span>
        <span><span style={{ color: '#22c55e' }}>●</span> Agresif (nilai besar, frekuensi tinggi)</span>
        <span><span style={{ color: '#ef4444' }}>●</span> Distribusi Ritel (nilai kecil, frekuensi tinggi)</span>
        <span><span style={{ color: '#9ca3af' }}>●</span> Pasif</span>
      </div>
    </div>
  )
}
