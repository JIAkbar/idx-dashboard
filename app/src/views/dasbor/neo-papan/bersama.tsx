import type { ReactNode } from 'react'
import { LABEL_RENTANG } from '../../../lib/dasbor/periode'

/**
 * Neo Papan — bagian yang dipakai bersama seluruh 8 tab: format angka,
 * kotak "Sumber:", keadaan kosong, kartu KV. Pola sama dengan KuliPapan.tsx,
 * dipindah ke berkas sendiri karena dipakai banyak komponen tab, bukan satu.
 */

export const rp = (n: number, d = 0) =>
  'Rp ' + n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
export const num = (n: number, d = 0) =>
  n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
export const pct = (n: number, d = 2) => (n > 0 ? '+' : '') + num(n, d) + '%'
/** Ringkas B/M/T — dipakai nilai transaksi & kapitalisasi yang bisa triliunan. */
export function fmtB(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const a = Math.abs(n)
  const s = n < 0 ? '-' : ''
  if (a >= 1e12) return s + num(a / 1e12, 2) + ' T'
  if (a >= 1e9) return s + num(a / 1e9, 2) + ' B'
  if (a >= 1e6) return s + num(a / 1e6, 1) + ' M'
  return num(n)
}

export function Sumber({ children }: { children: ReactNode }) {
  return <p className="np-sumber"><b>Sumber:</b> {children}</p>
}

export function Kosong({ children }: { children: ReactNode }) {
  return <div className="np-kosong">{children}</div>
}

export function Kv({ label, value, warna }: { label: string; value: ReactNode; warna?: 'up' | 'dn' }) {
  return (
    <div className="np-kv">
      <span>{label}</span>
      <b className={warna}>{value}</b>
    </div>
  )
}

export function KvGrid({ children }: { children: ReactNode }) {
  return <div className="np-hasil">{children}</div>
}

/** Palet 11 warna dari token kanonis yang SUDAH ada (kelompokBroker.ts,
 *  garis pembanding #187, simpul jaringan #79) — bukan token baru, supaya
 *  Rotation/Activity tak butuh palet ke-limabelas di sistem desain. */
export const TOKEN_SERI = [
  '--blue', '--green', '--amber', '--red', '--bnd1', '--bnd2', '--bnd3',
  '--k-smart', '--k-ritel', '--k-afiliasi', '--k-lain', '--node-corp', '--node-ind',
] as const

// ── Rentang tanggal (candle/volume/asing) ───────────────────────────────────

export type RentangNp = 'b1' | 'b3' | 'ytd' | 'semua'
export const OPSI_RENTANG_NP: { id: RentangNp; label: string }[] = [
  { id: 'b1', label: LABEL_RENTANG.b1 },
  { id: 'b3', label: LABEL_RENTANG.b3 },
  { id: 'ytd', label: LABEL_RENTANG.ytd },
  { id: 'semua', label: LABEL_RENTANG.semua },
]

/** Potong deret ke rentang, mundur dari tanggal bar TERAKHIR (bukan hari ini —
 *  data historis, bukan live). UTC murni supaya tak bergeser sehari. */
export function potongRentang<T extends { t: string }>(bars: T[], rentang: RentangNp): T[] {
  if (!bars.length || rentang === 'semua') return bars
  const akhir = bars[bars.length - 1].t
  if (rentang === 'ytd') {
    const mulai = akhir.slice(0, 4) + '-01-01'
    return bars.filter((b) => b.t >= mulai)
  }
  const bulan = rentang === 'b1' ? 1 : 3
  const [y, m, d] = akhir.split('-').map(Number)
  const mulai = new Date(Date.UTC(y, m - 1 - bulan, d)).toISOString().slice(0, 10)
  return bars.filter((b) => b.t >= mulai)
}
