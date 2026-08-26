/**
 * Pemuat data halaman Kuli Papan — satu berkas per dataset, tanpa jahitan.
 *
 * Tiap sumber berdiri sendiri dan kegagalannya lokal: kalau antrean penutupan
 * tak ada, kalkulatornya tetap jalan dengan isian manual; kalau P/B tahunan
 * tak ada, halamannya MENGATAKAN begitu alih-alih menampilkan nol.
 */

export interface Antrean {
  bid: number
  bidLot: number
  offer: number
  offerLot: number
  close: number
  prev: number
}

export interface BrokerHari {
  tanggal: string
  /** [kode, beliLot, beliNilai, jualLot, jualNilai] */
  broker: Array<[string, number, number, number, number]>
}

export interface Fundamental {
  bvps: number | null
  pbvKini: number | null
  /** P/B per tahun buku; kosong untuk emiten yang belum tercakup. */
  pbTahunan: Record<string, number>
  /** Alasan pbTahunan kosong, untuk ditulis apa adanya di layar. */
  alasanPbKosong: string | null
}

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

interface BerkasAntrean {
  tanggal: string
  d: Record<string, [number, number, number, number, number, number]>
}

export async function muatAntrean(kode: string): Promise<{ tanggal: string; a: Antrean } | null> {
  const f = await ambil<BerkasAntrean>('/data-idx/json/bidoffer.json')
  const r = f?.d?.[kode]
  if (!r) return null
  return {
    tanggal: f!.tanggal,
    a: { bid: r[0], bidLot: r[1], offer: r[2], offerLot: r[3], close: r[4], prev: r[5] },
  }
}

interface BerkasBroker {
  hari: Record<string, { broker: Array<[string, number, number, number, number]> }>
}

/** Hari bursa TERAKHIR yang punya rincian broker; null kalau emiten belum dipanen. */
export async function muatBrokerTerakhir(kode: string): Promise<BrokerHari | null> {
  const f = await ambil<BerkasBroker>(`/data-idx/json/broker_harian/${kode}.json`)
  const hari = f?.hari
  if (!hari) return null
  const tgl = Object.keys(hari).sort().pop()
  if (!tgl) return null
  return { tanggal: tgl, broker: hari[tgl].broker || [] }
}

interface BerkasKeystats {
  rasio?: Record<string, unknown>
}
interface BerkasValuasi {
  emiten?: Record<string, { pb?: Record<string, number> }>
  /** Alasan per-kode kenapa deret P/B kosong — DITULIS skrip valuasi, bukan
   *  ditebak di sini. Dulu satu teks generik menyalahkan mata uang untuk
   *  semua yang kosong, padahal terukur 10/14 sampel tak punya laporan sama
   *  sekali dan 5 lainnya rugi/ekuitas negatif (audit 26 Agu 1.5). */
  alasan_pb?: Record<string, string>
}

const TEKS_ALASAN_PB: Record<string, string> = {
  tak_ada_laporan: 'laporan keuangan tahunannya belum ada di arsip PAPAN.',
  tanpa_saham: 'jumlah saham tercatatnya belum ada di arsip.',
  tanpa_harga: 'riwayat harganya belum ada di arsip.',
  non_idr: 'laporan keuangannya dalam mata uang selain rupiah, dan konversinya belum diputuskan.',
  ekuitas_negatif: 'ekuitasnya negatif di semua tahun yang tersedia — P/B tak bermakna.',
  rasio_ekstrem: 'rasionya di luar batas wajar di semua tahun yang tersedia (harga sangat jauh dari nilai buku).',
  tak_ada_periode: 'berkas laporannya ada tapi tak berisi satu pun periode tahunan.',
}

/** Angka rasio keystats bisa datang sebagai teks; kembalikan null bukan NaN. */
function angka(v: unknown): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) && n !== 0 ? n : null
}

export async function muatFundamental(kode: string): Promise<Fundamental> {
  const [ks, val] = await Promise.all([
    ambil<BerkasKeystats>(`/data-idx/json/keystats_stockbit/${kode}.json`),
    ambil<BerkasValuasi>('/data-idx/json/valuasi_historis.json'),
  ])
  const r = ks?.rasio || {}
  const pbTahunan = val?.emiten?.[kode]?.pb || {}
  return {
    bvps: angka(r['Current Book Value Per Share']),
    pbvKini: angka(r['Current Price to Book Value']),
    pbTahunan,
    alasanPbKosong: Object.keys(pbTahunan).length
      ? null
      : val
        ? `P/B tahunan belum tersedia untuk emiten ini — ${TEKS_ALASAN_PB[val.alasan_pb?.[kode] ?? ''] ?? 'penyebabnya belum tercatat di arsip.'} Isi band-nya manual.`
        : 'Data valuasi tahunan gagal dimuat.',
  }
}

/** Rata-rata P/B tahunan; null kalau tak ada satu tahun pun. */
export function rataPb(pbTahunan: Record<string, number>): number | null {
  const v = Object.values(pbTahunan).filter((x) => Number.isFinite(x) && x > 0)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}
