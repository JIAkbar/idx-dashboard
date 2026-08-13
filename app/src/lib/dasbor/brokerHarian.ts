import { useCallback, useEffect, useRef, useState } from 'react'
import type { BrokerRow } from './brokerSummaryData'

/** Baris mentah bs_YYMMDD.json (harvester harian idx.co.id). */
interface BrokerHarianRaw {
  kode: string
  nama: string
  vol: number
  val: number
  frek: number
}

interface BrokerHarianFile {
  date_iso: string
  n_broker: number
  brokers: BrokerHarianRaw[]
}

/** "2026-08-12" → "bs_260812" (nama file harvester). */
function stemDariIso(iso: string): string {
  return 'bs_' + iso.slice(2).replace(/-/g, '')
}

const BULAN_PENDEK = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** "2026-08-12" → "12 Agu 2026". */
export function labelTanggal(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${BULAN_PENDEK[m] ?? m} ${y}`
}

/**
 * Konversi baris mentah → BrokerRow (tipe yang sudah dipakai Inventory/
 * Quadrant): val→nilai, frek→freq, plus rank ganda rn (by nilai, juga urutan
 * array) dan rf (by frekuensi) — logika rank sama dengan bsAggBrokers() lama
 * (brokerSummaryAgg.ts, dihapus bersama migrasi ke data harian).
 */
function keBrokerRows(file: BrokerHarianFile): BrokerRow[] {
  return rankRows(
    file.brokers.map((b) => ({ kode: b.kode, nama: b.nama, vol: b.vol, nilai: b.val, freq: b.frek, rn: 0, rf: 0 })),
  )
}

/** Urut by nilai turun + isi rank ganda rn (nilai) & rf (frekuensi) — dipakai
 * baris harian maupun agregat rentang. */
function rankRows(arr: BrokerRow[]): BrokerRow[] {
  arr.sort((a, b) => b.nilai - a.nilai)
  arr.forEach((b, i) => { b.rn = i + 1 })
  const byFreq = [...arr].sort((a, b) => b.freq - a.freq)
  byFreq.forEach((b, i) => { b.rf = i + 1 })
  return arr
}

/**
 * Agregat rentang (#75): SUM vol/nilai/freq per broker sepanjang hari-berdata,
 * lalu ranking ulang atas totalnya. Broker yang tidak muncul di sebagian hari
 * tetap ikut (jumlah dari hari-hari dia ada). Ekspor untuk unit test.
 */
export function agregatBrokerRows(perHari: BrokerRow[][]): BrokerRow[] {
  const m = new Map<string, BrokerRow>()
  for (const rows of perHari) {
    for (const b of rows) {
      const t = m.get(b.kode)
      if (t) {
        t.vol += b.vol
        t.nilai += b.nilai
        t.freq += b.freq
      } else {
        m.set(b.kode, { ...b })
      }
    }
  }
  return rankRows([...m.values()])
}

/** Cache di memori per-tanggal — pindah tanggal balik lagi tidak fetch ulang (pola dataHarian.ts). */
const cache = new Map<string, BrokerRow[]>()

/** Fetch baris broker satu tanggal lewat cache modul — dipakai mode rentang. */
function fetchBrokerRows(iso: string): Promise<BrokerRow[]> {
  const c = cache.get(iso)
  if (c) return Promise.resolve(c)
  return fetch(`/data-idx/json/broker/${stemDariIso(iso)}.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<BrokerHarianFile>
    })
    .then((file) => {
      const rows = keBrokerRows(file)
      cache.set(iso, rows)
      return rows
    })
}

/** Rentang aktif mode agregat broker — kedua ujung sudah snap ke hari berdata. */
export interface BrokerRentangAktif {
  mulai: string
  akhir: string
  nHari: number
}

/**
 * Hook data broker summary harian: /data-idx/json/broker/index.json (daftar
 * tanggal, nambah harian dari harvester) → bs_YYMMDD.json per tanggal
 * terpilih. Default tanggal terbaru. Pola fetch/cache sama dengan
 * useDataHarian (dataHarian.ts).
 */
export function useBrokerHarian() {
  const [tanggalTersedia, setTanggalTersedia] = useState<string[]>([])
  const [tanggalAktif, setTanggalAktif] = useState<string | null>(null)
  const [rows, setRows] = useState<BrokerRow[] | null>(null)
  const [rentang, setRentang] = useState<BrokerRentangAktif | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Daftar tanggal juga disimpan di ref supaya pilihRentang (useCallback tanpa
  // dependensi) bisa membacanya tanpa side-effect di dalam updater state.
  const tersediaRef = useRef<string[]>([])

  const pilihTanggal = useCallback((iso: string) => {
    setTanggalAktif(iso)
    setRentang(null)
    setError(null)

    const cached = cache.get(iso)
    if (cached) {
      setRows(cached)
      setLoading(false)
      return
    }

    setLoading(true)
    fetchBrokerRows(iso)
      .then(setRows)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Gagal memuat data broker')
        setRows(null)
      })
      .finally(() => setLoading(false))
  }, [])

  /**
   * Mode rentang (#75): fetch semua bs_YYMMDD.json hari-berdata di [mulai,
   * akhir] (paralel, reuse cache) lalu agregat SUM per broker. `mulai` boleh
   * tanggal kalender (target preset) — otomatis snap ke hari berdata.
   */
  const pilihRentang = useCallback((mulai: string, akhir: string) => {
    const dalam = tersediaRef.current.filter((iso) => iso >= mulai && iso <= akhir)
    if (dalam.length === 0) {
      setError('Tidak ada hari berdata di rentang ini')
      return
    }
    setError(null)
    setLoading(true)
    Promise.all(dalam.map(fetchBrokerRows))
      .then((perHari) => {
        setRows(agregatBrokerRows(perHari))
        setRentang({ mulai: dalam[0], akhir: dalam[dalam.length - 1], nHari: dalam.length })
        setTanggalAktif(dalam[dalam.length - 1])
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Gagal memuat data broker')
        setRows(null)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/data-idx/json/broker/index.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ dates?: string[] }>
      })
      .then((j) => {
        if (cancelled) return
        const dates = j.dates ?? []
        tersediaRef.current = dates
        setTanggalTersedia(dates)
        if (dates.length > 0) {
          pilihTanggal(dates[dates.length - 1])
        } else {
          setLoading(false)
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Gagal memuat index broker')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [pilihTanggal])

  return { tanggalTersedia, tanggalAktif, rows, rentang, pilihTanggal, pilihRentang, loading, error }
}
