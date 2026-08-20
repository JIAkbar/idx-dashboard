import { useEffect, useRef } from 'react'
import type { OhlcBar, Pivot } from '../lib/skor/types'

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
    // r=104 sebelumnya khusus ruang label pivot (R3/R1/P/R2/S1/S2/S3) — dibuang
    // #A8: 7 label berdesakan nempel tepi kanan, sulit dibaca, dan nilainya
    // sudah tercetak di .sr (Support/Resistance) di halaman yang sama. `pivot`
    // tetap dipakai di bawah untuk rentang sumbu-Y, hanya tak lagi digambar.
    const pad = { t: 14, r: 10, b: 14, l: 6 }
    const pvals = Object.values(pivot)
    const lo = Math.min(...bars.map((b) => b.l), ...pvals) * 0.99
    const hi = Math.max(...bars.map((b) => b.h), ...pvals) * 1.01
    const X = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (bars.length - 1)
    const Y = (v: number) => pad.t + ((hi - v) * (H - pad.t - pad.b)) / (hi - lo)

    x.clearRect(0, 0, W, H)

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
