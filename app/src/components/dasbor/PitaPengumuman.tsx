import { useState } from 'react'
import { IkonMenu, IKON_PERINGATAN } from './IkonMenu'
import { PENGUMUMAN, sudahDitutup, tandaiDitutup } from '../../lib/dasbor/pengumuman'
import './PitaPengumuman.css'

/**
 * Pita pengumuman sistem — muncul di atas isi halaman, bisa ditutup.
 *
 * ## Kenapa bukan `Toast`, dan kenapa bukan modal
 *
 * `Toast` yang sudah ada adalah umpan balik AKSI (unggah berhasil, hapus
 * gagal): muncul sebentar lalu hilang sendiri, tanpa tombol tutup dan tanpa
 * ingatan. Dipakai untuk pengumuman menetap, ia akan muncul lagi setiap kali
 * pengguna pindah halaman — dan peringatan yang muncul berulang berhenti
 * dibaca. Membengkokkan `Toast` supaya bisa keduanya berarti memberinya dua
 * tanggung jawab yang berbeda umurnya.
 *
 * Modal juga ditolak: ia MENGHALANGI, dan yang disampaikan di sini kabar
 * ("sebagian angka mungkin tertinggal"), bukan keputusan yang harus diambil
 * pengguna sebelum lanjut. Memaksa klik untuk membaca kabar melatih orang
 * menutup modal tanpa membacanya — persis yang bikin peringatan berikutnya
 * yang benar-benar penting ikut terlewat.
 *
 * Pita menetap sampai ditutup: terbaca tanpa menghalangi, dan sekali ditutup
 * tak kembali.
 */
export function PitaPengumuman() {
  const [tutup, setTutup] = useState(() => sudahDitutup(PENGUMUMAN.id))

  if (!PENGUMUMAN.aktif || tutup) return null

  return (
    <div className={`pp-pita pp-${PENGUMUMAN.nada}`} role="status" aria-live="polite">
      <span className="pp-ikon" aria-hidden="true">
        <IkonMenu d={IKON_PERINGATAN} size={14} />
      </span>
      <div className="pp-teks">
        <strong>{PENGUMUMAN.judul}</strong>
        <span>{PENGUMUMAN.pesan}</span>
      </div>
      <button
        type="button"
        className="pp-tutup"
        aria-label="Tutup pengumuman"
        onClick={() => {
          tandaiDitutup(PENGUMUMAN.id)
          setTutup(true)
        }}
      >
        ✕
      </button>
    </div>
  )
}
