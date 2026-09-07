/**
 * Primitive — Pola Gap di Grafik Emiten (`docs/spek-dev-papan/spek_rbs_gap_intraday.md` §2).
 *
 * Gap-nya TIDAK dihitung di sini — pemanggil memakai `cariGap()` dari
 * `polaGap.ts` (mesin murni, teruji sendiri) lalu menyetor hasilnya lewat
 * `setData`. Kelas ini murni menggambar, mengikuti pola yang sama dengan
 * `polaRbsChart.ts`: badge pill + dodge dari `garisAvgBroker.ts`, culling
 * manual `timeToCoordinate` dari `footprintHarian.ts` (di luar jendela
 * pandang ia TETAP memberi koordinat, bukan null).
 *
 * Kotak zona = ruang harga antara `hargaAcuan` (high/low hari sebelum gap)
 * dan `open` (hari gap) — persis "celah" yang tercipta. Sisi kanan kotak
 * MEMANJANG ke `waktuTerakhir` (bar terakhir yang tergambar, bukan tepi
 * kanvas literal — supaya kalau pembaca zoom ke masa depan kosong, kotaknya
 * tak ikut membentang ke ruang yang tak ada datanya) selama gap BELUM
 * terisi; begitu terisi, sisi kanan berhenti di tanggal terisinya dan
 * warnanya meredup abu (spek §2: "kuning selama terbuka ... abu redup saat
 * terisi").
 *
 * ponytail: badge di-dodge vertikal HANYA di antara label yang berbagi sisi
 * kanan (x1) yang (hampir) sama — kasus yang benar-benar terjadi adalah
 * banyak gap BELUM TERISI menumpuk di `waktuTerakhir` yang sama. Dodge
 * global (abaikan x, seperti RBS) akan menggeser badge yang letak kotaknya
 * jauh berjauhan di sumbu waktu, dan itu salah secara visual. Naikkan ke
 * dodge 2D penuh kalau kelak ditemukan tumpang tindih di luar kasus itu.
 */
import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type {
  IChartApiBase, IPanePrimitive, IPanePrimitivePaneView, IPrimitivePaneRenderer,
  ISeriesApi, PaneAttachedParameter, PrimitiveHoveredItem, SeriesType, Time,
} from 'lightweight-charts'
import type { GapEvent } from './polaGap'

const FONT_PX = 10
const PAD_X = 6
const PAD_Y = 3

const ISI_TERBUKA = 'rgba(234, 179, 8, 0.16)'
const GARIS_TERBUKA = 'rgba(234, 179, 8, 0.6)'
const ISI_TERISI = 'rgba(142, 142, 160, 0.10)'
const GARIS_TERISI = 'rgba(142, 142, 160, 0.35)'
const WARNA_PILL_TERBUKA = '#eab308'
const WARNA_PILL_TERISI = 'rgba(142, 142, 160, 0.85)'

export interface DataGapChart {
  gap: GapEvent[]
  /** Waktu bar terakhir yang tergambar — sisi kanan kotak gap yang BELUM
   *  terisi memanjang sampai sini, bukan sampai tepi kanvas literal. */
  waktuTerakhir: string | null
}

export class PolaGapChart implements IPanePrimitive<Time> {
  private ambilSeri: () => ISeriesApi<SeriesType> | null
  private chart: IChartApiBase<Time> | null = null
  private data: DataGapChart = { gap: [], waktuTerakhir: null }
  private mintaGambar: (() => void) | null = null
  private views: IPanePrimitivePaneView[] = [{ renderer: () => this.renderer() }]
  /** Pill badge terakhir digambar — bahan hitTest untuk hover. */
  private pillRect: Array<{ x0: number; y0: number; x1: number; y1: number; id: string }> = []
  private byId = new Map<string, GapEvent>()

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

  setData(d: DataGapChart): void {
    this.data = d
    this.mintaGambar?.()
  }

  paneViews(): readonly IPanePrimitivePaneView[] {
    return this.views
  }

  getGap(id: string): GapEvent | null {
    return this.byId.get(id) ?? null
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    for (const r of this.pillRect) {
      if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) {
        return { externalId: r.id, zOrder: 'top', cursorStyle: 'pointer' }
      }
    }
    return null
  }

  private renderer(): IPrimitivePaneRenderer | null {
    const seri = this.ambilSeri()
    const chart = this.chart
    if (!seri || !chart || this.data.gap.length === 0) { this.pillRect = []; this.byId = new Map(); return null }
    const skalaWaktu = chart.timeScale()
    const lebarPane = skalaWaktu.width()
    const { waktuTerakhir, gap } = this.data

    const byIdBaru = new Map<string, GapEvent>()
    gap.forEach((g, i) => byIdBaru.set(`gap:${i}`, g))
    this.byId = byIdBaru

    return {
      draw: (target: CanvasRenderingTarget2D) => {
        target.useBitmapCoordinateSpace(({ context: ctx, bitmapSize, horizontalPixelRatio: hp, verticalPixelRatio: vp }) => {
          ctx.save()
          ctx.font = `${Math.round(FONT_PX * vp)}px system-ui, sans-serif`
          ctx.textBaseline = 'middle'
          const tebal = Math.max(1, Math.round(vp))
          const pillRectBaru: Array<{ x0: number; y0: number; x1: number; y1: number; id: string }> = []
          const labelAntri: Array<{ y: number; x1: number; teks: string; warna: string; id: string }> = []

          // Ambang keterbacaan (review visual 27 Agu: rentang "Semua" BBCA =
          // ratusan gap 22 tahun, badge membanjiri & menutup candle). Gap
          // TERISI hanya digambar saat zoom cukup dekat; gap BELUM terisi
          // selalu tampil (itu levelnya yang masih hidup). Pola sama dengan
          // ambang footprint (BAR_SPACING_MIN).
          const barSpacing = skalaWaktu.options().barSpacing
          const gambarTerisi = barSpacing >= 5
          const gambarBadgeTerisi = barSpacing >= 9

          gap.forEach((g, i) => {
            const habis = g.status === 'terisi'
            if (habis && !gambarTerisi) return
            const xMulaiM = skalaWaktu.timeToCoordinate(g.waktuGap as Time)
            if (xMulaiM === null) return
            const waktuAkhir = habis ? g.waktuTerisi! : (waktuTerakhir ?? g.waktuGap)
            const xAkhirM = skalaWaktu.timeToCoordinate(waktuAkhir as Time)
            if (xAkhirM === null) return
            const x0raw = xMulaiM as number
            const x1raw = xAkhirM as number
            // Culling: kotak yang seluruhnya di luar jendela pandang tak digambar.
            if (x1raw < 0 || x0raw > lebarPane) return
            const x0 = Math.max(0, Math.round(x0raw * hp))
            const x1 = Math.min(bitmapSize.width, Math.round(x1raw * hp))
            if (x1 <= x0) return

            // Yang digambar SISANYA, bukan zona awal — inti #50. Sisa bisa
            // lebih dari satu potongan (zona terbelah oleh bar yang jatuh di
            // tengahnya), jadi ini perulangan, bukan satu kotak.
            const petak = habis ? [[g.bawah, g.atas] as const] : g.sisa
            let yTengah: number | null = null
            for (const [pBawah, pAtas] of petak) {
              const yAtasM = seri.priceToCoordinate(pAtas)
              const yBawahM = seri.priceToCoordinate(pBawah)
              if (yAtasM === null || yBawahM === null) continue
              const yA = Math.round((yAtasM as number) * vp)
              const yB = Math.round((yBawahM as number) * vp)
              ctx.fillStyle = habis ? ISI_TERISI : ISI_TERBUKA
              ctx.fillRect(x0, yA, x1 - x0, Math.max(1, yB - yA))
              ctx.strokeStyle = habis ? GARIS_TERISI : GARIS_TERBUKA
              ctx.lineWidth = tebal
              ctx.setLineDash(habis ? [4 * hp, 3 * hp] : [])
              ctx.strokeRect(x0, yA, x1 - x0, Math.max(1, yB - yA))
              ctx.setLineDash([])
              if (yTengah === null) yTengah = Math.round((yA + yB) / 2)
            }
            if (yTengah === null) return

            if (habis && !gambarBadgeTerisi) return // kotak saja, tanpa badge
            const tanda = g.gapPct >= 0 ? '+' : ''
            // Label menyebut SISA, bukan cuma terisi/belum: zona yang sudah
            // dimakan 90% tapi masih hidup adalah keadaan yang berbeda dari
            // zona yang belum tersentuh, dan dulu keduanya terbaca sama.
            const keadaan = habis
              ? `terisi ${g.barTerisi}b`
              : g.status === 'sebagian'
                ? `sisa ${Math.round(g.sisaPct)}%`
                : g.dataHabis ? `bertahan ${g.bertahanBar}b · data habis` : `bertahan ${g.bertahanBar}b`
            const teks = `GAP ${tanda}${g.gapPct.toFixed(1)}% · ${keadaan}`
            labelAntri.push({
              y: yTengah, x1,
              teks, warna: habis ? WARNA_PILL_TERISI : WARNA_PILL_TERBUKA, id: `gap:${i}`,
            })
          })
          // Dodge vertikal per KELOMPOK sisi kanan (lihat catatan ponytail di
          // kepala berkas) — bucket kasar 8px cukup buat mengumpulkan badge
          // yang sisi kanannya sama-sama `waktuTerakhir`.
          const kelompok = new Map<number, typeof labelAntri>()
          for (const l of labelAntri) {
            const kunci = Math.round(l.x1 / (8 * hp))
            const arr = kelompok.get(kunci) ?? []
            arr.push(l)
            kelompok.set(kunci, arr)
          }
          const tinggiPill = Math.round(FONT_PX * vp) + PAD_Y * 2 * vp
          for (const arr of kelompok.values()) {
            arr.sort((a, b) => a.y - b.y)
            let batasBawah = -Infinity
            for (const l of arr) {
              const lebarTeks = ctx.measureText(l.teks).width
              const lebarPill = lebarTeks + PAD_X * 2 * hp
              const x = Math.min(l.x1 + 4 * hp, bitmapSize.width - lebarPill - 2 * hp)
              let yPill = l.y - tinggiPill / 2
              if (yPill < batasBawah + 2 * vp) yPill = batasBawah + 2 * vp
              batasBawah = yPill + tinggiPill
              ctx.fillStyle = l.warna
              ctx.beginPath()
              ctx.roundRect(x, yPill, lebarPill, tinggiPill, tinggiPill / 2)
              ctx.fill()
              ctx.fillStyle = '#fff'
              ctx.fillText(l.teks, x + PAD_X * hp, yPill + tinggiPill / 2)
              pillRectBaru.push({
                x0: x / hp, x1: (x + lebarPill) / hp,
                y0: yPill / vp, y1: (yPill + tinggiPill) / vp,
                id: l.id,
              })
            }
          }
          this.pillRect = pillRectBaru
          ctx.restore()
        })
      },
    }
  }
}
