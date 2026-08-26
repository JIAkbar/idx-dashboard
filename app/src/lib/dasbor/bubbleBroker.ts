/**
 * Primitive P2 — bubble broker outlier HARIAN
 * (`docs/spek-dev-papan/spek_chart_hybrid.md` §2 P2).
 *
 * Satu lingkaran = satu broker yang net-nya hari itu MENYIMPANG dari pasar
 * hari itu (z-score |net nilai| terhadap sebaran seluruh broker di hari yang
 * sama; ambang ditentukan pemanggil, bawaan 2). Lingkaran diletakkan di
 * (tanggal, harga rata-rata sisi dominan broker itu), radius ∝ √|net| —
 * akar supaya luasnya, bukan garis tengahnya, yang sebanding dengan uang.
 *
 * Kelas ini murni menggambar: pemanggil yang menghitung outlier dari arsip
 * broker (`brokerEmiten.ts`) dan menyetorkannya lewat `setData`.
 */
import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type {
  IChartApiBase, IPanePrimitive, IPanePrimitivePaneView, IPrimitivePaneRenderer,
  ISeriesApi, PaneAttachedParameter, SeriesType, Time,
} from 'lightweight-charts'

export interface BubbleHari {
  /** Tanggal bar harian 'yyyy-mm-dd' — dipetakan ke sumbu waktu chart. */
  waktu: string
  /** Harga rata-rata sisi dominan broker itu hari itu (rupiah/lembar). */
  harga: number
  broker: string
  /** Net nilai broker hari itu (rupiah); tanda menentukan warna beli/jual. */
  netNilai: number
  /** Radius media-px, sudah diskala pemanggil (clamp di sana). */
  radius: number
}

const WARNA_BELI = 'rgba(48, 164, 108, 0.72)'
const WARNA_JUAL = 'rgba(229, 72, 77, 0.72)'
const FONT_PX = 9

export class BubbleBroker implements IPanePrimitive<Time> {
  private ambilSeri: () => ISeriesApi<SeriesType> | null
  private chart: IChartApiBase<Time> | null = null
  private data: BubbleHari[] = []
  private mintaGambar: (() => void) | null = null
  private views: IPanePrimitivePaneView[] = [{ renderer: () => this.renderer() }]

  constructor(ambilSeri: () => ISeriesApi<SeriesType> | null) {
    this.ambilSeri = ambilSeri
  }

  attached(p: PaneAttachedParameter<Time>): void {
    this.chart = p.chart
    this.mintaGambar = p.requestUpdate
  }

  detached(): void {
    this.chart = null
    this.mintaGambar = null
  }

  setData(d: BubbleHari[]): void {
    this.data = d
    this.mintaGambar?.()
  }

  paneViews(): readonly IPanePrimitivePaneView[] {
    return this.views
  }

  private renderer(): IPrimitivePaneRenderer | null {
    const seri = this.ambilSeri()
    const chart = this.chart
    if (!seri || !chart || this.data.length === 0) return null
    const skalaWaktu = chart.timeScale()
    // Koordinat dihitung per frame (ruang media) — ikut zoom/pan/auto-scale.
    const titik: Array<{ x: number; y: number; r: number; beli: boolean; broker: string }> = []
    for (const b of this.data) {
      const x = skalaWaktu.timeToCoordinate(b.waktu as Time)
      const y = seri.priceToCoordinate(b.harga)
      if (x === null || y === null) continue
      titik.push({ x: x as number, y: y as number, r: b.radius, beli: b.netNilai >= 0, broker: b.broker })
    }
    if (titik.length === 0) return null
    return {
      draw: (target: CanvasRenderingTarget2D) => {
        target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio: hp, verticalPixelRatio: vp }) => {
          ctx.save()
          ctx.font = `${Math.round(FONT_PX * vp)}px system-ui, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          for (const t of titik) {
            const x = t.x * hp
            const y = t.y * vp
            const r = t.r * vp
            ctx.fillStyle = t.beli ? WARNA_BELI : WARNA_JUAL
            ctx.beginPath()
            ctx.arc(x, y, r, 0, Math.PI * 2)
            ctx.fill()
            // Kode broker hanya kalau lingkarannya cukup besar untuk memuatnya
            // — teks di bubble 4 px cuma jadi noda.
            if (t.r >= 7) {
              ctx.fillStyle = '#fff'
              ctx.fillText(t.broker, x, y)
            }
          }
          ctx.restore()
        })
      },
    }
  }
}
