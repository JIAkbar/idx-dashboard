import { TombolLayarPenuh } from '../../../components/dasbor/TombolLayarPenuh'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChartConfiguration, Plugin } from 'chart.js/auto'
import { useChartCanvas } from '../../../lib/dasbor/useChartJs'
import { useTheme } from '../../../context/ThemeContext'
import { fmtB } from '../../../lib/dasbor/brokerSummaryFormat'
import type { BrokerRow } from '../../../lib/dasbor/brokerSummaryData'

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
      // Label MENYEBUT YANG DIUKUR (revisi 27 Agu, pola sama #409 kategori
      // perilaku): versi lama 'Smart Accumulation'/'Distribusi Ritel' adalah
      // klaim niat & identitas dari data yang cuma tahu nilai+frekuensi, dan
      // ambang median menurut konstruksi meloloskan ~separuh populasi.
      const kategori =
        highNilai && !highFreq ? 'Nilai Besar · Frekuensi Rendah'
        : highNilai && highFreq ? 'Nilai Besar · Frekuensi Tinggi'
        : !highNilai && highFreq ? 'Nilai Kecil · Frekuensi Tinggi'
        : 'Nilai Kecil · Frekuensi Rendah'
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
      'Nilai Besar · Frekuensi Rendah': 'rgba(59,130,246,.75)',
      'Nilai Besar · Frekuensi Tinggi': 'rgba(34,197,94,.75)',
      'Nilai Kecil · Frekuensi Tinggi': 'rgba(239,68,68,.75)',
      'Nilai Kecil · Frekuensi Rendah': 'rgba(156,163,175,.5)',
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
        ctx.fillText('NILAI BESAR · FREK RENDAH', a.left + 6, a.top + 6)
        ctx.textAlign = 'right'
        ctx.fillText('NILAI BESAR · FREK TINGGI', a.right - 6, a.top + 6)
        ctx.textBaseline = 'bottom'
        ctx.fillText('NILAI KECIL · FREK TINGGI', a.right - 6, a.bottom - 6)
        ctx.textAlign = 'left'
        ctx.fillText('NILAI KECIL · FREK RENDAH', a.left + 6, a.bottom - 6)
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
        <div className="lbl" style={{ flex: 1, minWidth: 0 }}>Kuadran Broker — X: Frekuensi (log), Y: Nilai (log), Ukuran: Nilai · garis putus = median</div>
        {typeof document !== 'undefined' && document.fullscreenEnabled && (
          <TombolLayarPenuh target={wrapRef} aktif={fs} labelKeluar="Keluar" />
        )}
      </div>
      <div className="chart-wrap chart-tinggi">
        <canvas ref={canvasRef} />
      </div>
      {/* #77 kontras: warna domain cuma di titik ●, teks legenda ikut warna
          teks tema (hex mentah 2.3–3.8:1 di light, tak terbaca). */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, fontSize: 11, color: 'var(--text2)' }}>
        <span><span style={{ color: '#3b82f6' }}>●</span> Nilai Besar · Frekuensi Rendah (tiket per transaksi besar)</span>
        <span><span style={{ color: '#22c55e' }}>●</span> Nilai Besar · Frekuensi Tinggi</span>
        <span><span style={{ color: '#ef4444' }}>●</span> Nilai Kecil · Frekuensi Tinggi</span>
        <span><span style={{ color: '#9ca3af' }}>●</span> Nilai Kecil · Frekuensi Rendah</span>
      </div>
      <p className="muted" style={{ margin: '6px 0 0', fontSize: 11 }}>
        Pembagian kuadran = median nilai × median frekuensi hari itu — menurut konstruksi ±separuh broker
        selalu ada di tiap sisi, jadi ini deskripsi posisi relatif, bukan saringan dan bukan penggolongan
        resmi bursa. Data level pasar tidak menyebut identitas maupun niat broker.
      </p>
    </div>
  )
}
