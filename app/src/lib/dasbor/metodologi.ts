/**
 * Logika murni halaman Metodologi & Glosarium (backlog C6) — dipisah dari
 * `views/dasbor/Metodologi.tsx` supaya bisa diuji tanpa merender komponen,
 * pola yang sama dengan `saringKabar`/`daftarBulan` di Kabar.tsx.
 */
import type { EntriGlosarium } from './glosarium'

export type UrutanGlosarium = 'abjad' | 'frekuensi'

export const OPSI_URUTAN: readonly { id: UrutanGlosarium; label: string }[] = [
  { id: 'abjad', label: 'Abjad' },
  { id: 'frekuensi', label: 'Frekuensi' },
]

/** Cocok kalau kata kuncinya muncul di istilah, definisi, atau contoh — tiga
 *  tempat yang benar-benar dibaca pengguna, bukan cuma kunci regex penambang
 *  (`kunci[]`) yang isinya bisa berupa pola teknis (`hit.?rate`) dan tak
 *  pantas dicocokkan sebagai teks pencarian bebas. */
export function saringGlosarium(daftar: EntriGlosarium[], q: string): EntriGlosarium[] {
  const t = q.trim().toLowerCase()
  if (!t) return daftar
  return daftar.filter(
    (e) =>
      e.istilah.toLowerCase().includes(t)
      || e.definisi.toLowerCase().includes(t)
      || (e.contoh ?? '').toLowerCase().includes(t),
  )
}

/** Abjad = urutan bawaan halaman. Frekuensi = urutan turun, istilah dari
 *  korpus PAPAN yang paling sering dipakai muncul dulu — seri dipecah abjad
 *  supaya urutannya tetap stabil, bukan acak tergantung urutan sumber. */
export function urutkanGlosarium(daftar: EntriGlosarium[], mode: UrutanGlosarium): EntriGlosarium[] {
  const salin = [...daftar]
  return mode === 'frekuensi'
    ? salin.sort((a, b) => b.frekuensi - a.frekuensi || a.istilah.localeCompare(b.istilah))
    : salin.sort((a, b) => a.istilah.localeCompare(b.istilah))
}
