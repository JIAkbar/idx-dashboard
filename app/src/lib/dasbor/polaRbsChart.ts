/**
 * Primitive — Pola RBS (Resistance → Breakout → Support) di Grafik Emiten
 * (`docs/spek-dev-papan/spek_rbs_gap_intraday.md` §1).
 *
 * Levelnya TIDAK dihitung di sini — pemanggil memakai `cariRbs()` dari
 * `polaRbs.ts` (mesin murni, teruji sendiri) lalu menyetor hasilnya lewat
 * `setData`. Kelas ini murni menggambar, mengikuti tiga pola yang sudah ada:
 * garis harga statis dari `pitaCprChart.ts`, badge pill kanan + dodge dari
 * `garisAvgBroker.ts`, dan culling manual `timeToCoordinate` dari
 * `footprintHarian.ts` (di luar jendela pandang ia TETAP memberi koordinat,
 * bukan null — jadi garis level yang dimulai dari tanggal pivot pertama
 * dijepit ke tepi kiri kanvas, bukan digambar dari x negatif).
 *
 * "Maksimal 3 level aktif terdekat digambar" (spek §1) dikerjakan DI SINI
 * (si penggambar yang memotong, array penuh dari `cariRbs` tetap utuh) —
 * aktif = status bukan `gagal` (pola gugur tak lagi relevan diawasi di
 * kanvas), terdekat diukur dari `hargaTerakhir` yang disetor pemanggil.
 */
import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type {
  IChartApiBase, IPanePrimitive, IPanePrimitivePaneView, IPrimitivePaneRenderer,
  ISeriesApi, PaneAttachedParameter, PrimitiveHoveredItem, SeriesType, Time,
} from 'lightweight-charts'
import type { LevelRbs, StatusRbs } from './polaRbs'

const FONT_PX = 10
const PAD_X = 6
const PAD_Y = 3
const TEPI_KANAN = 8
const MAKS_LEVEL_GAMBAR = 3
const RADIUS_TITIK = 2.5
const OFFSET_SEGITIGA_BREAKOUT = 12
const OFFSET_SEGITIGA_KONFIRMASI = 24
const SISI_SEGITIGA = 5

// Spek §1 menyebut EMPAT warna untuk LIMA status: "merah putus (resistance) →
// kuning putus (tembus, tunggu retest) → hijau solid (sah) → abu redup
// (gagal)". `retest` sengaja BERBAGI warna kuning dengan `breakout` — dua
// status logis yang sama-sama masih "menunggu keputusan pasar" di layar,
// dan spek memang cuma mengalokasikan satu warna untuk fase tunggu itu.
const WARNA: Record<'resistance' | 'breakout' | 'sah' | 'gagal', string> = {
  resistance: '#e5484d',
  breakout: '#eab308',
  sah: '#30a46c',
  gagal: 'rgba(142, 142, 160, 0.55)',
}
function warnaStatus(s: StatusRbs): string {
  return WARNA[s === 'retest' ? 'breakout' : s]
}
// Solid HANYA untuk 'sah' (spek eksplisit) — status lain (termasuk 'gagal',
// tak disebut spek) tetap putus-putus, menandakan levelnya tak lagi "aktif
// dipegang" seperti garis solid.
function putus(s: StatusRbs): boolean {
  return s !== 'sah'
}

export interface DataRbsChart {
  level: LevelRbs[]
  hargaTerakhir: number | null
}

export class PolaRbsChart implements IPanePrimitive<Time> {
  private ambilSeri: () => ISeriesApi<SeriesType> | null
  private chart: IChartApiBase<Time> | null = null
  private data: DataRbsChart = { level: [], hargaTerakhir: null }
  private mintaGambar: (() => void) | null = null
  private views: IPanePrimitivePaneView[] = [{ renderer: () => this.renderer() }]
  /** Pill badge terakhir digambar (ruang media) — bahan hitTest untuk hover
   *  (view menaruh `title` DOM native di titik ini, lihat GrafikEmiten.tsx). */
  private pillRect: Array<{ x0: number; y0: number; x1: number; y1: number; id: string }> = []
  private byId = new Map<string, LevelRbs>()

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

  setData(d: DataRbsChart): void {
    this.data = d
    this.mintaGambar?.()
  }

  paneViews(): readonly IPanePrimitivePaneView[] {
    return this.views
  }

  getLevel(id: string): LevelRbs | null {
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
    if (!seri || !chart || this.data.level.length === 0) { this.pillRect = []; this.byId = new Map(); return null }
    const skalaWaktu = chart.timeScale()
    const { hargaTerakhir } = this.data

    const aktif = this.data.level.filter((l) => l.status !== 'gagal')
    const gambar = hargaTerakhir === null
      ? aktif.slice(0, MAKS_LEVEL_GAMBAR)
      : [...aktif]
        .sort((a, b) => Math.abs(a.level - hargaTerakhir) - Math.abs(b.level - hargaTerakhir))
        .slice(0, MAKS_LEVEL_GAMBAR)
    if (gambar.length === 0) { this.pillRect = []; this.byId = new Map(); return null }

    const byIdBaru = new Map<string, LevelRbs>()
    gambar.forEach((l, i) => byIdBaru.set(`rbs:${i}`, l))
    this.byId = byIdBaru

    return {
      draw: (target: CanvasRenderingTarget2D) => {
        target.useBitmapCoordinateSpace(({ context: ctx, bitmapSize, horizontalPixelRatio: hp, verticalPixelRatio: vp }) => {
          ctx.save()
          ctx.font = `${Math.round(FONT_PX * vp)}px system-ui, sans-serif`
          ctx.textBaseline = 'middle'
          const tebal = Math.max(1, Math.round(vp))
          const pillRectBaru: Array<{ x0: number; y0: number; x1: number; y1: number; id: string }> = []
          const labelAntri: Array<{ y: number; teks: string; warna: string; id: string }> = []

          gambar.forEach((l, i) => {
            const yMedia = seri.priceToCoordinate(l.level)
            if (yMedia === null) return
            const y = Math.round((yMedia as number) * vp)
            const warna = warnaStatus(l.status)

            // Garis level — dari tanggal pivot pertama (bukan x=0: resistance
            // belum "ada" sebelum pivot pembentuknya) sampai tepi kanan.
            // timeToCoordinate TIDAK memberi null di luar jendela pandang
            // (footprintHarian.ts) — hasil negatif dijepit ke 0.
            const xMulaiMedia = skalaWaktu.timeToCoordinate(l.tanggalPivot[0] as Time)
            const xMulai = Math.max(0, Math.round((xMulaiMedia === null ? 0 : xMulaiMedia as number) * hp))
            ctx.strokeStyle = warna
            ctx.lineWidth = tebal
            ctx.setLineDash(putus(l.status) ? [6 * hp, 4 * hp] : [])
            ctx.beginPath(); ctx.moveTo(xMulai, y); ctx.lineTo(bitmapSize.width, y); ctx.stroke()
            ctx.setLineDash([])

            // Titik sentuhan — hanya selagi status masih 'resistance' (spek:
            // "merah putus (resistance + titik sentuhan)").
            if (l.status === 'resistance') {
              ctx.fillStyle = warna
              for (const tgl of l.tanggalPivot) {
                const xm = skalaWaktu.timeToCoordinate(tgl as Time)
                if (xm === null) continue
                ctx.beginPath()
                ctx.arc(Math.round((xm as number) * hp), y, RADIUS_TITIK * vp, 0, Math.PI * 2)
                ctx.fill()
              }
            }

            // Segitiga breakout (kuning) & konfirmasi (hijau) — di x bar
            // kejadian, y sedikit di atas garis level supaya tak menutupi
            // teksnya sendiri.
            const segitiga = (tgl: string | undefined, warnaSegi: string, offset: number) => {
              if (!tgl) return
              const xm = skalaWaktu.timeToCoordinate(tgl as Time)
              if (xm === null) return
              const cx = (xm as number) * hp
              const cy = y - offset * vp
              const s = SISI_SEGITIGA * vp
              ctx.fillStyle = warnaSegi
              ctx.beginPath()
              ctx.moveTo(cx, cy - s)
              ctx.lineTo(cx - s, cy + s)
              ctx.lineTo(cx + s, cy + s)
              ctx.closePath()
              ctx.fill()
            }
            segitiga(l.tanggalBreakout, WARNA.breakout, OFFSET_SEGITIGA_BREAKOUT)
            segitiga(l.tanggalKonfirmasi, WARNA.sah, OFFSET_SEGITIGA_KONFIRMASI)

            const teks = `RBS ${Math.round(l.level).toLocaleString('id-ID')} · ${l.status}`
            labelAntri.push({ y, teks, warna, id: `rbs:${i}` })
          })

          // Badge pill kanan, dodge anti-tumpuk — persis pola garisAvgBroker.ts.
          const tinggiPill = Math.round(FONT_PX * vp) + PAD_Y * 2 * vp
          let batasBawah = -Infinity
          for (const l of [...labelAntri].sort((a, b) => a.y - b.y)) {
            const lebarTeks = ctx.measureText(l.teks).width
            const lebarPill = lebarTeks + PAD_X * 2 * hp
            const x = bitmapSize.width - TEPI_KANAN * hp - lebarPill
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
          this.pillRect = pillRectBaru
          ctx.restore()
        })
      },
    }
  }
}
