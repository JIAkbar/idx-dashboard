import type { ReactNode } from 'react'
import { LABEL_RENTANG } from '../../../lib/dasbor/periode'
import { potongRentang as potongRentangBaku, type IdRentang } from '../../../lib/dasbor/rentang'

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
// Definisi pindah ke modul BERSAMA `lib/dasbor/rentang.ts` (spek konsistensi
// §2) — empat kosakata rentang lahir justru dari tiap halaman mengeja
// presetnya sendiri. Yang di sini tinggal pembungkus: subset id Neo + adaptor
// ruas `t`. Migrasi 27 Agu: '2w'→'w2' (masuk LABEL_RENTANG), +y1/y3/y5.

export type RentangNp = Extract<IdRentang, 'w2' | 'b1' | 'b3' | 'b6' | 'ytd' | 'y1' | 'y3' | 'y5' | 'semua'>
export const OPSI_RENTANG_NP: { id: RentangNp; label: string }[] =
  (['w2', 'b1', 'b3', 'b6', 'ytd', 'y1', 'y3', 'y5', 'semua'] as const)
    .map((id) => ({ id, label: LABEL_RENTANG[id] }))

/** Potong deret ke rentang, mundur dari bar TERAKHIR — delegasi modul bersama. */
export function potongRentang<T extends { t: string }>(bars: T[], rentang: RentangNp): T[] {
  return potongRentangBaku(bars, rentang, (b) => b.t)
}
