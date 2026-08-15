import { useCallback, useEffect, useRef, useState } from 'react'
import type { BrokerRow } from './brokerSummaryData'
import { pesanGalat } from '../pesanGalat'

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
  // Progres mode rentang (#79C): rentang panjang (ratusan bs_*.json) dimuat
  // batch — UI menampilkan "Memuat n/N hari" alih-alih membeku diam.
  const [selesai, setSelesai] = useState(0)
  const [total, setTotal] = useState(0)
  // Daftar tanggal juga disimpan di ref supaya pilihRentang (useCallback tanpa
  // dependensi) bisa membacanya tanpa side-effect di dalam updater state.
  const tersediaRef = useRef<string[]>([])
  // Penanda request terakhir — pindah pilihan saat fetch rentang masih jalan
  // membuat hasil basi dibuang, bukan menimpa state pilihan baru.
  const reqRef = useRef(0)

  const pilihTanggal = useCallback((iso: string) => {
    reqRef.current += 1
    setTanggalAktif(iso)
    setRentang(null)
    setError(null)
    setTotal(0)

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
        setError(pesanGalat(e, 'Gagal memuat data broker'))
        setRows(null)
      })
      .finally(() => setLoading(false))
  }, [])

  /**
   * Mode rentang (#75, diperluas #79C — rentang TIDAK dibatasi, data 750 hari
   * bursa): fetch bs_YYMMDD.json hari-berdata di [mulai, akhir] per batch
   * 16 request (bukan Promise.all ratusan sekaligus) sambil melaporkan
   * progres, lalu agregat SUM per broker. `mulai`/`akhir` boleh tanggal
   * kalender (target preset) — otomatis snap ke hari berdata. Cache modul
   * membuat rentang yang beririsan tidak fetch ulang.
   */
  const pilihRentang = useCallback((mulai: string, akhir: string) => {
    const [a, b] = mulai <= akhir ? [mulai, akhir] : [akhir, mulai]
    const dalam = tersediaRef.current.filter((iso) => iso >= a && iso <= b)
    if (dalam.length === 0) {
      setError('Tidak ada hari berdata di rentang ini')
      return
    }
    const req = ++reqRef.current
    setError(null)
    setLoading(true)
    setSelesai(0)
    setTotal(dalam.length)
    ;(async () => {
      const BATCH = 16
      const perHari: BrokerRow[][] = []
      for (let i = 0; i < dalam.length; i += BATCH) {
        const bagian = await Promise.all(dalam.slice(i, i + BATCH).map(fetchBrokerRows))
        if (reqRef.current !== req) return
        perHari.push(...bagian)
        setSelesai(perHari.length)
      }
      setRows(agregatBrokerRows(perHari))
      setRentang({ mulai: dalam[0], akhir: dalam[dalam.length - 1], nHari: dalam.length })
      setTanggalAktif(dalam[dalam.length - 1])
      setLoading(false)
    })().catch((e: unknown) => {
      if (reqRef.current !== req) return
      setError(pesanGalat(e, 'Gagal memuat data broker'))
      setRows(null)
      setLoading(false)
    })
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
        setError(pesanGalat(e, 'Gagal memuat index broker'))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [pilihTanggal])

  return { tanggalTersedia, tanggalAktif, rows, rentang, pilihTanggal, pilihRentang, loading, error, selesai, total }
}
