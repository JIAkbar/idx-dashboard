/** Port 1:1 dari index_live.html baris 2698-2705 — format angka & badge dasbor lama. */

export function fN(v: number | null | undefined, d = 2): string {
  return (v ?? 0).toLocaleString('id-ID', { maximumFractionDigits: d })
}

export function fp(v: number | null | undefined, d = 2): string {
  // `null` WAJIB dijaga di sini, bukan cuma di pemanggil: `null >= 0` bernilai
  // true di JS, jadi cabang tanda lolos lalu `.toFixed` meledak dan SELURUH
  // halaman jadi layar kosong tanpa satu pun galat yang terbaca pembaca.
  // Terjadi 21 Agu 2026 di tab Semua Kartu Analisa begitu populasinya naik
  // 381 -> 963 emiten: emiten yang riwayatnya baru sehari punya `chg` null,
  // keadaan yang mustahil selama daftarnya masih disaring ambang 250 lilin.
  if (v == null || !Number.isFinite(v)) return '—'
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
