import { useMemo } from 'react'
import type { ChartConfiguration } from 'chart.js/auto'
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
}

/**
 * Tab "Kuadran" — port bsRenderQuadrant() index_live.html baris 5952-5991.
 * Bubble chart: x=rank frekuensi, y=rank nilai, r~sqrt(nilai). Warna tick
 * dihitung dari theme (bukan string `var(--text2)` mentah) supaya chart
 * ikut redraw saat tema di-toggle — pola sama dengan SektorIndeks.tsx.
 *
 * Gaya Lantai Bursa (Task 10): chrome kartu (panel/panel-h) dipegang parent
 * BrokerSummary.tsx, komponen ini cuma judul `.lbl` + chart + legenda. Warna
 * legenda 4-kuadran (biru/hijau/merah/abu) domain-specific, TIDAK dipetakan
 * ke token up/dn/amber — beda makna dari semantik naik/turun harga.
 */
export function Quadrant({ brokers }: QuadrantProps) {
  const { theme } = useTheme()

  const config = useMemo<ChartConfiguration<'bubble', QuadPoint[]> | null>(() => {
    if (brokers.length === 0) return null
    const isDark = theme === 'dark'
    const text2Color = isDark ? '#8494a8' : '#4b6070' // #77: dark 4.19→5.74:1
    const gridColor = 'rgba(128,128,128,.1)'

    const n = brokers.length
    const medRank = n / 2
    const maxNilai = brokers.reduce((m, b) => Math.max(m, b.nilai), 1)
    const points: QuadPoint[] = brokers.map((b) => ({
      x: b.rf,
      y: b.rn,
      r: Math.max(4, Math.sqrt(b.nilai / maxNilai) * 28),
      label: b.kode,
      nilai: b.nilai,
    }))
    const colors = brokers.map((b) => {
      const isHighNilai = b.rn <= medRank
      const isHighFreq = b.rf <= medRank
      if (isHighNilai && !isHighFreq) return 'rgba(59,130,246,.75)' // Smart Accumulation
      if (isHighNilai && isHighFreq) return 'rgba(34,197,94,.75)' // Agresif Beli
      if (!isHighNilai && isHighFreq) return 'rgba(239,68,68,.75)' // Distribusi
      return 'rgba(156,163,175,.5)' // Pasif
    })

    return {
      type: 'bubble',
      data: {
        datasets: [{
          data: points,
          backgroundColor: colors,
          borderColor: colors.map((c) => c.replace('.75', '1').replace('.5', '1')),
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const p = ctx.raw as QuadPoint
                return [`${p.label}: Rp ${fmtB(p.nilai)}`, `Rank Nilai: ${p.y} | Rank Freq: ${p.x}`]
              },
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: '← Frekuensi Rank (kiri=aktif)', color: text2Color, font: { size: 11 } },
            grid: { color: gridColor },
            ticks: { color: text2Color, maxTicksLimit: 8 },
          },
          y: {
            title: { display: true, text: '← Nilai Rank (bawah=besar)', color: text2Color, font: { size: 11 } },
            grid: { color: gridColor },
            ticks: { color: text2Color, maxTicksLimit: 8 },
          },
        },
      },
    }
  }, [brokers, theme])

  const canvasRef = useChartCanvas(config)

  return (
    <>
      <div className="lbl" style={{ marginBottom: 8 }}>⊞ Kuadran Broker — X: Frekuensi, Y: Nilai, Ukuran: Nilai</div>
      <div className="chart-wrap" style={{ height: 420 }}>
        <canvas ref={canvasRef} />
      </div>
      {/* #77 kontras: warna domain cuma di titik ●, teks legenda ikut warna
          teks tema (hex mentah 2.3–3.8:1 di light, tak terbaca). */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, fontSize: 11, color: 'var(--text2)' }}>
        <span><span style={{ color: '#3b82f6' }}>●</span> Smart Accumulation (high nilai, low freq)</span>
        <span><span style={{ color: '#22c55e' }}>●</span> Agresif Beli (high nilai, high freq)</span>
        <span><span style={{ color: '#ef4444' }}>●</span> Distribusi (low nilai, high freq)</span>
        <span><span style={{ color: '#9ca3af' }}>●</span> Pasif</span>
      </div>
    </>
  )
}
