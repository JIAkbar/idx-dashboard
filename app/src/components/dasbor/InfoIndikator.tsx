import { useState } from 'react'
import { ModalKecil } from './ModalKecil'
import { TombolIkon } from './TombolIkon'
import { IKON_INFO } from './IkonMenu'

/**
 * Tombol "i" + modal penjelasan indikator — satu bentuk untuk seluruh halaman
 * ber-chart (permintaan Johan 27 Agu 2026: "sweep semua page setiap ada
 * indikator seperti ini berikan modal informasi terkait fungsi nya").
 *
 * Tiap item = satu kendali/indikator di halaman itu: nama persis seperti
 * label tombolnya (supaya pembaca bisa mencocokkan), lalu penjelasan APA
 * ARTINYA BAGI PEMBACA — bukan cara kerjanya di kode, bukan nama sumber
 * internal (aturan ⛔ kebocoran endpoint berlaku penuh di sini).
 *
 * Konten milik halaman pemanggil; komponen ini murni kerangka: TombolIkon
 * (#170) + ModalKecil (Escape/klik latar menutup, sadar layar penuh).
 */
export interface ItemInfoIndikator {
  nama: string
  isi: string
}

export function InfoIndikator({ judul, item }: { judul: string; item: ItemInfoIndikator[] }) {
  const [buka, setBuka] = useState(false)
  return (
    <>
      {/* className berbingkai (Johan 28 Agu: "tombol info ini berikan border
          juga dong biar keliatan jelas") — bentuknya tetap TombolIkon #170. */}
      <TombolIkon d={IKON_INFO} label="Penjelasan indikator halaman ini" className="ti-berbingkai" onClick={() => setBuka(true)} />
      {buka && (
        <ModalKecil label={judul} onClose={() => setBuka(false)} className="info-indikator">
          {item.map((x) => (
            <div key={x.nama} className="info-indikator-item">
              <strong>{x.nama}</strong>
              <p className="muted" style={{ margin: '2px 0 0', lineHeight: 1.5 }}>{x.isi}</p>
            </div>
          ))}
        </ModalKecil>
      )}
    </>
  )
}
