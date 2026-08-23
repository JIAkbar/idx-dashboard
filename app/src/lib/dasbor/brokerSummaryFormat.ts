/** Port fmtB() index_live.html baris 5719-5727 — format ringkas Rupiah. */
export function fmtB(n: number): string {
  if (!n) return '0'
  const a = Math.abs(n)
  const s = n < 0 ? '-' : ''
  if (a >= 1e12) return s + (a / 1e12).toFixed(2) + 'T'
  if (a >= 1e9) return s + (a / 1e9).toFixed(2) + 'B'
  if (a >= 1e6) return s + (a / 1e6).toFixed(1) + 'M'
  return n.toLocaleString('id-ID')
}

/**
 * Port fmtLot() index_live.html baris 5728-5733 — format ringkas volume lot.
 * Sumber asli tidak menangani angka negatif (Foreign Net bisa minus) — di sini
 * dipakai Math.abs seperti fmtB, supaya "-206.6M lot" bukan angka mentah.
 */
export function fmtLot(n: number): string {
  const a = Math.abs(n)
  const s = n < 0 ? '-' : ''
  if (a >= 1e9) return s + (a / 1e9).toFixed(1) + 'G lot'
  if (a >= 1e6) return s + (a / 1e6).toFixed(1) + 'M lot'
  if (a >= 1e3) return s + (a / 1e3).toFixed(1) + 'K lot'
  return n + ' lot'
}

/**
 * Sama seperti `fmtLot` tapi TANPA sufiks " lot" — buat besaran yang bukan
 * lot bursa (lembar saham tercatat, jumlah pemegang saham, dst). `fmtLot`
 * sengaja tidak dipakai ulang di sini: menempelkan " lot" ke lembar/jumlah
 * pemegang salah label, bukan cuma salah kosmetik (Shareholders tab #187).
 */
export function fmtRingkas(n: number): string {
  const a = Math.abs(n)
  const s = n < 0 ? '-' : ''
  if (a >= 1e9) return s + (a / 1e9).toFixed(1) + 'G'
  if (a >= 1e6) return s + (a / 1e6).toFixed(1) + 'M'
  if (a >= 1e3) return s + (a / 1e3).toFixed(1) + 'K'
  return n.toLocaleString('id-ID')
}
