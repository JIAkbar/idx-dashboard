import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

export interface Bagian {
  id: string
  label: string
  /** Hanya bagian aktif yang dipasang, jadi muatan data bagian lain tak ikut jalan. */
  isi: ReactNode
}

/**
 * Satu halaman berisi beberapa bagian — dipakai halaman hasil penggabungan
 * #200 A (Broker Pasar, Sektor & Indeks, Kalkulator). Bagian aktif disimpan di
 * `?bagian=`, jadi tautan dan tombol kembali peramban tetap bekerja, dan alamat
 * lama halaman yang digabung cukup dialihkan ke `?bagian=<id>`. Bagian pertama
 * adalah bawaan dan tidak menulis parameter.
 */
export function BagianHalaman({ label, bagian }: { label: string; bagian: Bagian[] }) {
  const [sp, setSp] = useSearchParams()
  const aktif = bagian.find((b) => b.id === sp.get('bagian')) ?? bagian[0]
  const pilih = (id: string) => {
    const baru = new URLSearchParams(sp)
    if (id === bagian[0].id) baru.delete('bagian')
    else baru.set('bagian', id)
    setSp(baru, { replace: true })
  }

  return (
    <>
      <div className="lantai">
        <div className="tabs" role="tablist" aria-label={label}>
          {bagian.map((b) => (
            <button key={b.id} type="button" role="tab" aria-selected={b.id === aktif.id}
              className={'tab' + (b.id === aktif.id ? ' on' : '')} onClick={() => pilih(b.id)}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
      {aktif.isi}
    </>
  )
}
