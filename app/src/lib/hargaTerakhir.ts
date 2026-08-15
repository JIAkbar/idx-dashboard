/**
 * Ambil harga terakhir emiten — cadangan dua sumber dipakai bersama oleh
 * tab Avg Down & Pemulihan di Kalkulator.
 *
 * 1. Yahoo lewat proxy CORS — paling segar (delay ~15 menit), tapi lewat
 *    layanan pihak ketiga yang bisa membatasi atau memblokir kapan saja.
 *    Terbukti gagal di production untuk ANTM, 15 Agu 2026.
 * 2. Penutupan bulanan milik PAPAN sendiri (`/data-idx/json/harga_terakhir.json`)
 *    — statis, tak pernah gagal, tapi setua bulan terakhir panen.
 *
 * Parsing tiap sumber dipisah jadi fungsi murni (`ambilHargaDariYahoo`,
 * `ambilHargaDariLokal`) supaya bentuk JSON-nya bisa diuji tanpa jaringan.
 */

/** Bentuk minimal respons Yahoo chart yang dipakai — sisanya diabaikan. */
export interface YahooChartJson {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number; longName?: string; shortName?: string }
    }>
  }
}

/** Bentuk berkas cadangan lokal — penutupan bulanan per kode emiten. */
export interface HargaLokalJson {
  bulan: string
  harga: Record<string, number>
}

export interface HargaTerakhir {
  harga: number
  sumber: 'yahoo' | 'lokal'
  /** Nama emiten — hanya terisi dari Yahoo. */
  nama?: string
  /** Bulan penutupan — hanya terisi dari sumber lokal. */
  bulan?: string
}

export function ambilHargaDariYahoo(j: YahooChartJson): { harga: number; nama?: string } | null {
  const res = j?.chart?.result?.[0]
  const harga = res?.meta?.regularMarketPrice
  if (!harga || harga <= 0) return null
  return { harga, nama: res?.meta?.longName || res?.meta?.shortName }
}

export function ambilHargaDariLokal(j: HargaLokalJson, kode: string): { harga: number; bulan: string } | null {
  const harga = j?.harga?.[kode]
  if (!harga || harga <= 0) return null
  return { harga, bulan: j.bulan }
}

/**
 * Melempar Error kalau KEDUA sumber gagal, pesannya menyebut kode emitennya
 * — pemanggil tinggal menampilkan `e.message`, tak perlu menyusun ulang
 * pesan galat generik yang tak bilang apa yang sebenarnya gagal.
 */
export async function ambilHargaTerakhir(kode: string): Promise<HargaTerakhir> {
  try {
    const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${kode}.JK?interval=1d&range=1d`
    const r = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(yUrl)}`, {
      signal: AbortSignal.timeout(8000),
    })
    const j = (await r.json()) as YahooChartJson
    const hasil = ambilHargaDariYahoo(j)
    if (hasil) return { harga: hasil.harga, sumber: 'yahoo', nama: hasil.nama }
  } catch {
    /* jatuh ke cadangan di bawah */
  }
  try {
    const r = await fetch('/data-idx/json/harga_terakhir.json')
    const j = (await r.json()) as HargaLokalJson
    const hasil = ambilHargaDariLokal(j, kode)
    if (hasil) return { harga: hasil.harga, sumber: 'lokal', bulan: hasil.bulan }
  } catch {
    /* keduanya gagal, lempar di bawah */
  }
  throw new Error(`Harga ${kode} tak ditemukan di Yahoo maupun data lokal.`)
}
