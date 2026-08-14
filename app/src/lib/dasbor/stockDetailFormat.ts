/**
 * Format helper khusus Stock Detail — port 1:1 dari helper lokal di dalam
 * fdRender()/fdValuationHtml() index_live.html baris 4034-4042 & 4248-4250.
 * Helper lama yang didefinisikan tapi TIDAK PERNAH dipanggil di sana
 * (fdV, fdVx, fdVpct, fdVB, fdRow, fdFmt, fdFmtMktcap, fdCls — baris
 * 3870-3913) sengaja tidak diport, itu dead code di sumber.
 */

export function fv(v: number | null | undefined): string {
  return v != null ? Number(v).toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '—'
}

export function fvx(v: number | null | undefined, d = 2): string {
  return v != null ? Number(v).toFixed(d) + 'x' : '—'
}

/** Angka + tanda +/-, TANPA kelas warna (dipakai untuk teks growth polos). */
export function fp2(v: number | null | undefined, d = 1): string {
  return v != null ? (v >= 0 ? '+' : '') + Number(v).toFixed(d) + '%' : '—'
}

export function fB(v: number | null | undefined): string {
  return v != null ? (v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 0 }) + ' B' : '—'
}

/** Port fdMktcap() baris 3890-3895 — satu-satunya varian fdMktcap yang benar-benar dipakai. */
export function fMC(v: number | null | undefined): string {
  if (!v) return '—'
  if (v >= 1e13) return `Rp ${(v / 1e12).toFixed(1)} T`
  if (v >= 1e12) return `Rp ${(v / 1e12).toFixed(2)} T`
  return `Rp ${(v / 1e9).toFixed(0)} M`
}

/** Format ringkas T/M/Jt tanpa prefiks mata uang (dipakai panel Laporan Keuangan —
 * angka boleh IDR atau USD tergantung financial_currency emiten). */
export function fRingkas(v: number | null | undefined): string {
  if (v == null) return '—'
  const a = Math.abs(v)
  const s = v < 0 ? '-' : ''
  if (a >= 1e12) return s + (a / 1e12).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' T'
  if (a >= 1e9) return s + (a / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' M'
  if (a >= 1e6) return s + (a / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' Jt'
  return s + a.toLocaleString('id-ID', { maximumFractionDigits: 0 })
}

/** EPS: skala kecil (bisa < 1 untuk pelapor-USD mis. DSSA 0,0014) — desimal
 * adaptif, bukan dibulatkan T/M/Jt seperti fRingkas. */
export function fEps(v: number | null | undefined): string {
  if (v == null) return '—'
  return v.toLocaleString('id-ID', { maximumFractionDigits: Math.abs(v) < 10 ? 4 : 2 })
}
