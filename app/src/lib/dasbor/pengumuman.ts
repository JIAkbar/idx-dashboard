/**
 * Pengumuman sistem — satu tempat, satu sakelar.
 *
 * Dibuat 25 Agu 2026 atas permintaan Johan: *"buatakan toast atau modal
 * ketika buka papan"* · *"berikan peringatan atau pesan jika data tidak
 * update karena sistem sedang upgrade mesin dan update fitur"*.
 *
 * ## Kenapa berkas konfigurasi, bukan teks di dalam komponen
 *
 * Pengumuman ini akan DIMATIKAN, dan biasanya buru-buru. Kalau teksnya
 * tertanam di JSX, mematikannya berarti menyunting komponen — dan yang
 * benar-benar terjadi di situasi begitu adalah orang mengomentari blok JSX
 * lalu lupa membuangnya. Di sini cukup `aktif: false`, satu baris, dan
 * riwayat teksnya tetap terbaca di git.
 *
 * ## `id` adalah kunci ingatan, dan itu disengaja
 *
 * Pengguna yang menutup pengumuman tak boleh melihatnya lagi tiap pindah
 * halaman. Penutupan disimpan per-`id`. Konsekuensinya: **mengubah `pesan`
 * saja TIDAK memunculkannya kembali** ke orang yang sudah menutupnya — untuk
 * itu `id`-nya harus ikut diganti. Ini bukan efek samping, ini kendalinya:
 * perbaikan kata tak perlu mengganggu siapa pun, kabar baru perlu.
 */

export type NadaPengumuman = 'info' | 'peringatan'

export interface Pengumuman {
  aktif: boolean
  /** Ganti nilai ini kalau pengumumannya harus muncul lagi ke SEMUA orang,
   *  termasuk yang sudah menutup versi sebelumnya. */
  id: string
  nada: NadaPengumuman
  judul: string
  pesan: string
}

export const PENGUMUMAN: Pengumuman = {
  aktif: true,
  id: 'upgrade-2026-08',
  nada: 'peringatan',
  judul: 'Sebagian data belum diperbarui',
  pesan:
    'Kami sedang meningkatkan mesin pengumpul data dan memasang beberapa fitur baru. ' +
    'Selama pengerjaan, sebagian angka bisa tertinggal beberapa hari dari bursa — ' +
    'terutama data broker dan ringkasan harian. Angka yang sudah tampil tetap sahih, ' +
    'hanya belum tentu yang terbaru. Terima kasih sudah menunggu.',
}

const AWALAN = 'papan:pengumuman:'

/** Sudah ditutup pengguna? `false` juga saat localStorage tak bisa diakses
 *  (mode privat, storage penuh) — lebih baik pengumuman muncul dua kali
 *  daripada peringatan soal data basi tak pernah terbaca sama sekali. */
export function sudahDitutup(id: string): boolean {
  try {
    return localStorage.getItem(AWALAN + id) === '1'
  } catch {
    return false
  }
}

export function tandaiDitutup(id: string): void {
  try {
    localStorage.setItem(AWALAN + id, '1')
  } catch {
    // Gagal menyimpan bukan alasan menahan penutupan di layar — pengguna
    // sudah menekan tombolnya, dan pitanya tetap hilang untuk sesi ini.
  }
}
