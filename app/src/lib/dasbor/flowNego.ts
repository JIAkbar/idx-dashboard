import { useEffect, useRef, useState } from 'react'
import { fetchHari, fetchIndex, type DataHarian } from './dataHarian'

/**
 * Sumber data tab Flow & NEGO /broker-summary (#99) — dari berkas harian pasar
 * ds_YYMMDD.json (bukan data broker bs_*). Audit sumber (Agu 2026, 138 berkas):
 * - `nf_today_idr` = NET foreign harian (miliar Rp). Buy/sell TERPISAH tidak
 *   ada di sumber → chart Flow jujur menampilkan Net + kumulatif, bukan
 *   mengarang buy/sell. 7 dari 138 berkas tanpa angka nf (parser PDF gagal) →
 *   nf null, chart menampilkan celah.
 * - `trading_recap` baris n==='NG' = agregat papan negosiasi per hari
 *   (v lembar, va Rp, f kali). Rincian PER SAHAM nego tidak tersedia dari
 *   sumber → tab NEGO menampilkan agregat papan, dengan keterangan jujur.
 */
export interface HariFlow {
  iso: string
  /** Net foreign hari itu (miliar Rp, nf_today_idr); null = tak ada di sumber. */
  nf: number | null
  /** Papan NG (negosiasi): nilai Rp, volume lembar, frekuensi kali. */
  ngVal: number
  ngVol: number
  ngFrek: number
}

interface RecapRow {
  n?: string
  v?: number
  va?: number
  f?: number
}

/** Ekstrak metrik Flow/Nego dari satu berkas ds harian. Ekspor untuk unit test. */
export function ekstrakHariFlow(iso: string, d: DataHarian): HariFlow {
  const recap = Array.isArray(d.trading_recap) ? (d.trading_recap as RecapRow[]) : []
  const ng = recap.find((r) => r.n === 'NG')
  return {
    iso,
    nf: typeof d.nf_today_idr === 'number' ? d.nf_today_idr : null,
    ngVal: ng?.va ?? 0,
    ngVol: ng?.v ?? 0,
    ngFrek: ng?.f ?? 0,
  }
}

/** Mode harian memuat maksimal segini hari bursa terakhir s.d. tanggal aktif —
 * chart 1 batang tidak bermakna, jendela pendek memberi konteks. */
export const JENDELA_HARIAN = 20

/** Pilih tanggal ds yang dimuat: isi rentang aktif, atau (mode harian) jendela
 * JENDELA_HARIAN hari bursa terakhir s.d. tanggal aktif. Ekspor untuk unit test. */
export function pilihJendela(
  dsIso: string[],
  tanggalAktif: string | null,
  rentang: { mulai: string; akhir: string } | null,
): string[] {
  if (rentang) return dsIso.filter((iso) => iso >= rentang.mulai && iso <= rentang.akhir)
  if (!tanggalAktif) return []
  return dsIso.filter((iso) => iso <= tanggalAktif).slice(-JENDELA_HARIAN)
}

/** Daftar ISO hari ber-data ds — untuk DatePicker tab NEGO/Flow (cakupan ds
 * jauh lebih pendek dari data broker: 2026 vs 2023). Index.json sendiri
 * dipakai lewat `fetchIndex()` (dataHarian.ts) — satu promise di-cache modul
 * dipakai bareng useDataHarian, bukan fetch terpisah di sini. */
export function useDsIso(): string[] {
  const [iso, setIso] = useState<string[]>([])
  useEffect(() => {
    let cancelled = false
    fetchIndex()
      .then((d) => {
        if (!cancelled) setIso(d.map((x) => x.date_iso))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return iso
}

/**
 * Hook data Flow/NEGO mengikuti tanggal/rentang aktif halaman. Fetch berkas
 * ds harian per batch 16 (pola brokerHarian.ts) lewat cache modul dataHarian —
 * total berkas ds cuma ~140, tanpa batas rentang.
 */
export function useFlowNego(
  tanggalAktif: string | null,
  rentang: { mulai: string; akhir: string } | null,
) {
  const [hari, setHari] = useState<HariFlow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cakupan, setCakupan] = useState<{ min: string; max: string } | null>(null)
  // Penanda request terakhir — hasil basi dibuang, bukan menimpa pilihan baru.
  const reqRef = useRef(0)
  const mulai = rentang?.mulai ?? null
  const akhir = rentang?.akhir ?? null

  useEffect(() => {
    const req = ++reqRef.current
    setLoading(true)
    setError(null)
    ;(async () => {
      const idx = await fetchIndex()
      const stemByIso = new Map(idx.map((d) => [d.date_iso, d.stem]))
      const isos = pilihJendela(
        idx.map((d) => d.date_iso),
        tanggalAktif,
        mulai && akhir ? { mulai, akhir } : null,
      )
      const out: HariFlow[] = []
      for (let i = 0; i < isos.length; i += 16) {
        const bagian = await Promise.all(
          isos.slice(i, i + 16).map(async (iso) => ekstrakHariFlow(iso, await fetchHari(stemByIso.get(iso)!))),
        )
        if (reqRef.current !== req) return
        out.push(...bagian)
      }
      if (reqRef.current !== req) return
      setHari(out)
      setCakupan(idx.length > 0 ? { min: idx[0].date_iso, max: idx[idx.length - 1].date_iso } : null)
      setLoading(false)
    })().catch((e: unknown) => {
      if (reqRef.current !== req) return
      setError(e instanceof Error ? e.message : 'Gagal memuat data harian pasar')
      setHari(null)
      setLoading(false)
    })
  }, [tanggalAktif, mulai, akhir])

  return { hari, loading, error, cakupan }
}
