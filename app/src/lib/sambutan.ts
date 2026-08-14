/**
 * Keputusan modal sambutan admin (#shell-tab perbaikan B) — dulu dikunci
 * `sessionStorage[user.id]` (hilang tiap refresh tab BARU tapi juga hilang
 * cuma karena tab ditutup, jadi user melapor modal "kelewat sering").
 *
 * Yang diinginkan: sekali per SESI LOGIN, bukan sekali per tab. Kuncinya
 * dipindah ke localStorage (`sambut:<user.id>`), dan nilainya bukan
 * timestamp waktu-buka melainkan PENANDA sesi login — `user.last_sign_in_at`.
 * Field itu:
 *  - stabil selama sesi yang sama, termasuk saat Supabase diam-diam me-refresh
 *    access_token di background (access_token/expires_at berubah tiap
 *    refresh — kalau dipakai sebagai penanda, modal bisa muncul lagi padahal
 *    user belum keluar sama sekali, cuma tab dibiarkan lama);
 *  - berubah tiap kali user benar-benar sign-in ulang (keluar lalu masuk
 *    lagi, atau ganti akun).
 * Jadi: refresh halaman / pindah tab & balik → penanda sama → tidak muncul.
 * Keluar lalu masuk lagi → penanda baru → muncul lagi.
 */

/** Kunci localStorage per user — dipakai AdminLayout baca/tulis penanda. */
export function kunciSambutan(userId: string): string {
  return `sambut:${userId}`
}

/** Fungsi murni (gampang diuji): dibanding penanda tersimpan vs penanda sesi
 *  aktif. `null` (belum pernah login / belum ada sesi) → jangan tampilkan. */
export function perluSambutan(markerTersimpan: string | null, markerSaatIni: string | null | undefined): boolean {
  if (!markerSaatIni) return false
  return markerTersimpan !== markerSaatIni
}
