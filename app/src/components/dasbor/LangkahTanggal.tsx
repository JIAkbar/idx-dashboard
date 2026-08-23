/**
 * Panah langkah kiri/kanan — satu bentuk untuk seluruh aplikasi (#170, K1).
 *
 * Audit `docs/audit-kendali.md` §3.1.2 menemukan LIMA implementasi panah yang
 * berbeda ukuran, dua di antaranya di dalam `DatePicker.tsx` yang justru
 * komponen kanonisnya sendiri (24px untuk nav bulan, 26×32px untuk stepper
 * hari). Tak satu pun mencapai 44px, sementara sel tanggal yang diapitnya
 * (`.cg.ada`, `.csb-d`) sudah 44px — itulah yang dibaca Johan sebagai
 * *"box kalender besar tapi tombol kiri kanan nya kecil gak presisi"*.
 *
 * Dua ukuran visual, satu target sentuh:
 *
 * - `penuh` (bawaan) — kotak 44×44 sungguhan. Dipakai saat panah berdiri di
 *   sebelah kendali besar (strip hari kalender, grid bulan, stepper edisi
 *   Radar), tempat panah kecil terlihat tak seimbang.
 * - `sebaris` — kotak 32×32 supaya sejajar dengan field/tab 32px yang sudah
 *   jadi baku (#77b), tetapi area kliknya tetap 44×44 lewat `::after` yang
 *   melebar keluar. Ini yang dipakai mengapit field DatePicker: memaksa 44px
 *   visual di sana akan membuat panah lebih tinggi daripada field-nya.
 *
 * Yang TIDAK ditangani komponen ini: paginasi berteks panjang ("‹ Lebih baru")
 * di Kabar/Aktivitas Admin/Rak Terbitan. Audit §3.6.2 menyebutnya boleh
 * dipisah asal disepakati eksplisit — dan memang beda kebutuhan: labelnya
 * bagian dari makna tombol, bukan sekadar arah.
 */
export function LangkahTanggal({
  arah,
  onClick,
  label,
  disabled = false,
  ukuran = 'penuh',
  ganda = false,
  className = '',
}: {
  arah: 'mundur' | 'maju'
  onClick: () => void
  /** Dipakai sekaligus sebagai `aria-label` dan `title` — panah tanpa teks
   *  tak punya nama lain, dan judulnya juga yang menjelaskan tujuan langkah
   *  ("Hari bursa sebelumnya", bukan "Mundur"). */
  label: string
  disabled?: boolean
  ukuran?: 'penuh' | 'sebaris'
  /** Panah GANDA (mis. «/») untuk langkah yang lebih besar — dipakai saat dua
   *  langkah berbeda skala berdiri bersebelahan dan harus bisa dibedakan tanpa
   *  membaca tooltip. Kalender DatePicker memakainya untuk tahun di samping
   *  bulan: sebelum ini keempat panah identik dan satu-satunya pembeda cuma
   *  judulnya, yang tak terlihat sampai kursor berhenti di atasnya. */
  ganda?: boolean
  className?: string
}) {
  const cls = ['lt', ukuran === 'sebaris' ? 'lt-sebaris' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type="button"
      className={cls}
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {ganda ? (
          <>
            <path d={arah === 'mundur' ? 'M18 6l-6 6 6 6' : 'M6 6l6 6-6 6'} />
            <path d={arah === 'mundur' ? 'M12 6l-6 6 6 6' : 'M12 6l6 6-6 6'} />
          </>
        ) : (
          <path d={arah === 'mundur' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
        )}
      </svg>
    </button>
  )
}
