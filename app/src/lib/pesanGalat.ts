/**
 * Ambil pesan yang bisa dibaca manusia dari galat apa pun.
 *
 * Kenapa ini perlu: pola `e instanceof Error ? e.message : 'Gagal ...'` yang
 * tersebar di aplikasi ini SELALU jatuh ke teks cadangan untuk galat Supabase.
 * `PostgrestError` (dan saudara-saudaranya di supabase-js v2) adalah objek
 * biasa `{ message, details, hint, code }` — bukan turunan `Error`. Jadi
 * pengecekan instanceof itu false, pesan asli server tidak pernah sampai ke
 * layar, dan yang tersisa cuma kalimat seperti "Gagal menyimpan." yang tidak
 * memberi tahu apa-apa. Terlihat langsung di tab Akses, 15 Agustus 2026:
 * penyimpanan gagal tanpa sebab yang bisa dilacak dari layar.
 *
 * Yang dibaca, berurutan: Error.message → properti `message` objek apa pun →
 * teks mentah kalau galatnya berupa string. Kalau semuanya kosong, barulah
 * `cadangan` dipakai.
 */
export function pesanGalat(e: unknown, cadangan = 'Terjadi galat yang tidak terduga.'): string {
  if (typeof e === 'string' && e.trim()) return e
  if (e instanceof Error && e.message) return e.message

  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>
    const pesan = typeof o.message === 'string' ? o.message.trim() : ''
    if (pesan) {
      // `details`/`hint` Postgres kerap memuat sebab sebenarnya ("new row
      // violates row-level security policy"), sementara `message` cuma
      // menyebut gejalanya. Disatukan supaya tidak perlu buka konsol.
      const rinci = typeof o.details === 'string' ? o.details.trim() : ''
      const petunjuk = typeof o.hint === 'string' ? o.hint.trim() : ''
      const ekor = [rinci, petunjuk].filter((t) => t && t !== pesan).join(' ')
      return ekor ? `${pesan} — ${ekor}` : pesan
    }
  }
  return cadangan
}
