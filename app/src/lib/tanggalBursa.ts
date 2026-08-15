/**
 * Tanggal acuan untuk semua form setoran admin.
 *
 * Dulu fungsi ini disalin apa adanya di empat berkas (UnggahHarian,
 * BedahUnggah, RadarUnggah, AdminTanggalContext) — dan keempatnya membawa bug
 * yang sama: mengembalikan tanggal kalender apa adanya, sehingga pada Sabtu
 * dan Minggu form terisi tanggal yang tak punya penutupan sama sekali.
 *
 * Akibatnya bukan cuma janggal. DatePicker hanya menampilkan Senin–Jumat,
 * jadi tanggal akhir pekan itu tak muncul di grid dan TAK BISA dikoreksi
 * dengan mengklik; setorannya tetap tersimpan, ke tanggal yang tak akan
 * pernah punya edisi. Ketahuan 16 Agu 2026: tiga setoran tercatat di Sabtu
 * 15 Agu, padahal isinya penutupan Jumat 14 Agu.
 */

/** Hari BURSA terakhir dalam format `YYYY-MM-DD`, waktu lokal peramban.
 *
 *  Hari libur nasional belum diperhitungkan — daftarnya ada di kalender bursa
 *  tapi belum disambungkan ke sini. Akhir pekan menutup sebagian besar
 *  kasusnya; libur nasional menyisakan celah yang lebih jarang, dan lebih
 *  kelihatan karena tanggalnya juga kosong di strip kalender.
 *  ponytail: cukup akhir pekan; sambungkan daftar libur kalau ternyata
 *  setoran salah-tanggal masih terjadi di sekitar libur panjang. */
export function tanggalBursaTerakhir(kini: Date = new Date()): string {
  const d = new Date(kini)
  const hari = d.getDay()
  if (hari === 6) d.setDate(d.getDate() - 1)      // Sabtu → Jumat
  else if (hari === 0) d.setDate(d.getDate() - 2) // Minggu → Jumat
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
