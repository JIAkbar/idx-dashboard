/**
 * Primitive W4 — profil harga (volume-at-price) Whales Papan
 * (`docs/spek-dev-papan/spek_whales_papan.md` §3 W4, mode Harian).
 *
 * Bar horizontal menempel tepi kanan plot, lebar ∝ lot pada pita harga itu.
 * Datanya hitungan `profilHarga()` di `whalesPapan.ts` (lot per level dari
 * broker harian) — kelas ini murni menggambar. Digambar di lapisan BAWAH
 * (`zOrder 'bottom'`) supaya candle tetap di depan.
 */
import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type {
  IPanePrimitive, IPanePrimitivePaneView, IPrimitivePaneRenderer,
  ISeriesApi, PaneAttachedParameter, SeriesType, Time,
} from 'lightweight-charts'

export interface PitaProfil {
  hargaBawah: number
  hargaAtas: number
  lot: number
}

/** Porsi lebar pane maksimum yang boleh dipakai bar terpanjang. */
const PORSI_MAKS = 0.16
const WARNA_BAR = 'rgba(148, 163, 184, 0.26)'

export class ProfilHargaChart implements IPanePrimitive<Time> {
  private ambilSeri: () => ISeriesApi<SeriesType> | null
  private data: PitaProfil[] = []
  private mintaGambar: (() => void) | null = null
  private views: IPanePrimitivePaneView[] = [{
    zOrder: () => 'bottom' as const,
    renderer: () => this.renderer(),
  }]

  constructor(ambilSeri: () => ISeriesApi<SeriesType> | null) {
    this.ambilSeri = ambilSeri
  }

  attached(p: PaneAttachedParameter<Time>): void {
    this.mintaGambar = p.requestUpdate
  }

  detached(): void {
    this.mintaGambar = null
  }

  setData(d: PitaProfil[]): void {
    this.data = d
    this.mintaGambar?.()
  }

  paneViews(): readonly IPanePrimitivePaneView[] {
    return this.views
  }

  private renderer(): IPrimitivePaneRenderer | null {
    const seri = this.ambilSeri()
    if (!seri || this.data.length === 0) return null
    const lotMaks = Math.max(1, ...this.data.map((p) => p.lot))
    const baris: Array<{ yA: number; yB: number; f: number }> = []
    for (const p of this.data) {
      const yA = seri.priceToCoordinate(p.hargaAtas)
      const yB = seri.priceToCoordinate(p.hargaBawah)
      if (yA === null || yB === null) continue
      baris.push({ yA: yA as number, yB: yB as number, f: p.lot / lotMaks })
    }
    if (baris.length === 0) return null
    return {
      draw: (target: CanvasRenderingTarget2D) => {
        target.useBitmapCoordinateSpace(({ context: ctx, bitmapSize, verticalPixelRatio: vp }) => {
          ctx.save()
          ctx.fillStyle = WARNA_BAR
          const lebarMaks = bitmapSize.width * PORSI_MAKS
          for (const b of baris) {
            const atas = Math.round(b.yA * vp)
            const bawah = Math.round(b.yB * vp)
            const w = Math.max(1, b.f * lebarMaks)
            const h = Math.max(1, bawah - atas - Math.round(vp))
            ctx.fillRect(bitmapSize.width - w, atas, w, h)
          }
          ctx.restore()
        })
      },
    }
  }
}
