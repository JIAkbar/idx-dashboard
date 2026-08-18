/**
 * Pemilih rentang waktu — satu bentuk untuk seluruh aplikasi (#170, K2).
 *
 * Audit `docs/audit-kendali.md` §3.1.1 menemukan sembilan pola berbeda untuk
 * kendali yang sama, bukan lima seperti dugaan awal: pil, tab, angka tahun
 * mentah, angka tanggal telanjang. Komponen ini menggantikan enam di antaranya
 * — sisanya memang beda kebutuhan (pemilih EDISI diskrit di Radar, jendela
 * relatif-ke-sekarang di Aktivitas Admin) dan sengaja tidak dipaksa masuk.
 *
 * Labelnya WAJIB dari `LABEL_RENTANG` (`lib/dasbor/periode.ts`), bukan
 * diketik ulang per halaman. Itu satu-satunya cara "1 Tahun" / "1T" / "1 thn"
 * tidak tumbuh lagi.
 *
 * Bentuknya `.chip-t`, kelas kanonis "pilih satu dari beberapa" — bukan kelas
 * baru. Yang perlu dibungkus komponen cuma pola markupnya (grup ber-nama,
 * state `.on`, `aria-pressed`), karena itu yang selama ini disalin dan
 * tiap salinan kehilangan sesuatu.
 */
export function PemilihRentang<T extends string>({
  opsi,
  nilai,
  onGanti,
  ariaLabel = 'Rentang waktu',
  className = '',
}: {
  /** `nonaktif` = pilihan TETAP TERLIHAT tapi tak bisa ditekan (pola sama
   *  dengan `OpsiDropdown.nonaktif`). Dipakai saat datanya memang belum ada —
   *  menyembunyikannya membuat daftar menyusut tanpa keterangan, dan
   *  membiarkannya aktif membuka layar kosong yang terbaca sebagai rusak. */
  opsi: readonly { id: T; label: string; judul?: string; nonaktif?: boolean }[]
  nilai: T
  onGanti: (id: T) => void
  ariaLabel?: string
  className?: string
}) {
  return (
    <div className={['pilih-rentang', className].filter(Boolean).join(' ')} role="group" aria-label={ariaLabel}>
      {opsi.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`chip-t${o.id === nilai ? ' on' : ''}`}
          // aria-pressed, bukan aria-selected: ini grup tombol, bukan tablist.
          // Pembaca layar mengumumkan "ditekan" — tanpa itu, satu-satunya tanda
          // pilihan aktif adalah warna, yang tak terbaca sama sekali.
          aria-pressed={o.id === nilai}
          disabled={o.nonaktif}
          title={o.judul}
          onClick={() => onGanti(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
