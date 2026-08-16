import type { PeriodeKeuangan, QuarterMap, StockFundamental, YearMap } from './stockDetailData'

/**
 * A0: satukan `keuangan/{TICKER}.json` (per-periode, presisi tapi berlubang —
 * operating_cf kosong 91% di kuartal terbaru) dengan `fundamental/{TICKER}.json`
 * (967 emiten, tapi cuma TTM/kuartal-flat) jadi satu angka per baris tabel
 * Laporan Keuangan, TANPA menyamarkan dari mana angkanya berasal.
 *
 * Terukur di 639 emiten (scripts/ukur_gabungan_fundamental.py), kolom kuartal
 * terbaru: operating_cf 8.5%→99.4% terisi, eps 29.0%→99.8%, gross_profit
 * 87.9%→100%. `cogs` & `total_liabilities` historis tetap kosong di sebagian
 * kecil kasus — tak ada padanannya di kedua sumber, sengaja dibiarkan null.
 *
 * ATURAN (jangan diubah tanpa mengukur ulang skripnya):
 * 1. `keuangan` MENANG kalau isinya ada — itu angka per periode, paling spesifik.
 * 2. Kalau kosong, coba padanan **periode yang sama persis** dari fundamental:
 *    `q_*` (Record<tahun, Record<"Q1".."Q4", angka>>) untuk kuartal,
 *    `hist_*` (Record<tahun, angka>) untuk tahunan. Ini BUKAN percampuran
 *    periode — granularitasnya identik, cuma sumbernya beda.
 * 3. Kalau masih kosong DAN ini periode PALING BARU di seluruh riwayat
 *    (bukan cuma yang ditampilkan di tabel), baru pakai TTM (`ttm_*`) untuk
 *    baris arus (Pendapatan..Laba Bersih, Arus Kas) atau snapshot kini
 *    (`lq_*`) untuk baris neraca. TTM = 12 bulan terakhir, BUKAN kuartal
 *    tunggal — dipakai HANYA di periode terbaru (di mana TTM kurang-lebih
 *    mewakili "kondisi sekarang") dan asalnya wajib ditandai jelas ke
 *    pembaca (lihat KolomLaporan.tsx: superscript + tooltip), tidak pernah
 *    ditumpuk diam-diam ke periode historis.
 * 4. Field tanpa padanan di manapun (`cogs`, `total_liabilities` untuk
 *    historis) tetap null — tidak dikira-kira.
 */

export type AsalAngka =
  | 'keuangan'
  | 'fundamental-kuartal'
  | 'fundamental-tahunan'
  | 'fundamental-ttm'
  | 'fundamental-kini'

export interface AngkaGabungan {
  nilai: number | null
  /** null = tak ada padanan di kedua sumber. */
  asal: AsalAngka | null
}

export type PeriodeGabungan = Record<keyof PeriodeKeuangan, AngkaGabungan>

const PADANAN_KUARTAL: Partial<Record<keyof PeriodeKeuangan, keyof StockFundamental>> = {
  revenue: 'q_revenue',
  net_income: 'q_net_income',
  eps: 'q_eps',
  gross_profit: 'q_gross',
  operating_income: 'q_op_income',
  total_assets: 'q_assets',
  equity: 'q_equity',
  total_debt: 'q_debt',
  cash: 'q_cash',
  operating_cf: 'q_ocf',
  free_cf: 'q_fcf',
}

const PADANAN_TAHUNAN: Partial<Record<keyof PeriodeKeuangan, keyof StockFundamental>> = {
  revenue: 'hist_revenue',
  gross_profit: 'hist_gross_profit',
  operating_income: 'hist_operating_income',
  net_income: 'hist_net_income',
  eps: 'hist_eps',
  free_cf: 'hist_fcf',
  total_assets: 'hist_total_assets',
  equity: 'hist_total_equity',
  total_debt: 'hist_total_debt',
}

/** Baris "arus" (laba rugi + arus kas) — padanan TTM cuma masuk akal di periode terbaru. */
const PADANAN_TTM: Partial<Record<keyof PeriodeKeuangan, keyof StockFundamental>> = {
  revenue: 'ttm_revenue',
  gross_profit: 'ttm_gross',
  operating_income: 'ttm_op_income',
  net_income: 'ttm_net_income',
  eps: 'eps', // field `eps` di fundamental adalah trailing/TTM, bukan forward
  operating_cf: 'ttm_ocf',
  investing_cf: 'ttm_icf',
  financing_cf: 'ttm_fincf',
  free_cf: 'ttm_fcf',
}

/** Baris neraca — snapshot "kuartal terakhir" fundamental, bukan TTM (bukan flow). */
const PADANAN_KINI: Partial<Record<keyof PeriodeKeuangan, keyof StockFundamental>> = {
  total_assets: 'lq_assets',
  total_liabilities: 'lq_tot_liab',
  equity: 'lq_equity',
  cash: 'lq_cash',
  total_debt: 'lq_total_debt',
}

function bacaQuarterMap(fd: StockFundamental, field: keyof StockFundamental, iso: string): number | null {
  const map = fd[field] as QuarterMap | undefined
  if (!map) return null
  const [tahun, bulan] = iso.split('-')
  const q = Math.ceil(Number(bulan) / 3)
  const v = map[tahun]?.[`Q${q}`]
  return typeof v === 'number' ? v : null
}

function bacaYearMap(fd: StockFundamental, field: keyof StockFundamental, iso: string): number | null {
  const map = fd[field] as YearMap | undefined
  if (!map) return null
  const v = map[iso.split('-')[0]]
  return typeof v === 'number' ? v : null
}

function bacaSkalar(fd: StockFundamental, field: keyof StockFundamental): number | null {
  const v = fd[field]
  return typeof v === 'number' ? v : null
}

/** Gabungkan satu baris (satu field) untuk satu periode. `terbaru` = ini periode
 * paling akhir di seluruh riwayat kd.kuartal/kd.tahunan (bukan cuma yang tertampil). */
export function gabungkanBaris(
  field: keyof PeriodeKeuangan,
  nilaiKeuangan: number | null,
  iso: string,
  mode: 'kuartal' | 'tahunan',
  fd: StockFundamental | null | undefined,
  terbaru: boolean,
): AngkaGabungan {
  if (nilaiKeuangan != null) return { nilai: nilaiKeuangan, asal: 'keuangan' }
  if (!fd) return { nilai: null, asal: null }

  if (mode === 'kuartal') {
    const qField = PADANAN_KUARTAL[field]
    if (qField) {
      const v = bacaQuarterMap(fd, qField, iso)
      if (v != null) return { nilai: v, asal: 'fundamental-kuartal' }
    }
  } else {
    const hField = PADANAN_TAHUNAN[field]
    if (hField) {
      const v = bacaYearMap(fd, hField, iso)
      if (v != null) return { nilai: v, asal: 'fundamental-tahunan' }
    }
  }

  if (terbaru) {
    const ttmField = PADANAN_TTM[field]
    if (ttmField) {
      const v = bacaSkalar(fd, ttmField)
      if (v != null) return { nilai: v, asal: 'fundamental-ttm' }
    }
    const kiniField = PADANAN_KINI[field]
    if (kiniField) {
      const v = bacaSkalar(fd, kiniField)
      if (v != null) return { nilai: v, asal: 'fundamental-kini' }
    }
  }

  return { nilai: null, asal: null }
}

const SEMUA_FIELD: (keyof PeriodeKeuangan)[] = [
  'revenue', 'cogs', 'gross_profit', 'operating_income', 'net_income', 'eps',
  'total_assets', 'total_liabilities', 'equity', 'cash', 'total_debt',
  'operating_cf', 'investing_cf', 'financing_cf', 'free_cf',
]

/** Gabungkan satu periode penuh (seluruh baris tabel sekaligus). */
export function gabungkanPeriode(
  nilaiKeuangan: PeriodeKeuangan,
  iso: string,
  mode: 'kuartal' | 'tahunan',
  fd: StockFundamental | null | undefined,
  terbaru: boolean,
): PeriodeGabungan {
  const hasil = {} as PeriodeGabungan
  for (const field of SEMUA_FIELD) {
    hasil[field] = gabungkanBaris(field, nilaiKeuangan[field], iso, mode, fd, terbaru)
  }
  return hasil
}

/** Label ringkas asal angka, dipakai di tooltip sel tabel. */
export function labelAsal(asal: AsalAngka): string {
  switch (asal) {
    case 'keuangan': return 'laporan kuartalan/tahunan'
    case 'fundamental-kuartal': return 'fundamental — kuartal padanan'
    case 'fundamental-tahunan': return 'fundamental — tahun padanan'
    case 'fundamental-ttm': return 'fundamental — TTM (12 bulan terakhir, bukan periode tunggal)'
    case 'fundamental-kini': return 'fundamental — kuartal terakhir yang diketahui'
  }
}
