/**
 * Pemuat candle harian bersama (ohlcv_stockbit) untuk chart lightweight-charts
 * — dipakai Whales Papan & Inventory Neo Papan. Konvensi TERSESUAIKAN aksi
 * korporasi: benar untuk BENTUK grafik (aturan dua-konvensi CLAUDE.md).
 * Kolom berkas: tanggal, unixdate, o, h, l, c, volume, … (lihat ohlcvKaya.ts).
 */
import type { CandlestickData, HistogramData, Time } from 'lightweight-charts'

export interface DataCandle {
  lilin: CandlestickData[]
  volume: HistogramData[]
}

export const WARNA_VOL_NAIK = 'rgba(48, 164, 108, 0.5)'
export const WARNA_VOL_TURUN = 'rgba(229, 72, 77, 0.5)'

export async function muatCandle(kode: string): Promise<DataCandle> {
  const r = await fetch(`/data-idx/json/ohlcv_stockbit/${kode}.json`)
  if (!r.ok) return { lilin: [], volume: [] }
  try {
    const j = (await r.json()) as { bar?: (string | number)[][] }
    const lilin: CandlestickData[] = []
    const volume: HistogramData[] = []
    for (const b of j.bar ?? []) {
      const time = b[0] as Time
      const open = Number(b[2]); const high = Number(b[3])
      const low = Number(b[4]); const close = Number(b[5])
      if (!Number.isFinite(open) || !Number.isFinite(close)) continue
      lilin.push({ time, open, high, low, close })
      volume.push({ time, value: Number(b[6]) || 0, color: close >= open ? WARNA_VOL_NAIK : WARNA_VOL_TURUN })
    }
    return { lilin, volume }
  } catch {
    // Server SPA membalas berkas hilang dengan index.html 200 (pelajaran #341).
    return { lilin: [], volume: [] }
  }
}
