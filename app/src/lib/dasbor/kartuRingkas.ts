import { useEffect, useState } from 'react'
import type { Kualitas } from './kartuAnalisa'

/**
 * Tabel penyaring emiten (`/kartu`) — satu berkas ringkas untuk SELURUH emiten
 * yang lolos ambang, supaya halaman tidak menembak ratusan permintaan. Angkanya
 * DITURUNKAN dari kartu penuh yang sama di sisi Python; di sini tidak ada satu
 * pun rumus yang menghitung ulang, cuma aritmetika tampilan (jarak dalam persen
 * dan dalam ATR) yang tidak punya arti di luar layar.
 *
 * TIDAK ADA kolom peluang di sini, dan itu disengaja: peluang tersentuh adalah
 * fungsi geometri jarak, bukan kualitas emiten — satu ketukan pada kepala kolom
 * semacam itu menghasilkan peringkat ratusan emiten menurut "resistensi
 * terdekat + volatilitas tinggi". Kolomnya tidak ada supaya tak bisa diurut.
 */

export interface BarisRingkas {
  kode: string
  tgl: string
  harga: number
  chg: number
  n: number
  ma20: number | null
  atr_pct: number | null
  s1: number | null
  r1: number | null
  er_persentil: number | null
  likuiditas: number
  stop_pct: number
  /** Belum ada di ringkas.json/arsip lama (sebelum 21 Agu 2026) — undefined
   *  diperlakukan sama dengan "cukup" (tak ditandai, tak disembunyikan). */
  kualitas?: Kualitas | null
  /** Hari bursa berturut tanpa transaksi. Sama arti & ambang dengan ruas
   *  kembar di `kartuAnalisa.ts` (`LencanaBeku`/`tidakDiperdagangkan`). */
  beku?: number
  beku_sejak?: string | null
}

export interface DataRingkas {
  diperbarui: string
  ambang: { lilin: number; likuiditas: number }
  /** Berapa emiten TIDAK dapat kartu, per sebab. Dicetak di kaki tabel — data
   *  yang disaring keluar tanpa jejak adalah data yang hilang senyap. */
  tak_lolos: { riwayat?: number; likuiditas?: number }
  emiten: BarisRingkas[]
}

/** Baris siap tabel: sama isinya + jarak ke level, dalam persen DAN dalam ATR.
 *  Keduanya ditampilkan bersama karena "−4%" berarti hal yang sangat berbeda
 *  pada emiten ber-ATR 1% dan ber-ATR 8%. */
export interface BarisTabel extends BarisRingkas {
  /** Posisi harga terhadap MA20, persen. */
  ma20_pct: number | null
  /** Jarak turun ke S1 (positif = S1 di bawah harga) dan naik ke R1. */
  s1_pct: number | null
  s1_atr: number | null
  r1_pct: number | null
  r1_atr: number | null
  /** Jarak ke level TERDEKAT (S1 atau R1) dalam satuan ATR harian. */
  dekat_atr: number | null
}

export function keBarisTabel(b: BarisRingkas): BarisTabel {
  const dlmAtr = (pct: number | null) => (pct == null || !b.atr_pct ? null : pct / b.atr_pct)
  const s1_pct = b.s1 == null ? null : ((b.harga - b.s1) / b.harga) * 100
  const r1_pct = b.r1 == null ? null : ((b.r1 - b.harga) / b.harga) * 100
  const s1_atr = dlmAtr(s1_pct)
  const r1_atr = dlmAtr(r1_pct)
  const jarak = [s1_atr, r1_atr].filter((x): x is number => x != null).map(Math.abs)
  return {
    ...b,
    ma20_pct: b.ma20 ? ((b.harga - b.ma20) / b.ma20) * 100 : null,
    s1_pct, s1_atr, r1_pct, r1_atr,
    dekat_atr: jarak.length ? Math.min(...jarak) : null,
  }
}

/**
 * Saringan = KALIMAT KONDISI, bukan nama sifat. Tak ada chip bernama "Momentum"
 * atau "Jagoan": label yang menamai sifat menyembunyikan aturannya, dan yang
 * disembunyikan tak bisa dibantah pembaca. Tiap label WAJIB memuat operator
 * pembanding — dijaga uji di kartuRingkas.test.ts.
 */
export interface Saringan {
  id: string
  label: string
  uji: (b: BarisTabel) => boolean
}

export const SARINGAN: Saringan[] = [
  { id: 'riwayat', label: 'Riwayat ≥ 500 lilin', uji: (b) => b.n >= 500 },
  { id: 'dekat', label: 'Level terdekat < 1 ATR', uji: (b) => b.dekat_atr != null && b.dekat_atr < 1 },
]

/** NOL chip menyala saat halaman dibuka. Saringan bawaan adalah pilihan yang
 *  dibuat untuk pembaca tanpa ia tahu — dan daftar hasilnya terbaca sebagai
 *  "pasar", bukan sebagai "hasil saringan saya". Dijaga uji. */
export const CHIP_BAWAAN: string[] = []

/** Hasil setelah chip aktif + kata cari diterapkan. Fungsi murni supaya bisa
 *  diuji tanpa merender React. */
export function saring(baris: BarisTabel[], aktif: string[], cari: string): BarisTabel[] {
  const q = cari.trim().toUpperCase()
  const uji = SARINGAN.filter((s) => aktif.includes(s.id))
  return baris.filter((b) => (!q || b.kode.includes(q)) && uji.every((s) => s.uji(b)))
}

export async function ambilRingkasKartu(pengambil: typeof fetch = fetch): Promise<DataRingkas | null> {
  try {
    const r = await pengambil('/data-idx/json/kartu/ringkas.json')
    if (!r.ok) return null
    return (await r.json()) as DataRingkas
  } catch {
    return null
  }
}

let cache: DataRingkas | null = null

export function useRingkasKartu(): DataRingkas | null {
  const [data, setData] = useState<DataRingkas | null>(cache)
  useEffect(() => {
    if (cache) return
    let batal = false
    void ambilRingkasKartu().then((d) => {
      if (d) cache = d
      if (!batal) setData(d)
    })
    return () => { batal = true }
  }, [])
  return data
}

/** Baris "riwayat pendek" / "likuiditas tipis" TETAP TAMPIL bawaan (lihat
 *  keputusan kalender 21 Agu 2026) — dua chip toggle di halaman menyembunyikan-
 *  nya kalau diaktifkan, kebalikan dari SARINGAN di atas (yang bawaannya
 *  MENYEMBUNYIKAN sampai diaktifkan). Fungsi murni supaya diuji tanpa render. */
export function saringKualitas<T extends { kualitas?: Kualitas | null }>(
  baris: T[], sembunyikanRiwayatPendek: boolean, sembunyikanLikuiditasTipis: boolean,
): T[] {
  return baris.filter((b) => {
    if (sembunyikanRiwayatPendek && b.kualitas?.riwayat === 'pendek') return false
    if (sembunyikanLikuiditasTipis && b.kualitas?.likuiditas === 'tipis') return false
    return true
  })
}

/** Arsip screener per tanggal bursa (`kartu/arsip/<tanggal>.json`, sama bentuk
 *  `DataRingkas`) — dasar kalender tab Semua. `tanggal` string kosong/`null`
 *  = tak diambil (pemanggil pakai `useRingkasKartu()` untuk tanggal terkini). */
export async function ambilArsipKartu(tanggal: string, pengambil: typeof fetch = fetch): Promise<DataRingkas | null> {
  try {
    const r = await pengambil(`/data-idx/json/kartu/arsip/${tanggal}.json`)
    if (!r.ok) return null
    return (await r.json()) as DataRingkas
  } catch {
    return null
  }
}

const cacheArsip = new Map<string, DataRingkas | null>()

export function useArsipKartu(tanggal: string | null): DataRingkas | null {
  const [data, setData] = useState<DataRingkas | null>(tanggal ? (cacheArsip.get(tanggal) ?? null) : null)
  useEffect(() => {
    if (!tanggal) { setData(null); return }
    if (cacheArsip.has(tanggal)) { setData(cacheArsip.get(tanggal) ?? null); return }
    let batal = false
    setData(null)
    void ambilArsipKartu(tanggal).then((d) => {
      cacheArsip.set(tanggal, d)
      if (!batal) setData(d)
    })
    return () => { batal = true }
  }, [tanggal])
  return data
}
