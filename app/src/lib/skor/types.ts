/** Tipe data edisi Arus Pasar — cermin bentuk JSON di arus-pasar/edisi/*.json */

export interface Pivot {
  P: number
  R1: number
  R2: number
  R3: number
  S1: number
  S2: number
  S3: number
}

export interface OhlcHari {
  o: number
  h: number
  l: number
  c: number
  chg: number
  pct: number
  vol_juta: number
}

/** Baris broker: [kode, nilai_juta, lot, avg] — tuple gaya build.py, bukan objek. */
export type BarisBroker = [string, number, number, number]

export interface Emiten {
  ticker: string
  nama: string
  ohlc_hari: OhlcHari
  ema50: number
  pivot: Pivot
  pivot_ragu: string[]
  slider_pct: number
  beli: BarisBroker[]
  jual: BarisBroker[]
  label: string
  arah: 'bull' | 'bear'
  risiko: string
  flow_kelas: string
  narasi_flow: string
  narasi_teknikal: string
  strategi: string
  invalidation: string
  target: string
  konsekuensi: string
  rationale_rank: string
}

export interface PeranBroker {
  ritel: string[]
  scalper: string[]
}

export interface Edisi {
  edisi: string
  tanggal: string
  tanggal_id: string
  tanggal_flow: string
  ihsg_baris: string
  catatan_verifikasi: string
  peran_broker: PeranBroker
  emiten: Emiten[]
}

export interface OhlcBar {
  d: string
  o: number
  h: number
  l: number
  c: number
  v: number
}

/** Peta ticker → deret bar OHLC (mengandung juga "JKSE" untuk IHSG). */
export type OhlcMap = Record<string, OhlcBar[]>

export interface Skor {
  teknikal: number
  flow: number
  rr: number
  lik: number
  ihsg: number
  korr: number
  total: number
  risiko: 'MENENGAH' | 'TINGGI' | 'EKSTREM'
}
