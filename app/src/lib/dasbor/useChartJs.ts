import { useEffect, useRef } from 'react'
import { Chart, type ChartConfiguration, type ChartType } from 'chart.js/auto'

/**
 * Bikin instance Chart.js di elemen <canvas>, destroy on cleanup/re-render.
 * Port pola destroyCharts()/buildCharts() index_live.html baris 3026-3096 —
 * versi React idiomatic per-komponen (bukan registry global `charts{}`).
 * `chart.js/auto` dipakai supaya semua controller/element ter-register
 * otomatis (tidak perlu Chart.register manual per tipe chart).
 *
 * Caller wajib meng-useMemo `config` (mis. berdasar data hari aktif) — kalau
 * config dibuat ulang tiap render, chart akan destroy+rebuild tiap render.
 */
export function useChartCanvas<TType extends ChartType = ChartType>(
  config: ChartConfiguration<TType> | null,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart<TType> | null>(null)

  useEffect(() => {
    if (!canvasRef.current || !config) return
    chartRef.current = new Chart(canvasRef.current, config)
    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [config])

  return canvasRef
}
