/**
 * Broker Summary PER EMITEN — pemuat + agregator di atas berkas tahunan
 * `/data-idx/json/broker_tahunan/<KODE>/<TAHUN>.json` (dibangun
 * `scripts/bangun_broker_tahunan.py` dari arsip Stockbit GROSS harian).
 *
 * Jangan tertukar dengan `brokerHarian.ts` — itu broker level PASAR dari IDX
 * (`/data-idx/json/broker/`), tanpa emiten.
 *
 * Semua fungsi di sini murni (tanpa fetch) kecuali `muatRentang`, supaya bisa
 * diuji dengan fixture dan dipakai halaman mana pun — tabel dua sisi, kartu
 * arus, grafik kumulatif — tanpa tahu asal datanya.
 *
 * Satuan: lot (1 lot = 100 lembar), rupiah penuh, harga rata-rata rupiah.
 * Data yang ada HANYA pasar reguler, semua investor. Asing/nego belum dipanen
 * (lihat docs/desain-broker-summary.md) — jangan menurunkannya dari sini.
 */

/**
 * Kolom larik padat per broker, urutannya dari `panen_broker_harian.KOLOM`.
 * Tanpa avg: terukur 22 Agu 2026 (26.172 baris) avg Stockbit = nilai ÷ (lot×100)
 * sampai pembulatan rupiah, jadi diturunkan di sini — lebih teliti, berkas −38%.
 */
export const KOLOM_BROKER = ['broker', 'beli_lot', 'beli_nilai', 'jual_lot', 'jual_nilai'] as const

export type BarisBroker = [string, number, number, number, number]

/** Harga rata-rata rupiah per lembar dari nilai & lot; null kalau lot 0. */
export const hargaRata = (nilai: number, lot: number): number | null =>
  lot ? nilai / (lot * 100) : null

export interface RingkasHari {
  n_beli: number
  n_jual: number
  total_lot: number
  total_nilai: number
  avg: number | null
  top1_pct: number | null
  top3_pct: number | null
  top5_pct: number | null
  accdist: string | null
  /** Σ beli_lot×100 ÷ Volume IDX — 1,0 berarti hari itu lengkap. */
  cocok_volume: number | null
}

export interface HariBroker {
  ringkas: RingkasHari
  broker: BarisBroker[]
  /** Varian pasar ASING (net asing per broker) — cuma ada di hari yang sudah
   *  kena backfill (149/2318 hari BUMI per 22 Agu 2026). undefined = belum. */
  asing?: HariBroker
  /** Varian pasar NEGO — sama, backfill sedang berjalan. */
  nego?: HariBroker
}

export interface BerkasTahunan {
  kode: string
  tahun: number
  kolom: readonly string[]
  n_hari: number
  hari: Record<string, HariBroker>
}

/** Satu broker sesudah dijumlahkan lintas hari. */
export interface AgregatBroker {
  broker: string
  beliLot: number
  beliNilai: number
  jualLot: number
  jualNilai: number
  netLot: number
  netNilai: number
  /** Rata-rata tertimbang nilai÷lot÷100 — bukan rata-rata dari rata-rata. */
  beliAvg: number | null
  jualAvg: number | null
}

export type ModeTransaksi = 'net' | 'gross'

// ── Pemuat ──────────────────────────────────────────────────────────────────

export function tahunDalamRentang(dari: string, sampai: string): number[] {
  const a = Number(dari.slice(0, 4))
  const b = Number(sampai.slice(0, 4))
  const keluar: number[] = []
  for (let t = Math.min(a, b); t <= Math.max(a, b); t++) keluar.push(t)
  return keluar
}

/** Gabungkan beberapa berkas tahunan lalu iris ke rentang (inklusif). */
export function irisHari(
  berkas: BerkasTahunan[], dari: string, sampai: string,
): Array<[string, HariBroker]> {
  const semua: Array<[string, HariBroker]> = []
  for (const b of berkas) {
    for (const [tgl, h] of Object.entries(b.hari ?? {})) {
      if (tgl >= dari && tgl <= sampai) semua.push([tgl, h])
    }
  }
  semua.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0))
  return semua
}

/** Muat tahun-tahun yang disentuh rentang; tahun yang berkasnya tak ada dilewati. */
export async function muatRentang(
  kode: string, dari: string, sampai: string,
): Promise<Array<[string, HariBroker]>> {
  const berkas = await Promise.all(
    tahunDalamRentang(dari, sampai).map(async (t) => {
      const r = await fetch(`/data-idx/json/broker_tahunan/${kode}/${t}.json`)
      return r.ok ? ((await r.json()) as BerkasTahunan) : null
    }),
  )
  return irisHari(berkas.filter((b): b is BerkasTahunan => b !== null), dari, sampai)
}

// ── Agregasi ────────────────────────────────────────────────────────────────

/** Jumlahkan per broker lintas hari. Urut net nilai terbesar → terkecil. */
export function agregatBroker(hari: Array<[string, HariBroker]>): AgregatBroker[] {
  const per = new Map<string, AgregatBroker>()
  for (const [, h] of hari) {
    for (const r of h.broker) {
      const a = per.get(r[0]) ?? {
        broker: r[0], beliLot: 0, beliNilai: 0, jualLot: 0, jualNilai: 0,
        netLot: 0, netNilai: 0, beliAvg: null, jualAvg: null,
      }
      a.beliLot += r[1]; a.beliNilai += r[2]
      a.jualLot += r[3]; a.jualNilai += r[4]
      per.set(r[0], a)
    }
  }
  const keluar = [...per.values()]
  for (const a of keluar) {
    a.netLot = a.beliLot - a.jualLot
    a.netNilai = a.beliNilai - a.jualNilai
    a.beliAvg = a.beliLot ? a.beliNilai / (a.beliLot * 100) : null
    a.jualAvg = a.jualLot ? a.jualNilai / (a.jualLot * 100) : null
  }
  keluar.sort((x, y) => y.netNilai - x.netNilai)
  return keluar
}

export interface SisiTabel {
  broker: string
  lot: number
  nilai: number
  avg: number | null
}

/**
 * Dua kolom tabel ala Stockbit.
 * - `gross`: tiap broker muncul di sisi beli DAN jual dengan angka kotornya.
 * - `net`: broker hanya di satu sisi, angkanya selisih beli−jual; avg memakai
 *   sisi yang dominan.
 */
export function tabelDuaSisi(
  agg: AgregatBroker[], mode: ModeTransaksi,
): { beli: SisiTabel[]; jual: SisiTabel[] } {
  const beli: SisiTabel[] = []
  const jual: SisiTabel[] = []
  for (const a of agg) {
    if (mode === 'gross') {
      if (a.beliLot) beli.push({ broker: a.broker, lot: a.beliLot, nilai: a.beliNilai, avg: a.beliAvg })
      if (a.jualLot) jual.push({ broker: a.broker, lot: a.jualLot, nilai: a.jualNilai, avg: a.jualAvg })
    } else if (a.netNilai > 0) {
      beli.push({ broker: a.broker, lot: a.netLot, nilai: a.netNilai, avg: a.beliAvg })
    } else if (a.netNilai < 0) {
      jual.push({ broker: a.broker, lot: -a.netLot, nilai: -a.netNilai, avg: a.jualAvg })
    }
  }
  beli.sort((x, y) => y.nilai - x.nilai)
  jual.sort((x, y) => y.nilai - x.nilai)
  return { beli, jual }
}

export interface TitikKumulatif {
  tanggal: string
  /** broker → nilai (atau lot) net kumulatif sampai tanggal ini */
  nilai: Record<string, number>
}

/** Deret kumulatif net per broker — bahan grafik garis vs harga. */
export function kumulatifBroker(
  hari: Array<[string, HariBroker]>, brokers: string[], ukuran: 'nilai' | 'lot' = 'nilai',
): TitikKumulatif[] {
  const akum: Record<string, number> = Object.fromEntries(brokers.map((b) => [b, 0]))
  const pilih = new Set(brokers)
  const keluar: TitikKumulatif[] = []
  for (const [tgl, h] of hari) {
    for (const r of h.broker) {
      if (!pilih.has(r[0])) continue
      akum[r[0]] += ukuran === 'nilai' ? r[2] - r[4] : r[1] - r[3]
    }
    keluar.push({ tanggal: tgl, nilai: { ...akum } })
  }
  return keluar
}

export interface ArusHari {
  tanggal: string
  beliNilai: number
  jualNilai: number
  beliLot: number
  jualLot: number
  nBeli: number
  nJual: number
}

/** Arus harian pasar reguler (gross dua sisi) — bahan batang Market Flow. */
export function arusHarian(hari: Array<[string, HariBroker]>): ArusHari[] {
  return hari.map(([tgl, h]) => {
    let beliNilai = 0, jualNilai = 0, beliLot = 0, jualLot = 0
    for (const r of h.broker) {
      beliLot += r[1]; beliNilai += r[2]; jualLot += r[3]; jualNilai += r[4]
    }
    return { tanggal: tgl, beliNilai, jualNilai, beliLot, jualLot, nBeli: h.ringkas.n_beli, nJual: h.ringkas.n_jual }
  })
}

/**
 * Harga beli rata-rata tertimbang TERENDAH per broker dalam rentang —
 * definisi KITA untuk "floor price by broker". Belum diverifikasi sama
 * dengan definisi tradersaham; jangan diklaim setara sebelum diukur.
 */
export function floorPriceBroker(
  hari: Array<[string, HariBroker]>, minLot = 1,
): Array<{ broker: string; floor: number; tanggal: string; lot: number }> {
  const terendah = new Map<string, { floor: number; tanggal: string; lot: number }>()
  for (const [tgl, h] of hari) {
    for (const r of h.broker) {
      if (r[1] < minLot) continue
      const avg = hargaRata(r[2], r[1])
      if (avg === null) continue
      const ada = terendah.get(r[0])
      if (!ada || avg < ada.floor) terendah.set(r[0], { floor: avg, tanggal: tgl, lot: r[1] })
    }
  }
  return [...terendah.entries()]
    .map(([broker, v]) => ({ broker, ...v }))
    .sort((x, y) => x.floor - y.floor)
}
