import { useEffect, useState } from 'react'
import type { LabelSkor } from './skorTeknikal'
import type { NamaPolaKlasik } from './polaKlasik'
import { LABEL_POLA_KLASIK } from './polaKlasik'
import type { BarisRingkas } from './kartuRingkas'
import type { BarisPreset } from './presetScreener'

/**
 * Screener (`/screener`, backlog B31) — tabel penyaring SELURUH emiten dalam
 * satu baris per emiten, dibaca dari berkas turunan `data-idx/json/screener.json`
 * (`scripts/riset/screener.py` — angkanya SUDAH dihitung di sisi Python, di sini
 * cuma saring/urut/format tampilan, pola sama dengan kartuRingkas.ts).
 */

export interface BarisScreener {
  kode: string
  nama: string
  sektor: string
  harga: number | null
  tdm_persen: number | null
  volume: number | null
  rvol10: number | null
  nilai: number | null
  /** Median nilai transaksi 20 hari bursa (close × volume) — BEDA dari
   *  `nilai` (nilai transaksi hari TERAKHIR saja). Dipakai filter likuiditas
   *  bertingkat (lib/dasbor/likuiditas.ts); median dipilih supaya satu hari
   *  crossing raksasa tak menaikkan angkanya seolah sahamnya selalu seramai
   *  itu (lihat docs/likuiditas-acuan.md). */
  likuiditas: number | null
  sss_d: LabelSkor | null
  sss_w: LabelSkor | null
  sss_m: LabelSkor | null
  free_float: number | null
  ma20_arah: 'naik' | 'datar' | 'turun' | null
  close_gap: number | null
  chg_1d: number | null
  chg_wtd: number | null
  chg_mtd: number | null
  posisi_ema5: 'atas' | 'bawah' | null
  posisi_ma10: 'atas' | 'bawah' | null
  posisi_ma20: 'atas' | 'bawah' | null
  net_asing_lembar: number | null
  /** Hari bursa beruntun net asing (resmi, rupiah) searah — +masuk/−keluar,
   *  sama definisi & sumber dengan `asing_streak` di `BarisPreset`
   *  (presetScreener.ts, dari kartu/ringkas.json). Opsional supaya baris uji
   *  lama yang belum menyebutkannya tetap sah. */
  asing_streak?: number | null
}

export interface DataScreener {
  diperbarui: string
  tanggal: string
  n: number
  emiten: BarisScreener[]
}

/** Lima label tetap SSS Score, dalam urutan kuat→lemah→kuat — dipakai sebagai
 *  daftar chip saringan (bukan diturunkan dari data, supaya urutannya stabil
 *  walau satu label kebetulan nol baris hari itu). */
export const LABEL_SSS: LabelSkor[] = ['Strong Buy', 'Buy', 'Neutral', 'Sell', 'Strong Sell']

/** Sektor yang benar-benar muncul di data, urut abjad id-ID — bukan daftar
 *  tetap: sektor "-" (belum terklasifikasi IDX-IC) hanya jadi chip kalau
 *  memang ada barisnya. */
export function sektorUnik(baris: BarisScreener[]): string[] {
  return [...new Set(baris.map((b) => b.sektor))].sort((a, b) => a.localeCompare(b, 'id'))
}

/**
 * Hasil setelah chip SSS + chip sektor + kata cari diterapkan. Dua kelompok
 * chip itu OR di dalam kelompoknya sendiri (pilih Buy DAN Strong Buy berarti
 * "salah satu dari keduanya"), AND lintas kelompok — pola faceted filter
 * biasa, beda dari `kartuRingkas.saring()` yang AND semua chip karena di
 * sana tiap chip itu syarat independen, bukan pilihan label yang saling
 * eksklusif per baris.
 */
export function saring<T extends BarisScreener>(
  baris: T[], sssAktif: string[], sektorAktif: string[], cari: string,
): T[] {
  const q = cari.trim().toUpperCase()
  return baris.filter((b) => {
    if (q && !b.kode.includes(q) && !b.nama.toUpperCase().includes(q)) return false
    if (sssAktif.length > 0 && (b.sss_d == null || !sssAktif.includes(b.sss_d))) return false
    if (sektorAktif.length > 0 && !sektorAktif.includes(b.sektor)) return false
    return true
  })
}

/** Warna teks label SSS/arah — teks berwarna, BUKAN lencana berlatar (962
 *  baris × 3 kolom SSS berlatar penuh terbaca seperti papan peringatan).
 *  `kuat` menandai Strong Buy/Strong Sell supaya kelas pemanggil bisa
 *  menebalkannya (<b> vs <span>) tanpa menambah kelas warna baru. */
export function kelasSss(label: LabelSkor | null): { warna: 'up' | 'dn' | ''; kuat: boolean } {
  switch (label) {
    case 'Strong Buy': return { warna: 'up', kuat: true }
    case 'Buy': return { warna: 'up', kuat: false }
    case 'Sell': return { warna: 'dn', kuat: false }
    case 'Strong Sell': return { warna: 'dn', kuat: true }
    default: return { warna: '', kuat: false } // Neutral atau null
  }
}

/** Warna arah MA20 (naik/datar/turun). */
export function kelasArah(v: 'naik' | 'datar' | 'turun' | null): 'up' | 'dn' | '' {
  return v === 'naik' ? 'up' : v === 'turun' ? 'dn' : ''
}

/** Warna posisi harga terhadap EMA/MA (atas/bawah) — pola sama `kelasArah`,
 *  ruas beda karena nilainya "atas"/"bawah", bukan "naik"/"turun". */
export function kelasPosisi(v: 'atas' | 'bawah' | null): 'up' | 'dn' | '' {
  return v === 'atas' ? 'up' : v === 'bawah' ? 'dn' : ''
}

/** Warna arah pola klasik (bullish/bearish) — pola sama `kelasArah`. */
export function kelasPolaArah(v: 'bullish' | 'bearish' | null): 'up' | 'dn' | '' {
  return v === 'bullish' ? 'up' : v === 'bearish' ? 'dn' : ''
}

/** Desimal tetap, `—` untuk null — BUKAN `fN()` (format.ts), yang mengubah
 *  null jadi 0 dan 0 di sini berarti "nol persen", klaim berbeda dari "tak
 *  diketahui". */
export function fDec(v: number | null, d = 2): string {
  return v == null ? '—' : v.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
}

/** Ringkas jt/M dengan tanda +/− — sama pola `ringkasLembar` di Watchlist.tsx,
 *  disalin bukan diimpor karena di sana ia fungsi privat berkas itu. Dipakai
 *  untuk Net Asing (lembar, bisa negatif); Volume & Nilai pakai `fRingkas`
 *  (stockDetailFormat.ts) yang sudah dipakai KartuAnalisa, tak perlu tanda
 *  karena keduanya tak pernah negatif. */
export function ringkasLembarBertanda(n: number | null): string {
  if (n == null) return '—'
  const tanda = n > 0 ? '+' : n < 0 ? '−' : ''
  const a = Math.abs(n)
  if (a >= 1e9) return `${tanda}${(a / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`
  if (a >= 1e6) return `${tanda}${(a / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
  if (a >= 1e3) return `${tanda}${(a / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`
  return `${tanda}${a.toLocaleString('id-ID')}`
}

export async function ambilScreener(pengambil: typeof fetch = fetch): Promise<DataScreener | null> {
  try {
    const r = await pengambil('/data-idx/json/screener.json')
    if (!r.ok) return null
    return (await r.json()) as DataScreener
  } catch {
    return null
  }
}

let cache: DataScreener | null = null
let cacheSejak = 0

/** Umur maksimum cache modul — audit 21 Agu 2026 (#4): tab yang dibiarkan
 *  terbuka melewati pergantian hari bursa terus menyajikan 962 baris data
 *  kemarin, dan satu-satunya tandanya teks kecil di kaki halaman. 30 menit:
 *  cukup lama untuk bolak-balik antar halaman tanpa fetch ulang, cukup
 *  pendek untuk tak pernah melewati satu sesi perdagangan. */
const UMUR_CACHE_MS = 30 * 60 * 1000

export function useScreener(): DataScreener | null {
  const segar = cache !== null && Date.now() - cacheSejak < UMUR_CACHE_MS
  const [data, setData] = useState<DataScreener | null>(segar ? cache : null)
  useEffect(() => {
    if (cache && Date.now() - cacheSejak < UMUR_CACHE_MS) { setData(cache); return }
    let batal = false
    void ambilScreener().then((d) => {
      if (d) { cache = d; cacheSejak = Date.now() }
      if (!batal) setData(d)
    })
    return () => { batal = true }
  }, [])
  return data
}

/**
 * Kolom "Pola" (Johan 21 Agu 2026: *"itu juga bisa masuk di screener"*) — pola
 * klasik AKTIF per emiten, dari `data-idx/json/pola_screener.json`
 * (`scripts/pola-screener.ts`). Berkas TERPISAH dari `screener.json`: yang
 * satu keluaran Python, yang ini keluaran mesin pola TypeScript
 * (`polaKlasik.ts`) — digabung di sisi React lewat kode emiten, bukan
 * disatukan di sisi build.
 *
 * Tuple, bukan objek — kunci `d` berulang untuk ratusan emiten, dan ruas
 * inilah yang menembus jaringan tiap kunjungan halaman.
 */
export type PolaAktifScreener = [
  nama: NamaPolaKlasik,
  arah: 'bullish' | 'bearish',
  tanggal: string,
  target: number,
  hargaSinyal: number,
]

export interface DataPolaScreener {
  akhir: string
  n: number
  d: Record<string, PolaAktifScreener>
}

export async function ambilPolaScreener(pengambil: typeof fetch = fetch): Promise<DataPolaScreener | null> {
  try {
    const r = await pengambil('/data-idx/json/pola_screener.json')
    if (!r.ok) return null
    return (await r.json()) as DataPolaScreener
  } catch {
    return null
  }
}

let cachePola: DataPolaScreener | null = null

export function usePolaScreener(): DataPolaScreener | null {
  const [data, setData] = useState<DataPolaScreener | null>(cachePola)
  useEffect(() => {
    if (cachePola) return
    let batal = false
    void ambilPolaScreener().then((d) => {
      if (d) cachePola = d
      if (!batal) setData(d)
    })
    return () => { batal = true }
  }, [])
  return data
}

/** Singkatan label pola untuk kolom sempit — HANYA yang label penuhnya
 *  bikin kolom melebar tak wajar; sisanya (≤14 karakter, atau yang tak
 *  terdaftar di sini) tampil apa adanya. Potongan per KATA yang masih bisa
 *  dikenali, bukan elipsis buta yang membuang informasi arah/bentuk. */
const SINGKATAN_POLA: Partial<Record<NamaPolaKlasik, string>> = {
  'inv-head-shoulders': 'Inv. H&S',
  'ascending-triangle': 'Asc. Triangle',
  'descending-triangle': 'Desc. Triangle',
  'symmetrical-triangle': 'Sym. Triangle',
}

export function labelPolaSingkat(nama: NamaPolaKlasik): string {
  const label = LABEL_POLA_KLASIK[nama]
  return label.length > 14 ? (SINGKATAN_POLA[nama] ?? label) : label
}

// ── Jembatan ke Preset Whale (presetScreener.ts) ───────────────────────────

/** Ruas preset Whale (adendum_preset_whale.md) — SUDAH ditulis
 *  `kartu_analisa.py` ke tiap baris `kartu/ringkas.json`, tapi belum
 *  dideklarasikan di `BarisRingkas` (kartuRingkas.ts hanya menyorot ruas
 *  S/R, di luar daftar berkas paket ini). Ditambal lewat cast di sini,
 *  bukan menyentuh berkas itu. */
type RuasWhale = Pick<
  BarisPreset,
  | 'ma5' | 'ma20' | 'posisi_bb' | 'di_atas_kumo' | 'posisi_regresi' | 'freq' | 'ukuran_order'
  | 'peringkat_value' | 'net_asing_rp' | 'porsi_asing' | 'label_accdist' | 'tiket_lonjakan'
  | 'tiket_broker_maks' | 'bval_maks' | 'nego_blok_rp' | 'asing_net_5h' | 'asing_streak'
  | 'top3_pct' | 'number_broker_buysell'
>

/** `BarisRingkas` (kartu/ringkas.json, lewat `useRingkasKartu()`) → `BarisPreset`
 *  (presetScreener.ts) — satu emiten. `ma50` selalu `null`: sumbernya tak
 *  menyimpan MA50, dan preset Swing (satu-satunya pemakainya) di luar
 *  cakupan paket ini; kriterianya jatuh 'tak-terukur', bukan gagal. */
export function keBarisPreset(b: BarisRingkas): BarisPreset {
  const w = b as BarisRingkas & Partial<RuasWhale>
  return {
    kode: b.kode,
    harga: b.harga,
    ma5: w.ma5 ?? null,
    ma20: w.ma20 ?? b.ma20 ?? null,
    ma50: null,
    posisi_bb: w.posisi_bb ?? null,
    di_atas_kumo: w.di_atas_kumo ?? null,
    posisi_regresi: w.posisi_regresi ?? null,
    freq: w.freq ?? null,
    ukuran_order: w.ukuran_order ?? null,
    peringkat_value: w.peringkat_value ?? null,
    net_asing_rp: w.net_asing_rp ?? null,
    porsi_asing: w.porsi_asing ?? null,
    label_accdist: w.label_accdist ?? null,
    tiket_lonjakan: w.tiket_lonjakan ?? null,
    tiket_broker_maks: w.tiket_broker_maks ?? null,
    bval_maks: w.bval_maks ?? null,
    nego_blok_rp: w.nego_blok_rp ?? null,
    asing_net_5h: w.asing_net_5h ?? null,
    asing_streak: w.asing_streak ?? null,
    top3_pct: w.top3_pct ?? null,
    number_broker_buysell: w.number_broker_buysell ?? null,
  }
}
