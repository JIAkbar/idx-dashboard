/**
 * Terjemahan pesan galat Supabase Auth ke kalimat yang bisa ditindaklanjuti.
 *
 * Supabase menjawab dalam bahasa Inggris teknis ("Invalid login credentials"),
 * dan itu bocor apa adanya ke layar pengguna. Selain asing, pesan aslinya juga
 * tidak memberi tahu apa yang harus dilakukan.
 *
 * Catatan keamanan yang disengaja: pesan untuk email tidak dikenal dan sandi
 * salah dibuat SAMA. Membedakannya ("email tidak terdaftar" vs "sandi salah")
 * berarti memberi tahu penebak alamat mana yang punya akun di sini.
 */
const PETA: Array<[RegExp, string]> = [
  [/invalid login credentials/i,
   'Email atau kata sandi tidak cocok. Periksa lagi, huruf besar-kecil berpengaruh.'],
  [/email not confirmed/i,
   'Akun ini belum dikonfirmasi. Minta superadmin mengaktifkannya.'],
  [/user not found/i,
   'Email atau kata sandi tidak cocok. Periksa lagi, huruf besar-kecil berpengaruh.'],
  [/email rate limit|over_email_send_rate_limit/i,
   'Terlalu banyak permintaan surel dalam waktu singkat. Tunggu beberapa menit.'],
  [/too many requests|rate limit/i,
   'Terlalu sering mencoba. Tunggu sebentar sebelum mencoba lagi.'],
  [/password should be at least/i,
   'Kata sandi terlalu pendek — minimal 8 karakter.'],
  [/user is banned/i,
   'Akun ini sedang diblokir. Hubungi superadmin.'],
  [/network|fetch|failed to fetch/i,
   'Sambungan ke server gagal. Periksa koneksi lalu coba lagi.'],
]

export function pesanAuth(asli: string | null | undefined): string | null {
  if (!asli) return null
  for (const [pola, terjemahan] of PETA) {
    if (pola.test(asli)) return terjemahan
  }
  // Pesan tak dikenal: tampilkan apa adanya daripada menelannya jadi "terjadi
  // kesalahan" — informasi mentah masih lebih berguna untuk melapor.
  return asli
}
