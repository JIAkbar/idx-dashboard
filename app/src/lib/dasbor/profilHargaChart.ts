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
/** GRADIENT intensitas (permintaan Johan 28 Agu "untuk profil berikan warna
 *  gradient saja"): keburaman bar mengikuti besar lot-nya — makin ramai makin
 *  pekat — sehingga profil terbaca sebagai gradasi, bukan tiga blok datar.
 *  POC tetap emas (paling ramai), area nilai 70% memakai gradasi biru-abu
 *  yang lebih kuat daripada luar area. */
const ALFA_MIN = 0.10
const ALFA_MAKS_VA = 0.55
const ALFA_MAKS_LUAR = 0.30
const WARNA_POC = 'rgba(234, 179, 8, 0.62)'
const rgbaBar = (alfa: number) => `rgba(148, 163, 184, ${alfa.toFixed(3)})`

export type KelasPita = 'poc' | 'va' | 'luar'

/**
 * Klasifikasi pita ala volume profile standar: POC = pita ber-lot terbesar;
 * area nilai = perluasan dari POC ke tetangga ber-lot lebih besar sampai
 * kumulatifnya ≥ `porsi` total. Masukan HARUS urut harga (tetangga indeks =
 * tetangga harga) — `profilHarga()` memang menghasilkan urut naik.
 */
export function kelasPita(lot: number[], porsi = 0.7): KelasPita[] {
  const n = lot.length
  if (n === 0) return []
  const total = lot.reduce((s, v) => s + v, 0)
  let iPoc = 0
  for (let i = 1; i < n; i++) if (lot[i] > lot[iPoc]) iPoc = i
  const kelas: KelasPita[] = Array.from({ length: n }, () => 'luar')
  kelas[iPoc] = 'poc'
  if (total <= 0) return kelas
  let lo = iPoc
  let hi = iPoc
  let akum = lot[iPoc]
  while (akum < porsi * total && (lo > 0 || hi < n - 1)) {
    const bawah = lo > 0 ? lot[lo - 1] : -1
    const atas = hi < n - 1 ? lot[hi + 1] : -1
    if (atas >= bawah) { hi += 1; akum += lot[hi]; kelas[hi] = 'va' }
    else { lo -= 1; akum += lot[lo]; kelas[lo] = 'va' }
  }
  return kelas
}

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
    // Kelas dihitung di data LENGKAP (urut harga) sebelum pemetaan koordinat
    // — pita yang kebetulan di luar pandang tak boleh menggeser POC/VA.
    const kelas = kelasPita(this.data.map((p) => p.lot))
    const baris: Array<{ yA: number; yB: number; f: number; kelas: KelasPita }> = []
    for (let i = 0; i < this.data.length; i++) {
      const p = this.data[i]
      const yA = seri.priceToCoordinate(p.hargaAtas)
      const yB = seri.priceToCoordinate(p.hargaBawah)
      if (yA === null || yB === null) continue
      baris.push({ yA: yA as number, yB: yB as number, f: p.lot / lotMaks, kelas: kelas[i] })
    }
    if (baris.length === 0) return null
    return {
      draw: (target: CanvasRenderingTarget2D) => {
        target.useBitmapCoordinateSpace(({ context: ctx, bitmapSize, verticalPixelRatio: vp }) => {
          ctx.save()
          const lebarMaks = bitmapSize.width * PORSI_MAKS
          for (const b of baris) {
            const atas = Math.round(b.yA * vp)
            const bawah = Math.round(b.yB * vp)
            const w = Math.max(1, b.f * lebarMaks)
            const h = Math.max(1, bawah - atas - Math.round(vp))
            // Gradient intensitas: alfa ∝ lot relatif; VA lebih pekat dari luar.
            const alfaMaks = b.kelas === 'va' ? ALFA_MAKS_VA : ALFA_MAKS_LUAR
            ctx.fillStyle = b.kelas === 'poc' ? WARNA_POC : rgbaBar(ALFA_MIN + (alfaMaks - ALFA_MIN) * b.f)
            ctx.fillRect(bitmapSize.width - w, atas, w, h)
          }
          ctx.restore()
        })
      },
    }
  }
}
