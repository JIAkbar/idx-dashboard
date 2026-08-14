const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Kirim jejak login ke Edge Function `jejak-login` (Fase 4, sudah live) —
 * IP & user agent dicatat DI SERVER dari header request (bukan dikirim dari
 * sini). Dipanggil dari AuthContext.signIn tepat setelah signInWithPassword
 * selesai, baik sukses maupun gagal. Fire-and-forget dengan catch kosong —
 * pencatatan gagal TIDAK BOLEH menghalangi/menunda proses masuk.
 */
export function jejakLogin(berhasil: boolean, email: string, id?: string): void {
  fetch(`${url}/functions/v1/jejak-login`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ berhasil, email, id }),
  }).catch(() => {})
}
