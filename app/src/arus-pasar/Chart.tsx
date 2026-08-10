import { useEffect, useRef } from 'react'
import type { OhlcBar, Pivot } from '../lib/skor/types'
import { fmt } from './format'

interface ChartProps {
  bars: OhlcBar[]
  pivot: Pivot
}

/** Port 1:1 dari fungsi gambarChart() di arus-pasar/template.html. */
export function Chart({ bars: allBars, pivot }: ChartProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const x = cv.getContext('2d')
    if (!x) return

    const bars = allBars.slice(-65)
    const W = cv.width
    const H = cv.height
    const pad = { t: 14, r: 104, b: 14, l: 6 }
    const pvals = Object.values(pivot)
    const lo = Math.min(...bars.map((b) => b.l), ...pvals) * 0.99
    const hi = Math.max(...bars.map((b) => b.h), ...pvals) * 1.01
    const X = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (bars.length - 1)
    const Y = (v: number) => pad.t + ((hi - v) * (H - pad.t - pad.b)) / (hi - lo)

    x.clearRect(0, 0, W, H)
    x.font = '15px Segoe UI'
    const yT: number[] = []
    for (const [n, v] of Object.entries(pivot)) {
      x.strokeStyle = '#B9C1C9'
      x.setLineDash([3, 4])
      x.beginPath()
      x.moveTo(pad.l, Y(v))
      x.lineTo(W - pad.r, Y(v))
      x.stroke()
      x.setLineDash([])
      let yl = Y(v) + 5
      while (yT.some((u) => Math.abs(u - yl) < 17)) yl += 17
      yT.push(yl)
      x.fillStyle = n[0] === 'R' ? '#B93A2B' : n === 'P' ? '#6B7683' : '#0A7D4F'
      x.fillText(`${n} ${fmt(v)}`, W - pad.r + 6, yl)
    }

    const bw = Math.max(3, ((W - pad.l - pad.r) / bars.length) * 0.62)
    bars.forEach((b, i) => {
      const up = b.c >= b.o
      x.strokeStyle = x.fillStyle = up ? '#0A7D4F' : '#B93A2B'
      x.beginPath()
      x.moveTo(X(i), Y(b.h))
      x.lineTo(X(i), Y(b.l))
      x.stroke()
      x.fillRect(
        X(i) - bw / 2,
        Y(Math.max(b.o, b.c)),
        bw,
        Math.max(1.5, Y(Math.min(b.o, b.c)) - Y(Math.max(b.o, b.c)))
      )
    })

    const k = 2 / 51
    let e = allBars[0].c
    const seri = allBars.map((b) => (e = e + (b.c - e) * k)).slice(-bars.length)
    x.strokeStyle = '#0B4F4A'
    x.lineWidth = 2
    x.beginPath()
    seri.forEach((v, i) => (i ? x.lineTo(X(i), Y(v)) : x.moveTo(X(0), Y(v))))
    x.stroke()
  }, [allBars, pivot])

  return <canvas ref={ref} width={1360} height={300} />
}
