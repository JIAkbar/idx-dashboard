/**
 * Neo Papan — pemuat data, satu berkas per dataset, TANPA menjahit dua sumber.
 *
 * Pola sama dengan kuliPapanData.ts: cache Map per URL, kegagalan lokal
 * (satu sumber gagal tidak menjatuhkan tab lain), dan tiap fungsi murni
 * mengurai SATU berkas.
 */

const CACHE = new Map<string, Promise<unknown>>()

function ambil<T>(url: string): Promise<T | null> {
  let p = CACHE.get(url) as Promise<T | null> | undefined
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
      .catch(() => null)
    CACHE.set(url, p as Promise<unknown>)
  }
  return p
}

// ── OHLCV (candle/volume/asing) ───────────────────────────────────────────

export interface BarHarga {
  t: string
  o: number; h: number; l: number; c: number
  v: number
  val: number
  freq: number
  fb: number
  fs: number
  so: number
}

interface BerkasOhlcv { kolom: string[]; bar: number[][] }

export async function muatOhlcv(kode: string): Promise<BarHarga[] | null> {
  const f = await ambil<BerkasOhlcv>(`/data-idx/json/ohlcv_stockbit/${kode}.json`)
  if (!f) return null
  const ki = Object.fromEntries(f.kolom.map((k, i) => [k, i]))
  return f.bar.map((b) => ({
    t: String(b[ki.tanggal]), o: b[ki.open], h: b[ki.high], l: b[ki.low], c: b[ki.close],
    v: b[ki.volume], val: b[ki.value], freq: b[ki.frequency],
    fb: b[ki.foreignbuy], fs: b[ki.foreignsell], so: b[ki.shareoutstanding],
  }))
}

// ── Broker harian per emiten ───────────────────────────────────────────────

export interface RingkasBrokerHari {
  nBeli: number; nJual: number; totalLot: number; totalNilai: number; avg: number
  top1Pct: number; top3Pct: number; top5Pct: number; accdist: string; cocokVolume: number
}
export interface BarisBroker { kode: string; beliLot: number; beliNilai: number; jualLot: number; jualNilai: number }
export interface HariBroker { ringkas: RingkasBrokerHari | null; broker: BarisBroker[] }
export interface BrokerHarianEmiten {
  kode: string
  /** Panjang jendela hari yang ditanam di berkas — metadata, BUKAN batas keras
   *  yang boleh dianggap tetap: panen masih berjalan, jendelanya bisa melebar. */
  jendelaHari: number
  hari: Record<string, HariBroker>
}

interface RingkasRaw {
  n_beli: number; n_jual: number; total_lot: number; total_nilai: number; avg: number
  top1_pct: number; top3_pct: number; top5_pct: number; accdist: string; cocok_volume: number
}
interface HariRaw { ringkas: RingkasRaw | null; broker: Array<[string, number, number, number, number]> }
interface BerkasBrokerRaw { kode: string; jendela_hari: number; hari: Record<string, HariRaw> }

export async function muatBrokerHarian(kode: string): Promise<BrokerHarianEmiten | null> {
  const f = await ambil<BerkasBrokerRaw>(`/data-idx/json/broker_harian/${kode}.json`)
  if (!f) return null
  const hari: Record<string, HariBroker> = {}
  for (const [tgl, h] of Object.entries(f.hari)) {
    hari[tgl] = {
      ringkas: h.ringkas ? {
        nBeli: h.ringkas.n_beli, nJual: h.ringkas.n_jual, totalLot: h.ringkas.total_lot,
        totalNilai: h.ringkas.total_nilai, avg: h.ringkas.avg,
        top1Pct: h.ringkas.top1_pct, top3Pct: h.ringkas.top3_pct, top5Pct: h.ringkas.top5_pct,
        accdist: h.ringkas.accdist, cocokVolume: h.ringkas.cocok_volume,
      } : null,
      broker: (h.broker || []).map(([kd, beliLot, beliNilai, jualLot, jualNilai]) => ({
        kode: kd, beliLot, beliNilai, jualLot, jualNilai,
      })),
    }
  }
  return { kode: f.kode, jendelaHari: f.jendela_hari, hari }
}

/** Daftar kode emiten resmi (jumlah saham dari bursa) — satu-satunya sumber
 *  universe lengkap yang kita punya (dipakai juga sinkron_emiten.py). */
export async function muatDaftarKode(): Promise<string[]> {
  const f = await ambil<{ emiten: Array<{ kode: string }> }>('/data-idx/json/daftar_emiten.json')
  return (f?.emiten ?? []).map((e) => e.kode)
}

/**
 * Broker harian SELURUH emiten yang punya arsip — dipakai Broker Stalker.
 * Panen 2026 masih berjalan (lihat CLAUDE.md), jadi hasilnya SELALU parsial;
 * pemanggil wajib menyatakan cakupannya di layar, bukan diam-diam.
 * Cache modul: sekali diambil per sesi tab (963 percobaan fetch, sisanya 404
 * lokal — biaya jaringan statis, bukan API berbayar).
 */
let cacheSemua: Promise<Map<string, BrokerHarianEmiten>> | null = null
export function muatBrokerSemua(): Promise<Map<string, BrokerHarianEmiten>> {
  if (!cacheSemua) {
    cacheSemua = muatDaftarKode().then(async (kodes) => {
      const pasangan = await Promise.all(kodes.map(async (k) => [k, await muatBrokerHarian(k)] as const))
      const hasil = new Map<string, BrokerHarianEmiten>()
      for (const [k, d] of pasangan) if (d) hasil.set(k, d)
      return hasil
    })
  }
  return cacheSemua
}

// ── Kepemilikan KSEI (Balance Position) ────────────────────────────────────

export interface Kepemilikan {
  kolom: string[]
  /** Kode jenis investor (mis. "IS") -> nama ("asuransi"). */
  jenis: Record<string, string>
  /** Tanggal bulanan "YYYY-MM-DD" -> baris angka, urutan sesuai `kolom`. */
  bulan: Record<string, number[]>
}

export async function muatKepemilikan(kode: string): Promise<Kepemilikan | null> {
  return ambil<Kepemilikan>(`/data-idx/json/kepemilikan/${kode}.json`)
}

// ── Keanggotaan indeks (Sector/Index Activity) ─────────────────────────────

export async function muatIndeksEmiten(kode: string): Promise<string[]> {
  const f = await ambil<{ indexes?: string[] }>(`/data-idx/json/info_stockbit/${kode}.json`)
  return f?.indexes ?? []
}
