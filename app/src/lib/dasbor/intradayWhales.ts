/**
 * Mode Intraday Whales Papan — pemuat + agregasi bar 1 JAM
 * (`docs/spek-dev-papan/spek_whales_papan.md` §1B).
 *
 * Halaman TIDAK membaca arsip mentah 1 menit. Yang dibaca berkas OLAHAN
 * `data-idx/json/intraday_1h/<KODE>.json` (dibangun
 * `scripts/bangun_intraday_1h.py` dari `_arsip-mentah/intraday/` — pola
 * mentah→olahan yang sama dengan broker-harian→broker_tahunan). 4H tidak
 * disimpan di mana pun: diagregasi DI SINI dari 1H per paruh sesi (pagi
 * <12:00, sore ≥12:00) = tepat 2 bar 4H per hari bursa (uji terima §8.4).
 *
 * Aliran asing intraday SENGAJA tidak ada di tipe ini: ruas foreign_* pada
 * bar 1 menit TERUKUR kosong di 874/874 emiten (26 Agu 2026) — lihat
 * referensi proyek. Jangan ditambahkan kembali tanpa bukti baru.
 */

/** Kolom `intraday_1h/<KODE>.json` (`bangun_intraday_1h.py:KOLOM`). */
export interface Bar1H {
  /** Epoch detik WIB awal ember jam. */
  epoch: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  value: number
  frequency: number
}

export type GalatIntraday = 'belum-ada' | 'kosong' | null

const IDX_EPOCH = 0
const IDX_O = 1
const IDX_H = 2
const IDX_L = 3
const IDX_C = 4
const IDX_V = 5
const IDX_VAL = 6
const IDX_F = 7

export function dariBerkas(j: { bar?: (number | string)[][] } | null): Bar1H[] {
  if (!j || !Array.isArray(j.bar)) return []
  return j.bar.map((b) => ({
    epoch: Number(b[IDX_EPOCH]),
    open: Number(b[IDX_O]),
    high: Number(b[IDX_H]),
    low: Number(b[IDX_L]),
    close: Number(b[IDX_C]),
    volume: Number(b[IDX_V]),
    value: Number(b[IDX_VAL]),
    frequency: Number(b[IDX_F]),
  }))
}

const MS_JAM_WIB = 7 * 3600

/** 'yyyy-mm-dd' WIB dari epoch — tanpa Date lokal (mesin pembaca bisa zona lain). */
export function tanggalWib(epoch: number): string {
  return new Date((epoch + MS_JAM_WIB) * 1000).toISOString().slice(0, 10)
}

/** Jam WIB (0-23) dari epoch. */
export function jamWib(epoch: number): number {
  return new Date((epoch + MS_JAM_WIB) * 1000).getUTCHours()
}

/**
 * 1H → 4H per paruh sesi: pagi (<12 WIB) dan sore (≥12). Epoch bar 4H =
 * epoch bar 1H pertama paruh itu.
 */
export function agregasi4h(bar: Bar1H[]): Bar1H[] {
  const ember = new Map<string, Bar1H[]>()
  for (const b of bar) {
    const kunci = `${tanggalWib(b.epoch)}·${jamWib(b.epoch) < 12 ? 'pagi' : 'sore'}`
    const isi = ember.get(kunci)
    if (isi) isi.push(b)
    else ember.set(kunci, [b])
  }
  const keluar: Bar1H[] = []
  for (const isi of ember.values()) {
    isi.sort((a, b) => a.epoch - b.epoch)
    keluar.push({
      epoch: isi[0].epoch,
      open: isi[0].open,
      high: Math.max(...isi.map((b) => b.high)),
      low: Math.min(...isi.map((b) => b.low)),
      close: isi[isi.length - 1].close,
      volume: isi.reduce((s, b) => s + b.volume, 0),
      value: isi.reduce((s, b) => s + b.value, 0),
      frequency: isi.reduce((s, b) => s + b.frequency, 0),
    })
  }
  keluar.sort((a, b) => a.epoch - b.epoch)
  return keluar
}

export interface RingkasIntraday {
  nBar: number
  nHari: number
  volume: number
  value: number
  frequency: number
  hargaMin: number
  hargaMax: number
}

/** Agregat bar di dalam seleksi (rentang epoch × harga). Bar masuk bila
 *  RENTANG harganya (low..high) beririsan dengan rentang seleksi. */
export function agregatSeleksiIntraday(
  bar: Bar1H[], dariEpoch: number, sampaiEpoch: number, hargaMin: number, hargaMax: number,
): RingkasIntraday | null {
  const pilih = bar.filter((b) =>
    b.epoch >= dariEpoch && b.epoch <= sampaiEpoch && b.low <= hargaMax && b.high >= hargaMin)
  if (pilih.length === 0) return null
  return {
    nBar: pilih.length,
    nHari: new Set(pilih.map((b) => tanggalWib(b.epoch))).size,
    volume: pilih.reduce((s, b) => s + b.volume, 0),
    value: pilih.reduce((s, b) => s + b.value, 0),
    frequency: pilih.reduce((s, b) => s + b.frequency, 0),
    hargaMin: Math.min(...pilih.map((b) => b.low)),
    hargaMax: Math.max(...pilih.map((b) => b.high)),
  }
}

export async function muatIntraday1h(kode: string): Promise<{ bar: Bar1H[]; galat: GalatIntraday }> {
  const r = await fetch(`/data-idx/json/intraday_1h/${kode}.json`)
  if (!r.ok) return { bar: [], galat: 'belum-ada' }
  try {
    const bar = dariBerkas(await r.json())
    return { bar, galat: bar.length === 0 ? 'kosong' : null }
  } catch {
    // Server SPA membalas berkas hilang dengan index.html 200 (pelajaran
    // muatRentang #341) — parse gagal = belum ada.
    return { bar: [], galat: 'belum-ada' }
  }
}
