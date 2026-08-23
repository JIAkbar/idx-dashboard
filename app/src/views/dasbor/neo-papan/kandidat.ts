import { ambilScreener } from '../../../lib/dasbor/screener'
import { muatOhlcv, muatIndeksEmiten, type BarHarga } from '../../../lib/dasbor/neoPapanData'
import { pilihKandidatSektor } from '../../../lib/dasbor/neoPapan'

/**
 * Universe sampel untuk Rotation Chart & Sector/Index Activity.
 *
 * Membangun indeks sektor/indeks SUNGGUHAN butuh riwayat harga SELURUH ~960
 * emiten pasar — mengunduhnya di peramban tiap kali tab ini dibuka tidak
 * masuk akal (satu berkas riwayat penuh saja ratusan KB; ratusan berkas
 * sekaligus akan macet). Screener (`data-idx/json/screener.json`) sudah jadi
 * satu-satunya sumber lintas-emiten yang dipakai proyek ini justru untuk
 * menghindari pola itu (lihat Screener.tsx) — dipakai ulang di sini untuk
 * memilih SAMPEL emiten paling likuid per sektor, bukan mengunduh semuanya.
 *
 * Konsekuensinya HARUS tertulis di layar: Rotation & Activity di sini
 * dihitung dari sampel, bukan seluruh pasar.
 */
export interface UniverseSektor {
  perSektor: Record<string, string[]>
  bars: Map<string, BarHarga[]>
  indeks: Map<string, string[]>
  perSektorJumlah: number
}

const PER_SEKTOR = 8

let cache: Promise<UniverseSektor | null> | null = null

export function muatUniverseSektor(): Promise<UniverseSektor | null> {
  if (!cache) {
    cache = (async () => {
      const scr = await ambilScreener()
      if (!scr) return null
      const baris = scr.emiten.map((e) => ({ kode: e.kode, sektor: e.sektor, nilai: e.nilai }))
      const perSektor = pilihKandidatSektor(baris, PER_SEKTOR)
      const semua = [...new Set(Object.values(perSektor).flat())]
      const barsArr = await Promise.all(semua.map(async (k) => [k, await muatOhlcv(k)] as const))
      const bars = new Map<string, BarHarga[]>()
      for (const [k, b] of barsArr) if (b) bars.set(k, b)
      const idxArr = await Promise.all(semua.map(async (k) => [k, await muatIndeksEmiten(k)] as const))
      const indeks = new Map(idxArr)
      return { perSektor, bars, indeks, perSektorJumlah: PER_SEKTOR }
    })()
  }
  return cache
}
