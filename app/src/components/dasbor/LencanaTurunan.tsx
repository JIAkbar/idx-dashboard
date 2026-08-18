import type { StockFundamental } from '../../lib/dasbor/stockDetailData'

/**
 * Lencana superscript untuk ruas ringkas fundamental yang TIDAK datang dari
 * yfinance melainkan dihitung ulang `scripts/lengkapi_fundamental.py`.
 *
 * Alasannya sama dengan `lencanaAsal` di PanelLaporanKeuangan.tsx: angka
 * resmi bursa, angka agregator, dan angka turunan tak boleh terlihat sama
 * persis tanpa cara membedakannya. Bedanya cuma di mana asalnya disimpan —
 * di sini per BERKAS (`asal_turunan`), di sana per SEL (dihitung saat render).
 *
 * Ruas tanpa entri di `asal_turunan` = angka asli sumbernya → tak berlencana,
 * jadi mayoritas sel tetap bersih.
 */
export function LencanaTurunan({ fd, ruas }: { fd: StockFundamental; ruas: string }) {
  const asal = fd.asal_turunan?.[ruas]
  if (!asal) return null
  const [tanda, judul] = asal === 'idx'
    ? ['B', 'Dihitung dari laporan resmi bursa (XBRL) — yfinance tak punya ruas ini untuk emiten ini']
    : ['≈', 'Dihitung ulang dari ruas lain di berkas ini (mis. laba TTM ÷ jumlah saham) — yfinance tak punya ruas ini untuk emiten ini']
  return <sup title={judul} style={{ color: 'var(--text3)' }}>{tanda}</sup>
}
