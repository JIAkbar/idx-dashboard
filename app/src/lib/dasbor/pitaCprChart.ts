/**
 * Primitive P3 — pita CPR (TC/P/BC) + level Pivot R1–R3/S1–S3 di chart
 * (`docs/spek-dev-papan/spek_chart_hybrid.md` §2 P3).
 *
 * Rumusnya TIDAK dihitung di sini — pemanggil memakai `hitungPivot` dan
 * `hitungCpr` dari `chartAnalitik.ts` (sumber tunggal rumus §4.1–4.2) lalu
 * menyetor hasilnya lewat `setData`. Kelas ini murni menggambar.
 *
 * Konvensi bar acuan ikut chartAnalitik: dihitung dari bar `t` = sesi
 * terakhir TUTUP, jadi level yang tampak adalah level untuk sesi BERIKUTNYA.
 */
import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type {
  IPanePrimitive, IPanePrimitivePaneView, IPrimitivePaneRenderer,
  ISeriesApi, PaneAttachedParameter, SeriesType, Time,
} from 'lightweight-charts'
import type { Pivot } from '../skor/types'
import type { HasilCpr } from './chartAnalitik'

export interface DataCpr {
  pivot: Pivot
  cpr: HasilCpr
}

const FONT_PX = 10
const TEPI_KANAN = 4

const WARNA_R = '#e5484d'
const WARNA_S = '#30a46c'
const WARNA_P = '#8e8ea0'
const ISI_PITA = 'rgba(148, 116, 246, 0.16)'
const GARIS_PITA = 'rgba(148, 116, 246, 0.55)'

export class PitaCpr implements IPanePrimitive<Time> {
  private ambilSeri: () => ISeriesApi<SeriesType> | null
  private data: DataCpr | null = null
  private mintaGambar: (() => void) | null = null
  private views: IPanePrimitivePaneView[] = [{ renderer: () => this.renderer() }]

  constructor(ambilSeri: () => ISeriesApi<SeriesType> | null) {
    this.ambilSeri = ambilSeri
  }

  attached(p: PaneAttachedParameter<Time>): void {
    this.mintaGambar = p.requestUpdate
  }

  detached(): void {
    this.mintaGambar = null
  }

  setData(d: DataCpr | null): void {
    this.data = d
    this.mintaGambar?.()
  }

  paneViews(): readonly IPanePrimitivePaneView[] {
    return this.views
  }

  private renderer(): IPrimitivePaneRenderer | null {
    const seri = this.ambilSeri()
    const d = this.data
    if (!seri || !d) return null
    const ke = (harga: number): number | null => {
      const y = seri.priceToCoordinate(harga)
      return y === null ? null : (y as number)
    }
    const yTc = ke(d.cpr.tc)
    const yBc = ke(d.cpr.bc)
    const level: Array<{ y: number | null; label: string; warna: string }> = [
      { y: ke(d.pivot.R3), label: `R3 ${Math.round(d.pivot.R3).toLocaleString('id-ID')}`, warna: WARNA_R },
      { y: ke(d.pivot.R2), label: `R2 ${Math.round(d.pivot.R2).toLocaleString('id-ID')}`, warna: WARNA_R },
      { y: ke(d.pivot.R1), label: `R1 ${Math.round(d.pivot.R1).toLocaleString('id-ID')}`, warna: WARNA_R },
      { y: ke(d.pivot.P), label: `P ${Math.round(d.pivot.P).toLocaleString('id-ID')}`, warna: WARNA_P },
      { y: ke(d.pivot.S1), label: `S1 ${Math.round(d.pivot.S1).toLocaleString('id-ID')}`, warna: WARNA_S },
      { y: ke(d.pivot.S2), label: `S2 ${Math.round(d.pivot.S2).toLocaleString('id-ID')}`, warna: WARNA_S },
      { y: ke(d.pivot.S3), label: `S3 ${Math.round(d.pivot.S3).toLocaleString('id-ID')}`, warna: WARNA_S },
    ]
    if (yTc === null && yBc === null && level.every((l) => l.y === null)) return null
    return {
      draw: (target: CanvasRenderingTarget2D) => {
        target.useBitmapCoordinateSpace(({ context: ctx, bitmapSize, horizontalPixelRatio: hp, verticalPixelRatio: vp }) => {
          ctx.save()
          ctx.font = `${Math.round(FONT_PX * vp)}px system-ui, sans-serif`
          ctx.textBaseline = 'bottom'
          ctx.textAlign = 'right'
          const tebal = Math.max(1, Math.round(vp))
          // Pita TC..BC — isi tipis + garis batas, supaya candle di dalamnya
          // tetap terbaca.
          if (yTc !== null && yBc !== null) {
            const atas = Math.round(Math.min(yTc, yBc) * vp)
            const bawah = Math.round(Math.max(yTc, yBc) * vp)
            ctx.fillStyle = ISI_PITA
            ctx.fillRect(0, atas, bitmapSize.width, Math.max(1, bawah - atas))
            ctx.strokeStyle = GARIS_PITA
            ctx.lineWidth = tebal
            for (const y of [atas, bawah]) {
              ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(bitmapSize.width, y); ctx.stroke()
            }
            ctx.fillStyle = GARIS_PITA
            ctx.fillText(`TC ${Math.round(d.cpr.tc).toLocaleString('id-ID')}`, bitmapSize.width - TEPI_KANAN * hp, atas - 2 * vp)
            ctx.textBaseline = 'top'
            ctx.fillText(`BC ${Math.round(d.cpr.bc).toLocaleString('id-ID')}`, bitmapSize.width - TEPI_KANAN * hp, bawah + 2 * vp)
            ctx.textBaseline = 'bottom'
          }
          ctx.setLineDash([6 * hp, 4 * hp])
          for (const l of level) {
            if (l.y === null) continue
            const y = Math.round(l.y * vp)
            ctx.strokeStyle = l.warna
            ctx.lineWidth = tebal
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(bitmapSize.width, y); ctx.stroke()
            ctx.fillStyle = l.warna
            ctx.fillText(l.label, bitmapSize.width - TEPI_KANAN * hp, y - 2 * vp)
          }
          ctx.setLineDash([])
          ctx.restore()
        })
      },
    }
  }
}
