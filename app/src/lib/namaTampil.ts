/** Bentuk minimal profil yang dibutuhkan utk nama tampilan — cocok dengan
 *  `ProfilSaya` (profil sendiri) maupun embed `profil` di baris `setoran`
 *  (profil orang lain, kolom Penyetor tabel unggahan). */
export interface IdentitasAlias {
  alias: string | null
  email?: string | null
}

/** Sesi minimal yang dibutuhkan — cukup `user.email`, biar tidak perlu
 *  import tipe `Session` Supabase hanya utk satu field. */
export interface IdentitasSesi {
  user: { email?: string | null }
}

/**
 * Nama tampilan pengguna: alias kalau ada & tak kosong, kalau tidak email.
 * Dipakai di header shell, modal sambutan, modal konfirmasi keluar (identitas
 * pengguna SENDIRI — profil + session, `session` jadi fallback selagi profil
 * masih memuat), dan kolom Penyetor tabel "Sudah Diunggah" (identitas orang
 * lain — embed profil dari query `setoran`, session diisi `null`).
 */
export function namaTampil(profil: IdentitasAlias | null | undefined, session: IdentitasSesi | null | undefined): string {
  const alias = profil?.alias?.trim()
  if (alias) return alias
  return profil?.email || session?.user.email || '—'
}
