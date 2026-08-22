import { tanggalPendek } from '../../lib/dasbor/statistikBerkala'

/**
 * Label rentang tanggal yang SEDANG tergambar — pola `PanelAliranAsing.tsx`
 * (Johan 21 Agu 2026: "munculkan rentang waktu juga bro", 22 Agu 2026: "perlu
 * di sweep semua data yang butuh rentang diberi rentang saja selama datanya
 * ada"). `mulai`/`akhir` WAJIB datang dari titik yang benar-benar tergambar
 * (baris pertama/terakhir data), bukan dari nama preset — preset bisa
 * berbohong soal panjangnya kalau riwayat emiten lebih pendek dari presetnya.
 *
 * Kalau data tak punya tanggal yang bisa dipercaya, jangan dipanggil sama
 * sekali (bukan andalkan `null` return-nya) — itu tandanya komponen
 * pemanggil belum punya rentang untuk dilaporkan.
 */

/** Format murni, diuji `LabelRentang.test.ts` tanpa render. */
export function teksRentang(
  mulai: string | null | undefined,
  akhir: string | null | undefined,
  n?: number,
  satuan = 'hari bursa',
): string | null {
  if (!mulai || !akhir) return null
  if (mulai === akhir) return tanggalPendek(mulai)
  const inti = `${tanggalPendek(mulai)} – ${tanggalPendek(akhir)}`
  return n != null ? `${inti} · ${n} ${satuan}` : inti
}

export function LabelRentang({ mulai, akhir, n, satuan, className }: {
  mulai?: string | null
  akhir?: string | null
  n?: number
  satuan?: string
  /** Kelas TAMBAHAN (penempatan/lebar khas halaman) — bentuknya selalu `.sub`. */
  className?: string
}) {
  const teks = teksRentang(mulai, akhir, n, satuan)
  if (!teks) return null
  return <span className={className ? `sub ${className}` : 'sub'}>{teks}</span>
}
