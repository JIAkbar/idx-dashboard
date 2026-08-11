import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Terbitan } from '../arus-pasar/Terbitan'
import { ambilEdisi, type EdisiRow } from '../lib/supabaseEdisi'

export function EdisiView() {
  const { kode } = useParams<{ kode: string }>()
  const [row, setRow] = useState<EdisiRow | null | undefined>(undefined)

  useEffect(() => {
    if (!kode) return
    let batal = false
    ambilEdisi(kode).then((r) => {
      if (!batal) setRow(r)
    })
    return () => {
      batal = true
    }
  }, [kode])

  if (row === undefined) return <p className="fe-loading">Memuat edisi {kode}…</p>
  if (row === null) {
    return (
      <p className="fe-loading">
        Edisi {kode} tidak ditemukan. <Link to="/admin">Kembali</Link>
      </p>
    )
  }

  const backBtn: CSSProperties = {
    position: 'fixed',
    top: 14,
    right: 130,
    zIndex: 10,
    padding: '9px 16px',
    background: '#fff',
    color: '#0B4F4A',
    border: '1px solid #0B4F4A',
    borderRadius: 4,
    fontSize: '10pt',
    fontWeight: 600,
    textDecoration: 'none',
  }

  return (
    <>
      <style>{'@media print { .ev-backbtn { display: none !important } }'}</style>
      <Link to="/admin" className="ev-backbtn" style={backBtn}>
        ← Admin
      </Link>
      <Terbitan ed={row.edisi_data} ohlc={row.ohlc_data} />
    </>
  )
}
