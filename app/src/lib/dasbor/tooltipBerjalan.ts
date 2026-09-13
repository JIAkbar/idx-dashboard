/**
 * Isi tooltip transaksi hari berjalan di Whales (#152 D).
 *
 * Johan 13 Sep 2026 (dikutip pengawas): "maksudnya muncul tooltips transaksi
 * yang berjalan karena data broker gak bisa realtime berarti data OHLCV nya
 * bisa itu tapi tooltips, bukan tabel bukan lain2".
 *
 * Tooltip-nya sudah ada sejak #155 B, tapi jarang terlihat: hanya lewat gerak
 * crosshair (tak ada jalur ketuk ponsel) dan hanya selagi status pasar "buka",
 * padahal bar hari ini tetap tergambar sesudah 16:15. Aturan tampil dan isinya
 * dipindah ke sini supaya bisa diuji tanpa kanvas.
 *
 * Semua angka dari tarikan live yang SUDAH datang: nol permintaan tambahan.
 * Yang sengaja tidak dimuat: aliran asing (basi di sumber, tak dikirim proxy),
 * pecahan per broker (terbit sesudah tutup), dan transaksi satu per satu (tak
 * ada di sumber).
 */
import { keFraksi } from '../fraksiHarga'
import type { HargaLive } from './hargaLive'
import { nilaiPerTransaksi, vwapTaksiran, type BarisTape } from './tapeLive'

/** Baris tape terbanyak di tooltip — sisanya ada di panel Detak. */
export const MAKS_TAPE_TOOLTIP = 5

export interface IsiTooltipBerjalan {
  /** "berjalan" selagi bursa buka; sesudah tutup bar terakhir DITAHAN. */
  status: 'berjalan' | 'penutupan sementara'
  /** Epoch ms tarikan yang melahirkan angka ini. */
  diterimaPada: number
  harga: number | null
  pct: number | null
  open: number | null
  high: number | null
  low: number | null
  volumeLot: number | null
  nilai: number | null
  frekuensi: number | null
  /** Nilai ÷ volume — hasil hitungan, jadi tidak dijepit ke fraksi harga. */
  vwap: number | null
  /** Nilai ÷ frekuensi. */
  perTransaksi: number | null
  /** Kosong sesudah tutup: tape hanya bermakna selagi tarikan berjalan. */
  tape: BarisTape[]
}

const sah = (v: number | null | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

const hargaBursa = (v: number | null | undefined): number | null => {
  const x = sah(v)
  return x != null && x > 0 ? keFraksi(x) : x
}

/** Null = tooltip tidak tampil: belum ada angka live, atau bar hari ini tak tergambar. */
export function isiTooltipBerjalan(
  live: HargaLive | null,
  statusPasar: 'buka' | 'tutup',
  adaBarBerjalan: boolean,
  tape: readonly BarisTape[],
): IsiTooltipBerjalan | null {
  if (!live || !adaBarBerjalan) return null
  const buka = statusPasar === 'buka'
  const volume = sah(live.volume)
  return {
    status: buka ? 'berjalan' : 'penutupan sementara',
    diterimaPada: live.diambilPada,
    harga: hargaBursa(live.close),
    pct: sah(live.pct),
    open: hargaBursa(live.open),
    high: hargaBursa(live.high),
    low: hargaBursa(live.low),
    volumeLot: volume != null ? volume / 100 : null,
    nilai: sah(live.value),
    frekuensi: sah(live.frequency),
    vwap: vwapTaksiran(live.value, live.volume),
    perTransaksi: nilaiPerTransaksi(live.value, live.frequency),
    tape: buka ? tape.slice(0, MAKS_TAPE_TOOLTIP) : [],
  }
}

/** Angka kosong atau rusak tampil sebagai tanda pisah — bukan 0, bukan NaN. */
export function angkaAtauPisah(n: number | null | undefined, format: (x: number) => string): string {
  return typeof n === 'number' && Number.isFinite(n) ? format(n) : '—'
}
