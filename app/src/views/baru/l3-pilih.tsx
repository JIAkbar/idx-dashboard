import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useJson } from './data'
import { EMITEN_BAWAAN, ruteLapisan } from './peta'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { useStockIndex } from '../../lib/dasbor/stockDetailData'
import './l3-pilih.css'

interface KartuNama { sektor?: { nama?: string } }

/**
 * Baris kepala emiten: kode + nama (dari kartu.sektor.nama) + pemilih emiten.
 * Dipakai semua lapisan layar Emiten (Harga, Berkas, Sudut broker, Broker
 * summary, Musiman) — satu komponen, bukan ditulis ulang tiap halaman.
 */
export function PilihEmiten({ slug }: { slug: string }) {
  const { kode: kodeParam } = useParams()
  const kode = (kodeParam ?? EMITEN_BAWAAN).toUpperCase()
  const navigate = useNavigate()
  const { data: kartu } = useJson<KartuNama>(`/data-idx/json/kartu/${kode}.json`)
  const { index } = useStockIndex()
  const [cari, setCari] = useState('')

  function pilih(kodeBaru: string) {
    setCari('')
    if (kodeBaru) navigate(ruteLapisan(slug, kodeBaru.toUpperCase()))
  }

  return (
    <div className="l3-pilih">
      <span className="l3-pilih-kode bb-mono">{kode}</span>
      <span className="l3-pilih-nama">{kartu?.sektor?.nama ?? '–'}</span>
      <div className="l3-pilih-cari">
        <StockAutocomplete
          stocks={index?.stocks ?? []}
          value={cari}
          onChange={setCari}
          onSelect={pilih}
          placeholder="Ganti emiten: BBCA, ASII…"
        />
      </div>
    </div>
  )
}
