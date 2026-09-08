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
import { Dropdown } from './Dropdown'
import { useLayarSempit } from '../../lib/dasbor/useLayarSempit'

/** Di atas jumlah ini, deret pil membungkus jadi 2-3 baris di 412 px.
 *  Terukur: 6 pil berlabel penuh ~560 px, layar ponsel 412 px. Tiga atau
 *  kurang selalu muat, jadi mengubahnya jadi menu cuma menambah satu klik
 *  untuk pilihan yang sudah kelihatan semua. */
export const AMBANG_PIL = 3

/** Dipisah dari komponennya supaya bisa diuji tanpa merender apa pun —
 *  keputusannya yang penting, bukan markupnya. */
export function pakaiDropdown(tampil: 'auto' | 'pil' | 'dropdown', sempit: boolean, jumlah: number): boolean {
  if (tampil !== 'auto') return tampil === 'dropdown'
  return sempit && jumlah > AMBANG_PIL
}

export function PemilihRentang<T extends string>({
  opsi,
  nilai,
  onGanti,
  ariaLabel = 'Rentang waktu',
  className = '',
  tampil = 'auto',
  placeholder,
}: {
  /** `nonaktif` = pilihan TETAP TERLIHAT tapi tak bisa ditekan (pola sama
   *  dengan `OpsiDropdown.nonaktif`). Dipakai saat datanya memang belum ada —
   *  menyembunyikannya membuat daftar menyusut tanpa keterangan, dan
   *  membiarkannya aktif membuka layar kosong yang terbaca sebagai rusak. */
  opsi: readonly { id: T; label: string; judul?: string; nonaktif?: boolean }[]
  /** Boleh kosong: rentang yang tak sama dengan satu pun pilihan (mis. hasil
   *  geseran panah). Tak ada yang menyala, dan menu memajang `placeholder`. */
  nilai: T | ''
  onGanti: (id: T) => void
  ariaLabel?: string
  className?: string
  /** `auto` (bawaan): pil di layar lebar, dropdown di ponsel begitu
   *  pilihannya lebih dari `AMBANG_PIL`. `pil`/`dropdown` memaksa satu
   *  bentuk — dipakai kelompok yang memang selalu muat (kaki chart, lima
   *  chip kecil Indeks Dunia) atau yang diminta selalu jadi menu (bilah
   *  Arus Broker, supaya sebentuk dengan dropdown di sebelahnya). */
  tampil?: 'auto' | 'pil' | 'dropdown'
  /** Teks tombol saat `nilai` kosong — hanya terpakai dalam bentuk dropdown. */
  placeholder?: string
}) {
  const sempit = useLayarSempit()
  if (pakaiDropdown(tampil, sempit, opsi.length)) {
    return (
      <Dropdown
        opsi={opsi.map((o) => ({ nilai: o.id, label: o.label, nonaktif: o.nonaktif }))}
        nilai={nilai}
        // Dropdown bekerja dengan string biasa; T-nya dikembalikan di sini,
        // dan aman karena nilainya cuma bisa datang dari `opsi` di atas.
        onGanti={(v) => onGanti(v as T)}
        ariaLabel={ariaLabel}
        placeholder={placeholder}
      />
    )
  }
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
