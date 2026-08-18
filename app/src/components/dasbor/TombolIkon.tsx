import { IkonMenu } from './IkonMenu'

/**
 * Tombol ikon kecil (tutup/hapus/ubah/salin/info) — satu bentuk untuk seluruh
 * aplikasi (#170).
 *
 * Audit `docs/audit-kendali.md` §3.1.4 menemukan SEMBILAN kelas berbeda untuk
 * tugas yang sama, rentang 14px sampai 32px, nol yang mencapai 44px. Dua di
 * antaranya ada di halaman yang sama dan tetap berbeda satu sama lain
 * (Bulletin: `.blt-cari-x` 24px vs `.blt-modal-x` 32px).
 *
 * Kotak visualnya sengaja tetap kecil (32px) — tombol-tombol ini duduk di
 * dalam baris tabel padat, dan 44px sungguhan akan menaikkan tinggi tiap
 * baris. Yang wajib 44px adalah AREA KLIK, dan itu dilebarkan lewat `::after`
 * yang menembus keluar kotak (`lantai.css`, blok `.ti`). Prinsip 5 spek
 * menyebut pemisahan ini eksplisit: *"ikon di dalam boleh tetap kecil visual,
 * area klik yang wajib 44px"*.
 *
 * Konsekuensi yang harus diingat saat memakainya: dua tombol bersebelahan
 * perlu jarak minimal 12px supaya area kliknya tak saling tindih — bungkus
 * dengan `.ti-grup` yang sudah menyetel `gap` itu. Tanpa jarak, klik di celah
 * antara "ubah" dan "hapus" jatuh ke tombol yang kebetulan menang tumpukan,
 * dan yang satu itu menghapus.
 */
export function TombolIkon({
  d,
  label,
  onClick,
  nada = 'normal',
  disabled = false,
  ukuranIkon = 14,
  className = '',
}: {
  /** Path ikon dari `IkonMenu.tsx` (viewBox 24×24). */
  d: string
  /** Wajib — tombol tanpa teks tak punya nama lain. Dipakai sebagai
   *  `aria-label` sekaligus `title`. */
  label: string
  onClick: () => void
  /** `merah` untuk aksi merusak (hapus/tolak) — mengikuti modifier `.merah`
   *  yang sudah dipakai kendali lain, bukan warna inline sendiri. */
  nada?: 'normal' | 'merah'
  disabled?: boolean
  ukuranIkon?: number
  className?: string
}) {
  const cls = ['ti', nada === 'merah' ? 'merah' : '', className].filter(Boolean).join(' ')
  return (
    <button
      type="button"
      className={cls}
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <IkonMenu d={d} size={ukuranIkon} />
    </button>
  )
}
