import { useEffect, useState } from 'react'
import type { BarisOhlc } from './ihsgOhlc'
import {
  cariIndeksHari, menangOpenHigh, menangCloseToClose, menangTpSlH5,
  type BarWinRate, type HasilMenang,
} from './winRate'

/**
 * Jejak Rekomendasi — jembatan fetch untuk tab "Riwayat & Win Rate"
 * (`docs/spek-dev-papan/spek_preset_winrate_rekap.md` §Tugas C). Bentuknya
 * PERSIS keluaran `scripts/riset/rekap_preset.py` (§C.1) — kalau salah satu
 * berubah, keduanya wajib disunting bersama.
 *
 * `winRate.ts` tetap murni (bar → hasil); berkas ini yang fetch + gabung,
 * pola sama `brokerProfilKsei.ts` (cache `Map<kunci, Promise<...>>`, dipakai
 * lazy per baris tampil — lihat `muatKepemilikan`).
 */

export interface SahamRekomendasi {
  kode: string
  close: number | null
  entry: [number, number] | null
  tp1: number | null
  tp2: number | null
  sl: number | null
  skor: number | null
  ringkas: {
    freq: number | null
    ukuran_order: number | null
    fd: string | null
    bandar_top1_kode: string | null
    bandar_top1_avg: number | null
    label_accdist: string | null
  }
}

export interface PresetRekomendasi {
  preset: string
  saham: SahamRekomendasi[]
}

export interface HariRekomendasi {
  tanggal: string
  dibangun: string
  backtest: boolean
  presets: PresetRekomendasi[]
}

export interface IndexRekomendasi {
  diperbarui: string
  tanggal: string[]
}

const cacheIndex = new Map<string, Promise<IndexRekomendasi | null>>()

export function muatIndexRekomendasi(): Promise<IndexRekomendasi | null> {
  let p = cacheIndex.get('x')
  if (!p) {
    p = fetch('/data-idx/json/rekomendasi/index.json')
      .then((r) => (r.ok ? (r.json() as Promise<IndexRekomendasi>) : null))
      .catch(() => null)
    cacheIndex.set('x', p)
  }
  return p
}

const cacheHari = new Map<string, Promise<HariRekomendasi | null>>()

export function muatHariRekomendasi(tanggal: string): Promise<HariRekomendasi | null> {
  let p = cacheHari.get(tanggal)
  if (!p) {
    p = fetch(`/data-idx/json/rekomendasi/${tanggal}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<HariRekomendasi>) : null))
      .catch(() => null)
    cacheHari.set(tanggal, p)
  }
  return p
}

const cacheOhlc = new Map<string, Promise<BarWinRate[] | null>>()

/**
 * Bar harian satu emiten, siap pakai `winRate.ts` — TERMASUK penjaga: bar
 * dengan `volume === 0` DIBUANG (bukan cuma di ujung riwayat), sama sinyal
 * yang dipakai `beku`/`kartu_analisa.py` untuk "hari tanpa transaksi nyata".
 * Tanpa ini, snapshot HARI BERJALAN (OHLC ditaruh datar = harga kemarin,
 * volume 0, belum settle — lihat CLAUDE.md "sumber data") akan terbaca
 * sebagai hasil H+1 yang sungguhan dan mencemari win rate dengan "kalah"
 * palsu.
 * ponytail: buang SELURUH bar volume=0, bukan cuma yang di ujung riwayat —
 * kalau nanti ada emiten yang sungguh disuspensi berhari-hari di TENGAH
 * riwayat, baris itu ikut hilang dari deret alih-alih ditandai. Naikkan ke
 * penanda eksplisit kalau kasusnya sungguh muncul di data.
 */
export function muatOhlcWinRate(kode: string): Promise<BarWinRate[] | null> {
  let p = cacheOhlc.get(kode)
  if (!p) {
    p = fetch(`/data-idx/json/ohlc/${kode}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<{ d: BarisOhlc[] }>) : null))
      .then((j) => j?.d
        .filter((b) => b[5] > 0)
        .map((b): BarWinRate => ({ tanggal: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }))
        ?? null)
      .catch(() => null)
    cacheOhlc.set(kode, p)
  }
  return p
}

export function useIndexRekomendasi(): IndexRekomendasi | null {
  const [data, setData] = useState<IndexRekomendasi | null>(null)
  useEffect(() => {
    let batal = false
    void muatIndexRekomendasi().then((d) => { if (!batal) setData(d) })
    return () => { batal = true }
  }, [])
  return data
}

/** N tanggal TERBARU dari index (menaik → dipotong dari belakang), lalu
 *  hari-nya dimuat paralel. `null` selagi index belum termuat; array kosong
 *  kalau index termuat tapi belum ada satu tanggal pun (fitur baru). */
export function useJendelaRekomendasi(nHari: number): HariRekomendasi[] | null {
  const index = useIndexRekomendasi()
  const [hari, setHari] = useState<HariRekomendasi[] | null>(null)
  const tanggalTerpilih = index ? index.tanggal.slice(-nHari) : null
  const kunci = tanggalTerpilih?.join(',') ?? ''
  useEffect(() => {
    if (!tanggalTerpilih) return
    let batal = false
    setHari(null)
    void Promise.all(tanggalTerpilih.map(muatHariRekomendasi)).then((hasil) => {
      if (!batal) setHari(hasil.filter((h): h is HariRekomendasi => h != null))
    })
    return () => { batal = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci])
  return hari
}

export interface HasilSahamRekomendasi {
  tanggal: string
  kode: string
  skor: number | null
  tp1: number | null
  sl: number | null
  openHigh: HasilMenang
  closeClose: HasilMenang
  closeClosePersen: number | null
  tpSl: HasilMenang
}

/** Satu preset, satu hari → hasil per saham (tiga definisi sekaligus) — bar
 *  diambil dari peta yang sudah dimuat pemanggil (`petaBars`), BUKAN fetch di
 *  sini, supaya fungsi ini tetap gampang diuji/dipanggil untuk banyak hari
 *  tanpa mikir urutan async. */
export function hasilSahamPreset(
  hari: HariRekomendasi,
  presetId: string,
  petaBars: ReadonlyMap<string, BarWinRate[]>,
): HasilSahamRekomendasi[] {
  const p = hari.presets.find((x) => x.preset === presetId)
  if (!p) return []
  return p.saham.map((s): HasilSahamRekomendasi => {
    const bars = petaBars.get(s.kode) ?? []
    const idx = cariIndeksHari(bars, hari.tanggal)
    const cc = menangCloseToClose(bars, idx)
    return {
      tanggal: hari.tanggal,
      kode: s.kode,
      skor: s.skor,
      tp1: s.tp1,
      sl: s.sl,
      openHigh: menangOpenHigh(bars, idx),
      closeClose: cc.hasil,
      closeClosePersen: cc.persen,
      tpSl: s.tp1 != null && s.sl != null ? menangTpSlH5(bars, idx, s.tp1, s.sl) : 'tak-terukur',
    }
  })
}

/** Kode UNIK dari sekian hari+preset — dipakai pemanggil untuk tahu berkas
 *  OHLC mana saja yang perlu dimuat sebelum memanggil `hasilSahamPreset`. */
export function kodeUnikPreset(hari: readonly HariRekomendasi[], presetId: string): string[] {
  const set = new Set<string>()
  for (const h of hari) {
    const p = h.presets.find((x) => x.preset === presetId)
    for (const s of p?.saham ?? []) set.add(s.kode)
  }
  return [...set].sort()
}

/** Muat OHLC seluruh kode unik (paralel, lewat cache) → peta siap pakai
 *  `hasilSahamPreset`. Hook terpisah dari `useJendelaRekomendasi` supaya
 *  komponen bisa render tabel skor dulu (tak menunggu OHLC) lalu win rate-nya
 *  menyusul. */
export function usePetaBarsPreset(hari: readonly HariRekomendasi[] | null, presetId: string): Map<string, BarWinRate[]> {
  const [peta, setPeta] = useState<Map<string, BarWinRate[]>>(new Map())
  const kodeList = hari ? kodeUnikPreset(hari, presetId) : []
  const kunci = kodeList.join(',')
  useEffect(() => {
    if (!kodeList.length) { setPeta(new Map()); return }
    let batal = false
    void Promise.all(kodeList.map((k) => muatOhlcWinRate(k).then((b) => [k, b] as const))).then((pasangan) => {
      if (batal) return
      setPeta(new Map(pasangan.filter((x): x is [string, BarWinRate[]] => x[1] != null)))
    })
    return () => { batal = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci])
  return peta
}
