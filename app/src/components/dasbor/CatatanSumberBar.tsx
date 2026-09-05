import { catatanSumber, type RentangSumber } from '../../lib/dasbor/sumberBar'

/**
 * Catatan kecil yang menyebut bagian harga yang berasal dari penyedia
 * cadangan, bukan penyedia utama.
 *
 * Keputusan Johan 5 Sep 2026: *"pakai penanda sumber per bar, riwayat lama
 * jangan dipotong"*. Riwayat tua dipertahankan — dan karena dipertahankan,
 * pembaca berhak tahu bagian mana yang bukan dari sumber utama.
 *
 * Satu komponen untuk semua pemakai arsip harga gabungan, bukan kalimat yang
 * ditulis ulang di tiap halaman. Alasannya sama dengan komponen kanonis
 * lain di proyek ini: kalimat yang disalin akan menyimpang satu per satu,
 * dan yang menyimpang paling jauh justru yang paling jarang dibaca.
 *
 * Terukur 5 Sep 2026: dari 963 emiten hanya **6** yang punya bar cadangan,
 * total 2.034 dari 3,01 juta bar (0,1%) — hampir seluruhnya riwayat IHSG
 * 1990–2017 yang memang tak dimiliki penyedia utama. Jadi komponen ini
 * memang jarang tampil, dan itu benar: ia menandai pengecualian.
 */
export function CatatanSumberBar({ sumberBar, mulai, akhir, className = '' }: {
  /** Ruas `sumber_bar` dari berkas harga. Boleh undefined — arsip lama
   *  belum membawanya, dan diam lebih jujur daripada menebak. */
  sumberBar?: RentangSumber[]
  /** Rentang tanggal yang SEDANG ditampilkan, bukan seluruh isi berkas —
   *  catatan ini soal apa yang dilihat pembaca sekarang. */
  mulai: string
  akhir: string
  className?: string
}) {
  const teks = catatanSumber(sumberBar, mulai, akhir)
  if (!teks) return null
  return <p className={'csb-catatan ' + className}>{teks}</p>
}
