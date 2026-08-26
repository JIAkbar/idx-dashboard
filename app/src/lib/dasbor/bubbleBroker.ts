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

/** Bentuk hari yang dibutuhkan penghitung outlier — dipenuhi `HariBroker`
 *  milik `brokerEmiten.ts` maupun `whalesPapan.ts` (baris broker keduanya
 *  `[kode, beli_lot, beli_nilai, jual_lot, jual_nilai]`). */
export interface HariBrokerRingan {
  tanggal: string
  broker: ReadonlyArray<readonly [string, number, number, number, number]>
}

/**
 * Outlier HARIAN: per hari, |net nilai| tiap broker dibanding sebaran seluruh
 * broker hari itu — |z| ≥ `ambang` masuk, maksimal `maksPerHari` bubble per
 * hari (yang terbesar) supaya hari ramai tak jadi kabut lingkaran. Radius ∝
 * √|net| relatif ke outlier terbesar rentang, clamp `rMin`..`rMax` px media.
 * Harga bubble = rata-rata tertimbang sisi DOMINAN broker itu hari itu.
 *
 * SATU sumber untuk GrafikEmiten (P2) dan Whales Papan (W3) — ambangnya saja
 * yang beda (P2 tetap 2; W3 slider 1–4, bawaan 2,5 ala whales.id).
 */
export function bubbleOutlierHarian(
  hari: HariBrokerRingan[],
  ambang = 2,
  maksPerHari = 3,
  rMin = 3,
  rMax = 14,
): BubbleHari[] {
  const kandidat: BubbleHari[] = []
  for (const h of hari) {
    const net = h.broker.map((r) => r[2] - r[4])
    if (net.length < 5) continue
    const abs = net.map(Math.abs)
    const rata = abs.reduce((s, v) => s + v, 0) / abs.length
    const ragam = abs.reduce((s, v) => s + (v - rata) ** 2, 0) / abs.length
    const dev = Math.sqrt(ragam)
    if (!dev) continue
    const outlier = h.broker
      .map((r, i) => ({ r, net: net[i], z: (abs[i] - rata) / dev }))
      .filter((o) => o.z >= ambang)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, maksPerHari)
    for (const o of outlier) {
      const lot = o.net >= 0 ? o.r[1] : o.r[3]
      const nilai = o.net >= 0 ? o.r[2] : o.r[4]
      if (!lot) continue
      kandidat.push({ waktu: h.tanggal, harga: nilai / (lot * 100), broker: o.r[0], netNilai: o.net, radius: 0 })
    }
  }
  const maks = Math.max(1, ...kandidat.map((k) => Math.abs(k.netNilai)))
  for (const k of kandidat) {
    k.radius = Math.min(rMax, Math.max(rMin, rMax * Math.sqrt(Math.abs(k.netNilai) / maks)))
  }
  return kandidat
}

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
