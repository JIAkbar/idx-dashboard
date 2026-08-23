/**
 * Neo Papan — rumus murni (tanpa React, tanpa fetch), dipisah dari tampilan
 * supaya bisa diuji lepas dari komponen. Pola sama dengan kuliPapan.ts.
 */
import type { BarHarga, BrokerHarianEmiten, HariBroker } from './neoPapanData'

// ── Broker: agregasi satu emiten pada satu rentang tanggal ─────────────────

export interface AgregatBroker {
  kode: string
  beliLot: number; beliNilai: number; jualLot: number; jualNilai: number
  net: number
}

/** Jumlahkan baris broker satu emiten pada daftar tanggal terpilih. */
export function agregasiBroker(hari: Record<string, HariBroker>, tanggal: string[]): AgregatBroker[] {
  const acc = new Map<string, { beliLot: number; beliNilai: number; jualLot: number; jualNilai: number }>()
  for (const t of tanggal) {
    const h = hari[t]
    if (!h) continue
    for (const b of h.broker) {
      const a = acc.get(b.kode) ?? { beliLot: 0, beliNilai: 0, jualLot: 0, jualNilai: 0 }
      a.beliLot += b.beliLot; a.beliNilai += b.beliNilai
      a.jualLot += b.jualLot; a.jualNilai += b.jualNilai
      acc.set(b.kode, a)
    }
  }
  return [...acc.entries()].map(([kode, a]) => ({ kode, ...a, net: a.beliNilai - a.jualNilai }))
}

/** Rata-rata harga beli/jual satu broker — sama polanya dengan avgBeli Kuli Papan. */
export function avgHarga(nilai: number, lot: number): number | null {
  return lot ? nilai / (lot * 100) : null
}

/** Kumulatif net nilai per broker terpilih, satu titik per hari (Inventory Chart). */
export function kumulatifBroker(
  hariUrut: string[], hari: Record<string, HariBroker>, kodeBroker: string[],
): { tanggal: string[]; seri: Array<{ broker: string; nilai: number[] }> } {
  const run = new Map(kodeBroker.map((k) => [k, 0]))
  const seri = new Map<string, number[]>(kodeBroker.map((k) => [k, []]))
  for (const t of hariUrut) {
    const h = hari[t]
    const byKode = new Map<string, number>()
    if (h) for (const b of h.broker) byKode.set(b.kode, b.beliNilai - b.jualNilai)
    for (const k of kodeBroker) {
      run.set(k, (run.get(k) ?? 0) + (byKode.get(k) ?? 0))
      seri.get(k)!.push(run.get(k)!)
    }
  }
  return { tanggal: hariUrut, seri: kodeBroker.map((k) => ({ broker: k, nilai: seri.get(k)! })) }
}

/** N net buyer & N net seller terbesar dari daftar agregat. */
export function topNet(agg: AgregatBroker[], n: number): { pembeli: AgregatBroker[]; penjual: AgregatBroker[] } {
  const urut = [...agg].sort((a, b) => b.net - a.net)
  return { pembeli: urut.slice(0, n), penjual: urut.slice(-n).reverse() }
}

// ── Broker Stalker: lintas emiten ──────────────────────────────────────────

export interface BarisStalker {
  emiten: string
  net: number; beli: number; jual: number
  bavg: number | null; savg: number | null
  /** Berapa dari hari jendela yang benar-benar ada arsipnya untuk emiten ini. */
  cakupanHari: number
}

/** Kalender gabungan tanggal broker dari SELURUH emiten yang dipunya (union, terurut naik). */
export function kalenderBrokerHarian(perEmiten: Map<string, BrokerHarianEmiten>): string[] {
  const set = new Set<string>()
  for (const e of perEmiten.values()) for (const t of Object.keys(e.hari)) set.add(t)
  return [...set].sort()
}

export interface HasilStalker {
  jendela: string[]
  netBuy: BarisStalker[]
  netSell: BarisStalker[]
}

/**
 * Σ nilai beli/jual broker terpilih per emiten, pada N hari bursa terakhir
 * dari kalender gabungan. `cakupanHari` per baris memberitahu kalau arsip
 * emiten itu belum menutupi seluruh jendela — dipakai layar untuk menandai
 * baris yang datanya sebagian, bukan menampilkannya seolah lengkap.
 */
export function stalkerAgregasi(
  perEmiten: Map<string, BrokerHarianEmiten>, brokerTerpilih: string[], n: number,
): HasilStalker {
  const kalender = kalenderBrokerHarian(perEmiten)
  const jendela = kalender.slice(-n)
  const pilih = new Set(brokerTerpilih)
  const rows: BarisStalker[] = []
  for (const [emiten, data] of perEmiten) {
    let beli = 0, jual = 0, beliLot = 0, jualLot = 0, cakupan = 0
    for (const t of jendela) {
      const h = data.hari[t]
      if (!h) continue
      cakupan++
      for (const b of h.broker) {
        if (!pilih.has(b.kode)) continue
        beli += b.beliNilai; jual += b.jualNilai
        beliLot += b.beliLot; jualLot += b.jualLot
      }
    }
    if (beli || jual) {
      rows.push({ emiten, net: beli - jual, beli, jual, bavg: avgHarga(beli, beliLot), savg: avgHarga(jual, jualLot), cakupanHari: cakupan })
    }
  }
  return {
    jendela,
    netBuy: rows.filter((r) => r.net > 0).sort((a, b) => b.net - a.net),
    netSell: rows.filter((r) => r.net < 0).sort((a, b) => a.net - b.net),
  }
}

/** Kode broker unik yang muncul di broker_harian satu emiten — dipakai isi chip pemilih. */
export function kodeBrokerUnik(perEmiten: Map<string, BrokerHarianEmiten>): string[] {
  const set = new Set<string>()
  for (const e of perEmiten.values()) for (const h of Object.values(e.hari)) for (const b of h.broker) set.add(b.kode)
  return [...set].sort()
}

// ── Rotation Chart: RS-Ratio / RS-Momentum (z-score bergerak) ──────────────

/**
 * Z-score bergerak jendela N — pendekatan RRG, BUKAN rumus JdK resmi.
 * `pstdev` (populasi, bukan sampel): dibagi n, bukan n-1 — sama seperti
 * `statistics.pstdev` Python yang dipakai prototipe.
 */
export function zScoreBergerak(xs: number[], n: number): number[] {
  const out: number[] = []
  for (let i = 0; i < xs.length; i++) {
    const w = xs.slice(Math.max(0, i - n + 1), i + 1)
    const m = w.reduce((a, b) => a + b, 0) / w.length
    const variansi = w.length > 1 ? w.reduce((a, b) => a + (b - m) ** 2, 0) / w.length : 0
    const sd = Math.sqrt(variansi)
    out.push(100 + (sd ? (xs[i] - m) / sd : 0))
  }
  return out
}

/** RS-Ratio = z-score(RS), RS-Momentum = z-score(RS-Ratio). `rs` = 100 × harga grup ÷ harga acuan. */
export function rsRatioMomentum(rs: number[], n: number): { rsRatio: number[]; rsMomentum: number[] } {
  const rsRatio = zScoreBergerak(rs, n)
  const rsMomentum = zScoreBergerak(rsRatio, n)
  return { rsRatio, rsMomentum }
}

// ── Sector/Index Activity: porsi nilai transaksi bergerak ─────────────────

/** Porsi nilai grup terhadap total sampel, rata-rata bergerak `ma` hari. */
export function porsiBergerak(nilaiGrup: number[], nilaiTotal: number[], ma = 20): number[] {
  const share = nilaiGrup.map((v, i) => (nilaiTotal[i] ? v / nilaiTotal[i] : 0))
  return share.map((_, i) => {
    const w = share.slice(Math.max(0, i - ma + 1), i + 1)
    return w.reduce((a, b) => a + b, 0) / w.length
  })
}

// ── Seasonality: pola hari & bulan ─────────────────────────────────────────

export interface StatMusiman {
  naikPersen: number | null
  turunPersen: number | null
  ekspektasiPersen: number | null
  n: number
}

function statMusiman(xs: number[]): StatMusiman {
  if (!xs.length) return { naikPersen: null, turunPersen: null, ekspektasiPersen: null, n: 0 }
  const naik = (xs.filter((x) => x > 0).length / xs.length) * 100
  const turun = (xs.filter((x) => x < 0).length / xs.length) * 100
  const exp = (xs.reduce((a, b) => a + b, 0) / xs.length) * 100
  return { naikPersen: Math.round(naik * 10) / 10, turunPersen: Math.round(turun * 10) / 10, ekspektasiPersen: Math.round(exp * 100) / 100, n: xs.length }
}

/** Hari kalender -> return harian, dibucket ke 5 hari kerja (Senin..Jumat), 12 tahun terakhir. */
export function musimanHari(bars: BarHarga[]): StatMusiman[] {
  if (bars.length < 2) return Array.from({ length: 5 }, () => statMusiman([]))
  const batas = tahunSebelum(bars[bars.length - 1].t, 12)
  const per: number[][] = [[], [], [], [], []]
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1], cur = bars[i]
    if (cur.t < batas || !prev.c) continue
    const wd = weekdayUtc(cur.t)
    if (wd >= 1 && wd <= 5) per[wd - 1].push(cur.c / prev.c - 1)
  }
  return per.map(statMusiman)
}

/** Return penutupan akhir bulan, dibucket per bulan kalender (Jan..Des), 12 tahun terakhir. */
export function musimanBulan(bars: BarHarga[]): StatMusiman[] {
  if (bars.length < 2) return Array.from({ length: 12 }, () => statMusiman([]))
  const akBulan = new Map<string, number>()
  for (const b of bars) akBulan.set(b.t.slice(0, 7), b.c)
  const kunci = [...akBulan.keys()].sort()
  const batas = tahunSebelum(bars[bars.length - 1].t, 12).slice(0, 7)
  const per: number[][] = Array.from({ length: 12 }, () => [])
  for (let i = 1; i < kunci.length; i++) {
    const ym = kunci[i]
    if (ym < batas) continue
    const prev = akBulan.get(kunci[i - 1])!
    const cur = akBulan.get(ym)!
    if (!prev) continue
    const bulan = Number(ym.slice(5, 7))
    per[bulan - 1].push(cur / prev - 1)
  }
  return per.map(statMusiman)
}

/** Tanggal ISO `n` tahun sebelum `iso` — dipakai HANYA untuk memotong deret
 *  historis yang sudah tersimpan (bukan "hari ini"), jadi bukan kasus yang
 *  diatur lib/tanggalBursa.ts. UTC supaya tidak bergeser sehari oleh zona
 *  waktu peramban. */
function tahunSebelum(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y - n, m - 1, d))
  return dt.toISOString().slice(0, 10)
}

/** 1=Senin .. 5=Jumat, 6=Sabtu, 0=Minggu — dari tanggal ISO, UTC murni. */
function weekdayUtc(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

// ── util kecil dipakai lintas tab ──────────────────────────────────────────

export function moneyFlowAsing(b: BarHarga): number {
  return b.fb - b.fs
}

// ── Kandidat sampel per sektor (Rotation Chart & Sector Activity) ─────────

/**
 * Mengunduh OHLCV seluruh ~960 emiten di peramban untuk membangun indeks
 * sektor sungguhan tidak masuk akal (lihat catatan NeoPapan.tsx) — jadi
 * Rotation/Activity dihitung dari SAMPEL emiten paling likuid per sektor,
 * diambil dari data yang sudah dipakai Screener (`nilai` = nilai transaksi
 * hari terakhir). Halaman WAJIB menyatakan ini sampel, bukan seluruh pasar.
 */
export function pilihKandidatSektor(
  baris: Array<{ kode: string; sektor: string; nilai: number | null }>, perSektor: number,
): Record<string, string[]> {
  const bySektor = new Map<string, Array<{ kode: string; nilai: number }>>()
  for (const b of baris) {
    if (!b.sektor || !b.nilai) continue
    const arr = bySektor.get(b.sektor) ?? []
    arr.push({ kode: b.kode, nilai: b.nilai })
    bySektor.set(b.sektor, arr)
  }
  const hasil: Record<string, string[]> = {}
  for (const [sektor, arr] of bySektor) {
    hasil[sektor] = arr.sort((a, b) => b.nilai - a.nilai).slice(0, perSektor).map((x) => x.kode)
  }
  return hasil
}
