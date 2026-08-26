/**
 * Primitive W1 — kotak seleksi area untuk Whales Papan
 * (`docs/spek-dev-papan/spek_whales_papan.md` §3 W1).
 *
 * Kotak disimpan sebagai NILAI (tanggal × harga), bukan piksel — tiap frame
 * dipetakan ulang lewat `timeScale().timeToCoordinate()` dan
 * `series.priceToCoordinate()`, jadi setelah terkunci ia ikut bergeser saat
 * zoom/pan dan tetap menempel pada harga/tanggal yang sama. Kegagalan persis
 * di sinilah yang dulu terasa "tak interaktif" (uji terima utama spek §8.2).
 *
 * Kelas ini murni menggambar; interaksi pointer milik halaman (yang juga
 * memutuskan kapan seret dianggap klik).
 */
import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type {
  IChartApiBase, IPanePrimitive, IPanePrimitivePaneView, IPrimitivePaneRenderer,
  ISeriesApi, PaneAttachedParameter, SeriesType, Time,
} from 'lightweight-charts'

/** Kotak dalam NILAI. `t0 <= t1` dan `hargaMin <= hargaMax` tak diwajibkan —
 *  penggambar menormalkannya sendiri supaya seret ke segala arah sah. */
export interface KotakNilai {
  t0: string
  t1: string
  harga0: number
  harga1: number
}

export class SeleksiAreaChart implements IPanePrimitive<Time> {
  private ambilSeri: () => ISeriesApi<SeriesType> | null
  private ambilWarna: () => string
  private chart: IChartApiBase<Time> | null = null
  private kotak: KotakNilai | null = null
  private mintaGambar: (() => void) | null = null
  private views: IPanePrimitivePaneView[] = [{ renderer: () => this.renderer() }]

  constructor(ambilSeri: () => ISeriesApi<SeriesType> | null, ambilWarna: () => string) {
    this.ambilSeri = ambilSeri
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

  setKotak(k: KotakNilai | null): void {
    this.kotak = k
    this.mintaGambar?.()
  }

  paneViews(): readonly IPanePrimitivePaneView[] {
    return this.views
  }

  private renderer(): IPrimitivePaneRenderer | null {
    const seri = this.ambilSeri()
    const chart = this.chart
    const k = this.kotak
    if (!seri || !chart || !k) return null
    const skala = chart.timeScale()
    // Ujung yang keluar dari jendela pandang dipetakan null oleh chart —
    // dijatuhkan ke tepi pane sesuai sisinya supaya kotak tergambar terpotong,
    // bukan lenyap.
    const jangkau = skala.getVisibleRange()
    const keX = (t: string): number | null => {
      const x = skala.timeToCoordinate(t as Time)
      if (x !== null) return x as number
      if (!jangkau) return null
      if (t < (jangkau.from as string)) return 0
      if (t > (jangkau.to as string)) return Number.POSITIVE_INFINITY
      return null
    }
    const x0 = keX(k.t0 <= k.t1 ? k.t0 : k.t1)
    const x1 = keX(k.t0 <= k.t1 ? k.t1 : k.t0)
    const yA = seri.priceToCoordinate(Math.max(k.harga0, k.harga1))
    const yB = seri.priceToCoordinate(Math.min(k.harga0, k.harga1))
    if (x0 === null || x1 === null || yA === null || yB === null) return null
    const warna = this.ambilWarna()
    return {
      draw: (target: CanvasRenderingTarget2D) => {
        target.useBitmapCoordinateSpace(({ context: ctx, bitmapSize, horizontalPixelRatio: hp, verticalPixelRatio: vp }) => {
          const px0 = Math.max(0, Math.round((x0 as number) * hp))
          const px1 = Math.min(bitmapSize.width, Math.round(x1 === Number.POSITIVE_INFINITY ? bitmapSize.width : (x1 as number) * hp))
          const py0 = Math.round((yA as number) * vp)
          const py1 = Math.round((yB as number) * vp)
          const w = px1 - px0
          const h = py1 - py0
          if (w <= 0 || h <= 0) return
          ctx.save()
          ctx.fillStyle = warna
          ctx.globalAlpha = 0.14
          ctx.fillRect(px0, py0, w, h)
          ctx.globalAlpha = 1
          ctx.strokeStyle = warna
          ctx.lineWidth = Math.max(1, Math.round(1.5 * vp))
          ctx.setLineDash([5 * hp, 3 * hp])
          ctx.strokeRect(px0, py0, w, h)
          ctx.setLineDash([])
          ctx.restore()
        })
      },
    }
  }
}
