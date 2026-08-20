import { useEffect, useState } from 'react'

/**
 * Pembanding historis untuk rasio valuasi — "P/E 12x" jadi bisa dibaca
 * murah/wajar/mahal **terhadap sejarah emiten itu sendiri**, bukan sebagai
 * angka telanjang.
 *
 * Deret mentahnya dihitung `scripts/hitung_valuasi_historis.py` dari data yang
 * sudah ada di cakram (XBRL tahunan bursa x OHLC x `ListedShares`). Yang ada di
 * berkas ini cuma penilaiannya — sengaja dipisah supaya rumus ambangnya bisa
 * diuji vitest dan dibantah pembaca.
 *
 * ## Rumus ambang — ditulis supaya bisa dibantah
 *
 * Ambangnya **diturunkan dari sebaran nyata emiten itu sendiri**, bukan angka
 * universal ("P/E di bawah 15 itu murah" tak berarti apa-apa: bank, properti,
 * dan teknologi hidup di rentang yang berbeda, dan emiten yang sama pun bergeser
 * rentangnya sepanjang siklus).
 *
 *   Q1 = persentil 25 deret historis emiten ybs
 *   Q3 = persentil 75 deret historis emiten ybs
 *
 *   kini < Q1  → 'murah'   (lebih murah dari 3 dari 4 tahun sejarahnya)
 *   kini > Q3  → 'mahal'
 *   selain itu → 'wajar'
 *
 * **Jangkarnya MEDIAN, bukan rata-rata.** Sebaran P/E miring ke kanan dan satu
 * tahun dengan laba nyaris nol (atau laba yang membengkak sekali karena
 * pelepasan anak usaha — UNVR 2025) menarik rata-rata jauh lebih keras daripada
 * median. `rerata` tetap ikut dihitung supaya bisa diperiksa, tapi bukan itu
 * yang dipakai menilai.
 *
 * **Riwayat pendek tidak diberi vonis sama sekali.** Dengan tiga titik, kuartil
 * cuma nama lain dari titik terendah dan tertinggi — ia akan selalu memberi
 * jawaban, dan jawaban yang selalu ada dari data yang tak cukup lebih buruk
 * daripada diam. Terukur 20 Agu 2026 dari 814 emiten berderet: **338 punya >=5
 * tahun P/E** dan **574 punya >=5 tahun P/B**; sisanya tampil sebagai deret
 * tanpa vonis, bukan sebagai 0 atau "wajar".
 */

/** Satu emiten di data-idx/json/valuasi_historis.json. */
export interface DeretValuasi {
  saham: number
  tahun_terakhir: string | null
  /**
   * Laba bersih & ekuitas tahun buku terakhir DIBAGI jumlah saham hari ini —
   * basis yang sama dengan deret harga OHLC yang sudah disesuaikan pemecahan
   * saham. Bukan EPS/BVPS apa adanya yang tercetak di laporan (lihat catatan
   * jebakan di skrip Python-nya).
   */
  eps_dasar: number | null
  bv_dasar: number | null
  /** Tahun (`"2019"`) → rasio. Tahun yang labanya negatif tak ada di sini. */
  pe: Record<string, number>
  pb: Record<string, number>
}

export interface DaftarValuasi {
  diperbarui: string
  sumber: string
  catatan: string
  n: number
  emiten: Record<string, DeretValuasi>
}

/** Minimum titik tahun sebelum sebuah deret boleh menghasilkan vonis. */
export const MIN_TAHUN = 5

export type Vonis = 'murah' | 'wajar' | 'mahal'

export const LABEL_VONIS: Record<Vonis, string> = {
  murah: 'Murah vs sejarah',
  wajar: 'Wajar vs sejarah',
  mahal: 'Mahal vs sejarah',
}

export interface RingkasRasio {
  /** Jumlah tahun yang benar-benar terpakai. */
  n: number
  tahunAwal: string | null
  tahunAkhir: string | null
  /** Rasio saat ini pada basis yang SAMA dengan deret historis. */
  kini: number | null
  median: number | null
  /** Ikut dihitung untuk pembanding, tapi bukan jangkar vonis. */
  rerata: number | null
  q1: number | null
  q3: number | null
  min: number | null
  max: number | null
  vonis: Vonis | null
  /** Kenapa vonisnya kosong — ditampilkan apa adanya, bukan diganti angka. */
  alasan: string | null
}

/**
 * Persentil dengan interpolasi linear (cara yang sama dipakai numpy
 * `linear`/Excel `PERCENTILE.INC`). `urut` WAJIB sudah terurut naik — memanggil
 * dengan deret acak memberi angka yang terlihat wajar dan salah.
 */
export function persentil(urut: number[], p: number): number | null {
  if (urut.length === 0) return null
  if (urut.length === 1) return urut[0]
  const i = (urut.length - 1) * p
  const bawah = Math.floor(i)
  const atas = Math.ceil(i)
  if (bawah === atas) return urut[bawah]
  return urut[bawah] + (urut[atas] - urut[bawah]) * (i - bawah)
}

/**
 * Ringkas satu deret rasio + vonis terhadap `kini`.
 *
 * `kini` wajib dihitung dengan rumus yang sama dengan deretnya (harga hari ini
 * dibagi ruas per-saham basis-hari-ini) — membandingkan P/E TTM yfinance
 * dengan deret yang dibangun dari laba tahun buku bursa itu membandingkan dua
 * definisi berbeda, dan selisihnya akan terbaca sebagai perubahan valuasi.
 */
export function ringkasRasio(
  riwayat: Record<string, number> | undefined,
  kini: number | null | undefined,
): RingkasRasio {
  const tahun = Object.keys(riwayat ?? {}).sort()
  const nilai = tahun.map((t) => riwayat![t]).filter((v) => Number.isFinite(v))
  const urut = [...nilai].sort((a, b) => a - b)
  const n = urut.length

  const dasar: RingkasRasio = {
    n,
    tahunAwal: tahun[0] ?? null,
    tahunAkhir: tahun[tahun.length - 1] ?? null,
    kini: kini != null && Number.isFinite(kini) ? kini : null,
    median: persentil(urut, 0.5),
    rerata: n ? nilai.reduce((a, b) => a + b, 0) / n : null,
    q1: persentil(urut, 0.25),
    q3: persentil(urut, 0.75),
    min: n ? urut[0] : null,
    max: n ? urut[n - 1] : null,
    vonis: null,
    alasan: null,
  }

  if (n < MIN_TAHUN) {
    dasar.alasan = `Riwayat baru ${n} tahun — vonis butuh minimal ${MIN_TAHUN}.`
    return dasar
  }
  if (dasar.kini == null) {
    dasar.alasan = 'Rasio saat ini belum tersedia.'
    return dasar
  }
  dasar.vonis = dasar.kini < dasar.q1! ? 'murah' : dasar.kini > dasar.q3! ? 'mahal' : 'wajar'
  return dasar
}

/** Rasio saat ini pada basis deret: harga terkini ÷ ruas per-saham basis-hari-ini. */
export function rasioKini(harga: number | null | undefined, perSaham: number | null | undefined): number | null {
  if (harga == null || perSaham == null || !Number.isFinite(harga) || !Number.isFinite(perSaham)) return null
  if (perSaham <= 0) return null
  return harga / perSaham
}

/* ── Pemuat berkas (cache modul, pola sama sektorIdx.ts) ── */

let cache: DaftarValuasi | null = null
let sedangAmbil: Promise<DaftarValuasi> | null = null

export function muatValuasi(): Promise<DaftarValuasi> {
  if (cache) return Promise.resolve(cache)
  if (!sedangAmbil) {
    sedangAmbil = fetch('/data-idx/json/valuasi_historis.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: DaftarValuasi) => {
        cache = d
        return d
      })
      .finally(() => {
        sedangAmbil = null
      })
  }
  return sedangAmbil
}

export function useValuasiHistoris() {
  const [daftar, setDaftar] = useState<DaftarValuasi | null>(cache)
  useEffect(() => {
    if (cache) return
    let batal = false
    muatValuasi()
      .then((d) => !batal && setDaftar(d))
      .catch(() => {})
    return () => {
      batal = true
    }
  }, [])
  return daftar
}

/** `null` = belum termuat ATAU emiten tak punya deret. Dua keadaan berbeda,
 *  tapi layar memperlakukannya sama: "belum tersedia", bukan angka nol. */
export function valuasiEmiten(daftar: DaftarValuasi | null, kode: string): DeretValuasi | null {
  return daftar?.emiten[kode.toUpperCase()] ?? null
}
