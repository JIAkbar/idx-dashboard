/** Panjang minimal alasan setoran non-superadmin (trim) — selaras validasi
 *  trigger server tabel `setoran` (Admin Fase 3). Fungsi murni, dipakai form
 *  unggah (AdminHome/BedahUnggah) & diuji tanpa jaringan. */
export const ALASAN_MIN = 20

/** Superadmin boleh kosong; kontributor wajib >= ALASAN_MIN karakter setelah
 *  di-trim (spasi pinggir tidak dihitung, sama seperti server). */
export function alasanValid(alasan: string, superadmin: boolean): boolean {
  return superadmin || alasan.trim().length >= ALASAN_MIN
}
