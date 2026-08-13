import { useCallback, useEffect, useState } from 'react'
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
  const arr: BrokerRow[] = file.brokers
    .map((b) => ({ kode: b.kode, nama: b.nama, vol: b.vol, nilai: b.val, freq: b.frek, rn: 0, rf: 0 }))
    .sort((a, b) => b.nilai - a.nilai)
  arr.forEach((b, i) => { b.rn = i + 1 })
  const byFreq = [...arr].sort((a, b) => b.freq - a.freq)
  byFreq.forEach((b, i) => { b.rf = i + 1 })
  return arr
}

/** Cache di memori per-tanggal — pindah tanggal balik lagi tidak fetch ulang (pola dataHarian.ts). */
const cache = new Map<string, BrokerRow[]>()

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const pilihTanggal = useCallback((iso: string) => {
    setTanggalAktif(iso)
    setError(null)

    const cached = cache.get(iso)
    if (cached) {
      setRows(cached)
      setLoading(false)
      return
    }

    setLoading(true)
    fetch(`/data-idx/json/broker/${stemDariIso(iso)}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<BrokerHarianFile>
      })
      .then((file) => {
        const converted = keBrokerRows(file)
        cache.set(iso, converted)
        setRows(converted)
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

  return { tanggalTersedia, tanggalAktif, rows, pilihTanggal, loading, error }
}
