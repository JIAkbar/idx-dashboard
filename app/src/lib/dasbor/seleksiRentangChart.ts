/**
 * Primitive brush RENTANG WAKTU — pita vertikal setinggi pane
 * (spek_neo_papan_revisi.md §4.1, Compare Inventory).
 *
 * Sengaja LEBIH SEDERHANA dari `seleksiAreaChart.ts`: hanya sumbu waktu,
 * tanpa harga. Nilainya disimpan sebagai tanggal — dipetakan ulang tiap frame
 * lewat `timeToCoordinate`, jadi pita ikut zoom/pan (pola yang sudah terbukti
 * di Whales Papan).
 */
import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type {
  IChartApiBase, IPanePrimitive, IPanePrimitivePaneView, IPrimitivePaneRenderer,
  PaneAttachedParameter, Time,
} from 'lightweight-charts'

export interface RentangWaktu {
  t0: string
  t1: string
}

export class SeleksiRentangChart implements IPanePrimitive<Time> {
  private ambilWarna: () => string
  private chart: IChartApiBase<Time> | null = null
  private rentang: RentangWaktu | null = null
  private mintaGambar: (() => void) | null = null
  private views: IPanePrimitivePaneView[] = [{ renderer: () => this.renderer() }]

  constructor(ambilWarna: () => string) {
    this.ambilWarna = ambilWarna
  }

  attached(p: PaneAttachedParameter<Time>): void {
    this.chart = p.chart
    this.mintaGambar = p.requestUpdate
  }

  detached(): void {
    this.chart = null
    this.mintaGambar = null
  }

  setRentang(r: RentangWaktu | null): void {
    this.rentang = r
    this.mintaGambar?.()
  }

  paneViews(): readonly IPanePrimitivePaneView[] {
    return this.views
  }

  private renderer(): IPrimitivePaneRenderer | null {
    const chart = this.chart
    const r = this.rentang
    if (!chart || !r) return null
    const skala = chart.timeScale()
    const jangkau = skala.getVisibleRange()
    const keX = (t: string): number | null => {
      const x = skala.timeToCoordinate(t as Time)
      if (x !== null) return x as number
      if (!jangkau) return null
      if (t < (jangkau.from as string)) return 0
      if (t > (jangkau.to as string)) return Number.POSITIVE_INFINITY
      return null
    }
    const a = keX(r.t0 <= r.t1 ? r.t0 : r.t1)
    const b = keX(r.t0 <= r.t1 ? r.t1 : r.t0)
    if (a === null || b === null) return null
    const warna = this.ambilWarna()
    return {
      draw: (target: CanvasRenderingTarget2D) => {
        target.useBitmapCoordinateSpace(({ context: ctx, bitmapSize, horizontalPixelRatio: hp, verticalPixelRatio: vp }) => {
          const x0 = Math.max(0, Math.round((a as number) * hp))
          const x1 = Math.min(bitmapSize.width, Math.round(b === Number.POSITIVE_INFINITY ? bitmapSize.width : (b as number) * hp))
          if (x1 <= x0) return
          ctx.save()
          ctx.fillStyle = warna
          ctx.globalAlpha = 0.14
          ctx.fillRect(x0, 0, x1 - x0, bitmapSize.height)
          ctx.globalAlpha = 1
          ctx.strokeStyle = warna
          ctx.lineWidth = Math.max(1, Math.round(1.5 * vp))
          ctx.setLineDash([5 * hp, 3 * hp])
          ctx.beginPath()
          ctx.moveTo(x0, 0); ctx.lineTo(x0, bitmapSize.height)
          ctx.moveTo(x1, 0); ctx.lineTo(x1, bitmapSize.height)
          ctx.stroke()
          ctx.setLineDash([])
          ctx.restore()
        })
      },
    }
  }
}
