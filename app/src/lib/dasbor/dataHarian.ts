import { useCallback, useEffect, useRef, useState } from 'react'

/** Satu baris data-idx/json/index.json → {dates:[...]}. Port field dari index_live.html baris 2390-2394. */
export interface TanggalIndex {
  stem: string
  date_iso: string
  date_id: string
  date_raw: string
  ihsg: number
  ihsg_pct: number
  trading_day: number
}

/** Satu baris tabel World (field `D.world`), lihat index_live.html baris 2740-2759. */
export interface WorldRow {
  r: string
  c: string
  idx: string
  v: number
  d: number
  ytd: number
  ra: number | string | null
  rap: number | string | null
  rw: number | string | null
  is_idx: boolean
}

/** Saham gainers/losers (field `D.gainers`/`D.losers`), index_live.html baris 2856-2864. */
export interface StockMoveRow {
  c: string
  pr: number
  td: number
  p: number
}

/** Saham leaders/laggards kontribusi IHSG (`D.leaders_today` dst), baris 2866-2884. */
export interface StockContribRow {
  c: string
  p: number
  ih: number
}

/** Top 10 market cap (`D.mcap`), baris 2840-2854. */
export interface McapRow {
  c: string
  v: number
  p: number
}

/** Top saham by volume/value/freq (`D.top_vol` dst), baris 2920-2922. */
export interface StockRankRow {
  c: string
  v: number
  p: number
}

/** Top broker by volume/value/freq (`D.broker_vol` dst), baris 2924-2927. */
export interface BrokerRankRow {
  cd: string
  nm: string
  v: number
  p: number
}

/** Baris sektor/indeks/board (`D.sectors`, `D.featured`, `D.sharia`, `D.board`), baris 2971-2985. */
export interface SectorRow {
  n: string
  v: number
  d: number
  ytd: number
}

/**
 * Data satu hari (data-idx/json/${stem}.json). Field yang dipakai panel World/Stocks/
 * Broker/Sector didaftar eksplisit; field lain lewat index signature supaya
 * tipe ini tidak perlu diubah tiap ada menu baru.
 */
export interface DataHarian {
  date_id: string
  trading_day: number
  ihsg_value: number
  ihsg_pct: number
  /**
   * Ringkasan halaman 1 PDF IDX (scripts/parse_idx_pdf.py baris 61-92).
   * Satuan: vol_today juta lembar, val_idr_today miliar IDR, freq_today ribu
   * kali, mcap_idr triliun IDR. Opsional karena parser bisa gagal cocok.
   *
   * `ihsg_change` sengaja TIDAK didaftarkan: ruas itu hanya ada di 55 dari 93
   * berkas harian, jadi pemakaiannya pasti berujung `?? 0` — pola bug yang
   * sama dengan `ihsg_ytd` (lihat ytd.ts). Perubahan harian dihitung dari
   * `ihsg_value - ihsg_prev`, dua ruas yang ada di seluruh 93 berkas.
   */
  ihsg_prev?: number
  ihsg_high?: number
  ihsg_low?: number
  vol_today?: number
  val_idr_today?: number
  freq_today?: number
  mcap_idr?: number
  world?: WorldRow[]
  avg_vol?: number
  avg_val_idr?: number
  avg_val_usd?: number
  avg_freq?: number
  nf_today_idr?: number
  nf_today_usd?: number
  nf_today_status?: string
  nf_ytd_idr?: number
  nf_ytd_usd?: number
  nf_ytd_status?: string
  mkt_per?: number
  mkt_pbv?: number
  usd_idr?: number
  gainers?: StockMoveRow[]
  losers?: StockMoveRow[]
  leaders_today?: StockContribRow[]
  leaders_ytd?: StockContribRow[]
  laggards_today?: StockContribRow[]
  laggards_ytd?: StockContribRow[]
  mcap?: McapRow[]
  top_val?: StockRankRow[]
  top_vol?: StockRankRow[]
  top_freq?: StockRankRow[]
  broker_vol?: BrokerRankRow[]
  broker_val?: BrokerRankRow[]
  broker_freq?: BrokerRankRow[]
  sectors?: SectorRow[]
  featured?: SectorRow[]
  sharia?: SectorRow[]
  board?: SectorRow[]
  [key: string]: unknown
}

/** Cache di memori per-stem — pindah tanggal balik lagi tidak fetch ulang. */
const cache = new Map<string, DataHarian>()

/**
 * Promise index.json di-cache di modul (satu request per sesi, pola sama
 * `daftarJenjang()` di lib/jenjang.ts) — dipakai SEMUA pemanggil
 * `useDataHarian` (PitaKurs & halaman aktif render bersamaan lewat DasborLayout
 * itu dua instance hook terpisah, dulu dua-duanya fetch index.json sendiri-
 * sendiri) plus `flowNego.ts`. `<link rel="preload">` di index.html menaruh
 * respons ini di HTTP cache sejak HTML dibaca; fetch tanpa opsi khusus di sini
 * cocok dengan preload (mode/credentials default = sama).
 */
let indexPromise: Promise<TanggalIndex[]> | null = null
export function fetchIndex(): Promise<TanggalIndex[]> {
  indexPromise ??= fetch('/data-idx/json/index.json')
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<{ dates?: TanggalIndex[] }>
    })
    .then((j) => j.dates ?? [])
  return indexPromise
}

/** Fetch satu berkas harian lewat cache modul — dipakai useDataRentang & flowNego.ts. */
export function fetchHari(stem: string): Promise<DataHarian> {
  const c = cache.get(stem)
  if (c) return Promise.resolve(c)
  return fetch(`/data-idx/json/${stem}.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<DataHarian>
    })
    .then((d) => {
      cache.set(stem, d)
      return d
    })
}

/** Batas fetch paralel mode rentang — YTD penuh (>130 berkas) ditolak jujur,
 * bukan diam-diam dipotong. */
export const MAKS_HARI_RENTANG = 60

/**
 * Mode rentang (#75): fetch semua berkas harian dalam rentang (paralel, reuse
 * cache modul). `tanggal` = slice hari-berdata di rentang (urut naik); []
 * berarti mode rentang tidak aktif. Guard >MAKS_HARI_RENTANG hari bursa →
 * error tanpa fetch. `selesai` = progres sederhana untuk label loading.
 */
export function useDataRentang(tanggal: TanggalIndex[]) {
  const [days, setDays] = useState<DataHarian[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [selesai, setSelesai] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Kunci efek: daftar stem — identitas array `tanggal` berubah tiap render
  // pemanggil (hasil filter), isinya yang dibandingkan.
  const kunci = tanggal.map((t) => t.stem).join(',')
  const ref = useRef(tanggal)
  ref.current = tanggal

  useEffect(() => {
    const t = ref.current
    if (t.length === 0) {
      setDays(null)
      setLoading(false)
      setError(null)
      return
    }
    if (t.length > MAKS_HARI_RENTANG) {
      setDays(null)
      setLoading(false)
      setError(`Rentang ${t.length} hari bursa terlalu panjang (maks ${MAKS_HARI_RENTANG})`)
      return
    }
    let cancelled = false
    let n = 0
    setLoading(true)
    setSelesai(0)
    setError(null)
    Promise.all(
      t.map((d) =>
        fetchHari(d.stem).then((x) => {
          n += 1
          if (!cancelled) setSelesai(n)
          return x
        }),
      ),
    )
      .then((all) => {
        if (!cancelled) setDays(all)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Gagal memuat data rentang')
          setDays(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [kunci])

  return { days, loading, selesai, total: tanggal.length, error }
}

/**
 * Hook data harian dasbor. Port loadIndex()/loadDay() index_live.html baris
 * 2390-2410 & 2664-2688 (tanpa bagian build*Panel — itu tanggung jawab tiap
 * view). Dipakai bersama menu World/Stocks/Broker/Sector.
 */
export function useDataHarian() {
  const [tanggalTersedia, setTanggalTersedia] = useState<TanggalIndex[]>([])
  const [tanggalAktif, setTanggalAktif] = useState<string | null>(null)
  const [hari, setHari] = useState<DataHarian | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const stemByIso = useRef(new Map<string, string>())

  const pilihTanggal = useCallback((iso: string) => {
    const stem = stemByIso.current.get(iso)
    if (!stem) return
    setTanggalAktif(iso)
    setError(null)

    const cached = cache.get(stem)
    if (cached) {
      setHari(cached)
      setLoading(false)
      return
    }

    setLoading(true)
    fetch(`/data-idx/json/${stem}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<DataHarian>
      })
      .then((data) => {
        cache.set(stem, data)
        setHari(data)
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Gagal memuat data')
        setHari(null)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchIndex()
      .then((dates) => {
        if (cancelled) return
        dates.forEach((d) => stemByIso.current.set(d.date_iso, d.stem))
        setTanggalTersedia(dates)
        if (dates.length > 0) {
          pilihTanggal(dates[dates.length - 1].date_iso)
        } else {
          setLoading(false)
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Gagal memuat index')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [pilihTanggal])

  return { tanggalTersedia, hari, tanggalAktif, pilihTanggal, loading, error }
}

/**
 * Data satu hari by stem, on-demand, TANPA mengubah tanggalAktif/hari
 * (state utama `useDataHarian`). Dipakai pemilih periode 1B/3B di tabel
 * sektor (SektorIndeks.tsx) yang butuh SATU berkas pembanding tambahan.
 * Pakai `cache` modul yang sama dengan `pilihTanggal` (bukan cache
 * terpisah) — pola sama dengan `useStockFundamental` di stockDetailData.ts.
 */
export function useDataPembanding(stem: string | null) {
  const [data, setData] = useState<DataHarian | null>(stem ? (cache.get(stem) ?? null) : null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!stem) {
      setData(null)
      return
    }
    const cached = cache.get(stem)
    if (cached) {
      setData(cached)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/data-idx/json/${stem}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<DataHarian>
      })
      .then((d) => {
        if (cancelled) return
        cache.set(stem, d)
        setData(d)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [stem])

  return { data, loading }
}
