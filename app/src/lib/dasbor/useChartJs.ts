import { useEffect, useRef } from 'react'
import { Chart, type ChartConfiguration, type ChartType } from 'chart.js/auto'

/**
 * Baca nilai NYATA (hex/rgb) sebuah token tema `--xxx` dari DOM. Chart.js
 * menggambar ke `<canvas>` dan strokeStyle/fillStyle TIDAK bisa mengurai
 * `var(...)` sama sekali — string yang tak dikenal diam-diam diabaikan
 * (dipertahankan warna bawaan hitam), bukan dilempar galat. Token `--k-*`/
 * `--blue`/dst. didefinisikan di `.lantai` (lantai.css, beda nilai per tema),
 * BUKAN di `:root` — jadi dibaca dari elemen `.lantai` (bukan
 * `document.documentElement`) supaya ikut tema gelap/terang aktif.
 */
export function bacaTokenTema(nama: string, fallback = '#8F98A6'): string {
  if (typeof document === 'undefined') return fallback
  const host = document.querySelector('.lantai') ?? document.documentElement
  return getComputedStyle(host).getPropertyValue(nama).trim() || fallback
}

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
