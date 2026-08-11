/** Port 1:1 dari index_live.html baris 2698-2705 — format angka & badge dasbor lama. */

export function fN(v: number | null | undefined, d = 2): string {
  return (v ?? 0).toLocaleString('id-ID', { maximumFractionDigits: d })
}

export function fp(v: number, d = 2): string {
  return (v >= 0 ? '+' : '') + v.toFixed(d) + '%'
}

export function cls(v: number): 'green' | 'red' {
  return v >= 0 ? 'green' : 'red'
}

/** Kembalikan markup badge sebagai string, sama seperti sumber asli. */
export function bdg(v: number): string {
  return `<span class="bdg ${v >= 0 ? 'bdg-g' : 'bdg-r'}">${fp(v)}</span>`
}

export function fmtNF(v: number): string {
  return (v >= 0 ? '+' : '') + v.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
