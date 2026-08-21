/**
 * Tingkat likuiditas — filter bertingkat untuk Screener & Kartu Analisa
 * (Johan 22 Agu 2026: "penting juga kedepannya ada filter likuidtas").
 * Riset acuan lengkap: `docs/likuiditas-acuan.md`.
 *
 * IDX sendiri TIDAK memakai ambang rupiah tetap untuk semesta indeks
 * utamanya (IDX80/LQ45/IDX30) — syaratnya PERINGKAT RELATIF: 150 saham
 * teratas menurut nilai transaksi pasar reguler 12 bulan terakhir. Ambang
 * rupiah absolut hanya dipakai Papan Pemantauan Khusus untuk sisi
 * SEBALIKNYA ("likuiditas rendah", < Rp5 jt/hari) — dan kriteria itu
 * sendiri sedang diusulkan BEI untuk dihapus, jadi tak layak jadi jangkar
 * jangka panjang. Di sini digabung: tiga ambang rupiah longgar (menjawab
 * "asal cukup ramai") + satu tingkat "semesta" yang meniru cara IDX sendiri
 * mengukur (menjawab "seliquid saham indeks utama").
 *
 * Ukurannya MEDIAN, bukan rata-rata: satu hari crossing raksasa (mis. DSSA
 * Rp1,42 T di pasar negosiasi, 19 Agu 2026) menaikkan rata-rata sebulan
 * tanpa membuat sahamnya benar-benar mudah dijual keesokan harinya.
 */

export interface TingkatLikuiditas {
  id: string
  label: string
  ringkas: string
  min?: number
  peringkat?: number
}

export const TINGKAT_LIKUIDITAS: TingkatLikuiditas[] = [
  { id: 'semua', label: 'Semua likuiditas', ringkas: 'Tanpa saringan likuiditas — seluruh emiten ditampilkan.' },
  { id: 'jt100', label: '≥ Rp100 jt/hari', min: 1e8, ringkas: 'Median nilai transaksi 20 hari bursa ≥ Rp100 juta/hari.' },
  { id: 'mrd1', label: '≥ Rp1 mrd/hari', min: 1e9, ringkas: 'Median nilai transaksi 20 hari bursa ≥ Rp1 miliar/hari.' },
  { id: 'mrd5', label: '≥ Rp5 mrd/hari', min: 5e9, ringkas: 'Median nilai transaksi 20 hari bursa ≥ Rp5 miliar/hari.' },
  {
    id: 'semesta', label: '150 teratas · semesta IDX80', peringkat: 150,
    ringkas: 'Meniru semesta indeks IDX80/LQ45/IDX30 — peringkat relatif, ikut bergerak bersama pasar.',
  },
]

/** Kode 150 (atau `n`) emiten dengan `nilai(b)` terbesar — dipakai tingkat
 *  "semesta" yang meniru semesta IDX80 (peringkat relatif, bukan ambang
 *  tetap). `null` diperlakukan sebagai tak-terukur, jatuh ke urutan
 *  terbawah (tak pernah masuk 150 teratas kalau memang ada 150 nilai lain
 *  yang terukur). */
export function kodePeringkatTeratas<T>(
  baris: T[], nilai: (b: T) => number | null, n: number, kode: (b: T) => string,
): Set<string> {
  return new Set(
    baris
      .map((b) => ({ kode: kode(b), v: nilai(b) }))
      .filter((x): x is { kode: string; v: number } => x.v != null)
      .sort((a, b) => b.v - a.v)
      .slice(0, n)
      .map((x) => x.kode),
  )
}

/** Uji satu baris terhadap satu tingkat likuiditas. `teratas` cuma dipakai
 *  tingkat `peringkat` (mis. "semesta") — `null` berarti belum dihitung
 *  (pemanggil belum siap kodePeringkatTeratas-nya), diperlakukan gagal. */
export function ujiLikuiditas<T>(
  b: T, tingkatId: string, nilai: (b: T) => number | null, teratas: Set<string> | null, kode: (b: T) => string,
): boolean {
  if (tingkatId === 'semua') return true
  const t = TINGKAT_LIKUIDITAS.find((x) => x.id === tingkatId)
  if (!t) return true
  if (t.peringkat != null) return teratas?.has(kode(b)) ?? false
  if (t.min != null) {
    const v = nilai(b)
    return v != null && v >= t.min
  }
  return true
}
