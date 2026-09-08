/**
 * Pemuat candle harian bersama (ohlcv_stockbit) untuk chart lightweight-charts
 * — dipakai Whales Papan & Inventory Neo Papan. Konvensi TERSESUAIKAN aksi
 * korporasi: benar untuk BENTUK grafik (aturan dua-konvensi CLAUDE.md).
 * Kolom berkas: tanggal, unixdate, o, h, l, c, volume, … (lihat ohlcvKaya.ts).
 */
import type { CandlestickData, HistogramData, Time } from 'lightweight-charts'
import type { HargaLive } from './hargaLive'

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

/**
 * Tempelkan bar HARI BERJALAN dari proxy live ke deret candle arsip (#97 A,
 * keputusan Johan 8 Sep 2026: "di whales juga bisa dong itu datanya realtime
 * pakai OHLCV nya"). Aturan:
 * - hanya bila tanggal live = `hariIni` (tanggal Jakarta dari jamPasarJakarta)
 *   DAN lebih baru dari bar arsip terakhir (arsip sengaja membuang bar hari
 *   berjalan — `buang_bar_hari_berjalan` di panen); tanggal sama atau lebih
 *   tua = arsip menang. Temuan tinjauan 8 Sep: tanpa syarat hari ini, bar
 *   kemarin (saat arsip tertinggal) atau bar stub besok ikut berlabel LIVE;
 * - open/high/low/close harus angka sah dan konsisten (low ≤ min(o,c), high ≥
 *   max(o,c)); kalau tidak, bar dibuang — lebih baik tanpa bar daripada bar
 *   cacat menggeser skala;
 * - deret asli TIDAK diubah (kembalian larik baru); tak pernah ditulis ke mana pun.
 */
export function gabungBarBerjalan(candle: DataCandle, live: HargaLive | null | undefined, hariIni?: string): DataCandle {
  if (!live || !live.tanggal || !/^\d{4}-\d{2}-\d{2}$/.test(live.tanggal)) return candle
  if (hariIni && live.tanggal !== hariIni) return candle
  const terakhir = candle.lilin.length ? String(candle.lilin[candle.lilin.length - 1].time) : ''
  if (live.tanggal <= terakhir) return candle
  const o = Number(live.open), h = Number(live.high), l = Number(live.low), c = Number(live.close)
  if (![o, h, l, c].every(Number.isFinite) || o <= 0 || c <= 0) return candle
  if (l > Math.min(o, c) || h < Math.max(o, c)) return candle
  const time = live.tanggal as Time
  const v = Number(live.volume)
  return {
    lilin: [...candle.lilin, { time, open: o, high: h, low: l, close: c }],
    volume: [...candle.volume, { time, value: Number.isFinite(v) && v > 0 ? v : 0, color: c >= o ? WARNA_VOL_NAIK : WARNA_VOL_TURUN }],
  }
}
