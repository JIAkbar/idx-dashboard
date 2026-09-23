import { MIN_SAMPEL_PERSEN } from './berkasRekam'
import { urlData } from './baseData'

/**
 * Rapor Uji (#221 opsi a, docs/spek-dev-papan/spek_rapor_uji_221.md) — pilihan
 * dan sinyal PAPAN dinilai SESUDAH kejadian lewat `scripts/riset/rapor_uji.py`.
 *
 * Sinyal mesin (OBV, RBS) dicatat pada hari terjadinya dan catatan lama TIDAK
 * PERNAH ditulis ulang — jadi angka di halaman ini tak bisa disetel sesudah
 * hasilnya kelihatan. Modul ini murni memuat + menyimpulkan kalimat vonis;
 * penghitungan trade dan angka acak ada di skrip Python.
 */

export interface HorizonStat {
  win_rate: number | null
  pf: number | null
  rata: number | null
  median: number | null
  acak_p50_pf: number | null
  acak_p95_pf: number | null
  acak_rata: number | null
  ihsg_rata: number | null
}

export interface SumberRapor {
  n_total: number
  n_selesai_h5: number
  n_selesai_h20: number
  h5: HorizonStat
  h20: HorizonStat
}

export type Kelompok = 'redaksi' | 'obv' | 'rbs'
export type Horizon = 'h5' | 'h20'

export interface PilihanRapor {
  tanggal: string
  kode: string
  sumber: Kelompok
  masuk: number | null
  h5: number | null
  h20: number | null
  status: 'selesai' | 'menunggu'
}

/** Bentuk `riset` BELUM tetap — ditulis riset #221 lain (arah 1 & 2), bisa
 *  `null` kalau berkasnya belum ada. Dibaca apa adanya, bukan ditebak. */
export interface RisetArah {
  nama?: string
  vonis?: string
  [k: string]: unknown
}
export interface RisetFormula {
  arah?: RisetArah[]
  [k: string]: unknown
}

export interface RaporUji {
  diperbarui: string
  data_per: string | null
  /** Tanggal pertama sinyal mesin dicatat (`log_sinyal.json` "mulai") —
   *  catatan lama TIDAK PERNAH ditulis ulang sejak tanggal ini. */
  mulai: string | null
  sumber: Record<Kelompok, SumberRapor>
  pilihan: PilihanRapor[]
  riset: RisetFormula | null
}

export async function muatRaporUji(): Promise<RaporUji | null> {
  try {
    const r = await fetch(urlData('/data-idx/json/rapor_uji.json'))
    if (!r.ok) return null
    return (await r.json()) as RaporUji
  } catch {
    return null
  }
}

function nSelesai(k: SumberRapor, h: Horizon): number {
  return h === 'h5' ? k.n_selesai_h5 : k.n_selesai_h20
}

/**
 * Ambang sampel sebelum win rate boleh dicetak persen — SAMA dengan
 * `MIN_SAMPEL_PERSEN` (berkasRekam.ts), bukan didefinisikan ulang di sini.
 */
export function layakPersen(n: number): boolean {
  return n >= MIN_SAMPEL_PERSEN
}

/**
 * Kalimat vonis satu kelompok pada satu horizon (spek §2):
 * n selesai < 30 -> belum bisa disimpulkan; pf di atas persentil-95 acak ->
 * lebih baik dari 95% acak; di atas median acak (tapi bukan p95) -> di atas
 * rata-rata; selain itu -> tidak lebih baik dari acak.
 */
export function vonis(kelompok: SumberRapor, horizon: Horizon): string {
  const n = nSelesai(kelompok, horizon)
  if (n < 30) return `Belum bisa disimpulkan: baru ${n} pilihan selesai.`
  const s = kelompok[horizon]
  if (s.pf != null && s.acak_p95_pf != null && s.pf > s.acak_p95_pf) {
    return 'Lebih baik dari 95% pilihan acak di tanggal yang sama.'
  }
  if (s.pf != null && s.acak_p50_pf != null && s.pf > s.acak_p50_pf) {
    return 'Di atas rata-rata acak, tapi belum melewati batas keberuntungan.'
  }
  return 'Tidak lebih baik dari pilihan acak.'
}
