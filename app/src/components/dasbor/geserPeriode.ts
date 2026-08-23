/**
 * Geser bulan dan/atau tahun pada kalender DatePicker.
 *
 * Dipisah dari komponen supaya bisa diuji tanpa render, dan supaya perilaku
 * lintas-tahun punya satu tempat: `new Date(tahun, bulan + n, 1)` sudah
 * menangani limpahan bulan (mis. Desember +1 -> Januari tahun berikutnya),
 * jadi kedua arah dipakaikan rumus yang sama.
 */
export function geserPeriode(
  tahun: number, bulan: number, arahBulan: number, arahTahun: number,
): { t: number; b: number } {
  const d = new Date(tahun + arahTahun, bulan + arahBulan, 1)
  return { t: d.getFullYear(), b: d.getMonth() }
}
