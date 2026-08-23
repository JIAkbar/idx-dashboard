/**
 * Bahan tambahan Broker Summary v2 di atas `brokerEmiten.ts` (dipakai APA
 * ADANYA, tak diubah): harga OHLCV per emiten (buat overlay & VWAP) + fungsi
 * murni Kuadran/Inventory yang butuh menggabung `AgregatBroker` dengan harga.
 *
 * OHLCV di sini datang dari `/data-idx/json/ohlcv_stockbit/<KODE>.json` —
 * BEDA dari `ohlc/` yang dipakai Grafik Emiten (`ihsgOhlc.ts`): kolomnya 17
 * ruas (termasuk `value`, perlu buat VWAP), dan folder `ohlc/` sedang
 * dipegang pekerjaan lain (jangan disatukan/disentuh).
 */
import { useEffect, useState } from 'react'
import type { AgregatBroker, HariBroker } from './brokerEmiten'
import { muatRentang } from './brokerEmiten'
import { pesanGalat } from '../pesanGalat'

export interface BarisOhlcv {
  tanggal: string
  tutup: number
  volume: number
  nilai: number
}

interface BerkasOhlcvMentah {
  kode: string
  kolom: readonly string[]
  bar: (string | number)[][]
}

/** Indeks kolom tetap (lihat `kolom` di berkas) — tanggal, close, volume, value. */
function keBaris(bar: (string | number)[]): BarisOhlcv {
  return { tanggal: bar[0] as string, tutup: bar[5] as number, volume: bar[6] as number, nilai: bar[7] as number }
}

const cacheOhlcv = new Map<string, Promise<BarisOhlcv[] | null>>()

/** Muat + cache OHLCV satu emiten (modul-level — dipakai ulang antar kunjungan panel). */
export function muatOhlcv(kode: string): Promise<BarisOhlcv[] | null> {
  let p = cacheOhlcv.get(kode)
  if (!p) {
    p = fetch(`/data-idx/json/ohlcv_stockbit/${kode}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<BerkasOhlcvMentah>) : null))
      .then((j) => (j ? j.bar.map(keBaris) : null))
    cacheOhlcv.set(kode, p)
  }
  return p
}

export function useOhlcvEmiten(kode: string) {
  const [bars, setBars] = useState<BarisOhlcv[] | null>(null)
  useEffect(() => {
    let batal = false
    setBars(null)
    muatOhlcv(kode).then((b) => { if (!batal) setBars(b) })
    return () => { batal = true }
  }, [kode])
  return bars
}

/** Iris OHLCV ke rentang tanggal (inklusif) — bahan VWAP & overlay harga. */
export function irisOhlcv(bars: BarisOhlcv[], dari: string, sampai: string): BarisOhlcv[] {
  return bars.filter((b) => b.tanggal >= dari && b.tanggal <= sampai)
}

/** VWAP pasar (Σ nilai ÷ Σ volume) sepanjang baris yang diberikan — acuan sumbu Kuadran. */
export function vwapRentang(bars: BarisOhlcv[]): number | null {
  let nilai = 0
  let volume = 0
  for (const b of bars) { nilai += b.nilai; volume += b.volume }
  return volume ? nilai / volume : null
}

export interface TitikKuadran {
  broker: string
  /** Harga rata-rata broker (beli+jual gabung) ÷ VWAP − 1, dalam persen. */
  deltaVwapPct: number
  netNilai: number
  grossNilai: number
}

/**
 * Titik Kuadran: X = harga rata-rata broker vs VWAP (persen), Y = net value,
 * ukuran gelembung = nilai kotor (dua sisi) — definisi kita sendiri (belum
 * ada padanan Stockbit), lihat CLAUDE.md rancangan halaman. Broker tanpa
 * transaksi disaring; `vwap` null (OHLCV kosong) → larik kosong.
 */
export function titikKuadran(agg: AgregatBroker[], vwap: number | null): TitikKuadran[] {
  if (!vwap) return []
  const keluar: TitikKuadran[] = []
  for (const a of agg) {
    const grossLot = a.beliLot + a.jualLot
    const grossNilai = a.beliNilai + a.jualNilai
    if (!grossLot) continue
    const hargaBroker = grossNilai / (grossLot * 100)
    keluar.push({ broker: a.broker, deltaVwapPct: (hargaBroker / vwap - 1) * 100, netNilai: a.netNilai, grossNilai })
  }
  return keluar
}

export interface RingkasSB {
  /** Pembeli bersih, sudah terurut turun (agregatBroker sudah urut netNilai desc). */
  pembeli: AgregatBroker[]
  /** Penjual bersih, terurut dari yang paling negatif (Top 1 penjual). */
  penjual: AgregatBroker[]
  netVol: number
  netVal: number
  avg: number
  /** Σ netLot Top-n pembeli + Top-n penjual (gaya Stockbit: dua sisi sekaligus). */
  topLot: (n: number) => number
  topVal: (n: number) => number
}

/**
 * Baris ringkas "Pembeli − penjual" ala Stockbit (Top 1..5 + Average) — port
 * `renderRingkasSB()` di mockup, dari `AgregatBroker[]` murni (bukan DOM).
 */
export function ringkasSB(agg: AgregatBroker[]): RingkasSB {
  const pembeli = agg.filter((a) => a.netNilai > 0)
  const penjual = [...agg].filter((a) => a.netNilai < 0).sort((x, y) => x.netNilai - y.netNilai)
  const netVol = pembeli.reduce((s, a) => s + a.netLot, 0)
  const netVal = pembeli.reduce((s, a) => s + a.netNilai, 0)
  const avg = netVol ? netVal / (netVol * 100) : 0
  const topLot = (n: number) => pembeli.slice(0, n).reduce((s, a) => s + a.netLot, 0) + penjual.slice(0, n).reduce((s, a) => s + a.netLot, 0)
  const topVal = (n: number) => pembeli.slice(0, n).reduce((s, a) => s + a.netNilai, 0) + penjual.slice(0, n).reduce((s, a) => s + a.netNilai, 0)
  return { pembeli, penjual, netVol, netVal, avg, topLot, topVal }
}

/** N pembeli & penjual bersih terbesar (by |net value|) — bahan chip warna tab Inventory. */
export function pilihTopInventaris(agg: AgregatBroker[], n = 4): { pembeli: string[]; penjual: string[] } {
  const terurut = [...agg].sort((x, y) => y.netNilai - x.netNilai)
  const pembeli = terurut.filter((a) => a.netNilai > 0).slice(0, n).map((a) => a.broker)
  const penjual = terurut.filter((a) => a.netNilai < 0).slice(-n).map((a) => a.broker).reverse()
  return { pembeli, penjual }
}

/** Tahun-tahun yang punya berkas broker_tahunan untuk `kode` (dari index.json), atau `null` kalau belum dipanen. */
async function tahunTersedia(kode: string): Promise<number[] | null> {
  const r = await fetch(`/data-idx/json/broker_tahunan/${kode}/index.json`)
  // Server dev/statis di sini membalas 200 + index.html (fallback SPA) untuk
  // berkas yang TIDAK ada, bukan 404 — `r.ok` saja lolos untuk kode yang
  // belum dipanen, lalu `r.json()` gagal parse `<!DOCTYPE …` dengan pesan
  // teknis yang bocor ke layar. Content-type asli JSON `application/json`,
  // fallback-nya `text/html` — itu pembeda yang benar, bukan status code.
  if (!r.ok || !r.headers.get('content-type')?.includes('json')) return null
  const j = (await r.json()) as { tahun: number[] }
  return j.tahun?.length ? j.tahun : null
}

/**
 * Muat SELURUH riwayat broker satu emiten sekali per pergantian kode (bukan
 * per pergantian rentang) — geser rentang di halaman lalu tinggal MENYARING
 * larik ini di klien, bukan fetch ulang. Reuse penuh `muatRentang()`
 * (brokerEmiten.ts) supaya logika ambil-per-tahun tak ditulis dua kali.
 */
export function useArusBrokerEmiten(kode: string) {
  const [hari, setHari] = useState<Array<[string, HariBroker]> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let batal = false
    setLoading(true)
    setError(null)
    setHari(null)
    tahunTersedia(kode)
      .then((tahun) => {
        if (!tahun) throw new Error(`${kode} belum punya arsip broker per emiten`)
        return muatRentang(kode, `${Math.min(...tahun)}-01-01`, `${Math.max(...tahun)}-12-31`)
      })
      .then((h) => { if (!batal) setHari(h) })
      .catch((e: unknown) => { if (!batal) setError(pesanGalat(e, 'Gagal memuat data broker')) })
      .finally(() => { if (!batal) setLoading(false) })
    return () => { batal = true }
  }, [kode])

  return { hari: hari ?? [], loading, error }
}
