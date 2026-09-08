import type { ReactNode } from 'react'
import { pilihRasio, JUDUL_ASAL, type RuasRotasi } from '../../lib/dasbor/rasioUtamaKeystats'

/** Peta rasio dari sumber utama yang sedang dipegang halaman; null = belum termuat. */
export type PetaRasio = Record<string, number | null> | null

/**
 * Satu angka yang sumbernya DIROTASI (#36 A) beserta lencana asalnya.
 *
 * Lencananya muncul HANYA ketika angkanya jatuh ke cadangan lama. Menandai
 * yang datang dari sumber utama juga berarti memasang tanda di hampir tiap
 * baris, dan tanda yang ada di mana-mana berhenti dibaca — alasan yang sama
 * dengan `LencanaTurunan` di sebelah, yang cuma menandai yang menyimpang.
 *
 * `render` menerima angkanya karena keempat pemakainya menampilkannya dengan
 * cara berbeda (angka polos, persen, lencana warna Altman). Menyalin komponen
 * ini per bentuk tampilan akan melahirkan empat aturan pemilihan sumber yang
 * bisa berbeda diam-diam.
 */
export function NilaiRotasi(
  { ruas, lama, rasio, render, lencanaLama }: {
    ruas: RuasRotasi
    lama: number | null | undefined
    rasio: PetaRasio
    render: (v: number | null) => ReactNode
    /**
     * Lencana milik sumber LAMA (mis. `LencanaTurunan`), dipasang hanya
     * kalau angka lamanya yang benar-benar tayang. Tanpa ini, merotasi
     * sebuah ruas diam-diam menghapus keterangan "angka ini dihitung
     * ulang" yang sudah terpasang di baris itu sebelumnya.
     */
    lencanaLama?: ReactNode
  },
) {
  const { nilai, asal } = pilihRasio(ruas, lama, rasio)
  return (
    <>
      {render(nilai)}
      {asal === 'cadangan-lama' && (
        <>
          {lencanaLama}
          <sup title={JUDUL_ASAL['cadangan-lama']} style={{ color: 'var(--text3)' }}>c</sup>
        </>
      )}
    </>
  )
}
