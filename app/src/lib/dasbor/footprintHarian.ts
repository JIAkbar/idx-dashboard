/**
 * Primitive W7 — footprint harian Whales Papan
 * (`docs/spek-dev-papan/spek_footprint_harian.md`).
 *
 * `binFootprint()` adalah fungsi MURNI (tanpa DOM/chart) yang memecah satu
 * hari broker jadi sel-sel level harga — dipisah dari kelas penggambar
 * supaya bisa diuji tanpa mock lightweight-charts (lihat
 * `footprintHarian.test.ts`). Kelas `FootprintHarian` di bawahnya murni
 * menggambar, mengikuti pola `profilHargaChart.ts`.
 *
 * ## Hampiran yang WAJIB disebut di layar (spek §2)
 *
 * Posisi broker dalam sel = harga RATA-RATA beli/jualnya hari itu (dari
 * `broker_tahunan`), bukan rincian transaksi per level. Satu broker bisa
 * muncul di DUA sel berbeda pada hari yang sama — avg beli ≠ avg jual.
 *
 * ## Kenapa rentang low–high dari candle (bukan dari avg broker)
 *
 * Candle harian (`ohlcv_stockbit`) TERSESUAIKAN aksi korporasi; avg broker
 * (`broker_tahunan`) TIDAK (aturan dua-konvensi CLAUDE.md). Spek §1 memang
 * memerintahkan rentang "dari candle" — akibatnya avg broker kadang jatuh
 * sedikit di luar low–high candle pada hari patahan pecah saham, dan itulah
 * yang dijepit ke sel tepi (uji "avg terjepit ke tepi").
 */
import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type {
  IChartApiBase, IPanePrimitive, IPanePrimitivePaneView, IPrimitivePaneRenderer,
  ISeriesApi, PaneAttachedParameter, PrimitiveHoveredItem, SeriesType, Time,
} from 'lightweight-charts'
import { fraksi } from '../fraksiHarga'
import type { BarisBroker } from './whalesPapan'

/** Pecahan satu broker di dalam satu sel — sisi yang tak menyentuh sel ini
 *  tetap 0 (broker beli-saja di sel A, jual-saja di sel B). */
export interface BrokerSel {
  kode: string
  beliLot: number
  beliNilai: number
  jualLot: number
  jualNilai: number
}

export interface SelFootprint {
  hargaBawah: number
  hargaAtas: number
  beliLot: number
  jualLot: number
  /** Urut desc (beliLot+jualLot) — tooltip memotong 8 teratas. */
  broker: BrokerSel[]
}

const MAKS_BIN = 12

/** Tepi bin: ≤12 tick → tick asli; lebih lebar → 12 bin sama rata. */
function tepiBin(low: number, high: number, tickFn: (harga: number) => number): number[] {
  const tick = tickFn((low + high) / 2) || 1
  if (!(high > low)) return [low, low + tick]
  const rentang = high - low
  const nTick = Math.ceil(rentang / tick)
  if (nTick <= MAKS_BIN) {
    return Array.from({ length: nTick + 1 }, (_, i) => low + i * tick)
  }
  const lebar = rentang / MAKS_BIN
  return Array.from({ length: MAKS_BIN + 1 }, (_, i) => low + i * lebar)
}

/**
 * Pecah broker satu hari jadi sel-sel level harga. `tickFn` dapat diganti
 * saat uji; bawaannya `fraksi()` (tabel fraksi BEI resmi).
 */
export function binFootprint(
  broker: readonly BarisBroker[],
  low: number,
  high: number,
  tickFn: (harga: number) => number = fraksi,
): SelFootprint[] {
  const tepi = tepiBin(low, high, tickFn)
  const sel: SelFootprint[] = tepi.slice(0, -1).map((bawah, i) => ({
    hargaBawah: bawah, hargaAtas: tepi[i + 1], beliLot: 0, jualLot: 0, broker: [],
  }))
  const petaBroker = sel.map(() => new Map<string, BrokerSel>())

  const cariBin = (harga: number): number => {
    for (let i = 0; i < sel.length; i++) {
      if (harga >= sel[i].hargaBawah && harga <= sel[i].hargaAtas) return i
    }
    return harga < sel[0].hargaBawah ? 0 : sel.length - 1
  }
  const tambah = (i: number, kode: string, dBeliLot: number, dBeliNilai: number, dJualLot: number, dJualNilai: number) => {
    const peta = petaBroker[i]
    let b = peta.get(kode)
    if (!b) { b = { kode, beliLot: 0, beliNilai: 0, jualLot: 0, jualNilai: 0 }; peta.set(kode, b) }
    b.beliLot += dBeliLot; b.beliNilai += dBeliNilai; b.jualLot += dJualLot; b.jualNilai += dJualNilai
    sel[i].beliLot += dBeliLot
    sel[i].jualLot += dJualLot
  }

  for (const [kode, beliLot, beliNilai, jualLot, jualNilai] of broker) {
    if (beliLot > 0 && beliNilai > 0) tambah(cariBin(beliNilai / (beliLot * 100)), kode, beliLot, beliNilai, 0, 0)
    if (jualLot > 0 && jualNilai > 0) tambah(cariBin(jualNilai / (jualLot * 100)), kode, 0, 0, jualLot, jualNilai)
  }
  for (let i = 0; i < sel.length; i++) {
    sel[i].broker = [...petaBroker[i].values()].sort((a, b) => (b.beliLot + b.jualLot) - (a.beliLot + a.jualLot))
  }
  return sel
}

/** Sel siap gambar — warna dominan tiap sisi sudah diresolusi pemanggil
 *  (`warnaBrokerCanvas`, dihitung sekali di `setData`, bukan tiap frame). */
export interface SelFootprintWarna extends SelFootprint {
  warnaBeli: string
  warnaJual: string
}
export interface KolomFootprint {
  tanggal: string
  sel: SelFootprintWarna[]
}

const PORSI_KOLOM = 0.82
const LEBAR_MIN_TEKS = 48
const FONT_PX = 9
/** Jarak antar bar minimum (px) supaya sel masih terbaca — diekspor karena
 *  halaman memakainya untuk auto-zoom saat toggle dinyalakan. */
export const BAR_SPACING_MIN = 14

export class FootprintHarian implements IPanePrimitive<Time> {
  private ambilSeri: () => ISeriesApi<SeriesType> | null
  private chart: IChartApiBase<Time> | null = null
  private data: KolomFootprint[] = []
  private mintaGambar: (() => void) | null = null
  private views: IPanePrimitivePaneView[] = [{
    zOrder: () => 'top' as const,
    renderer: () => this.renderer(),
  }]
  /** Kotak sel terakhir digambar (ruang media) — bahan hitTest tooltip. */
  private rects: Array<{ x0: number; y0: number; x1: number; y1: number; id: string }> = []
  private selById = new Map<string, { tanggal: string; sel: SelFootprintWarna }>()

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

  setData(d: KolomFootprint[]): void {
    this.data = d
    this.mintaGambar?.()
  }

  paneViews(): readonly IPanePrimitivePaneView[] {
    return this.views
  }

  /** Dipakai halaman (crosshair-move & klik) untuk mengisi tooltip dari
   *  `hoveredObjectId` — id datang dari `hitTest` di bawah. */
  getSel(id: string): { tanggal: string; sel: SelFootprintWarna } | null {
    return this.selById.get(id) ?? null
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    for (const r of this.rects) {
      if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) {
        return { externalId: r.id, zOrder: 'top', cursorStyle: 'pointer' }
      }
    }
    return null
  }

  private renderer(): IPrimitivePaneRenderer | null {
    const seri = this.ambilSeri()
    const chart = this.chart
    if (!seri || !chart || this.data.length === 0) return null
    const skalaWaktu = chart.timeScale()
    const barSpacing = skalaWaktu.options().barSpacing
    // Di bawah ambang ini satu sel tingginya < 1px dan lebarnya ≈ 2px — sel
    // "tergambar" tapi mustahil terbaca (verifikasi visual perdana: toggle
    // menyala, layar tampak kosong). Lebih jujur tidak menggambar sama
    // sekali; halaman menampilkan keterangan + auto-zoom saat toggle nyala.
    if (barSpacing < BAR_SPACING_MIN) { this.rects = []; this.selById = new Map(); return null }
    const lebarKolom = barSpacing * PORSI_KOLOM

    // Hanya kolom yang x-nya terpetakan (di dalam jendela pandang) yang
    // masuk daftar gambar — ini yang membuat "hanya rentang terlihat" (spek
    // §3) tanpa perlu menghitung logical range sendiri.
    interface Batang { x: number; y0: number; y1: number; wBeli: number; wJual: number; warnaBeli: string; warnaJual: string; total: number; id: string; rx0: number; rx1: number }
    const batang: Batang[] = []
    const rectsBaru: Array<{ x0: number; y0: number; x1: number; y1: number; id: string }> = []
    const selByIdBaru = new Map<string, { tanggal: string; sel: SelFootprintWarna }>()

    // timeToCoordinate TIDAK mengembalikan null di luar jendela pandang —
    // ia memberi koordinat negatif/di luar lebar (terukur: x −11.118 untuk
    // bar 2016). Culling manual, atau 14 ribu batang digambar sia-sia.
    const lebarPane = skalaWaktu.width()
    for (const kolom of this.data) {
      const x = skalaWaktu.timeToCoordinate(kolom.tanggal as Time)
      if (x === null) continue
      const xc = x as number
      if (xc < -barSpacing || xc > lebarPane + barSpacing) continue
      const halfW = lebarKolom / 2
      // Penyebut lebar = lot terbesar DI KOLOM INI, bukan global: dengan
      // penyebut global (lotMaks seluruh riwayat) hari biasa cuma beberapa
      // persen dari hari terramai dan semua selnya jatuh ke 1px — terukur
      // saat verifikasi visual perdana (BBCA, toggle menyala tapi "kosong").
      const maksKolom = Math.max(1, ...kolom.sel.flatMap((s) => [s.beliLot, s.jualLot]))
      kolom.sel.forEach((s, i) => {
        const yA = seri.priceToCoordinate(s.hargaAtas)
        const yB = seri.priceToCoordinate(s.hargaBawah)
        if (yA === null || yB === null) return
        const y0 = Math.min(yA as number, yB as number)
        const y1 = Math.max(yA as number, yB as number)
        if (s.beliLot === 0 && s.jualLot === 0) return
        const id = `fp:${kolom.tanggal}:${i}`
        const wBeli = s.beliLot > 0 ? Math.max(1.5, halfW * (s.beliLot / maksKolom)) : 0
        const wJual = s.jualLot > 0 ? Math.max(1.5, halfW * (s.jualLot / maksKolom)) : 0
        batang.push({
          x: xc, y0, y1, wBeli, wJual, warnaBeli: s.warnaBeli, warnaJual: s.warnaJual,
          total: s.beliLot + s.jualLot, id, rx0: xc - halfW, rx1: xc + halfW,
        })
        rectsBaru.push({ x0: xc - halfW, x1: xc + halfW, y0, y1, id })
        selByIdBaru.set(id, { tanggal: kolom.tanggal, sel: s })
      })
    }
    this.rects = rectsBaru
    this.selById = selByIdBaru
    if (batang.length === 0) return null

    return {
      draw: (target: CanvasRenderingTarget2D) => {
        target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio: hp, verticalPixelRatio: vp }) => {
          ctx.save()
          ctx.globalAlpha = 0.82
          for (const b of batang) {
            const y0 = Math.round(b.y0 * vp)
            const h = Math.max(1, Math.round(b.y1 * vp) - y0 - Math.round(vp))
            if (b.wBeli > 0) {
              ctx.fillStyle = b.warnaBeli
              const w = Math.round(b.wBeli * hp)
              ctx.fillRect(Math.round(b.x * hp) - w, y0, w, h)
            }
            if (b.wJual > 0) {
              ctx.fillStyle = b.warnaJual
              ctx.fillRect(Math.round(b.x * hp), y0, Math.round(b.wJual * hp), h)
            }
          }
          ctx.globalAlpha = 1
          if (lebarKolom >= LEBAR_MIN_TEKS) {
            ctx.font = `${Math.round(FONT_PX * vp)}px system-ui, sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillStyle = 'rgba(255,255,255,0.92)'
            for (const b of batang) {
              const h = (b.y1 - b.y0) * vp
              if (h < 12 * vp) continue
              ctx.fillText(
                Math.round(b.total).toLocaleString('id-ID'),
                b.x * hp,
                ((b.y0 + b.y1) / 2) * vp,
              )
            }
          }
          ctx.restore()
        })
      },
    }
  }
}
