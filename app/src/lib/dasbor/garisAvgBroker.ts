/**
 * Primitive garis rata-rata beli broker — percontohan jalur HYBRID
 * (`docs/spek-dev-papan/spek_chart_hybrid.md` §2 P1).
 *
 * Digambar lewat Plugin API resmi lightweight-charts v5 (`attachPrimitive`),
 * BUKAN canvas terpisah bertumpuk: primitive ikut render-loop chart yang sama,
 * jadi zoom/pan/resize tak pernah menggeser overlay dari candle-nya. Seluruh
 * penggambaran di `useBitmapCoordinateSpace` supaya tajam di DPR berapa pun
 * tanpa mengurus devicePixelRatio sendiri.
 *
 * Kelas ini murni canvas — nol React, nol fetch. Pemanggil yang menghitung
 * garisnya (agregat `brokerEmiten.ts`) lalu menyetorkannya lewat `setGaris`.
 */
import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type {
  IPanePrimitive, IPanePrimitivePaneView, IPrimitivePaneRenderer,
  ISeriesApi, PaneAttachedParameter, PrimitiveHoveredItem, SeriesType, Time,
} from 'lightweight-charts'

export interface GarisBroker {
  broker: string
  /** Harga rata-rata beli tertimbang (rupiah per lembar). */
  harga: number
  /** Porsi nilai beli broker ini terhadap total beli rentang (0..1). */
  pct: number
  warna: string
}

const FONT_PX = 12
const PAD_X = 7
const PAD_Y = 3.5
const TEPI_KANAN = 8

/** Warna teks yang terbaca DI ATAS `warna` — Johan 28 Agu: "average ini gmn
 *  caranya terlihat yaaa, dan teksnya jelas". Sebelumnya teks selalu putih,
 *  jadi pill kuning/hijau-muda (warna identitas broker yang terang) menelan
 *  tulisannya. Ambang dari luminance relatif, bukan tebakan per warna. */
function teksKontras(warna: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(warna.trim())
    ?? /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(warna)
  let r = 0, g = 0, b = 0
  if (m && m[1] && m[1].length === 6) {
    const n = parseInt(m[1], 16)
    r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255
  } else if (m && m[3] != null) {
    r = +m[1]; g = +m[2]; b = +m[3]
  } else {
    return '#fff'
  }
  const lin = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return L > 0.42 ? '#0b1220' : '#fff'
}

export class GarisAvgBroker implements IPanePrimitive<Time> {
  /** Getter, bukan referensi langsung: seri harga dibuat ulang tiap ganti
   *  jenis chart (lilin ↔ garis), dan referensi beku akan menggambar pakai
   *  seri yang sudah dibongkar. */
  private ambilSeri: () => ISeriesApi<SeriesType> | null
  private garis: GarisBroker[] = []
  private mintaGambar: (() => void) | null = null
  /** Kotak pill terakhir yang digambar, RUANG MEDIA — bahan hitTest supaya
   *  pill bisa diklik (id `avg:<broker>` muncul di `hoveredObjectId` event
   *  chart; pemakai yang memutuskan mau diapakan). */
  private pillRect: Array<{ x0: number; y0: number; x1: number; y1: number; broker: string }> = []
  // Satu larik view yang stabil — lightweight-charts meng-cache berdasarkan
  // referensi larik, jadi larik baru tiap panggilan membatalkan cache-nya.
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

  setGaris(garis: GarisBroker[]): void {
    this.garis = garis
    this.mintaGambar?.()
  }

  paneViews(): readonly IPanePrimitivePaneView[] {
    return this.views
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    for (const r of this.pillRect) {
      if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) {
        return { externalId: `avg:${r.broker}`, zOrder: 'top', cursorStyle: 'pointer' }
      }
    }
    return null
  }

  private renderer(): IPrimitivePaneRenderer | null {
    const seri = this.ambilSeri()
    if (!seri || this.garis.length === 0) return null
    // Koordinat y dihitung SEKARANG (ruang media/CSS px) — priceToCoordinate
    // membaca skala harga saat frame ini, jadi garis ikut auto-scale.
    const baris: Array<GarisBroker & { y: number }> = []
    for (const g of this.garis) {
      const y = seri.priceToCoordinate(g.harga)
      if (y !== null) baris.push({ ...g, y: y as number })
    }
    if (baris.length === 0) return null
    return {
      draw: (target: CanvasRenderingTarget2D) => {
        target.useBitmapCoordinateSpace(({ context: ctx, bitmapSize, horizontalPixelRatio: hp, verticalPixelRatio: vp }) => {
          this.pillRect = []
          ctx.save()
          ctx.font = `600 ${Math.round(FONT_PX * vp)}px system-ui, sans-serif`
          ctx.textBaseline = 'middle'
          const tebal = Math.max(1, Math.round(vp))
          // Label didorong turun kalau bertindih dengan label sebelumnya —
          // dua broker berharga rata-rata mirip lazim, dan pill yang
          // bertumpuk tak terbaca sama sekali.
          const tinggiPill = Math.round(FONT_PX * vp) + PAD_Y * 2 * vp
          let batasBawahTerpakai = -Infinity
          for (const g of [...baris].sort((a, b) => a.y - b.y)) {
            const y = Math.round(g.y * vp)
            ctx.strokeStyle = g.warna
            ctx.lineWidth = tebal
            ctx.setLineDash([4 * hp, 4 * hp])
            ctx.beginPath()
            ctx.moveTo(0, y)
            ctx.lineTo(bitmapSize.width, y)
            ctx.stroke()
            ctx.setLineDash([])

            const teks = `${g.broker} AVG ${Math.round(g.harga).toLocaleString('id-ID')} (${Math.round(g.pct * 100)}%)`
            const lebarTeks = ctx.measureText(teks).width
            const lebarPill = lebarTeks + PAD_X * 2 * hp
            const x = bitmapSize.width - TEPI_KANAN * hp - lebarPill
            let yPill = y - tinggiPill / 2
            if (yPill < batasBawahTerpakai + 2 * vp) yPill = batasBawahTerpakai + 2 * vp
            batasBawahTerpakai = yPill + tinggiPill
            ctx.fillStyle = g.warna
            const r = tinggiPill / 2
            ctx.beginPath()
            ctx.roundRect(x, yPill, lebarPill, tinggiPill, r)
            ctx.fill()
            // Tepi gelap tipis: memisahkan pill dari lilin/heatmap di
            // belakangnya, terutama saat warnanya mirip latar.
            ctx.strokeStyle = 'rgba(0,0,0,.55)'
            ctx.lineWidth = Math.max(1, Math.round(vp))
            ctx.stroke()
            ctx.fillStyle = teksKontras(g.warna)
            ctx.fillText(teks, x + PAD_X * hp, yPill + tinggiPill / 2)
            this.pillRect.push({
              x0: x / hp, x1: (x + lebarPill) / hp,
              y0: yPill / vp, y1: (yPill + tinggiPill) / vp,
              broker: g.broker,
            })
          }
          ctx.restore()
        })
      },
    }
  }
}
